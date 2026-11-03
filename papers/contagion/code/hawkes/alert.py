"""Forecasting and alerting (Thm thm:alert, Alg alg:alert).

Predictive distribution
------------------------
For exponential kernels, the history before t enters the future only through
the excitation state ``E_kj(t) = sum_{t_l^j <= t} alpha_kj beta_kj e^{-beta_kj (t - t_l^j)}``.
The pending offspring of past events arriving in stream k after t form a Poisson
process with intensity ``sum_j E_kj(t) e^{-beta_kj (s - t)}``, because a
superposition of independent Poisson offspring processes is Poisson. So the
future on (t, t + Delta] is simulated exactly by the cluster method. Its
generation 0 consists of:

1. background immigrants on (t, t + Delta];
2. the remaining immigrants of shocks with tau_e <= t (and optionally of
   future shocks, if they are known in advance);
3. the pending offspring of the history described by E(t).

Generation 0 then cascades. All ``n_sim`` replicates are generated together
in one vectorised pass.

Optimal alert rule
-------------------
Suppose a surge is the event {N(t, t + Delta] >= c} (summed over chosen
streams), a false alarm costs c_FA and a missed surge costs c_miss. The Bayes
rule then alerts iff ``P(surge | H_t) >= pi* = c_FA / (c_FA + c_miss)``.

If the state is one-dimensional (M = 1, or states along a fixed direction D,
E = s D), P(surge | state) is non-decreasing in s by the monotone coupling of
the cluster representation. The rule is therefore equivalent to a threshold
on the current intensity. :func:`alert_rule_intensity` finds it, using a
coupled simulation that is exactly monotone in s.
"""

from __future__ import annotations

import numpy as np
from scipy.linalg import expm

from .attribution import _background_cumulative, _shock_generator, shock_response_counts
from .model import HawkesSpec, as_rng
from .simulate import _background_immigrants, _shock_immigrants, cascade

__all__ = [
    "excitation_state",
    "predictive_count_dist",
    "predictive_mean",
    "exceedance_probability",
    "optimal_alert_threshold",
    "alert_decision",
    "alert_rule_intensity",
]


def excitation_state(spec: HawkesSpec, history_events, t: float) -> np.ndarray:
    """E_kj(t) = sum_{t_l^j <= t} alpha_kj beta_kj exp(-beta_kj (t - t_l^j)), (M, M).
    ``lambda_k(t+) = mu_k(t) + shock terms + sum_j E_kj(t)``."""
    M = spec.M
    Bm = spec.beta_matrix
    E = np.zeros((M, M))
    for j in range(M):
        past = np.asarray(history_events[j], float)
        past = past[past <= t]
        if past.size == 0:
            continue
        for k in range(M):
            if spec.alpha[k, j] > 0:
                E[k, j] = spec.alpha[k, j] * Bm[k, j] * np.sum(np.exp(-Bm[k, j] * (t - past)))
    return E


def _pending_offspring(spec, E, t, Delta, n_sim, rng, marks_max=None):
    """Poisson offspring of the history state E on (t, t + Delta].
    Returns times, dims, rep (and uniform marks in [0, marks_max] if given)."""
    M = spec.M
    Bm = spec.beta_matrix
    ts, ds, rs, ys = [], [], [], []
    for k in range(M):
        for j in range(M):
            if E[k, j] <= 0:
                continue
            b = Bm[k, j]
            F = -np.expm1(-b * Delta)
            n = rng.poisson(E[k, j] / b * F, size=n_sim)
            tot = int(n.sum())
            U = rng.random(tot)
            ts.append(t - np.log1p(-U * F) / b)
            ds.append(np.full(tot, k, np.int64))
            rs.append(np.repeat(np.arange(n_sim), n))
            if marks_max is not None:
                ys.append(marks_max * rng.random(tot))
    if not ts:
        z = np.zeros(0)
        out = (z, z.astype(np.int64), z.astype(np.int64))
        return out + ((z,) if marks_max is not None else ())
    out = (np.minimum(np.concatenate(ts), t + Delta), np.concatenate(ds), np.concatenate(rs))
    return out + ((np.concatenate(ys),) if marks_max is not None else ())


def _future_counts(spec, E, t, Delta, n_sim, rng, include_future_shocks=False, include_shocks=True):
    M = spec.M
    tb, db, rb = _background_immigrants(spec, t, t + Delta, rng, n_rep=n_sim)
    parts_t, parts_d, parts_r = [tb], [db], [rb]
    if include_shocks and spec.shocks:
        ids = [e for e, (tau, _) in enumerate(spec.shocks) if include_future_shocks or tau <= t]
        ts_, ds_, rs_, _ = _shock_immigrants(spec, t, t + Delta, rng, n_rep=n_sim, shock_ids=ids)
        parts_t.append(ts_)
        parts_d.append(ds_)
        parts_r.append(rs_)
    th, dh, rh = _pending_offspring(spec, E, t, Delta, n_sim, rng)
    parts_t.append(th)
    parts_d.append(dh)
    parts_r.append(rh)
    t0 = np.concatenate(parts_t)
    d0 = np.concatenate(parts_d)
    r0 = np.concatenate(parts_r)
    _, dims, _, _, carry = cascade(spec.alpha, spec.beta_matrix, t0, d0, t + Delta, rng, carry={"rep": r0})
    return np.bincount(carry["rep"] * M + dims, minlength=n_sim * M).reshape(n_sim, M)


def predictive_count_dist(
    spec: HawkesSpec,
    history_events,
    t: float,
    Delta: float,
    n_sim: int = 10000,
    rng=None,
    include_future_shocks: bool = False,
) -> np.ndarray:
    """Monte Carlo predictive distribution of N_k(t, t + Delta] given the
    history up to t (events at times <= t). The continuation is exact via the
    exponential-kernel state.

    Returns an (n_sim, M) int array of simulated future counts.
    """
    rng = as_rng(rng)
    E = excitation_state(spec, history_events, t)
    return _future_counts(spec, E, t, Delta, n_sim, rng, include_future_shocks)


def predictive_mean(
    spec: HawkesSpec, history_events, t: float, Delta: float, include_future_shocks: bool = False
) -> np.ndarray:
    """Exact E[N_k(t, t + Delta] | H_t] (M,), computed with the matrix
    exponential of the linear ODE system of :mod:`hawkes.attribution`.
    It is the sum of the new background clusters, the pending offspring of the
    history state E(t) and their cascades, and the remaining shock
    immigrants."""
    E = excitation_state(spec, history_events, t)
    out = _background_cumulative(spec, np.array([t + Delta]), t_start=t)[0]
    # pending offspring of the history: the linear system started at x(0) = E, s = 0
    L, iS, iX, iD, iC = _shock_generator(spec.alpha, spec.beta_matrix, spec.shock_rate_vec)
    z0 = np.zeros(L.shape[0])
    z0[iX] = E
    out = out + (expm(L * Delta) @ z0)[iC]
    for e, (tau, S) in enumerate(spec.shocks):
        if tau > t and not include_future_shocks:
            continue
        if tau >= t + Delta:
            continue
        start = max(tau, t)
        eta = spec.shock_rate_vec
        s0 = spec.shock_beta * S * eta * np.exp(-eta * (start - tau))
        D, C = shock_response_counts(spec, s0, np.array([t + Delta - start]))
        out = out + D[0] + C[0]
    return out


def exceedance_probability(counts: np.ndarray, c: float, streams=None) -> float:
    """P(sum_{k in streams} N_k >= c) from simulated counts (n_sim, M)."""
    counts = np.asarray(counts)
    s = counts.sum(axis=1) if streams is None else counts[:, np.atleast_1d(streams)].sum(axis=1)
    return float(np.mean(s >= c))


def optimal_alert_threshold(c_fa: float, c_miss: float) -> float:
    """pi* = c_FA / (c_FA + c_miss): alert iff P(surge | history) >= pi*."""
    if c_fa < 0 or c_miss < 0 or c_fa + c_miss <= 0:
        raise ValueError("costs must be nonnegative and not both zero")
    return float(c_fa / (c_fa + c_miss))


def alert_decision(prob, c_fa: float, c_miss: float):
    """Bayes decision: True where prob >= pi*."""
    return np.asarray(prob) >= optimal_alert_threshold(c_fa, c_miss)


def alert_rule_intensity(
    spec: HawkesSpec,
    Delta: float,
    c: float,
    pi_star: float | None = None,
    c_fa: float | None = None,
    c_miss: float | None = None,
    n_sim: int = 4000,
    rng=None,
    streams=None,
    state_direction=None,
    t: float = 0.0,
    n_grid: int = 200,
    s_max: float | None = None,
) -> dict:
    """Intensity threshold that is equivalent to the probability rule.

    The excitation state is E = s * D (D = ``state_direction``; for M = 1,
    D = [[1]], so s = lambda(t) - mu). By default, for M > 1, D is proportional to
    alpha * beta (one recent event in each stream), normalised so that
    s = sum_k (lambda_k - mu_k). P(N_streams(t, t+Delta] >= c | s) is estimated
    on a grid of s with a coupled simulation. The pending-offspring
    immigrants carry uniform marks y, and those with y <= s are kept, so the
    estimate is monotone in s. The threshold s* is the smallest s with
    P >= pi*. Shocks are ignored; mu is evaluated at time t.

    Returns dict(s_star, lambda_star (= sum over streams of mu_k(t) + s* sum_j D_kj),
    grid, prob, pi_star). lambda_star is +inf if no s up to s_max reaches pi*.
    """
    rng = as_rng(rng)
    M = spec.M
    if pi_star is None:
        if c_fa is None or c_miss is None:
            raise ValueError("give pi_star or (c_fa, c_miss)")
        pi_star = optimal_alert_threshold(c_fa, c_miss)
    if state_direction is None:
        D = spec.alpha * spec.beta_matrix
        D = D / D.sum() if D.sum() > 0 else np.eye(M) / M
    else:
        D = np.asarray(state_direction, float).reshape(M, M)
    sel = np.arange(M) if streams is None else np.atleast_1d(streams)
    sel_mask = np.zeros(M, bool)
    sel_mask[sel] = True
    bg = _future_counts(spec, np.zeros((M, M)), t, Delta, n_sim, rng, include_shocks=False)[:, sel].sum(axis=1)
    p0 = float(np.mean(bg >= c))
    mu_t = spec.mu_at(np.array([t]))[0]
    lam_of_s = lambda s: float(np.sum(mu_t[sel] + s * D[sel].sum(axis=1)))
    if p0 >= pi_star:
        return {"s_star": 0.0, "lambda_star": lam_of_s(0.0), "grid": np.array([0.0]), "prob": np.array([p0]), "pi_star": pi_star}
    if s_max is None:
        b = float(np.max(spec.beta_matrix))
        s_max = 2.0 * max(c, 1.0) * b / max(-np.expm1(-b * Delta), 1e-12)
    for _ in range(30):
        th, dh, rh, yh = _pending_offspring(spec, D * s_max, t, Delta, n_sim, rng, marks_max=s_max)
        n0 = th.size
        _, dims, _, _, carry = cascade(
            spec.alpha, spec.beta_matrix, th, dh, t + Delta, rng, carry={"root": np.arange(n0)}
        )
        contrib = np.bincount(carry["root"][sel_mask[dims]], minlength=n0).astype(float)
        grid = np.linspace(0.0, s_max, n_grid + 1)
        probs = np.empty(grid.size)
        for g, s in enumerate(grid):
            keep = yh <= s
            nh = np.bincount(rh[keep], weights=contrib[keep], minlength=n_sim)
            probs[g] = np.mean(bg + nh >= c)
        if probs[-1] >= pi_star:
            break
        s_max *= 2.0
    else:
        return {"s_star": np.inf, "lambda_star": np.inf, "grid": grid, "prob": probs, "pi_star": pi_star}
    g = int(np.argmax(probs >= pi_star))
    if g == 0:
        s_star = 0.0
    else:
        p_lo, p_hi = probs[g - 1], probs[g]
        frac = (pi_star - p_lo) / (p_hi - p_lo) if p_hi > p_lo else 1.0
        s_star = float(grid[g - 1] + frac * (grid[g] - grid[g - 1]))
    return {"s_star": s_star, "lambda_star": lam_of_s(s_star), "grid": grid, "prob": probs, "pi_star": pi_star}
