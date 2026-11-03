"""Exact simulation of multivariate exponential Hawkes processes with shocks.

``method="cluster"`` (the default) uses the Poisson cluster (branching)
representation (Hawkes & Oakes 1974). Immigrants are background events and
shock-triggered events, and each event in stream j has Poisson(alpha[k, j])
children in stream k at Exp(beta[k, j]) delays. Children after T are dropped
with their descendants. For constant and piecewise-constant backgrounds, the
background immigrants are drawn directly. For any other (callable)
background they are drawn by Lewis-Shedler / Ogata thinning against an upper
bound. Every step is exact, and the generation-by-generation sampling is
vectorised.

``method="ogata"`` is Ogata's (1981) thinning algorithm for the whole process.
It uses the exponential-kernel state and is an independent exact algorithm,
used in the tests as a cross-check.

Branching labels (``return_branching=True``): for each stream k an int array
``labels[k]`` of the same length as ``events[k]``, holding -1 for a background
immigrant, -2-e for an immigrant triggered by shock e, and otherwise the
*global index* of the parent. The global index is the position in the merged
time-sorted sequence of :func:`hawkes.model.merge_events`.
"""

from __future__ import annotations

import numpy as np

from .model import Background, HawkesSpec, PiecewiseConstant, as_rng, merge_events, spectral_radius

__all__ = [
    "simulate",
    "simulate_shot_noise_cox",
    "cluster_info",
    "cascade",
]


def cascade(alpha, beta, t0, d0, t_end, rng, carry=None, max_events=10_000_000):
    """Generate all descendants (with times <= t_end) of generation-0 points.

    Parameters
    ----------
    alpha, beta : (M, M) arrays.
    t0, d0 : times and streams of the generation-0 points.
    t_end : scalar horizon.
    carry : optional dict of per-point arrays inherited by children (e.g. a
        simulation index or a root id).

    Returns
    -------
    times, dims, parent (index into the returned arrays, -1 for gen-0),
    generation, carry (dict of concatenated arrays).
    """
    alpha = np.asarray(alpha, float)
    beta = np.asarray(beta, float)
    M = alpha.shape[0]
    t0 = np.asarray(t0, float)
    d0 = np.asarray(d0, np.int64)
    carry = {k: np.asarray(v) for k, v in (carry or {}).items()}
    T_list, D_list, P_list, G_list = [t0], [d0], [np.full(t0.size, -1, np.int64)], [np.zeros(t0.size, np.int64)]
    C_lists = {k: [v] for k, v in carry.items()}
    cur_t, cur_d, cur_idx = t0, d0, np.arange(t0.size)
    cur_carry = carry
    total = t0.size
    gen = 0
    while cur_t.size:
        gen += 1
        n_cur = cur_t.size
        lam = alpha[:, cur_d]  # (M, n_cur)
        counts = rng.poisson(lam).ravel()
        n_new = int(counts.sum())
        if n_new == 0:
            break
        rep = np.repeat(np.arange(M * n_cur), counts)
        kk = rep // n_cur
        pp = rep % n_cur
        ct = cur_t[pp] + rng.standard_exponential(n_new) / beta[kk, cur_d[pp]]
        keep = ct <= t_end
        ct, kk, pp = ct[keep], kk[keep], pp[keep]
        m = ct.size
        if m == 0:
            break
        new_idx = np.arange(total, total + m)
        total += m
        if total > max_events:
            raise RuntimeError(
                f"more than {max_events} events: the process is (nearly) explosive, rho(A) = {spectral_radius(alpha):.3f}"
            )
        T_list.append(ct)
        D_list.append(kk)
        P_list.append(cur_idx[pp])
        G_list.append(np.full(m, gen, np.int64))
        cur_carry = {k: v[pp] for k, v in cur_carry.items()}
        for k, v in cur_carry.items():
            C_lists[k].append(v)
        cur_t, cur_d, cur_idx = ct, kk, new_idx
    return (
        np.concatenate(T_list),
        np.concatenate(D_list),
        np.concatenate(P_list),
        np.concatenate(G_list),
        {k: np.concatenate(v) for k, v in C_lists.items()},
    )


def _background_immigrants(spec: HawkesSpec, a: float, b: float, rng, mu_bound=None, n_rep: int = 1):
    """Background immigrants on (a, b] for n_rep independent replicates.
    Returns times, dims, replicate index."""
    M = spec.M
    L = b - a
    ts, ds, rs = [], [], []
    if L <= 0:
        z = np.zeros(0)
        return z, z.astype(np.int64), z.astype(np.int64)
    if spec.constant_mu or isinstance(spec.mu, PiecewiseConstant):
        if spec.constant_mu:
            pieces = [(a, b, spec.mu)]
        else:
            pieces = [(max(p0, a), min(p1, b), v) for p0, p1, v in spec.mu.pieces_on(b) if p1 > a]
        for p0, p1, v in pieces:
            if p1 <= p0:
                continue
            for k in range(M):
                if v[k] <= 0:
                    continue
                n = rng.poisson(v[k] * (p1 - p0), size=n_rep)
                tot = int(n.sum())
                ts.append(p0 + (p1 - p0) * rng.random(tot))
                ds.append(np.full(tot, k, np.int64))
                rs.append(np.repeat(np.arange(n_rep), n))
    else:
        bound = np.broadcast_to(np.asarray(mu_bound if mu_bound is not None else spec.mu.max_rate(b), float), (M,))
        for k in range(M):
            if bound[k] <= 0:
                continue
            n = rng.poisson(bound[k] * L, size=n_rep)
            tot = int(n.sum())
            t = a + L * rng.random(tot)
            r = np.repeat(np.arange(n_rep), n)
            mu_t = spec.mu.rate(t)[:, k] if tot else np.zeros(0)
            if np.any(mu_t > bound[k] * (1 + 1e-12)):
                raise ValueError("background exceeds its thinning bound; pass a larger mu_bound")
            acc = rng.random(tot) * bound[k] < mu_t
            ts.append(t[acc])
            ds.append(np.full(int(acc.sum()), k, np.int64))
            rs.append(r[acc])
    if not ts:
        z = np.zeros(0)
        return z, z.astype(np.int64), z.astype(np.int64)
    return np.concatenate(ts), np.concatenate(ds), np.concatenate(rs)


def _shock_immigrants(spec: HawkesSpec, a: float, b: float, rng, n_rep: int = 1, shock_ids=None):
    """Shock-triggered immigrants falling in [a, b] (a >= 0). The full shock
    response on (tau_e, inf) is Poisson with mean shock_beta_k S_e. The part on
    [a, b] is Poisson with mean shock_beta_k S_e (Psi(b - tau) - Psi(a - tau)).
    It is sampled exactly by inverting a truncated exponential.
    Returns times, dims, replicate, shock index."""
    M = spec.M
    eta = spec.shock_rate_vec
    ts, ds, rs, es = [], [], [], []
    ids = range(len(spec.shocks)) if shock_ids is None else shock_ids
    for e in ids:
        tau, S = spec.shocks[e]
        lo = max(a, tau)
        if lo >= b:
            continue
        for k in range(M):
            if spec.shock_beta[k] <= 0 or S <= 0:
                continue
            u0 = lo - tau
            u1 = b - tau
            F0 = -np.expm1(-eta[k] * u0)
            F1 = -np.expm1(-eta[k] * u1)
            mass = spec.shock_beta[k] * S * (F1 - F0)
            n = rng.poisson(mass, size=n_rep)
            tot = int(n.sum())
            U = F0 + (F1 - F0) * rng.random(tot)
            t = tau - np.log1p(-U) / eta[k]
            ts.append(np.clip(t, lo, b))
            ds.append(np.full(tot, k, np.int64))
            rs.append(np.repeat(np.arange(n_rep), n))
            es.append(np.full(tot, e, np.int64))
    if not ts:
        z = np.zeros(0)
        zi = z.astype(np.int64)
        return z, zi, zi, zi
    return np.concatenate(ts), np.concatenate(ds), np.concatenate(rs), np.concatenate(es)


def _split(times, dims, M, labels=None):
    order = np.lexsort((dims, times))
    times, dims = times[order], dims[order]
    events = [times[dims == k] for k in range(M)]
    if labels is None:
        return events, None
    labels = labels[order]
    return events, [labels[dims == k] for k in range(M)]


def simulate(
    spec: HawkesSpec,
    T: float,
    rng=None,
    return_branching: bool = False,
    method: str = "auto",
    mu_bound=None,
    max_events: int = 10_000_000,
):
    """Simulate the process on [0, T] exactly.

    Parameters
    ----------
    spec : HawkesSpec
    T : horizon.
    rng : numpy Generator or seed.
    return_branching : also return the branching labels (see the module doc).
    method : "auto"/"cluster" (branching representation, with thinning for the
        immigrants of a callable background) or "ogata" (Ogata thinning of the
        full process).
    mu_bound : optional (M,) upper bound of a callable background on [0, T].

    Returns
    -------
    events : list of M sorted arrays, or (events, labels).
    """
    rng = as_rng(rng)
    if method in ("auto", "cluster"):
        return _simulate_cluster(spec, T, rng, return_branching, mu_bound, max_events)
    if method == "ogata":
        return _simulate_ogata(spec, T, rng, return_branching, mu_bound, max_events)
    raise ValueError(f"unknown method {method!r}")


def _simulate_cluster(spec, T, rng, return_branching, mu_bound, max_events):
    M = spec.M
    tb, db, _ = _background_immigrants(spec, 0.0, T, rng, mu_bound)
    tsh, dsh, _, esh = _shock_immigrants(spec, 0.0, T, rng)
    t0 = np.concatenate([tb, tsh])
    d0 = np.concatenate([db, dsh])
    lab0 = np.concatenate([np.full(tb.size, -1, np.int64), -2 - esh])
    times, dims, parent, _, carry = cascade(
        spec.alpha, spec.beta_matrix, t0, d0, T, rng, carry={"lab0": lab0}, max_events=max_events
    )
    if not return_branching:
        return _split(times, dims, M)[0]
    order = np.lexsort((dims, times))
    rank = np.empty(times.size, np.int64)
    rank[order] = np.arange(times.size)
    lab = np.where(parent >= 0, rank[np.maximum(parent, 0)], carry["lab0"])
    return _split(times, dims, M, lab)


def _simulate_ogata(spec, T, rng, return_branching, mu_bound, max_events):
    M = spec.M
    A, Bm = spec.alpha, spec.beta_matrix
    jump = A * Bm  # E[:, j] += jump[:, j] at an event in j
    tau, S = spec.shock_times, spec.shock_sizes
    eta = spec.shock_rate_vec
    sb = spec.shock_beta
    has_sh = bool(spec.shocks) and np.any(sb > 0)
    if spec.constant_mu:
        mu_b = spec.mu.copy()
    elif mu_bound is not None:
        mu_b = np.broadcast_to(np.asarray(mu_bound, float), (M,)).copy()
    else:
        mu_b = spec.mu.max_rate(T)
    mu_b_tot = float(mu_b.sum())

    def shock_int(t):
        if not has_sh:
            return np.zeros(M)
        d = t - tau
        pos = d > 0
        if not np.any(pos):
            return np.zeros(M)
        return sb * (S[pos][None, :] * eta[:, None] * np.exp(-eta[:, None] * d[pos][None, :])).sum(axis=1)

    E = np.zeros((M, M))
    t = 0.0
    out_t, out_d, out_lab = [], [], []
    past = [[] for _ in range(M)]
    past_g = [[] for _ in range(M)]
    # shock intensity is not monotone just after a shock time: restart the bound there
    sh_sorted = np.sort(tau[(tau >= 0) & (tau < T)]) if has_sh else np.zeros(0)
    nxt = 0
    while True:
        bound = mu_b_tot + E.sum() + shock_int(t).sum()
        t_next_shock = sh_sorted[nxt] if nxt < sh_sorted.size else np.inf
        if bound <= 0:
            t_new = np.inf
        else:
            t_new = t + rng.standard_exponential() / bound
        if t_new >= t_next_shock and t_next_shock <= T:
            E *= np.exp(-Bm * (t_next_shock - t))
            t = t_next_shock
            nxt += 1
            # jump just past the shock time so the shock term is "on"
            t = np.nextafter(t, np.inf)
            continue
        if t_new > T:
            break
        E *= np.exp(-Bm * (t_new - t))
        t = t_new
        mu_t = spec.mu if spec.constant_mu else spec.mu.rate(np.array([t]))[0]
        if not spec.constant_mu and np.any(mu_t > mu_b * (1 + 1e-12)):
            raise ValueError("background exceeds its thinning bound; pass a larger mu_bound")
        sh_t = shock_int(t)
        lam = mu_t + sh_t + E.sum(axis=1)
        if rng.random() * bound > lam.sum():
            continue
        k = int(rng.choice(M, p=lam / lam.sum()))
        if return_branching:
            parts = np.concatenate([[mu_t[k]], sb[k] * _shock_parts(t, tau, S, eta[k]), E[k]])
            src = int(rng.choice(parts.size, p=parts / parts.sum()))
            if src == 0:
                lab = -1
            elif src <= len(tau):
                lab = -2 - (src - 1)
            else:
                j = src - 1 - len(tau)
                pt = np.asarray(past[j])
                w = np.exp(-Bm[k, j] * (t - pt))
                lab = int(np.asarray(past_g[j])[rng.choice(pt.size, p=w / w.sum())])
            out_lab.append(lab)
        past[k].append(t)
        past_g[k].append(len(out_t))
        out_t.append(t)
        out_d.append(k)
        E[:, k] += jump[:, k]
        if len(out_t) > max_events:
            raise RuntimeError("too many events")
    times = np.asarray(out_t, float)
    dims = np.asarray(out_d, np.int64)
    if not return_branching:
        return _split(times, dims, M)[0]
    # out_t is already time-sorted, so the generation index is the global index
    # (ties have probability zero)
    return _split(times, dims, M, np.asarray(out_lab, np.int64))


def _shock_parts(t, tau, S, eta_k):
    d = t - tau
    out = np.zeros(tau.size)
    pos = d > 0
    out[pos] = S[pos] * eta_k * np.exp(-eta_k * d[pos])
    return out


def cluster_info(events, labels) -> dict:
    """Merge events and branching labels, and trace each event to its root.

    Returns a dict of merged arrays (time-sorted, global index order):
    ``times``, ``dims``, ``parent`` (global labels), ``root`` (-1 background,
    -2-e shock e), ``generation`` (0 for immigrants), ``root_index`` (global
    index of the immigrant that started the cluster).
    """
    times, dims, pos = merge_events(events)
    lab_all = np.concatenate([np.asarray(l, np.int64) for l in labels]) if len(labels) else np.zeros(0, np.int64)
    # merged order of the concatenated per-stream arrays
    offsets = np.concatenate([[0], np.cumsum([len(e) for e in events])])
    parent = lab_all[offsets[dims] + pos]
    n = times.size
    idx = np.arange(n)
    # pointer doubling: ptr2 -> root, dist -> generation
    ptr2 = np.where(parent >= 0, parent, idx)
    dist = (parent >= 0).astype(np.int64)
    while True:
        moving = ptr2 != ptr2[ptr2]
        if not np.any(moving):
            break
        dist = dist + np.where(moving, dist[ptr2], 0)
        ptr2 = ptr2[ptr2]
    root_index = ptr2
    return {
        "times": times,
        "dims": dims,
        "parent": parent,
        "root": parent[root_index],
        "root_index": root_index,
        "generation": dist,
    }


def simulate_shot_noise_cox(nu, rho, a, gamma, T, rng=None, return_shots=False, burn_in=None):
    """Stationary shot-noise Cox process (no contagion) with intensity

        lambda_k(t) = nu_k + sum_{s_i < t} a_k exp(-gamma_k (t - s_i)),

    with common shot times s_i a Poisson(rho) process on the real line. Given
    the shots, each shot contributes Poisson(a_k / gamma_k) events in stream k
    at Exp(gamma_k) delays. Shots before 0 are simulated back to
    ``-burn_in`` (default 40 / min(gamma)), so the omitted mass is a factor
    e^{-40} or less (stationary to that precision).

    nu, a, gamma : scalars or (M,) arrays. Returns a list of M sorted arrays
    (and the shot times if ``return_shots``). By Thm thm:equiv, this process has
    the same mean and Bartlett spectrum as an exponential Hawkes process. See
    :func:`hawkes.thinning.shot_noise_equivalent_hawkes`.
    """
    rng = as_rng(rng)
    nu = np.atleast_1d(np.asarray(nu, float))
    a = np.atleast_1d(np.asarray(a, float))
    gamma = np.atleast_1d(np.asarray(gamma, float))
    M = max(nu.size, a.size, gamma.size)
    nu, a, gamma = (np.broadcast_to(x, (M,)) for x in (nu, a, gamma))
    L = 40.0 / float(gamma.min()) if burn_in is None else float(burn_in)
    n_shots = rng.poisson(rho * (T + L))
    shots = np.sort(-L + (T + L) * rng.random(n_shots))
    events = []
    for k in range(M):
        nb = rng.poisson(nu[k] * T)
        bg = T * rng.random(nb)
        cnt = rng.poisson(a[k] / gamma[k], size=n_shots)
        st = np.repeat(shots, cnt) + rng.standard_exponential(int(cnt.sum())) / gamma[k]
        st = st[(st >= 0) & (st <= T)]
        events.append(np.sort(np.concatenate([bg, st])))
    if return_shots:
        return events, shots[shots >= 0]
    return events
