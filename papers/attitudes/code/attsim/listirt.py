"""Identification of the threshold shift delta_j by a list experiment (prop:list-irt(b),(c); X8).

Data-generating model (def:le-shift, normal ogive), two groups x in {0, 1} (a covariate or a
grouping of tab:design-groups) with theta | x ~ N(mu_x, I):
  * every item has the latent response Y*_ij = a_j' theta_i + e_ij of the bifactor GRM;
  * the sensitive item j answered directly has thresholds b_jc + delta_x (direct response);
    the private response is Z_ij = 1{Y*_ij > b_jc*} (agreement = category >= c*);
  * non-uniform alternative (prop:list-irt-ext): Z_ij = 1{upsilon eta_ij + e_ij > b'}, with b'
    chosen so that group 0 has the same private prevalence as under the uniform shift;
  * respondents are randomised to arms D (direct), C (list control), T (list treatment) with
    equal probability; list arms report W_i (+ Z_ij in arm T), W_i from J = 4 control items in
    two negatively correlated pairs (rho = -0.6), independent of everything else; item j is
    missing by design in the list arms.

Estimation:
  1. the two-group bifactor model is fitted by DWLS to the direct responses of the D arm, with
     item j free across groups (group-specific a_j^(x), b_j^(x)) and the other items invariant;
  2. pi_x = mean(Y | T, x) - mean(Y | C, x);
  3. delta_x solves E_x F(eta_j - b^D_jc* + delta) = pi_x (eq:le-irt-root):
         delta_x = b^D_jc*(x) - a_j(x)' mu_x + s_x Phi^{-1}(pi_x),  s_x = (1 + a_j(x)' Sigma_x a_j(x))^{1/2};
  4. delta-method SEs: the measurement-model part from the sandwich covariance of step 1
     (numerical gradient) and the list part from the arm variances (independent samples);
  5. the test of a common shift (prop:list-irt(c) with groups, prop:list-irt-ext with
     covariates): z = (delta_1 - delta_0) / se, with the shared measurement parameters in
     the covariance; and the inverse-variance pooled delta.
"""
from __future__ import annotations

import numpy as np
from scipy.special import ndtr, ndtri

from . import dif as Dm
from . import fit as F
from . import generate as gen
from .listexp import ListDesign, controls

Z975 = 1.959963984540054


def simulate(bank, j, cstar, mus, n_per_group, delta_sd, rng, upsilon=1.0, J_list=4, rho_list=-0.6):
    """delta_sd: (delta_0, delta_1) in SDs of item j's reference latent response.  Returns a dict of
    arrays: Y (n, J) direct responses (item j only meaningful in arm D), group, arm (0 = D, 1 = C,
    2 = T), y (list response), Z (private agreement), and the truths."""
    rng = np.random.default_rng(rng)
    A = bank.A()
    sdj = float(np.sqrt(1 + A[j] @ A[j]))
    out = dict(Y=[], group=[], arm=[], y=[], Z=[])
    # threshold of the private agreement under the non-uniform alternative: same group-0 prevalence
    pi0_uniform = float(ndtr((0.0 - bank.b[j, cstar - 1]) / sdj))          # mu_0 = 0
    s_up = np.sqrt(1 + upsilon ** 2 * (A[j] @ A[j]))
    b_up = -s_up * ndtri(pi0_uniform)
    des = ListDesign(J=J_list, rho=rho_list)
    for x, (mu, n) in enumerate(zip(mus, n_per_group)):
        th = np.asarray(mu, float)[None, :] + rng.standard_normal((n, 3))
        eta = th @ A.T
        e = rng.standard_normal(eta.shape)
        ystar = eta + e
        bD = bank.b.copy()
        bD[j] = bD[j] + delta_sd[x] * sdj
        Y = (ystar[:, :, None] > bD[None, :, :]).sum(axis=2).astype(np.int8)
        if upsilon == 1.0:
            Z = (ystar[:, j] > bank.b[j, cstar - 1]).astype(np.int8)
        else:
            Z = (upsilon * eta[:, j] + e[:, j] > b_up).astype(np.int8)
        arm = rng.integers(0, 3, n)
        W = controls(des, n, rng).sum(axis=1)
        y = W + (arm == 2) * Z
        out["Y"].append(Y)
        out["group"].append(np.full(n, x, np.int8))
        out["arm"].append(arm.astype(np.int8))
        out["y"].append(y.astype(np.int16))
        out["Z"].append(Z)
    out = {k: np.concatenate(v) for k, v in out.items()}
    out["sdj"] = sdj
    out["b_up"] = b_up
    return out


def truth(bank, j, cstar, mus, delta_sd):
    """Population private and direct prevalences, SDB_x and delta_x (slope scale) under the uniform shift."""
    A = bank.A()
    sdj = float(np.sqrt(1 + A[j] @ A[j]))
    out = {}
    for x, mu in enumerate(mus):
        m = float(A[j] @ np.asarray(mu, float))
        pi = float(ndtr((m - bank.b[j, cstar - 1]) / sdj))
        piD = float(ndtr((m - bank.b[j, cstar - 1] - delta_sd[x] * sdj) / sdj))
        out[x] = dict(pi=pi, piD=piD, sdb=pi - piD, delta=delta_sd[x] * sdj, delta_sd=delta_sd[x])
    out["sdj"] = sdj
    out["b_private"] = float(bank.b[j, cstar - 1])
    return out


def delta_from(theta, model, j, cstar, x, pi):
    p = model.expand(theta, x)
    a = np.array([p["aG"][j], 0.0, 0.0])
    a[model.spec[j]] = p["aS"][j]
    s2 = np.exp(p["lv"])
    s = np.sqrt(1 + np.sum(a ** 2 * s2))
    return float(p["b"][j, cstar - 1] - a @ p["mu"] + s * ndtri(pi)), s


def estimate(dat, spec, j, cstar, K=5):
    """Steps 1-5 of the module docstring.  Returns a dict."""
    arm, grp, y = dat["arm"], dat["group"], dat["y"]
    Jn = dat["Y"].shape[1]
    stats = [F.group_stats(dat["Y"][(arm == 0) & (grp == x)], K) for x in (0, 1)]
    free = np.zeros(Jn, bool)
    free[j] = True
    f = Dm.fit_mg(stats, spec, K - 1, free)
    V = f.cov()
    out = dict(converged=f.converged)
    pis, vpis, deltas, grads, svals = [], [], [], [], []
    for x in (0, 1):
        yt, yc = y[(arm == 2) & (grp == x)], y[(arm == 1) & (grp == x)]
        pi = float(yt.mean() - yc.mean())
        vpi = float(yt.var(ddof=1) / len(yt) + yc.var(ddof=1) / len(yc))
        piv = float(np.clip(pi, 1e-4, 1 - 1e-4))
        d, s = delta_from(f.theta, f.model, j, cstar, x, piv)
        g = np.zeros(len(f.theta))
        h = 1e-6
        for i in range(len(f.theta)):
            tp, tm = f.theta.copy(), f.theta.copy()
            tp[i] += h
            tm[i] -= h
            g[i] = (delta_from(tp, f.model, j, cstar, x, piv)[0] - delta_from(tm, f.model, j, cstar, x, piv)[0]) / (2 * h)
        dpi = s * np.sqrt(2 * np.pi) * np.exp(0.5 * ndtri(piv) ** 2)      # d delta / d pi = s / phi(Phi^{-1}(pi))
        pis.append(pi)
        vpis.append(vpi)
        deltas.append(d)
        grads.append(g)
        svals.append(dpi)
        # model-based direct prevalence and SDB_x = pi_x - pi^D_x
        p = f.model.expand(f.theta, x)
        a = np.array([p["aG"][j], 0.0, 0.0])
        a[f.model.spec[j]] = p["aS"][j]
        ss = np.sqrt(1 + np.sum(a ** 2 * np.exp(p["lv"])))
        piD = float(ndtr((a @ p["mu"] - p["b"][j, cstar - 1]) / ss))
        out[f"pi_{x}"] = pi
        out[f"pi_se_{x}"] = np.sqrt(vpi)
        out[f"piD_model_{x}"] = piD
        out[f"sdb_{x}"] = pi - piD
        yD = dat["Y"][(arm == 0) & (grp == x), j]
        out[f"piD_direct_{x}"] = float(np.mean(yD >= cstar))
        out[f"b_private_{x}"] = float(p["b"][j, cstar - 1] - d)
    Vm = np.array([[gi @ V @ gk for gk in grads] for gi in grads])
    Vl = np.diag([svals[x] ** 2 * vpis[x] for x in (0, 1)])
    Vd = Vm + Vl
    for x in (0, 1):
        out[f"delta_{x}"] = deltas[x]
        out[f"delta_se_{x}"] = float(np.sqrt(Vd[x, x]))
        out[f"delta_se_meas_{x}"] = float(np.sqrt(Vm[x, x]))
    c = np.array([-1.0, 1.0])
    se_diff = float(np.sqrt(c @ Vd @ c))
    out["diff"] = deltas[1] - deltas[0]
    out["diff_se"] = se_diff
    out["z_common"] = out["diff"] / se_diff
    w = np.linalg.solve(Vd, np.ones(2))
    w = w / w.sum()
    out["delta_pooled"] = float(w @ np.array(deltas))
    out["delta_pooled_se"] = float(np.sqrt(w @ Vd @ w))
    return out
