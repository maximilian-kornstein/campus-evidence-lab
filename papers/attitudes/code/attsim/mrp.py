"""Small-area estimation of the mean of G: synthetic population, MRP and direct estimators.

Population: A areas; demographic cells age (4) x sex (2) x education (4) within each area,
so cells k = (area, age, sex, educ).  Cell counts N_k vary by area (area sizes are
log-normal; the demographic mix is a Dirichlet perturbation of a national mix).  The
latent general factor has cell mean
    mu_k = b0 + b_age[age] + b_sex[sex] + b_educ[educ] + gamma z_a + u_a,  u_a ~ N(0, s_u^2),
with z_a an area-level predictor, and theta_iG ~ N(mu_k, s_w^2) within cells.  The true
area mean is the poststratified mean of the cell means (eq:mrp), sum_k N_k mu_k / sum_k N_k.

Measurement: each sampled respondent contributes a score y_i = theta_iG + e_i with
e_i ~ N(0, s_m^2), i.e. a conditionally unbiased score of G with a stated reliability (the
measurement-model step is abstracted; see run_experiments.E4 for the reliability).

Sampling: n respondents, drawn with probability proportional to N_k times a response
propensity that depends on age and education (differential non-response), so unweighted
area means are biased as well as noisy.

The MRP fit to the unbiased score is the Gaussian latent regression of eq:sa-latreg with
the measurement error integrated out (y | k ~ N(mu_k, s_w^2 + s_m^2)), so it estimates mu_k
without attenuation; `eap_scores` implements the two-step shortcut of prop:eap.

Estimators: (i) direct: area sample mean; (ii) direct-weighted: area mean with national
cell weights N_k / n_k (age x sex x educ cells), i.e. a design-type estimator;
(iii) MRP: linear mixed model y = X beta + u_area + e, with X = demographic dummies and
z_a, variance components by REML, BLUPs, then poststratification over all cells of the
area.  Prediction-error variances from Henderson's mixed-model equations (variance
components treated as known).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize_scalar

N_AGE, N_SEX, N_EDU = 4, 2, 4
N_DEM = N_AGE * N_SEX * N_EDU


@dataclass
class Population:
    N: np.ndarray        # (A, N_DEM) cell counts
    mu: np.ndarray       # (A, N_DEM) cell means of G
    z: np.ndarray        # (A,) area-level predictor
    u: np.ndarray        # (A,) area effects
    area_mean: np.ndarray  # (A,)
    dem: np.ndarray      # (N_DEM, 3) age, sex, educ codes
    propensity: np.ndarray  # (N_DEM,) relative response propensity
    s_w: float


def dem_codes():
    a, s, e = np.meshgrid(np.arange(N_AGE), np.arange(N_SEX), np.arange(N_EDU), indexing="ij")
    return np.stack([a.ravel(), s.ravel(), e.ravel()], axis=1)


def make_population(rng, A=50, total=10_000_000, size_sd=1.0, s_u=0.2, gamma=0.25, s_w=0.85,
                    b_age=(0.25, 0.05, -0.1, -0.2), b_sex=(0.05, -0.05), b_edu=(0.2, 0.1, -0.1, -0.2),
                    mix_conc=30.0, resp_age=(0.6, 0.8, 1.1, 1.4), resp_edu=(0.6, 0.9, 1.1, 1.4)):
    rng = np.random.default_rng(rng)
    dem = dem_codes()
    size = np.exp(size_sd * rng.standard_normal(A))
    size = total * size / size.sum()
    nat = np.full(N_DEM, 1.0 / N_DEM)
    mix = rng.dirichlet(mix_conc * N_DEM * nat, size=A)       # (A, N_DEM)
    N = size[:, None] * mix
    z = rng.standard_normal(A)
    u = s_u * rng.standard_normal(A)
    lin = np.asarray(b_age)[dem[:, 0]] + np.asarray(b_sex)[dem[:, 1]] + np.asarray(b_edu)[dem[:, 2]]
    mu = lin[None, :] + gamma * z[:, None] + u[:, None]
    area_mean = (N * mu).sum(axis=1) / N.sum(axis=1)
    prop = np.asarray(resp_age)[dem[:, 0]] * np.asarray(resp_edu)[dem[:, 2]]
    return Population(N, mu, z, u, area_mean, dem, prop, s_w)


def draw_sample(pop: Population, n, rng, s_m):
    """Respondent arrays: area, dem cell, score y (and true theta)."""
    rng = np.random.default_rng(rng)
    A = pop.N.shape[0]
    w = pop.N * pop.propensity[None, :]
    p = (w / w.sum()).ravel()
    cell = rng.choice(p.size, size=n, p=p)
    area, dcell = cell // N_DEM, cell % N_DEM
    theta = pop.mu[area, dcell] + pop.s_w * rng.standard_normal(n)
    y = theta + s_m * rng.standard_normal(n)
    return area, dcell, y, theta


def design_matrix(dem_idx, z_area, dem):
    """Intercept, age (3), sex (1), educ (3) treatment dummies and the area predictor."""
    d = dem[dem_idx]
    cols = [np.ones(len(dem_idx))]
    cols += [(d[:, 0] == a).astype(float) for a in range(1, N_AGE)]
    cols += [(d[:, 1] == 1).astype(float)]
    cols += [(d[:, 2] == e).astype(float) for e in range(1, N_EDU)]
    cols += [np.asarray(z_area, float)]
    return np.stack(cols, axis=1)


def _reml_parts(lam, X, y, area, A):
    """GLS pieces for V = s2 (I + lam Z Z'), using per-area Sherman-Morrison."""
    n, p = X.shape
    na = np.bincount(area, minlength=A).astype(float)
    Xs = np.zeros((A, p))
    np.add.at(Xs, area, X)
    ys = np.bincount(area, weights=y, minlength=A)
    c = lam / (1.0 + lam * na)                   # V_a^{-1} = (I - c 11') / s2
    XtVX = X.T @ X - (Xs * c[:, None]).T @ Xs
    XtVy = X.T @ y - (Xs * c[:, None]).T @ ys
    beta = np.linalg.solve(XtVX, XtVy)
    r = y - X @ beta
    rs = np.bincount(area, weights=r, minlength=A)
    rVr = r @ r - np.sum(c * rs * rs)
    logdetV1 = np.sum(np.log1p(lam * na))        # log|I + lam ZZ'|
    return beta, rVr, logdetV1, XtVX, na


def fit_mixed(X, y, area, A):
    """REML for y = X b + u_area + e. Returns beta, s2, s_u2, lam and BLUPs u (A,)."""
    n, p = X.shape

    def nll(loglam):
        lam = np.exp(loglam)
        beta, rVr, ld, XtVX, _ = _reml_parts(lam, X, y, area, A)
        s2 = rVr / (n - p)
        return 0.5 * (ld + np.linalg.slogdet(XtVX)[1] + (n - p) * np.log(s2))

    res = minimize_scalar(nll, bounds=(-12, 4), method="bounded", options=dict(xatol=1e-6))
    lam = float(np.exp(res.x))
    beta, rVr, _, XtVX, na = _reml_parts(lam, X, y, area, A)
    s2 = rVr / (n - p)
    r = y - X @ beta
    rs = np.bincount(area, weights=r, minlength=A)
    u = lam * rs / (1.0 + lam * na)
    return dict(beta=beta, s2=float(s2), su2=float(lam * s2), lam=lam, u=u, na=na)


def mrp_estimate(pop: Population, area, dcell, y):
    """MRP area means with Henderson prediction-error variances."""
    A = pop.N.shape[0]
    X = design_matrix(dcell, pop.z[area], pop.dem)
    m = fit_mixed(X, y, area, A)
    beta, u, lam, s2 = m["beta"], m["u"], m["lam"], m["s2"]
    # population design-matrix means per area (poststratification weights N_k / N_a)
    Xcell = design_matrix(np.arange(N_DEM), np.zeros(N_DEM), pop.dem)   # z column filled below
    Wt = pop.N / pop.N.sum(axis=1, keepdims=True)                        # (A, N_DEM)
    xbar = Wt @ Xcell
    xbar[:, -1] = pop.z
    est = xbar @ beta + u
    # Henderson MME: C = [[X'X, X'Z], [Z'X, Z'Z + I/lam]]; PEV of L [beta; u] = s2 L C^{-1} L'
    p = X.shape[1]
    Z = np.zeros((len(y), A))
    Z[np.arange(len(y)), area] = 1.0
    C = np.block([[X.T @ X, X.T @ Z], [Z.T @ X, Z.T @ Z + np.eye(A) / lam]])
    Ci = np.linalg.inv(C)
    L = np.concatenate([xbar, np.eye(A)], axis=1)
    pev = s2 * np.einsum("ai,ij,aj->a", L, Ci, L)
    return est, np.sqrt(pev), m


def direct_estimates(pop: Population, area, dcell, y):
    """Unweighted and nationally cell-weighted area means (nan where an area has no respondents)."""
    A = pop.N.shape[0]
    na = np.bincount(area, minlength=A).astype(float)
    with np.errstate(invalid="ignore", divide="ignore"):
        unw = np.bincount(area, weights=y, minlength=A) / na
        Nnat = pop.N.sum(axis=0)
        nnat = np.bincount(dcell, minlength=N_DEM).astype(float)
        wcell = np.where(nnat > 0, Nnat / np.maximum(nnat, 1), 0.0)
        wi = wcell[dcell]
        wtd = np.bincount(area, weights=wi * y, minlength=A) / np.bincount(area, weights=wi, minlength=A)
        # SE of the unweighted mean
        ss = np.bincount(area, weights=y * y, minlength=A)
        var = (ss - na * unw ** 2) / np.maximum(na - 1, 1)
        se_unw = np.sqrt(var / na)
    return unw, wtd, se_unw, na


def eap_scores(y, s_m):
    """Two-step shortcut of prop:eap: posterior means under one common normal prior N(m0, s0^2),
    with m0 and s0^2 = Var(y) - s_m^2 estimated from the sample.  Returns (scores, rho) where
    rho = s0^2 / (s0^2 + s_m^2) is the shrinkage factor of eq:sa-eap."""
    m0 = float(np.mean(y))
    s02 = max(float(np.var(y, ddof=1)) - s_m ** 2, 1e-6)
    rho = s02 / (s02 + s_m ** 2)
    return m0 + rho * (y - m0), rho
