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


def collapse_A(trans, start=None):
    """Collapse 3-state (N, B, A) transition counts (..., 3, 3) and start counts (..., 3) to {not A, A}."""
    t = np.asarray(trans, float)
    t2 = np.stack([np.stack([t[..., :2, :2].sum((-1, -2)), t[..., :2, 2].sum(-1)], -1),
                   np.stack([t[..., 2, :2].sum(-1), t[..., 2, 2]], -1)], -2)
    if start is None:
        return t2
    s = np.asarray(start, float)
    return t2, np.stack([s[..., :2].sum(-1), s[..., 2]], -1)


def slate_confusion(item_conf, k, comp=None):
    """Slate-level confusion matrix (sec:prot-estimands) from item-level confusion item_conf (3 x 3: true
    state N, B, A -> observed class N, B, A of one position), assuming independent errors across the k
    positions. The observed slate state is the most severe observed class.
    comp=None: 'minimal composition', a slate in state N has k neutral items and a slate in state B or A has
    one item of that state and k - 1 neutral items (the approximation behind 'misread with probability about
    k(1 - Sp)'). Otherwise comp is a dict state -> list of ((n_N, n_B, n_A), weight) and the rows average
    over those compositions (oracle composition)."""
    c = np.asarray(item_conf, float)
    cum = np.cumsum(c, 1)                                    # P(observed class <= y | true state)

    def row(nvec):
        le = np.array([np.prod(cum[:, y] ** np.asarray(nvec)) for y in range(3)])
        return np.array([le[0], le[1] - le[0], 1.0 - le[1]])
    if comp is None:
        comps = {0: [((k, 0, 0), 1.0)], 1: [((k - 1, 1, 0), 1.0)], 2: [((k - 1, 0, 1), 1.0)]}
    else:
        comps = comp
    C = np.zeros((3, 3))
    for x in range(3):
        w = np.array([wt for _, wt in comps[x]], float)
        if w.sum() <= 0:
            C[x] = row({0: (k, 0, 0), 1: (k - 1, 1, 0), 2: (k - 1, 0, 1)}[x])
            continue
        C[x] = sum(wt * row(nv) for nv, wt in comps[x]) / w.sum()
    return C


def slate_confusion_2(C3, occ=None):
    """Collapse a 3 x 3 slate confusion matrix to {not A, A}; occ weights the N and B rows (default equal)."""
    w = np.array([0.5, 0.5]) if occ is None else np.asarray(occ[:2], float) / max(float(np.sum(occ[:2])), 1e-300)
    notA = w[0] * C3[0] + w[1] * C3[1]
    return np.array([[notA[0] + notA[1], notA[2]], [C3[2, 0] + C3[2, 1], C3[2, 2]]])


def correct_chain(trans_obs, start_obs, C):
    """Misclassification-corrected chain (sec:markov-estimation): E(observed counts) = C' diag(nu) P C, so
    diag(nu) P is estimated by (C')^{-1} N_obs C^{-1}, and the start law by a_obs C^{-1}. Negative entries
    are set to zero before row normalisation; their number is returned ('n_neg')."""
    Ci = np.linalg.inv(np.asarray(C, float))
    D = Ci.T @ np.asarray(trans_obs, float) @ Ci
    a = np.asarray(start_obs, float) @ Ci
    n_neg = int((D < -1e-12).sum() + (a < -1e-12).sum())
    D = np.clip(D, 0.0, None)
    a = np.clip(a, 0.0, None)
    P, _ = estimate_P(D)
    return P, a / max(a.sum(), 1e-300), n_neg


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
