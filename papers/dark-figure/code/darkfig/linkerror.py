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

__all__ = ["detachment_matrix", "expected_detached", "expected_observed", "simulate_observed",
           "simulate_records", "observed_covariance", "jacobian_expected_observed", "simulate_audit"]


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
    return simulate_records(t, delta, eps, rng)["table_out"](t)


def simulate_records(t, delta: float, eps: float, rng=None) -> dict:
    """Record-level version of :func:`simulate_observed` (same random stream, same table).

    Returns a dict with, for every record (one per (incident, list) capture, in
    incident-major order), its true incident ``true_id``, its list ``list_id`` and
    its observed cluster ``labels``; ``table`` (bitmask array of the observed
    table) and ``table_out`` (a function returning the table in the type of its
    argument). Used to simulate a clerical audit from LE ground truth.
    """
    rng = np.random.default_rng(rng)
    y, K = table_to_array(t)
    yi = np.rint(y).astype(np.int64)
    if np.any(np.abs(y - yi) > 1e-9):
        raise ValueError("simulate_observed needs integer counts")
    yi[0] = 0
    inc = np.repeat(np.arange(2**K), yi)  # support mask of each true incident
    bitv = 1 << np.arange(K)
    bits = (inc[:, None] & bitv[None, :]) != 0  # (n_inc, K)
    det = bits & (rng.random(bits.shape) < delta)
    kept = (bits & ~det) @ bitv  # support of the non-detached cluster (0 if all detached)
    det_rows, det_cols = np.nonzero(det)
    detached = bitv[det_cols]  # one singleton per detached record
    kept_inc = np.flatnonzero(kept > 0)
    clusters = np.concatenate([kept[kept_inc], detached]).astype(np.int64)
    # records (incident-major) and their initial cluster index
    rec_inc, rec_list = np.nonzero(bits)
    cl_of_kept = -np.ones(len(inc), dtype=np.int64)
    cl_of_kept[kept_inc] = np.arange(len(kept_inc))
    rec_cl = cl_of_kept[rec_inc].copy()
    det_rec = det[rec_inc, rec_list]
    # detached records map to singleton clusters in np.nonzero(det) order = incident-major order
    rec_cl[det_rec] = len(kept_inc) + np.arange(int(det_rec.sum()))
    # merging
    if eps > 0 and clusters.size:
        pc = popcount(K)
        single = np.flatnonzero(pc[clusters] == 1)
        sel = single[rng.random(single.size) < eps]
        alive = np.ones(clusters.size, dtype=bool)
        parent = np.arange(clusters.size)
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
            parent[i] = j
        # resolve chains of absorption (a singleton j that absorbed i may itself be absorbed later)
        root = parent.copy()
        for _ in range(clusters.size):
            nxt = parent[root]
            if np.array_equal(nxt, root):
                break
            root = nxt
        rec_cl = root[rec_cl]
        clusters = clusters[alive]
    out = np.bincount(clusters, minlength=2**K).astype(float)
    out[0] = 0.0

    def table_out(like):
        if isinstance(like, Mapping):
            return array_to_table(out, K)
        return out.copy()

    return dict(true_id=rec_inc.astype(np.int64), list_id=rec_list.astype(np.int64),
                labels=rec_cl.astype(np.int64), table=out, table_out=table_out, K=K)


# ---------------------------------------------------------------------------
# Sampling covariance of the observed table given the true table (linkage variance)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=128)
def _detach_cov_blocks(K: int, delta: float) -> np.ndarray:
    """``C[h] = Cov(Z_h)`` (full ``2**K x 2**K`` blocks): the cluster vector of one detached incident.

    ``Z_h = e_S 1{S != 0} + sum_{k in h minus S} e_{k}`` with S keeping each k in h
    independently with probability ``1 - delta`` (Cor cor:linkcorrect(i)); computed
    exactly by enumerating the ``2**|h|`` outcomes.
    """
    n = 2**K
    C = np.zeros((n, n, n))
    for h in range(1, n):
        ks = [k for k in range(K) if (h >> k) & 1]
        EZ = np.zeros(n)
        EZZ = np.zeros((n, n))
        for sub in range(2 ** len(ks)):
            S = 0
            prob = 1.0
            z = np.zeros(n)
            for idx, k in enumerate(ks):
                if (sub >> idx) & 1:
                    S |= 1 << k
                    prob *= 1.0 - delta
                else:
                    z[1 << k] += 1.0
                    prob *= delta
            if S:
                z[S] += 1.0
            EZ += prob * z
            EZZ += prob * np.outer(z, z)
        C[h] = EZZ - np.outer(EZ, EZ)
    C.setflags(write=False)
    return C


def _merge_cov(u: np.ndarray, K: int, eps: float) -> np.ndarray:
    """First-order covariance added by LE step 2 given the post-detachment table ``u``.

    Each list-k singleton independently merges (probability ``eps``) into a cluster B
    drawn with probability ``u_B / M_k``, changing the table by
    ``-e_{k} - e_B + e_{B u k}``; merges are treated as independent (O(eps^2) terms dropped).
    """
    n = 2**K
    Cm = np.zeros((n, n))
    if eps <= 0.0:
        return Cm
    masks = np.arange(n)
    for k in range(K):
        ek = 1 << k
        s = u[ek]
        if s <= 0.0:
            continue
        elig = masks[((masks & ek) == 0) & (masks != 0)]
        Mk = u[elig].sum()
        if Mk <= 0.0:
            continue
        p = eps * np.maximum(u[elig], 0.0) / Mk
        V = np.zeros((len(elig), n))
        rows = np.arange(len(elig))
        V[:, ek] -= 1.0
        V[rows, elig] -= 1.0
        V[rows, elig | ek] += 1.0
        EX = p @ V
        EXX = V.T @ (p[:, None] * V)
        Cm += s * (EXX - np.outer(EX, EX))
    return Cm


def _merge_jacobian(u: np.ndarray, K: int, eps: float) -> np.ndarray:
    """Jacobian of the first-order merge map at ``u`` (central differences; the map is rational)."""
    n = 2**K
    J = np.eye(n)
    if eps <= 0.0:
        return J
    for i in range(1, n):
        h = max(1e-4, 1e-6 * abs(u[i]))
        up, um = u.copy(), u.copy()
        up[i] += h
        um[i] -= h
        J[:, i] = (_merge_first_order(up, K, eps) - _merge_first_order(um, K, eps)) / (2 * h)
    J[0, :] = 0.0
    J[:, 0] = 0.0
    return J


def jacobian_expected_observed(t, delta: float, eps: float) -> np.ndarray:
    """``d E[T(delta, eps) t] / d t`` on the ``2**K - 1`` observable cells (bitmask order)."""
    y, K = table_to_array(t)
    u = expected_detached(y, K, delta)
    Jm = _merge_jacobian(u, K, float(eps))
    D = _detach_full(int(K), float(delta))
    return (Jm @ D)[1:, 1:]


def observed_covariance(t, delta: float, eps: float) -> np.ndarray:
    """``Cov(n~ | t)`` under LE on the ``2**K - 1`` observable cells (bitmask order).

    Detachment part exact: ``sum_h t_h Cov(Z_h)`` (incidents detach independently);
    it is propagated through the Jacobian of the first-order merge map, and the
    first-order merge covariance (:func:`_merge_cov`) is added. This is the
    ``Var`` in ``v_link`` of Cor cor:linkcorrect(i), extended to eps > 0 to first order.
    """
    y, K = table_to_array(t)
    y = np.maximum(np.asarray(y, float), 0.0)
    C = _detach_cov_blocks(int(K), float(delta))
    Sd = np.tensordot(y[1:], C[1:], axes=1)
    if eps <= 0.0:
        return Sd[1:, 1:]
    u = expected_detached(y, K, delta)
    Jm = _merge_jacobian(u, K, float(eps))
    S = Jm @ Sd @ Jm.T + _merge_cov(u, K, float(eps))
    return S[1:, 1:]


# ---------------------------------------------------------------------------
# A random clerical audit simulated from LE ground truth (scenario S8)
# ---------------------------------------------------------------------------
def simulate_audit(sim: dict, n_records: int, n_edges: int, rng) -> dict:
    """Random audit of an LE-model linkage (record sample for delta, linked-edge sample for eps).

    * delta: a simple random sample (without replacement) of ``n_records``
      records; the reviewer finds each sampled record's true counterparts in the
      other lists (x_r of them) and how many of those share its cluster (y_r).
      The ratio estimator ``R = sum y / sum x`` estimates the pairwise recall over
      ALL true pairs (the LE frame), ``delta_hat = 1 - sqrt(R)``.
    * eps: a simple random sample of ``n_edges`` of the ``E = sum_c (|c| - 1)``
      linked spanning-forest edges; the false fraction gives ``FE_hat`` and
      ``eps_hat = FE_hat / (f1 + FE_hat)`` (f1 = observed singleton clusters), as
      in Prop. prop:link-audit / eq. link-psi.
    Standard errors: ratio-estimator and binomial (with finite-population
    correction) variances and the delta method. Returns the realised targets on
    the same frames too (``delta_true``, ``eps_true``).
    """
    lab, tid = np.asarray(sim["labels"]), np.asarray(sim["true_id"])
    n = len(lab)
    # per record: true counterparts and how many are in the same cluster
    _, inc_inv, inc_cnt = np.unique(tid, return_inverse=True, return_counts=True)
    x = inc_cnt[inc_inv] - 1
    key = tid * (lab.max() + 1) + lab
    _, k_inv, k_cnt = np.unique(key, return_inverse=True, return_counts=True)
    yv = k_cnt[k_inv] - 1
    R_true = yv.sum() / x.sum() if x.sum() else 1.0
    # linked edges: per cluster (|c| - 1) edges, of which (#incidents in c - 1) are false
    _, c_cnt = np.unique(lab, return_counts=True)
    E = int((c_cnt - 1).sum())
    first = np.unique(key, return_index=True)[1]          # one record per (incident, cluster)
    n_inc_in_cl = np.bincount(lab[first], minlength=lab.max() + 1)
    FE_true = int((n_inc_in_cl[n_inc_in_cl > 0] - 1).sum())
    f1 = int((c_cnt == 1).sum())
    # --- record sample
    nr = int(min(n_records, n))
    pick = rng.choice(n, size=nr, replace=False)
    xs, ys = x[pick].astype(float), yv[pick].astype(float)
    if xs.sum() > 0:
        R = ys.sum() / xs.sum()
        d = ys - R * xs
        var_R = (1 - nr / n) * d.var(ddof=1) / (nr * xs.mean() ** 2) if nr > 1 else float("nan")
    else:
        R, var_R = 1.0, float("nan")
    R = min(max(R, 0.0), 1.0)
    delta_hat = 1.0 - np.sqrt(R)
    se_delta = float(np.sqrt(var_R) / (2 * np.sqrt(R))) if R > 0 and np.isfinite(var_R) else float("nan")
    # --- edge sample
    ne = int(min(n_edges, E))
    if ne > 0:
        n_false_sample = int(rng.hypergeometric(FE_true, E - FE_true, ne))
        ph = n_false_sample / ne
        FE = E * ph
        var_FE = E ** 2 * (1 - ne / E) * (ph * (1 - ph) * ne / (ne - 1)) / ne if ne > 1 else 0.0
    else:
        FE, var_FE, n_false_sample = 0.0, 0.0, 0
    eps_hat = FE / (f1 + FE) if f1 + FE > 0 else 0.0
    se_eps = float(np.sqrt(var_FE) * f1 / (f1 + FE) ** 2) if f1 + FE > 0 else float("nan")
    return dict(delta_hat=float(delta_hat), eps_hat=float(eps_hat), se_delta=se_delta, se_eps=se_eps,
                recall_hat=float(R), FE_hat=float(FE), n_records=nr, n_edges=ne, n_false_in_sample=n_false_sample,
                delta_true=float(1.0 - np.sqrt(R_true)), eps_true=float(FE_true / (f1 + FE_true)) if f1 + FE_true else 0.0,
                recall_true=float(R_true), FE_true=FE_true, E=E, f1=f1)
