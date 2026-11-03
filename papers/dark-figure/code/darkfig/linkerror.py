"""Canonical linkage-error model (LE) of SPEC: the operator T(delta, eps).

Implements, for a *true* capture table ``t = (t_h)_{h != 0}``, the expected
*observed* (post-linkage) table ``E[T(delta, eps) t]`` used by Thm
``thm:linkbias`` and Cor ``cor:linkcorrect`` (section ``sec:linkage``), and a
Monte Carlo version that applies the error process to individual incidents.

The LE model (verbatim from SPEC, "Canonical linkage-error model (LE)"):

1. **Detachment (false non-matches, rate delta).**  For a true incident with
   support ``S = supp(h)``, each record independently detaches with probability
   ``delta``.  The non-detached records ``R subset S`` stay together as one
   cluster (if ``R`` is nonempty); each detached record forms its own singleton.
   In expectation::

       E[n~_g] = sum_{h >= g} t_h delta^{|h|-|g|} (1-delta)^{|g|}
                 + 1{g = e_k} * delta * sum_{h contains k} t_h ,

   a linear map ``D(delta)`` (:func:`detachment_matrix`), upper-triangular on
   the Boolean lattice with diagonal ``(1-delta)^{|h|}`` for ``|h| >= 2`` and 1
   for singletons, hence invertible for ``delta < 1``.

2. **Merging (false matches, rate eps).**  After step 1 each *singleton*
   cluster from list k independently merges with probability ``eps`` into a
   cluster ``B`` chosen uniformly at random among the clusters whose support
   excludes k (support becomes ``B u {k}``).  Merges are applied sequentially
   in random order; a cluster that already contains k is ineligible.  To first
   order in ``eps`` (the expectation used here), with ``M_k = sum_{B not-contains k,
   B != 0} n~_B``::

       e_k     loses   eps * n~_{e_k}
       B       loses   eps * n~_{e_k} * n~_B / M_k      (each B with k not in B)
       B u {k} gains   eps * n~_{e_k} * n~_B / M_k ,

   all terms evaluated at the step-1 table ``n~`` and summed over k.

Tables can be passed as dicts (``{history_tuple: count}``) or as bitmask-ordered
arrays of length ``2**K`` (see :mod:`darkfig.loglinear`); the output has the
same type as the input.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Mapping

import numpy as np

from .loglinear import array_to_table, popcount, table_to_array

__all__ = ["detachment_matrix", "expected_detached", "expected_observed", "simulate_observed"]


@lru_cache(maxsize=256)
def _detach_full(K: int, delta: float) -> np.ndarray:
    """``2**K x 2**K`` detachment matrix (row/col 0 = unobserved cell, all zero)."""
    n = 2**K
    pc = popcount(K)
    g = np.arange(n)[:, None]
    h = np.arange(n)[None, :]
    sub = ((g & ~h) == 0) & (g != 0)  # g subset of h, g nonempty
    gap = np.maximum(pc[None, :] - pc[:, None], 0)  # |h| - |g| on the lattice (0**0 == 1)
    D = np.where(sub, np.power(delta, gap) * np.power(1.0 - delta, pc[:, None]), 0.0)
    for k in range(K):
        ek = 1 << k
        D[ek, (np.arange(n) & ek) != 0] += delta
    D.setflags(write=False)
    return D


def detachment_matrix(K: int, delta: float) -> np.ndarray:
    """The detachment operator ``D(delta)`` of LE step 1 on the ``2**K - 1`` observable cells.

    Returns a ``(2**K - 1) x (2**K - 1)`` matrix; row/column ``i`` corresponds to
    the history with bitmask ``i + 1`` (see :func:`darkfig.loglinear.histories`),
    so ``E[n~] = D @ t`` for ``t = y[1:]``.  It is upper-triangular (``g subset h``
    implies ``mask(g) <= mask(h)``) with positive diagonal, hence invertible for
    ``0 <= delta < 1``.  Column h sums to ``1 - delta^{|h|} + |h| delta``, the
    expected number of clusters produced by one incident with history h: the
    main (non-detached) cluster survives with probability ``1 - delta^{|h|}``,
    plus ``|h| delta`` expected detached singletons.
    """
    if not (0.0 <= delta <= 1.0):
        raise ValueError("delta must be in [0, 1]")
    return np.array(_detach_full(int(K), float(delta))[1:, 1:])


def expected_detached(y: np.ndarray, K: int, delta: float) -> np.ndarray:
    """Step 1 only, on a bitmask-ordered array of length ``2**K`` (entry 0 ignored)."""
    out = _detach_full(int(K), float(delta)) @ np.asarray(y, dtype=float)
    out[0] = 0.0
    return out


def _merge_first_order(u: np.ndarray, K: int, eps: float) -> np.ndarray:
    """LE step 2 in expectation to first order in ``eps`` (array in, array out)."""
    out = u.copy()
    if eps == 0.0:
        return out
    masks = np.arange(2**K)
    for k in range(K):
        ek = 1 << k
        s = u[ek]
        if s <= 0.0:
            continue
        elig = masks[((masks & ek) == 0) & (masks != 0)]
        Mk = u[elig].sum()
        if Mk <= 0.0:
            continue
        moved = eps * s * u[elig] / Mk
        out[ek] -= eps * s
        out[elig] -= moved
        out[elig | ek] += moved
    return out


def _expected_observed_array(y: np.ndarray, K: int, delta: float, eps: float) -> np.ndarray:
    u = expected_detached(y, K, delta)
    return _merge_first_order(u, K, float(eps))


def expected_observed(t, delta: float, eps: float):
    """Expected observed table ``E[T(delta, eps) t]`` under the canonical LE model.

    Detachment is exact and linear (:func:`detachment_matrix`); merging is the
    first-order expectation of SPEC step 2.  This is the forward map inverted by
    :func:`darkfig.estimators.linkage_corrected` (Cor ``cor:linkcorrect``) and
    whose effect on MSE estimators is Thm ``thm:linkbias``.

    Parameters
    ----------
    t : dict or array
        True capture table (float counts allowed).
    delta, eps : float
        False-non-match and false-match rates, in ``[0, 1)``.

    Returns
    -------
    Same type as ``t`` (dict over all nonzero histories, or bitmask array).
    """
    if not (0.0 <= delta < 1.0) or not (0.0 <= eps <= 1.0):
        raise ValueError("need 0 <= delta < 1 and 0 <= eps <= 1")
    y, K = table_to_array(t)
    out = _expected_observed_array(y, K, delta, eps)
    if isinstance(t, Mapping):
        return array_to_table(out, K)
    return out


def simulate_observed(t, delta: float, eps: float, rng=None):
    """Monte Carlo realisation of the LE model applied to individual incidents.

    Builds ``t_h`` incidents with support ``h``, detaches each record
    independently with probability ``delta`` (detached records become
    singletons), then selects each singleton cluster independently with
    probability ``eps`` and processes the selected singletons sequentially in
    random order: a selected singleton from list k merges into a cluster drawn
    uniformly from the *current* clusters whose support excludes k.

    Second-order convention (not specified by SPEC; affects only O(eps^2) terms):
    a selected singleton that has itself been merged into earlier in the
    sequence (so it is no longer a singleton when its turn comes) does not
    merge again.

    Parameters
    ----------
    t : dict or array
        True table; counts must be (near-)integers.
    rng : numpy Generator, int seed, or None.

    Returns
    -------
    The observed table, same type as ``t`` (dict over all nonzero histories with
    integer-valued float counts, or a bitmask array).
    """
    rng = np.random.default_rng(rng)
    y, K = table_to_array(t)
    yi = np.rint(y).astype(np.int64)
    if np.any(np.abs(y - yi) > 1e-9):
        raise ValueError("simulate_observed needs integer counts")
    inc = np.repeat(np.arange(2**K), yi)  # support mask of each true incident
    bitv = 1 << np.arange(K)
    bits = (inc[:, None] & bitv[None, :]) != 0  # (n_inc, K)
    det = bits & (rng.random(bits.shape) < delta)
    kept = (bits & ~det) @ bitv  # support of the non-detached cluster (0 if all detached)
    detached = bitv[np.nonzero(det)[1]]  # one singleton per detached record
    clusters = np.concatenate([kept[kept > 0], detached]).astype(np.int64)
    # merging
    if eps > 0 and clusters.size:
        pc = popcount(K)
        single = np.flatnonzero(pc[clusters] == 1)
        sel = single[rng.random(single.size) < eps]
        alive = np.ones(clusters.size, dtype=bool)
        for i in rng.permutation(sel):
            ck = clusters[i]
            if pc[ck] != 1:  # absorbed by an earlier merge: no longer a singleton
                continue
            elig = np.flatnonzero(alive & ((clusters & ck) == 0))
            if elig.size == 0:
                continue
            j = elig[rng.integers(elig.size)]
            clusters[j] |= ck
            alive[i] = False
        clusters = clusters[alive]
    out = np.bincount(clusters, minlength=2**K).astype(float)
    out[0] = 0.0
    if isinstance(t, Mapping):
        return array_to_table(out, K)
    return out

