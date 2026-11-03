"""Stereotype-count indices ("agrees with at least k of N items") under invariance and DIF.

For the N stereotype items (factors G and S), agreement is Y_j >= c_agree (the top two
categories of a five-point scale: c_agree = 3).  Given theta = (theta_G, theta_S), the item
agreements are independent with p_j(theta) = Phi(a_jG theta_G + a_jS theta_S - b_j,c_agree)
(probit latent response), so the count is Poisson-binomial.  The population index of a
group with theta_G ~ N(mu_G, s_G^2), theta_S ~ N(mu_S, s_S^2) is

    Index_k(g) = E_theta[ P(count >= k | theta) ],

computed by tensor Gauss-Hermite quadrature (Q nodes per dimension).  `sample_index`
gives the finite-sample version.
"""
from __future__ import annotations

import numpy as np
from scipy.special import ndtr

C_AGREE = 3


def gh_nodes(Q=40):
    x, w = np.polynomial.hermite_e.hermegauss(Q)       # weight exp(-x^2/2)
    return x, w / np.sqrt(2 * np.pi)


def count_dist(p):
    """Poisson-binomial pmf for success probabilities p (..., N) -> (..., N+1)."""
    shp = p.shape[:-1]
    N = p.shape[-1]
    f = np.zeros(shp + (N + 1,))
    f[..., 0] = 1.0
    for j in range(N):
        pj = p[..., j:j + 1]
        f[..., 1:] = f[..., 1:] * (1 - pj) + f[..., :-1] * pj
        f[..., 0] = f[..., 0] * (1 - p[..., j])
    return f


def population_count_dist(aG, aS, b_agree, mu=(0.0, 0.0), s=(1.0, 1.0), Q=40):
    """Population distribution of the agreement count for one group."""
    x, w = gh_nodes(Q)
    tG = mu[0] + s[0] * x
    tS = mu[1] + s[1] * x
    eta = aG[None, None, :] * tG[:, None, None] + aS[None, None, :] * tS[None, :, None] - b_agree[None, None, :]
    f = count_dist(ndtr(eta))                                  # (Q, Q, N+1)
    return np.einsum("i,j,ijk->k", w, w, f)


def index_k(dist, k):
    return float(dist[k:].sum())


def sample_index(Y, k, c_agree=C_AGREE):
    return float(np.mean((Y >= c_agree).sum(axis=1) >= k))


def count_dist_1d(a, b, mu=0.0, s=1.0, link="logit", Q=200):
    """Count distribution for a unidimensional trait theta ~ N(mu, s^2) with
    Pr(U_j = 1 | theta) = F(a_j theta - b_j) (eq:sa-irf); F logistic or normal."""
    from scipy.special import expit
    x, w = gh_nodes(Q)
    th = mu + s * x
    eta = np.asarray(a, float)[None, :] * th[:, None] - np.asarray(b, float)[None, :]
    p = expit(eta) if link == "logit" else ndtr(eta)
    return w @ count_dist(p)


def survival(dist):
    """P(S >= h) for h = 1..M from a count pmf."""
    return np.cumsum(dist[::-1])[::-1][1:]
