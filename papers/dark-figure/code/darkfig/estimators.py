"""Population-size (dark-figure) estimators for the simulation study (``sec:simulation``).

Public API (SPEC, "Estimator API"):

=========================  ==============================================  ===========================
function                   estimator                                       paper result
=========================  ==============================================  ===========================
``lincoln_petersen``       two-list Chapman / Lincoln-Petersen             (classical; ``eq`` in sec:identification)
``loglinear_closed_form``  K-list alternating-product formula with ω       Thm ``thm:closed``, Cor ``cor:bounds``
``loglinear_model``        one fixed hierarchical Poisson log-linear model  (Fienberg 1972)
``loglinear_bma``          BIC/AIC model averaging over hierarchical models (sec:models; madigan1997)
``chao_lower_bound``       Chao (1987) heterogeneity lower bound            Thm ``thm:chao``
``lcmcr``                  DP latent-class MSE, Gibbs                       Eq ``eq:lcmcr`` (manriquevallier2016)
``linkage_corrected``      invert the LE operator, then any estimator       Cor ``cor:linkcorrect``
=========================  ==============================================  ===========================

All functions take a capture table ``dict[tuple[int, ...], float]`` over nonzero
histories of length K (float counts allowed; missing histories are 0; an
all-zero key is ignored) and return an :class:`Estimate`.  A bitmask-ordered
array of length ``2**K`` is accepted as well (see :mod:`darkfig.loglinear`).

Conventions shared by every estimator:

* ``N_hat`` estimates the population size N; ``n_obs`` is the number of
  distinct units observed in the table that the point estimate is based on
  (all K lists), so ``N_hat - n_obs`` is the estimated dark figure ``n_0``.
  ``n_obs`` is an ``int`` when the counts are integral, else a ``float``.
* ``(lo, hi)`` is a two-sided interval at ``level`` (default 0.95) for N.
* ``extra`` holds estimator-specific diagnostics; by default all values are
  plain Python scalars / lists / dicts (JSON-serialisable), except the
  ``t_hat`` table of :func:`linkage_corrected` (tuple keys; use
  :meth:`Estimate.to_dict` for a JSON-safe copy).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Callable

import numpy as np
from scipy import optimize, special, stats

from . import lcmcr as _lc
from . import linkerror as _le
from .loglinear import (
    array_to_table,
    closed_form_log_n0,
    collapse,
    design_matrix,
    frequency_counts,
    hierarchical_models,
    interaction_terms,
    irls_poisson_batch,
    table_to_array,
)

__all__ = [
    "Estimate",
    "lincoln_petersen",
    "loglinear_closed_form",
    "loglinear_model",
    "loglinear_bma",
    "chao_lower_bound",
    "lcmcr",
    "linkage_corrected",
]


# --------------------------------------------------------------------------
# Result container
# --------------------------------------------------------------------------
@dataclass
class Estimate:
    """Result of a population-size estimator.

    Attributes
    ----------
    N_hat : point estimate of N.
    lo, hi : interval limits for N (confidence or credible, see ``method``).
    n_obs : distinct units observed (``N_hat - n_obs`` = estimated dark figure).
    method : short identifier, e.g. ``"loglinear_closed_form"``.
    extra : estimator-specific diagnostics.
    """

    N_hat: float
    lo: float
    hi: float
    n_obs: int | float
    method: str
    extra: dict = field(default_factory=dict)

    @property
    def n0_hat(self) -> float:
        """Estimated dark figure ``N_hat - n_obs``."""
        return self.N_hat - self.n_obs

    def covers(self, N: float) -> bool:
        """Whether ``lo <= N <= hi``."""
        return bool(self.lo <= N <= self.hi)

    def to_dict(self) -> dict:
        """JSON-safe dict (tuple-keyed tables become ``"0101"``-style string keys)."""
        return _jsonable(asdict(self))


def _jsonable(x):
    if isinstance(x, dict):
        return {("".join(str(int(v)) for v in k) if isinstance(k, tuple) else str(k)): _jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_jsonable(v) for v in x]
    if isinstance(x, np.ndarray):
        return _jsonable(x.tolist())
    if isinstance(x, (np.floating,)):
        return float(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def _nobs(n: float):
    return int(round(n)) if abs(n - round(n)) < 1e-9 else float(n)


def _z(level: float) -> float:
    if not (0.0 < level < 1.0):
        raise ValueError("level must be in (0, 1)")
    return float(stats.norm.ppf(0.5 + level / 2.0))


def _lognormal_unseen_ci(n: float, f0: float, var: float, z: float) -> tuple[float, float]:
    """Chao (1987) log-normal interval: ``[n + f0/C, n + f0*C]``, ``C = exp(z sqrt(log(1 + var/f0^2)))``.

    Assumes the unseen part ``f0 = N_hat - n`` is log-normal; the lower limit is
    never below ``n``.
    """
    if not np.isfinite(f0) or not np.isfinite(var):
        return (n if f0 >= 0 else float("nan")), float("inf")
    if f0 <= 0.0:
        return float(n), float(n)
    Cc = math.exp(z * math.sqrt(math.log1p(max(var, 0.0) / f0**2)))
    return float(n + f0 / Cc), float(n + f0 * Cc)


# --------------------------------------------------------------------------
# Lincoln-Petersen / Chapman
# --------------------------------------------------------------------------
def lincoln_petersen(table, lists=(0, 1), variant: str = "chapman", level: float = 0.95) -> Estimate:
    """Two-list Lincoln-Petersen estimator (\\citet{petersen1896}, \\citet{lincoln1930}).

    The table is collapsed onto ``lists`` (0-based), giving list sizes ``n1``,
    ``n2``, overlap ``m`` and ``n12 = n1 + n2 - m`` distinct units seen by the two
    lists.

    * classic: ``N_LP = n1 n2 / m`` (``inf`` if ``m = 0``); equals
      :func:`loglinear_closed_form` with K = 2, ω = 0 (Thm ``thm:closed``).
    * Chapman (1951): ``N_C = (n1 + 1)(n2 + 1)/(m + 1) - 1``, finite for m = 0.

    ``N_hat`` is the Chapman estimator (``variant="chapman"``, default) or the
    classic one (``variant="classic"``); both are in ``extra``.

    Interval: **log-normal** interval on the unseen part (Chao 1987 transform):
    ``f0 = N_hat - n12``, ``[n12 + f0/C, n12 + f0*C]`` with
    ``C = exp(z sqrt(log(1 + Var/f0^2)))``, using the Chapman variance
    (Seber 1970) ``Var = (n1+1)(n2+1)(n1-m)(n2-m) / ((m+1)^2 (m+2))`` for Chapman
    and the classic multinomial variance ``n1 n2 (n1-m)(n2-m)/m^3`` for classic.
    The lower limit is therefore never below ``n12``.

    ``n_obs`` is the number of distinct units in the *whole* table (all K
    lists); ``n12`` is in ``extra``.
    """
    y, K = table_to_array(table)
    sub, _ = collapse(y, lists)
    n10, n01, n11 = float(sub[1]), float(sub[2]), float(sub[3])
    n1, n2, m = n10 + n11, n01 + n11, n11
    n12 = n10 + n01 + n11
    a, b = n1 - m, n2 - m
    chapman = (n1 + 1.0) * (n2 + 1.0) / (m + 1.0) - 1.0
    var_c = (n1 + 1.0) * (n2 + 1.0) * a * b / ((m + 1.0) ** 2 * (m + 2.0))
    classic = n1 * n2 / m if m > 0 else float("inf")
    var_lp = n1 * n2 * a * b / m**3 if m > 0 else float("inf")
    z = _z(level)
    if variant == "chapman":
        N_hat, var = chapman, var_c
    elif variant == "classic":
        N_hat, var = classic, var_lp
    else:
        raise ValueError("variant must be 'chapman' or 'classic'")
    lo, hi = _lognormal_unseen_ci(n12, N_hat - n12, var, z)
    return Estimate(
        N_hat=float(N_hat),
        lo=lo,
        hi=hi,
        n_obs=_nobs(float(y.sum())),
        method=f"lincoln_petersen[{variant}]",
        extra={
            "chapman": float(chapman),
            "classic": float(classic),
            "var_chapman": float(var_c),
            "var_classic": float(var_lp),
            "n1": n1,
            "n2": n2,
            "m": m,
            "n12": n12,
            "lists": [int(k) for k in lists],
            "ci": "lognormal on unseen part (Chao 1987) with Seber (1970) Chapman variance",
            "level": level,
        },
    )


# --------------------------------------------------------------------------
# Closed form (Thm thm:closed)
# --------------------------------------------------------------------------
def loglinear_closed_form(
    table,
    omega: float = 0.0,
    correction: str = "auto",
    level: float = 0.95,
    n0_sampling_var: bool = True,
) -> Estimate:
    """Closed-form K-list estimator of the dark figure (Thm ``thm:closed``).

    Under the saturated log-linear model whose untestable K-way interaction
    ``u_[K]`` is fixed at the sensitivity parameter ω,

        n0_hat(ω) = exp((-1)^K ω) * prod_{|h| odd} n_h / prod_{|h| even, h != 0} n_h ,

    which is the fitted ``mu_0`` of the Poisson log-linear model with all
    interactions except the K-way one and the K-way term offset to ω (verified
    in the tests), and for K = 2, ω = 0 is the classic Lincoln-Petersen
    estimator.  Varying ω traces the sensitivity bounds of Cor ``cor:bounds``.

    Interval: delta method on the log scale (ω treated as known),
    ``[n + n0_hat e^{-z se}, n + n0_hat e^{z se}]`` with

        se^2 = sum_{h != 0} 1/n_h  +  1/n0_hat .

    The first term is ``Var(log mu0_hat)`` (Thm ``thm:closed``).  The second
    (``n0_sampling_var=True``, default) accounts for the Poisson variability of
    the *realised* dark figure ``n_0`` around ``mu_0``: ``N_hat - N = mu0_hat - n_0``
    with ``n_0`` independent of the observed cells, so
    ``Var(N_hat - N) = Var(mu0_hat) + mu_0``.  For K = 2 this reproduces the
    classic multinomial Lincoln-Petersen variance ``n1 n2 (n1-m)(n2-m)/m^3``
    exactly.  For the saturated K = 4 model the second term is negligible;
    ``n0_sampling_var=False`` gives ``sum 1/n_h`` alone.

    Zero cells: ``correction="auto"`` (default) adds 0.5 to **every** observed
    cell if any cell is zero (Haldane-Anscombe); ``"always"`` always adds 0.5;
    ``"none"`` never does (a zero then gives ``n0_hat`` = 0, inf or nan).  The
    correction affects ``n0_hat`` and its variance only; ``n_obs`` is the
    uncorrected count.  ``extra["corrected"]`` records whether it was applied.
    """
    y, K = table_to_array(table)
    if K < 2:
        raise ValueError("need K >= 2 lists")
    cells = y[1:].copy()
    if correction == "auto":
        corrected = bool(np.any(cells <= 0))
    elif correction == "always":
        corrected = True
    elif correction == "none":
        corrected = False
    else:
        raise ValueError("correction must be 'auto', 'always' or 'none'")
    if corrected:
        cells = cells + 0.5
    yc = np.concatenate([[0.0], cells])
    n = float(y.sum())
    with np.errstate(divide="ignore", invalid="ignore"):
        log_n0 = closed_form_log_n0(yc, K, omega)
        n0 = math.exp(log_n0) if log_n0 < 709 else float("inf")
        var_log = float(np.sum(1.0 / cells)) if np.all(cells > 0) else float("inf")
    if n0_sampling_var and n0 > 0:
        var_log += 1.0 / n0
    z = _z(level)
    se = math.sqrt(var_log) if np.isfinite(var_log) else float("inf")
    if np.isfinite(log_n0) and np.isfinite(se):
        lo, hi = n + n0 * math.exp(-z * se), n + n0 * math.exp(z * se)
    else:
        lo, hi = float("nan"), float("nan")
    return Estimate(
        N_hat=float(n + n0),
        lo=float(lo),
        hi=float(hi),
        n_obs=_nobs(n),
        method="loglinear_closed_form",
        extra={
            "omega": float(omega),
            "n0_hat": float(n0),
            "log_n0_hat": float(log_n0),
            "se_log_n0": float(se),
            "corrected": corrected,
            "n0_sampling_var": bool(n0_sampling_var),
            "K": K,
            "level": level,
            "ci": "delta method on log n0: Var = sum 1/n_h" + (" + 1/n0_hat" if n0_sampling_var else ""),
        },
    )


# --------------------------------------------------------------------------
# Log-linear models: single model and model averaging
# --------------------------------------------------------------------------
def _parse_terms(K: int, terms) -> tuple[tuple[int, ...], ...]:
    if terms is None or terms == "independence":
        return ()
    if terms == "all2":
        return tuple(interaction_terms(K, 2))
    return tuple(tuple(sorted(int(k) for k in S)) for S in terms)


def loglinear_model(table, terms=None, level: float = 0.95, n0_sampling_var: bool = True) -> Estimate:
    """Fit one hierarchical Poisson log-linear model (\\citet{fienberg1972}) and estimate N.

    ``terms``: iterable of interaction terms (tuples of 0-based list indices),
    ``None``/``"independence"`` for main effects only, or ``"all2"`` for all
    two-way terms.  Main effects are always included; the K-way term is not
    allowed.  ``N_hat = n + mu_0_hat`` with ``mu_0 = exp(u_{})``; interval: delta
    method on ``log mu_0`` with ``se^2 = [I^{-1}]_{00} + 1/mu0_hat`` (inverse
    Fisher information of the intercept, plus the Poisson variability of the
    realised ``n_0``; see :func:`loglinear_closed_form`; i.e. to first order
    ``Var(N_hat - N) = mu0^2 x_0' (X'WX)^{-1} x_0 + mu0``).  Without the second
    term (``n0_sampling_var=False``) the interval covers ``E[N]`` rather than the
    realised N and under-covers (about 0.90 for the K = 4 independence model with
    N = 2000 in our checks).
    """
    y, K = table_to_array(table)
    T = _parse_terms(K, terms)
    if any(len(S) >= K for S in T):
        raise ValueError("the K-way interaction is not identifiable (Thm thm:nonid)")
    X, cols = design_matrix(K, T)
    r = irls_poisson_batch(y[1:], X[1:], np.ones((1, X.shape[1]), dtype=bool))
    log_mu0 = float(r["beta"][0, 0])
    var_log = float(r["cov"][0, 0, 0])
    mu0 = math.exp(min(log_mu0, 709.0))
    if n0_sampling_var:
        var_log += 1.0 / mu0
    z = _z(level)
    n = float(y.sum())
    se = math.sqrt(max(var_log, 0.0))
    return Estimate(
        N_hat=n + mu0,
        lo=n + mu0 * math.exp(-z * se),
        hi=n + mu0 * math.exp(z * se),
        n_obs=_nobs(n),
        method="loglinear_model",
        extra={
            "terms": [list(S) for S in T],
            "deviance": float(r["deviance"][0]),
            "df": int(2**K - 1 - X.shape[1]),
            "converged": bool(r["converged"][0]),
            "n0_hat": mu0,
            "se_log_n0": se,
            "level": level,
        },
    )


def _mixture_normal_quantile(p: float, means: np.ndarray, sds: np.ndarray, w: np.ndarray) -> float:
    """Quantile of ``sum_m w_m N(means_m, sds_m^2)`` by bracketing + Brent."""
    sds = np.maximum(sds, 1e-12)

    def cdf(x):
        return float(np.dot(w, special.ndtr((x - means) / sds))) - p   # ndtr == norm.cdf, without overhead

    lo = float(np.min(means - 10 * sds))
    hi = float(np.max(means + 10 * sds))
    return float(optimize.brentq(cdf, lo, hi, xtol=1e-10))


def loglinear_bma(
    table,
    max_order: int = 2,
    criterion: str = "bic",
    level: float = 0.95,
    cell_correction: float = 0.0,
    n0_sampling_var: bool = True,
    return_models: bool = False,
) -> Estimate:
    """Model-averaged Poisson log-linear MSE over all hierarchical models (sec:simulation, C5).

    1. Enumerate every hierarchical log-linear model with main effects and
       interactions of order ``2..max_order`` (clamped to ``K-1``; for K = 2 only
       the independence model remains, i.e. Lincoln-Petersen); for K = 4,
       ``max_order = 2`` these are the ``2**6 = 64`` subsets of the pairwise terms.
    2. Fit each by Poisson IRLS on the ``2**K - 1`` observed cells (batched over
       models; see :func:`darkfig.loglinear.irls_poisson_batch`), giving
       ``mu0_m = exp(u_{}^(m))`` and the delta-method ``Var(log mu0_m)`` from the
       inverse Fisher information.
    3. Information criterion ``IC_m = deviance_m + c * p_m`` with ``c = log(n)``
       (BIC; n = number of observed units) or ``c = 2`` (AIC); weights
       ``w_m ∝ exp(-(IC_m - min IC)/2)``, i.e. BIC weights approximate posterior
       model probabilities under a uniform model prior (cf. \\citet{madigan1997}).
    4. ``N_hat = n + sum_m w_m mu0_m``.

    Interval: **model-averaged tail-area (MATA-Wald) interval** (Turek & Fletcher
    2012): the limits for ``log n_0`` are the ``(1-level)/2`` and
    ``(1+level)/2`` quantiles of the mixture ``sum_m w_m N(log mu0_m, Var_m)``,
    i.e. they solve ``sum_m w_m Phi((L - log mu0_m)/se_m) = (1-level)/2`` etc.,
    with ``Var_m = [I_m^{-1}]_{00} + 1/mu0_m`` (the second term, on by default,
    is the sampling variability of the realised n_0; see :func:`loglinear_model`).
    This accounts for model-selection uncertainty and costs one root-find; no
    bootstrap is needed (~ 5-10 ms per table for K = 4).

    Models whose MLE does not exist (zero cells on the boundary: IRLS
    coefficients diverge) or whose fit does not converge are dropped
    (``extra["n_dropped"]``).  ``cell_correction`` (default 0) is added to every
    observed cell before fitting, e.g. 0.5 for very sparse tables.
    """
    y, K = table_to_array(table)
    if criterion not in ("bic", "aic"):
        raise ValueError("criterion must be 'bic' or 'aic'")
    if K < 2:
        raise ValueError("need K >= 2 lists")
    max_order = min(int(max_order), K - 1)  # the K-way term is not identifiable
    models = hierarchical_models(K, max_order)
    all_terms = interaction_terms(K, max_order)
    X, cols = design_matrix(K, all_terms)
    col_index = {S: j for j, S in enumerate(cols)}
    P = X.shape[1]
    masks = np.zeros((len(models), P), dtype=bool)
    masks[:, : K + 1] = True
    for i, mdl in enumerate(models):
        for S in mdl:
            masks[i, col_index[S]] = True
    yy = y[1:] + cell_correction
    r = irls_poisson_batch(yy, X[1:], masks)
    n = float(y.sum())
    log_mu0 = r["beta"][:, 0]
    var_log = r["cov"][:, 0, 0]
    ok = r["converged"] & np.isfinite(log_mu0) & np.isfinite(var_log) & (var_log >= 0) & (log_mu0 < 700)
    if not ok.any():
        raise RuntimeError("no log-linear model converged; try cell_correction=0.5")
    p = r["n_params"].astype(float)
    pen = math.log(max(float(yy.sum()), 2.0)) if criterion == "bic" else 2.0
    ic = r["deviance"] + pen * p
    ic_ok = np.where(ok, ic, np.inf)
    w = np.where(ok, np.exp(-(ic_ok - ic_ok.min()) / 2.0), 0.0)
    w /= w.sum()
    mu0 = np.exp(np.where(ok, log_mu0, 0.0))
    n0_hat = float(np.dot(w, mu0))
    v = np.where(ok, var_log + (1.0 / mu0 if n0_sampling_var else 0.0), 1.0)
    sel = w > 1e-12
    alpha = 1.0 - level
    qlo = _mixture_normal_quantile(alpha / 2, log_mu0[sel], np.sqrt(v[sel]), w[sel] / w[sel].sum())
    qhi = _mixture_normal_quantile(1 - alpha / 2, log_mu0[sel], np.sqrt(v[sel]), w[sel] / w[sel].sum())
    best = int(np.argmax(w))
    extra = {
        "n0_hat": n0_hat,
        "criterion": criterion,
        "max_order": max_order,
        "n_models": len(models),
        "n_dropped": int((~ok).sum()),
        "best_model": [list(S) for S in models[best]],
        "best_weight": float(w[best]),
        "best_n0": float(mu0[best]),
        "weight_independence": float(w[0]),
        "cell_correction": cell_correction,
        "level": level,
        "ci": "MATA-Wald (Turek & Fletcher 2012) mixture of per-model log-normal deltas",
    }
    if return_models:
        extra["models"] = [
            {
                "terms": [list(S) for S in mdl],
                "weight": float(w[i]),
                "n0": float(mu0[i]) if ok[i] else float("nan"),
                "se_log_n0": float(np.sqrt(var_log[i])) if ok[i] else float("nan"),
                "ic": float(ic[i]),
                "deviance": float(r["deviance"][i]),
                "converged": bool(ok[i]),
            }
            for i, mdl in enumerate(models)
        ]
    return Estimate(
        N_hat=n + n0_hat,
        lo=n + math.exp(qlo),
        hi=n + math.exp(qhi),
        n_obs=_nobs(n),
        method=f"loglinear_bma[{criterion},order{max_order}]",
        extra=extra,
    )


# --------------------------------------------------------------------------
# Chao (1987) lower bound (Thm thm:chao)
# --------------------------------------------------------------------------
def chao_lower_bound(table, bias_corrected: bool = False, level: float = 0.95) -> Estimate:
    """Chao (1987) heterogeneity-robust lower bound for N (Thm ``thm:chao``).

    With ``f_j`` = number of units seen by exactly j of the K lists and
    ``n = sum_j f_j``, Cauchy-Schwarz under the M_h model (independent lists given
    individual capture probabilities) gives
    ``E f_0 >= ((K-1)/K) (E f_1)^2 / (2 E f_2)``, with equality under homogeneity.
    The estimator is

        N_hat = n + c f_1^2 / (2 f_2),        c = (K-1)/K .

    (For K -> infinity this is the familiar ``n + f_1^2/(2 f_2)``.)  If ``f_2 = 0``,
    or if ``bias_corrected=True``, the bias-corrected form
    ``n + c f_1 (f_1 - 1) / (2 (f_2 + 1))`` (Chao 2005) is used.

    Variance: the multinomial delta method of Chao (1987).  For the classic form
    it is

        Var = f_2 [ (c/2) r^2 + c^2 r^3 + (c^2/4) r^4 ],   r = f_1 / f_2,

    which reduces to Chao's (1987) ``f_2 [r^4/4 + r^3 + r^2/2]`` for c = 1.  For
    the bias-corrected form the same delta method gives (with f_2 = 0)
    ``c f_1(f_1-1)/2 + c^2 f_1 (2 f_1 - 1)^2 / 4 - c^2 f_1^4 / (4 N_hat)``.

    Interval (Chao 1987): log-normal on ``f0_hat = N_hat - n``:
    ``[n + f0/C, n + f0 C]``, ``C = exp(z sqrt(log(1 + Var/f0^2)))``.  If
    ``f0_hat = 0`` the interval degenerates to ``[n, n]``.
    """
    y, K = table_to_array(table)
    if K < 2:
        raise ValueError("need K >= 2 lists")
    f = frequency_counts(y)
    n = float(f[1:].sum())
    f1, f2 = float(f[1]), float(f[2])
    c = (K - 1.0) / K
    use_bc = bias_corrected or f2 <= 0
    if use_bc:
        f0 = c * f1 * max(f1 - 1.0, 0.0) / (2.0 * (f2 + 1.0))
        a1 = c * (2.0 * f1 - 1.0) / (2.0 * (f2 + 1.0))
        a2 = -c * f1 * (f1 - 1.0) / (2.0 * (f2 + 1.0) ** 2)
    else:
        f0 = c * f1 * f1 / (2.0 * f2)
        a1 = c * f1 / f2
        a2 = -c * f1 * f1 / (2.0 * f2 * f2)
    N_hat = n + f0
    # multinomial delta method for g = f0_hat(f1, f2) - f0, gradient (a0=-1, a1, a2, 0, ...),
    # Cov(f_i, f_j) = f_i (1{i=j} - f_j / N), evaluated at f0 = f0_hat
    if N_hat > 0:
        lin = -f0 + a1 * f1 + a2 * f2
        var = f0 + a1 * a1 * f1 + a2 * a2 * f2 - lin * lin / N_hat
    else:
        var = 0.0
    var = max(var, 0.0)
    lo, hi = _lognormal_unseen_ci(n, f0, var, _z(level))
    return Estimate(
        N_hat=float(N_hat),
        lo=lo,
        hi=hi,
        n_obs=_nobs(n),
        method="chao_lower_bound" + ("[bc]" if use_bc else ""),
        extra={
            "f": [float(v) for v in f[1:]],
            "f0_hat": float(f0),
            "var": float(var),
            "c": c,
            "bias_corrected": bool(use_bc),
            "level": level,
            "ci": "Chao (1987) log-normal on f0",
        },
    )


# --------------------------------------------------------------------------
# LCMCR (Manrique-Vallier 2016)
# --------------------------------------------------------------------------
def lcmcr(
    table,
    J: int = 10,
    n_iter: int = 10_000,
    burn: int = 2_000,
    thin: int = 4,
    seed=None,
    alpha_prior: tuple[float, float] = (0.25, 0.25),
    level: float = 0.95,
    return_samples: bool = False,
    n_chains: int = 1,
    init_spread: tuple = (0.5, 1.0, 2.0, 4.0),
) -> Estimate:
    """Bayesian nonparametric latent-class MSE (Eq ``eq:lcmcr``; \\citet{manriquevallier2016}).

    Truncated stick-breaking DP mixture of J product-Bernoulli classes,
    ``lambda_jk ~ Beta(1,1)``, ``alpha ~ Gamma(alpha_prior)`` (shape, rate),
    ``p(N) ∝ 1/N``; Gibbs sampler with negative-binomial data augmentation for
    ``n_0`` and multinomial class allocation at the cell level (see
    :mod:`darkfig.lcmcr`).  ``n_iter`` is the number of iterations *per chain*
    including ``burn``.

    ``n_chains > 1`` runs independent chains whose initial ``n_0`` is the
    Chao-type default times ``init_spread[c]`` (overdispersed starts, App.
    app:comp-lcmcr), pools their draws, and reports the rank-normalised split
    R-hat and bulk / tail ESS of N (Vehtari et al. 2021) in ``extra``.  With one
    chain ``extra["ess"]`` is the single-chain ESS (Geyer).

    ``N_hat`` is the posterior median of N; ``(lo, hi)`` the equal-tailed
    ``level`` credible interval.  Non-integer counts (e.g. a linkage-corrected
    table) are rounded to the nearest integer (``extra["rounded"]``).
    """
    y, K = table_to_array(table)
    yr = np.rint(np.maximum(y, 0.0))
    rounded = bool(np.any(np.abs(y - yr) > 1e-9))
    ss = np.random.SeedSequence(seed if isinstance(seed, (int, type(None))) else None)
    chains, alphas, kocc, secs = [], [], [], 0.0
    base = None
    if n_chains > 1:
        f = np.bincount(_lc.popcount(K), weights=np.rint(yr), minlength=K + 1)
        f1, f2 = f[1], (f[2] if K >= 2 else 0.0)
        base = f1 * f1 / (2.0 * f2) if f2 > 0 else f1 * max(f1 - 1, 0) / 2.0
    for c in range(n_chains):
        if n_chains == 1:
            sd, n0i = seed, None
        else:
            sd = np.random.default_rng(ss.spawn(1)[0])
            n0i = float(np.clip(base * init_spread[c % len(init_spread)], 1.0, 10.0 * yr.sum()))
        res = _lc.gibbs_lcmcr(yr, K, J=J, n_iter=n_iter, burn=burn, thin=thin, seed=sd,
                              alpha_prior=alpha_prior, n0_init=n0i)
        chains.append(res["N"])
        alphas.append(res["alpha"])
        kocc.append(res["k_occ"])
        secs += float(res["seconds"])
    Ns = np.concatenate(chains)
    a = 1.0 - level
    lo, med, hi = np.quantile(Ns, [a / 2, 0.5, 1 - a / 2])
    extra = {
        "post_mean": float(Ns.mean()),
        "post_sd": float(Ns.std(ddof=1)) if Ns.size > 1 else 0.0,
        "ess": float(sum(_lc.effective_sample_size(ch) for ch in chains)),
        "n_draws": int(Ns.size),
        "n_chains": int(n_chains),
        "alpha_mean": float(np.concatenate(alphas).mean()),
        "k_occupied_mean": float(np.concatenate(kocc).mean()),
        "J": J,
        "n_iter": n_iter,
        "burn": burn,
        "thin": thin,
        "seed": seed if isinstance(seed, (int, type(None))) else str(seed),
        "rounded": rounded,
        "seconds": secs,
        "level": level,
    }
    if n_chains > 1:
        d = _lc.convergence_diagnostics(np.vstack(chains))
        extra.update(rhat=d["rhat"], ess_bulk=d["ess_bulk"], ess_tail=d["ess_tail"])
        extra["chain_medians"] = [float(np.median(ch)) for ch in chains]
    if return_samples:
        extra["samples"] = Ns.tolist()
    return Estimate(
        N_hat=float(med),
        lo=float(lo),
        hi=float(hi),
        n_obs=_nobs(float(yr.sum())),
        method="lcmcr",
        extra=extra,
    )


def lcmcr_pooled(tables, seed=None, level: float = 0.95, **kw) -> Estimate:
    """Linkage-averaged LCMCR: one chain per table (e.g. per imputed linkage), draws pooled.

    The pooled draws estimate the mixture of the per-table posteriors (Prop.
    prop:totalvar, Alg. alg:pipeline line 9). ``n_obs`` is the mean over tables.
    R-hat is not computed (the chains target different posteriors); ``extra``
    has the summed per-chain ESS and the between-table spread of the medians.
    """
    ss = np.random.SeedSequence(seed if isinstance(seed, (int, type(None))) else None)
    kw = dict(kw)
    kw.pop("n_chains", None)
    S, nobs, ess, secs, meds = [], [], 0.0, 0.0, []
    for t in tables:
        e = lcmcr(t, seed=int(ss.spawn(1)[0].generate_state(1)[0]), level=level, return_samples=True,
                  n_chains=1, **kw)
        S.append(np.asarray(e.extra["samples"]))
        nobs.append(float(e.n_obs))
        ess += e.extra["ess"]
        secs += e.extra["seconds"]
        meds.append(e.N_hat)
    allS = np.concatenate(S)
    a = 1.0 - level
    lo, med, hi = np.quantile(allS, [a / 2, 0.5, 1 - a / 2])
    return Estimate(N_hat=float(med), lo=float(lo), hi=float(hi), n_obs=float(np.mean(nobs)),
                    method="lcmcr_pooled",
                    extra=dict(n_tables=len(S), ess=float(ess), seconds=secs, n_draws=int(allS.size),
                               median_sd_between=float(np.std(meds, ddof=1)) if len(meds) > 1 else 0.0,
                               samples=allS.tolist(), level=level))


# --------------------------------------------------------------------------
# Linkage-corrected estimation (Cor cor:linkcorrect)
# --------------------------------------------------------------------------
_SOLVE_CACHE: dict = {}


def _memo(key, fn):
    """Small memo for deterministic per-table computations reused across inner estimators."""
    if key in _SOLVE_CACHE:
        return _SOLVE_CACHE[key]
    if len(_SOLVE_CACHE) > 256:
        _SOLVE_CACHE.clear()
    val = fn()
    _SOLVE_CACHE[key] = val
    return val


def _solve_corrected(obs: np.ndarray, K: int, delta: float, eps: float, tol: float = 1e-11,
                     max_iter: int = 20_000, damping: float = 1.0):
    """Projected fixed-point solve of ``E[T(delta, eps) t] = obs`` (SPEC LE step 3); memoised."""
    key = ("solve", obs.tobytes(), K, float(delta), float(eps), tol, max_iter, damping)
    t, it, conv, rn, st = _memo(key, lambda: _solve_corrected_raw(obs, K, delta, eps, tol, max_iter, damping))
    return t.copy(), it, conv, rn, st


def _solve_corrected_raw(obs: np.ndarray, K: int, delta: float, eps: float, tol: float = 1e-11,
                         max_iter: int = 20_000, damping: float = 1.0):
    scale = max(1.0, float(obs.max()))
    step = float(damping)
    if not (0.0 < step <= 1.0):
        raise ValueError("damping must be in (0, 1]")

    def resid(tt):
        r = obs - _le._expected_observed_array(tt, K, delta, eps)
        r[0] = 0.0
        return r

    t = obs.copy()
    res = resid(t)
    r0 = rnorm = float(np.max(np.abs(res)))
    it = 0
    converged = rnorm <= tol * scale
    while not converged and it < max_iter:
        it += 1
        t_new = np.maximum(0.0, t + step * res)
        res_new = resid(t_new)
        rnew = float(np.max(np.abs(res_new)))
        if not np.isfinite(rnew) or rnew > 1e6 * max(r0, 1.0):
            # divergence safeguard (not triggered for delta < 1 in our experiments): restart damped
            step *= 0.5
            t = obs.copy()
            res = resid(t)
            rnorm = r0
            continue
        moved = float(np.max(np.abs(t_new - t)))
        t, res, rnorm = t_new, res_new, rnew
        if rnorm <= tol * scale:
            converged = True
        elif moved <= 1e-3 * tol * scale:
            break  # stationary point of the projected iteration (some t_h clamped at 0)
    return t, it, bool(converged), rnorm, step


def _interval_offset(est: Estimate) -> float:
    """Offset ``a`` of the inner interval, which is log-normal on ``N - a`` (LP: n12; others: n_obs)."""
    ex = est.extra or {}
    if "n12" in ex and str(est.method).startswith("lincoln_petersen"):
        return float(ex["n12"])
    return float(est.n_obs)


def widen_interval(N_hat: float, lo: float, hi: float, a: float, v_add: float, level: float = 0.95):
    """Add variance ``v_add`` (on the N scale) to a log-normal interval on ``N - a``.

    Each side's log half-width ``z s_side`` is replaced by
    ``z sqrt(s_side^2 + log(1 + v_add / f0^2))``, ``f0 = N_hat - a`` (the log-normal
    moment match used by the LP / Chao intervals); asymmetric inner intervals
    (BMA's MATA mixture, posterior quantiles) keep their asymmetry.
    """
    z = _z(level)
    if not (np.isfinite(v_add) and v_add > 0):
        return float(lo), float(hi)
    f0 = N_hat - a
    if not np.isfinite(f0) or f0 <= 0:
        sd = math.sqrt(v_add)
        return float(max(a, lo - z * sd)), float(hi + z * sd)
    add = math.log1p(v_add / f0 ** 2)
    if lo > a and np.isfinite(lo):
        s_lo = math.log(f0 / (lo - a)) / z
        lo_n = a + f0 * math.exp(-z * math.sqrt(max(s_lo, 0.0) ** 2 + add))
    else:
        lo_n = lo
    if np.isfinite(hi) and hi > a:
        s_hi = math.log((hi - a) / f0) / z
        hi_n = a + f0 * math.exp(z * math.sqrt(max(s_hi, 0.0) ** 2 + add))
    else:
        hi_n = hi
    return float(lo_n), float(hi_n)


def _num_grad(F, t: np.ndarray, rel: float = 1e-3, abs_step: float = 0.05):
    """Forward-difference gradient of ``F`` (array of length 2^K in, float out) on cells 1..2^K-1."""
    base = F(t)
    g = np.zeros(len(t) - 1)
    for i in range(1, len(t)):
        h = max(abs_step, rel * abs(t[i]))
        tp = t.copy()
        tp[i] += h
        g[i - 1] = (F(tp) - base) / h
    return g, base


def linkage_corrected(
    table,
    delta: float,
    eps: float,
    estimator: Callable[..., Estimate] = loglinear_closed_form,
    tol: float = 1e-11,
    max_iter: int = 20_000,
    damping: float = 1.0,
    link_var: str = "delta",
    rate_se: tuple | None = None,
    n_imp: int = 4,
    seed=None,
    **kw,
) -> Estimate:
    """Linkage-error-corrected estimator (Cor ``cor:linkcorrect``) with linkage variance.

    Point estimate: solve ``E[T(delta, eps) t] = n~`` for ``t >= 0`` by the damped
    fixed-point iteration of SPEC (``t <- max(0, t + damping (n~ - E[T(t)]))``,
    ``t^(0) = n~``) and return ``estimator(t_hat, **kw)``; ``n_obs = sum(t_hat)``.

    Interval (run 2). The inner interval treats ``t_hat`` as a raw table and so
    reflects only the capture variance ``v_cap``. Cor cor:linkcorrect(i) adds the
    linkage variance ``v_link``:

    * ``link_var="delta"`` (default; frequentist inner estimators): delta method
      ``v_link = a' Sigma a`` with ``a = J^{-T} grad F(t_hat)``, ``J`` the Jacobian of
      ``t -> E[T(delta, eps) t]`` at ``t_hat`` (``D_delta`` times the merge
      Jacobian) and ``Sigma = Cov(n~ | t_hat)`` under LE
      (:func:`darkfig.linkerror.observed_covariance`: exact for the detachment
      step, first order in eps for merging). ``grad F`` by forward differences.
      ``v_link`` is added to the inner interval on its log(N - a) scale
      (:func:`widen_interval`).
    * ``link_var="impute"`` (for Bayesian inner estimators such as LCMCR, whose
      posterior median cannot be differentiated numerically): ``n_imp`` tables
      ``t* ~ N(t_hat, J^{-1} Sigma J^{-T})`` (rounded, clipped at 0) are drawn, one
      chain is run on each and the draws are pooled (:func:`lcmcr_pooled`).
    * ``link_var="none"``: the run-1 behaviour (inner interval only).

    ``rate_se=(se_delta, se_eps)``: additionally the audit variance of Cor
    cor:linkcorrect(iii), ``v_aud = c' diag(se^2) c`` with ``c = dN_hat/d(delta, eps)``
    by central differences (covariance of the two rate estimates ignored). Adding
    it to ``v_link`` is conservative when the audit sampled the same linkage
    (Rem. rem:link-sameaudit). Returned as ``extra["lo_tv"], extra["hi_tv"]``.

    ``extra`` holds the inner ``extra`` plus ``t_hat``, ``lo_cap``/``hi_cap`` (inner
    interval, v_cap only), ``v_link``, ``v_aud``, ``se_log_n0_link`` (the added
    log-scale sd), ``iterations``, ``residual``, ``converged`` (False if the
    non-negativity projection is active), ``n_zero_cells``, ``delta``, ``eps``.
    """
    if not (0.0 <= delta < 1.0) or not (0.0 <= eps < 1.0):
        raise ValueError("need 0 <= delta < 1 and 0 <= eps < 1")
    obs, K = table_to_array(table)
    t, it, converged, rnorm, step = _solve_corrected(obs, K, delta, eps, tol, max_iter, damping)
    t_table = array_to_table(t, K)
    level = kw.get("level", 0.95)
    Sigma_t = None
    v_link = float("nan")
    if link_var in ("delta", "impute"):
        def _lin():
            J = _le.jacobian_expected_observed(t, delta, eps)
            Sig = _le.observed_covariance(t, delta, eps)
            Jinv = np.linalg.inv(J)
            return Sig, Jinv, Jinv @ Sig @ Jinv.T
        Sig, Jinv, Sigma_t = _memo(("lin", t.tobytes(), K, float(delta), float(eps)), _lin)
    if link_var == "impute":
        rng = np.random.default_rng(seed)
        A = np.linalg.cholesky(Sigma_t + 1e-9 * np.eye(len(t) - 1))
        tabs = []
        for _ in range(int(n_imp)):
            ts = np.zeros_like(t)
            ts[1:] = np.maximum(0.0, np.rint(t[1:] + A @ rng.standard_normal(len(t) - 1)))
            tabs.append(array_to_table(ts, K))
        kw2 = {k: v for k, v in kw.items() if k not in ("seed", "return_samples", "n_chains")}
        inner = lcmcr_pooled(tabs, seed=int(rng.integers(2**31 - 1)), **kw2)
        lo, hi = inner.lo, inner.hi
        lo_cap, hi_cap = float("nan"), float("nan")
    else:
        inner = estimator(t_table, **kw)
        lo_cap, hi_cap = float(inner.lo), float(inner.hi)
        lo, hi = lo_cap, hi_cap
        if link_var == "delta":
            def F(tt):
                return float(estimator(array_to_table(tt, K), **kw).N_hat)
            g, _ = _num_grad(F, t)
            a = Jinv.T @ g
            v_link = float(max(a @ Sig @ a, 0.0))
            lo, hi = widen_interval(inner.N_hat, lo_cap, hi_cap, _interval_offset(inner), v_link, level)
    extra = dict(inner.extra)
    v_aud = float("nan")
    lo_tv, hi_tv = float("nan"), float("nan")
    if rate_se is not None and link_var != "impute":
        sd_d, sd_e = (float(x) if x is not None and np.isfinite(x) else 0.0 for x in rate_se)
        c = []
        for j, (th, sd) in enumerate(((delta, sd_d), (eps, sd_e))):
            if sd <= 0:
                c.append(0.0)
                continue
            h = max(1e-3, 0.05 * sd)
            up, dn = min(th + h, 0.95), max(th - h, 0.0)
            vals = []
            for th2 in (up, dn):
                d2, e2 = (th2, eps) if j == 0 else (delta, th2)
                t2, *_ = _solve_corrected(obs, K, d2, e2, tol, max_iter, damping)
                vals.append(float(estimator(array_to_table(t2, K), **kw).N_hat))
            c.append((vals[0] - vals[1]) / (up - dn))
        v_aud = float(c[0] ** 2 * sd_d ** 2 + c[1] ** 2 * sd_e ** 2)
        v_tot = (v_link if np.isfinite(v_link) else 0.0) + v_aud
        lo_tv, hi_tv = widen_interval(inner.N_hat, lo_cap, hi_cap, _interval_offset(inner), v_tot, level)
        extra["dN_drates"] = [float(x) for x in c]
    f0 = inner.N_hat - _interval_offset(inner)
    extra.pop("samples", None)
    extra.update(
        {
            "inner_method": inner.method,
            "t_hat": t_table,
            "n_clusters_observed": _nobs(float(obs.sum())),
            "iterations": it,
            "residual": rnorm,
            "converged": bool(converged),
            "n_zero_cells": int(np.sum(t[1:] == 0.0)),
            "delta": float(delta),
            "eps": float(eps),
            "damping_final": step,
            "link_var": link_var,
            "v_link": v_link,
            "v_aud": v_aud,
            "se_log_n0_link": float(math.sqrt(math.log1p(v_link / f0 ** 2))) if (np.isfinite(v_link) and f0 > 0) else float("nan"),
            "lo_cap": lo_cap,
            "hi_cap": hi_cap,
            "lo_tv": lo_tv,
            "hi_tv": hi_tv,
            "interval_offset": _interval_offset(inner),
        }
    )
    if link_var == "impute":
        extra["n_imp"] = int(n_imp)
        extra["sd_t_total"] = float(np.sqrt(np.sum(np.diag(Sigma_t))))
    return Estimate(
        N_hat=inner.N_hat,
        lo=float(lo),
        hi=float(hi),
        n_obs=_nobs(float(t.sum())) if link_var != "impute" else float(inner.n_obs),
        method=f"linkage_corrected({inner.method})",
        extra=extra,
    )
