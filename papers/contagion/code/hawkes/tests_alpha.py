"""Likelihood-ratio tests of H0: alpha_kj = 0 (no excitation of stream k by
stream j). For k != j this is Granger non-causality from j to k (Eichler,
Dahlhaus & Dueck 2017; Prop prop:granger).

Boundary LRT (Prop prop:lrt; Self & Liang 1987)
------------------------------------------------
alpha_kj >= 0, so under H0 the true value lies on the boundary of the
parameter space. When the other parameters are interior and identified under
H0, the LR statistic ``2 (l_1 - l_0)`` is asymptotically the chi-bar-square
mixture ``0.5 chi2_0 + 0.5 chi2_1``. Its p-value is ``0.5 P(chi2_1 >= stat)``
for stat > 0, and 1 for stat = 0. The 5% critical value is 2.706, not 3.841.

:func:`lrt_alpha_zero` makes the decay rate identified under H0 in one of two
ways:

* ``beta_mode="common"`` (the default): a single beta is shared by the whole
  kernel matrix and re-estimated under both hypotheses. Under H0 it is
  identified through the remaining alpha entries, so the Self-Liang conditions
  hold (they need at least one other free alpha_ab > 0).
* ``beta_mode="fixed"``: beta (any structure) is fixed at its value under
  the alternative, in both fits. This is a pragmatic device for the
  pairwise-beta model. Fixing beta at a data-dependent value ignores the
  Davies problem, so the test can be slightly liberal.

Davies problem (``lrt_alpha_zero_sup``)
---------------------------------------
If the (k, j) kernel has its own decay rate beta_kj, then beta_kj is not
identified under H0, and the chi-bar-square limit fails (Davies 1977, 1987).
:func:`lrt_alpha_zero_sup` computes the sup-LR over a grid of beta_kj. Every
other entry shares a common free beta. The p-value is a parametric bootstrap:
simulate from the H0 fit, refit both models and recompute the sup-LR. The
bootstrap p-value is ``(1 + #{LR* >= LR}) / (1 + n_boot)``.
"""

from __future__ import annotations

import numpy as np
from scipy import stats

from .em import FitResult, fit_em
from .model import as_rng
from .simulate import simulate

__all__ = ["chibar_pvalue", "lrt_alpha_zero", "lrt_alpha_zero_sup", "CHIBAR_CRIT_05"]

#: 5% critical value of 0.5 chi2_0 + 0.5 chi2_1
CHIBAR_CRIT_05 = float(stats.chi2.ppf(0.90, 1))


def chibar_pvalue(stat: float, df: int = 1) -> float:
    """p-value of the 0.5 chi2_0 + 0.5 chi2_df mixture."""
    if not np.isfinite(stat):
        return 0.0 if stat > 0 else 1.0
    if stat <= 0:
        return 1.0
    return float(0.5 * stats.chi2.sf(stat, df))


def _null_init(spec, k, j):
    s = spec.copy()
    s.alpha = s.alpha.copy()
    s.alpha[k, j] = 0.0
    return s


def lrt_alpha_zero(
    events,
    T: float,
    k: int,
    j: int,
    *,
    shocks=None,
    background: str = "const",
    n_basis: int = 8,
    beta_mode: str = "common",
    fit_alt: FitResult | None = None,
    tol: float = 1e-9,
    max_iter: int = 2000,
    return_fits: bool = False,
    multistart_null: bool = True,
    **fit_kwargs,
):
    """LR test of H0: alpha[k, j] = 0 with the chi-bar-square null.

    Parameters
    ----------
    events, T : data.
    k, j : target and source stream.
    shocks, background, n_basis : passed to :func:`hawkes.em.fit_em`.
    beta_mode : "common" (shared beta re-estimated under each hypothesis) or
        "fixed" (beta fixed at the alternative's estimate in both fits; with
        ``beta_structure="matrix"`` in fit_kwargs this is the pairwise model).
    fit_alt : an existing unrestricted fit to reuse.
    multistart_null : besides starting the null fit from the alternative
        optimum (with alpha_kj = 0), also run the default profile-grid
        multistart and keep the better null optimum ("common" mode).

    Returns
    -------
    (stat, pvalue), or (stat, pvalue, fit_alt, fit_null) if ``return_fits``.
    """
    M = len(events)
    common = dict(shocks=shocks, background=background, n_basis=n_basis, tol=tol, max_iter=max_iter)
    if beta_mode == "common":
        fit_kwargs = {**fit_kwargs, "beta_structure": "scalar"}
    elif beta_mode != "fixed":
        raise ValueError("beta_mode must be 'common' or 'fixed'")
    if fit_alt is None:
        fit_alt = fit_em(events, T, M, **common, **fit_kwargs)
    mask = np.ones((M, M), bool)
    if "alpha_mask" in fit_kwargs:
        mask &= np.asarray(fit_kwargs["alpha_mask"], bool)
    mask[k, j] = False
    kw0 = {kk: v for kk, v in fit_kwargs.items() if kk not in ("alpha_mask", "beta_fixed", "init")}
    if beta_mode == "fixed":
        kw0["beta_fixed"] = fit_alt.spec.beta_matrix
    fit_null = fit_em(events, T, M, **common, alpha_mask=mask, init=_null_init(fit_alt.spec, k, j), **kw0)
    if multistart_null and beta_mode == "common":
        # a null fit stuck in a local mode would inflate the statistic: also
        # run the profile-grid multistart and keep the better optimum
        fn2 = fit_em(events, T, M, **common, alpha_mask=mask, **kw0)
        if fn2.loglik > fit_null.loglik:
            fit_null = fn2
    if fit_null.loglik > fit_alt.loglik + 1e-9:
        # the alternative nests the null: restart it from the null optimum
        kwa = {kk: v for kk, v in fit_kwargs.items() if kk != "init"}
        if beta_mode == "fixed":
            kwa["beta_fixed"] = fit_alt.spec.beta_matrix
        refit = fit_em(events, T, M, **common, init=fit_null.spec, **kwa)
        if refit.loglik > fit_alt.loglik:
            fit_alt = refit
    stat = max(0.0, 2.0 * (fit_alt.loglik - fit_null.loglik))
    p = chibar_pvalue(stat)
    if return_fits:
        return stat, p, fit_alt, fit_null
    return stat, p


def _sup_lr(events, T, k, j, beta_grid, common, fit_kwargs, init_null=None):
    M = len(events)
    mask = np.ones((M, M), bool)
    mask[k, j] = False
    if init_null is None:
        fit_null = fit_em(events, T, M, alpha_mask=mask, **common, **fit_kwargs)
    else:
        fit_null = fit_em(events, T, M, alpha_mask=mask, init=init_null, **common, **fit_kwargs)
    lrs, fits = [], []
    for b in beta_grid:
        bf = np.full((M, M), np.nan)
        bf[k, j] = b
        init = fit_null.spec.copy()
        init.alpha = init.alpha.copy()
        init.alpha[k, j] = 0.05
        Bm = init.beta_matrix
        Bm[k, j] = b
        init.beta = Bm
        fa = fit_em(events, T, M, beta_fixed=bf, init=init, **common, **fit_kwargs)
        lrs.append(max(0.0, 2.0 * (fa.loglik - fit_null.loglik)))
        fits.append(fa)
    return np.asarray(lrs), fit_null, fits


def lrt_alpha_zero_sup(
    events,
    T: float,
    k: int,
    j: int,
    beta_grid=None,
    n_boot: int = 99,
    rng=None,
    *,
    shocks=None,
    background: str = "const",
    n_basis: int = 8,
    tol: float = 1e-8,
    max_iter: int = 2000,
    **fit_kwargs,
) -> dict:
    """Davies-aware test of H0: alpha[k, j] = 0 when the (k, j) kernel has its
    own decay rate beta_kj (unidentified under H0).

    Statistic: ``sup_{b in beta_grid} 2 (l_1(b) - l_0)``. The p-value is a
    parametric bootstrap from the H0 fit, with ``n_boot`` replicates and refits
    of both models.

    Returns dict(stat, pvalue (bootstrap), pvalue_naive (chi-bar-square at the
    argmax, liberal), beta_hat, lr_profile, boot_stats, fit_null, fit_alt).
    """
    rng = as_rng(rng)
    M = len(events)
    n_tot = sum(len(e) for e in events)
    if beta_grid is None:
        r = n_tot / T
        beta_grid = np.geomspace(0.2 * r, 20.0 * r, 5)
    beta_grid = np.asarray(beta_grid, float)
    common = dict(shocks=shocks, background=background, n_basis=n_basis, tol=tol, max_iter=max_iter)
    lrs, fit_null, fits = _sup_lr(events, T, k, j, beta_grid, common, fit_kwargs)
    g = int(np.argmax(lrs))
    stat = float(lrs[g])
    boot = np.empty(n_boot)
    for b in range(n_boot):
        sim = simulate(fit_null.spec, T, rng)
        lb, _, _ = _sup_lr(sim, T, k, j, beta_grid, common, fit_kwargs, init_null=fit_null.spec)
        boot[b] = lb.max()
    p_boot = float((1 + np.sum(boot >= stat - 1e-10)) / (1 + n_boot))
    return {
        "stat": stat,
        "pvalue": p_boot,
        "pvalue_naive": chibar_pvalue(stat),
        "beta_hat": float(beta_grid[g]),
        "beta_grid": beta_grid,
        "lr_profile": lrs,
        "boot_stats": boot,
        "fit_null": fit_null,
        "fit_alt": fits[g],
    }
