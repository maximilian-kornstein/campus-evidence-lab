"""Vectorised standard bivariate normal CDF and density.

The CDF uses Owen's (1956) T-function representation

    Phi2(h, k; r) = 1/2 Phi(h) + 1/2 Phi(k) - T(h, a_h) - T(k, a_k) - beta,
    a_h = (k - r h) / (h sqrt(1 - r^2)),  a_k = (h - r k) / (k sqrt(1 - r^2)),
    beta = 0 if h k > 0 or (h k = 0 and h + k >= 0), else 1/2,

with ``scipy.special.owens_t``.  Infinite arguments are clamped to +-BIG (Phi(-BIG) is
below 1e-23) and exact zeros are nudged to 1e-12, where the formula is continuous.  The
tests check it against ``scipy.stats.multivariate_normal.cdf``.
"""
from __future__ import annotations

import numpy as np
from scipy.special import ndtr, owens_t

BIG = 10.0
_TINY = 1e-12


def _prep(h, k, r):
    h, k, r = np.broadcast_arrays(np.asarray(h, float), np.asarray(k, float), np.asarray(r, float))
    h = np.clip(h, -BIG, BIG)
    k = np.clip(k, -BIG, BIG)
    h = np.where(h == 0.0, _TINY, h)
    k = np.where(k == 0.0, _TINY, k)
    r = np.clip(r, -0.999999, 0.999999)
    return h, k, r


def bvn_cdf(h, k, r):
    """P(X <= h, Y <= k) for a standard bivariate normal with correlation r (broadcasts)."""
    h, k, r = _prep(h, k, r)
    s = np.sqrt(1.0 - r * r)
    ah = (k - r * h) / (h * s)
    ak = (h - r * k) / (k * s)
    beta = np.where(h * k > 0, 0.0, 0.5)
    out = 0.5 * ndtr(h) + 0.5 * ndtr(k) - owens_t(h, ah) - owens_t(k, ak) - beta
    return np.clip(out, 0.0, 1.0)


def bvn_pdf(h, k, r):
    """Standard bivariate normal density with correlation r (= d Phi2 / d r)."""
    h, k, r = _prep(h, k, r)
    one_r2 = 1.0 - r * r
    q = (h * h - 2.0 * r * h * k + k * k) / one_r2
    return np.exp(-0.5 * q) / (2.0 * np.pi * np.sqrt(one_r2))


def bvn_dh(h, k, r):
    """d Phi2(h, k; r) / d h = phi(h) Phi((k - r h) / sqrt(1 - r^2))."""
    h, k, r = _prep(h, k, r)
    s = np.sqrt(1.0 - r * r)
    return np.exp(-0.5 * h * h) / np.sqrt(2.0 * np.pi) * ndtr((k - r * h) / s)
