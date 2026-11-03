"""Under-reporting (thinning) and second-order formulas for univariate
exponential Hawkes processes (Thm thm:thinning, Thm thm:equiv, Thm thm:spurious).

Setting. A stationary Hawkes process has rate Lambda = mu / (1 - n), branching
ratio n < 1 and kernel n beta e^{-beta t}. Its Bartlett spectrum is
(Daley & Vere-Jones; Hawkes 1971)

    f(w) = Lambda / (2 pi) * [1 + beta^2 (1 - (1-n)^2) / (beta^2 (1-n)^2 + w^2)],

which corresponds to the reduced covariance density
``c(u) = Lambda beta n (2 - n) / (2 (1 - n)) e^{-beta (1-n) |u|}``.

Thinning. Recording each event independently with probability p gives rate
p Lambda and covariance density p^2 c(u). The exponential Hawkes process with
the same mean and Bartlett spectrum (the second-order-matched Hawkes) has

    n_app    = 1 - (1-n) / sqrt((1-n)^2 + p (1 - (1-n)^2)),
    beta_app = sqrt(beta^2 (1-n)^2 + p beta^2 (1 - (1-n)^2)),
    mu_app   = p Lambda (1 - n_app),

with ``beta_app (1 - n_app) = beta (1 - n)``: the decay of the covariance is
preserved. Here n_app <= n, with n_app = n at p = 1 and n_app -> 0 as p -> 0.

Spurious contagion. Let a Poisson/Cox process with no contagion have an
exponentially correlated stochastic background. A shot-noise background
nu + sum a e^{-gamma (t - s_i)} with shot rate rho is an example. Then its
second-order-matched Hawkes branching ratio is ``n = 1 - (1 + kappa)^{-1/2}``,
where ``kappa = rho a^2 / (Lambda gamma^2)`` is the excess asymptotic Fano
factor ``lim Var N(0,t] / E N(0,t] - 1`` (equivalently, ``2 sigma^2 / (Lambda gamma)``
for a background of variance sigma^2 and correlation e^{-gamma |u|}). See
Thm thm:spurious for the exact conditions.
"""

from __future__ import annotations

import numpy as np

from .model import as_rng

__all__ = [
    "thin",
    "apparent_branching",
    "apparent_beta",
    "apparent_mu",
    "inverse_apparent_branching",
    "correct_thinning",
    "spurious_branching",
    "shot_noise_equivalent_hawkes",
    "hawkes_covariance_density",
    "hawkes_count_variance",
    "thinned_count_variance",
]


def thin(events, p, rng=None, return_mask: bool = False):
    """Keep each event independently with probability p (scalar or (M,) per
    stream). ``events`` is a list of arrays or a single array."""
    rng = as_rng(rng)
    single = isinstance(events, np.ndarray) and events.ndim == 1
    ev = [events] if single else list(events)
    pk = np.broadcast_to(np.asarray(p, float), (len(ev),))
    if np.any((pk < 0) | (pk > 1)):
        raise ValueError("p must be in [0, 1]")
    masks = [rng.random(len(e)) < pk[k] for k, e in enumerate(ev)]
    out = [np.asarray(e)[m] for e, m in zip(ev, masks)]
    if single:
        out, masks = out[0], masks[0]
    return (out, masks) if return_mask else out


def apparent_branching(n, p):
    """n_app = 1 - (1-n) / sqrt((1-n)^2 + p (1 - (1-n)^2))  (Thm thm:thinning)."""
    n = np.asarray(n, float)
    p = np.asarray(p, float)
    q = (1.0 - n) ** 2
    return 1.0 - (1.0 - n) / np.sqrt(q + p * (1.0 - q))


def apparent_beta(n, beta, p):
    """beta_app = sqrt(beta^2 (1-n)^2 + p beta^2 (1 - (1-n)^2))."""
    n = np.asarray(n, float)
    q = (1.0 - n) ** 2
    return np.sqrt(np.asarray(beta, float) ** 2 * (q + np.asarray(p, float) * (1.0 - q)))


def apparent_mu(mu, n, p):
    """Background of the matched Hawkes process: p * mu / (1-n) * (1 - n_app)."""
    return np.asarray(p, float) * np.asarray(mu, float) / (1.0 - np.asarray(n, float)) * (1.0 - apparent_branching(n, p))


def inverse_apparent_branching(n_app, p):
    """Invert :func:`apparent_branching` in n for given p in (0, 1].

    With v = (1 - n_app)^2, the solution is (1 - n)^2 = v p / (1 - v + v p).
    """
    n_app = np.asarray(n_app, float)
    p = np.asarray(p, float)
    v = (1.0 - n_app) ** 2
    u = v * p / (1.0 - v + v * p)
    return 1.0 - np.sqrt(u)


def correct_thinning(n_app, beta_app, mu_app, p):
    """Dark-figure correction: map parameters fitted to recorded (p-thinned)
    data back to the true process. Returns (n, beta, mu)."""
    n = inverse_apparent_branching(n_app, p)
    beta = np.asarray(beta_app, float) * (1.0 - np.asarray(n_app, float)) / (1.0 - n)
    lam_obs = np.asarray(mu_app, float) / (1.0 - np.asarray(n_app, float))
    mu = lam_obs / np.asarray(p, float) * (1.0 - n)
    return n, beta, mu


def spurious_branching(kappa):
    """Pseudo-true branching ratio of a constant-background Hawkes fit to a
    no-contagion process with excess Fano factor kappa: 1 - (1 + kappa)^{-1/2}
    (Thm thm:spurious)."""
    return 1.0 - 1.0 / np.sqrt(1.0 + np.asarray(kappa, float))


def shot_noise_equivalent_hawkes(nu, rho, a, gamma) -> dict:
    """Second-order-equivalent exponential Hawkes process of the shot-noise Cox
    process of :func:`hawkes.simulate.simulate_shot_noise_cox` (Thm thm:equiv).

    Returns dict(rate, kappa, n, beta, mu). They satisfy beta (1 - n) = gamma and
    n = 1 - (1 + kappa)^{-1/2}.
    """
    rate = nu + rho * a / gamma
    kappa = rho * a**2 / (rate * gamma**2)
    n = spurious_branching(kappa)
    beta = gamma / (1.0 - n)
    return {"rate": rate, "kappa": kappa, "n": n, "beta": beta, "mu": rate * (1.0 - n)}


def hawkes_covariance_density(u, n, beta, rate):
    """Reduced covariance density c(u) of a stationary exp-Hawkes process."""
    u = np.abs(np.asarray(u, float))
    return rate * beta * n * (2.0 - n) / (2.0 * (1.0 - n)) * np.exp(-beta * (1.0 - n) * u)


def hawkes_count_variance(w, n, beta, rate):
    """Var N(0, w] for a stationary exp-Hawkes process (variance-time curve):
    rate w + 2 C [w / g - (1 - e^{-g w}) / g^2], with g = beta (1 - n) and
    C = c(0)."""
    w = np.asarray(w, float)
    g = beta * (1.0 - n)
    C = rate * beta * n * (2.0 - n) / (2.0 * (1.0 - n))
    return rate * w + 2.0 * C * (w / g + np.expm1(-g * w) / g**2)


def thinned_count_variance(w, n, beta, rate, p):
    """Var of p-thinned counts in a window w: p rate w + p^2 (Var - rate w)."""
    full = hawkes_count_variance(w, n, beta, rate)
    w = np.asarray(w, float)
    return p * rate * w + p**2 * (full - rate * w)
