"""Tests for the attsim package (run from code/: nice python -m pytest tests -q)."""
from __future__ import annotations

import os
import sys

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import numpy as np
import pytest
from scipy.stats import multivariate_normal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from attsim import generate as gen                                     # noqa: E402
from attsim import fit as F                                            # noqa: E402
from attsim import dif as D                                            # noqa: E402
from attsim import listexp as L                                       # noqa: E402
from attsim import mrp as M                                            # noqa: E402
from attsim import index as IX                                         # noqa: E402
from attsim.bvn import bvn_cdf, bvn_dh                                 # noqa: E402
from attsim.polychoric import polychoric, acov                         # noqa: E402
from attsim.boundary import estimate_boundary, classify                # noqa: E402
from attsim.designs import x1_bank                                     # noqa: E402


def small_bank(J_S=6, ecv_I=(0.25, 0.75, 0.4, 0.6)):
    ecvS = np.array([0.85, 0.45, 0.75, 0.55, 0.9, 0.5])[:J_S]
    lgS, lsS = gen.loadings_from_ecv(ecvS, 0.55)
    lgI, lsI = gen.loadings_from_ecv(np.array(ecv_I), 0.5)
    spec = np.r_[np.ones(J_S, int), 2 * np.ones(len(ecv_I), int)]
    J = len(spec)
    return gen.bank_from_standardised(np.r_[lgS, lgI], np.r_[lsS, lsI], spec,
                                      gen.base_thresholds(J, np.linspace(-0.3, 0.3, J)))


# ---------------------------------------------------------------- bivariate normal
def test_bvn_cdf_matches_scipy():
    rng = np.random.default_rng(0)
    for _ in range(300):
        h, k = rng.normal(size=2) * 1.5
        r = rng.uniform(-0.97, 0.97)
        if rng.random() < 0.15:
            h = 0.0
        ref = multivariate_normal(mean=[0, 0], cov=[[1, r], [r, 1]]).cdf([h, k])
        assert abs(float(bvn_cdf(h, k, r)) - ref) < 1e-7


def test_bvn_derivative():
    h, k, r, e = 0.3, -0.7, 0.45, 1e-6
    num = (bvn_cdf(h + e, k, r) - bvn_cdf(h - e, k, r)) / (2 * e)
    assert abs(float(bvn_dh(h, k, r)) - float(num)) < 1e-7


# ---------------------------------------------------------------- generator
def test_generator_deterministic():
    bank = small_bank()
    a = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [500], 123)
    b = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [500], 123)
    c = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [500], 124)
    assert all(np.array_equal(x, y) for x, y in zip(a, b))
    assert not np.array_equal(a[0], c[0])


def test_generator_margins_and_dif():
    bank = small_bank()
    Y, g, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [100_000], 1)
    tau, _ = gen.true_polychoric(bank)
    emp = np.array([[np.mean(Y[:, j] < c) for c in range(1, 5)] for j in range(bank.J)])
    from scipy.special import ndtr
    assert np.max(np.abs(emp - ndtr(tau))) < 0.01
    b1 = gen.with_dif(bank, uniform={6: -0.5}, nonuniform={7: (0.5, 1.0)})
    assert np.allclose(b1.b[6], bank.b[6] - 0.5) and np.isclose(b1.aG[7], 0.5 * bank.aG[7])
    lamG, lamS = gen.std_loadings(bank)
    assert np.allclose(bank.ecv(), lamG ** 2 / (lamG ** 2 + lamS ** 2))


def test_logit_link_runs():
    bank = small_bank()
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [2000], 5, link="logit")
    assert Y.min() >= 0 and Y.max() <= 4


# ---------------------------------------------------------------- polychoric
def test_polychoric_recovers_latent_correlation():
    bank = small_bank()
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [40_000], 7)
    pc = polychoric(Y, 5)
    tau, rho = gen.true_polychoric(bank)
    assert pc.converged
    assert np.max(np.abs(pc.rho - rho)) < 0.03
    assert np.max(np.abs(pc.tau - tau)) < 0.03


def test_polychoric_bivariate_normal_cut():
    """Polychoric of a discretised bivariate normal equals its correlation."""
    rng = np.random.default_rng(3)
    for r in (-0.6, 0.0, 0.8):
        X = rng.multivariate_normal([0, 0], [[1, r], [r, 1]], size=50_000)
        Y = np.stack([np.digitize(X[:, 0], [-1, 0, 0.7, 1.5]), np.digitize(X[:, 1], [-0.5, 0.2, 1.0, 2.0])], 1)
        pc = polychoric(Y, 5)
        assert abs(pc.rho[0] - r) < 0.015


@pytest.mark.slow
def test_polychoric_sandwich_se_matches_monte_carlo():
    bank = small_bank()
    ests, ses = [], []
    for s in range(150):
        Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [800], 1000 + s)
        pc = polychoric(Y, 5)
        G = acov(Y, pc)
        ests.append(np.r_[pc.tau.ravel(), pc.rho])
        ses.append(np.sqrt(np.diag(G)))
    sd_mc = np.std(ests, axis=0, ddof=1)
    ratio = np.mean(ses, axis=0) / sd_mc
    assert 0.85 < np.median(ratio) < 1.15
    assert np.all((ratio > 0.7) & (ratio < 1.35))


# ---------------------------------------------------------------- estimation
def test_jacobian_matches_finite_differences():
    bank = small_bank()
    free = np.zeros(bank.J, bool)
    free[[6, 7]] = True
    m = F.BifactorMG(bank.spec, 4, n_groups=2, free=free)
    rng = np.random.default_rng(1)
    th = rng.normal(size=m.npar) * 0.3 + 0.5
    _, Jac = m.implied(th)
    h = 1e-6
    for i in range(m.npar):
        e = np.zeros(m.npar)
        e[i] = h
        num = (m.implied(th + e)[0] - m.implied(th - e)[0]) / (2 * h)
        assert np.max(np.abs(num - Jac[:, i])) < 1e-6


def test_population_fit_is_exact():
    """Fitting the exact population statistics returns the true ECV (identified design)."""
    bank = x1_bank(6)
    tau, rho = gen.true_polychoric(bank)
    st = F.GroupStats(tau, rho, np.eye(len(rho)), 10 ** 9, True)
    f = F.BifactorMG(bank.spec, 4, fit_thresholds=False).fit([st])
    assert np.max(np.abs(f.ecv() - bank.ecv())) < 1e-6


def test_large_n_recovery_single_group():
    bank = x1_bank(6)
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [60_000], 11)
    r = estimate_boundary(Y, bank.spec, 5, B=0)
    lamG, lamS = gen.std_loadings(bank)
    assert np.max(np.abs(r["lamG"] - lamG)) < 0.06
    assert np.max(np.abs(r["ecv"] - bank.ecv())) < 0.08
    # sandwich SEs of ECV are of the right size: |error| / SE not extreme
    assert np.max(np.abs(r["ecv"] - bank.ecv()) / r["ecv_se"]) < 4.0
    assert r["ident"] > 1e-3


def test_two_item_factor_is_rank_deficient():
    bank = x1_bank(2)
    tau, rho = gen.true_polychoric(bank)
    st = F.GroupStats(tau, rho, np.eye(len(rho)), 10 ** 9, True)
    f = F.BifactorMG(bank.spec, 4, fit_thresholds=False).fit([st])
    assert f.ident_diag() < 1e-6
    # the identified set of each I item's ECV contains its true value and straddles 0.5
    lamG, lamS = gen.std_loadings(bank)
    i1, i2 = np.flatnonzero(bank.spec == 2)
    (lo1, hi1), (lo2, hi2) = F.ecv_identified_set_two_items(lamG[i1], lamG[i2], lamS[i1] * lamS[i2])
    e = bank.ecv()
    assert lo1 <= e[i1] <= hi1 and lo2 <= e[i2] <= hi2
    assert lo1 < 0.5 < hi1 and lo2 < 0.5 < hi2


def test_multigroup_recovery_with_anchors():
    bank = small_bank()
    b1 = gen.with_dif(bank, uniform={6: -0.6}, nonuniform={7: (0.5, 1.0)})
    mu1 = np.array([0.3, 0.0, 0.2])
    Y, g, _ = gen.simulate([bank, b1], [np.zeros(3), mu1], [np.eye(3), np.eye(3)], [30_000, 30_000], 21)
    st = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
    free = np.ones(bank.J, bool)
    free[[0, 1, 2, 8, 9]] = False                   # correct anchors
    f = D.fit_mg(st, bank.spec, 4, free)
    est, se = D.latent_contrast(f, 0)
    assert abs(est - 0.3) < 4 * se
    est_i, se_i = D.latent_contrast(f, 2)
    assert abs(est_i - 0.2) < 4 * se_i
    tests = D.wald_tests(f, [6, 7, 3])
    assert tests[0][2] < 1e-4 and tests[1][2] < 1e-4


def test_bh():
    rej = D.bh(np.array([0.001, 0.02, 0.04, 0.5]), 0.05)
    assert rej.tolist() == [True, True, False, False]


def test_classify():
    assert classify(np.array([0.6, 0.2, 0.4]), np.array([0.8, 0.45, 0.7]), 0.5).tolist() == [1, -1, 0]


# ---------------------------------------------------------------- list experiment
def test_list_split_estimator_unbiased_and_covers():
    des = L.ListDesign(J=4, rho=-0.6, pi=0.3, pi_d_shift=0.2)
    r = L.neyman_split(des.v_d(), des.sigma_c2(), des.sigma_t2())
    est, cover = [], 0
    for s in range(1500):
        d = L.simulate(des, 1500, r, s)
        e, pl, pd = L.split_sdb(d["arm"], d["y"], d["d"])
        est.append([pl, e.est])
        cover += e.lo <= des.sdb <= e.hi
    est = np.array(est)
    mcse = est.std(axis=0, ddof=1) / np.sqrt(len(est))
    assert abs(est[:, 0].mean() - des.pi) < 3.5 * mcse[0]
    assert abs(est[:, 1].mean() - des.sdb) < 3.5 * mcse[1]
    # exact variance (eq:le-split) matches the Monte Carlo variance
    assert abs(est[:, 1].std(ddof=1) / np.sqrt(L.split_var(des, r, 1500)) - 1) < 0.08
    assert 0.93 < cover / 1500 < 0.97


def test_paired_estimators_and_monotonicity_failure():
    des = L.ListDesign(J=4, rho=-0.6, pi=0.3, pi_d_shift=0.2, phi_rate=0.03 / 0.7)
    r = L.paired_alloc(des)
    ps, cb = [], []
    for s in range(800):
        d = L.simulate(des, 3000, r, 10_000 + s, paired=True)
        ps.append(L.paired_ps(d["arm"], d["y"], d["d"]).est)
        cb.append(L.paired_combined(d["arm"], d["y"], d["d"]).est)
    ps, cb = np.array(ps), np.array(cb)
    m_ps, m_cb = ps.std(ddof=1) / np.sqrt(len(ps)), cb.std(ddof=1) / np.sqrt(len(cb))
    assert abs(ps.mean() - des.sdb) < 3.5 * m_ps                 # PS consistent without monotonicity
    assert abs(cb.mean() - des.eta) < 3.5 * m_cb                 # combined estimator targets eta = SDB + phi
    assert cb.mean() - des.sdb > 0.02


def test_control_list_moments():
    for J, rho in ((4, -0.6), (5, 0.0), (2, 0.3)):
        des = L.ListDesign(J=J, rho=rho)
        W = L.controls(des, 400_000, np.random.default_rng(J)).sum(axis=1)
        assert abs(W.var() - des.sigma_c2()) < 0.01
        assert abs(np.mean(W == 0) - des.p_w0()) < 0.003 and abs(np.mean(W == J) - des.p_w0()) < 0.003


def test_floor_ceiling_bias_formula():
    des = L.ListDesign(J=2, rho=0.0, kc=0.5, kf=0.5)
    r = L.neyman_split(des.v_d(), des.sigma_c2(), des.sigma_t2())
    d = L.simulate(des, 600_000, r, 3)
    e, _, _ = L.split_sdb(d["arm"], d["y"], d["d"])
    assert abs((e.est - des.sdb) - des.fc_bias()) < 4 * e.se


def test_allocations_are_optimal():
    des = L.ListDesign(J=4, rho=0.0)
    r = L.neyman_split(des.v_d(), des.sigma_c2(), des.sigma_t2())
    rng = np.random.default_rng(0)
    v0 = L.split_var(des, r, 1000)
    assert v0 < L.split_var(des, [1 / 3] * 3, 1000)
    for _ in range(50):
        q = np.abs(r + rng.normal(scale=0.02, size=3))
        assert v0 <= L.split_var(des, q / q.sum(), 1000) + 1e-15
    # paired design, equal costs: no direct-only arm and rT / rC = sqrt(bT / bC) minimises V_eta
    rp = L.paired_alloc(des)
    assert rp[0] == 0.0
    grid = np.linspace(0.3, 0.7, 401)
    v = [L.paired_avar(des, (0.0, 1 - t, t))[1] for t in grid]
    assert abs(grid[int(np.argmin(v))] - rp[2]) < 0.002


# ---------------------------------------------------------------- MRP and index
def test_mixed_model_recovers_components():
    rng = np.random.default_rng(4)
    A, n = 60, 6000
    area = rng.integers(0, A, n)
    X = np.column_stack([np.ones(n), rng.normal(size=n)])
    u = 0.3 * rng.normal(size=A)
    y = X @ np.array([0.5, 0.2]) + u[area] + rng.normal(size=n)
    m = M.fit_mixed(X, y, area, A)
    assert abs(m["s2"] - 1) < 0.06 and abs(np.sqrt(m["su2"]) - 0.3) < 0.08
    assert np.corrcoef(m["u"], u)[0, 1] > 0.8


def test_mrp_poststratification_identity():
    pop = M.make_population(1, A=20)
    assert np.allclose(pop.area_mean, (pop.N * pop.mu).sum(1) / pop.N.sum(1))
    area, dcell, y, th = M.draw_sample(pop, 4000, 2, s_m=0.4)
    est, se, _ = M.mrp_estimate(pop, area, dcell, y)
    assert np.sqrt(np.mean((est - pop.area_mean) ** 2)) < 0.12


def test_index_invariance_monotone_and_quadrature():
    bank = x1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    aG, aS, b = bank.aG[S], bank.aS[S], bank.b[S, IX.C_AGREE - 1]
    vals = [IX.index_k(IX.population_count_dist(aG, aS, b, (m, 0.0)), 4) for m in (-0.2, 0.0, 0.2)]
    assert vals[0] < vals[1] < vals[2]
    dist = IX.population_count_dist(aG, aS, b)
    assert abs(dist.sum() - 1) < 1e-10
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [200_000], 9)
    assert abs(IX.sample_index(Y[:, S], 4) - IX.index_k(dist, 4)) < 0.005


def test_two_step_eap_mrp_is_exact_affine_shrinkage():
    """prop:eap: MRP on EAP scores = m0 + rho (MRP on unbiased scores - m0), exactly (affine equivariance)."""
    pop = M.make_population(5, A=30)
    area, dcell, y, _ = M.draw_sample(pop, 3000, 6, s_m=0.4)
    est, _, _ = M.mrp_estimate(pop, area, dcell, y)
    yt, rho = M.eap_scores(y, 0.4)
    est_e, _, _ = M.mrp_estimate(pop, area, dcell, yt)
    m0 = y.mean()
    assert 0 < rho < 1
    assert np.max(np.abs(est_e - (m0 + rho * (est - m0)))) < 1e-5


def _popstats(banks, mus):
    out = []
    for bk, mu in zip(banks, mus):
        tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
        out.append(F.GroupStats(tau, rho, np.eye(tau.size + rho.size), 10 ** 9, False))
    return out


def test_stereotype_anchors_identify_mu_G_under_israel_dif():
    from attsim import designs as DS
    b0, b1 = DS.x2_banks(0.4)
    free = np.ones(b0.J, bool)
    free[[0, 1, 2, 3]] = False
    f = D.fit_mg_s_anchored(_popstats([b0, b1], [np.zeros(3), DS.X2_MU1]), b0.spec, 4, free)
    assert abs(f.params(1)["mu"][0] - DS.X2_MU1[0]) < 1e-5
    assert np.max(np.abs(f.ecv_std(1) - b1.ecv())) < 1e-5


def test_dif_proportional_to_loadings_is_a_mean_shift():
    """thm:dif-bias(d)(i): uniform DIF -a_j'v on every item is read as latent mean mu + v."""
    from attsim import designs as DS
    b0, _ = DS.x2_banks(0.0)
    v = np.array([0.2, -0.1, 0.1])
    bd = b0.copy()
    bd.b = bd.b - (b0.A() @ v)[:, None]
    f = D.fit_mg(_popstats([b0, bd], [np.zeros(3), DS.X2_MU1]), b0.spec, 4, np.zeros(b0.J, bool))
    assert np.max(np.abs(f.params(1)["mu"] - (DS.X2_MU1 + v))) < 1e-5


# ---------------------------------------------------------------- X6-X9 generators and estimators
def test_general_generator_reproduces_bank_generator():
    """simulate_general with A = bank.A() consumes the same random numbers as simulate."""
    from attsim import designs as DS
    b = DS.x1_bank(6)
    Y1, _, t1 = gen.simulate([b], [np.zeros(3)], [np.eye(3)], [400], np.random.default_rng(7))
    Y2, t2 = gen.simulate_general(b.A(), b.b, np.zeros(3), np.eye(3), 400, np.random.default_rng(7))
    assert np.array_equal(Y1, Y2) and np.array_equal(t1, t2)
    tau, rho = gen.true_polychoric(b)
    tau2, rho2 = gen.true_polychoric_general(b.A(), b.b)
    assert np.allclose(tau, tau2) and np.allclose(rho, rho2)


def test_cross_loading_generator():
    """X6(a): IT items load on S with the stated standardised loading; their own-domain ECV and the
    standardised thresholds are those of the base bank; the IT x S polychorics rise by c * lam_S."""
    from attsim import designs as DS
    c = 0.3
    A, b, spec, ecv = DS.x6_crossload(c)
    A0, b0, _, ecv0 = DS.x6_crossload(0.0)
    sd = np.sqrt(1 + np.sum(A ** 2, axis=1))
    IT = DS.REG_IDX_IT
    assert np.allclose((A[:, 1] / sd)[IT], c) and np.allclose(np.delete(A[:, 1], np.r_[DS.REG_IDX_S, IT]), 0)
    own = A[np.arange(24), spec]
    assert np.allclose(A[:, 0] ** 2 / (A[:, 0] ** 2 + own ** 2), DS.reg_bank().ecv())
    assert np.allclose(ecv, ecv0)
    tau, rho = gen.true_polychoric_general(A, b)
    tau0, rho0 = gen.true_polychoric_general(A0, b0)
    assert np.allclose(tau, tau0)
    from attsim.polychoric import all_pairs
    pr = all_pairs(24)
    lamS = (A0[:, 1] / np.sqrt(1 + np.sum(A0 ** 2, axis=1)))
    for q, (j, k) in enumerate(pr):
        if j in DS.REG_IDX_S and k in IT:
            assert np.isclose(rho[q] - rho0[q], c * lamS[j])
    # empirical polychorics from the generator match the population values
    Y, _ = gen.simulate_general(A, b, np.zeros(3), np.eye(3), 40_000, np.random.default_rng(3))
    pc = polychoric(Y, 5)
    assert np.max(np.abs(pc.rho - rho)) < 0.04


def test_acquiescence_generator_keying():
    """X6(b): method slopes are +alpha / -alpha by keying (4 reversed items registered, half of each block
    balanced); content ECVs unchanged; reverse-keyed pairs get negative method covariance."""
    from attsim import designs as DS
    for keying, nrev in (("registered", 4), ("balanced", 12)):
        A, b, spec, ecv, k = DS.x6_acquiescence(0.4, keying)
        assert A.shape == (24, 4) and int(np.sum(k < 0)) == nrev
        assert np.allclose(A[:, 3], 0.4 * k)
        assert np.allclose(ecv, DS.reg_bank().ecv())
        if keying == "balanced":
            for blk in (DS.REG_IDX_S, DS.REG_IDX_ID, DS.REG_IDX_IT):
                assert np.sum(k[blk] < 0) == len(blk) // 2
        else:
            assert np.all(k[DS.REG_IDX_IT] > 0)
    A, b, spec, ecv, k = DS.x6_acquiescence(0.4, "registered")
    Y, _ = gen.simulate_general(A, b, np.zeros(4), np.eye(4), 40_000, np.random.default_rng(4))
    tau, rho = gen.true_polychoric_general(A, b)
    pc = polychoric(Y, 5)
    assert np.max(np.abs(pc.rho - rho)) < 0.04
    Ah, *_ = DS.x6_acquiescence(0.4, "registered", hetero=True)
    assert np.allclose(np.abs(Ah[:, 3]), 0.4 * DS.X6_HETERO_PATTERN)


def test_pattern_model_jacobian_and_exact_population_fits():
    from attsim import designs as DS
    from attsim import genfit as GF
    A, b, spec, ecv, k = DS.x6_acquiescence(0.4, "balanced")
    m = GF.PatternModel.bifactor(spec, cross={int(j): 1 for j in DS.REG_IDX_IT}, method_keys=k)
    th = m.random_start(np.random.default_rng(1))
    _, Dm = m.implied(th)
    eps = 1e-6
    for p in (0, 5, 30, m.npar - 1):
        t1, t2 = th.copy(), th.copy()
        t1[p] += eps
        t2[p] -= eps
        assert np.max(np.abs(Dm[:, p] - (m.implied(t1)[0] - m.implied(t2)[0]) / (2 * eps))) < 1e-7
    _, rho = gen.true_polychoric_general(A, b)
    f = GF.fit_multistart(GF.PatternModel.bifactor(spec, method_keys=k), rho, np.ones(len(rho)), np.random.default_rng(2), 3)
    assert f.opt.cost < 1e-12 and np.max(np.abs(f.ecv() - ecv)) < 1e-5 and np.isclose(f.param("m"), 0.4, atol=1e-5)
    A, b, spec, ecv = DS.x6_crossload(0.3)
    _, rho = gen.true_polychoric_general(A, b)
    f = GF.fit_multistart(GF.PatternModel.bifactor(spec, cross={int(j): 1 for j in DS.REG_IDX_IT}), rho,
                          np.ones(len(rho)), np.random.default_rng(2), 3)
    assert f.opt.cost < 1e-12 and np.max(np.abs(f.ecv() - ecv)) < 1e-5
    # the pattern model reproduces BifactorMG on a plain bifactor model
    bank = DS.reg_bank()
    tau, rho = gen.true_polychoric(bank)
    fb = F.BifactorMG(bank.spec, 4, fit_thresholds=False).fit([F.GroupStats(tau, rho, None, 10 ** 9, True)],
                                                                weights=np.ones(len(rho)))
    fg = GF.PatternModel.bifactor(bank.spec).fit(rho, np.ones(len(rho)))
    assert np.max(np.abs(fb.ecv() - fg.ecv())) < 1e-8


def test_tetrad_tests_null_and_alternative():
    """The joint tetrad statistic vanishes at a proportional (one-factor) population and is large under
    heterogeneity; the basis has |D|(|D|-3)/2 tetrads; the Bonferroni count matches 3,633."""
    from attsim import designs as DS
    from attsim import tetrad as TT
    from attsim.polychoric import all_pairs
    assert TT.n_tetrads([10, 14]) == 3633
    for cfg, null in (("prop", True), ("one_off", True), ("het", False), ("two_off", False)):
        bank = DS.x9_bank(cfg)
        _, rho = gen.true_polychoric(bank)
        J = 24
        pairs = all_pairs(J)
        R = TT.corr_matrix(rho, pairs, J)
        S = np.arange(10)
        Rs = R[np.ix_(S, S)]
        sp = all_pairs(10)
        Gam = np.eye(len(sp)) / 1e6                    # a large-sample covariance
        stat, df, p = TT.proportionality_test(Rs, Gam, TT.pair_index(sp, 10), np.arange(10))
        assert df == 35
        assert (stat < 1e-20) if null else (p < 1e-6)
        st2, df2, p2 = TT.onefactor_residual_test(Rs[sp[:, 0], sp[:, 1]], Gam, sp, 10)
        assert df2 == 35 and ((st2 < 1e-8) if null else (p2 < 1e-6))


def test_list_experiment_identifies_delta():
    """prop:list-irt(b): with population-size samples the root of eq:le-irt-root recovers delta_x."""
    from attsim import designs as DS
    from attsim import listirt as LI
    bank = DS.x1_bank(6)
    mus = (np.zeros(3), np.array([0.5, 0.0, 0.3]))
    tr = LI.truth(bank, 11, 3, mus, (0.4, 0.8))
    dat = LI.simulate(bank, 11, 3, mus, (60_000, 60_000), (0.4, 0.8), np.random.default_rng(5))
    r = LI.estimate(dat, bank.spec, 11, 3)
    for x in (0, 1):
        assert abs(r[f"delta_{x}"] - tr[x]["delta"]) < 4 * r[f"delta_se_{x}"]
        assert r[f"delta_se_{x}"] < 0.08
    assert abs(r["z_common"]) > 3
