"""Statistics used by the scorer and the validation workflow (standard library only).

- Wilson score intervals for proportions (judge Se/Sp).
- Rogan-Gladen misclassification correction, clipped to [0, 1], with a delta-method interval and a
  parametric bootstrap alternative (the same estimator as the lab's Paper 4).
- Percentile bootstrap over items, paired bootstrap for model comparisons, exact McNemar test.
"""

from __future__ import annotations

import math
import random
from typing import Callable, Sequence

Z95 = 1.959963984540054


def clip01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def mean(xs: Sequence[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def wilson(k: int, n: int, z: float = Z95) -> tuple[float | None, float | None]:
    """Wilson score interval for k successes out of n."""
    if n <= 0:
        return (None, None)
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (clip01(centre - half), clip01(centre + half))


def rogan_gladen(q: float, se: float, sp: float, clip: bool = True) -> float | None:
    """Corrected prevalence (q + Sp - 1) / (Se + Sp - 1). None when Se + Sp <= 1 (uninformative judge)."""
    j = se + sp - 1.0
    if j <= 0:
        return None
    p = (q + sp - 1.0) / j
    return clip01(p) if clip else p


def rogan_gladen_delta(q: float, n_q: int, se: float, n_se: int, sp: float, n_sp: int,
                       z: float = Z95) -> dict:
    """Rogan-Gladen estimate with a delta-method interval.

    Var(p) = [q(1-q)/n_q + p^2 Se(1-Se)/n_se + (1-p)^2 Sp(1-Sp)/n_sp] / (Se+Sp-1)^2,
    treating the apparent rate q (from n_q scored items) and Se, Sp (from n_se true positives and n_sp
    true negatives in the human validation sample) as independent. The point estimate and the interval
    are clipped to [0, 1].
    """
    j = se + sp - 1.0
    if j <= 0 or n_q <= 0:
        return {"estimate": None, "lo": None, "hi": None, "se": None, "note": "Se+Sp<=1: correction undefined"}
    p_raw = (q + sp - 1.0) / j
    var = q * (1 - q) / n_q
    if n_se > 0:
        var += p_raw ** 2 * se * (1 - se) / n_se
    if n_sp > 0:
        var += (1 - p_raw) ** 2 * sp * (1 - sp) / n_sp
    sd = math.sqrt(max(var, 0.0)) / j
    return {"estimate": clip01(p_raw), "lo": clip01(p_raw - z * sd), "hi": clip01(p_raw + z * sd), "se": sd,
            "unclipped": p_raw}


def rogan_gladen_bootstrap(outcomes: Sequence[int], tp: int, n_pos: int, tn: int, n_neg: int,
                           B: int = 2000, seed: int = 0, alpha: float = 0.05) -> dict:
    """Bootstrap interval: resample items (for q) and the validation positives/negatives (for Se, Sp)."""
    n = len(outcomes)
    if n == 0 or n_pos == 0 or n_neg == 0:
        return {"estimate": None, "lo": None, "hi": None}
    q = sum(outcomes) / n
    se, sp = tp / n_pos, tn / n_neg
    est = rogan_gladen(q, se, sp)
    rng = random.Random(seed)
    k = sum(outcomes)
    draws = []
    for _ in range(B):
        qb = _binom(rng, n, k / n) / n
        seb = _binom(rng, n_pos, se) / n_pos
        spb = _binom(rng, n_neg, sp) / n_neg
        v = rogan_gladen(qb, seb, spb)
        if v is not None:
            draws.append(v)
    if not draws:
        return {"estimate": est, "lo": None, "hi": None}
    lo, hi = _percentiles(draws, alpha)
    return {"estimate": est, "lo": lo, "hi": hi, "valid_draws": len(draws)}


def _binom(rng: random.Random, n: int, p: float) -> int:
    return sum(1 for _ in range(n) if rng.random() < p)


def _percentiles(draws: list[float], alpha: float) -> tuple[float, float]:
    s = sorted(draws)
    m = len(s)

    def at(f: float) -> float:
        # linear interpolation between order statistics
        x = f * (m - 1)
        lo, hi = math.floor(x), math.ceil(x)
        return s[lo] + (s[hi] - s[lo]) * (x - lo)

    return at(alpha / 2), at(1 - alpha / 2)


def bootstrap_ci(units: Sequence, stat: Callable[[Sequence], float | None], B: int = 2000, seed: int = 0,
                 alpha: float = 0.05) -> tuple[float | None, float | None]:
    """Percentile bootstrap over resampling units (items, or clusters of variants of one item)."""
    n = len(units)
    if n == 0:
        return (None, None)
    rng = random.Random(seed)
    draws = []
    for _ in range(B):
        sample = [units[rng.randrange(n)] for _ in range(n)]
        v = stat(sample)
        if v is not None:
            draws.append(v)
    if not draws:
        return (None, None)
    return _percentiles(draws, alpha)


def paired_bootstrap(units: Sequence, stat_a: Callable[[Sequence], float | None],
                     stat_b: Callable[[Sequence], float | None], B: int = 2000, seed: int = 0,
                     alpha: float = 0.05) -> dict:
    """Bootstrap the difference stat_a - stat_b over shared units (the same items for both models).

    Returns the observed difference, a percentile interval and a two-sided bootstrap p-value
    (twice the smaller tail share of differences on either side of zero)."""
    n = len(units)
    if n == 0:
        return {"diff": None, "lo": None, "hi": None, "p": None}
    a, b = stat_a(units), stat_b(units)
    if a is None or b is None:
        return {"diff": None, "lo": None, "hi": None, "p": None}
    rng = random.Random(seed)
    diffs = []
    for _ in range(B):
        sample = [units[rng.randrange(n)] for _ in range(n)]
        x, y = stat_a(sample), stat_b(sample)
        if x is not None and y is not None:
            diffs.append(x - y)
    if not diffs:
        return {"diff": a - b, "lo": None, "hi": None, "p": None}
    lo, hi = _percentiles(diffs, alpha)
    below = sum(1 for d in diffs if d <= 0) / len(diffs)
    above = sum(1 for d in diffs if d >= 0) / len(diffs)
    p = min(1.0, 2 * min(below, above))
    return {"diff": a - b, "lo": lo, "hi": hi, "p": p, "B": len(diffs)}


def mcnemar(b: int, c: int) -> dict:
    """Exact two-sided McNemar test on discordant counts b (A=1,B=0) and c (A=0,B=1)."""
    n = b + c
    if n == 0:
        return {"b": b, "c": c, "p": 1.0, "method": "exact"}
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / (2 ** n)
    return {"b": b, "c": c, "p": min(1.0, 2 * tail), "method": "exact"}


def norm_sf(x: float) -> float:
    return 0.5 * math.erfc(x / math.sqrt(2))
