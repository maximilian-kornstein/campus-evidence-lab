"""Tests of within-domain heterogeneity (asm:id-het) from polychoric tetrads (X9; rule D2(ii)).

Assumption id-het fails in a domain D exactly when, for some item k in D, the loading vectors of
the items in D \\ {k} are all proportional (lem:app-classes), that is, when the off-diagonal
polychoric correlations of D \\ {k} have one-factor structure and every tetrad among them
vanishes (lem:app-tetrad).  Hence

    H0 (id-het fails in D) = union over k in D of H0_k (D \\ {k} is proportional),

and the intersection-union test (Berger 1982) rejects H0 at level alpha iff it rejects every
H0_k at level alpha.  Each H0_k is tested by a Wald test of a non-redundant set of
m(m-3)/2 tetrads of the m = |D| - 1 items of D \\ {k}: with a reference triple (1, 2, 3),

    r_1k r_23 - r_2k r_13,   r_1k r_23 - r_3k r_12      (k >= 4),
    r_kl r_23 - r_2k r_3l                                  (4 <= k < l),

each of which introduces one new correlation, so their Jacobian has full row rank wherever
r_12 r_13 r_23 != 0.  The statistic t' (T Gamma T')^{-1} t is asymptotically chi-square with
m(m-3)/2 degrees of freedom under H0_k.  The reference triple is the three items of D \\ {k}
with the largest mean absolute correlation with the other items of D \\ {k}.

`bonferroni_single` is the earlier draft of D2(ii): every tetrad of every quadruple (three per
quadruple) tested by its own Wald z-test, Bonferroni-adjusted over all of them; reject if any
tetrad does.
"""
from __future__ import annotations

from itertools import combinations

import numpy as np
from scipy.stats import chi2, norm


def corr_matrix(rho, pairs, J):
    R = np.eye(J)
    R[pairs[:, 0], pairs[:, 1]] = rho
    R[pairs[:, 1], pairs[:, 0]] = rho
    return R


def pair_index(pairs, J):
    P = -np.ones((J, J), int)
    P[pairs[:, 0], pairs[:, 1]] = np.arange(len(pairs))
    P[pairs[:, 1], pairs[:, 0]] = np.arange(len(pairs))
    return P


def proportionality_test(R, Gamma, PI, items):
    """Wald test that the items (indices into R) have proportional loadings (all tetrads vanish).
    Returns (stat, df, p)."""
    items = np.asarray(items)
    m = len(items)
    if m < 4:
        return 0.0, 0, 1.0
    sub = np.abs(R[np.ix_(items, items)])
    np.fill_diagonal(sub, 0.0)
    order = items[np.argsort(-sub.sum(axis=1), kind="stable")]
    i1, i2, i3 = order[:3]
    rest = order[3:]
    rows = []                       # each row: list of (coef, (a, b), (c, d)) meaning coef * r_ab r_cd
    for k in rest:
        rows.append(((1, (i1, k), (i2, i3)), (-1, (i2, k), (i1, i3))))
        rows.append(((1, (i1, k), (i2, i3)), (-1, (i3, k), (i1, i2))))
    for k, l in combinations(rest, 2):
        rows.append(((1, (k, l), (i2, i3)), (-1, (i2, k), (i3, l))))
    T = np.zeros((len(rows), Gamma.shape[0]))
    t = np.zeros(len(rows))
    for q, terms in enumerate(rows):
        for coef, (a, b), (c, d) in terms:
            r1, r2 = R[a, b], R[c, d]
            t[q] += coef * r1 * r2
            T[q, PI[a, b]] += coef * r2
            T[q, PI[c, d]] += coef * r1
    V = T @ Gamma @ T.T
    try:
        stat = float(t @ np.linalg.solve(V, t))
    except np.linalg.LinAlgError:
        stat = float(t @ np.linalg.pinv(V) @ t)
    df = len(rows)
    return stat, df, float(chi2.sf(stat, df))


def iut_domain(R, Gamma, PI, domain, alpha=0.05):
    """Intersection-union test of H0: id-het fails in `domain`.  Returns dict with the
    leave-one-out p-values, their maximum (the IUT p-value) and the decision at alpha."""
    domain = np.asarray(domain)
    ps, stats = [], []
    for k in domain:
        s, df, p = proportionality_test(R, Gamma, PI, domain[domain != k])
        ps.append(p)
        stats.append(s)
    pmax = float(np.max(ps))
    return dict(p_loo=np.array(ps), stat_loo=np.array(stats), df=df, p_iut=pmax, reject=pmax < alpha)


def n_tetrads(sizes):
    """Number of tetrads (three per quadruple) examined by the earlier rule over domains of these sizes."""
    from math import comb
    return int(sum(3 * comb(m, 4) for m in sizes))


def bonferroni_single(R, Gamma, PI, domain, n_total, alpha=0.05):
    """The earlier D2(ii): each of the three tetrads of every quadruple of the domain tested by its own
    Wald z-test at level alpha / n_total (Bonferroni over all n_total tetrads examined in all domains).
    Returns (reject, max |z|)."""
    quads = np.array(list(combinations(np.asarray(domain), 4)))
    K = len(quads)
    a, b, c, d = quads.T
    prs = [((a, b), (c, d)), ((a, c), (b, d)), ((a, d), (b, c))]
    prods = [R[p, q] * R[r, s] for (p, q), (r, s) in prs]
    zs = []
    rowsK = np.arange(K)
    for u, v in ((0, 1), (0, 2), (1, 2)):
        t = prods[u] - prods[v]
        g = np.zeros((K, Gamma.shape[0]))
        for w, sign in ((u, 1.0), (v, -1.0)):
            (p, q), (r, s) = prs[w]
            np.add.at(g, (rowsK, PI[p, q]), sign * R[r, s])
            np.add.at(g, (rowsK, PI[r, s]), sign * R[p, q])
        var = np.einsum("ki,ij,kj->k", g, Gamma, g)
        zs.append(np.abs(t) / np.sqrt(np.maximum(var, 1e-300)))
    zmax = float(np.max(zs))
    crit = norm.ppf(1 - alpha / (2 * n_total))
    return zmax > crit, zmax


def onefactor_residual_test(rho, Gamma, pairs, J):
    """Residual-based test of one-factor structure (all tetrads vanish) for J items: DWLS fit of
    r_kl = l_k l_l with weights diag(Gamma)^{-1}, then T = e' (P Gamma P')^+ e with P = I - D (D'WD)^{-1} D'W
    and rank J(J-3)/2 (Browne 1984).  Invariant to how the tetrad restrictions are written.
    Returns (stat, df, p)."""
    from .fit import lm_solve
    j, k = pairs[:, 0], pairs[:, 1]
    P = len(j)
    w = 1.0 / np.maximum(np.diag(Gamma), 1e-12)
    sw = np.sqrt(w)
    pr = np.arange(P)

    def implied(l):
        D = np.zeros((P, J))
        D[pr, j] = l[k]
        D[pr, k] = l[j]
        return l[j] * l[k], D

    def fj(l):
        r, D = implied(l)
        return sw * (rho - r), -sw[:, None] * D

    res = lm_solve(fj, np.full(J, 0.6), np.full(J, -0.999), np.full(J, 0.999), max_iter=200)
    r, D = implied(res.x)
    e = rho - r
    H = D.T @ (w[:, None] * D)
    Pm = np.eye(P) - D @ np.linalg.solve(H, D.T * w[None, :])
    V = Pm @ Gamma @ Pm.T
    df = J * (J - 3) // 2
    U, s, Vt = np.linalg.svd(V)
    Vp = (Vt[:df].T / s[:df]) @ U[:, :df].T
    stat = float(e @ Vp @ e)
    return stat, df, float(chi2.sf(stat, df))
