"""List experiments (item count technique) and social-desirability bias (sec:sensitive).

Notation follows sec:sensitive: arms T (list treatment), C (list control), D (direct);
Z = truthful (private) agreement, D = direct answer, W = control count, Y = reported
count; pi = Pr(Z = 1), pi^D = Pr(D = 1), SDB = pi - pi^D = eta - phi with hidden
endorsement eta = Pr(Z = 1, D = 0) and false endorsement phi = Pr(Z = 0, D = 1).

Data-generating model
  * theta_G ~ N(0, 1); the sensitive item's latent response is a theta_G + e, e ~ N(0, 1);
  * threshold-shift model of social desirability (def:le-shift, normal-ogive version):
    Z = 1{a theta + e >= b*}, D_shift = 1{a theta + e >= b* + delta}, so D_shift <= Z
    (monotonicity) and Pr(D_shift = 1) = pi_d_shift;
  * optional false endorsement (violates monotonicity): if Z = 0, D = 1 with probability
    phi_rate, so phi = phi_rate (1 - pi);
  * control list: J items with prevalence 1/2 arranged in floor(J/2) independent pairs with
    *binary* within-pair correlation rho (Pr(1,1) = Pr(0,0) = (1 + rho)/4), plus one
    independent item if J is odd (thm:design(d)); controls independent of (theta, Z, D);
  * floor and ceiling effects in arm T (thm:design): a respondent with Z = 1 and W = J
    reports J with probability kc; with Z = 1 and W = 0 reports 0 with probability kf.

Designs: split (direct question only in arm D) and paired (every respondent answers the
direct question; list respondents after the list).

Estimators (thm:joint-sdb)
  * split:   SDB_S = Ybar_T - Ybar_C - Dbar_D, exact variance (eq:le-split), plug-in SE;
  * paired, post-stratified: SDB_PS = sum_d P_d (Ybar_Td - Ybar_Cd) - P_1, plug-in SE from eq:le-vps;
  * paired, combined (monotonicity): eta = P_0 (Ybar_T0 - Ybar_C0), plug-in SE from eq:le-veta;
  * split, covariate-adjusted (rem:le-joint in spirit): arm means adjusted for a score of
    theta_G by separate-slope regression (Lin 2013), HC2 variances.
Allocation (thm:design): Neyman split allocation (a) and the paired allocation (b).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.special import ndtri

Z975 = 1.959963984540054


# ---------------------------------------------------------------------------
# design and exact moments
# ---------------------------------------------------------------------------
@dataclass
class ListDesign:
    J: int = 4
    rho: float = 0.0              # binary within-pair correlation of the control items
    pi: float = 0.30
    pi_d_shift: float = 0.20      # direct prevalence produced by the threshold shift alone
    a: float = 0.75               # slope of the sensitive item on theta_G (probit scale)
    phi_rate: float = 0.0         # Pr(D = 1 | Z = 0)
    kc: float = 0.0               # ceiling-effect probability
    kf: float = 0.0               # floor-effect probability

    @property
    def m(self):
        return self.J // 2

    @property
    def odd(self):
        return self.J % 2

    @property
    def eta(self):
        return self.pi - self.pi_d_shift

    @property
    def phi(self):
        return self.phi_rate * (1 - self.pi)

    @property
    def pi_d(self):
        return self.pi_d_shift + self.phi

    @property
    def sdb(self):
        return self.pi - self.pi_d

    @property
    def b_star(self):
        return -np.sqrt(1 + self.a ** 2) * ndtri(self.pi)

    @property
    def delta(self):
        return -np.sqrt(1 + self.a ** 2) * ndtri(self.pi_d_shift) - self.b_star

    def sigma_c2(self):
        return self.m * (1 + self.rho) / 2 + 0.25 * self.odd

    def sigma_t2(self):
        return self.sigma_c2() + self.pi * (1 - self.pi)

    def v_d(self):
        return self.pi_d * (1 - self.pi_d)

    def p_w0(self):
        """Pr(W = 0) = Pr(W = J) (eq:le-pairs, times 1/2 for an odd extra item)."""
        return ((1 + self.rho) / 4) ** self.m * (0.5 ** self.odd)

    def exposure(self):
        return 2 * self.p_w0()

    def fc_bias(self):
        """Bias of the split SDB estimator from floor/ceiling effects (eq:le-fcbias)."""
        return -self.pi * (self.kc * self.p_w0() + self.kf * self.p_w0())

    # paired-design quantities
    def paired_moments(self):
        P1 = self.pi_d
        P0 = 1 - P1
        D0 = self.eta / P0
        D1 = (P1 - self.phi) / P1
        sc2 = self.sigma_c2()
        return dict(P0=P0, P1=P1, Delta0=D0, Delta1=D1, vT0=sc2 + D0 * (1 - D0), vC0=sc2,
                    vT1=sc2 + D1 * (1 - D1), vC1=sc2)


def split_var(des: ListDesign, r, n):
    """Exact Var(SDB_S) (eq:le-split) at arm shares r = (r_D, r_C, r_T)."""
    r = np.asarray(r, float)
    return (des.v_d() / r[0] + des.sigma_c2() / r[1] + des.sigma_t2() / r[2]) / n


def neyman_split(vD, vC, vT, cD=1.0, cL=1.0):
    """thm:design(a): shares n_a / n proportional to sqrt(v_a / c_a)."""
    s = np.array([np.sqrt(vD / cD), np.sqrt(vC / cL), np.sqrt(vT / cL)])
    return s / s.sum()


def paired_alloc(des: ListDesign, cD=1.0, cL=1.0):
    """thm:design(b) shares (r_D, r_C, r_T) of the total sample for the paired design under monotonicity."""
    pm = des.paired_moments()
    nu0 = pm["Delta0"] ** 2 * pm["P0"] * pm["P1"]
    bT, bC = pm["P0"] * pm["vT0"], pm["P0"] * pm["vC0"]
    bbar = np.sqrt(bT) + np.sqrt(bC)
    dlt = cL - cD
    if nu0 * dlt > cD * bbar ** 2:
        K = np.sqrt(nu0 * cD) + bbar * np.sqrt(dlt)
        n = np.sqrt(nu0 / cD) / K
        nT, nC = np.sqrt(bT / dlt) / K, np.sqrt(bC / dlt) / K
        return np.array([n - nT - nC, nC, nT]) / n
    rT = np.sqrt(bT) / bbar
    return np.array([0.0, 1 - rT, rT])


def paired_avar(des: ListDesign, r):
    """n AVar of SDB_PS (eq:le-vps) and of eta-hat (eq:le-veta) at shares r = (r_D, r_C, r_T)."""
    pm = des.paired_moments()
    rD, rC, rT = r
    v_ps = (1 + pm["Delta0"] - pm["Delta1"]) ** 2 * pm["P0"] * pm["P1"] + \
        pm["P0"] * (pm["vT0"] / rT + pm["vC0"] / rC) + pm["P1"] * (pm["vT1"] / rT + pm["vC1"] / rC)
    v_eta = pm["Delta0"] ** 2 * pm["P0"] * pm["P1"] + pm["P0"] * (pm["vT0"] / rT + pm["vC0"] / rC)
    return v_ps, v_eta


# ---------------------------------------------------------------------------
# simulation
# ---------------------------------------------------------------------------
def arm_sizes(n, r):
    r = np.asarray(r, float)
    sizes = np.floor(n * r).astype(int)
    sizes[np.argmax(n * r - sizes)] += n - sizes.sum()
    return sizes


def controls(des: ListDesign, n, rng):
    """(n, J) binary control answers: pairs with binary correlation rho, p = 1/2."""
    W = np.zeros((n, des.J), dtype=np.int8)
    p11 = (1 + des.rho) / 4
    for i in range(des.m):
        u = rng.random(n)
        # cells: (1,1) w.p. p11, (0,0) w.p. p11, (1,0) and (0,1) w.p. (1 - 2 p11) / 2 each
        c11 = u < p11
        c00 = (u >= p11) & (u < 2 * p11)
        c10 = (u >= 2 * p11) & (u < 2 * p11 + (1 - 2 * p11) / 2)
        W[:, 2 * i] = c11 | c10
        W[:, 2 * i + 1] = c11 | (~c00 & ~c10 & ~c11)
    if des.odd:
        W[:, -1] = rng.random(n) < 0.5
    return W


def simulate(des: ListDesign, n, r, rng, paired=False):
    """One survey for one sensitive item. arm: 0 = D, 1 = C, 2 = T.  y = list count (nan in D);
    d = direct answer (nan where not asked: in arms C, T of the split design)."""
    rng = np.random.default_rng(rng)
    arm = rng.permutation(np.repeat(np.arange(3), arm_sizes(n, r)))
    theta = rng.standard_normal(n)
    ystar = des.a * theta + rng.standard_normal(n)
    Z = (ystar >= des.b_star).astype(int)
    D = (ystar >= des.b_star + des.delta).astype(int)
    if des.phi_rate > 0:
        D = np.where((Z == 0) & (rng.random(n) < des.phi_rate), 1, D)
    Wsum = controls(des, n, rng).sum(axis=1)
    yT = Wsum + Z
    if des.kc > 0:
        yT = np.where((Z == 1) & (Wsum == des.J) & (rng.random(n) < des.kc), des.J, yT)
    if des.kf > 0:
        yT = np.where((Z == 1) & (Wsum == 0) & (rng.random(n) < des.kf), 0, yT)
    y = np.where(arm == 1, Wsum, np.where(arm == 2, yT, np.nan)).astype(float)
    d = D.astype(float) if paired else np.where(arm == 0, D, np.nan).astype(float)
    return dict(arm=arm, y=y, d=d, theta=theta, Z=Z, D=D, W=Wsum)


# ---------------------------------------------------------------------------
# estimators
# ---------------------------------------------------------------------------
@dataclass
class Est:
    est: float
    se: float
    lo: float = field(init=False)
    hi: float = field(init=False)

    def __post_init__(self):
        self.lo = self.est - Z975 * self.se
        self.hi = self.est + Z975 * self.se


def split_sdb(arm, y, d):
    """SDB_S = Ybar_T - Ybar_C - Dbar_D with plug-in variance (eq:le-split); also returns pi-hat."""
    yT, yC, dD = y[arm == 2], y[arm == 1], d[arm == 0]
    pl = yT.mean() - yC.mean()
    pd = dD.mean()
    v = yT.var(ddof=1) / len(yT) + yC.var(ddof=1) / len(yC) + pd * (1 - pd) / len(dD)
    return Est(pl - pd, float(np.sqrt(v))), float(pl), float(pd)


def _strata(arm, y, d):
    out = {}
    for a in (1, 2):
        for dd in (0, 1):
            v = y[(arm == a) & (d == dd)]
            out[(a, dd)] = v
    return out


def paired_ps(arm, y, d):
    """Post-stratified SDB_PS (thm:joint-sdb(b)) with plug-in eq:le-vps SE."""
    n = len(arm)
    P1 = float(np.mean(d))
    P0 = 1 - P1
    s = _strata(arm, y, d)
    if any(len(v) < 2 for v in s.values()):
        return Est(np.nan, np.nan)
    D0 = s[(2, 0)].mean() - s[(1, 0)].mean()
    D1 = s[(2, 1)].mean() - s[(1, 1)].mean()
    rT, rC = np.mean(arm == 2), np.mean(arm == 1)
    v = (1 + D0 - D1) ** 2 * P0 * P1 + P0 * (s[(2, 0)].var(ddof=1) / rT + s[(1, 0)].var(ddof=1) / rC) + \
        P1 * (s[(2, 1)].var(ddof=1) / rT + s[(1, 1)].var(ddof=1) / rC)
    return Est(P0 * D0 + P1 * D1 - P1, float(np.sqrt(v / n)))


def paired_combined(arm, y, d):
    """Combined estimator eta-hat = P_0 (Ybar_T0 - Ybar_C0) (eq:le-comb) with plug-in eq:le-veta SE."""
    n = len(arm)
    P1 = float(np.mean(d))
    P0 = 1 - P1
    s = _strata(arm, y, d)
    if len(s[(2, 0)]) < 2 or len(s[(1, 0)]) < 2:
        return Est(0.0, np.nan)
    D0 = s[(2, 0)].mean() - s[(1, 0)].mean()
    rT, rC = np.mean(arm == 2), np.mean(arm == 1)
    v = D0 ** 2 * P0 * P1 + P0 * (s[(2, 0)].var(ddof=1) / rT + s[(1, 0)].var(ddof=1) / rC)
    return Est(P0 * D0, float(np.sqrt(v / n)))


def _adj_mean(y, x, xbar_all):
    X = np.column_stack([np.ones(len(y)), x - xbar_all])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ beta
    XtX_inv = np.linalg.inv(X.T @ X)
    h = np.einsum("ij,jk,ik->i", X, XtX_inv, X)
    meat = (X * (res ** 2 / np.maximum(1 - h, 1e-8))[:, None]).T @ X
    V = XtX_inv @ meat @ XtX_inv
    return beta[0], V[0, 0]


def adjusted_split_sdb(arm, y, d, x):
    """Split-design SDB with every arm mean adjusted to the full-sample mean of the covariate x."""
    xbar = x.mean()
    mD, vD = _adj_mean(d[arm == 0], x[arm == 0], xbar)
    mC, vC = _adj_mean(y[arm == 1], x[arm == 1], xbar)
    mT, vT = _adj_mean(y[arm == 2], x[arm == 2], xbar)
    return Est(mT - mC - mD, float(np.sqrt(vD + vC + vT)))
