"""Model specification for multivariate exponential-kernel Hawkes processes with
exogenous shocks (SPEC "Notation").

Conditional intensity of stream k (k = 0..M-1)::

    lambda_k(t) = mu_k(t)
                + sum_e  shock_beta[k] * S_e * eta_k * exp(-eta_k (t - tau_e)) 1{t > tau_e}
                + sum_j  sum_{t_l^j < t} alpha[k, j] * beta[k, j] * exp(-beta[k, j] (t - t_l^j))

so ``alpha[k, j]`` is the expected number of direct offspring in stream k of one
event in stream j (branching matrix A), ``g_kj(t) = beta e^{-beta t}`` integrates
to one, and the shock response kernel is ``psi_k(t) = eta_k e^{-eta_k t}``
(``eta = shock_rate``).

Backgrounds ``mu`` may be

* an array of M constants;
* a :class:`PiecewiseConstant` background (exact cluster simulation);
* a :class:`LogLinearBackground` ``mu_k(t) = exp(B(t)' theta_k)`` with a
  :class:`BSplineBasis` or :class:`FourierBasis` (the EM ``background="spline"``
  output);
* any callable ``t -> (M,)`` rates (wrapped in :class:`FunctionBackground`; mark
  it ``vectorized=True`` if it maps an ``(n,)`` array to ``(n, M)``).
"""

from __future__ import annotations

from dataclasses import InitVar, dataclass, field
from typing import Callable, Sequence

import numpy as np
from scipy.interpolate import BSpline

__all__ = [
    "Background",
    "PiecewiseConstant",
    "FunctionBackground",
    "BSplineBasis",
    "FourierBasis",
    "LogLinearBackground",
    "HawkesSpec",
    "spectral_radius",
    "multiplier",
    "contagion_multiplier",
    "stationary_mean",
    "merge_events",
    "as_rng",
    "gauss_legendre_cells",
]

# 8-point Gauss-Legendre rule on [0, 1]
_GL_X, _GL_W = np.polynomial.legendre.leggauss(8)
_GL_X = 0.5 * (_GL_X + 1.0)
_GL_W = 0.5 * _GL_W


def as_rng(rng) -> np.random.Generator:
    """Return a numpy Generator from a Generator, an int seed or None."""
    if isinstance(rng, np.random.Generator):
        return rng
    return np.random.default_rng(rng)


def gauss_legendre_cells(edges: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Nodes and weights of the composite 8-point Gauss-Legendre rule on the
    cells ``[edges[i], edges[i+1]]``. Returns flat arrays (8 * n_cells,)."""
    edges = np.asarray(edges, dtype=float)
    h = np.diff(edges)
    nodes = edges[:-1, None] + h[:, None] * _GL_X[None, :]
    weights = h[:, None] * _GL_W[None, :]
    return nodes.ravel(), weights.ravel()


# ---------------------------------------------------------------------------
# Backgrounds
# ---------------------------------------------------------------------------


class Background:
    """Base class for time-varying backgrounds.

    Subclasses implement ``rate(t)`` for an (n,) array returning (n, M), and may
    override ``cumulative`` (``int_0^t mu``) and ``max_rate`` (an upper bound
    on [0, T] used for thinning).
    """

    M: int = 1
    vectorized = True

    def rate(self, t: np.ndarray) -> np.ndarray:  # pragma: no cover - abstract
        raise NotImplementedError

    def __call__(self, t):
        scalar = np.ndim(t) == 0
        out = self.rate(np.atleast_1d(np.asarray(t, dtype=float)))
        return out[0] if scalar else out

    # generic numerical quadrature (composite 8-point Gauss-Legendre)
    def _cells(self, t_max: float) -> np.ndarray:
        n_cells = 2048
        return np.linspace(0.0, t_max, n_cells + 1)

    def cumulative(self, t) -> np.ndarray:
        """``int_0^t mu_k(s) ds`` for each t (n,) -> (n, M). Needs t >= 0."""
        t = np.atleast_1d(np.asarray(t, dtype=float))
        if t.size == 0:
            return np.zeros((0, self.M))
        if np.any(t < 0):
            raise ValueError("cumulative() needs t >= 0")
        t_max = float(t.max())
        if t_max == 0.0:
            return np.zeros((t.size, self.M))
        edges = self._cells(t_max)
        nodes, w = gauss_legendre_cells(edges)
        vals = self.rate(nodes) * w[:, None]
        n_cells = edges.size - 1
        cell_int = vals.reshape(n_cells, 8, self.M).sum(axis=1)
        cum_edges = np.vstack([np.zeros((1, self.M)), np.cumsum(cell_int, axis=0)])
        c = np.clip(np.searchsorted(edges, t, side="right") - 1, 0, n_cells - 1)
        left = edges[c]
        h = t - left
        pn = left[:, None] + h[:, None] * _GL_X[None, :]
        pv = self.rate(pn.ravel()).reshape(t.size, 8, self.M)
        partial = np.einsum("nqm,q->nm", pv, _GL_W) * h[:, None]
        return cum_edges[c] + partial

    def integral(self, a: float, b: float) -> np.ndarray:
        """``int_a^b mu(s) ds`` (M,), 0 <= a <= b."""
        c = self.cumulative(np.array([a, b]))
        return c[1] - c[0]

    def max_rate(self, T: float) -> np.ndarray:
        """Upper bound of mu_k on [0, T] (grid maximum times a 5% margin)."""
        grid = np.linspace(0.0, T, 20001)
        return 1.05 * self.rate(grid).max(axis=0) + 1e-12


class PiecewiseConstant(Background):
    """Piecewise-constant background with ``values[p]`` on
    ``[breaks[p], breaks[p+1])``; the first and last pieces extend to infinity.

    breaks : (P+1,) increasing; values : (P, M) (or (P,) for M = 1).
    """

    def __init__(self, breaks: Sequence[float], values):
        self.breaks = np.asarray(breaks, dtype=float)
        v = np.asarray(values, dtype=float)
        if v.ndim == 1:
            v = v[:, None]
        if v.shape[0] != self.breaks.size - 1:
            raise ValueError("values must have len(breaks) - 1 rows")
        if np.any(np.diff(self.breaks) <= 0):
            raise ValueError("breaks must be strictly increasing")
        if np.any(v < 0):
            raise ValueError("background rates must be >= 0")
        self.values = v
        self.M = v.shape[1]
        seg = np.diff(self.breaks)[:, None] * v
        self._cumF = np.vstack([np.zeros((1, self.M)), np.cumsum(seg, axis=0)])

    def _piece(self, t):
        return np.clip(np.searchsorted(self.breaks, t, side="right") - 1, 0, self.values.shape[0] - 1)

    def rate(self, t):
        return self.values[self._piece(t)]

    def _F(self, t):
        p = self._piece(t)
        return self._cumF[p] + (t - self.breaks[p])[:, None] * self.values[p]

    def cumulative(self, t):
        t = np.atleast_1d(np.asarray(t, dtype=float))
        return self._F(t) - self._F(np.zeros(1))

    def max_rate(self, T):
        p0, p1 = self._piece(np.array([0.0, T]))
        return self.values[p0 : p1 + 1].max(axis=0)

    def pieces_on(self, T: float):
        """List of (a, b, values (M,)) covering [0, T]."""
        cuts = np.concatenate([[0.0], self.breaks[(self.breaks > 0) & (self.breaks < T)], [T]])
        out = []
        for a, b in zip(cuts[:-1], cuts[1:]):
            out.append((float(a), float(b), self.rate(np.array([0.5 * (a + b)]))[0]))
        return out


class FunctionBackground(Background):
    """Wrap a user callable ``f(t) -> (M,)`` (or ``(n,) -> (n, M)`` if
    ``vectorized``). ``bound`` (M,) is an optional known upper bound for
    thinning; otherwise a grid maximum with a 5% margin is used."""

    def __init__(self, f: Callable, M: int, vectorized: bool | None = None, bound=None):
        self.f = f
        self.M = int(M)
        self.is_vec = bool(getattr(f, "vectorized", False) if vectorized is None else vectorized)
        self.bound = None if bound is None else np.broadcast_to(np.asarray(bound, float), (self.M,)).copy()

    def rate(self, t):
        if self.is_vec:
            out = np.asarray(self.f(t), dtype=float)
            return out.reshape(t.size, self.M)
        return np.array([np.asarray(self.f(float(s)), dtype=float).reshape(self.M) for s in t]).reshape(
            t.size, self.M
        )

    def max_rate(self, T):
        if self.bound is not None:
            return self.bound
        return super().max_rate(T)


class BSplineBasis:
    """Clamped B-spline basis of ``degree`` with ``n_basis`` functions and
    equally spaced interior knots on [0, T]. Evaluation clips t to [0, T].
    The functions sum to one, so ``theta_k = log(c) * 1`` is the constant c."""

    def __init__(self, T: float, n_basis: int = 8, degree: int = 3):
        if n_basis < degree + 1:
            raise ValueError("n_basis must be >= degree + 1")
        self.T = float(T)
        self.n_basis = int(n_basis)
        self.degree = int(degree)
        n_int = n_basis - degree - 1
        interior = np.linspace(0.0, T, n_int + 2)[1:-1]
        self.knots = np.concatenate([np.zeros(degree + 1), interior, np.full(degree + 1, self.T)])
        self.edges = np.concatenate([[0.0], interior, [self.T]])

    def __call__(self, t) -> np.ndarray:
        t = np.clip(np.atleast_1d(np.asarray(t, dtype=float)), 0.0, self.T)
        return BSpline.design_matrix(t, self.knots, self.degree).toarray()

    def cells(self) -> np.ndarray:
        """Quadrature cells: each knot interval split into 16."""
        sub = []
        for a, b in zip(self.edges[:-1], self.edges[1:]):
            sub.append(np.linspace(a, b, 17)[:-1])
        return np.concatenate(sub + [[self.T]])


class FourierBasis:
    """Seasonal basis ``[1, cos(2 pi h t / P), sin(2 pi h t / P)]_{h<=H}``
    (optionally plus a linear trend t/T)."""

    def __init__(self, T: float, period: float, n_harmonics: int = 2, trend: bool = False):
        self.T = float(T)
        self.period = float(period)
        self.n_harmonics = int(n_harmonics)
        self.trend = bool(trend)
        self.n_basis = 1 + 2 * self.n_harmonics + int(self.trend)

    def __call__(self, t) -> np.ndarray:
        t = np.atleast_1d(np.asarray(t, dtype=float))
        cols = [np.ones_like(t)]
        for h in range(1, self.n_harmonics + 1):
            w = 2.0 * np.pi * h * t / self.period
            cols += [np.cos(w), np.sin(w)]
        if self.trend:
            cols.append(t / self.T)
        return np.column_stack(cols)

    def cells(self) -> np.ndarray:
        n = int(max(64, 32 * np.ceil(self.T / self.period) * max(self.n_harmonics, 1)))
        return np.linspace(0.0, self.T, min(n, 20000) + 1)


class LogLinearBackground(Background):
    """``mu_k(t) = exp(B(t)' theta_k)``; theta (M, n_basis). Integrals use the
    composite Gauss-Legendre rule on ``basis.cells()`` (exact to ~1e-12 for
    smooth bases)."""

    def __init__(self, theta, basis):
        th = np.asarray(theta, dtype=float)
        if th.ndim == 1:
            th = th[None, :]
        self.theta = th
        self.basis = basis
        self.M = th.shape[0]
        self.T = basis.T
        self._edges = basis.cells()
        self._qn, self._qw = gauss_legendre_cells(self._edges)
        self._Bq = basis(self._qn)

    def rate(self, t):
        return np.exp(self.basis(t) @ self.theta.T)

    def _cells(self, t_max):
        e = self._edges
        if t_max <= self.T:
            return np.concatenate([e[e < t_max], [t_max]])
        return np.concatenate([e, np.linspace(self.T, t_max, 65)[1:]])

    def cumulative(self, t):
        t = np.atleast_1d(np.asarray(t, dtype=float))
        if t.size == 0:
            return np.zeros((0, self.M))
        if np.any(t < 0):
            raise ValueError("cumulative() needs t >= 0")
        edges = np.asarray(self._cells(float(t.max())), dtype=float)
        if edges.size < 2:
            return np.zeros((t.size, self.M))
        nodes, w = gauss_legendre_cells(edges)
        n_cells = edges.size - 1
        cell_int = (self.rate(nodes) * w[:, None]).reshape(n_cells, 8, self.M).sum(axis=1)
        cum_edges = np.vstack([np.zeros((1, self.M)), np.cumsum(cell_int, axis=0)])
        c = np.clip(np.searchsorted(edges, t, side="right") - 1, 0, n_cells - 1)
        left = edges[c]
        h = t - left
        pn = left[:, None] + h[:, None] * _GL_X[None, :]
        pv = self.rate(pn.ravel()).reshape(t.size, 8, self.M)
        return cum_edges[c] + np.einsum("nqm,q->nm", pv, _GL_W) * h[:, None]

    def integral_T(self) -> np.ndarray:
        """``int_0^T mu_k`` (M,) via the cached quadrature."""
        return (np.exp(self._Bq @ self.theta.T) * self._qw[:, None]).sum(axis=0)

    def max_rate(self, T):
        grid = np.concatenate([np.linspace(0.0, T, 20001), self._qn[self._qn <= T]])
        return 1.05 * self.rate(grid).max(axis=0) + 1e-12


# ---------------------------------------------------------------------------
# Spec
# ---------------------------------------------------------------------------


@dataclass
class HawkesSpec:
    """Multivariate exponential-kernel Hawkes process with exogenous shocks.

    Parameters
    ----------
    M : number of streams.
    mu : (M,) constants, a :class:`Background`, or a callable t -> (M,).
    alpha : (M, M) branching matrix A, ``alpha[k, j]`` = expected direct
        offspring in k per event in j.
    beta : scalar or (M, M) kernel decay rates (g = beta e^{-beta t}).
    shocks : list of (tau_e, S_e).
    shock_beta : (M,) loadings beta_k (default zeros).
    shock_rate : scalar or (M,) response rates eta_k (psi = eta e^{-eta t}).
        ``shock_kernel_rate`` is accepted as an alias in the constructor.
    """

    M: int
    mu: object
    alpha: np.ndarray
    beta: object = 1.0
    shocks: list = field(default_factory=list)
    shock_beta: np.ndarray | None = None
    shock_rate: object = 1.0
    shock_kernel_rate: InitVar[object] = None

    def __post_init__(self, shock_kernel_rate=None):
        self.M = int(self.M)
        M = self.M
        if shock_kernel_rate is not None:
            self.shock_rate = shock_kernel_rate
        if isinstance(self.mu, Background):
            if self.mu.M != M:
                raise ValueError("background dimension != M")
        elif callable(self.mu):
            self.mu = FunctionBackground(self.mu, M)
        else:
            mu = np.asarray(self.mu, dtype=float)
            if mu.ndim == 0:
                mu = np.full(M, float(mu))
            if mu.shape != (M,):
                raise ValueError(f"mu must have shape ({M},)")
            if np.any(mu < 0):
                raise ValueError("mu must be >= 0")
            self.mu = mu
        a = np.asarray(self.alpha, dtype=float)
        if a.ndim == 0:
            a = np.full((M, M), float(a))
        if a.shape != (M, M):
            raise ValueError(f"alpha must have shape ({M},{M})")
        if np.any(a < 0):
            raise ValueError("alpha must be >= 0")
        self.alpha = a
        b = np.asarray(self.beta, dtype=float)
        if b.ndim == 0:
            self.beta = float(b)
        else:
            if b.shape != (M, M):
                raise ValueError(f"beta must be scalar or ({M},{M})")
            self.beta = b.copy()
        if np.any(np.asarray(self.beta) <= 0):
            raise ValueError("beta must be > 0")
        self.shocks = [(float(tau), float(S)) for tau, S in (self.shocks or [])]
        if self.shock_beta is None:
            self.shock_beta = np.zeros(M)
        sb = np.asarray(self.shock_beta, dtype=float)
        if sb.ndim == 0:
            sb = np.full(M, float(sb))
        if sb.shape != (M,):
            raise ValueError(f"shock_beta must have shape ({M},)")
        self.shock_beta = sb
        sr = np.asarray(self.shock_rate, dtype=float)
        if np.any(sr <= 0):
            raise ValueError("shock_rate must be > 0")
        self.shock_rate = float(sr) if sr.ndim == 0 else sr.reshape(M).copy()

    # -- convenience views ------------------------------------------------
    @property
    def beta_matrix(self) -> np.ndarray:
        return np.broadcast_to(np.asarray(self.beta, dtype=float), (self.M, self.M)).copy()

    @property
    def shock_rate_vec(self) -> np.ndarray:
        return np.broadcast_to(np.asarray(self.shock_rate, dtype=float), (self.M,)).copy()

    @property
    def shock_times(self) -> np.ndarray:
        return np.array([s[0] for s in self.shocks], dtype=float)

    @property
    def shock_sizes(self) -> np.ndarray:
        return np.array([s[1] for s in self.shocks], dtype=float)

    @property
    def constant_mu(self) -> bool:
        return isinstance(self.mu, np.ndarray)

    def mu_at(self, t) -> np.ndarray:
        """Background rates at times t (n,) -> (n, M)."""
        t = np.atleast_1d(np.asarray(t, dtype=float))
        if self.constant_mu:
            return np.broadcast_to(self.mu, (t.size, self.M)).copy()
        return self.mu.rate(t)

    def mu_cumulative(self, t) -> np.ndarray:
        """``int_0^t mu_k`` (n, M)."""
        t = np.atleast_1d(np.asarray(t, dtype=float))
        if self.constant_mu:
            return t[:, None] * self.mu[None, :]
        return self.mu.cumulative(t)

    def mu_bar(self, T: float | None = None) -> np.ndarray:
        """Constant mu, or the time average of mu over [0, T]."""
        if self.constant_mu:
            return self.mu.copy()
        if T is None:
            raise ValueError("time-varying background: pass T to average over [0, T]")
        return self.mu_cumulative(np.array([T]))[0] / T

    def spectral_radius(self) -> float:
        return spectral_radius(self.alpha)

    def multiplier(self) -> np.ndarray:
        return multiplier(self.alpha)

    def stationary_mean(self, T: float | None = None) -> np.ndarray:
        return stationary_mean(self, T=T)

    def copy(self, **changes) -> "HawkesSpec":
        """A deep-ish copy with optional field changes."""
        kw = dict(
            M=self.M,
            mu=self.mu.copy() if isinstance(self.mu, np.ndarray) else self.mu,
            alpha=self.alpha.copy(),
            beta=np.copy(self.beta) if np.ndim(self.beta) else self.beta,
            shocks=list(self.shocks),
            shock_beta=self.shock_beta.copy(),
            shock_rate=np.copy(self.shock_rate) if np.ndim(self.shock_rate) else self.shock_rate,
        )
        kw.update(changes)
        return HawkesSpec(**kw)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def spectral_radius(A) -> float:
    """rho(A) = max |eigenvalue|."""
    A = np.atleast_2d(np.asarray(A, dtype=float))
    return float(np.max(np.abs(np.linalg.eigvals(A))))


def multiplier(A) -> np.ndarray:
    """Contagion multiplier M = (I - A)^{-1} (requires rho(A) < 1)."""
    A = np.atleast_2d(np.asarray(A, dtype=float))
    if spectral_radius(A) >= 1:
        raise ValueError("spectral radius >= 1: (I - A)^{-1} is not the multiplier")
    return np.linalg.inv(np.eye(A.shape[0]) - A)


contagion_multiplier = multiplier


def stationary_mean(spec_or_mu, A=None, T: float | None = None) -> np.ndarray:
    """Stationary mean rate Lambda_bar = (I - A)^{-1} mu.

    Call as ``stationary_mean(spec)`` (time-averaged mu over [0, T] if the
    background varies) or ``stationary_mean(mu, A)``. Shocks are excluded.
    """
    if isinstance(spec_or_mu, HawkesSpec):
        mu = spec_or_mu.mu_bar(T)
        A = spec_or_mu.alpha
    else:
        mu = np.atleast_1d(np.asarray(spec_or_mu, dtype=float))
    return multiplier(A) @ mu


def merge_events(events: Sequence[np.ndarray]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Merge per-stream event arrays into one time-sorted sequence.

    Returns (times, dims, pos) where ``pos[i]`` is the index of event i within
    its own stream. Ties are broken by stream index (stable). This order defines
    the *global index* used by the branching labels of
    :func:`hawkes.simulate.simulate`.
    """
    times = np.concatenate([np.asarray(e, dtype=float) for e in events]) if len(events) else np.zeros(0)
    dims = np.concatenate([np.full(len(e), k, dtype=np.int64) for k, e in enumerate(events)]) if len(events) else np.zeros(0, np.int64)
    pos = np.concatenate([np.arange(len(e), dtype=np.int64) for e in events]) if len(events) else np.zeros(0, np.int64)
    order = np.lexsort((dims, times))
    return times[order], dims[order], pos[order]
