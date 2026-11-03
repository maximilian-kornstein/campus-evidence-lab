"""Thresholds, polychoric correlations and their joint asymptotic covariance.

Two-step estimator (Olsson 1979): thresholds tau_jc = Phi^{-1}(P(Y_j < c)) from the
margins, then for every item pair the polychoric correlation maximises the bivariate
ordinal-probit likelihood of the pair's K x K table with the thresholds held fixed.  All
pairs are solved at once by vectorised Fisher scoring (d Phi2 / d rho = phi2).

The asymptotic covariance of (tau, rho) is estimated from per-respondent influence
functions, which include the effect of estimating the thresholds:

    IF_i(tau_jm) = (1{Y_ij < m} - Phi(tau_jm)) / phi(tau_jm)
    IF_i(rho_jk) = I_rr^{-1} [ s_i - sum_m I_r,tau_jm IF_i(tau_jm) - sum_m I_r,tau_km IF_i(tau_km) ]

where s_i = d log pi_{Y_ij, Y_ik} / d rho and I_r. are per-observation expected
information terms (information identity).  Gamma = IF' IF / n^2.  This is the quantity
whose diagonal gives DWLS weights and that enters the sandwich covariance in fit.py.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.special import ndtr, ndtri

from .bvn import BIG, bvn_cdf, bvn_dh, bvn_pdf

_EPS_P = 1e-10


def all_pairs(J: int) -> np.ndarray:
    j, k = np.triu_indices(J, 1)
    return np.stack([j, k], axis=1)


def onehot(Y: np.ndarray, K: int) -> np.ndarray:
    n, J = Y.shape
    X = np.zeros((n, J * K))
    X[np.arange(n)[:, None], np.arange(J)[None, :] * K + Y] = 1.0
    return X


def thresholds(Y: np.ndarray, K: int, w: np.ndarray | None = None) -> np.ndarray:
    """(J, K-1) array of tau_jc = Phi^{-1}(P(Y_j < c)), c = 1..K-1 (weighted if w given)."""
    n, J = Y.shape
    w = np.ones(n) if w is None else np.asarray(w, float)
    cnt = np.zeros((J, K))
    for j in range(J):
        cnt[j] = np.bincount(Y[:, j], weights=w, minlength=K)[:K]
    cum = np.cumsum(cnt, axis=1)[:, :-1] / w.sum()
    return ndtri(np.clip(cum, _EPS_P, 1 - _EPS_P))


def _pad(tau):
    P = tau.shape[0]
    return np.concatenate([np.full((P, 1), -BIG), tau, np.full((P, 1), BIG)], axis=1)


def cell_probs(hj, hk, rho, deriv=False):
    """Cell probabilities pi (P, K, K) of the bivariate ordinal probit for padded thresholds
    hj, hk (P, K+1) and correlations rho (P,); with deriv=True also d pi / d rho."""
    r = rho[:, None, None]
    P, K1 = hj.shape
    # only the interior of the grid needs Phi2; the padded rows/columns are exact limits
    F = np.zeros((P, K1, K1))
    F[:, 1:-1, 1:-1] = bvn_cdf(hj[:, 1:-1, None], hk[:, None, 1:-1], r)
    F[:, -1, 1:-1] = ndtr(hk[:, 1:-1])
    F[:, 1:-1, -1] = ndtr(hj[:, 1:-1])
    F[:, -1, -1] = 1.0
    pi = F[:, 1:, 1:] - F[:, :-1, 1:] - F[:, 1:, :-1] + F[:, :-1, :-1]
    pi = np.maximum(pi, 1e-300)
    if not deriv:
        return pi
    f = np.zeros((P, K1, K1))
    f[:, 1:-1, 1:-1] = bvn_pdf(hj[:, 1:-1, None], hk[:, None, 1:-1], r)
    dpi = f[:, 1:, 1:] - f[:, :-1, 1:] - f[:, 1:, :-1] + f[:, :-1, :-1]
    return pi, dpi


@dataclass
class Polychoric:
    tau: np.ndarray        # (J, K-1)
    rho: np.ndarray        # (P,)
    pairs: np.ndarray      # (P, 2)
    info: np.ndarray       # (P,) per-observation expected information for rho
    n_iter: int
    converged: bool
    K: int
    n: float


def pair_tables(Y, K, pairs, w=None, X=None):
    """(P, K, K) contingency tables for the given pairs (weighted if w given)."""
    n, J = Y.shape
    X = onehot(Y, K) if X is None else X
    Xw = X if w is None else X * np.asarray(w, float)[:, None]
    T = (X.T @ Xw).reshape(J, K, J, K)
    return T[pairs[:, 0], :, pairs[:, 1], :]


def polychoric(Y: np.ndarray, K: int, pairs: np.ndarray | None = None, w=None, rho0=None,
               tol: float = 1e-9, max_iter: int = 60, X=None) -> Polychoric:
    """Two-step polychoric correlations for all pairs (vectorised Fisher scoring)."""
    Y = np.asarray(Y)
    n, J = Y.shape
    pairs = all_pairs(J) if pairs is None else pairs
    tau = thresholds(Y, K, w)
    N = pair_tables(Y, K, pairs, w, X)
    tot = N.sum(axis=(1, 2))
    hj, hk = _pad(tau[pairs[:, 0]]), _pad(tau[pairs[:, 1]])
    if rho0 is None:
        Yf = Y.astype(float)
        if w is None:
            C = np.corrcoef(Yf, rowvar=False)
        else:
            ww = np.asarray(w, float) / np.sum(w)
            mu = ww @ Yf
            Z = Yf - mu
            C = (Z * ww[:, None]).T @ Z
            d = np.sqrt(np.diag(C))
            C = C / np.outer(d, d)
        rho = np.clip(np.nan_to_num(C[pairs[:, 0], pairs[:, 1]]), -0.9, 0.9)
    else:
        rho = np.array(rho0, float, copy=True)
    converged = False
    it = 0
    for it in range(1, max_iter + 1):
        pi, dpi = cell_probs(hj, hk, rho, deriv=True)
        score = np.sum(N * dpi / pi, axis=(1, 2))
        info = tot * np.sum(dpi * dpi / pi, axis=(1, 2))
        step = np.clip(score / np.maximum(info, 1e-12), -0.25, 0.25)
        rho = np.clip(rho + step, -0.995, 0.995)
        if np.max(np.abs(step)) < tol:
            converged = True
            break
    pi, dpi = cell_probs(hj, hk, rho, deriv=True)
    info1 = np.sum(dpi * dpi / pi, axis=(1, 2))
    return Polychoric(tau=tau, rho=rho, pairs=pairs, info=info1, n_iter=it, converged=converged, K=K,
                      n=float(n if w is None else np.sum(w)))


def influence(Y: np.ndarray, pc: Polychoric):
    """Influence functions: IF_tau (n, J*(K-1)) and IF_rho (n, P) for an unweighted sample."""
    Y = np.asarray(Y)
    n, J = Y.shape
    K, C = pc.K, pc.K - 1
    tau, rho, pairs = pc.tau, pc.rho, pc.pairs
    # thresholds
    phi = np.exp(-0.5 * tau * tau) / np.sqrt(2 * np.pi)                     # (J, C)
    ind = (Y[:, :, None] < np.arange(1, K)[None, None, :]).astype(float)    # (n, J, C)
    IFt = (ind - ndtr(tau)[None]) / phi[None]                                # (n, J, C)
    # polychorics
    hj, hk = _pad(tau[pairs[:, 0]]), _pad(tau[pairs[:, 1]])
    pi, dpi = cell_probs(hj, hk, rho, deriv=True)
    u = dpi / pi                                                             # (P, K, K)
    Irr = np.sum(dpi * u, axis=(1, 2))                                       # (P,)
    r = rho[:, None, None]
    Fh = bvn_dh(hj[:, 1:-1, None], hk[:, None, :], r)                       # (P, C, K+1)
    D = Fh[:, :, 1:] - Fh[:, :, :-1]                                         # (P, C, K)
    Irh = np.sum(D * (u[:, :-1, :] - u[:, 1:, :]), axis=2)                  # (P, C)
    Fk = bvn_dh(hk[:, None, 1:-1], hj[:, :, None], r)                       # (P, K+1, C)
    E = Fk[:, 1:, :] - Fk[:, :-1, :]                                         # (P, K, C)
    Irk = np.sum(E * (u[:, :, :-1] - u[:, :, 1:]), axis=1)                  # (P, C)
    P = len(rho)
    j, k = pairs[:, 0], pairs[:, 1]
    s = u[np.arange(P)[None, :], Y[:, j], Y[:, k]]                          # (n, P)
    adj = np.einsum("nqc,qc->nq", IFt[:, j, :], Irh) + np.einsum("nqc,qc->nq", IFt[:, k, :], Irk)
    IFr = (s - adj) / Irr[None, :]
    return IFt.reshape(n, J * C), IFr


def acov(Y: np.ndarray, pc: Polychoric, corr_only: bool = False) -> np.ndarray:
    """Estimated covariance matrix of (vec(tau), rho) (or of rho only), = IF' IF / n^2."""
    IFt, IFr = influence(Y, pc)
    M = IFr if corr_only else np.concatenate([IFt, IFr], axis=1)
    M = M - M.mean(axis=0, keepdims=True)
    n = M.shape[0]
    return M.T @ M / (n * n)
