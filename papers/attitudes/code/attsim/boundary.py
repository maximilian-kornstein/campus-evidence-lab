"""Boundary estimands: item-level ECV, the boundary set B_tau, and the S-I correlation.

`estimate_boundary` fits the single-group bifactor model and the correlated-factors model
by DWLS on polychorics, and gives for every item
  * ECV_j-hat, its sandwich (delta-method) SE and a Wald interval on the logit scale,
  * a nonparametric bootstrap percentile interval (respondents resampled; polychorics
    and both models refitted in every replicate, warm-started at the full-sample
    estimate, with the DWLS weights held at their full-sample values, which leaves the
    first-order distribution of the estimator unchanged),
  * the three-way classification of the pre-registered plan (sec:design-estimands):
    "in" if the lower 95% limit >= tau, "out" if the upper limit < tau, else "indeterminate";
and the correlated-factors correlation phi_SI with a sandwich interval.
"""
from __future__ import annotations

import numpy as np
from scipy.special import expit, logit

from .fit import BifactorMG, GroupStats, fit_corrfactors, group_stats
from .polychoric import polychoric

Z975 = 1.959963984540054


def classify(lo, hi, tau):
    """+1 = in B_tau, -1 = out, 0 = indeterminate."""
    return np.where(lo >= tau, 1, np.where(hi < tau, -1, 0))


def random_start(spec, rng):
    """Slopes from standardised loadings lam_G ~ U(0.2, 0.8), lam_s ~ U(0.1, 0.6)."""
    J = len(spec)
    lg, ls = rng.uniform(0.2, 0.8, J), rng.uniform(0.1, 0.6, J)
    s = np.sqrt(np.maximum(1 - lg ** 2 - ls ** 2, 0.05))
    return np.c_[lg / s, ls / s].ravel()


def estimate_boundary(Y, spec, K, tau=0.5, B=200, rng=None, x0=None, n_starts=5, start_tol=1e-6):
    """See module docstring.  The bifactor model is fitted from the default start and from
    n_starts - 1 random starts; the best objective is kept, and `ecv_start_range` is the range
    of ECV_j over all starts whose objective is within a relative `start_tol` of the best
    (a positive range at the optimum signals a flat ridge, i.e. non-identification)."""
    Y = np.asarray(Y)
    spec = np.asarray(spec, int)
    rng = np.random.default_rng(rng)
    n = Y.shape[0]
    st = group_stats(Y, K, corr_only=True)
    m = BifactorMG(spec, K - 1, fit_thresholds=False)
    fits = [m.fit([st], x0=x0)]
    srng = np.random.default_rng(rng.integers(2 ** 63))
    for _ in range(n_starts - 1):
        fits.append(m.fit([st], x0=random_start(spec, srng)))
    costs = np.array([ff.opt.cost for ff in fits])
    best = float(costs.min())
    f = fits[int(np.argmin(costs))]
    near = [ff for ff in fits if ff.opt.cost <= best * (1 + start_tol) + 1e-10]
    E_st = np.array([ff.ecv() for ff in near])
    ecv = f.ecv()
    V = f.cov()
    se = f.ecv_se(V=V)
    # logit-scale Wald interval
    e = np.clip(ecv, 1e-6, 1 - 1e-6)
    se_l = se / (e * (1 - e))
    w_lo, w_hi = expit(logit(e) - Z975 * se_l), expit(logit(e) + Z975 * se_l)
    w = 1.0 / np.maximum(np.diag(st.Gamma), 1e-12)
    cf = fit_corrfactors(st.rho, m.pairs, spec, w, Gamma=st.Gamma)
    out = dict(ecv=ecv, ecv_se=se, wald_lo=w_lo, wald_hi=w_hi, phi=cf.phi, phi_se=cf.se_phi,
               lamG=f.lam()[0], lamS=f.lam()[1], ident=f.ident_diag(), converged=f.converged,
               heywood=bool(np.any(np.abs(f.theta) >= 0.999 * 12.0)), cost=float(f.opt.cost),
               ecv_start_range=E_st.max(axis=0) - E_st.min(axis=0), n_near_opt=len(near),
               ecv_start_min=E_st.min(axis=0), ecv_start_max=E_st.max(axis=0))
    if B > 0:
        ecv_b = np.full((B, len(spec)), np.nan)
        for bb in range(B):
            idx = rng.integers(0, n, n)
            Yb = Y[idx]
            pc = polychoric(Yb, K, pairs=m.pairs, rho0=st.rho, max_iter=30, tol=1e-7)
            stb = GroupStats(pc.tau, pc.rho, st.Gamma, n, True)
            fb = m.fit([stb], x0=f.theta, weights=w, max_nfev=60)
            ecv_b[bb] = fb.ecv()
        out["boot_lo"] = np.nanpercentile(ecv_b, 2.5, axis=0)
        out["boot_hi"] = np.nanpercentile(ecv_b, 97.5, axis=0)
        out["boot_sd"] = np.nanstd(ecv_b, axis=0, ddof=1)
        out["B"] = B
    return out
