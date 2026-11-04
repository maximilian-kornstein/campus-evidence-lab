"""Synthetic survey data from a bifactor graded-response model with groups and DIF.

Latent factors are ordered (G, S, I): a general factor and two specific factors.  Item j
loads on G and on its specific factor spec[j] in {1 (S), 2 (I)}.  Responses follow the
latent-response form of the graded response model,

    Y*_ij = a_jG theta_iG + a_js theta_is + e_ij,   Y_ij = #{c : Y*_ij > b_jc},

so P(Y_ij >= c | theta) = F(a_jG theta_G + a_js theta_s - b_jc) with F = Phi (``link =
"probit"``, the normal-ogive GRM; the default) or F = logistic (``link = "logit"``, the
logistic GRM of SPEC).  theta_i ~ N(mu_g, Sigma_g) in group g.  DIF = group-specific
(a, b): uniform DIF shifts b, non-uniform DIF changes a.

Items are specified on the standardised scale of the reference group (theta ~ N(0, I),
probit): standardised loadings lam_G, lam_s and standardised thresholds tau, with
a = lam / sqrt(1 - h^2), b = tau / sqrt(1 - h^2), h^2 = lam_G^2 + lam_s^2.  Then
ECV_j = a_jG^2 / (a_jG^2 + a_js^2) = lam_G^2 / h^2.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np
from scipy.special import ndtri

N_FACTORS = 3  # G, S, I


@dataclass
class Bank:
    aG: np.ndarray       # (J,)
    aS: np.ndarray       # (J,) slope on the item's specific factor
    b: np.ndarray        # (J, C) increasing thresholds
    spec: np.ndarray     # (J,) specific factor index, 1 = S, 2 = I
    names: list = field(default_factory=list)

    @property
    def J(self):
        return len(self.aG)

    @property
    def C(self):
        return self.b.shape[1]

    def A(self) -> np.ndarray:
        """(J, 3) slope matrix on (G, S, I)."""
        A = np.zeros((self.J, N_FACTORS))
        A[:, 0] = self.aG
        A[np.arange(self.J), self.spec] = self.aS
        return A

    def ecv(self) -> np.ndarray:
        return ecv(self.aG, self.aS)

    def subset(self, idx) -> "Bank":
        idx = np.asarray(idx)
        return Bank(self.aG[idx].copy(), self.aS[idx].copy(), self.b[idx].copy(), self.spec[idx].copy(),
                    [self.names[i] for i in idx] if self.names else [])

    def copy(self) -> "Bank":
        return replace(self, aG=self.aG.copy(), aS=self.aS.copy(), b=self.b.copy(), spec=self.spec.copy(),
                       names=list(self.names))


def ecv(aG, aS):
    aG, aS = np.asarray(aG, float), np.asarray(aS, float)
    return aG ** 2 / (aG ** 2 + aS ** 2)


def std_loadings(bank: Bank, sigma2=(1.0, 1.0, 1.0)):
    """Standardised loadings (lam_G, lam_s) of the probit latent response with factor variances sigma2."""
    s2 = np.asarray(sigma2, float)
    v = bank.aG ** 2 * s2[0] + bank.aS ** 2 * s2[bank.spec] + 1.0
    sd = np.sqrt(v)
    return bank.aG * np.sqrt(s2[0]) / sd, bank.aS * np.sqrt(s2[bank.spec]) / sd


def bank_from_standardised(lamG, lamS, spec, tau, names=None) -> Bank:
    lamG, lamS, tau = np.asarray(lamG, float), np.asarray(lamS, float), np.atleast_2d(np.asarray(tau, float))
    h2 = lamG ** 2 + lamS ** 2
    if np.any(h2 >= 1):
        raise ValueError("communality must be < 1")
    s = np.sqrt(1 - h2)
    return Bank(lamG / s, lamS / s, tau / s[:, None], np.asarray(spec, int), list(names or []))


def loadings_from_ecv(ecv_vals, h2):
    ecv_vals, h2 = np.asarray(ecv_vals, float), np.broadcast_to(np.asarray(h2, float), np.shape(ecv_vals))
    return np.sqrt(ecv_vals * h2), np.sqrt((1 - ecv_vals) * h2)


def base_thresholds(J, shifts=None, props=(0.30, 0.30, 0.20, 0.12, 0.08)):
    """Standardised thresholds giving the marginal category proportions `props` (shifted per item)."""
    cum = np.cumsum(props)[:-1]
    tau0 = ndtri(cum)
    shifts = np.zeros(J) if shifts is None else np.asarray(shifts, float)
    return tau0[None, :] + shifts[:, None]


def with_dif(bank: Bank, uniform: dict | None = None, nonuniform: dict | None = None) -> Bank:
    """Copy of `bank` with DIF: uniform {j: delta_b} adds delta_b to all of item j's thresholds;
    nonuniform {j: (mult_G, mult_s)} multiplies item j's slopes."""
    out = bank.copy()
    for j, db in (uniform or {}).items():
        out.b[j] = out.b[j] + db
    for j, (mg, ms) in (nonuniform or {}).items():
        out.aG[j] = out.aG[j] * mg
        out.aS[j] = out.aS[j] * ms
    return out


def simulate(banks, mus, Sigmas, ns, rng, link: str = "probit"):
    """Draw responses for several groups.

    banks: list of Bank (one per group, same items); mus: (G, 3); Sigmas: (G, 3, 3); ns: sizes.
    Returns Y (n, J) int8, group (n,), theta (n, 3)."""
    rng = np.random.default_rng(rng)
    Ys, gs, ths = [], [], []
    for g, (bank, mu, Sig, n) in enumerate(zip(banks, mus, Sigmas, ns)):
        L = np.linalg.cholesky(np.asarray(Sig, float))
        th = np.asarray(mu, float)[None, :] + rng.standard_normal((n, N_FACTORS)) @ L.T
        eta = th @ bank.A().T                                         # (n, J)
        if link == "probit":
            e = rng.standard_normal(eta.shape)
        elif link == "logit":
            u = rng.random(eta.shape)
            e = np.log(u) - np.log1p(-u)
        else:
            raise ValueError(link)
        ystar = eta + e
        Y = (ystar[:, :, None] > bank.b[None, :, :]).sum(axis=2).astype(np.int8)
        Ys.append(Y)
        gs.append(np.full(n, g, dtype=np.int8))
        ths.append(th)
    return np.concatenate(Ys), np.concatenate(gs), np.concatenate(ths)


def true_polychoric(bank: Bank, mu=(0, 0, 0), sigma2=(1, 1, 1), pairs=None):
    """Population thresholds and polychoric correlations (probit link, diagonal Sigma)."""
    from .polychoric import all_pairs
    s2 = np.asarray(sigma2, float)
    mu = np.asarray(mu, float)
    v = bank.aG ** 2 * s2[0] + bank.aS ** 2 * s2[bank.spec] + 1.0
    sd = np.sqrt(v)
    m = bank.aG * mu[0] + bank.aS * mu[bank.spec]
    tau = (bank.b - m[:, None]) / sd[:, None]
    pairs = all_pairs(bank.J) if pairs is None else pairs
    j, k = pairs[:, 0], pairs[:, 1]
    same = (bank.spec[j] == bank.spec[k]).astype(float)
    c = bank.aG[j] * bank.aG[k] * s2[0] + same * bank.aS[j] * bank.aS[k] * s2[bank.spec[j]]
    return tau, c / (sd[j] * sd[k])


# ---------------------------------------------------------------------------
# General loading patterns (cross-loadings, method factors): used by X6 and X9
# ---------------------------------------------------------------------------
def slopes_from_standardised(L):
    """Slope matrix A (J, F) from standardised loadings L (J, F) of orthogonal unit-variance factors:
    a_j = lam_j / sqrt(1 - h_j^2), h_j^2 = sum_f lam_jf^2."""
    L = np.asarray(L, float)
    h2 = np.sum(L ** 2, axis=1)
    if np.any(h2 >= 1):
        raise ValueError("communality must be < 1")
    return L / np.sqrt(1 - h2)[:, None]


def simulate_general(A, b, mu, Sigma, n, rng, link: str = "probit"):
    """One group from the latent-response GRM with an arbitrary slope matrix A (J, F):
    Y*_ij = a_j' theta_i + e_ij, theta_i ~ N(mu, Sigma) (F-dimensional), Y_ij = #{c : Y*_ij > b_jc}.

    With F = 3 and A = bank.A() this draws exactly what `simulate` draws for one group from the
    same generator (the same sequence of random numbers is consumed).  Returns Y (n, J) int8 and
    theta (n, F)."""
    rng = np.random.default_rng(rng)
    A = np.asarray(A, float)
    b = np.asarray(b, float)
    F_ = A.shape[1]
    L = np.linalg.cholesky(np.asarray(Sigma, float))
    th = np.asarray(mu, float)[None, :] + rng.standard_normal((n, F_)) @ L.T
    eta = th @ A.T
    if link == "probit":
        e = rng.standard_normal(eta.shape)
    elif link == "logit":
        u = rng.random(eta.shape)
        e = np.log(u) - np.log1p(-u)
    else:
        raise ValueError(link)
    ystar = eta + e
    Y = (ystar[:, :, None] > b[None, :, :]).sum(axis=2).astype(np.int8)
    return Y, th


def true_polychoric_general(A, b, mu=None, Sigma=None, pairs=None):
    """Population standardised thresholds and polychoric correlations for an arbitrary slope matrix
    (probit link): tau_jc = (b_jc - a_j' mu) / s_j, rho_jk = a_j' Sigma a_k / (s_j s_k),
    s_j = sqrt(1 + a_j' Sigma a_j)."""
    from .polychoric import all_pairs
    A = np.asarray(A, float)
    F_ = A.shape[1]
    mu = np.zeros(F_) if mu is None else np.asarray(mu, float)
    Sigma = np.eye(F_) if Sigma is None else np.asarray(Sigma, float)
    C = A @ Sigma @ A.T
    s = np.sqrt(1 + np.diag(C))
    tau = (np.asarray(b, float) - (A @ mu)[:, None]) / s[:, None]
    pairs = all_pairs(A.shape[0]) if pairs is None else pairs
    j, k = pairs[:, 0], pairs[:, 1]
    return tau, C[j, k] / (s[j] * s[k])
