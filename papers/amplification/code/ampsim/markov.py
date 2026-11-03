"""Finite Markov chains over content states (N, B, A): estimation and exposure functionals.

Notation follows sec:markov (Kemeny & Snell 1960; Meyer 1975):
    stationary law       varpi' P = varpi',  varpi' 1 = 1
    fundamental matrix   Z = (I - P + 1 varpi')^{-1}
    group inverse        H = Z - 1 varpi' = (I - P)^#
    exposure potential   g_A = H 1_A
    session exposure     e_T(P, a) = T^{-1} sum_{t=0}^{T-1} a' P^t 1_A
    mean first passage   M_xy = (H_yy - H_xy) / varpi_y (M_yy = 0);  Kemeny K = tr H
    sensitivity coeff.   kappa_A = osc(g_A) / 2
    thm:perturb (a)      varpi_1' - varpi_0' = varpi_1' (P_1 - P_0) H_0   (exact)
                         d varpi_A / d eps |_0 = varpi_0' Delta g_A
                (b)      |varpi_1(A) - varpi_0(A)| <= kappa_A ||P_1 - P_0||_inf
                         ||varpi_1 - varpi_0||_1 <= tau_1(H_0) ||P_1 - P_0||_inf
                (e)      |e_T(P_1, a) - e_T(P_0, a)| <= ||P_1 - P_0||_inf / (2T) sum_{r=0}^{T-2} (T-1-r) tau_1(P_0^r)
"""
from __future__ import annotations

import numpy as np


def estimate_P(trans, prior=0.0):
    """MLE of a transition matrix from counts (m x m). Rows with no departures get the pooled next-state law."""
    C = np.asarray(trans, float) + prior
    rs = C.sum(1, keepdims=True)
    pooled = C.sum(0) / max(C.sum(), 1e-300)
    P = np.where(rs > 0, C / np.maximum(rs, 1e-300), pooled[None, :])
    return P, (rs[:, 0] > 0)


def stationary(P):
    """varpi' = 1' (I - P + 1 1')^{-1} (prop:markov(a))."""
    P = np.asarray(P, float)
    m = P.shape[0]
    return np.linalg.solve((np.eye(m) - P + np.ones((m, m))).T, np.ones(m))


def fundamental(P, pi=None):
    P = np.asarray(P, float)
    pi = stationary(P) if pi is None else pi
    m = P.shape[0]
    return np.linalg.inv(np.eye(m) - P + np.outer(np.ones(m), pi))


def group_inverse(P, pi=None):
    pi = stationary(P) if pi is None else pi
    return fundamental(P, pi) - np.outer(np.ones(len(pi)), pi)


def indicator(m, A):
    v = np.zeros(m)
    v[np.atleast_1d(A)] = 1.0
    return v


def exposure_potential(P, A=2, pi=None):
    P = np.asarray(P, float)
    return group_inverse(P, pi) @ indicator(P.shape[0], A)


def kappa(P, A=2):
    g = exposure_potential(P, A)
    return 0.5 * float(g.max() - g.min())


def tau1(B):
    """Ergodicity coefficient tau_1(B) = max_{x,y} sum_z |B_xz - B_yz| / 2."""
    B = np.asarray(B, float)
    return 0.5 * float(np.abs(B[:, None, :] - B[None, :, :]).sum(-1).max())


def mfpt(P, pi=None):
    """Mean first passage times M_xy = (H_yy - H_xy) / varpi_y, with M_yy = 0."""
    pi = stationary(P) if pi is None else pi
    H = group_inverse(P, pi)
    return (np.diag(H)[None, :] - H) / pi[None, :]


def kemeny(P, pi=None):
    return float(np.trace(group_inverse(P, pi)))


def e_T(P, a, T, A=2):
    """Expected session exposure over T items (eq. mk-eT)."""
    P = np.asarray(P, float)
    x = np.asarray(a, float)
    f = indicator(P.shape[0], A)
    tot = 0.0
    for _ in range(T):
        tot += x @ f
        x = x @ P
    return tot / T


def e_T_path(P, a, T, A=2):
    """P(X_t in A) for t = 0..T-1."""
    P = np.asarray(P, float)
    x = np.asarray(a, float)
    f = indicator(P.shape[0], A)
    out = np.empty(T)
    for t in range(T):
        out[t] = x @ f
        x = x @ P
    return out


def hitting_time(P, A=2):
    """M_{xA} = {(I - P_OO)^{-1} 1}_x for x outside A (0 on A) (prop:markov(c))."""
    P = np.asarray(P, float)
    m = P.shape[0]
    inA = indicator(m, A).astype(bool)
    Q = P[np.ix_(~inA, ~inA)]
    t = np.zeros(m)
    t[~inA] = np.linalg.solve(np.eye(Q.shape[0]) - Q, np.ones(Q.shape[0]))
    return t


def prob_no_hit(P, a, T, A=2):
    """Probability that a T-item session contains no item in A: a_O' P_OO^{T-1} 1."""
    P = np.asarray(P, float)
    m = P.shape[0]
    inA = indicator(m, A).astype(bool)
    Q = P[np.ix_(~inA, ~inA)]
    x = np.asarray(a, float)[~inA]
    for _ in range(T - 1):
        x = x @ Q
    return float(x.sum())


def finite_horizon_bound(P0, E_inf, T):
    """thm:perturb(e): ||E||_inf / (2T) * sum_{r=0}^{T-2} (T-1-r) tau_1(P0^r)."""
    P0 = np.asarray(P0, float)
    Pr = np.eye(P0.shape[0])
    s = 0.0
    for r in range(T - 1):
        s += (T - 1 - r) * tau1(Pr)
        Pr = Pr @ P0
    return E_inf / (2 * T) * s


def perturbation(P0, P1, A=2, a=None, T=None):
    """Compare chains P0 (base) and P1 (perturbed) per thm:perturb."""
    P0 = np.asarray(P0, float)
    P1 = np.asarray(P1, float)
    m = P0.shape[0]
    f = indicator(m, A)
    pi0, pi1 = stationary(P0), stationary(P1)
    H0 = group_inverse(P0, pi0)
    g = H0 @ f
    E = P1 - P0
    E_inf = float(np.abs(E).sum(1).max())
    k = 0.5 * float(g.max() - g.min())
    out = dict(pi0_A=float(pi0 @ f), pi1_A=float(pi1 @ f), delta_A=float((pi1 - pi0) @ f),
               identity_A=float(pi1 @ E @ g), first_order_A=float(pi0 @ E @ g), E_inf=E_inf,
               kappa_A=k, bound_A=k * E_inf, tau1_H=tau1(H0), bound_l1=tau1(H0) * E_inf,
               delta_l1=float(np.abs(pi1 - pi0).sum()), kemeny=float(np.trace(H0)))
    if a is not None and T is not None:
        e0, e1 = e_T(P0, a, T, A), e_T(P1, a, T, A)
        out.update(eT0=e0, eT1=e1, delta_eT=e1 - e0, bound_eT=finite_horizon_bound(P0, E_inf, T),
                   bound_eT_crude=(T - 1) / 4 * E_inf)
    return out


def summaries(P, a, A=2, horizons=(20, 100, 200)):
    """Exposure functionals of prop:markov for one chain."""
    P = np.asarray(P, float)
    pi = stationary(P)
    f = indicator(P.shape[0], A)
    out = dict(pi_A=float(pi @ f), kappa_A=kappa(P, A), kemeny=kemeny(P, pi))
    for T in horizons:
        out[f"e_{T}"] = e_T(P, a, T, A)
    out["hit_from_N"] = float(hitting_time(P, A)[0])
    out["p_reach_20"] = 1.0 - prob_no_hit(P, a, 20, A)
    return out
