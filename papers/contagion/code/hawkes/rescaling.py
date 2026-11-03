"""Time-rescaling goodness of fit (Brown et al. 2002; Ogata 1988; Prop
prop:rescaling).

Under the correct model, the compensator increments
``tau_i^k = Lambda_k(t_i^k) - Lambda_k(t_{i-1}^k)`` (with t_0 = 0) of each
stream are i.i.d. Exp(1). We test this with a one-sample Kolmogorov-Smirnov
test per stream. The censored final gap (t_n, T] is ignored, which is the
usual practice. The compensator is exact for exponential kernels (see
:func:`hawkes.likelihood.compensator`).

The p-values are exact only when ``spec`` is the true model. With estimated
parameters the KS test is conservative.
"""

from __future__ import annotations

import numpy as np
from scipy import stats

from .likelihood import check_events, compensator
from .model import HawkesSpec

__all__ = ["rescaled_intervals", "time_rescale_ks", "ks_uniform_bands"]


def rescaled_intervals(spec: HawkesSpec, events, T: float | None = None) -> list[np.ndarray]:
    """Compensator increments per stream (should be i.i.d. Exp(1))."""
    ev = check_events(events, spec.M, T)
    out = []
    for k in range(spec.M):
        if ev[k].size == 0:
            out.append(np.zeros(0))
            continue
        Lam = compensator(spec, ev, ev[k])[:, k]
        out.append(np.diff(np.concatenate([[0.0], Lam])))
    return out


def time_rescale_ks(spec: HawkesSpec, events, T: float | None = None, pooled: bool = False):
    """KS test of the rescaled inter-event times against Exp(1).

    Returns (ks_stat, pvalue) as (M,) arrays, one per stream (NaN for
    streams with fewer than 2 events). With ``pooled=True``, also returns the
    pooled-over-streams test as a third element ``(stat, p)``.
    """
    taus = rescaled_intervals(spec, events, T)
    D = np.full(spec.M, np.nan)
    P = np.full(spec.M, np.nan)
    for k, x in enumerate(taus):
        if x.size >= 2:
            r = stats.kstest(x, "expon")
            D[k], P[k] = r.statistic, r.pvalue
    if pooled:
        allx = np.concatenate(taus)
        r = stats.kstest(allx, "expon")
        return D, P, (float(r.statistic), float(r.pvalue))
    return D, P


def ks_uniform_bands(n: int, level: float = 0.95) -> float:
    """Half-width of the asymptotic KS confidence band for a uniform QQ plot
    of n transformed intervals u = 1 - exp(-tau)."""
    return float(stats.kstwobign.ppf(level) / np.sqrt(n))
