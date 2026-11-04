"""Single-group DWLS fit of an ordinal factor model with an arbitrary loading pattern (X6).

Correlation structure only (thresholds saturated), probit latent response, orthogonal factors
with unit variances:

    R_jk = a_j' a_k / (s_j s_k),   s_j = sqrt(1 + a_j' a_j),

where the slope matrix A (J x F) is linear in the free parameters:
A[r, c] = sum over pattern entries (r, c, p, coef) of coef * theta_p.  This covers the
standard bifactor model, the bifactor model with cross-loadings of some items on another
specific factor, and the bifactor model with an acquiescence (random-intercept) method
factor whose loadings are +m on positively worded and -m on reverse-keyed items (one
parameter m; Maydeu-Olivares and Coffman 2006).  Estimation, weights and the sandwich
covariance are those of fit.py.  The ECV of item j is a_jG^2 / (a_jG^2 + a_j,spec(j)^2):
only the item's own specific factor enters, as in def:boundary.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .fit import A_MAX, lm_solve
from .polychoric import all_pairs


class PatternModel:
    """entries: list of (row, col, param, coef); spec: (J,) own specific factor (1 = S, 2 = I);
    F: number of factors (column 0 = G)."""

    def __init__(self, entries, n_par, J, F, spec, names=None):
        self.entries = [(int(r), int(c), int(p), float(w)) for r, c, p, w in entries]
        self.npar = int(n_par)
        self.J, self.F = int(J), int(F)
        self.spec = np.asarray(spec, int)
        self.pairs = all_pairs(J)
        self.names = names or [f"p{i}" for i in range(n_par)]
        self.col_of = np.full(n_par, -1)
        for r, c, p, w in self.entries:
            if self.col_of[p] not in (-1, c):
                raise ValueError("each parameter must act on one factor column")
            self.col_of[p] = c

    # ---- constructors
    @classmethod
    def bifactor(cls, spec, cross=None, method_keys=None):
        """Bifactor pattern (G + own specific factor), optionally with free cross-loadings
        `cross` = {item: other specific factor} and an acquiescence factor with loadings
        method_keys[j] * m (one common parameter m)."""
        spec = np.asarray(spec, int)
        J = len(spec)
        ent, names, p = [], [], 0
        for j in range(J):
            ent.append((j, 0, p, 1.0)); names.append(f"aG{j}"); p += 1
            ent.append((j, spec[j], p, 1.0)); names.append(f"as{j}"); p += 1
        for j, f in (cross or {}).items():
            ent.append((j, f, p, 1.0)); names.append(f"ax{j}"); p += 1
        F = 3
        if method_keys is not None:
            F = 4
            for j in range(J):
                ent.append((j, 3, p, float(method_keys[j])))
            names.append("m"); p += 1
        return cls(ent, p, J, F, spec, names)

    def A(self, theta):
        A = np.zeros((self.J, self.F))
        for r, c, p, w in self.entries:
            A[r, c] += w * theta[p]
        return A

    def implied(self, theta):
        A = self.A(theta)
        N = A @ A.T
        s = np.sqrt(1 + np.diag(N))
        j, k = self.pairs[:, 0], self.pairs[:, 1]
        R = N[j, k] / (s[j] * s[k])
        P = len(j)
        D = np.zeros((P, self.npar))
        # rows of each item among the pairs
        for r, c, p, w in self.entries:
            mj = j == r
            mk = k == r
            if mj.any():
                kk = k[mj]
                D[mj, p] += w * (A[kk, c] / (s[r] * s[kk]) - R[mj] * A[r, c] / s[r] ** 2)
            if mk.any():
                jj = j[mk]
                D[mk, p] += w * (A[jj, c] / (s[jj] * s[r]) - R[mk] * A[r, c] / s[r] ** 2)
        return R, D

    def default_start(self, lamG=0.6, lamS=0.4, other=0.0, m=0.2):
        th = np.zeros(self.npar)
        s = np.sqrt(1 - lamG ** 2 - lamS ** 2)
        for i, nm in enumerate(self.names):
            if nm.startswith("aG"):
                th[i] = lamG / s
            elif nm.startswith("as"):
                th[i] = lamS / s
            elif nm.startswith("ax"):
                th[i] = other
            else:
                th[i] = m
        return th

    def random_start(self, rng):
        th = np.zeros(self.npar)
        for i, nm in enumerate(self.names):
            if nm.startswith("aG"):
                th[i] = rng.uniform(0.2, 0.8) / 0.6
            elif nm.startswith("as"):
                th[i] = rng.uniform(0.1, 0.6) / 0.6
            elif nm.startswith("ax"):
                th[i] = rng.uniform(-0.2, 0.2)
            else:
                th[i] = rng.uniform(0.05, 0.4)
        return th

    def fix_signs(self, th):
        """Reflect each factor so that its loadings sum to a positive number over the items that
        load on it as G or as their own specific factor (the method factor: m >= 0)."""
        th = th.copy()
        A = self.A(th)
        for c in range(self.F):
            if c == 0:
                rows = np.arange(self.J)
            elif c in (1, 2):
                rows = np.flatnonzero(self.spec == c)
            else:
                rows = None
            if rows is None:
                flip = np.sum([th[p] for p in range(self.npar) if self.col_of[p] == c]) < 0
            else:
                flip = np.sum(A[rows, c]) < 0
            if flip:
                th[self.col_of == c] *= -1
        return th

    def fit(self, rho, weights, x0=None, max_iter=300):
        sw = np.sqrt(weights)
        x0 = self.default_start() if x0 is None else np.asarray(x0, float)
        lo, hi = np.full(self.npar, -A_MAX), np.full(self.npar, A_MAX)
        x0 = np.clip(x0, lo + 1e-9, hi - 1e-9)

        def fj(t):
            R, D = self.implied(t)
            return sw * (rho - R), -sw[:, None] * D

        r = lm_solve(fj, x0, lo, hi, max_iter=max_iter)
        return PatternFit(self, self.fix_signs(r.x), rho, weights, r)


@dataclass
class PatternFit:
    model: PatternModel
    theta: np.ndarray
    rho: np.ndarray
    weights: np.ndarray
    opt: object

    @property
    def converged(self):
        return bool(self.opt.success)

    def A(self):
        return self.model.A(self.theta)

    def ecv(self):
        A = self.A()
        aG, aS = A[:, 0], A[np.arange(self.model.J), self.model.spec]
        return aG ** 2 / (aG ** 2 + aS ** 2)

    def cov(self, Gamma):
        _, D = self.model.implied(self.theta)
        W = self.weights
        H = D.T @ (W[:, None] * D)
        WD = W[:, None] * D
        Hi = np.linalg.pinv(H, rcond=1e-10)
        return Hi @ (WD.T @ Gamma @ WD) @ Hi

    def ident_diag(self):
        _, D = self.model.implied(self.theta)
        sv = np.linalg.svd(np.sqrt(self.weights)[:, None] * D, compute_uv=False)
        return float(sv[-1] / sv[0])

    def ecv_se(self, V):
        A = self.A()
        m = self.model
        se = np.empty(m.J)
        # parameter index of (j, 0) and (j, spec_j)
        pG = {r: p for r, c, p, w in m.entries if c == 0}
        pS = {r: p for r, c, p, w in m.entries if c == m.spec[r] and c in (1, 2)}
        for j in range(m.J):
            aG, aS = A[j, 0], A[j, m.spec[j]]
            den = (aG ** 2 + aS ** 2) ** 2
            g = np.zeros(m.npar)
            g[pG[j]] += 2 * aG * aS ** 2 / den
            g[pS[j]] += -2 * aS * aG ** 2 / den
            se[j] = np.sqrt(max(g @ V @ g, 0.0))
        return se

    def param(self, name):
        return float(self.theta[self.model.names.index(name)])


def fit_multistart(model, rho, weights, rng, n_starts=3, x0=None):
    """Default start plus n_starts - 1 random starts; the fit with the smallest objective."""
    fits = [model.fit(rho, weights, x0=x0)]
    for _ in range(n_starts - 1):
        fits.append(model.fit(rho, weights, x0=model.random_start(rng)))
    return min(fits, key=lambda f: f.opt.cost)
