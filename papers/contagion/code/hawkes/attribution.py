"""Surge attribution (Thm thm:attribution, Prop prop:irf).

Split the expected count in stream k over the window (tau_e, tau_e + H] into
the contributions of each cluster root (Hawkes & Oakes 1974):

    E N_k(tau_e, tau_e + H] = B_k + O_k + D_k + C_k

* B_k (``background``): events whose cluster root is a background immigrant,
  including the endogenous cascades of background events;
* O_k (``other_shocks``): events rooted in other shocks e' != e;
* D_k (``direct``): direct responses to shock e (immigrants of shock e);
* C_k (``contagion``): all later generations descending from shock e's
  immigrants.

Exact computation for exponential kernels. The expected intensity m(u) of the
events rooted in shock e solves the linear Volterra equation
``m = s + Phi * m``, with immigrant intensity
``s_k(u) = shock_beta_k S_e eta_k e^{-eta_k u}``. For exponential kernels the
states

    x_kj(u) = int_0^u alpha_kj beta_kj e^{-beta_kj (u - v)} m_j(v) dv

satisfy the finite linear ODE system

    s_k'  = -eta_k s_k,
    x_kj' = -beta_kj x_kj + alpha_kj beta_kj (s_j + sum_l x_jl),
    D_k'  = s_k,          C_k' = sum_j x_kj,

so z(u) = expm(L u) z(0), computed with scipy.linalg.expm. The background
part has the same structure with forcing mu(t) from time 0. It is solved by
expm for constant and piecewise-constant mu, and by a high-accuracy ODE solver
(DOP853, rtol 1e-10) for other backgrounds. "background='stationary'" uses
H (I - A)^{-1} mu_bar instead.

Infinite-horizon totals:
``D_inf = shock_beta S_e``, ``(D + C)_inf = (I - A)^{-1} D_inf``.

Spillover (counterfactual). The contagion attributable to paths through stream j
is ``total - total(A with column j zeroed)``. For one channel, e.g.
online -> offline, use the entry (k, j). The direct response is unchanged, so
the difference is pure contagion.
"""

from __future__ import annotations

import numpy as np
from scipy.integrate import solve_ivp
from scipy.linalg import expm

from .model import HawkesSpec, PiecewiseConstant, multiplier

__all__ = [
    "decompose_surge",
    "impulse_response",
    "expected_counts",
    "shock_response_counts",
    "spillover",
]


def _shock_generator(A, Bm, eta):
    """Generator of z = [s (M), x (M*M, row-major k,j), D (M), C (M)]."""
    M = A.shape[0]
    nx = M * M
    Dm = M + nx + 2 * M
    L = np.zeros((Dm, Dm))
    iS = np.arange(M)
    iX = M + np.arange(nx).reshape(M, M)
    iD = M + nx + np.arange(M)
    iC = M + nx + M + np.arange(M)
    L[iS, iS] = -eta
    L[iD, iS] = 1.0
    for k in range(M):
        for j in range(M):
            r = iX[k, j]
            L[r, r] -= Bm[k, j]
            c = A[k, j] * Bm[k, j]
            if c:
                L[r, iS[j]] += c
                L[r, iX[j, :]] += c
            L[iC[k], r] += 1.0
    return L, iS, iX, iD, iC


def shock_response_counts(spec: HawkesSpec, s0, u, A=None) -> tuple[np.ndarray, np.ndarray]:
    """Cumulative expected (direct, contagion) counts by stream, from time 0 to
    each u, for an immigrant intensity starting at ``s0`` (M,) and decaying at
    eta. Returns two (len(u), M) arrays."""
    A = spec.alpha if A is None else np.asarray(A, float)
    M = spec.M
    L, iS, iX, iD, iC = _shock_generator(A, spec.beta_matrix, spec.shock_rate_vec)
    z0 = np.zeros(L.shape[0])
    z0[iS] = s0
    u = np.atleast_1d(np.asarray(u, float))
    D = np.zeros((u.size, M))
    C = np.zeros((u.size, M))
    for i, ui in enumerate(u):
        if ui <= 0:
            continue
        z = expm(L * ui) @ z0
        D[i] = z[iD]
        C[i] = z[iC]
    return D, C


def _shock_start(spec, e):
    tau, S = spec.shocks[e]
    start = max(tau, 0.0)
    eta = spec.shock_rate_vec
    s0 = spec.shock_beta * S * eta * np.exp(-eta * (start - tau))
    return start, s0


def _bg_generator(A, Bm, mu):
    """Generator of z = [1, x (M*M), Cb (M)] with constant forcing mu."""
    M = A.shape[0]
    nx = M * M
    Dm = 1 + nx + M
    L = np.zeros((Dm, Dm))
    iX = 1 + np.arange(nx).reshape(M, M)
    iB = 1 + nx + np.arange(M)
    for k in range(M):
        for j in range(M):
            r = iX[k, j]
            L[r, r] -= Bm[k, j]
            c = A[k, j] * Bm[k, j]
            if c:
                L[r, 0] += c * mu[j]
                L[r, iX[j, :]] += c
            L[iB[k], r] += 1.0
        L[iB[k], 0] += mu[k]
    return L, iX, iB


def _background_cumulative(spec: HawkesSpec, times, A=None, t_start: float = 0.0) -> np.ndarray:
    """Expected number of events in (t_start, t] rooted in background
    immigrants arriving after t_start, for a process with no excitation
    pending at t_start (by default the process started empty at time 0).
    Needs t >= t_start. Returns (len(t), M)."""
    A = spec.alpha if A is None else np.asarray(A, float)
    M = spec.M
    Bm = spec.beta_matrix
    times = np.atleast_1d(np.asarray(times, float))
    if np.any(times < t_start):
        raise ValueError("times must be >= t_start")
    out = np.zeros((times.size, M))
    if times.size == 0 or times.max() <= t_start:
        return out
    if spec.constant_mu or isinstance(spec.mu, PiecewiseConstant):
        brk = np.zeros(0) if spec.constant_mu else spec.mu.breaks
        t_max = times.max()
        cuts = np.unique(np.concatenate([[t_start], brk[(brk > t_start) & (brk < t_max)], times]))
        nx = M * M
        z = np.zeros(1 + nx + M)
        z[0] = 1.0
        vals = {t_start: np.zeros(M)}
        t_prev = t_start
        for t in cuts[1:]:
            mid = 0.5 * (t_prev + t)
            mu = spec.mu_at(np.array([mid]))[0]
            L, iX, iB = _bg_generator(A, Bm, mu)
            z = expm(L * (t - t_prev)) @ z
            vals[t] = z[iB].copy()
            t_prev = t
        for i, t in enumerate(times):
            out[i] = vals[t]
        return out

    # generic background: integrate the ODE numerically
    def rhs(t, y):
        x = y[: M * M].reshape(M, M)
        m = spec.mu_at(np.array([t]))[0] + x.sum(axis=1)
        dx = -Bm * x + A * Bm * m[None, :]
        return np.concatenate([dx.ravel(), m])

    order = np.argsort(times)
    t_eval = times[order]
    sol = solve_ivp(
        rhs, (t_start, float(t_eval[-1])), np.zeros(M * M + M), method="DOP853", t_eval=t_eval, rtol=1e-10, atol=1e-12
    )
    out[order] = sol.y[M * M :].T
    return out


def expected_counts(spec: HawkesSpec, t0: float, t1: float, A=None) -> dict:
    """Exact expected counts in (t0, t1] for the process started empty at 0,
    split by root (background, each shock). Returns dict(background (M,),
    shocks (E, M), total (M,))."""
    A = spec.alpha if A is None else np.asarray(A, float)
    Bc = _background_cumulative(spec, np.array([t0, t1]), A)
    bg = Bc[1] - Bc[0]
    sh = np.zeros((len(spec.shocks), spec.M))
    for e in range(len(spec.shocks)):
        start, s0 = _shock_start(spec, e)
        u = np.clip(np.array([t0, t1]) - start, 0.0, None)
        D, C = shock_response_counts(spec, s0, u, A)
        sh[e] = (D[1] + C[1]) - (D[0] + C[0])
    return {"background": bg, "shocks": sh, "total": bg + sh.sum(axis=0)}


def spillover(spec: HawkesSpec, shock_index: int, H: float, through) -> dict:
    """Counterfactual spillover of shock e through ``through``: the shock-e
    contagion computed with A minus the shock-e contagion computed with the
    entries selected by ``through`` set to zero (all other parameters fixed).

    through : which entries of A are zeroed.
        * int j: the WHOLE column A[:, j], i.e. every excitation BY stream j,
          including j -> j self-excitation and j -> j' for other streams j'
          of the same type. This is NOT the online channel of Def
          def:at-channel when j is an online stream: that definition zeroes
          only the online -> offline entries and keeps online -> online
          excitation (Sec sec:at-channel), so ``through=j`` removes more and
          answers a different question ("all paths through stream j").
        * tuple (k, j): the single entry A[k, j] (channel j -> k).
        * (M, M) bool mask: exactly the True entries. For Def def:at-channel,
          pass mask[np.ix_(offline, online)] = True (the E matrix of
          Sec sec:at-channel); this is what run_experiments.channel_mask
          builds for E1/E5, so the reported sigma_k follow the definition.

    By Prop prop:at-channel(a), with a mask the result equals the expected
    number of shock-e descendants whose ancestral line uses at least one
    masked entry (checked by Monte Carlo in E5).

    Returns dict(horizon (M,), infinite (M,), share_horizon (M,),
    share_infinite (M,), mask (M, M)). The shares are relative to the shock-e
    contagion in each stream (NaN where that is 0).
    """
    M = spec.M
    mask = np.zeros((M, M), bool)
    if isinstance(through, (int, np.integer)):
        mask[:, int(through)] = True
    elif isinstance(through, tuple) and len(through) == 2:
        mask[through] = True
    else:
        mask = np.asarray(through, bool)
    A0 = spec.alpha.copy()
    A0[mask] = 0.0
    start, s0 = _shock_start(spec, shock_index)
    tau = spec.shocks[shock_index][0]
    u = np.clip(np.array([tau, tau + H]) - start, 0.0, None)
    D1, C1 = shock_response_counts(spec, s0, u)
    D0, C0 = shock_response_counts(spec, s0, u, A0)
    hor = (C1[1] - C1[0]) - (C0[1] - C0[0])
    direct_inf = s0 / spec.shock_rate_vec
    tot1 = multiplier(spec.alpha) @ direct_inf
    tot0 = multiplier(A0) @ direct_inf
    inf = tot1 - tot0
    cont_h = C1[1] - C1[0]
    cont_inf = tot1 - direct_inf
    with np.errstate(divide="ignore", invalid="ignore"):
        sh_h = np.where(cont_h > 0, hor / cont_h, np.nan)
        sh_i = np.where(cont_inf > 0, inf / cont_inf, np.nan)
    return {"horizon": hor, "infinite": inf, "share_horizon": sh_h, "share_infinite": sh_i, "mask": mask}


def decompose_surge(
    spec: HawkesSpec,
    shock_index: int,
    H: float,
    background: str = "process",
    spillover_through=None,
) -> dict:
    """Expected background / other-shock / direct / contagion counts over
    (tau_e, tau_e + H] (Thm thm:attribution).

    background : "process" (exact, for the process started empty at time 0, as
        simulated) or "stationary" (H (I - A)^{-1} mu_bar; constant mu only).
    spillover_through : optional column j, entry (k, j) or mask, passed to
        :func:`spillover` (an int zeroes the whole column, which is not the
        online channel of Def def:at-channel; use the online -> offline mask).

    Returns a dict with scalar totals ``background``, ``other_shocks``,
    ``direct``, ``contagion``, ``total`` (summed over streams); ``by_stream``
    (dict of (M,) arrays with the same keys); ``infinite`` (dict of (M,)
    arrays ``direct``, ``contagion``, ``total`` for H = infinity); and
    ``spillover`` if requested.
    """
    if not spec.shocks:
        raise ValueError("spec has no shocks")
    M = spec.M
    tau, _ = spec.shocks[shock_index]
    a, b = max(tau, 0.0), max(tau + H, 0.0)
    # shock e
    start, s0 = _shock_start(spec, shock_index)
    D, C = shock_response_counts(spec, s0, np.array([a, b]) - start)
    direct = D[1] - D[0]
    contagion = C[1] - C[0]
    # other shocks
    other = np.zeros(M)
    for e in range(len(spec.shocks)):
        if e == shock_index:
            continue
        st, s0e = _shock_start(spec, e)
        u = np.clip(np.array([a, b]) - st, 0.0, None)
        De, Ce = shock_response_counts(spec, s0e, u)
        other += (De[1] + Ce[1]) - (De[0] + Ce[0])
    # background
    if background == "process":
        Bc = _background_cumulative(spec, np.array([a, b]))
        bg = Bc[1] - Bc[0]
    elif background == "stationary":
        bg = (b - a) * (multiplier(spec.alpha) @ spec.mu_bar(None if spec.constant_mu else b))
    else:
        raise ValueError("background must be 'process' or 'stationary'")
    direct_inf = s0 / spec.shock_rate_vec
    try:
        total_inf = multiplier(spec.alpha) @ direct_inf
    except ValueError:
        total_inf = np.full(M, np.inf)
    by = {
        "background": bg,
        "other_shocks": other,
        "direct": direct,
        "contagion": contagion,
        "total": bg + other + direct + contagion,
        "shock_total": direct + contagion,
    }
    out = {key: float(v.sum()) for key, v in by.items()}
    out["by_stream"] = by
    out["window"] = (a, b)
    out["infinite"] = {"direct": direct_inf, "contagion": total_inf - direct_inf, "total": total_inf}
    if spillover_through is not None:
        out["spillover"] = spillover(spec, shock_index, H, spillover_through)
    return out


def impulse_response(spec: HawkesSpec, u, shock_index: int | None = None, source: int | None = None, A=None) -> np.ndarray:
    """Expected intensity response (Prop prop:irf) at lags u >= 0, (len(u), M).

    * ``shock_index=e``: response to shock e, ``s(u) + sum_j x_kj(u)``, with
      u measured from tau_e;
    * ``source=j``: response to a single event in stream j at time 0. This is
      the resolvent column ``R(u)[:, j]``, with
      ``int_0^inf R(u) du = (I - A)^{-1} - I``.
    """
    A = spec.alpha if A is None else np.asarray(A, float)
    M = spec.M
    Bm = spec.beta_matrix
    L, iS, iX, iD, iC = _shock_generator(A, Bm, spec.shock_rate_vec)
    z0 = np.zeros(L.shape[0])
    if shock_index is not None:
        tau, S = spec.shocks[shock_index]
        z0[iS] = spec.shock_beta * S * spec.shock_rate_vec
    elif source is not None:
        z0[iX[:, source]] = A[:, source] * Bm[:, source]
    else:
        raise ValueError("give shock_index or source")
    u = np.atleast_1d(np.asarray(u, float))
    out = np.zeros((u.size, M))
    for i, ui in enumerate(u):
        z = expm(L * max(ui, 0.0)) @ z0
        out[i] = z[iS] + z[iX].sum(axis=1)
    return out
