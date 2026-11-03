"""Tests for the SIM-CORE Hawkes library (code/hawkes).

Run from ``papers/contagion/code``::

    OPENBLAS_NUM_THREADS=1 nice python -m pytest tests/test_hawkes.py -q               # everything
    OPENBLAS_NUM_THREADS=1 nice python -m pytest tests/test_hawkes.py -q -m "not slow" # quick subset

Monte Carlo checks compare against exact formulas with tolerances of about
4 Monte Carlo standard errors, using fixed seeds. The ``slow`` marker is not
registered in a pytest config, so pytest may warn about an unknown mark.
"""

from __future__ import annotations

import os
import sys

import numpy as np
import pytest
from scipy import stats

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from hawkes.alert import (  # noqa: E402
    alert_rule_intensity,
    excitation_state,
    exceedance_probability,
    optimal_alert_threshold,
    predictive_count_dist,
    predictive_mean,
)
from hawkes.attribution import decompose_surge, expected_counts, impulse_response, spillover  # noqa: E402
from hawkes.em import decluster, fit_em  # noqa: E402
from hawkes.inar import bin_counts, fit_inar, inar_to_hawkes  # noqa: E402
from hawkes.likelihood import DecaySums, compensator, intensity, loglik  # noqa: E402
from hawkes.model import (  # noqa: E402
    BSplineBasis,
    FunctionBackground,
    HawkesSpec,
    LogLinearBackground,
    PiecewiseConstant,
    multiplier,
    spectral_radius,
    stationary_mean,
)
from hawkes.rescaling import rescaled_intervals, time_rescale_ks  # noqa: E402
from hawkes.simulate import cluster_info, simulate, simulate_shot_noise_cox  # noqa: E402
from hawkes.tests_alpha import CHIBAR_CRIT_05, chibar_pvalue, lrt_alpha_zero, lrt_alpha_zero_sup  # noqa: E402
from hawkes.thinning import (  # noqa: E402
    apparent_beta,
    apparent_branching,
    apparent_mu,
    correct_thinning,
    hawkes_count_variance,
    inverse_apparent_branching,
    shot_noise_equivalent_hawkes,
    spurious_branching,
    thin,
    thinned_count_variance,
)

A3 = np.array([[0.30, 0.10, 0.00], [0.20, 0.25, 0.10], [0.00, 0.15, 0.30]])
MU3 = np.array([0.30, 0.20, 0.25])


def spec3(beta=1.5):
    return HawkesSpec(M=3, mu=MU3, alpha=A3, beta=beta)


def brute_loglik(spec, events, T):
    """O(n^2) reference implementation of the log-likelihood."""
    M = spec.M
    Bm = spec.beta_matrix
    eta = spec.shock_rate_vec
    ll = 0.0
    for k in range(M):
        for t in events[k]:
            lam = spec.mu_at(np.array([t]))[0, k]
            for tau, S in spec.shocks:
                if t > tau:
                    lam += spec.shock_beta[k] * S * eta[k] * np.exp(-eta[k] * (t - tau))
            for j in range(M):
                s = events[j][events[j] < t]
                lam += np.sum(spec.alpha[k, j] * Bm[k, j] * np.exp(-Bm[k, j] * (t - s)))
            ll += np.log(lam)
        comp = spec.mu_cumulative(np.array([T]))[0, k]
        for tau, S in spec.shocks:
            F = lambda x: 1 - np.exp(-eta[k] * max(x, 0.0))  # noqa: E731
            comp += spec.shock_beta[k] * S * (F(T - tau) - F(-tau))
        for j in range(M):
            comp += spec.alpha[k, j] * np.sum(1 - np.exp(-Bm[k, j] * (T - events[j])))
        ll -= comp
    return ll


# ---------------------------------------------------------------------------
# model helpers
# ---------------------------------------------------------------------------


def test_model_helpers():
    s = spec3()
    assert s.spectral_radius() == pytest.approx(np.max(np.abs(np.linalg.eigvals(A3))))
    Mm = multiplier(A3)
    assert np.allclose(Mm @ (np.eye(3) - A3), np.eye(3))
    assert np.allclose(stationary_mean(s), np.linalg.solve(np.eye(3) - A3, MU3))
    s2 = HawkesSpec(M=2, mu=[1, 1], alpha=np.zeros((2, 2)), shock_kernel_rate=0.7)
    assert s2.shock_rate == pytest.approx(0.7)
    with pytest.raises(ValueError):
        multiplier(np.array([[1.2]]))
    with pytest.raises(ValueError):
        HawkesSpec(M=2, mu=[1, -1], alpha=np.zeros((2, 2)))
    pc = PiecewiseConstant([0, 10, 20], [[1.0, 2.0], [3.0, 0.5]])
    assert np.allclose(pc.cumulative(np.array([5.0, 15.0, 25.0])), [[5, 10], [10 + 15, 20 + 2.5], [10 + 45, 20 + 7.5]])
    bs = BSplineBasis(100.0, 8)
    assert np.allclose(bs(np.linspace(0, 100, 11)).sum(axis=1), 1.0)
    llb = LogLinearBackground(np.log([[2.0] * 8]), bs)
    assert np.allclose(llb.cumulative(np.array([37.0, 100.0]))[:, 0], [74.0, 200.0])
    fb = FunctionBackground(lambda t: np.array([1.0 + np.sin(t)]), 1)
    assert fb.cumulative(np.array([np.pi]))[0, 0] == pytest.approx(np.pi + 2.0, rel=1e-10)


# ---------------------------------------------------------------------------
# simulation
# ---------------------------------------------------------------------------


def test_simulated_mean_matches_stationary_mean():
    rng = np.random.default_rng(101)
    T, R = 1000.0, 200
    s = spec3()
    counts = np.array([[len(e) for e in simulate(s, T, rng)] for _ in range(R)])
    m, se = counts.mean(axis=0), counts.std(axis=0, ddof=1) / np.sqrt(R)
    exact = expected_counts(s, 0.0, T)["total"]  # includes the start-up transient
    stat = stationary_mean(s) * T
    assert np.all(np.abs(m - exact) < 4 * se)
    assert np.allclose(exact, stat, rtol=0.01)  # the transient is < 1% at this T
    assert np.all(np.abs(m - stat) < 4 * se + 0.01 * stat)


def test_simulation_with_shocks_and_piecewise_background():
    rng = np.random.default_rng(102)
    pc = PiecewiseConstant([0, 30, 60, 100], [[0.2, 0.1], [0.5, 0.05], [0.1, 0.3]])
    s = HawkesSpec(
        M=2,
        mu=pc,
        alpha=np.array([[0.3, 0.1], [0.2, 0.3]]),
        beta=np.array([[2.0, 1.0], [0.5, 1.5]]),
        shocks=[(30.0, 4.0), (-5.0, 2.0)],
        shock_beta=[1.0, 0.5],
        shock_rate=[0.3, 0.8],
    )
    R = 2000
    c = np.array([[np.sum((e > 20) & (e <= 70)) for e in simulate(s, 100.0, rng)] for _ in range(R)])
    exact = expected_counts(s, 20.0, 70.0)["total"]
    assert np.all(np.abs(c.mean(0) - exact) < 4 * c.std(0, ddof=1) / np.sqrt(R))


def test_ogata_matches_cluster_callable_background():
    rng = np.random.default_rng(103)
    mu_fn = lambda t: np.column_stack([0.3 * (1 + 0.5 * np.sin(2 * np.pi * t / 20)), 0.2 + 0.0 * t])  # noqa: E731
    s = HawkesSpec(
        M=2,
        mu=FunctionBackground(mu_fn, 2, vectorized=True),
        alpha=np.array([[0.3, 0.1], [0.2, 0.3]]),
        beta=np.array([[2.0, 1.0], [0.5, 1.5]]),
        shocks=[(15.0, 3.0)],
        shock_beta=[1.0, 0.5],
        shock_rate=0.4,
    )
    T, R = 50.0, 300
    exact = expected_counts(s, 0.0, T)["total"]
    for method in ("cluster", "ogata"):
        c = np.array([[len(e) for e in simulate(s, T, rng, method=method)] for _ in range(R)])
        assert np.all(np.abs(c.mean(0) - exact) < 4 * c.std(0, ddof=1) / np.sqrt(R)), method


def test_branching_labels_consistent():
    rng = np.random.default_rng(104)
    s = HawkesSpec(M=2, mu=[0.3, 0.2], alpha=np.array([[0.3, 0.2], [0.25, 0.3]]), beta=1.0,
                   shocks=[(20.0, 5.0)], shock_beta=[1.0, 1.0], shock_rate=0.5)
    for method in ("cluster", "ogata"):
        ev, lab = simulate(s, 200.0, rng, return_branching=True, method=method)
        ci = cluster_info(ev, lab)
        par = ci["parent"]
        kids = par >= 0
        assert np.all(par[kids] < np.flatnonzero(kids))  # parents precede children
        assert np.all(ci["times"][par[kids]] < ci["times"][kids])
        assert set(np.unique(par[~kids])) <= {-1, -2}
        assert np.all(ci["generation"][~kids] == 0)
        assert np.all(ci["generation"][kids] == ci["generation"][par[kids]] + 1)
        assert np.all(ci["root"] < 0)


def test_em_declustering_matches_labels():
    rng = np.random.default_rng(105)
    s = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=np.array([[0.4, 0.1], [0.3, 0.3]]), beta=2.0)
    T = 2000.0
    ev, lab = simulate(s, T, rng, return_branching=True)
    P = decluster(s, ev, T)
    for k in range(2):
        is_bg = lab[k] == -1
        n_bg = is_bg.sum()
        assert abs(P[k][:, 0].sum() - n_bg) < 4 * np.sqrt(len(ev[k]) * 0.25)
        assert P[k][is_bg, 0].mean() > P[k][~is_bg, 0].mean() + 0.1
        assert np.allclose(P[k].sum(axis=1), 1.0)


# ---------------------------------------------------------------------------
# likelihood
# ---------------------------------------------------------------------------


def test_loglik_matches_bruteforce():
    rng = np.random.default_rng(106)
    s = HawkesSpec(
        M=3,
        mu=MU3,
        alpha=A3,
        beta=np.array([[1.5, 2.0, 1.0], [1.0, 1.5, 3.0], [2.0, 1.0, 0.7]]),
        shocks=[(50.0, 2.0), (-3.0, 1.0), (120.0, 5.0)],
        shock_beta=[1.0, 0.5, 2.0],
        shock_rate=[0.5, 1.0, 2.0],
    )
    T = 200.0
    ev = simulate(s, T, rng)
    assert loglik(s, ev, T) == pytest.approx(brute_loglik(s, ev, T), rel=1e-11, abs=1e-8)
    # per-stream terms add up
    assert loglik(s, ev, T, per_stream=True).sum() == pytest.approx(loglik(s, ev, T), rel=1e-13)
    # a spline background and a piecewise background
    bs = BSplineBasis(T, 6)
    th = np.log(np.array([[0.2, 0.4, 0.3, 0.2, 0.5, 0.3], [0.1, 0.1, 0.3, 0.2, 0.2, 0.2], [0.3] * 6]))
    for mu in (LogLinearBackground(th, bs), PiecewiseConstant([0, 70, 200], [[0.2, 0.3, 0.1], [0.4, 0.1, 0.2]])):
        s2 = s.copy(mu=mu)
        ev2 = simulate(s2, T, rng)
        assert loglik(s2, ev2, T) == pytest.approx(brute_loglik(s2, ev2, T), rel=1e-10)
    # intensity and compensator at arbitrary times
    tt = np.sort(rng.uniform(0, T, 25))
    lam = intensity(s, ev, tt)
    for i, t in enumerate(tt):
        for k in range(3):
            ref = s.mu[k] + sum(
                s.alpha[k, j] * s.beta[k, j] * np.sum(np.exp(-s.beta[k, j] * (t - ev[j][ev[j] < t]))) for j in range(3)
            )
            ref += sum(s.shock_beta[k] * S * s.shock_rate[k] * np.exp(-s.shock_rate[k] * (t - tau)) for tau, S in s.shocks if t > tau)
            assert lam[i, k] == pytest.approx(ref, rel=1e-11)
    grid = np.linspace(0, tt[3], 200001)
    num = np.trapezoid(intensity(s, ev, grid), grid, axis=0)
    assert np.allclose(compensator(s, ev, np.array([tt[3]]))[0], num, rtol=2e-3)


def test_decay_sums_exact_for_large_rates():
    rng = np.random.default_rng(107)
    src = np.sort(rng.uniform(0, 5000, 3000))
    tgt = np.sort(rng.uniform(0, 5000, 1500))
    for b in (0.003, 0.7, 25.0):
        S, D = DecaySums(src, b, lag=True)(tgt)
        for i in range(0, tgt.size, 37):
            d = tgt[i] - src[src < tgt[i]]
            Sb = np.sum(np.exp(-b * d))
            Db = np.sum(d * np.exp(-b * d))
            # absolute time rounding (b * T * eps) limits any implementation
            tol = 1e-12 + 50 * b * 5000 * np.finfo(float).eps
            assert abs(S[i] - Sb) <= tol * Sb + 1e-300
            assert abs(D[i] - Db) <= tol * Db + 1e-300


# ---------------------------------------------------------------------------
# EM
# ---------------------------------------------------------------------------


def test_em_recovers_parameters_const_background():
    rng = np.random.default_rng(108)
    s = spec3(beta=1.5)
    T = 1500.0
    ev = simulate(s, T, rng)
    assert 2000 <= sum(map(len, ev)) <= 5000
    fit = fit_em(ev, T, compute_se=True, tol=1e-8)
    tr = fit.loglik_trace
    assert np.all(np.diff(tr) >= -1e-8 * np.abs(tr[1:]))
    assert fit.converged
    assert fit.loglik == pytest.approx(loglik(fit.spec, ev, T), rel=1e-12)
    assert fit.loglik >= loglik(s, ev, T)
    assert np.all(np.abs(fit.spec.mu - MU3) < 0.3 * MU3)
    assert np.max(np.abs(fit.spec.alpha - A3)) < 0.1
    assert abs(fit.spec.beta - 1.5) < 0.35 * 1.5
    # z-scores against the observed-information standard errors (entries with
    # alpha_kj = 0 are on the boundary and have no SE)
    assert fit.se_flag == "ok" or "boundary" in fit.se_flag
    assert np.all(np.abs((fit.spec.mu - MU3) / fit.se["mu"]) < 4)
    z_a = (fit.spec.alpha - A3) / fit.se["alpha"]
    assert np.all(np.abs(z_a[np.isfinite(z_a)]) < 4)
    assert abs((fit.spec.beta - 1.5) / fit.se["beta"][0, 0]) < 4


@pytest.mark.slow
def test_em_recovers_parameters_matrix_beta():
    rng = np.random.default_rng(109)
    B = np.array([[1.0, 3.0], [0.5, 2.0]])
    A = np.array([[0.35, 0.25], [0.3, 0.3]])
    s = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=A, beta=B)
    T = 3000.0
    ev = simulate(s, T, rng)
    assert 2000 <= sum(map(len, ev)) <= 6000
    fit = fit_em(ev, T, beta_structure="matrix", tol=1e-9, max_iter=3000)
    assert np.all(np.diff(fit.loglik_trace) >= -1e-8 * np.abs(fit.loglik_trace[1:]))
    assert np.max(np.abs(fit.spec.alpha - A)) < 0.08
    assert np.all(np.abs(np.log(fit.spec.beta_matrix / B)) < np.log(1.6))
    assert np.all(np.abs(fit.spec.mu - s.mu) < 0.25 * s.mu)


def test_em_with_shocks():
    rng = np.random.default_rng(110)
    shocks = [(float(t), float(S)) for t, S in zip(np.linspace(100, 1900, 10), rng.uniform(5, 15, 10))]
    s = HawkesSpec(M=2, mu=[0.3, 0.2], alpha=np.array([[0.3, 0.1], [0.2, 0.3]]), beta=1.5,
                   shocks=shocks, shock_beta=[1.0, 0.5], shock_rate=0.3)
    T = 2000.0
    ev = simulate(s, T, rng)
    fit = fit_em(ev, T, shocks=shocks, tol=1e-8)
    assert np.all(np.diff(fit.loglik_trace) >= -1e-8 * np.abs(fit.loglik_trace[1:]))
    assert np.max(np.abs(fit.spec.alpha - s.alpha)) < 0.08
    assert np.all(np.abs(fit.spec.shock_beta - s.shock_beta) < 0.35 * s.shock_beta)
    assert abs(np.log(fit.spec.shock_rate / 0.3)) < np.log(1.5)
    assert fit.loglik == pytest.approx(loglik(fit.spec, ev, T), rel=1e-12)


def test_em_spline_background():
    rng = np.random.default_rng(111)
    T = 3000.0
    mu_fn = lambda t: np.column_stack([0.3 * (1 + 0.5 * np.sin(3 * np.pi * t / T)), 0.2 * np.exp(-t / T) + 0.05])  # noqa: E731
    A = np.array([[0.3, 0.1], [0.2, 0.3]])
    s = HawkesSpec(M=2, mu=FunctionBackground(mu_fn, 2, vectorized=True), alpha=A, beta=2.0)
    ev = simulate(s, T, rng)
    fit = fit_em(ev, T, background="spline", n_basis=8, tol=1e-8)
    assert np.all(np.diff(fit.loglik_trace) >= -1e-8 * np.abs(fit.loglik_trace[1:]))
    assert fit.loglik == pytest.approx(loglik(fit.spec, ev, T), rel=1e-10)
    assert np.max(np.abs(fit.spec.alpha - A)) < 0.1
    grid = np.linspace(0, T, 301)
    est, true = fit.spec.mu_at(grid), mu_fn(grid)
    assert np.corrcoef(est[:, 0], true[:, 0])[0, 1] > 0.85
    assert np.mean(np.abs(est - true) / true) < 0.25
    # misspecified constant background: fits worse, inflates the branching ratio
    fit_c = fit_em(ev, T, tol=1e-8)
    assert fit.loglik > fit_c.loglik + 10
    assert spectral_radius(fit_c.spec.alpha) > spectral_radius(fit.spec.alpha)


# ---------------------------------------------------------------------------
# LRT for alpha_kj = 0
# ---------------------------------------------------------------------------


def test_chibar_pvalue():
    assert chibar_pvalue(0.0) == 1.0
    assert chibar_pvalue(CHIBAR_CRIT_05) == pytest.approx(0.05)
    assert chibar_pvalue(3.84) == pytest.approx(0.5 * stats.chi2.sf(3.84, 1))


@pytest.mark.slow
def test_lrt_size_and_power():
    rng = np.random.default_rng(112)
    A0 = np.array([[0.3, 0.0], [0.3, 0.3]])  # H0: alpha[0, 1] = 0 is true
    s0 = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=A0, beta=1.5)
    T = 600.0
    R = 40
    p = np.empty(R)
    stat = np.empty(R)
    for r in range(R):
        ev = simulate(s0, T, rng)
        stat[r], p[r] = lrt_alpha_zero(ev, T, 0, 1)
    size = np.mean(p < 0.05)
    assert size <= 0.15  # nominal 0.05; binomial sd with R = 40 is 0.034
    # chi-bar-square: about half of the statistics are (numerically) zero
    assert 0.25 <= np.mean(stat < 1e-3) <= 0.75
    # power
    s1 = s0.copy(alpha=np.array([[0.3, 0.2], [0.3, 0.3]]))
    p1 = [lrt_alpha_zero(simulate(s1, T, rng), T, 0, 1)[1] for _ in range(12)]
    assert np.mean(np.asarray(p1) < 0.05) >= 0.75


@pytest.mark.slow
def test_lrt_fixed_beta_and_sup_bootstrap():
    rng = np.random.default_rng(113)
    s1 = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=np.array([[0.3, 0.25], [0.2, 0.3]]), beta=1.5)
    T = 500.0
    ev = simulate(s1, T, rng)
    stat, p, fa, f0 = lrt_alpha_zero(ev, T, 0, 1, beta_mode="fixed", return_fits=True)
    assert f0.spec.alpha[0, 1] == 0.0 and stat > CHIBAR_CRIT_05
    res = lrt_alpha_zero_sup(ev, T, 0, 1, beta_grid=[0.5, 1.5, 4.5], n_boot=9, rng=rng)
    assert res["stat"] >= stat - 1.0
    assert res["pvalue"] == pytest.approx(0.1)  # (1 + 0) / (1 + 9): every bootstrap LR is smaller
    assert res["boot_stats"].max() < res["stat"]


# ---------------------------------------------------------------------------
# time rescaling
# ---------------------------------------------------------------------------


def test_time_rescaling_uniform_pvalues():
    rng = np.random.default_rng(114)
    s = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=np.array([[0.4, 0.1], [0.3, 0.3]]), beta=1.0,
                   shocks=[(100.0, 10.0)], shock_beta=[1.0, 2.0], shock_rate=0.2)
    T = 400.0
    ps = []
    for _ in range(60):
        ev = simulate(s, T, rng)
        ps.append(time_rescale_ks(s, ev, T)[1])
    ps = np.concatenate(ps)
    assert stats.kstest(ps, "uniform").pvalue > 0.01
    assert 0.35 < ps.mean() < 0.65
    # power: a Poisson model with the right mean rate is rejected on long data
    ev = simulate(s, 3000.0, rng)
    wrong = HawkesSpec(M=2, mu=[len(e) / 3000.0 for e in ev], alpha=np.zeros((2, 2)), beta=1.0)
    assert np.all(time_rescale_ks(wrong, ev, 3000.0)[1] < 1e-3)
    taus = rescaled_intervals(s, ev, 3000.0)
    assert abs(np.mean(np.concatenate(taus)) - 1.0) < 0.05


# ---------------------------------------------------------------------------
# attribution
# ---------------------------------------------------------------------------


def _has_ancestor_in(ci, j=None, entry=None):
    """For each event: does a proper ancestor lie in stream j (or does the
    path contain a j -> k transmission for entry = (k, j))?"""
    par, dims = ci["parent"], ci["dims"]
    out = np.zeros(par.size, bool)
    for i in range(par.size):
        q = par[i]
        if q < 0:
            continue
        if entry is None:
            hit = dims[q] == j
        else:
            hit = dims[q] == entry[1] and dims[i] == entry[0]
        out[i] = hit or out[q]
    return out


def test_decompose_surge_matches_monte_carlo():
    rng = np.random.default_rng(115)
    s = HawkesSpec(M=2, mu=[0.2, 0.1], alpha=np.array([[0.3, 0.2], [0.25, 0.4]]),
                   beta=np.array([[1.0, 0.5], [2.0, 1.5]]), shocks=[(10.0, 3.0), (14.0, 2.0)],
                   shock_beta=[2.0, 1.0], shock_rate=[0.7, 1.3])
    H, T = 8.0, 18.0
    dec = decompose_surge(s, 0, H, spillover_through=(0, 1))
    sp_col = spillover(s, 0, H, 1)
    by = dec["by_stream"]
    R = 3000
    acc = np.zeros((R, 6, 2))
    for r in range(R):
        ev, lab = simulate(s, T, rng, return_branching=True)
        ci = cluster_info(ev, lab)
        w = (ci["times"] > 10.0) & (ci["times"] <= 10.0 + H)
        rooted = w & (ci["root"] == -2)
        thr_entry = _has_ancestor_in(ci, entry=(0, 1))
        thr_col = _has_ancestor_in(ci, j=1)
        for k in range(2):
            m = ci["dims"] == k
            acc[r, 0, k] = np.sum(w & m & (ci["root"] == -1))
            acc[r, 1, k] = np.sum(w & m & (ci["root"] == -3))
            acc[r, 2, k] = np.sum(rooted & m & (ci["generation"] == 0))
            acc[r, 3, k] = np.sum(rooted & m & (ci["generation"] > 0))
            acc[r, 4, k] = np.sum(rooted & m & thr_entry)
            acc[r, 5, k] = np.sum(rooted & m & thr_col)
    mc, se = acc.mean(0), acc.std(0, ddof=1) / np.sqrt(R)
    exact = np.vstack([by["background"], by["other_shocks"], by["direct"], by["contagion"],
                       dec["spillover"]["horizon"], sp_col["horizon"]])
    assert np.all(np.abs(mc - exact) < 4 * se + 1e-12)
    # identities
    assert dec["total"] == pytest.approx(sum(dec[k] for k in ("background", "other_shocks", "direct", "contagion")))
    assert np.allclose(by["direct"], s.shock_beta * 3.0 * (1 - np.exp(-s.shock_rate * H)))
    inf = dec["infinite"]
    assert np.allclose(inf["total"], multiplier(s.alpha) @ (s.shock_beta * 3.0))
    long = decompose_surge(s, 0, 400.0)
    assert np.allclose(long["by_stream"]["contagion"], inf["contagion"], rtol=1e-8)
    assert np.allclose(spillover(s, 0, 400.0, 1)["horizon"], spillover(s, 0, H, 1)["infinite"], rtol=1e-8)
    st = decompose_surge(s.copy(shocks=[(1000.0, 3.0)]), 0, H, background="stationary")
    pr = decompose_surge(s.copy(shocks=[(1000.0, 3.0)]), 0, H, background="process")
    assert np.allclose(st["by_stream"]["background"], pr["by_stream"]["background"], rtol=1e-8)


def test_impulse_response_integrals():
    s = HawkesSpec(M=2, mu=[0.2, 0.1], alpha=np.array([[0.3, 0.2], [0.25, 0.4]]),
                   beta=np.array([[1.0, 0.5], [2.0, 1.5]]), shocks=[(0.0, 2.0)], shock_beta=[1.0, 0.5], shock_rate=0.8)
    u = np.linspace(0, 120, 24001)
    for j in range(2):
        R = impulse_response(s, u, source=j)
        assert np.allclose(np.trapezoid(R, u, axis=0), (multiplier(s.alpha) - np.eye(2))[:, j], rtol=1e-5)
    m = impulse_response(s, u, shock_index=0)
    assert np.allclose(np.trapezoid(m, u, axis=0), multiplier(s.alpha) @ (s.shock_beta * 2.0), rtol=1e-5)


# ---------------------------------------------------------------------------
# thinning and second-order formulas
# ---------------------------------------------------------------------------


def test_apparent_branching_formulas():
    n = np.linspace(0.0, 0.95, 20)
    assert np.allclose(apparent_branching(n, 1.0), n)
    assert np.all(apparent_branching(n, 1e-10) < 1e-4)
    p = np.linspace(0.05, 1, 20)
    na = apparent_branching(0.7, p)
    assert np.all(np.diff(na) > 0) and np.all(na <= 0.7 + 1e-12)
    for nn in (0.1, 0.5, 0.9):
        for pp in (0.1, 0.4, 1.0):
            assert inverse_apparent_branching(apparent_branching(nn, pp), pp) == pytest.approx(nn, abs=1e-12)
    # covariance decay rate preserved
    assert apparent_beta(0.6, 2.0, 0.3) * (1 - apparent_branching(0.6, 0.3)) == pytest.approx(2.0 * 0.4)
    nn, bb, mm = correct_thinning(apparent_branching(0.6, 0.3), apparent_beta(0.6, 2.0, 0.3), apparent_mu(1.0, 0.6, 0.3), 0.3)
    assert (nn, bb, mm) == pytest.approx((0.6, 2.0, 1.0))
    assert spurious_branching(0.0) == 0.0
    assert spurious_branching(3.0) == pytest.approx(0.5)


def test_thinned_variance_time_matches_formula():
    rng = np.random.default_rng(116)
    n, beta, mu, p = 0.6, 1.0, 1.0, 0.5
    rate = mu / (1 - n)
    s = HawkesSpec(M=1, mu=[mu], alpha=[[n]], beta=beta)
    T, R, burn = 20000.0, 12, 100.0
    ws = (1.0, 5.0, 20.0)
    v = np.zeros((R, len(ws)))
    for r in range(R):
        ev = thin(simulate(s, T, rng)[0], p, rng)
        for i, w in enumerate(ws):
            v[r, i] = np.histogram(ev, bins=np.arange(burn, T + 1e-9, w))[0].var()
    m, se = v.mean(0), v.std(0, ddof=1) / np.sqrt(R)
    na, ba = apparent_branching(n, p), apparent_beta(n, beta, p)
    for i, w in enumerate(ws):
        f_thin = thinned_count_variance(w, n, beta, rate, p)
        f_app = hawkes_count_variance(w, na, ba, p * rate)
        assert f_app == pytest.approx(f_thin, rel=1e-12)
        assert abs(m[i] - f_app) < 4 * se[i]
        # the unattenuated branching ratio would be clearly wrong
        assert abs(m[i] - hawkes_count_variance(w, n, beta, p * rate)) > 8 * se[i]


def test_shot_noise_cox_second_order_equivalence():
    rng = np.random.default_rng(117)
    nu, rho, a, gamma = 0.5, 0.2, 1.0, 0.5
    eq = shot_noise_equivalent_hawkes(nu, rho, a, gamma)
    assert eq["beta"] * (1 - eq["n"]) == pytest.approx(gamma)
    T, R, w = 20000.0, 10, 10.0
    v, r_ = [], []
    for _ in range(R):
        ev = simulate_shot_noise_cox(nu, rho, a, gamma, T, rng)[0]
        r_.append(len(ev) / T)
        v.append(np.histogram(ev, bins=np.arange(0, T + 1e-9, w))[0].var())
    assert abs(np.mean(r_) - eq["rate"]) < 4 * np.std(r_, ddof=1) / np.sqrt(R)
    target = hawkes_count_variance(w, eq["n"], eq["beta"], eq["rate"])
    assert abs(np.mean(v) - target) < 4 * np.std(v, ddof=1) / np.sqrt(R)


# ---------------------------------------------------------------------------
# INAR
# ---------------------------------------------------------------------------


def test_inar_mapping_fine_bins():
    rng = np.random.default_rng(118)
    A = np.array([[0.4, 0.2], [0.1, 0.3]])
    mu = np.array([0.5, 0.4])
    s = HawkesSpec(M=2, mu=mu, alpha=A, beta=1.0)
    T, delta, p = 6000.0, 0.1, 60
    ev = simulate(s, T, rng)
    X = bin_counts(ev, T, delta)
    assert X.shape == (60000, 2) and X.sum() == sum(int(np.sum(e < 60000 * delta)) for e in ev)
    for method in ("cls", "nnls"):
        h = inar_to_hawkes(fit_inar(X, p, method=method), delta)
        assert np.max(np.abs(h["A"] - A)) < 0.07, method
        assert np.all(np.abs(h["mu"] - mu) < 0.2 * mu), method
    # exact geometric weights give back beta exactly
    Th = np.array([[[0.5 * 0.8**l]] for l in range(1, 400)])
    from hawkes.inar import INARFit

    out = inar_to_hawkes(INARFit(nu=np.array([0.1]), Theta=Th, method="x", n_obs=1, resid_var=np.zeros(1)), 0.25)
    assert out["beta"][0, 0] == pytest.approx(-np.log(0.8) / 0.25, rel=1e-10)


# ---------------------------------------------------------------------------
# forecasting / alerting
# ---------------------------------------------------------------------------


def test_alert_threshold_and_predictive_distribution():
    assert optimal_alert_threshold(1.0, 3.0) == pytest.approx(0.25)
    assert optimal_alert_threshold(2.0, 2.0) == pytest.approx(0.5)
    rng = np.random.default_rng(119)
    s = HawkesSpec(M=2, mu=[0.4, 0.3], alpha=np.array([[0.4, 0.2], [0.3, 0.3]]), beta=np.array([[1.0, 2.0], [0.5, 1.0]]),
                   shocks=[(45.0, 5.0)], shock_beta=[1.0, 0.5], shock_rate=0.4)
    hist = simulate(s, 50.0, rng)
    c = predictive_count_dist(s, hist, 50.0, 6.0, 20000, rng)
    exact = predictive_mean(s, hist, 50.0, 6.0)
    assert np.all(np.abs(c.mean(0) - exact) < 4 * c.std(0, ddof=1) / np.sqrt(len(c)))
    # the excitation state reproduces the current intensity lambda(t+)
    lam_t = intensity(s, hist, np.array([50.0 + 1e-12]))[0]
    E = excitation_state(s, hist, 50.0)
    shock_now = s.shock_beta * 5.0 * 0.4 * np.exp(-0.4 * 5.0)
    assert np.allclose(lam_t, s.mu + E.sum(axis=1) + shock_now, rtol=1e-9)
    assert 0.0 <= exceedance_probability(c, 10) <= 1.0


def test_alert_rule_intensity_univariate():
    rng = np.random.default_rng(120)
    s = HawkesSpec(M=1, mu=[0.5], alpha=[[0.6]], beta=1.0)
    out = alert_rule_intensity(s, Delta=5.0, c=10, c_fa=1.0, c_miss=3.0, n_sim=4000, rng=rng)
    assert out["pi_star"] == pytest.approx(0.25)
    assert np.all(np.diff(out["prob"]) >= 0)
    assert out["lambda_star"] == pytest.approx(0.5 + out["s_star"])
    assert out["s_star"] > 0
    # at the threshold state the predictive exceedance probability is pi*:
    # a single event at time 0 leaves E = alpha * beta * exp(-beta * 0) = 0.6,
    # so place one event at the time t0 where 0.6 exp(-t0) = s_star
    t0 = np.log(0.6 / out["s_star"]) if out["s_star"] < 0.6 else None
    if t0 is not None and t0 > 0:
        cnt = predictive_count_dist(s, [np.array([0.0])], t0, 5.0, 40000, rng)
    else:
        from hawkes.alert import _future_counts

        cnt = _future_counts(s, np.array([[out["s_star"]]]), 0.0, 5.0, 40000, rng)
    assert abs(np.mean(cnt[:, 0] >= 10) - 0.25) < 0.03
