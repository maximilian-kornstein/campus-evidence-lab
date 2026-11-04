"""DIF detection with anchors and partial-invariance estimation of group comparisons.

The procedure mirrors the pre-registered plan (sec:design-groups, steps 2-3):
  1. free-baseline model: the anchor items have invariant (a, b); every other item has
     group-specific (a, b); the focal group's latent means and variances are free;
  2. for every non-anchor item, a Wald test of a^(1) = a^(0), b^(1) = b^(0) (df = 2 + C),
     with the sandwich covariance of the DWLS estimator; Benjamini-Hochberg at FDR q
     across the tested items; an item is flagged if it is BH-significant AND its
     expected-score difference at the focal group's latent mean is >= es_min (0.25);
  3. final partial-invariance model: flagged items free, everything else invariant.
Two-group case (reference g = 0, focal g = 1).
"""
from __future__ import annotations

import numpy as np
from scipy.special import ndtr
from scipy.stats import chi2

from .fit import BifactorMG


def fit_mg(stats, spec, C, free, x0=None):
    m = BifactorMG(spec, C, n_groups=len(stats), free=free, fit_thresholds=True)
    return m.fit(stats, x0=x0)


def expected_score(aG, aS, b, thG, thS):
    return float(np.sum(ndtr(aG * thG + aS * thS - b)))


def wald_tests(fit, items, V=None):
    """Wald chi-square of (a, b) equality across groups 0 and 1 for each item in `items`."""
    m = fit.model
    V = fit.cov() if V is None else V
    out = []
    for j in items:
        rows = []
        for nm0, nm1 in [(("aG", j, -1), ("aG", j, 1)), (("aS", j, -1), ("aS", j, 1))] + \
                        [(("b", j, c, -1), ("b", j, c, 1)) for c in range(m.C)]:
            L = np.zeros(m.npar)
            L[m.names.index(nm1)] = 1.0
            L[m.names.index(nm0)] = -1.0
            rows.append(L)
        L = np.array(rows)
        d = L @ fit.theta
        Vd = L @ V @ L.T
        try:
            stat = float(d @ np.linalg.solve(Vd, d))
        except np.linalg.LinAlgError:
            stat = float(d @ np.linalg.pinv(Vd) @ d)
        df = len(d)
        out.append((stat, df, float(chi2.sf(stat, df))))
    return out


def bh(p, q=0.05):
    """Benjamini-Hochberg step-up: boolean rejections."""
    p = np.asarray(p, float)
    m = len(p)
    if m == 0:
        return np.zeros(0, bool)
    o = np.argsort(p)
    thr = q * np.arange(1, m + 1) / m
    ok = p[o] <= thr
    k = np.max(np.flatnonzero(ok)) + 1 if ok.any() else 0
    rej = np.zeros(m, bool)
    rej[o[:k]] = True
    return rej


def effect_sizes(fit, items):
    """|E[Y_j | theta = mu_1; focal params] - E[Y_j | theta = mu_1; reference params]|."""
    p0, p1 = fit.params(0), fit.params(1)
    spec = fit.model.spec
    mu1 = p1["mu"]
    es = []
    for j in items:
        thG, thS = mu1[0], mu1[spec[j]]
        e1 = expected_score(p1["aG"][j], p1["aS"][j], p1["b"][j], thG, thS)
        e0 = expected_score(p0["aG"][j], p0["aS"][j], p0["b"][j], thG, thS)
        es.append(abs(e1 - e0))
    return np.array(es)


def dif_procedure(stats, spec, C, anchors, q=0.05, es_min=0.25):
    """Run steps 1-3. Returns the free-baseline fit, test results, flags and the final fit."""
    J = len(spec)
    anchors = np.asarray(sorted(anchors), int)
    free_fb = np.ones(J, bool)
    free_fb[anchors] = False
    fb = fit_mg(stats, spec, C, free_fb)
    tested = np.flatnonzero(free_fb)
    V = fb.cov()
    tests = wald_tests(fb, tested, V=V)
    p = np.array([t[2] for t in tests])
    sig = bh(p, q)
    es = effect_sizes(fb, tested)
    flag_items = tested[sig & (es >= es_min)]
    free_final = np.zeros(J, bool)
    free_final[flag_items] = True
    final = fit_mg(stats, spec, C, free_final)
    return dict(fb=fb, fb_cov=V, tested=tested, wald=np.array([t[0] for t in tests]), p=p, sig=sig, es=es,
                flagged=flag_items, final=final)


def latent_contrast(fit, factor=0, V=None):
    """(estimate, sandwich SE) of the focal-minus-reference latent mean of `factor`."""
    i = fit.model.names.index(("mu", factor, 1))
    V = fit.cov() if V is None else V
    return float(fit.theta[i]), float(np.sqrt(max(V[i, i], 0.0)))


def fix_latent(model, fixes):
    """Fix free parameters of a BifactorMG (e.g. ("mu", 2, 1), ("lv", 2, 1)) at 0, in place.

    Used for anchoring in the stereotype domain only (rem:id-anchor-S): mu_I and sigma_I^2 of
    the focal group are not identified there and are fixed at the reference values."""
    for nm in fixes:
        k = model.names.index(nm)
        for g in range(model.G):
            idx = model.idx[g]
            idx[idx == k] = -1                 # the constant (0) is used instead
            idx[idx > k] -= 1
        del model.names[k]
        model.npar -= 1
    model._emask = [np.flatnonzero(model.idx[g] >= 0) for g in range(model.G)]
    model._tcols = [model.idx[g][model.idx[g] >= 0] for g in range(model.G)]
    return model


def fit_mg_s_anchored(stats, spec, C, free):
    """Two-group fit with mu_I and log sigma_I^2 of the focal group fixed at 0."""
    m = BifactorMG(spec, C, n_groups=len(stats), free=free, fit_thresholds=True)
    fix_latent(m, [("mu", 2, 1), ("lv", 2, 1)])
    return m.fit(stats)


def effect_size_avg(fit, items, n_nodes=20):
    """Revised secondary screen (sec:design-groups): the absolute difference between the expected item
    scores under the focal and the reference item parameters, averaged over the focal group's estimated
    latent distribution N(mu_1, diag(sigma_1^2)) of (theta_G, theta_s(j)) (Gauss-Hermite quadrature)."""
    from numpy.polynomial.hermite_e import hermegauss
    x, wq = hermegauss(n_nodes)
    wq = wq / wq.sum()
    p0, p1 = fit.params(0), fit.params(1)
    spec = fit.model.spec
    mu1, s1 = p1["mu"], np.sqrt(np.exp(p1["lv"]))
    out = []
    for j in items:
        f = spec[j]
        tG = mu1[0] + s1[0] * x[:, None]
        tS = mu1[f] + s1[f] * x[None, :]
        e1 = np.sum(ndtr(p1["aG"][j] * tG[..., None] + p1["aS"][j] * tS[..., None] - p1["b"][j][None, None, :]), axis=-1)
        e0 = np.sum(ndtr(p0["aG"][j] * tG[..., None] + p0["aS"][j] * tS[..., None] - p0["b"][j][None, None, :]), axis=-1)
        out.append(float(np.sum(wq[:, None] * wq[None, :] * np.abs(e1 - e0))))
    return np.array(out)
