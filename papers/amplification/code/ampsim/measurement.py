"""Exposure measurement with a classifier, validation sampling and Rogan-Gladen correction.

Per-puppet data are impression counts by (true type, classifier-score band): an array (..., 4 * 5).
Bands are cut at logit -2, -1, 0, 1; flagged (L-hat = 1) <=> band >= 3.

Estimators of the exposure prevalence p_pi in arm pi (impression-weighted share with L = 1):
    true        mean over puppets of the true-label exposure (oracle)
    naive       mean over puppets of the classifier-flagged share q_pi
    rg_pooled   Rogan-Gladen  (q_pi + Sp - 1) / (Se + Sp - 1) with Se, Sp estimated from the validation
                sample pooled over the two arms (inverse-probability weighted)
    rg_strat    Rogan-Gladen with Se_pi, Sp_pi estimated separately in each arm
The validation sample is drawn, separately in each arm, from the recorded impressions stratified by score
band (n_val / 5 per band, or the whole band if smaller), and weighted by inverse inclusion probabilities.
With IPW-weighted Se_pi, Sp_pi the arm-stratified Rogan-Gladen estimate equals sum_h W_h p_h (W_h the band
share, p_h the validated share with L = 1 in band h); this identity is used for speed and is checked in
the tests. Variances: delta method on (band shares of each arm, validated band prevalences), with the
band shares' covariance from the between-puppet variation and binomial (finite-population corrected)
variances (plug-in, finite-population corrected) for the validated prevalences.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm

from .world import FLAG_BANDS, N_BANDS, N_TYPES

Z95 = float(norm.ppf(0.975))
FLAG = FLAG_BANDS.astype(float)


def split_counts(counts):
    """counts (..., 20) -> (A by band (..., 5), all by band (..., 5))."""
    c = counts.reshape(counts.shape[:-1] + (N_TYPES, N_BANDS))
    return c[..., 2:, :].sum(-2), c.sum(-2)


def per_puppet(counts, n_impr):
    """Per-puppet true exposure, naive (flagged) exposure and band shares."""
    A, tot = split_counts(counts)
    e_true = A.sum(-1) / n_impr
    w = tot / n_impr
    e_naive = (w * FLAG).sum(-1)
    return e_true, e_naive, w


def validation_draw(A_h, N_h, n_val, rng):
    """Stratified validation sample within one arm. A_h, N_h: (R, 5) counts of L = 1 and of all impressions
    by band (aggregated over the arm's puppets). Returns (a_h, n_h): validated L = 1 counts and sample sizes."""
    alloc = n_val // N_BANDS
    n_h = np.minimum(alloc, N_h).astype(np.int64)
    a_h = np.zeros_like(n_h)
    m = n_h > 0
    a_h[m] = rng.hypergeometric(A_h[m].astype(np.int64), (N_h - A_h)[m].astype(np.int64), n_h[m])
    return a_h, n_h


def _rg_pooled(Wa, Wr, pa, pr, Na, Nr):
    """Pooled-Se/Sp Rogan-Gladen estimates for both arms. Arrays (..., 5) and (...,) totals."""
    Aa, Ar = (Wa * pa).sum(-1), (Wr * pr).sum(-1)
    Fa, Fr = (Wa * pa * FLAG).sum(-1), (Wr * pr * FLAG).sum(-1)
    qa, qr = (Wa * FLAG).sum(-1), (Wr * FLAG).sum(-1)
    TNa = (Wa * (1 - pa) * (1 - FLAG)).sum(-1)
    TNr = (Wr * (1 - pr) * (1 - FLAG)).sum(-1)
    se = (Na * Fa + Nr * Fr) / np.maximum(Na * Aa + Nr * Ar, 1e-300)
    sp = (Na * TNa + Nr * TNr) / np.maximum(Na * (1 - Aa) + Nr * (1 - Ar), 1e-300)
    den = se + sp - 1
    return (qa + sp - 1) / den, (qr + sp - 1) / den, se, sp


def _rg_strat(Wa, Wr, pa, pr, Na=None, Nr=None):
    return (Wa * pa).sum(-1), (Wr * pr).sum(-1)


def _delta(fun, Wa, Wr, pa, pr, covWa, covWr, vpa, vpr, Na, Nr, h=1e-6):
    """Delta-method variances of log(p_a / p_r) and p_a - p_r for fun(Wa, Wr, pa, pr, Na, Nr) -> (p_a, p_r, ...).
    Vectorised over leading dimension R. Returns (pa_hat, pr_hat, var_logratio, var_diff)."""
    base = fun(Wa, Wr, pa, pr, Na, Nr)
    p_a, p_r = base[0], base[1]
    R = p_a.shape[0]
    blocks = [("Wa", Wa), ("Wr", Wr), ("pa", pa), ("pr", pr)]
    grads = {}
    for name, arr in blocks:
        g_lr = np.zeros((R, N_BANDS))
        g_d = np.zeros((R, N_BANDS))
        for j in range(N_BANDS):
            args = dict(Wa=Wa, Wr=Wr, pa=pa, pr=pr)
            up, dn = arr.copy(), arr.copy()
            up[:, j] += h
            dn[:, j] -= h
            args[name] = up
            fu = fun(args["Wa"], args["Wr"], args["pa"], args["pr"], Na, Nr)
            args[name] = dn
            fd = fun(args["Wa"], args["Wr"], args["pa"], args["pr"], Na, Nr)
            with np.errstate(divide="ignore", invalid="ignore"):
                lu = np.log(np.maximum(fu[0], 1e-12)) - np.log(np.maximum(fu[1], 1e-12))
                ld = np.log(np.maximum(fd[0], 1e-12)) - np.log(np.maximum(fd[1], 1e-12))
            g_lr[:, j] = (lu - ld) / (2 * h)
            g_d[:, j] = ((fu[0] - fu[1]) - (fd[0] - fd[1])) / (2 * h)
        grads[name] = (g_lr, g_d)
    v_lr = np.zeros(R)
    v_d = np.zeros(R)
    for name, cov in (("Wa", covWa), ("Wr", covWr)):
        g_lr, g_d = grads[name]
        v_lr += np.einsum("ri,rij,rj->r", g_lr, cov, g_lr)
        v_d += np.einsum("ri,rij,rj->r", g_d, cov, g_d)
    for name, var in (("pa", vpa), ("pr", vpr)):
        g_lr, g_d = grads[name]
        v_lr += (g_lr ** 2 * var).sum(-1)
        v_d += (g_d ** 2 * var).sum(-1)
    return p_a, p_r, v_lr, v_d


def _mean_var(x):
    """Mean and variance of the mean over axis -1 (puppets)."""
    U = x.shape[-1]
    return x.mean(-1), x.var(-1, ddof=1) / U


def _band_cov(w):
    """w (R, U, 5) band shares -> mean (R, 5), covariance of the mean (R, 5, 5)."""
    U = w.shape[1]
    m = w.mean(1)
    d = w - m[:, None, :]
    return m, np.einsum("rui,ruj->rij", d, d) / (U - 1) / U


def estimate_contrast(ca, cr, n_impr, n_val, rng, methods=("true", "naive", "rg_pooled", "rg_strat")):
    """AR and AA estimates for one persona and one alg-vs-reference contrast, vectorised over replications.

    ca, cr: (R, U_a, 20), (R, U_r, 20) per-puppet counts for the alg and reference arms.
    Returns dict method -> dict(p_alg, p_ref, ar, log_se, aa, aa_se, ok) arrays of length R, plus the realised
    arm-specific Se / Sp of the sampled impressions (for diagnostics)."""
    out = {}
    ea, qa, wa = per_puppet(ca, n_impr)
    er, qr, wr = per_puppet(cr, n_impr)
    for name, (xa, xr) in (("true", (ea, er)), ("naive", (qa, qr))):
        if name not in methods:
            continue
        ma, va = _mean_var(xa)
        mr, vr = _mean_var(xr)
        with np.errstate(divide="ignore", invalid="ignore"):
            lse = np.sqrt(va / ma ** 2 + vr / mr ** 2)
            out[name] = dict(p_alg=ma, p_ref=mr, ar=ma / mr, log_se=lse, aa=ma - mr, aa_se=np.sqrt(va + vr),
                             ok=(ma > 0) & (mr > 0))
    if not ({"rg_pooled", "rg_strat"} & set(methods)):
        return out
    Aa_h, Na_h = split_counts(ca.sum(1))
    Ar_h, Nr_h = split_counts(cr.sum(1))
    a_a, n_a = validation_draw(Aa_h, Na_h, n_val, rng)
    a_r, n_r = validation_draw(Ar_h, Nr_h, n_val, rng)
    with np.errstate(divide="ignore", invalid="ignore"):
        pa = np.where(n_a > 0, a_a / np.maximum(n_a, 1), 0.0)
        pr = np.where(n_r > 0, a_r / np.maximum(n_r, 1), 0.0)
        ta, tr = pa, pr                      # plug-in binomial variances (standard delta method)
        fpc_a = np.where(Na_h > 1, (Na_h - n_a) / np.maximum(Na_h - 1, 1), 0.0)
        fpc_r = np.where(Nr_h > 1, (Nr_h - n_r) / np.maximum(Nr_h - 1, 1), 0.0)
        vpa = np.where(n_a > 0, ta * (1 - ta) / np.maximum(n_a, 1) * fpc_a, 0.0)
        vpr = np.where(n_r > 0, tr * (1 - tr) / np.maximum(n_r, 1) * fpc_r, 0.0)
    Wa, covWa = _band_cov(wa)
    Wr, covWr = _band_cov(wr)
    Na = Na_h.sum(-1).astype(float)
    Nr = Nr_h.sum(-1).astype(float)
    for name, fun in (("rg_pooled", _rg_pooled), ("rg_strat", _rg_strat)):
        if name not in methods:
            continue
        p_a, p_r, v_lr, v_d = _delta(fun, Wa, Wr, pa, pr, covWa, covWr, vpa, vpr, Na, Nr)
        ok = (p_a > 0) & (p_r > 0)
        with np.errstate(divide="ignore", invalid="ignore"):
            out[name] = dict(p_alg=p_a, p_ref=p_r, ar=np.where(ok, p_a / p_r, np.nan), log_se=np.sqrt(v_lr),
                             aa=p_a - p_r, aa_se=np.sqrt(v_d), ok=ok)
    # realised impression-weighted Se / Sp in each arm (true, from all sampled impressions)
    cA = ca.sum(1).reshape(-1, N_TYPES, N_BANDS)
    cR = cr.sum(1).reshape(-1, N_TYPES, N_BANDS)
    diag = {}
    for nm, c in (("alg", cA), ("ref", cR)):
        pos = c[:, 2:, :].sum(1)
        neg = c[:, :2, :].sum(1)
        diag[f"se_{nm}"] = (pos * FLAG).sum(-1) / np.maximum(pos.sum(-1), 1)
        diag[f"sp_{nm}"] = (neg * (1 - FLAG)).sum(-1) / np.maximum(neg.sum(-1), 1)
    out["_diag"] = diag
    return out


def rogan_gladen(q, se, sp):
    """Rogan-Gladen corrected prevalence (not truncated)."""
    return (q + sp - 1.0) / (se + sp - 1.0)


def se_sp_from_validation(A_h, N_h, a_h, n_h):
    """IPW sensitivity and specificity from a band-stratified validation sample (arrays (..., 5))."""
    p_h = np.where(n_h > 0, a_h / np.maximum(n_h, 1), 0.0)
    pos = N_h * p_h
    neg = N_h * (1 - p_h)
    se = (pos * FLAG).sum(-1) / np.maximum(pos.sum(-1), 1e-300)
    sp = (neg * (1 - FLAG)).sum(-1) / np.maximum(neg.sum(-1), 1e-300)
    q = (N_h * FLAG).sum(-1) / N_h.sum(-1)
    return se, sp, q, (N_h * p_h).sum(-1) / N_h.sum(-1)
