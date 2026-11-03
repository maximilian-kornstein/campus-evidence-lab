"""Limited-information (DWLS) estimation of the bifactor ordinal model, single- and multi-group.

Model (probit latent response, IRT "theta" parameterisation): in group g,
    Y*_j = a_jG theta_G + a_js theta_s + e_j,  e_j ~ N(0, 1),  theta ~ N(mu_g, diag(sigma2_g)),
with factors ordered (G, S, I) and orthogonal.  The implied statistics are
    tau_jc^(g) = (b_jc^(g) - a_j' mu_g) / sd_j^(g),       sd_j^(g) = sqrt(a_j' Sigma_g a_j + 1),
    rho_jk^(g) = a_j' Sigma_g a_k / (sd_j^(g) sd_k^(g)).
Group 0 is the reference (mu = 0, Sigma = I).  Items constrained across groups share
(a, b) (anchors and other invariant items); free items have group-specific (a, b).

The estimator minimises sum_g (s_g - sigma_g(theta))' W_g (s_g - sigma_g(theta)) with
s_g the sample thresholds and polychorics, and W_g = diag(Gamma_g)^{-1} (DWLS).  With a
single group and ``fit_thresholds=False`` only polychorics are fitted (thresholds are
saturated), which is the usual single-group bifactor fit.  Standard errors are the
sandwich (Delta' W Delta)^{-1} Delta' W Gamma W Delta (Delta' W Delta)^{-1}.

ECV_j = a_jG^2 / (a_jG^2 + a_js^2) (scale-free; equals lam_G^2 / (lam_G^2 + lam_s^2)).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares

from .polychoric import acov, all_pairs, polychoric

A_MAX = 12.0     # bound on |slope| (a = 12 <-> standardised loading 0.997)


# ---------------------------------------------------------------------------
# Projected Levenberg-Marquardt for small least-squares problems
# ---------------------------------------------------------------------------
@dataclass
class LMResult:
    x: np.ndarray
    cost: float
    nit: int
    success: bool
    status: int


def lm_solve(fj, x0, lo, hi, max_iter=200, ftol=1e-12, xtol=1e-10, gtol=1e-9):
    """Minimise 0.5 ||r(x)||^2, (r, J) = fj(x), with Marquardt damping (mu diag(J'J)) and
    projection of each trial step onto the box [lo, hi].  Converges when the relative
    cost decrease, the relative step or the projected gradient is below tolerance."""
    x = np.clip(np.asarray(x0, float), lo, hi)
    r, Jm = fj(x)
    cost = 0.5 * r @ r
    mu = 1e-3
    status = 0
    it = 0
    for it in range(1, max_iter + 1):
        g = Jm.T @ r
        H = Jm.T @ Jm
        dH = np.maximum(np.diag(H), 1e-12)
        pg = x - np.clip(x - g, lo, hi)
        if np.max(np.abs(pg)) < gtol:
            status = 1
            break
        accepted = False
        for _ in range(30):
            try:
                step = np.linalg.solve(H + mu * np.diag(dH), -g)
            except np.linalg.LinAlgError:
                mu *= 10
                continue
            xn = np.clip(x + step, lo, hi)
            rn, Jn = fj(xn)
            cn = 0.5 * rn @ rn
            if np.isfinite(cn) and cn <= cost:
                accepted = True
                break
            mu *= 10
        if not accepted:
            status = 2               # cannot decrease: at a (local) minimum to working precision
            break
        dx = np.max(np.abs(xn - x)) / (1e-8 + np.max(np.abs(x)))
        dc = (cost - cn) / max(cost, 1e-300)
        x, r, Jm, cost = xn, rn, Jn, cn
        mu = max(mu / 5, 1e-12)
        if dc < ftol or dx < xtol:
            status = 3
            break
    return LMResult(x=x, cost=float(cost), nit=it, success=status > 0, status=status)


# ---------------------------------------------------------------------------
# Sample statistics
# ---------------------------------------------------------------------------
@dataclass
class GroupStats:
    tau: np.ndarray      # (J, C)
    rho: np.ndarray      # (P,)
    Gamma: np.ndarray    # covariance of (vec tau, rho), or of rho if corr_only
    n: int
    corr_only: bool
    pc: object = None

    def vector(self):
        return self.rho if self.corr_only else np.concatenate([self.tau.ravel(), self.rho])


def group_stats(Y, K, corr_only=False, pairs=None, rho0=None) -> GroupStats:
    pc = polychoric(Y, K, pairs=pairs, rho0=rho0)
    G = acov(Y, pc, corr_only=corr_only)
    return GroupStats(pc.tau, pc.rho, G, Y.shape[0], corr_only, pc)


# ---------------------------------------------------------------------------
# Model-implied statistics and Jacobian for one group
# ---------------------------------------------------------------------------
def _group_model(aG, aS, b, mu, lv, spec, pairs, fit_thr):
    """Implied (vec tau, rho) and d/d(aG, aS, vec b, mu(3), lv(3)) for one group."""
    J, C = b.shape
    s2 = np.exp(lv)
    sG2, sp2 = s2[0], s2[spec]
    v = aG ** 2 * sG2 + aS ** 2 * sp2 + 1.0
    sd = np.sqrt(v)
    j, k = pairs[:, 0], pairs[:, 1]
    P = len(j)
    same = (spec[j] == spec[k]).astype(float)
    num = aG[j] * aG[k] * sG2 + same * aS[j] * aS[k] * sp2[j]
    rho = num / (sd[j] * sd[k])
    ne = 2 * J + J * C + 6
    iG, iS, iB, iM, iL = 0, J, 2 * J, 2 * J + J * C, 2 * J + J * C + 3
    # rho rows
    Jr = np.zeros((P, ne))
    sdjk = sd[j] * sd[k]
    pr = np.arange(P)
    Jr[pr, iG + j] = aG[k] * sG2 / sdjk - rho * aG[j] * sG2 / v[j]          # j != k: no collisions
    Jr[pr, iG + k] = aG[j] * sG2 / sdjk - rho * aG[k] * sG2 / v[k]
    Jr[pr, iS + j] = same * aS[k] * sp2[j] / sdjk - rho * aS[j] * sp2[j] / v[j]
    Jr[pr, iS + k] = same * aS[j] * sp2[k] / sdjk - rho * aS[k] * sp2[k] / v[k]
    Jr[:, iL + 0] = sG2 * (aG[j] * aG[k] / sdjk - 0.5 * rho * (aG[j] ** 2 / v[j] + aG[k] ** 2 / v[k]))
    for s in (1, 2):
        ij, ik = (spec[j] == s).astype(float), (spec[k] == s).astype(float)
        Jr[:, iL + s] = s2[s] * (same * ij * aS[j] * aS[k] / sdjk
                                 - 0.5 * rho * (ij * aS[j] ** 2 / v[j] + ik * aS[k] ** 2 / v[k]))
    if not fit_thr:
        return rho, Jr
    mus = mu[spec]
    m = aG * mu[0] + aS * mus
    tau = (b - m[:, None]) / sd[:, None]
    Jt = np.zeros((J * C, ne))
    rows = np.arange(J * C)
    jj = np.repeat(np.arange(J), C)
    tf = tau.ravel()
    Jt[rows, iG + jj] = -mu[0] / sd[jj] - tf * aG[jj] * sG2 / v[jj]
    Jt[rows, iS + jj] = -mus[jj] / sd[jj] - tf * aS[jj] * sp2[jj] / v[jj]
    Jt[rows, iB + rows] = 1.0 / sd[jj]
    Jt[rows, iM + 0] = -aG[jj] / sd[jj]
    Jt[rows, iM + spec[jj]] = -aS[jj] / sd[jj]
    Jt[rows, iL + 0] = -tf * aG[jj] ** 2 * sG2 / (2 * v[jj])
    Jt[rows, iL + spec[jj]] = -tf * aS[jj] ** 2 * sp2[jj] / (2 * v[jj])
    return np.concatenate([tf, rho]), np.vstack([Jt, Jr])


# ---------------------------------------------------------------------------
# Multi-group bifactor model
# ---------------------------------------------------------------------------
class BifactorMG:
    """Multi-group bifactor DWLS model.

    spec: (J,) specific factor per item (1 = S, 2 = I); C: number of thresholds;
    n_groups; free: (J,) bool, items whose (a, b) are group-specific (others invariant);
    fit_thresholds: fit thresholds (needed for latent means); free_var: estimate the
    factor variances of groups g >= 1 (else fixed at 1)."""

    def __init__(self, spec, C, n_groups=1, free=None, fit_thresholds=True, free_var=True, free_mean=True):
        self.spec = np.asarray(spec, int)
        self.J = len(self.spec)
        self.C = C
        self.G = n_groups
        self.free = np.zeros(self.J, bool) if free is None else np.asarray(free, bool)
        self.fit_thr = fit_thresholds
        if n_groups > 1 and not fit_thresholds:
            raise ValueError("multi-group models need thresholds")
        self.free_var = free_var and n_groups > 1
        self.free_mean = free_mean and n_groups > 1
        self.pairs = all_pairs(self.J)
        J, C = self.J, C
        ne = 2 * J + J * C + 6
        self.ne = ne
        # parameter layout
        names, k = [], 0
        idx = [np.full(ne, -1) for _ in range(n_groups)]
        const = [np.zeros(ne) for _ in range(n_groups)]
        for j in range(J):
            for g in range(n_groups):
                idx[g][j] = k
                idx[g][J + j] = k + 1
            names += [("aG", j, -1), ("aS", j, -1)]
            k += 2
        if fit_thresholds:
            for j in range(J):
                for c in range(C):
                    for g in range(n_groups):
                        idx[g][2 * J + j * C + c] = k
                    names.append(("b", j, c, -1))
                    k += 1
        for g in range(1, n_groups):
            for j in np.flatnonzero(self.free):
                idx[g][j] = k
                idx[g][J + j] = k + 1
                names += [("aG", j, g), ("aS", j, g)]
                k += 2
                for c in range(C):
                    idx[g][2 * J + j * C + c] = k
                    names.append(("b", j, c, g))
                    k += 1
            if self.free_mean:
                for f in range(3):
                    idx[g][2 * J + J * C + f] = k
                    names.append(("mu", f, g))
                    k += 1
            if self.free_var:
                for f in range(3):
                    idx[g][2 * J + J * C + 3 + f] = k
                    names.append(("lv", f, g))
                    k += 1
        self.idx, self.const, self.names, self.npar = idx, const, names, k
        # within a group every free parameter appears at most once in the expanded vector,
        # so d stats / d theta is a column scatter of d stats / d expanded
        self._emask = [np.flatnonzero(idx[g] >= 0) for g in range(n_groups)]
        self._tcols = [idx[g][idx[g] >= 0] for g in range(n_groups)]

    # -- expanded parameters of group g
    def expand(self, theta, g):
        e = np.where(self.idx[g] >= 0, theta[np.maximum(self.idx[g], 0)], self.const[g])
        J, C = self.J, self.C
        return dict(aG=e[:J], aS=e[J:2 * J], b=e[2 * J:2 * J + J * C].reshape(J, C),
                    mu=e[2 * J + J * C:2 * J + J * C + 3], lv=e[2 * J + J * C + 3:])

    def implied(self, theta):
        sig, jac = [], []
        for g in range(self.G):
            p = self.expand(theta, g)
            s, Je = _group_model(p["aG"], p["aS"], p["b"], p["mu"], p["lv"], self.spec, self.pairs, self.fit_thr)
            sig.append(s)
            Jt = np.zeros((Je.shape[0], self.npar))
            Jt[:, self._tcols[g]] = Je[:, self._emask[g]]
            jac.append(Jt)
        return np.concatenate(sig), np.vstack(jac)

    def start(self, stats):
        """Start values: lam_G = 0.6, lam_s = 0.4; b from the reference group's thresholds."""
        th = np.zeros(self.npar)
        lamG, lamS = 0.6, 0.4
        s = np.sqrt(1 - lamG ** 2 - lamS ** 2)
        for i, nm in enumerate(self.names):
            if nm[0] == "aG":
                th[i] = lamG / s
            elif nm[0] == "aS":
                th[i] = lamS / s
            elif nm[0] == "b":
                g = max(nm[3], 0)
                th[i] = stats[g].tau[nm[1], nm[2]] / s
        return th

    def bounds(self):
        lo, hi = np.full(self.npar, -np.inf), np.full(self.npar, np.inf)
        for i, nm in enumerate(self.names):
            if nm[0] in ("aG", "aS"):
                lo[i], hi[i] = -A_MAX, A_MAX
            elif nm[0] == "lv":
                lo[i], hi[i] = -3.0, 3.0
            elif nm[0] == "b":
                lo[i], hi[i] = -40.0, 40.0
        return lo, hi

    def fit(self, stats, x0=None, weights=None, max_nfev=200):
        """stats: list of GroupStats (one per group). Returns a Fit."""
        s = np.concatenate([st.vector() for st in stats])
        if weights is None:
            weights = np.concatenate([1.0 / np.maximum(np.diag(st.Gamma), 1e-12) for st in stats])
        sw = np.sqrt(weights)
        x0 = self.start(stats) if x0 is None else np.asarray(x0, float)
        lo, hi = self.bounds()
        x0 = np.clip(x0, lo + 1e-9, hi - 1e-9)

        def fj(t):
            sig, D = self.implied(t)
            return sw * (s - sig), -sw[:, None] * D

        r = lm_solve(fj, x0, lo, hi, max_iter=max_nfev)
        th = self.fix_signs(r.x)
        return Fit(self, th, stats, weights, r)

    def fix_signs(self, th):
        """Reflect factors so that the reference group's loadings sum to a positive number."""
        th = th.copy()
        p = self.expand(th, 0)
        flip = [np.sum(p["aG"]) < 0] + [np.sum(p["aS"][self.spec == s]) < 0 for s in (1, 2)]
        for i, nm in enumerate(self.names):
            if nm[0] == "aG" and flip[0]:
                th[i] = -th[i]
            elif nm[0] == "aS" and flip[self.spec[nm[1]]]:
                th[i] = -th[i]
            elif nm[0] == "mu" and flip[nm[1]]:
                th[i] = -th[i]
        return th


@dataclass
class Fit:
    model: BifactorMG
    theta: np.ndarray
    stats: list
    weights: np.ndarray
    opt: object

    @property
    def converged(self):
        return bool(self.opt.success)

    def params(self, g=0):
        return self.model.expand(self.theta, g)

    def ecv(self, g=0):
        p = self.params(g)
        return p["aG"] ** 2 / (p["aG"] ** 2 + p["aS"] ** 2)

    def ecv_std(self, g=0):
        """ECV on group g's own standardised latent scale (uses sigma2_g)."""
        p = self.params(g)
        s2 = np.exp(p["lv"])
        x, y = p["aG"] ** 2 * s2[0], p["aS"] ** 2 * s2[self.model.spec]
        return x / (x + y)

    def lam(self, g=0):
        p = self.params(g)
        s2 = np.exp(p["lv"])
        sd = np.sqrt(p["aG"] ** 2 * s2[0] + p["aS"] ** 2 * s2[self.model.spec] + 1)
        return p["aG"] * np.sqrt(s2[0]) / sd, p["aS"] * np.sqrt(s2[self.model.spec]) / sd

    def delta(self):
        return self.model.implied(self.theta)[1]

    def cov(self):
        """Sandwich covariance of theta-hat (pseudo-inverse if the information is singular)."""
        D = self.delta()
        W = self.weights
        H = D.T @ (W[:, None] * D)
        Gam = _blockdiag([st.Gamma for st in self.stats])
        WD = W[:, None] * D
        M = WD.T @ Gam @ WD
        Hi = np.linalg.pinv(H, rcond=1e-10)
        return Hi @ M @ Hi

    def ident_diag(self):
        """Smallest / largest singular value of W^{1/2} Delta (0 = not locally identified)."""
        D = np.sqrt(self.weights)[:, None] * self.delta()
        sv = np.linalg.svd(D, compute_uv=False)
        return float(sv[-1] / sv[0])

    def ecv_se(self, g=0, V=None):
        """Delta-method SEs of ECV_j (group g, reference metric)."""
        V = self.cov() if V is None else V
        p = self.params(g)
        aG, aS = p["aG"], p["aS"]
        den = (aG ** 2 + aS ** 2) ** 2
        dG, dS = 2 * aG * aS ** 2 / den, -2 * aS * aG ** 2 / den
        J = self.model.J
        idx = self.model.idx[g]
        se = np.empty(J)
        for j in range(J):
            gvec = np.zeros(self.model.npar)
            gvec[idx[j]] += dG[j]
            gvec[idx[J + j]] += dS[j]
            se[j] = np.sqrt(max(gvec @ V @ gvec, 0.0))
        return se

    def index_of(self, name):
        return self.model.names.index(name)


def _blockdiag(blocks):
    n = sum(b.shape[0] for b in blocks)
    out = np.zeros((n, n))
    i = 0
    for b in blocks:
        m = b.shape[0]
        out[i:i + m, i:i + m] = b
        i += m
    return out


# ---------------------------------------------------------------------------
# Correlated-factors model (S and I factors, no general factor), correlation structure only
# ---------------------------------------------------------------------------
@dataclass
class CorrFit:
    lam: np.ndarray
    phi: float
    opt: object
    se_phi: float = float("nan")


def fit_corrfactors(rho, pairs, spec, weights, Gamma=None, x0=None):
    """DWLS fit of rho_jk = lam_j lam_k Phi_{f(j) f(k)}, f in {S, I}, Phi_SI = phi = tanh(z)."""
    spec = np.asarray(spec, int)
    J = len(spec)
    j, k = pairs[:, 0], pairs[:, 1]
    cross = (spec[j] != spec[k]).astype(float)
    sw = np.sqrt(weights)
    P = len(j)
    pr = np.arange(P)

    def implied(t):
        lam, z = t[:J], t[J]
        ph = np.tanh(z)
        fac = 1 + cross * (ph - 1)
        r = lam[j] * lam[k] * fac
        D = np.zeros((P, J + 1))
        D[pr, j] = lam[k] * fac
        D[pr, k] = lam[j] * fac
        D[:, J] = cross * lam[j] * lam[k] * (1 - ph ** 2)
        return r, D

    x0 = np.r_[np.full(J, 0.6), 0.5] if x0 is None else x0

    def fj(t):
        rr, D = implied(t)
        return sw * (rho - rr), -sw[:, None] * D

    r = lm_solve(fj, x0, np.r_[np.full(J, -0.999), -5.0], np.r_[np.full(J, 0.999), 5.0])
    t = r.x.copy()
    for s in (1, 2):                      # reflect each factor to positive loading sum
        m = spec == s
        if t[:J][m].sum() < 0:
            t[:J][m] *= -1
            t[J] *= -1
    out = CorrFit(t[:J], float(np.tanh(t[J])), r)
    if Gamma is not None:
        _, D = implied(t)
        H = D.T @ (weights[:, None] * D)
        WD = weights[:, None] * D
        Hi = np.linalg.pinv(H, rcond=1e-10)
        V = Hi @ (WD.T @ Gamma @ WD) @ Hi
        out.se_phi = float(np.sqrt(max(V[J, J], 0)) * (1 - out.phi ** 2))
    out.x = t
    return out


# ---------------------------------------------------------------------------
# Set identification of ECV for a two-item specific factor
# ---------------------------------------------------------------------------
def ecv_identified_set_two_items(lamG1, lamG2, prod):
    """Identified sets of ECV for the two items of a two-item specific factor.

    With lam_G identified (from the other blocks) and only the product p = lam_s1 lam_s2 of
    the specific loadings identified, any lam_s1 in [|p| / sqrt(1 - lam_G2^2), sqrt(1 - lam_G1^2)]
    is observationally equivalent (unique variances >= 0).  Returns ((lo1, hi1), (lo2, hi2))."""
    p2 = prod ** 2

    def rng(lg_self, lg_other):
        s_max2 = 1 - lg_self ** 2
        s_min2 = p2 / max(1 - lg_other ** 2, 1e-12)
        lo = lg_self ** 2 / (lg_self ** 2 + s_max2)
        hi = lg_self ** 2 / (lg_self ** 2 + s_min2)
        return lo, hi

    return rng(lamG1, lamG2), rng(lamG2, lamG1)
