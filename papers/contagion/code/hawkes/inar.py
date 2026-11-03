"""Discrete-time INAR(p) / Poisson autoregression approximation of a Hawkes
process on binned counts (Kirchner 2016, 2017; SPEC eq:inar).

Model for the bin counts X_t in N^M (bin width Delta)::

    E[X_t | past] = nu + sum_{l=1}^p Theta_l X_{t-l},  nu >= 0, Theta_l >= 0 (M x M).

Kirchner (2016) shows that as Delta -> 0 the bin counts of a Hawkes process
with background mu and kernel matrix Phi are approximated by an INAR(infinity)
sequence with

    nu ~= Delta * mu,     Theta_l ~= Delta * Phi(l Delta),   l = 1, 2, ...

Kirchner (2017) gives the multivariate version. The Hawkes parameters are then
recovered as

    mu_hat = nu_hat / Delta,
    Phi_hat(l Delta) = Theta_hat_l / Delta,
    A_hat = sum_{l=1}^p Theta_hat_l      (branching matrix).

For exponential kernels we also report a decay estimate
``beta_hat_kj = -log(1 - r_kj) / Delta`` with
``r_kj = sum_l Theta_l[k,j] / sum_l l Theta_l[k,j]``. This is exact for
geometric lag weights and p = infinity.

Accuracy and caveats. The approximation error is O(Delta). The first-order
mapping Theta_l ~= Delta Phi(l Delta) has, for an exponential kernel, the lag
sum ``A (beta Delta) / (e^{beta Delta} - 1) ~= A (1 - beta Delta / 2)`` (a
right-endpoint Riemann sum of int Phi), but that is NOT the limit of the fitted
lag sum. For a stationary univariate exponential Hawkes process with branching
ratio n, the CLS lag sum converges (number of bins, then p, to infinity) to
the n_Delta of Prop prop:est-binning, with

    n_Delta = n - (1/2) n (1 - n) beta Delta + O(Delta^2),

i.e. the first-order attenuation is the Riemann-sum value times (1 - n).
Example: n = 0.5 and beta Delta = 0.5 give n_Delta = 0.4413 exactly (CLS on
simulated data agrees), 0.4375 from the expansion and 0.385 from the Riemann
sum. Truncation at lag p biases A down further, by about
``A e^{-beta p Delta}``. Use beta*Delta <~ 0.1 and p*Delta >~ 5/beta. Under
coarse binning (e.g. daily counts with within-day contagion) A is
underestimated. For M > 1 no closed form is given here; the univariate
expansion is a guide only. INAR is not used in the simulation study (E1-E6).

Estimators: ``method="cls"`` is conditional least squares (OLS on the lagged
design, as in Kirchner), ``"nnls"`` is CLS with nonnegativity, and
``"poisson"`` is identity-link Poisson maximum likelihood with
nonnegativity, solved by L-BFGS-B and started from NNLS.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize, nnls

__all__ = ["INARFit", "bin_counts", "fit_inar", "inar_to_hawkes"]


@dataclass
class INARFit:
    nu: np.ndarray  # (M,) intercepts
    Theta: np.ndarray  # (p, M, M) lag matrices, Theta[l-1][k, j]
    method: str
    n_obs: int
    resid_var: np.ndarray  # (M,)

    @property
    def p(self) -> int:
        return self.Theta.shape[0]

    @property
    def lag_sum(self) -> np.ndarray:
        return self.Theta.sum(axis=0)


def bin_counts(events, T: float, delta: float) -> np.ndarray:
    """Counts of each stream in the bins [i Delta, (i+1) Delta), i < floor(T/Delta).
    Returns (n_bins, M) int array."""
    n_bins = int(np.floor(T / delta + 1e-9))
    edges = np.arange(n_bins + 1) * delta
    return np.column_stack([np.histogram(np.asarray(e), bins=edges)[0] for e in events])


def _design(X: np.ndarray, p: int) -> np.ndarray:
    n, M = X.shape
    rows = n - p
    Z = np.empty((rows, 1 + M * p))
    Z[:, 0] = 1.0
    for l in range(1, p + 1):
        Z[:, 1 + (l - 1) * M : 1 + l * M] = X[p - l : n - l]
    return Z


def _gram(X: np.ndarray, p: int) -> tuple[np.ndarray, np.ndarray]:
    """Exact Z'Z and Z'Y of the lagged design (Z = [1, X_{t-1}, ..., X_{t-p}],
    Y = X_t, t = p..n-1), from cumulative sums of lagged cross-products. This
    costs O(p n M^2) and never forms Z."""
    n, M = X.shape
    K = 1 + M * p
    G = np.empty((K, K))
    ZY = np.empty((K, M))
    cs = np.vstack([np.zeros((1, M)), np.cumsum(X, axis=0)])
    G[0, 0] = n - p
    ZY[0] = cs[n] - cs[p]
    for l in range(1, p + 1):
        v = cs[n - l] - cs[p - l]
        G[0, 1 + (l - 1) * M : 1 + l * M] = v
        G[1 + (l - 1) * M : 1 + l * M, 0] = v
    lags = np.arange(0, p + 1)
    for d in range(-p, p + 1):
        prod = np.zeros((n, M, M))
        if d >= 0:
            prod[d:] = X[d:, :, None] * X[: n - d, None, :]
        else:
            prod[: n + d] = X[: n + d, :, None] * X[-d:, None, :]
        Q = np.concatenate([np.zeros((1, M, M)), np.cumsum(prod, axis=0)])
        ls = lags[(lags + d >= 0) & (lags + d <= p)]
        for l in ls:
            m = l + d
            block = Q[n - l] - Q[p - l]  # [j, i] = sum_t X_{t-l, j} X_{t-m, i}
            if l >= 1 and m >= 1:
                G[1 + (l - 1) * M : 1 + l * M, 1 + (m - 1) * M : 1 + m * M] = block
            elif l >= 1 and m == 0:
                ZY[1 + (l - 1) * M : 1 + l * M] = block
    return G, ZY


def _fitted(X: np.ndarray, p: int, nu: np.ndarray, Theta: np.ndarray) -> np.ndarray:
    n = X.shape[0]
    out = np.tile(nu, (n - p, 1))
    for l in range(1, p + 1):
        out += X[p - l : n - l] @ Theta[l - 1].T
    return out


def fit_inar(counts, p: int, method: str = "cls") -> INARFit:
    """Fit the multivariate INAR(p)/Poisson autoregression to binned counts.

    counts : (n_bins, M) (or (n_bins,) for M = 1).
    p : number of lags.
    method : "cls" (default), "nnls" or "poisson".
    """
    X = np.asarray(counts, dtype=float)
    if X.ndim == 1:
        X = X[:, None]
    n, M = X.shape
    if n <= p + 1:
        raise ValueError("not enough bins for p lags")
    Y = X[p:]
    G, ZY = _gram(X, p)
    Z = _design(X, p) if method == "poisson" else None
    if method == "cls":
        C = np.linalg.solve(G + 1e-10 * np.eye(G.shape[0]) * np.trace(G) / G.shape[0], ZY)
    elif method in ("nnls", "poisson"):
        L = np.linalg.cholesky(G + 1e-10 * np.eye(G.shape[0]) * np.trace(G) / G.shape[0])
        C = np.empty((G.shape[0], M))
        for k in range(M):
            rhs = np.linalg.solve(L, ZY[:, k])
            C[:, k], _ = nnls(L.T, rhs, maxiter=50 * G.shape[0])
        if method == "poisson":
            for k in range(M):
                y = Y[:, k]

                def nll(c, y=y):
                    eta = Z @ c
                    eta = np.maximum(eta, 1e-12)
                    f = np.sum(eta) - np.sum(y * np.log(eta))
                    g = Z.T @ (1.0 - y / eta)
                    return f, g

                c0 = np.maximum(C[:, k], 0.0)
                c0[0] = max(c0[0], 1e-6)
                bounds = [(1e-10, None)] + [(0.0, None)] * (Z.shape[1] - 1)
                res = minimize(nll, c0, jac=True, method="L-BFGS-B", bounds=bounds, options={"maxiter": 2000})
                C[:, k] = res.x
    else:
        raise ValueError("method must be 'cls', 'nnls' or 'poisson'")
    nu = C[0]
    Theta = np.empty((p, M, M))
    for l in range(1, p + 1):
        Theta[l - 1] = C[1 + (l - 1) * M : 1 + l * M].T  # [k, j]
    resid = Y - _fitted(X, p, nu, Theta)
    return INARFit(nu=nu, Theta=Theta, method=method, n_obs=Y.shape[0], resid_var=resid.var(axis=0))


def inar_to_hawkes(fit: INARFit, delta: float) -> dict:
    """Map INAR coefficients to Hawkes parameters (Kirchner 2016, 2017).

    Returns dict(mu (M,), A (M, M) = sum of lag matrices, beta (M, M) from
    the geometric-decay moment estimator (NaN where undefined), kernel
    (p, M, M) = Theta_l / Delta evaluated at lags l * Delta, lags (p,)).
    """
    p = fit.p
    lags = np.arange(1, p + 1)
    A = fit.Theta.sum(axis=0)
    first = np.tensordot(lags, fit.Theta, axes=(0, 0))
    with np.errstate(divide="ignore", invalid="ignore"):
        r = A / first
        beta = np.where((A > 0) & (r > 0) & (r < 1), -np.log1p(-r) / delta, np.nan)
    return {
        "mu": fit.nu / delta,
        "A": A,
        "beta": beta,
        "kernel": fit.Theta / delta,
        "lags": lags * delta,
    }
