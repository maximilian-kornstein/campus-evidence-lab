"""Tests for the SIM-EST estimators (darkfig.estimators, loglinear, lcmcr, linkerror).

Run from ``papers/dark-figure/code``::

    nice python -m pytest tests/test_estimators.py -q            # everything (~1-2 min)
    nice python -m pytest tests/test_estimators.py -q -m "not slow"  # quick subset

Heavy Monte Carlo checks carry the ``slow`` marker.
"""

from __future__ import annotations

import itertools
import json
import math
import os
import sys
import warnings

import numpy as np
import pytest
from scipy.special import betaln, gammaln

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from darkfig.estimators import (  # noqa: E402
    Estimate,
    chao_lower_bound,
    lcmcr,
    lincoln_petersen,
    linkage_corrected,
    loglinear_bma,
    loglinear_closed_form,
    loglinear_model,
)
from darkfig.lcmcr import gibbs_lcmcr  # noqa: E402
from darkfig.linkerror import detachment_matrix, expected_observed, simulate_observed  # noqa: E402
from darkfig.loglinear import (  # noqa: E402
    array_to_table,
    design_matrix,
    hierarchical_models,
    histories,
    interaction_terms,
    irls_poisson,
    table_to_array,
)

with warnings.catch_warnings():  # "slow" may not be registered in a pytest config
    warnings.simplefilter("ignore")
    slow = pytest.mark.slow


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _table(Y: np.ndarray) -> dict:
    K = Y.shape[1]
    codes = Y.astype(np.int64) @ (1 << np.arange(K))
    c = np.bincount(codes, minlength=2**K)
    return {tuple(int(b) for b in histories(K)[m]): int(c[m]) for m in range(1, 2**K)}


def sim_independent(N, p, rng) -> dict:
    p = np.asarray(p)
    return _table(rng.random((N, p.size)) < p)


def sim_latent(N, lam, w, rng) -> dict:
    lam = np.asarray(lam)
    z = rng.choice(len(w), size=N, p=w)
    return _table(rng.random((N, lam.shape[1])) < lam[z])


def expected_table(N, lam, w) -> np.ndarray:
    """Expected cell counts (bitmask array) of a latent-class capture model."""
    lam = np.atleast_2d(lam)
    H = histories(lam.shape[1])
    q = np.prod(np.where(H[:, None, :] == 1, lam[None], 1 - lam[None]), axis=2)  # (2^K, J)
    return N * q @ np.asarray(w, dtype=float)


def random_table(K, rng, lo=5, hi=200, floats=False) -> dict:
    vals = rng.uniform(lo, hi, 2**K - 1) if floats else rng.integers(lo, hi, 2**K - 1)
    return {tuple(int(b) for b in histories(K)[m]): float(vals[m - 1]) for m in range(1, 2**K)}


# --------------------------------------------------------------------------
# table utilities
# --------------------------------------------------------------------------
def test_table_roundtrip_and_zero_history_ignored():
    rng = np.random.default_rng(0)
    t = random_table(4, rng, floats=True)
    y, K = table_to_array(t)
    assert K == 4 and y[0] == 0
    assert array_to_table(y, K) == t
    t2 = dict(t)
    t2[(0, 0, 0, 0)] = 12345.0  # unobservable cell is ignored
    assert np.array_equal(table_to_array(t2)[0], y)
    # sparse dict (missing histories are zero) and numpy-int keys
    sparse = {(np.int64(1), 0, 0): 3, (0, 1, 1): 2}
    ys, Ks = table_to_array(sparse)
    assert Ks == 3 and ys[1] == 3 and ys[6] == 2 and ys.sum() == 5
    with pytest.raises(ValueError):
        table_to_array({(1, 0): -1})
    with pytest.raises(ValueError):
        table_to_array({(1, 0): 1, (1, 0, 1): 2})


def test_hierarchical_model_enumeration_matches_brute_force():
    assert len(hierarchical_models(4, 2)) == 64
    assert len(hierarchical_models(3, 2)) == 8
    for K, r in [(4, 3), (3, 2), (5, 2)]:
        terms = interaction_terms(K, r)
        brute = 0
        for bits in itertools.product([0, 1], repeat=len(terms)):
            chosen = {S for S, b in zip(terms, bits) if b}
            if all(len(S) == 2 or all(sub in chosen for sub in itertools.combinations(S, len(S) - 1)) for S in chosen):
                brute += 1
        models = hierarchical_models(K, r)
        assert len(models) == brute
        assert len(set(models)) == len(models)


# --------------------------------------------------------------------------
# closed form (Thm thm:closed)
# --------------------------------------------------------------------------
def test_closed_form_K2_equals_lincoln_petersen_classic():
    rng = np.random.default_rng(1)
    for floats in (False, True):
        for _ in range(20):
            t = random_table(2, rng, floats=floats)
            cf = loglinear_closed_form(t, omega=0.0)
            lp = lincoln_petersen(t)
            assert cf.N_hat == pytest.approx(lp.extra["classic"], rel=1e-12)
            n1, n2, m = t[(1, 0)] + t[(1, 1)], t[(0, 1)] + t[(1, 1)], t[(1, 1)]
            assert lp.extra["classic"] == pytest.approx(n1 * n2 / m, rel=1e-14)


@pytest.mark.parametrize("K", [3, 4])
@pytest.mark.parametrize("omega", [0.0, 0.8, -1.5])
def test_closed_form_equals_irls_model_with_offset(K, omega):
    """n0_hat(omega) == fitted mu_0 of the all-but-K-way model with u_[K] offset to omega."""
    rng = np.random.default_rng(10 + K)
    X, _ = design_matrix(K, interaction_terms(K, K - 1))
    off = np.zeros(2**K)
    off[-1] = omega  # the K-way term enters only the all-ones history
    for floats in (False, True):
        t = random_table(K, rng, floats=floats)
        y, _ = table_to_array(t)
        fit = irls_poisson(y[1:], X[1:], offset=off[1:])
        assert fit["converged"]
        np.testing.assert_allclose(fit["mu"], y[1:], rtol=1e-9)  # saturated on observed cells
        mu0 = math.exp(fit["beta"][0])
        cf = loglinear_closed_form(t, omega=omega)
        assert cf.extra["n0_hat"] == pytest.approx(mu0, rel=1e-6)
        assert cf.N_hat == pytest.approx(y.sum() + mu0, rel=1e-9)


def test_closed_form_interval_and_zero_correction():
    rng = np.random.default_rng(2)
    t = random_table(4, rng)
    y, _ = table_to_array(t)
    z = 1.959963984540054
    # SPEC formula Var(log n0_hat) = sum 1/n_h ...
    cf0 = loglinear_closed_form(t, n0_sampling_var=False)
    assert cf0.extra["se_log_n0"] == pytest.approx(math.sqrt(np.sum(1.0 / y[1:])), rel=1e-12)
    # ... plus 1/n0_hat for the realised n_0 (default)
    cf = loglinear_closed_form(t)
    n0 = cf.extra["n0_hat"]
    se = math.sqrt(np.sum(1.0 / y[1:]) + 1.0 / n0)
    assert cf.extra["se_log_n0"] == pytest.approx(se, rel=1e-12)
    assert cf.lo == pytest.approx(y.sum() + n0 * math.exp(-z * se), rel=1e-12)
    assert cf.hi == pytest.approx(y.sum() + n0 * math.exp(z * se), rel=1e-12)
    # omega shifts log n0 by (-1)^K omega (Cor cor:bounds)
    assert loglinear_closed_form(t, omega=0.5).extra["log_n0_hat"] == pytest.approx(math.log(n0) + 0.5)
    # zero cell: auto-correction adds 0.5 to every cell
    t0 = dict(t)
    t0[(1, 1, 1, 1)] = 0  # |h| = 4 even -> in the denominator
    c_auto = loglinear_closed_form(t0)
    assert c_auto.extra["corrected"] and np.isfinite(c_auto.N_hat)
    tc = {h: v + 0.5 for h, v in t0.items()}
    assert c_auto.extra["n0_hat"] == pytest.approx(loglinear_closed_form(tc, correction="none").extra["n0_hat"])
    assert c_auto.n_obs == int(sum(t0.values()))
    assert math.isinf(loglinear_closed_form(t0, correction="none").N_hat)
    assert not loglinear_closed_form(t).extra["corrected"]


def test_closed_form_K2_sampling_variance_reproduces_classic_lp_variance():
    """With the n_0 sampling term, Var(n0_hat) = n1 n2 (n1-m)(n2-m)/m^3 exactly for K = 2."""
    t = {(1, 0): 140.0, (0, 1): 95.0, (1, 1): 60.0}
    cf = loglinear_closed_form(t, n0_sampling_var=True)
    n0 = cf.extra["n0_hat"]
    lp = lincoln_petersen(t)
    assert n0**2 * cf.extra["se_log_n0"] ** 2 == pytest.approx(lp.extra["var_classic"], rel=1e-12)


# --------------------------------------------------------------------------
# Lincoln-Petersen / Chapman
# --------------------------------------------------------------------------
def test_lincoln_petersen_chapman_and_collapse():
    t = {(1, 0, 0): 30, (0, 1, 0): 20, (1, 1, 0): 10, (0, 0, 1): 7, (1, 0, 1): 5, (1, 1, 1): 2}
    lp = lincoln_petersen(t, lists=(0, 1))
    n1, n2, m = 30 + 10 + 5 + 2, 20 + 10 + 2, 10 + 2
    assert lp.extra["chapman"] == pytest.approx((n1 + 1) * (n2 + 1) / (m + 1) - 1)
    assert lp.extra["classic"] == pytest.approx(n1 * n2 / m)
    assert lp.extra["var_chapman"] == pytest.approx((n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m) / ((m + 1) ** 2 * (m + 2)))
    assert lp.N_hat == lp.extra["chapman"]
    assert lp.n_obs == sum(t.values())
    assert lp.extra["n12"] <= lp.lo < lp.N_hat < lp.hi
    lp02 = lincoln_petersen(t, lists=(0, 2))
    assert lp02.extra["m"] == 5 + 2
    # m = 0: Chapman finite, classic infinite
    z = lincoln_petersen({(1, 0): 10, (0, 1): 8})
    assert np.isfinite(z.N_hat) and math.isinf(z.extra["classic"])


# --------------------------------------------------------------------------
# log-linear model averaging
# --------------------------------------------------------------------------
def test_bma_degenerate_cases_match_single_models():
    rng = np.random.default_rng(3)
    t = sim_independent(2000, [0.3, 0.25, 0.2, 0.35], rng)
    b1 = loglinear_bma(t, max_order=1)  # only the independence model
    m1 = loglinear_model(t)
    assert b1.extra["n_models"] == 1
    assert b1.N_hat == pytest.approx(m1.N_hat, rel=1e-10)
    assert b1.lo == pytest.approx(m1.lo, rel=1e-8) and b1.hi == pytest.approx(m1.hi, rel=1e-8)
    # K = 3: the all-two-way model is saturated on observed cells -> closed form
    t3 = random_table(3, rng, lo=20, hi=200)
    full = loglinear_model(t3, terms="all2")
    assert full.N_hat == pytest.approx(loglinear_closed_form(t3).N_hat, rel=1e-8)
    b = loglinear_bma(t3, return_models=True)
    assert b.extra["n_models"] == 8 and len(b.extra["models"]) == 8
    assert sum(mm["weight"] for mm in b.extra["models"]) == pytest.approx(1.0)
    assert b.lo < b.N_hat < b.hi


def test_bma_unbiased_under_independence():
    rng = np.random.default_rng(4)
    N = 2000
    est, cover = [], []
    for _ in range(200):
        t = sim_independent(N, [0.3, 0.25, 0.2, 0.35], rng)
        e = loglinear_bma(t)
        est.append(e.N_hat)
        cover.append(e.covers(N))
    rel_bias = np.mean(est) / N - 1
    assert abs(rel_bias) < 0.03
    assert np.mean(cover) >= 0.85


def test_bma_detects_dependence():
    """Under positive dependence between lists 1 and 2, BMA moves weight off independence."""
    rng = np.random.default_rng(5)
    lam = [[0.6, 0.6, 0.3, 0.3], [0.1, 0.1, 0.3, 0.3]]  # lists 1,2 share heterogeneity
    t = sim_latent(4000, lam, [0.5, 0.5], rng)
    b = loglinear_bma(t)
    assert [0, 1] in b.extra["best_model"]
    assert b.extra["weight_independence"] < 1e-3


def test_bma_handles_zero_cells():
    rng = np.random.default_rng(6)
    t = random_table(4, rng, lo=3, hi=30)
    t[(1, 1, 1, 1)] = 0
    t[(1, 1, 1, 0)] = 0
    b = loglinear_bma(t)
    assert np.isfinite(b.N_hat) and b.lo <= b.N_hat <= b.hi


# --------------------------------------------------------------------------
# Chao lower bound (Thm thm:chao)
# --------------------------------------------------------------------------
def test_chao_formula():
    t = {(1, 0, 0, 0): 300, (0, 1, 0, 0): 200, (1, 1, 0, 0): 90, (0, 0, 1, 1): 30, (1, 1, 1, 0): 12, (1, 1, 1, 1): 3}
    e = chao_lower_bound(t)
    f1, f2, n, c = 500.0, 120.0, 635.0, 0.75
    f0 = c * f1**2 / (2 * f2)
    r = f1 / f2
    var = f2 * (c / 2 * r**2 + c**2 * r**3 + c**2 / 4 * r**4)
    assert e.N_hat == pytest.approx(n + f0)
    assert e.extra["var"] == pytest.approx(var, rel=1e-12)
    C = math.exp(1.959963984540054 * math.sqrt(math.log(1 + var / f0**2)))
    assert e.lo == pytest.approx(n + f0 / C) and e.hi == pytest.approx(n + f0 * C)
    # f2 = 0: bias-corrected fallback
    e0 = chao_lower_bound({(1, 0, 0): 10, (0, 1, 0): 5, (1, 1, 1): 2})
    assert e0.extra["bias_corrected"]
    assert e0.N_hat == pytest.approx(17 + (2 / 3) * 15 * 14 / 2)


def test_chao_bound_in_expectation():
    """E f0 >= c (E f1)^2 / (2 E f2), with equality under homogeneity (Cauchy-Schwarz)."""
    for K in (3, 4, 5):
        c = (K - 1) / K
        pc = histories(K).sum(1)
        hom = expected_table(1000, [[0.3] * K], [1.0])
        f = np.bincount(pc, weights=hom)
        assert f[0] == pytest.approx(c * f[1] ** 2 / (2 * f[2]), rel=1e-12)
        het = expected_table(1000, [[0.05] * K, [0.6] * K], [0.6, 0.4])
        f = np.bincount(pc, weights=het)
        assert f[0] > c * f[1] ** 2 / (2 * f[2])


def test_chao_monte_carlo_homogeneous_and_heterogeneous():
    rng = np.random.default_rng(7)
    N = 2000
    hom = [chao_lower_bound(sim_independent(N, [0.3] * 4, rng)).N_hat for _ in range(200)]
    het = [chao_lower_bound(sim_latent(N, [[0.03] * 4, [0.6] * 4], [0.6, 0.4], rng)).N_hat for _ in range(200)]
    assert abs(np.mean(hom) / N - 1) < 0.03
    assert np.mean(het) < N
    assert np.mean(het) < 0.9 * N  # strong heterogeneity: a strict lower bound


# --------------------------------------------------------------------------
# LCMCR (Manrique-Vallier 2016)
# --------------------------------------------------------------------------
def test_lcmcr_single_class_matches_exact_posterior():
    """With J = 1 the posterior of N is available in closed form (Beta(1,1) priors, p(N) ∝ 1/N)."""
    rng = np.random.default_rng(8)
    t = sim_independent(500, [0.2, 0.15, 0.3], rng)
    y, K = table_to_array(t)
    n = int(y.sum())
    nk = histories(K).T @ y
    Ns = np.arange(n, 30 * n)
    lp = -np.log(Ns) + gammaln(Ns + 1) - gammaln(Ns - n + 1) + sum(betaln(nk[k] + 1, Ns - nk[k] + 1) for k in range(K))
    w = np.exp(lp - lp.max())
    cdf = np.cumsum(w / w.sum())
    exact = np.array([Ns[np.searchsorted(cdf, a)] for a in (0.05, 0.5, 0.95)], dtype=float)
    r = gibbs_lcmcr(y, K, J=1, n_iter=25000, burn=1000, thin=1, seed=1)
    gq = np.quantile(r["N"], [0.05, 0.5, 0.95])
    sd = float(np.sqrt(np.sum(w / w.sum() * (Ns - np.sum(w / w.sum() * Ns)) ** 2)))
    np.testing.assert_allclose(gq, exact, atol=0.1 * sd + 1)


@slow
def test_lcmcr_gibbs_steps_geweke():
    """Geweke (2004) joint-distribution test of the allocation, lambda, stick-breaking and alpha steps.

    With N fixed, alternate (y, z) ~ p(y, z | theta) with one sweep of the sampler's
    own update functions; the marginal of theta must then be the prior.  (The n_0
    step is covered by the exact J = 1 test.)  This test caught a real bug: a floor
    on 1 - V_j biased alpha | V when alpha is small.
    """
    from scipy import stats
    from scipy.integrate import quad

    from darkfig.lcmcr import _cell_class_probs, _draw_allocations, _draw_params

    K, J, N, a, b, T = 3, 4, 15, 0.25, 0.25, 40000
    H = histories(K).astype(float)
    rng = np.random.default_rng(0)
    alpha = rng.gamma(a, 1 / b)
    V = np.r_[rng.beta(1, alpha, J - 1), 1.0]
    pi = V * np.r_[1.0, np.cumprod(1 - V[:-1])]
    lam = rng.random((J, K))
    out = np.empty((T, 5))
    for it in range(T):
        q = _cell_class_probs(lam, H)
        C = rng.multinomial(N, (q * pi[None, :]).ravel()).reshape(q.shape)
        C = _draw_allocations(C.sum(axis=1), q, pi, rng)
        lam, pi, alpha = _draw_params(C, alpha, H.T.copy(), a, b, rng)
        out[it] = [lam[0, 0], lam[1, 2] ** 2, pi[0], alpha / (1 + alpha), alpha < 1]
    g = stats.gamma(a, scale=1 / b)
    ref = np.array(
        [0.5, 1 / 3, quad(lambda x: g.pdf(x) / (1 + x), 0, np.inf)[0], quad(lambda x: g.pdf(x) * x / (1 + x), 0, np.inf)[0], g.cdf(1.0)]
    )
    nb = 40
    se = np.array([c.mean(0) for c in np.array_split(out, nb)]).std(0, ddof=1) / np.sqrt(nb)
    z = (out.mean(0) - ref) / se
    assert np.all(np.abs(z) < 4), z


def test_lcmcr_estimate_fields_and_runtime():
    rng = np.random.default_rng(9)
    t = sim_independent(2000, [0.3, 0.25, 0.2, 0.35], rng)
    e = lcmcr(t, seed=3)
    assert e.method == "lcmcr" and e.n_obs == sum(t.values())
    assert e.n_obs <= e.lo <= e.N_hat <= e.hi
    assert e.extra["n_draws"] == 2000
    assert e.extra["seconds"] < 3.0
    assert 1600 < e.N_hat < 2400
    # float counts are rounded
    tf = {h: v + 0.3 for h, v in t.items()}
    assert lcmcr(tf, seed=3, n_iter=600, burn=100).extra["rounded"]


@slow
def test_lcmcr_coverage_independent_capture():
    rng = np.random.default_rng(11)
    N, R = 2000, 20
    cover, est = 0, []
    for r in range(R):
        t = sim_independent(N, [0.3, 0.25, 0.2, 0.35], rng)
        e = lcmcr(t, seed=100 + r)
        cover += e.covers(N)
        est.append(e.N_hat)
    assert cover >= 16
    assert abs(np.mean(est) / N - 1) < 0.05


# --------------------------------------------------------------------------
# linkage-error operator (LE model) and linkage-corrected estimation
# --------------------------------------------------------------------------
@pytest.mark.parametrize("K", [2, 3, 4])
def test_detachment_matrix_invertible_and_recovers_t(K):
    rng = np.random.default_rng(12)
    for delta in (0.0, 0.1, 0.4):
        D = detachment_matrix(K, delta)
        assert D.shape == (2**K - 1, 2**K - 1)
        assert np.allclose(D, np.triu(D))  # upper-triangular in bitmask order
        assert abs(np.linalg.det(D)) > 0
        pc = histories(K).sum(1)[1:]
        np.testing.assert_allclose(D.sum(0), 1 - delta**pc + pc * delta)  # expected clusters per incident
        t = rng.uniform(1, 100, 2**K)
        t[0] = 0
        obs = expected_observed(t, delta, 0.0)
        np.testing.assert_allclose(np.linalg.solve(D, obs[1:]), t[1:], rtol=1e-10)
        # explicit entry: g = e_1 from h = {1,2}: (1-d) d (non-detached 1) + d (detached 1)
        if K >= 2:
            assert D[0, 2] == pytest.approx((1 - delta) * delta + delta)
    # dict in -> dict out
    td = random_table(3, rng)
    assert isinstance(expected_observed(td, 0.1, 0.02), dict)


def test_expected_observed_merge_first_order():
    t = np.zeros(4)
    t[1:] = [100.0, 50.0, 30.0]  # e_1, e_2, {1,2}
    out = expected_observed(t, 0.0, 0.1)
    # list 1: s = 100 singletons; eligible B (1 not in B) = {e_2: 50}, M_1 = 50 -> moves 0.1*100 = 10
    #   e_1 -= 10, e_2 -= 10, {1,2} += 10
    # list 2: s = 50 singletons; eligible B = {e_1: 100}, M_2 = 100 -> moves 0.1*50 = 5
    #   e_2 -= 5, e_1 -= 5, {1,2} += 5
    np.testing.assert_allclose(out, [0, 100 - 10 - 5, 50 - 10 - 5, 30 + 10 + 5])
    assert out.sum() == pytest.approx(t.sum() - 0.1 * (100 + 50))


@slow
@pytest.mark.parametrize("eps", [0.0, 0.02])
def test_simulate_observed_mean_matches_expectation(eps):
    rng = np.random.default_rng(13)
    t = np.rint(expected_table(1500, [[0.5, 0.45, 0.4, 0.55]], [1.0]))
    t[0] = 0
    R = 400
    S = np.array([simulate_observed(t, 0.1, eps, rng) for _ in range(R)])
    m, se = S.mean(0)[1:], S.std(0, ddof=1)[1:] / np.sqrt(R)
    E = expected_observed(t, 0.1, eps)[1:]
    slack = 0.0 if eps == 0 else 0.01 * E  # merge model is first-order in eps
    assert np.all(np.abs(m - E) <= 4.5 * se + slack + 1e-9)
    # dict interface and total count bookkeeping: each merge removes one cluster
    obs = simulate_observed(array_to_table(t, 4), 0.1, eps, rng)
    assert isinstance(obs, dict) and len(obs) == 15


def test_linkage_corrected_inverts_expected_operator():
    t = expected_table(2000, [[0.5, 0.45, 0.4, 0.55], [0.2, 0.3, 0.25, 0.15]], [0.5, 0.5])
    t[0] = 0
    oracle = loglinear_closed_form(array_to_table(t, 4))
    for delta, eps in [(0.1, 0.02), (0.3, 0.05), (0.5, 0.1)]:
        obs = expected_observed(array_to_table(t, 4), delta, eps)
        est = linkage_corrected(obs, delta, eps)
        assert est.extra["converged"]
        that = table_to_array(est.extra["t_hat"])[0]
        np.testing.assert_allclose(that, t, rtol=1e-7, atol=1e-7)
        assert est.N_hat == pytest.approx(oracle.N_hat, rel=1e-6)
        assert est.n_obs == pytest.approx(t.sum(), rel=1e-8)
        assert est.method == "linkage_corrected(loglinear_closed_form)"
    # other estimators plug in, keyword arguments are forwarded
    obs = expected_observed(array_to_table(t, 4), 0.1, 0.02)
    e2 = linkage_corrected(obs, 0.1, 0.02, estimator=loglinear_bma, criterion="aic")
    assert e2.extra["criterion"] == "aic"
    assert e2.N_hat == pytest.approx(loglinear_bma(array_to_table(t, 4), criterion="aic").N_hat, rel=1e-6)
    json.dumps(e2.to_dict())


@slow
def test_linkage_corrected_recovers_oracle_in_expectation():
    rng = np.random.default_rng(14)
    N, R, delta, eps = 2000, 150, 0.1, 0.02
    corr, orac, naive = [], [], []
    for _ in range(R):
        t = sim_independent(N, [0.5, 0.45, 0.4, 0.55], rng)
        obs = simulate_observed(t, delta, eps, rng)
        orac.append(loglinear_closed_form(t).N_hat)
        corr.append(linkage_corrected(obs, delta, eps).N_hat)
        naive.append(loglinear_closed_form(obs).N_hat)
    corr, orac, naive = map(np.asarray, (corr, orac, naive))
    d = corr - orac
    assert abs(d.mean()) <= 3 * d.std(ddof=1) / np.sqrt(R) + 0.01 * N
    assert abs(corr.mean() / orac.mean() - 1) < 0.02
    assert abs(naive.mean() / orac.mean() - 1) > 0.05  # the correction matters


# --------------------------------------------------------------------------
# API contract
# --------------------------------------------------------------------------
def test_all_estimators_accept_float_counts_and_serialise():
    rng = np.random.default_rng(15)
    t = random_table(4, rng, lo=20, hi=150, floats=True)
    for e in (
        lincoln_petersen(t),
        loglinear_closed_form(t),
        loglinear_model(t),
        loglinear_bma(t),
        chao_lower_bound(t),
        lcmcr(t, seed=1, n_iter=600, burn=100, thin=1),
    ):
        assert isinstance(e, Estimate)
        assert np.isfinite(e.N_hat) and e.lo <= e.hi
        assert e.N_hat - e.n_obs == pytest.approx(e.n0_hat)
        json.dumps(e.to_dict())


# --------------------------------------------------------------------------
# run 2: linkage variance (Cor cor:linkcorrect(i)), LE record simulator / audit, LCMCR diagnostics
# --------------------------------------------------------------------------
from darkfig.estimators import lcmcr_pooled, widen_interval  # noqa: E402
from darkfig.lcmcr import convergence_diagnostics  # noqa: E402
from darkfig.linkerror import (observed_covariance, simulate_audit, simulate_records,  # noqa: E402
                               jacobian_expected_observed)


def test_observed_covariance_matches_monte_carlo():
    rng = np.random.default_rng(21)
    t = np.rint(expected_table(1200, [[0.3, 0.35, 0.25, 0.3]], [1.0]))
    t[0] = 0
    for delta, eps in [(0.15, 0.0), (0.15, 0.03)]:
        S = np.array([simulate_observed(t, delta, eps, rng)[1:] for _ in range(1500)])
        C_mc = np.cov(S.T)
        C_an = observed_covariance(t, delta, eps)
        big = np.diag(C_mc) > 20
        np.testing.assert_allclose(np.diag(C_an)[big], np.diag(C_mc)[big], rtol=0.15)
        for _ in range(5):
            w = rng.normal(size=15)
            assert (w @ C_an @ w) / (w @ C_mc @ w) == pytest.approx(1.0, abs=0.15)
    # Jacobian: eps = 0 gives the detachment matrix
    np.testing.assert_allclose(jacobian_expected_observed(t, 0.2, 0.0), detachment_matrix(4, 0.2), atol=1e-12)


def test_v_link_restores_coverage_in_small_le_case():
    """Under the LE model the corrected estimator's inner interval (v_cap only) undercovers;
    adding v_link (delta method) restores nominal coverage."""
    rng = np.random.default_rng(22)
    N, R, delta, eps = 1000, 150, 0.2, 0.02
    cov_link, cov_cap = {"lp": [], "cf": []}, {"lp": [], "cf": []}
    for _ in range(R):
        t = sim_independent(N, [0.35, 0.3, 0.3, 0.4], rng)
        obs = simulate_observed(t, delta, eps, rng)
        for k, fn in (("lp", lincoln_petersen), ("cf", loglinear_closed_form)):
            e = linkage_corrected(obs, delta, eps, estimator=fn)
            cov_link[k].append(e.lo <= N <= e.hi)
            cov_cap[k].append(e.extra["lo_cap"] <= N <= e.extra["hi_cap"])
            assert e.extra["v_link"] > 0 and e.hi - e.lo > e.extra["hi_cap"] - e.extra["lo_cap"]
    for k in cov_link:
        assert np.mean(cov_link[k]) >= 0.89, (k, np.mean(cov_link[k]))
        assert np.mean(cov_link[k]) - np.mean(cov_cap[k]) >= 0.05, (k, np.mean(cov_link[k]), np.mean(cov_cap[k]))


def test_widen_interval_properties():
    lo, hi = widen_interval(150.0, 120.0, 220.0, 100.0, 0.0)
    assert (lo, hi) == (120.0, 220.0)
    lo2, hi2 = widen_interval(150.0, 120.0, 220.0, 100.0, 400.0)
    assert 100.0 < lo2 < 120.0 and hi2 > 220.0
    # on the log(N - a) scale both sides grow by the same quadrature term
    z = 1.959963984540054
    add = np.log1p(400.0 / 50.0 ** 2)
    assert np.log(50.0 / (lo2 - 100.0)) == pytest.approx(z * np.sqrt((np.log(50 / 20) / z) ** 2 + add))
    assert np.log((hi2 - 100.0) / 50.0) == pytest.approx(z * np.sqrt((np.log(120 / 50) / z) ** 2 + add))


def test_simulate_records_and_audit_from_le_ground_truth():
    rng = np.random.default_rng(23)
    t = sim_independent(2000, [0.3, 0.3, 0.25, 0.2], rng)
    sim = simulate_records(t, 0.1, 0.03, np.random.default_rng(5))
    assert np.array_equal(table_to_array(sim["table_out"](t))[0], table_to_array(simulate_observed(t, 0.1, 0.03, np.random.default_rng(5)))[0])
    # a census audit recovers the realised rates exactly
    au = simulate_audit(sim, 10 ** 9, 10 ** 9, rng)
    assert au["delta_hat"] == pytest.approx(au["delta_true"]) and au["eps_hat"] == pytest.approx(au["eps_true"])
    # a random audit is unbiased and its CI covers at roughly the nominal rate
    hits_d, hits_e, d_err = [], [], []
    for _ in range(150):
        a = simulate_audit(sim, 200, 100, rng)
        hits_d.append(abs(a["delta_hat"] - a["delta_true"]) <= 1.96 * a["se_delta"])
        hits_e.append(abs(a["eps_hat"] - a["eps_true"]) <= 1.96 * a["se_eps"])
        d_err.append(a["delta_hat"] - a["delta_true"])
    assert np.mean(hits_d) > 0.85 and np.mean(hits_e) > 0.85
    assert abs(np.mean(d_err)) < 0.01


def test_convergence_diagnostics():
    rng = np.random.default_rng(24)
    x = rng.normal(size=(4, 1000))
    d = convergence_diagnostics(x)
    assert d["rhat"] < 1.01 and d["ess_bulk"] > 2500 and d["ess_tail"] > 1500
    y = x + np.array([0, 0, 0, 1.0])[:, None]
    assert convergence_diagnostics(y)["rhat"] > 1.05
    ar = np.zeros((4, 2000))
    for c in range(4):
        e = rng.normal(size=2000)
        for i in range(1, 2000):
            ar[c, i] = 0.9 * ar[c, i - 1] + e[i]
    dd = convergence_diagnostics(ar)
    assert 150 < dd["ess_bulk"] < 1000     # AR(1), phi = 0.9: ESS ~ 8000 * 0.1 / 1.9 = 421


def test_lcmcr_multichain_and_pooled():
    rng = np.random.default_rng(25)
    t = sim_independent(800, [0.4, 0.35, 0.3, 0.4], rng)
    e = lcmcr(t, n_iter=1200, burn=400, thin=2, seed=3, n_chains=4)
    assert e.extra["n_chains"] == 4 and len(e.extra["chain_medians"]) == 4
    assert np.isfinite(e.extra["rhat"]) and e.extra["rhat"] < 1.1 and e.extra["n_draws"] == 4 * 400
    p = lcmcr_pooled([t, t], seed=4, n_iter=1200, burn=400, thin=2)
    assert p.extra["n_tables"] == 2 and p.extra["n_draws"] == 800 and p.lo < p.N_hat < p.hi
