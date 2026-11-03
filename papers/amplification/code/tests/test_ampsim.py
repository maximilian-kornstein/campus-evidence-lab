"""Tests for ampsim (run from papers/amplification/code):

    OPENBLAS_NUM_THREADS=1 nice python -m pytest tests -q

Covers: determinism of the simulator; Rogan-Gladen unbiasedness on large samples and the band-stratified
identity; Markov stationary law, fundamental matrix, hitting times, Kemeny constant and perturbation
identities; time-uniform coverage of the confidence sequences on iid data.
"""
from __future__ import annotations

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ampsim import markov as mk  # noqa: E402
from ampsim import measurement as ms  # noqa: E402
from ampsim import sequential as sq  # noqa: E402
from ampsim.engine import (POL, ChoiceConfig, GlobalState, RecConfig, SessionConfig,  # noqa: E402
                           exposure_true, make_puppets, measure, train)
from ampsim.world import World, WorldConfig  # noqa: E402

SMALL = WorldConfig(n_items=1200, seed_pool=60)
SES = SessionConfig(n_sessions=2, T=8)


@pytest.fixture(scope="module")
def world():
    return World(SMALL, [7, 7])


def _run(world, seed, dynamic=False, regime="ND"):
    rec = RecConfig()
    rng = np.random.default_rng(seed)
    pers = np.repeat(np.arange(4), 8)
    pol = np.tile(np.arange(4), 8)
    acc = make_puppets(world, pers, pol, rng)
    glob = GlobalState(world, rec, V=50.0, dynamic=dynamic)
    train(world, acc, glob, rec, SES)
    out = measure(world, acc, glob, rec, ChoiceConfig(), SES, rng, regime, record_markov=True)
    return out, glob


# ------------------------------------------------------------------ determinism and engine sanity
def test_determinism(world):
    a, ga = _run(world, 123, dynamic=True)
    b, gb = _run(world, 123, dynamic=True)
    for k in ("counts", "opens_state", "trans", "emis"):
        assert np.array_equal(a[k], b[k])
    assert np.array_equal(ga.pop, gb.pop)
    c, _ = _run(world, 124, dynamic=True)
    assert not np.array_equal(a["counts"], c["counts"])


def test_world_determinism():
    w1 = World(SMALL, [1, 2])
    w2 = World(SMALL, [1, 2])
    assert np.array_equal(w1.X, w2.X) and np.array_equal(w1.type, w2.type) and np.array_equal(w1.nn, w2.nn)


def test_counts_and_slates(world):
    out, _ = _run(world, 5)
    n_impr = out["n_impr"]
    assert np.all(out["counts"].sum(1) == n_impr)
    e = exposure_true(world, out["counts"], n_impr)
    assert np.all((e >= 0) & (e <= 1))
    # transitions: one per step
    assert np.all(out["trans"].sum((1, 2)) == SES.n_sessions * SES.T)


def test_no_duplicate_items_in_slates(world):
    from ampsim import engine as E
    rec, ch = RecConfig(), ChoiceConfig()
    rng = np.random.default_rng(3)
    acc = make_puppets(world, np.repeat(np.arange(4), 25), np.tile(np.arange(4), 25), rng)
    glob = GlobalState(world, rec)
    rows = E._rows(acc)
    for _ in range(20):
        slate, logit, opened = E.step(world, acc, glob, rec, ch, rng, "ND", *rows)
        s = np.sort(slate, axis=1)
        assert not np.any(s[:, 1:] == s[:, :-1])
        assert np.all((opened == -1) | np.any(slate == opened[:, None], axis=1))


def test_reference_policies_ignore_user_embedding(world):
    """chron / random / popular slates must not depend on the algorithm's user embedding."""
    from ampsim import engine as E
    rec, ch = RecConfig(), ChoiceConfig()
    acc = make_puppets(world, np.zeros(30, np.int64), np.repeat([1, 2, 3], 10), np.random.default_rng(0))
    glob = GlobalState(world, rec)
    rows = E._rows(acc)
    s1, _, _ = E.step(world, acc, glob, rec, ch, np.random.default_rng(9), "ND", *rows)
    acc.v[:] = np.random.default_rng(1).standard_normal(acc.v.shape)
    s2, _, _ = E.step(world, acc, glob, rec, ch, np.random.default_rng(9), "ND", *rows)
    assert np.array_equal(s1, s2)


def test_classifier_rates(world):
    rng = np.random.default_rng(0)
    for g in ("ND", "DU", "DD"):
        m, om = world.classifier(g)
        items = np.repeat(np.arange(world.N), 40)
        flag = world.score(g, items, rng) >= 0
        for t in range(4):
            sel = world.type[items] == t
            from scipy.stats import norm
            assert abs(flag[sel].mean() - norm.cdf(m[t])) < 0.02


# ------------------------------------------------------------------ Rogan-Gladen
def test_rogan_gladen_unbiased_large_sample():
    rng = np.random.default_rng(1)
    p, se, sp = 0.04, 0.8, 0.97
    n = 200_000
    est = []
    for _ in range(200):
        L = rng.random(n) < p
        flag = np.where(L, rng.random(n) < se, rng.random(n) > sp)
        est.append(ms.rogan_gladen(flag.mean(), se, sp))
    est = np.array(est)
    assert abs(est.mean() - p) < 4 * est.std(ddof=1) / np.sqrt(est.size) + 1e-5
    # naive is biased: q = se p + (1 - sp)(1 - p)
    assert abs(flag.mean() - (se * p + (1 - sp) * (1 - p))) < 0.003


def test_rogan_gladen_band_identity():
    """IPW Se/Sp from a band-stratified validation sample + Rogan-Gladen == sum_h W_h p_h."""
    rng = np.random.default_rng(2)
    N_h = rng.integers(100, 5000, (50, 5)).astype(float)
    A_h = np.floor(N_h * rng.random((50, 5)) * np.array([0.001, 0.01, 0.1, 0.5, 0.9]))
    n_h = np.minimum(100, N_h)
    a_h = rng.hypergeometric(A_h.astype(int), (N_h - A_h).astype(int), n_h.astype(int))
    se, sp, q, direct = ms.se_sp_from_validation(A_h, N_h, a_h, n_h)
    assert np.allclose(ms.rogan_gladen(q, se, sp), direct)


def test_stratified_correction_unbiased_on_synthetic_counts():
    """estimate_contrast: arm-stratified RG is unbiased for the true exposure under differential error,
    the naive estimator is not, and the true-label estimator matches the truth."""
    rng = np.random.default_rng(3)
    R, U = 400, 40
    n_impr = 800

    def puppets(p_type, band_given_type):
        c = np.zeros((R, U, 20), np.int64)
        types = rng.multinomial(n_impr, p_type, size=(R, U))
        for t in range(4):
            c[..., t * 5:(t + 1) * 5] = np.stack([rng.multinomial(x, band_given_type[t]) for x in types[..., t].ravel()]
                                                 ).reshape(R, U, 5)
        return c

    bands = np.array([[.6, .3, .08, .015, .005],      # neutral
                      [.2, .2, .2, .2, .2],           # borderline: many false positives
                      [.02, .08, .2, .3, .4],         # coded
                      [.0, .01, .04, .15, .8]])       # explicit
    pa = np.array([.80, .14, .04, .02])               # alg: more borderline and coded
    pr = np.array([.93, .05, .01, .01])
    ca, cr = puppets(pa, bands), puppets(pr, bands)
    est = ms.estimate_contrast(ca, cr, n_impr, 1000, rng)
    AR0 = (pa[2:].sum()) / (pr[2:].sum())
    AA0 = pa[2:].sum() - pr[2:].sum()
    assert abs(np.median(est["true"]["ar"]) / AR0 - 1) < 0.02
    rs = est["rg_strat"]
    assert abs(np.mean(rs["aa"]) - AA0) < 4 * np.std(rs["aa"]) / np.sqrt(R) + 1e-4
    naive_aa = np.mean(est["naive"]["aa"])
    assert abs(naive_aa - AA0) > 10 * np.std(est["naive"]["aa"]) / np.sqrt(R)
    cov = np.mean(np.abs(rs["aa"] - AA0) <= 1.96 * rs["aa_se"])
    assert 0.90 <= cov <= 0.99


# ------------------------------------------------------------------ Markov chains
def _random_P(rng, m):
    P = rng.random((m, m)) + 0.05
    return P / P.sum(1, keepdims=True)


def test_stationary_distribution():
    rng = np.random.default_rng(4)
    for m in (2, 3, 5, 8):
        P = _random_P(rng, m)
        pi = mk.stationary(P)
        assert np.allclose(pi @ P, pi, atol=1e-12)
        assert abs(pi.sum() - 1) < 1e-12 and np.all(pi > 0)
        w, V = np.linalg.eig(P.T)
        v = np.real(V[:, np.argmin(np.abs(w - 1))])
        assert np.allclose(pi, v / v.sum(), atol=1e-10)
        # long-run frequency of a simulated chain
    P = np.array([[.9, .08, .02], [.3, .6, .1], [.2, .3, .5]])
    pi = mk.stationary(P)
    x, n = 0, 400_000
    cnt = np.zeros(3)
    cum = np.cumsum(P, axis=1)
    u = rng.random(n)
    for t in range(n):
        x = int(np.searchsorted(cum[x], u[t]))
        cnt[x] += 1
    assert np.allclose(cnt / n, pi, atol=0.006)


def test_fundamental_matrix_identities():
    rng = np.random.default_rng(5)
    P = _random_P(rng, 4)
    pi = mk.stationary(P)
    Z = mk.fundamental(P)
    H = mk.group_inverse(P)
    A = np.eye(4) - P
    assert np.allclose(A @ H @ A, A) and np.allclose(H @ A @ H, H) and np.allclose(A @ H, H @ A)
    assert np.allclose(Z.sum(1), 1.0)
    lam = np.linalg.eigvals(P)
    lam = lam[np.argsort(np.abs(lam - 1))][1:]
    assert abs(mk.kemeny(P) - np.real(np.sum(1 / (1 - lam)))) < 1e-10
    M = mk.mfpt(P)
    # M_xy solves M_xy = 1 + sum_{z != y} P_xz M_zy
    for y in range(4):
        idx = [z for z in range(4) if z != y]
        Q = P[np.ix_(idx, idx)]
        t = np.linalg.solve(np.eye(3) - Q, np.ones(3))
        assert np.allclose(M[idx, y], t)
        assert np.allclose(mk.hitting_time(P, y)[idx], t)
    assert np.allclose(M @ pi, mk.kemeny(P))      # K = sum_y pi_y M_xy for every x


def test_theory_table_values():
    """The illustrative chains of sec:markov-example (values from the THEORY table)."""
    Pr = np.array([[.95, .04, .01], [.5, .4, .1], [.4, .3, .3]])
    Pa = np.array([[.92, .06, .02], [.3, .55, .15], [.2, .35, .45]])
    a = np.array([1.0, 0, 0])
    sr, sa = mk.summaries(Pr, a), mk.summaries(Pa, a)
    assert round(sr["pi_A"], 4) == 0.0232 and round(sa["pi_A"], 4) == 0.0711
    assert round(sr["e_20"], 4) == 0.0207 and round(sa["e_20"], 4) == 0.0599
    assert round(sr["kappa_A"], 3) == 0.742 and round(sa["kappa_A"], 3) == 1.008
    assert round(sr["hit_from_N"], 1) == 64.0 and round(sa["hit_from_N"], 1) == 28.3
    pt = mk.perturbation(Pr, Pa)
    assert abs(pt["identity_A"] - pt["delta_A"]) < 1e-12
    assert round(pt["bound_A"], 3) == 0.297


def test_perturbation_identity_and_bounds():
    rng = np.random.default_rng(6)
    for _ in range(50):
        P0 = _random_P(rng, 3)
        P1 = 0.8 * P0 + 0.2 * _random_P(rng, 3)
        a = np.array([1.0, 0, 0])
        pt = mk.perturbation(P0, P1, a=a, T=20)
        assert abs(pt["identity_A"] - pt["delta_A"]) < 1e-10
        assert abs(pt["delta_A"]) <= pt["bound_A"] + 1e-12
        assert pt["delta_l1"] <= pt["bound_l1"] + 1e-12
        assert abs(pt["delta_eT"]) <= pt["bound_eT"] + 1e-12
        # finite-horizon formula of prop:markov(b)
        pi = mk.stationary(P0)
        g = mk.exposure_potential(P0)
        PT = np.linalg.matrix_power(P0, 20)
        assert abs(mk.e_T(P0, a, 20) - (pi[2] + a @ (np.eye(3) - PT) @ g / 20)) < 1e-12
    # derivative along a path
    P0 = _random_P(rng, 3)
    D = _random_P(rng, 3) - P0
    h = 1e-6
    num = (mk.stationary(P0 + h * D)[2] - mk.stationary(P0 - h * D)[2]) / (2 * h)
    assert abs(num - mk.stationary(P0) @ D @ mk.exposure_potential(P0)) < 1e-6


def test_markov_mle_recovers_P():
    rng = np.random.default_rng(7)
    P = np.array([[.9, .08, .02], [.3, .6, .1], [.2, .3, .5]])
    cum = np.cumsum(P, axis=1)
    C = np.zeros((3, 3))
    for _ in range(3000):
        x = 0
        for _ in range(20):
            y = int(np.searchsorted(cum[x], rng.random()))
            C[x, y] += 1
            x = y
    Ph, _ = mk.estimate_P(C)
    assert np.allclose(Ph, P, atol=0.03)


# ------------------------------------------------------------------ confidence sequences
def test_subgaussian_cs_time_uniform_coverage():
    rng = np.random.default_rng(8)
    R, n = 2000, 500
    x = rng.standard_normal((R, n)) + 0.3
    lo, hi = sq.subgaussian_cs(x, 0.05, 50, sigma=1.0)
    cover = np.all((lo <= 0.3) & (0.3 <= hi), axis=1).mean()
    assert cover >= 0.95 - 2 * np.sqrt(0.05 * 0.95 / R)


def test_asymptotic_cs_coverage_after_burn_in():
    """The plug-in (asymptotic) normal-mixture CS is only asymptotically valid: near-nominal for Gaussian data
    after a burn-in; for skewed data it can undercover (documented, checked loosely)."""
    rng = np.random.default_rng(9)
    R, n = 2000, 800
    x = rng.standard_normal((R, n)) + 1.0
    lo, hi = sq.asymptotic_cs(x, 0.05, 50)
    cover = np.all((lo[:, 29:] <= 1) & (1 <= hi[:, 29:]), axis=1).mean()
    assert cover >= 0.94
    x = rng.exponential(1.0, (R, n))          # skewed iid data, mean 1
    lo, hi = sq.asymptotic_cs(x, 0.05, 50)
    cover = np.all((lo[:, 29:] <= 1) & (1 <= hi[:, 29:]), axis=1).mean()
    assert cover >= 0.88


def test_betting_cs_coverage_bounded():
    rng = np.random.default_rng(10)
    R, n = 200, 300
    x = rng.beta(2, 5, (R, n))                # mean 2/7
    lo, hi = sq.betting_cs(x, 0.05, grid=np.linspace(0.001, 0.999, 999))
    mu = 2 / 7
    ok = np.all((np.nan_to_num(lo, nan=1) <= mu + 1e-3) & (mu - 1e-3 <= np.nan_to_num(hi, nan=0)), axis=1)
    assert ok.mean() >= 0.95 - 2 * np.sqrt(0.05 * 0.95 / R)
    assert np.nanmean(hi[:, -1] - lo[:, -1]) < 0.15


def test_fixed_n_power_formula():
    rng = np.random.default_rng(11)
    eff, sd, n = 0.3, 1.0, 60
    x = rng.normal(eff, sd, (20000, n))
    z = x.mean(1) / (x.std(1, ddof=1) / np.sqrt(n))
    emp = np.mean(np.abs(z) > 1.959964)
    assert abs(emp - sq.fixed_n_power(eff, sd, n, 0.05)) < 0.02
    assert abs(sq.fixed_n_power(eff, sd, sq.fixed_n_size(eff, sd, 0.05, 0.8), 0.05) - 0.8) < 1e-3


def test_bernoulli_mixture_cs_coverage():
    rng = np.random.default_rng(12)
    R, n, p = 2000, 400, 0.03
    x = rng.random((R, n)) < p
    s = np.cumsum(x, 1)
    nn = np.arange(1, n + 1)[None, :].repeat(R, 0)
    grid = np.linspace(1e-4, 0.5, 5000)
    lo, hi = sq.bernoulli_mixture_cs(nn[:, ::10], s[:, ::10], 0.05, grid)
    lo = np.fmax.accumulate(lo, 1)
    hi = np.fmin.accumulate(hi, 1)
    cover = np.all((lo <= p + 1e-4) & (p - 1e-4 <= hi), 1).mean()
    assert cover >= 0.95 - 2 * np.sqrt(0.05 * 0.95 / R)


def test_fieller_cs_coverage_known_nuisance():
    """alg:sequential with known nuisance on iid pairs: time-uniform coverage of AR after a one-wave burn-in."""
    rng = np.random.default_rng(13)
    R, N = 1000, 300
    f, J = 0.02, 0.83
    mu_a, mu_r = 0.045, 0.03                      # AR = 1.5
    Ea = np.clip(rng.normal(mu_a, 0.012, (R, N)), 0, 1)
    Er = np.clip(rng.normal(mu_r, 0.010, (R, N)), 0, 1)
    Qa = f + J * Ea + rng.normal(0, 0.005, (R, N))
    Qr = f + J * Er + rng.normal(0, 0.005, (R, N))
    AR = (Ea.mean() / Er.mean())
    looks = np.arange(5, N + 1, 5)
    box = {k: np.full((R, looks.size), f) for k in ("fa_lo", "fa_hi", "fr_lo", "fr_hi")}
    L, U = sq.fieller_cs(Qa, Qr, looks, box, (1.0, 1.0), (box["fa_lo"], box["fr_lo"]), 1.0, 0.05, 40,
                         np.exp(np.linspace(np.log(0.2), np.log(5), 800)))
    cover = np.all((L <= AR * 1.003) & (AR / 1.003 <= U), 1).mean()
    assert cover >= 0.93
    assert np.mean(L[:, -1] > 1) > 0.9            # and it detects AR = 1.5


def test_alg1_coverage_and_burn_in():
    """Algorithm 1 (alg:sequential, revised) on iid positive pairs: near-nominal time-uniform coverage of the
    log ratio after a one-wave burn-in, and detection of AR = 1.5."""
    rng = np.random.default_rng(14)
    R, N = 2000, 300
    Ya = rng.gamma(9.0, 0.045 / 9.0, (R, N))
    Yr = rng.gamma(9.0, 0.030 / 9.0, (R, N))
    looks = np.arange(5, N + 1, 5)
    o = sq.alg1_cs(Ya, Yr, looks, 0.05, 40, burn=1)
    th = np.log(1.5)
    cover = np.all((o["L"][:, 1:] <= th) & (th <= o["U"][:, 1:]), 1).mean()
    assert cover >= 0.93
    assert np.mean(o["L"][:, -1] > 0) > 0.99
    assert np.all(np.isneginf(o["L"][:, 0]))      # the burn-in wave cannot narrow [L, U]
    # the sensitivity range widens the set by log(lambda+/lambda-)
    o2 = sq.alg1_cs(Ya, Yr, looks, 0.05, 40, lam_range=(0.95, 1.05), burn=1)
    assert np.allclose((o2["hi"] - o2["lo"]) - (o["hi"] - o["lo"]), np.log(1.05 / 0.95))
