"""Bayesian nonparametric latent-class MSE (LCMCR) of Manrique-Vallier (2016).

Model (paper Eq. ``eq:lcmcr``, Section ``sec:models``; attributed to
\\citet{manriquevallier2016}).  For incidents i = 1..N and lists k = 1..K::

    Y_ik | z_i = j   ~ Bernoulli(lambda_jk)           independently over k
    z_i              ~ Categorical(pi_1..pi_J)
    pi               ~ truncated stick-breaking SB_J(alpha):
                       V_j ~ Beta(1, alpha), j < J;  V_J = 1;  pi_j = V_j prod_{l<j}(1 - V_l)
    lambda_jk        ~ Beta(1, 1)
    alpha            ~ Gamma(a, b)  (shape a, rate b; default a = b = 0.25)
    p(N)             ∝ 1/N

Only the ``n = sum_{h != 0} n_h`` units with a nonzero history are observed.

Gibbs sampler (data augmentation, as in Manrique-Vallier 2016, Sec. 3), with
every step done at the level of the ``2**K`` cell counts (all units sharing a
history are exchangeable, so their class labels are a multinomial draw):

1. ``n_0 | lambda, pi ~ NegBin(n, 1 - pi_0)`` where
   ``pi_0 = sum_j pi_j prod_k (1 - lambda_jk)`` is the probability of being
   missed by every list; i.e. ``p(n_0) ∝ C(n + n_0 - 1, n_0) pi_0^{n_0}
   (1 - pi_0)^n``, which is the full conditional of ``N = n + n_0`` under
   ``p(N) ∝ 1/N`` after marginalising the labels of the unobserved units.
2. For every history h (including h = 0 with count ``n_0``):
   ``(c_h1..c_hJ) ~ Multinomial(n_h, w_h)``, ``w_hj ∝ pi_j prod_k
   lambda_jk^{h_k} (1 - lambda_jk)^{1 - h_k}``.
   (Steps 1-2 together are an exact draw from the joint conditional of
   ``(n_0, z)`` given ``(lambda, pi)``.)
3. ``lambda_jk ~ Beta(1 + s_jk, 1 + m_j - s_jk)`` with ``m_j = sum_h c_hj``,
   ``s_jk = sum_h c_hj h_k``.
4. ``V_j ~ Beta(1 + m_j, alpha + sum_{l > j} m_l)`` for j < J, ``V_J = 1``.
5. ``alpha ~ Gamma(a + J - 1, rate = b - sum_{j<J} log(1 - V_j))``.

The cost per iteration is O(2**K * J) and independent of N (about 60-70 us for
K = 4, J = 10).  Initialisation puts every unit in class 1 (see the code).

Verification (code/tests/test_estimators.py):

* with J = 1 the sampler reproduces the exact posterior of N,
  ``p(N | data) ∝ N^{-1} N!/(N-n)! prod_k B(n_k + 1, N - n_k + 1)`` (n_0 step);
* a Geweke (2004) joint-distribution test (N fixed, J = 4) recovers the prior of
  (lambda, pi, alpha) (allocation, lambda, stick-breaking and alpha steps);
* with J = 10 it attains near-nominal coverage on tables simulated from an
  independent-capture model.
"""

from __future__ import annotations

import time

import numpy as np

from .loglinear import histories, popcount

__all__ = ["gibbs_lcmcr", "effective_sample_size"]


def _draw_params(C, alpha, HT, a_alpha, b_alpha, rng):
    """Steps 3-5: ``lambda | C``, ``V | C, alpha``, ``alpha | V``.

    ``C`` is the ``(2**K, J)`` cell-by-class count matrix (row 0 = unobserved).
    Beta variates are Gamma ratios, drawn in one ``standard_gamma`` call.

    The stick-breaking variables are handled in **log space**: with small alpha
    (the Gamma(0.25, 0.25) prior puts ~8% of its mass below 1e-4),
    ``Gamma(alpha + sum_{l>j} m_l)`` underflows, V_j rounds to 1 and any floor on
    ``1 - V_j`` biases the ``alpha | V`` update (whose rate is
    ``b - sum_j log(1 - V_j)``).  We draw ``log G_b = log Gamma(a + 1) + log(U)/a``
    (exact: ``G U^{1/a} ~ Gamma(a)`` for ``G ~ Gamma(a + 1)``) and form
    ``log V_j``, ``log(1 - V_j)`` and ``log pi_j`` without cancellation.  This
    was found necessary by the Geweke joint-distribution test in the test suite.

    Returns ``(lam (J, K), pi (J,), alpha)``.
    """
    K, J = HT.shape[0], C.shape[1]
    JK = J * K
    m = C.sum(axis=0)  # (J,) units per class
    s = HT @ C  # (K, J) captures per list and class
    #   lambda_jk ~ Beta(1 + s_jk, 1 + m_j - s_jk);  V_j ~ Beta(1 + m_j, alpha + sum_{l>j} m_l)
    tail = np.cumsum(m[::-1])[::-1]
    shape_b = alpha + tail[1:]
    shapes = np.concatenate([(1.0 + s).ravel(), (1.0 + m[None, :] - s).ravel(), 1.0 + m[:-1], shape_b + 1.0])
    g = rng.standard_gamma(shapes)
    ga, gb = g[:JK], g[JK : 2 * JK]
    lam = np.minimum(np.maximum((ga / (ga + gb)).reshape(K, J).T, 1e-12), 1.0 - 1e-12)  # (J, K)
    if J == 1:
        return lam, np.ones(1), alpha
    log_va = np.log(g[2 * JK : 2 * JK + J - 1])  # shape >= 1: no underflow
    u = 1.0 - rng.random(J - 1)  # in (0, 1]
    log_vb = np.log(g[2 * JK + J - 1 :]) + np.log(u) / shape_b
    log_den = np.logaddexp(log_va, log_vb)
    log_V = log_va - log_den
    log_1mV = log_vb - log_den
    csum = np.cumsum(log_1mV)
    log_pi = np.empty(J)
    log_pi[0] = log_V[0]
    log_pi[1:-1] = log_V[1:] + csum[:-1]
    log_pi[-1] = csum[-1]  # V_J = 1
    pi = np.exp(log_pi)
    # alpha | V ~ Gamma(a + J - 1, rate = b - sum_{j<J} log(1 - V_j))
    alpha = rng.gamma(a_alpha + J - 1, 1.0 / (b_alpha - csum[-1]))
    return lam, pi, alpha


def _cell_class_probs(lam, H):
    """``q[h, j] = prod_k lam_jk^{h_k} (1 - lam_jk)^{1 - h_k}`` for all histories h (rows of H)."""
    return np.exp(H @ np.log(lam).T + (1.0 - H) @ np.log1p(-lam).T)


def _draw_allocations(cell, q, pi, rng):
    """Step 2: cell-by-class counts ``C[h] ~ Multinomial(cell[h], w_h)``, ``w_hj ∝ pi_j q_hj``."""
    w = q * pi[None, :]
    w /= w.sum(axis=1, keepdims=True)
    return rng.multinomial(cell, w)


def gibbs_lcmcr(
    y: np.ndarray,
    K: int,
    J: int = 10,
    n_iter: int = 10_000,
    burn: int = 2_000,
    thin: int = 4,
    seed=None,
    alpha_prior: tuple[float, float] = (0.25, 0.25),
    n0_init: float | None = None,
) -> dict:
    """Run the LCMCR Gibbs sampler on a bitmask-ordered integer count array.

    Parameters
    ----------
    y : array of length ``2**K``; ``y[0]`` is ignored.  Must be integer-valued.
    J : truncation level of the stick-breaking prior (number of latent classes).
    n_iter : total number of Gibbs iterations, *including* burn-in.
    burn : number of initial iterations discarded.
    thin : keep every ``thin``-th post-burn-in draw.
    seed : seed or ``numpy.random.Generator``.
    alpha_prior : (shape, rate) of the Gamma prior on the DP concentration.
    n0_init : initial value for the number of unobserved units (default: a
        Chao-type lower bound ``f1^2 / (2 f2)``, clipped to ``[1, 10 n]``).

    Returns
    -------
    dict with ``N`` (kept draws of N), ``alpha`` (kept draws), ``k_occ`` (number
    of occupied classes per kept draw), ``pi0`` (kept draws of the
    non-capture probability), ``seconds``.
    """
    if n_iter <= burn:
        raise ValueError("n_iter must exceed burn")
    if J < 1:
        raise ValueError("J must be >= 1")
    rng = np.random.default_rng(seed)
    y = np.asarray(y, dtype=float)
    counts = np.rint(y).astype(np.int64)
    counts[0] = 0
    n = int(counts.sum())
    if n == 0:
        raise ValueError("no observed units")
    H = histories(K).astype(float)  # (2^K, K)
    a_alpha, b_alpha = map(float, alpha_prior)

    # ---- initialisation: every unit (observed and n0_init unobserved) in class 1, then start
    # at the lambda step.  A single-class start lets the DP open classes as the data require; a
    # uniform random allocation over J classes needs ~2000 extra iterations to shed classes.
    if n0_init is None:
        f = np.bincount(popcount(K), weights=counts, minlength=K + 1)
        f1, f2 = f[1], (f[2] if K >= 2 else 0.0)
        n0_init = f1 * f1 / (2.0 * f2) if f2 > 0 else f1 * max(f1 - 1, 0) / 2.0
        n0_init = float(np.clip(n0_init, 1.0, 10.0 * n))
    cell = counts.copy()
    cell[0] = int(round(n0_init))
    C = np.zeros((2**K, J), dtype=np.int64)  # cell-by-class allocation counts
    C[:, 0] = cell
    alpha = 1.0
    HT = H.T.copy()

    t0 = time.perf_counter()
    n_keep = len(range(burn, n_iter, thin))
    keep = np.empty(n_keep)
    keep_alpha = np.empty(n_keep)
    keep_k = np.empty(n_keep, dtype=np.int64)
    keep_pi0 = np.empty(n_keep)
    i_keep = 0
    for it in range(n_iter):
        lam, pi, alpha = _draw_params(C, alpha, HT, a_alpha, b_alpha, rng)
        q = _cell_class_probs(lam, H)  # (2^K, J)
        # n0 | lambda, pi (labels of the unobserved units marginalised): NegBin(n, 1 - pi0)
        pi0 = float(np.dot(pi, q[0]))
        pi0 = min(max(pi0, 1e-300), 1.0 - 1e-15)
        n0 = rng.negative_binomial(n, 1.0 - pi0)
        # labels | n0, lambda, pi: multinomial cell-by-class counts
        cell[0] = n0
        C = _draw_allocations(cell, q, pi, rng)
        if it >= burn and (it - burn) % thin == 0:
            keep[i_keep] = n + n0
            keep_alpha[i_keep] = alpha
            keep_k[i_keep] = np.count_nonzero(C.sum(axis=0))
            keep_pi0[i_keep] = pi0
            i_keep += 1
    return {
        "N": keep,
        "alpha": keep_alpha,
        "k_occ": keep_k,
        "pi0": keep_pi0,
        "n": n,
        "seconds": time.perf_counter() - t0,
    }


def effective_sample_size(x: np.ndarray) -> float:
    """Effective sample size of a scalar chain (Geyer's initial positive sequence)."""
    x = np.asarray(x, dtype=float)
    n = x.size
    if n < 4 or np.var(x) == 0:
        return float(n)
    xc = x - x.mean()
    f = np.fft.rfft(xc, n=2 * n)
    acf = np.fft.irfft(f * np.conj(f))[:n]
    acf /= acf[0]
    # sum consecutive pairs until a pair sum becomes non-positive
    s = 0.0
    for t in range(0, n - 1, 2):
        pair = acf[t] + acf[t + 1]
        if pair <= 0:
            break
        s += pair
    tau = max(2.0 * s - 1.0, 1.0 / n)
    return float(n / tau)
