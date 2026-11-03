"""Confidence sequences (CS) for the mean of iid observations, vectorised over replications.

normal_mixture_radius   Robbins' two-sided normal-mixture boundary (Howard et al. 2021): for sigma-sub-Gaussian
                        increments, P(exists n: |S_n - n mu| >= sigma sqrt((n + 1/r^2) log((n r^2 + 1) / alpha^2)))
                        <= alpha. Radius for the mean: that divided by n. With sigma a known bound (bounded data:
                        sigma = range / 2) it is exact; with a running plug-in sigma_hat it is the asymptotic CS
                        of Waudby-Smith et al. (time-uniform CLT).
betting_cs              hedged-capital betting CS for observations in [0, 1] (Waudby-Smith & Ramdas), with
                        predictable plug-in bets; exact (Ville's inequality), adapts to the variance.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm


def mixture_r2(n_star, alpha):
    """Mixture precision r^2 that makes the normal-mixture boundary tightest near n = n_star."""
    la = -2.0 * np.log(alpha)
    return (la + np.log(la + 1.0)) / float(n_star)


def normal_mixture_radius(n, sigma, alpha, r2):
    """Radius of the two-sided normal-mixture CS for the mean after n observations."""
    n = np.asarray(n, float)
    return sigma * np.sqrt((n + 1.0 / r2) * np.log((n * r2 + 1.0) / alpha ** 2)) / n


def running_mean_var(x):
    """x (R, n) -> running mean and (ddof=1) variance after each observation (var = 0 at n = 1)."""
    n = np.arange(1, x.shape[1] + 1)
    cs = np.cumsum(x, axis=1)
    cs2 = np.cumsum(x * x, axis=1)
    m = cs / n
    v = np.where(n > 1, (cs2 - n * m * m) / np.maximum(n - 1, 1), 0.0)
    return m, np.maximum(v, 0.0)


def asymptotic_cs(x, alpha, n_star, sigma_floor=1e-6):
    """Normal-mixture CS with plug-in standard deviation. Returns (lower, upper), shape (R, n)."""
    m, v = running_mean_var(x)
    n = np.arange(1, x.shape[1] + 1)
    rad = normal_mixture_radius(n, np.sqrt(np.maximum(v, sigma_floor ** 2)), alpha, mixture_r2(n_star, alpha))
    rad[:, 0] = np.inf
    return m - rad, m + rad


def subgaussian_cs(x, alpha, n_star, sigma):
    """Normal-mixture CS with a known sub-Gaussian scale (exact for bounded data with sigma = range / 2)."""
    m, _ = running_mean_var(x)
    n = np.arange(1, x.shape[1] + 1)
    rad = normal_mixture_radius(n, sigma, alpha, mixture_r2(n_star, alpha))
    return m - rad, m + rad


def betting_cs(x01, alpha, grid=None, c=0.5, chunk=64):
    """Hedged-capital betting CS for the mean of observations in [0, 1].

    For each candidate m, the capital is K_n(m) = (K+_n(m) + K-_n(m)) / 2 with
    K+_n = prod (1 + l_i (x_i - m)), K-_n = prod (1 - l_i (x_i - m)), and predictable plug-in bets
    l_i = min(sqrt(2 log(2/alpha) / (s2_{i-1} i log(1 + i))), c / m or c / (1 - m)),
    s2_{i-1} = (1/4 + sum_{j<i} (x_j - mu_j)^2) / i,  mu_j = (1/2 + sum_{l<=j} x_l) / (j + 1).
    The CS at n is {m : max_{j<=n} K_j(m) < 1/alpha} (running intersection). Returns (lower, upper) (R, n),
    the smallest and largest grid points not yet rejected (nan if all rejected)."""
    x01 = np.asarray(x01, float)
    R, N = x01.shape
    if grid is None:
        grid = np.linspace(0.0005, 0.9995, 2000)
    G = grid.size
    i = np.arange(1, N + 1)
    mu = (0.5 + np.cumsum(x01, axis=1)) / (i + 1)
    mu_prev = np.concatenate([np.full((R, 1), 0.5), mu[:, :-1]], axis=1)
    s2 = (0.25 + np.cumsum((x01 - mu_prev) ** 2, axis=1)) / (i + 1)       # s2 after i obs
    s2_prev = np.concatenate([np.full((R, 1), 0.25), s2[:, :-1]], axis=1)
    lam = np.sqrt(2 * np.log(2 / alpha) / (s2_prev * i * np.log(1 + i)))   # (R, N)
    thr = np.log(1.0 / alpha)
    lo = np.full((R, N), np.nan)
    hi = np.full((R, N), np.nan)
    capp = c / grid
    capm = c / (1 - grid)
    for r0 in range(0, R, chunk):
        xs = x01[r0:r0 + chunk]
        ls = lam[r0:r0 + chunk]
        rr = xs.shape[0]
        logKp = np.zeros((rr, G))
        logKm = np.zeros((rr, G))
        alive = np.ones((rr, G), bool)
        for t in range(N):
            d = xs[:, t:t + 1] - grid[None, :]
            lp = np.minimum(ls[:, t:t + 1], capp[None, :])
            lm = np.minimum(ls[:, t:t + 1], capm[None, :])
            logKp += np.log1p(lp * d)
            logKm += np.log1p(-lm * d)
            logK = np.logaddexp(logKp, logKm) - np.log(2.0)
            alive &= logK < thr
            any_ = alive.any(1)
            first = np.argmax(alive, axis=1)
            last = G - 1 - np.argmax(alive[:, ::-1], axis=1)
            lo[r0:r0 + rr, t] = np.where(any_, grid[first], np.nan)
            hi[r0:r0 + rr, t] = np.where(any_, grid[last], np.nan)
    return lo, hi


def fixed_n_power(effect, sd, n, alpha):
    """Power of the two-sided level-alpha z-test of mean zero with n iid observations of sd `sd`."""
    z = norm.ppf(1 - alpha / 2)
    s = np.abs(effect) * np.sqrt(n) / sd
    return norm.cdf(s - z) + norm.cdf(-s - z)


def fixed_n_size(effect, sd, alpha, power):
    """Sample size of the two-sided z-test: n = (z_{1-alpha/2} + z_{power})^2 sd^2 / effect^2."""
    return (norm.ppf(1 - alpha / 2) + norm.ppf(power)) ** 2 * sd ** 2 / effect ** 2


# ---------------------------------------------------------------------------------------------
# alg:sequential (Fieller-type confidence sequence for AR) and its exact betting variant
# ---------------------------------------------------------------------------------------------
def bernoulli_mixture_cs(n, s, alpha, grid, a=0.5, b=0.5):
    """Exact CS for a Bernoulli mean from s successes in n trials (arrays of any shape): the Beta(a, b) mixture
    likelihood ratio is a nonnegative martingale under H0: p = p0 (Robbins), so Ville's inequality gives
    P(exists n: p* outside) <= alpha. Returns (lo, hi) = smallest / largest grid value not rejected."""
    from scipy.special import betaln
    n = np.asarray(n, float)
    s = np.asarray(s, float)
    logm = betaln(a + s, b + n - s) - betaln(a, b)
    ll = s[..., None] * np.log(grid) + (n - s)[..., None] * np.log1p(-grid)
    keep = (logm[..., None] - ll) < np.log(1.0 / alpha)
    anyk = keep.any(-1)
    first = np.argmax(keep, axis=-1)
    last = grid.size - 1 - np.argmax(keep[..., ::-1], axis=-1)
    return np.where(anyk, grid[first], np.nan), np.where(anyk, grid[last], np.nan)


def fieller_cs(qa, qr, looks, f_box, rho_box, f_hat, rho_hat, alpha1, t_star, grid):
    """alg:sequential for a batch of replications.

    qa, qr      (R, N) flagged shares of the paired alg / ref puppets, in pair order
    looks       (W,) numbers of pairs at the looks (end of each wave)
    f_box       dict with arrays (R, W): fa_lo, fa_hi, fr_lo, fr_hi (bounds for 1 - Sp at each look)
    rho_box     (rho_lo, rho_hi) registered range for rho_J = J_a / J_r
    f_hat       (fa_hat, fr_hat) arrays (R, W): point estimates of 1 - Sp for s_hat
    Returns L, U (R, W): running intersection of C_t at each look (L > U: empty)."""
    R, N = qa.shape
    ca, cr = np.cumsum(qa, 1), np.cumsum(qr, 1)
    caa, crr, car = np.cumsum(qa * qa, 1), np.cumsum(qr * qr, 1), np.cumsum(qa * qr, 1)
    r2 = mixture_r2(t_star, alpha1)
    W = len(looks)
    Lo = np.zeros((R, W))
    Up = np.zeros((R, W))
    L = np.full(R, -np.inf)
    U = np.full(R, np.inf)
    g = grid[None, :]
    for w, t in enumerate(looks):
        ma, mr = ca[:, t - 1] / t, cr[:, t - 1] / t
        va = (caa[:, t - 1] - t * ma * ma) / max(t - 1, 1)
        vr = (crr[:, t - 1] - t * mr * mr) / max(t - 1, 1)
        cv = (car[:, t - 1] - t * ma * mr) / max(t - 1, 1)
        rr = g * rho_hat
        s = np.sqrt(np.maximum(va[:, None] + rr ** 2 * vr[:, None] - 2 * rr * cv[:, None], 0.0))
        b = normal_mixture_radius(t, 1.0, alpha1, r2) if t > 1 else np.inf
        xlo = np.full((R, grid.size), np.inf)
        xhi = np.full((R, grid.size), -np.inf)
        for fa in (f_box["fa_lo"][:, w], f_box["fa_hi"][:, w]):
            for fr in (f_box["fr_lo"][:, w], f_box["fr_hi"][:, w]):
                for rho in rho_box:
                    X = ma[:, None] - g * rho * mr[:, None] - fa[:, None] + g * rho * fr[:, None]
                    np.minimum(xlo, X, out=xlo)
                    np.maximum(xhi, X, out=xhi)
        inC = (xlo - s * b <= 0) & (0 <= xhi + s * b)
        anyc = inC.any(1)
        cmin = np.where(anyc, grid[np.argmax(inC, 1)], np.inf)
        cmax = np.where(anyc, grid[grid.size - 1 - np.argmax(inC[:, ::-1], 1)], -np.inf)
        L = np.maximum(L, cmin)
        U = np.minimum(U, cmax)
        Lo[:, w], Up[:, w] = L, U
    return Lo, Up


def betting_ratio_cs(Ea, Er, alpha, grid, c=0.5):
    """Exact variant (thm:sequential(b)): for each r, a hedged-capital betting test that the bounded variables
    E_a,i - r E_r,i in [-r, 1] have mean zero (rescaled to [0, 1], null mean r / (1 + r)), with predictable
    plug-in bets. Returns running-intersection bounds (R, N) of {r : max_s K_s(r) < 1/alpha}."""
    R, N = Ea.shape
    G = grid.size
    m = grid / (1 + grid)
    capp, capm = c / m, c / (1 - m)
    thr = np.log(1 / alpha)
    logKp = np.zeros((R, G))
    logKm = np.zeros((R, G))
    alive = np.ones((R, G), bool)
    sx = np.zeros((R, G))
    s2sum = np.zeros((R, G))
    mu_prev = np.full((R, G), 0.5)
    lo = np.full((R, N), np.nan)
    hi = np.full((R, N), np.nan)
    for t in range(N):
        i = t + 1
        x = (Ea[:, t, None] - grid[None, :] * Er[:, t, None] + grid[None, :]) / (1 + grid[None, :])
        s2_prev = (0.25 + s2sum) / i
        lam = np.sqrt(2 * np.log(2 / alpha) / (s2_prev * i * np.log(1 + i)))
        d = x - m[None, :]
        logKp += np.log1p(np.minimum(lam, capp[None, :]) * d)
        logKm += np.log1p(-np.minimum(lam, capm[None, :]) * d)
        alive &= (np.logaddexp(logKp, logKm) - np.log(2.0)) < thr
        sx += x
        mu = (0.5 + sx) / (i + 1)
        s2sum += (x - mu_prev) ** 2
        mu_prev = mu
        anya = alive.any(1)
        lo[:, t] = np.where(anya, grid[np.argmax(alive, 1)], np.nan)
        hi[:, t] = np.where(anya, grid[G - 1 - np.argmax(alive[:, ::-1], 1)], np.nan)
    return lo, hi


def c_alpha(alpha):
    """prop:power(c): radius constant of the tuned normal-mixture boundary."""
    a = -2 * np.log(alpha) + np.log(1 - 2 * np.log(alpha))
    return float(np.sqrt(2 * (1 + 1 / a) * np.log(np.sqrt(1 + a) / alpha)))


# ---------------------------------------------------------------------------------------------
# alg:sequential as revised by DESIGN: delta-method normal-mixture CS for log AR on the
# confirmed-flagged statistic Y_u = Qbar_u * Phat_u, widened by the sensitivity-ratio range
# ---------------------------------------------------------------------------------------------
def mixture_a(alpha):
    return -2 * np.log(alpha) + np.log(1 - 2 * np.log(alpha))


def alg1_cs(Ya, Yr, looks, alpha, t_star, lam_range=(1.0, 1.0), burn=1):
    """Algorithm 1 (alg:sequential) for R replications at once.

    Ya, Yr  (R, N) paired confirmed-flagged statistics in pair order; looks (W,) numbers of pairs after each wave.
    Returns dict with (R, W) arrays: L, U (running intersection over waves > burn; -inf/+inf before),
    lo, hi (the per-look sets C_t), lth (log theta_hat), h (radius)."""
    R, N = Ya.shape
    r2 = mixture_a(alpha) / float(t_star)
    ca, cr = np.cumsum(Ya, 1), np.cumsum(Yr, 1)
    caa, crr, car = np.cumsum(Ya * Ya, 1), np.cumsum(Yr * Yr, 1), np.cumsum(Ya * Yr, 1)
    W = len(looks)
    out = {k: np.zeros((R, W)) for k in ("L", "U", "lo", "hi", "lth", "h")}
    L = np.full(R, -np.inf)
    U = np.full(R, np.inf)
    llo, lhi = np.log(lam_range[0]), np.log(lam_range[1])
    for w, t in enumerate(looks):
        ya, yr = ca[:, t - 1] / t, cr[:, t - 1] / t
        ok = (ya > 0) & (yr > 0)
        with np.errstate(divide="ignore", invalid="ignore"):
            lth = np.log(ya / yr)
            s2 = (caa[:, t - 1] / ya ** 2 + crr[:, t - 1] / yr ** 2 - 2 * car[:, t - 1] / (ya * yr)) / t
        h = np.sqrt(np.maximum(s2, 0.0)) * normal_mixture_radius(t, 1.0, alpha, r2)
        lo = np.where(ok, lth - lhi - h, -np.inf)
        hi = np.where(ok, lth - llo + h, np.inf)
        if w >= burn:
            L = np.maximum(L, lo)
            U = np.minimum(U, hi)
        out["L"][:, w], out["U"][:, w] = L, U
        out["lo"][:, w], out["hi"][:, w] = lo, hi
        out["lth"][:, w], out["h"][:, w] = np.where(ok, lth, np.nan), h
    return out
