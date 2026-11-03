"""Capture-table utilities and Poisson log-linear machinery for multiple-systems estimation.

This module is the numerical back end of the log-linear estimators in
:mod:`darkfig.estimators` (Thm ``thm:closed``, Cor ``cor:bounds`` and the
model-averaged log-linear estimator of the simulation study, ``sec:simulation``).

Conventions
-----------
* A *capture table* is a ``dict`` mapping a capture history ``h = (h_1, ..., h_K)``
  (a tuple of 0/1 of length K) to its count ``n_h``.  Counts may be floats.
  Missing histories have count 0.  The all-zero history is unobservable; if it is
  present in a dict it is **ignored** (it is never used by any estimator).
* Internally a table is a length ``2**K`` float array indexed by the *bitmask*
  ``mask(h) = sum_k h_k * 2**(k-1)`` (list 1 is the least-significant bit), so
  history ``(1,0,0,0)`` is index 1, ``(0,1,0,0)`` is index 2, ``(1,1,0,0)`` is
  index 3, ...  Entry 0 (the unobserved cell n_0) is always set to 0 by
  :func:`table_to_array`.  With this ordering ``g subset-of h`` implies
  ``mask(g) <= mask(h)``.
* Log-linear parameterisation (SPEC notation): ``log mu_h = sum_{S subset supp(h)} u_S``,
  with ``u_{} `` the intercept, so ``mu_0 = exp(u_{})``.  Design columns are the
  0/1 indicators ``prod_{k in S} h_k``.
"""

from __future__ import annotations

import itertools
from functools import lru_cache
from typing import Iterable, Mapping, Sequence

import numpy as np

__all__ = [
    "histories",
    "popcount",
    "table_to_array",
    "array_to_table",
    "collapse",
    "frequency_counts",
    "interaction_terms",
    "design_matrix",
    "hierarchical_models",
    "irls_poisson",
    "irls_poisson_batch",
    "closed_form_log_n0",
]


# --------------------------------------------------------------------------
# Capture-table utilities
# --------------------------------------------------------------------------
@lru_cache(maxsize=None)
def _histories(K: int) -> np.ndarray:
    m = np.arange(2**K)
    H = ((m[:, None] >> np.arange(K)[None, :]) & 1).astype(np.int64)
    H.setflags(write=False)
    return H


def histories(K: int) -> np.ndarray:
    """Return the ``(2**K, K)`` 0/1 matrix of capture histories in bitmask order.

    Row ``m`` is the history with bitmask ``m``; row 0 is the all-zero history.
    """
    return _histories(int(K))


@lru_cache(maxsize=None)
def _popcount(K: int) -> np.ndarray:
    pc = _histories(K).sum(axis=1)
    pc.setflags(write=False)
    return pc


def popcount(K: int) -> np.ndarray:
    """``|h|`` (number of lists) for every bitmask ``0 .. 2**K - 1``."""
    return _popcount(int(K))


def table_to_array(table, K: int | None = None) -> tuple[np.ndarray, int]:
    """Convert a capture table to a float array of length ``2**K`` (bitmask order).

    Parameters
    ----------
    table : dict[tuple[int, ...], float] or array-like
        Either a dict over capture histories, or an array of length ``2**K``
        already in bitmask order (entry 0 is ignored and set to 0).
    K : int, optional
        Number of lists.  Inferred from the keys (dict) or the length (array).

    Returns
    -------
    (y, K) : (np.ndarray, int)
        ``y[0] == 0``; ``y[mask]`` is the count of the history with that bitmask.
    """
    if isinstance(table, Mapping):
        if len(table) == 0:
            if K is None:
                raise ValueError("empty capture table: cannot infer K")
            return np.zeros(2**K), int(K)
        keys = list(table.keys())
        lens = {len(k) for k in keys}
        if len(lens) != 1:
            raise ValueError(f"capture histories have inconsistent lengths {sorted(lens)}")
        Kt = lens.pop()
        if K is not None and K != Kt:
            raise ValueError(f"K={K} but histories have length {Kt}")
        K = Kt
        if K < 1:
            raise ValueError("histories must have length K >= 1")
        y = np.zeros(2**K)
        w = 1 << np.arange(K)
        for h, v in table.items():
            hh = np.asarray(h, dtype=np.int64)
            if np.any((hh != 0) & (hh != 1)):
                raise ValueError(f"capture history {h!r} is not 0/1")
            m = int(hh @ w)
            y[m] += float(v)
        y[0] = 0.0
    else:
        y = np.array(table, dtype=float).reshape(-1)
        n = y.size
        Kt = int(round(np.log2(n))) if n > 0 else -1
        if n < 2 or 2**Kt != n:
            raise ValueError(f"array table must have length 2**K, got {n}")
        if K is not None and K != Kt:
            raise ValueError(f"K={K} but array has length {n}")
        K = Kt
        y[0] = 0.0
    if not np.all(np.isfinite(y)):
        raise ValueError("capture table contains non-finite counts")
    if np.any(y < 0):
        raise ValueError("capture table contains negative counts")
    return y, int(K)


def array_to_table(y: np.ndarray, K: int | None = None, drop_zeros: bool = False) -> dict:
    """Inverse of :func:`table_to_array`: a dict over all ``2**K - 1`` nonzero histories.

    Values are Python floats.  ``drop_zeros=True`` omits histories with count 0.
    """
    y = np.asarray(y, dtype=float).reshape(-1)
    if K is None:
        K = int(round(np.log2(y.size)))
    H = histories(K)
    out = {}
    for m in range(1, 2**K):
        v = float(y[m])
        if drop_zeros and v == 0.0:
            continue
        out[tuple(int(x) for x in H[m])] = v
    return out


def collapse(table, lists: Sequence[int]) -> tuple[np.ndarray, int]:
    """Marginalise a table onto a subset of lists (0-based indices, in the given order).

    Returns ``(y_sub, len(lists))`` in bitmask order of the sub-table; units seen
    only by the dropped lists fall into the (ignored) zero cell of the sub-table
    and are discarded.
    """
    y, K = table_to_array(table)
    lists = [int(k) for k in lists]
    if len(set(lists)) != len(lists) or any(k < 0 or k >= K for k in lists):
        raise ValueError(f"invalid list indices {lists} for K={K}")
    H = histories(K)
    sub = (H[:, lists] * (1 << np.arange(len(lists)))[None, :]).sum(axis=1)
    out = np.bincount(sub, weights=y, minlength=2 ** len(lists)).astype(float)
    out[0] = 0.0
    return out, len(lists)


def frequency_counts(table) -> np.ndarray:
    """Frequency counts ``f_j`` = number of units captured by exactly ``j`` lists, j = 0..K.

    ``f_0`` is returned as 0 (unobserved).
    """
    y, K = table_to_array(table)
    return np.bincount(popcount(K), weights=y, minlength=K + 1).astype(float)


# --------------------------------------------------------------------------
# Log-linear design
# --------------------------------------------------------------------------
def interaction_terms(K: int, max_order: int) -> list[tuple[int, ...]]:
    """All interaction terms ``S`` with ``2 <= |S| <= max_order`` (sorted by order, then lexicographically)."""
    out: list[tuple[int, ...]] = []
    for r in range(2, max_order + 1):
        out.extend(itertools.combinations(range(K), r))
    return out


def design_matrix(K: int, terms: Iterable[Sequence[int]] = ()) -> tuple[np.ndarray, list[tuple[int, ...]]]:
    """Log-linear design over all ``2**K`` histories (row 0 = unobserved cell).

    Columns: intercept ``u_{}``, main effects ``u_k`` (k = 0..K-1), then the given
    interaction terms ``u_S`` in the order supplied.  Entry ``[h, S] = prod_{k in S} h_k``.

    Returns ``(X, columns)`` where ``columns`` lists the term of each column
    (``()`` for the intercept, ``(k,)`` for main effects).
    """
    H = histories(K)
    cols: list[tuple[int, ...]] = [()] + [(k,) for k in range(K)]
    for S in terms:
        S = tuple(sorted(int(k) for k in S))
        if len(S) < 2:
            raise ValueError(f"interaction term {S} must involve >= 2 lists")
        if S in cols:
            raise ValueError(f"duplicate term {S}")
        cols.append(S)
    X = np.ones((2**K, len(cols)))
    for j, S in enumerate(cols):
        if S:
            X[:, j] = np.prod(H[:, list(S)], axis=1)
    return X, cols


def hierarchical_models(K: int, max_order: int = 2) -> list[tuple[tuple[int, ...], ...]]:
    """Enumerate all hierarchical log-linear models with interactions up to ``max_order``.

    Main effects are always included.  A model is returned as a tuple of its
    interaction terms (each a sorted tuple of 0-based list indices).  A term of
    order ``r >= 3`` is allowed only if all its ``(r-1)``-order sub-terms are in
    the model (hierarchy).  ``max_order`` must be ``<= K - 1``: the K-way term is
    not identifiable from the ``2**K - 1`` observed cells (Thm ``thm:nonid``).

    For K = 4, max_order = 2 this gives the ``2**6 = 64`` models of the paper.
    """
    if not (1 <= max_order <= K - 1):
        raise ValueError(f"max_order must be in [1, K-1] = [1, {K-1}], got {max_order}")
    models: list[tuple[tuple[int, ...], ...]] = []

    def extend(current: tuple[tuple[int, ...], ...], order: int) -> None:
        if order > max_order:
            models.append(current)
            return
        cur = set(current)
        allowed = [
            S
            for S in itertools.combinations(range(K), order)
            if order == 2 or all(sub in cur for sub in itertools.combinations(S, order - 1))
        ]
        for r in range(len(allowed) + 1):
            for chosen in itertools.combinations(allowed, r):
                extend(current + tuple(chosen), order + 1)

    extend((), 2)
    return models


# --------------------------------------------------------------------------
# Poisson IRLS (batched over models sharing one full design)
# --------------------------------------------------------------------------
def _poisson_deviance(y: np.ndarray, mu: np.ndarray) -> np.ndarray:
    """Poisson deviance ``2 sum [y log(y/mu) - (y - mu)]`` along the last axis (``0 log 0 = 0``)."""
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        ylogy = np.where(y > 0, y * np.log(np.where(y > 0, y, 1.0) / mu), 0.0)
        d = 2.0 * np.sum(ylogy - (y - mu), axis=-1)
    return np.where(np.isfinite(d), d, np.inf)


def irls_poisson_batch(
    y: np.ndarray,
    X: np.ndarray,
    masks: np.ndarray | None = None,
    offset: np.ndarray | None = None,
    max_iter: int = 100,
    tol: float = 1e-10,
    beta_tol: float = 1e-8,
    weight_floor: float = 1e-10,
) -> dict:
    """Fit ``M`` Poisson GLMs with log link by IRLS, one per row of ``masks``.

    All models share the full design ``X`` (``C x P``); model ``m`` uses the
    columns where ``masks[m]`` is True (excluded coefficients are fixed at 0).

    Numerical safeguards: start at ``mu = y + 0.1`` (as R's ``glm``), Fisher
    weights floored at ``weight_floor``, step-halving whenever the deviance
    increases or becomes non-finite, and a linear predictor clipped to
    ``[-700, 700]``.  A model is *converged* when both the relative deviance change
    is below ``tol`` and ``max |beta_new - beta_old| < beta_tol``.  The second
    condition matters: when the Poisson MLE does not exist (zero cells on the
    boundary) the deviance converges while some coefficients drift to
    ``+-infinity``; such fits are reported as ``converged=False``.

    Returns
    -------
    dict with arrays ``beta (M, P)``, ``mu (M, C)``, ``deviance (M,)``,
    ``cov (M, P, P)`` (inverse Fisher information, zero rows/cols for excluded
    terms), ``converged (M,)``, ``n_iter``, ``n_params (M,)``.
    """
    y = np.asarray(y, dtype=float)
    X = np.asarray(X, dtype=float)
    C, P = X.shape
    if masks is None:
        masks = np.ones((1, P), dtype=bool)
    masks = np.asarray(masks, dtype=bool)
    M = masks.shape[0]
    off = np.zeros(C) if offset is None else np.asarray(offset, dtype=float)
    eye = np.eye(P)
    mask2 = masks[:, :, None] & masks[:, None, :]

    def wls(mu, eta):
        w = np.maximum(mu, weight_floor)
        z = eta - off + (y - mu) / w
        XtW = X.T[None, :, :] * w[:, None, :]  # (M, P, C)
        A = XtW @ X  # (M, P, P)
        b = np.einsum("mpc,mc->mp", XtW, z)
        A = np.where(mask2, A, eye[None])
        b = np.where(masks, b, 0.0)
        try:
            beta = np.linalg.solve(A, b[..., None])[..., 0]
        except np.linalg.LinAlgError:
            beta = np.stack([np.linalg.lstsq(A[i], b[i], rcond=None)[0] for i in range(M)])
        return beta, A

    def predict(beta):
        eta = np.clip(beta @ X.T + off, -700.0, 700.0)
        return eta, np.exp(eta)

    mu = np.broadcast_to(y + 0.1, (M, C)).copy()
    eta = np.log(mu)
    beta, _ = wls(mu, eta)
    eta, mu = predict(beta)
    dev = _poisson_deviance(y, mu)
    converged = np.zeros(M, dtype=bool)
    it = 0
    for it in range(1, max_iter + 1):
        active = ~converged
        beta_new, _ = wls(mu, eta)
        beta_new[~active] = beta[~active]
        eta_new, mu_new = predict(beta_new)
        dev_new = _poisson_deviance(y, mu_new)
        # step halving for models whose deviance went up
        bad = active & ~(dev_new <= dev * (1 + 1e-12) + 1e-12)
        h = 0
        while bad.any() and h < 30:
            beta_new[bad] = 0.5 * (beta_new[bad] + beta[bad])
            eta_new[bad], mu_new[bad] = predict(beta_new[bad])
            dev_new[bad] = _poisson_deviance(y, mu_new[bad])
            bad = bad & ~(dev_new <= dev * (1 + 1e-12) + 1e-12)
            h += 1
        dbeta = np.max(np.abs(beta_new - beta), axis=1)
        ddev = np.abs(dev_new - dev) / (np.abs(dev_new) + 0.1)
        beta, eta, mu, dev = beta_new, eta_new, mu_new, dev_new
        converged = converged | (active & (ddev < tol) & (dbeta < beta_tol))
        if converged.all():
            break

    # Fisher information at the final estimate
    w = np.maximum(mu, weight_floor)
    A = (X.T[None, :, :] * w[:, None, :]) @ X
    A = np.where(mask2, A, eye[None])
    try:
        cov = np.linalg.inv(A)
    except np.linalg.LinAlgError:
        cov = np.stack([np.linalg.pinv(A[i]) for i in range(M)])
    cov = np.where(mask2, cov, 0.0)
    return {
        "beta": beta,
        "mu": mu,
        "deviance": dev,
        "cov": cov,
        "converged": converged & np.all(np.isfinite(beta), axis=1),
        "n_iter": it,
        "n_params": masks.sum(axis=1),
    }


def irls_poisson(y, X, offset=None, **kw) -> dict:
    """Single-model Poisson log-link IRLS (thin wrapper around :func:`irls_poisson_batch`).

    Returns ``beta (P,)``, ``mu (C,)``, ``deviance``, ``cov (P, P)``, ``converged``, ``n_iter``.
    """
    X = np.asarray(X, dtype=float)
    r = irls_poisson_batch(y, X, np.ones((1, X.shape[1]), dtype=bool), offset=offset, **kw)
    return {
        "beta": r["beta"][0],
        "mu": r["mu"][0],
        "deviance": float(r["deviance"][0]),
        "cov": r["cov"][0],
        "converged": bool(r["converged"][0]),
        "n_iter": r["n_iter"],
    }


# --------------------------------------------------------------------------
# Closed form (Thm thm:closed)
# --------------------------------------------------------------------------
def closed_form_log_n0(y: np.ndarray, K: int, omega: float = 0.0) -> float:
    """``log n0_hat(omega) = (-1)^K omega + sum_{h != 0} (-1)^{|h|+1} log n_h`` (Thm ``thm:closed``).

    ``y`` is a bitmask-ordered array; cells must be strictly positive.
    """
    pc = popcount(K)[1:]
    sign = np.where(pc % 2 == 1, 1.0, -1.0)
    with np.errstate(divide="ignore"):
        logs = np.log(np.asarray(y, dtype=float)[1:])
    return float((-1) ** K * omega + np.sum(sign * logs))
