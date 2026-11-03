"""Exact log-likelihood, intensity and compensator for multivariate
exponential-kernel Hawkes processes with exogenous shocks (Ogata 1981).

    log L = sum_k sum_{i} log lambda_k(t_i^k) - sum_k Lambda_k(T),
    Lambda_k(T) = int_0^T mu_k + sum_e shock_beta_k S_e [Psi_k(T - tau_e) - Psi_k(-tau_e)]
                + sum_j alpha_kj sum_l (1 - exp(-beta_kj (T - t_l^j))).

The excitation sums ``S_kj(t) = sum_{t_l^j < t} exp(-beta_kj (t - t_l^j))`` are
computed for all target times at once by :class:`DecaySums`. It is the O(n)
recursion of Ogata (1981), vectorised: source events are cut into chunks of
``beta * (time span) <= 200``; inside a chunk the recursion is a scaled cumulative
sum, and a short Python loop over the chunks carries the state. This is exact up
to floating-point rounding (relative error ~1e-13). There is no truncation
window.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np

from .model import HawkesSpec

__all__ = [
    "DecaySums",
    "loglik",
    "intensity",
    "compensator",
    "check_events",
    "shock_kernel_matrix",
    "shock_cumulative_matrix",
]

_CHUNK = 200.0


class DecaySums:
    """Exponential decay sums over a sorted source sequence ``src``::

        S(t) = sum_{s in src, s < t} exp(-b (t - s))
        D(t) = sum_{s in src, s < t} (t - s) exp(-b (t - s))     (if lag=True)

    ``D`` is the lag-weighted sum, used for the EM update of beta.
    Construct once per (source stream, rate). Evaluating at targets costs
    O(n_targets).
    """

    def __init__(self, src: np.ndarray, b: float, lag: bool = False):
        src = np.asarray(src, dtype=float)
        self.src = src
        self.b = float(b)
        self.lag = bool(lag)
        n = src.size
        self.n = n
        if n == 0:
            return
        b = self.b
        rel = b * (src - src[0])
        cid = np.floor(rel / _CHUNK).astype(np.int64)
        starts = np.flatnonzero(np.r_[True, cid[1:] != cid[:-1]])
        ends = np.r_[starts[1:], n]
        nC = starts.size
        anchors = src[0] + cid[starts] * (_CHUNK / b)
        w = np.exp(rel - cid * _CHUNK)  # in [1, e^200)
        chunk_of = np.repeat(np.arange(nC), ends - starts)
        cw = np.empty(n)
        cwu = np.empty(n) if lag else None
        Sc = np.zeros(nC)
        Dc = np.zeros(nC) if lag else None
        for c in range(nC):
            a, e = starts[c], ends[c]
            cw[a:e] = np.cumsum(w[a:e])
            if lag:
                cwu[a:e] = np.cumsum(w[a:e] * (src[a:e] - anchors[c]))
            if c + 1 < nC:
                gap = anchors[c + 1] - anchors[c]
                dec = np.exp(-b * gap)
                tot = cw[e - 1]
                Sc[c + 1] = dec * (Sc[c] + tot)
                if lag:
                    Dc[c + 1] = dec * (Dc[c] + gap * Sc[c] + gap * tot - cwu[e - 1])
        self._anchors = anchors
        self._chunk_of = chunk_of
        self._cw = cw
        self._cwu = cwu
        self._Sc = Sc
        self._Dc = Dc

    def index(self, tgt: np.ndarray) -> np.ndarray:
        """Number of source events strictly before each target."""
        return np.searchsorted(self.src, tgt, side="left")

    def __call__(self, tgt, idx=None):
        """Return S(tgt) (and D(tgt) if ``lag``); targets need not be sorted."""
        tgt = np.atleast_1d(np.asarray(tgt, dtype=float))
        S = np.zeros(tgt.size)
        D = np.zeros(tgt.size) if self.lag else None
        if self.n == 0 or tgt.size == 0:
            return (S, D) if self.lag else S
        if idx is None:
            idx = self.index(tgt)
        has = idx > 0
        i = idx[has] - 1
        c = self._chunk_of[i]
        dt = tgt[has] - self._anchors[c]
        dec = np.exp(-self.b * dt)
        Sc = self._Sc[c]
        cw = self._cw[i]
        S[has] = dec * (Sc + cw)
        if self.lag:
            D[has] = dec * (self._Dc[c] + dt * Sc + dt * cw - self._cwu[i])
            return S, D
        return S


def check_events(events: Sequence, M: int | None = None, T: float | None = None) -> list[np.ndarray]:
    """Convert to a list of sorted float arrays and validate."""
    ev = [np.asarray(e, dtype=float).ravel() for e in events]
    if M is not None and len(ev) != M:
        raise ValueError(f"expected {M} event streams, got {len(ev)}")
    for k, e in enumerate(ev):
        if e.size and np.any(np.diff(e) < 0):
            ev[k] = e = np.sort(e)
        if T is not None and e.size and (e[0] < 0 or e[-1] > T):
            raise ValueError(f"stream {k}: events outside [0, T]")
    return ev


def shock_kernel_matrix(t: np.ndarray, tau: np.ndarray, S: np.ndarray, eta: float) -> np.ndarray:
    """(n, E) matrix S_e * eta * exp(-eta (t - tau_e)) 1{t > tau_e}."""
    d = t[:, None] - tau[None, :]
    pos = d > 0
    out = np.zeros_like(d)
    out[pos] = (S[None, :] * eta * np.exp(-eta * np.where(pos, d, 0.0)))[pos]
    return out


def shock_cumulative_matrix(t: np.ndarray, tau: np.ndarray, S: np.ndarray, eta: float) -> np.ndarray:
    """(n, E) matrix S_e * int_0^t psi(u - tau_e) du (psi = eta e^{-eta u} on u>0)."""
    def Psi(x):
        return -np.expm1(-eta * np.maximum(x, 0.0))

    return S[None, :] * (Psi(t[:, None] - tau[None, :]) - Psi(-tau)[None, :])


class _SumCache:
    def __init__(self, events, lag=False):
        self.events = events
        self.lag = lag
        self._c = {}

    def get(self, j, b) -> DecaySums:
        key = (j, float(b))
        if key not in self._c:
            self._c[key] = DecaySums(self.events[j], b, lag=self.lag)
        return self._c[key]


def _excitation(spec: HawkesSpec, events, t, cache=None, by_source=False):
    """Self-/cross-excitation at times t (strict past) for each target stream.
    Returns (n_t, M) or, with by_source, (n_t, M, M) [target k, source j]."""
    M = spec.M
    A, Bm = spec.alpha, spec.beta_matrix
    cache = cache or _SumCache(events)
    out = np.zeros((t.size, M, M))
    for j in range(M):
        if len(events[j]) == 0:
            continue
        for k in range(M):
            if A[k, j] > 0:
                out[:, k, j] = A[k, j] * Bm[k, j] * cache.get(j, Bm[k, j])(t)
    return out if by_source else out.sum(axis=2)


def intensity(spec: HawkesSpec, events, t) -> np.ndarray:
    """Conditional intensity lambda_k(t) (left limit: events at exactly t are
    excluded) at arbitrary times t (n,) -> (n, M)."""
    ev = check_events(events, spec.M)
    t = np.atleast_1d(np.asarray(t, dtype=float))
    lam = spec.mu_at(t) + _excitation(spec, ev, t)
    if spec.shocks:
        tau, S = spec.shock_times, spec.shock_sizes
        eta = spec.shock_rate_vec
        for k in range(spec.M):
            if spec.shock_beta[k] > 0:
                lam[:, k] += spec.shock_beta[k] * shock_kernel_matrix(t, tau, S, eta[k]).sum(axis=1)
    return lam


def compensator(spec: HawkesSpec, events, t) -> np.ndarray:
    """Compensator Lambda_k(t) = int_0^t lambda_k at times t >= 0 (n,) -> (n, M)."""
    ev = check_events(events, spec.M)
    t = np.atleast_1d(np.asarray(t, dtype=float))
    M = spec.M
    A, Bm = spec.alpha, spec.beta_matrix
    out = spec.mu_cumulative(t).copy()
    cache = _SumCache(ev)
    for j in range(M):
        if len(ev[j]) == 0:
            continue
        cnt = np.searchsorted(ev[j], t, side="left")
        for k in range(M):
            if A[k, j] > 0:
                out[:, k] += A[k, j] * (cnt - cache.get(j, Bm[k, j])(t, cnt))
    if spec.shocks:
        tau, S = spec.shock_times, spec.shock_sizes
        eta = spec.shock_rate_vec
        for k in range(M):
            if spec.shock_beta[k] > 0:
                out[:, k] += spec.shock_beta[k] * shock_cumulative_matrix(t, tau, S, eta[k]).sum(axis=1)
    return out


def total_compensator(spec: HawkesSpec, events, T: float) -> np.ndarray:
    """Lambda_k(T) (M,) computed with expm1 for accuracy."""
    ev = check_events(events, spec.M)
    M = spec.M
    A, Bm = spec.alpha, spec.beta_matrix
    out = spec.mu_cumulative(np.array([T]))[0].copy()
    for j in range(M):
        if len(ev[j]) == 0:
            continue
        for k in range(M):
            if A[k, j] > 0:
                out[k] += A[k, j] * np.sum(-np.expm1(-Bm[k, j] * (T - ev[j])))
    if spec.shocks:
        tau, S = spec.shock_times, spec.shock_sizes
        eta = spec.shock_rate_vec
        for k in range(M):
            if spec.shock_beta[k] > 0:
                out[k] += spec.shock_beta[k] * shock_cumulative_matrix(np.array([T]), tau, S, eta[k]).sum()
    return out


def loglik(spec: HawkesSpec, events, T: float, per_stream: bool = False):
    """Exact log-likelihood of ``events`` (list of M sorted arrays on [0, T]).

    Returns a float (or an (M,) array of per-stream terms with
    ``per_stream=True``). Returns -inf if some event has zero intensity.
    """
    ev = check_events(events, spec.M, T)
    M = spec.M
    cache = _SumCache(ev)
    tau, S = spec.shock_times, spec.shock_sizes
    eta = spec.shock_rate_vec
    Bm = spec.beta_matrix
    out = np.zeros(M)
    for k in range(M):
        tk = ev[k]
        if tk.size == 0:
            continue
        lam = spec.mu_at(tk)[:, k].copy()
        if spec.shocks and spec.shock_beta[k] > 0:
            lam += spec.shock_beta[k] * shock_kernel_matrix(tk, tau, S, eta[k]).sum(axis=1)
        for j in range(M):
            if spec.alpha[k, j] > 0 and len(ev[j]):
                b = Bm[k, j]
                lam += spec.alpha[k, j] * b * cache.get(j, b)(tk)
        if np.any(lam <= 0):
            out[k] = -np.inf
            continue
        out[k] = np.sum(np.log(lam))
    out -= total_compensator(spec, ev, T)
    return out if per_stream else float(out.sum())
