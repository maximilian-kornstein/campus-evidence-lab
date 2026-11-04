#!/usr/bin/env python
"""Simulation study for "Where Does Criticism End?" (sec:simulation, app:simdetails).

All data are synthetic, generated from models with known parameters.

  X1  recovery of loadings, item-level ECV, the boundary set B_tau (tau = 0.5) and the
      correlated-factors S-I correlation, vs sample size n and the number of I items
      (n_I = 2: not identified; n_I = 3 with a proportional S block: not identified;
      n_I = 3, 6: identified)
  X2  two-group DIF on Israel-related items: bias of the focal-minus-reference latent
      means and of ECV when DIF is ignored, with partial invariance and correct anchors,
      and with contaminated anchors; DIF detection rates; leave-one-anchor-out spread
  X3  list experiment (sec:sensitive): SDB estimation (bias, coverage, RMSE) in the split design
      under equal, Neyman-optimal and pilot-based allocations; paired design with the
      post-stratified and combined estimators, with and without monotonicity; choice of the
      control list (J, within-pair correlation) with and without floor/ceiling effects
  X4  MRP small-area estimates of the mean of G vs direct estimates and vs the two-step
      EAP shortcut (prop:eap)
  X5  stereotype-count index vs latent mean difference (prop:index): sign reversals under
      random uniform DIF, unequal latent variances, random non-uniform DIF; Example checks
  X2b as X2 with ideology-type DIF on two of the four stereotype anchors: default vs
      stereotype-only anchoring, leave-one-anchor-out, and the bound eq:id-anchor-bound
  X6  directional misspecifications at the registered sizes (10 S, 8 ID, 6 IT items, n = 6000):
      cross-loading of the trope-based items on S; acquiescence with registered or balanced
      keying; remedies (IT x S residual check, cross-loading model, method factor, I = ID only)
  X7  the revised DIF screen (Benjamini-Hochberg only) end to end on the X2 data sets
  X8  identification of the threshold shift delta_j by a list experiment (prop:list-irt(b),(c))
  X9  tests of within-domain heterogeneity for rule D2(ii): joint tetrad test, intersection-
      union test, and the earlier Bonferroni rule, at the registered sizes

X1-X5 were called E1-E5 in the first run; they were renamed to avoid a clash with the estimands
(E1)-(E9) of the analysis plan.  Their seed indices (1-5) are unchanged, so they reproduce exactly.

Usage (from code/):
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py            # full study, 2 workers
  python run_experiments.py --quick                                       # smoke run
  python run_experiments.py --only X3 X4                                  # subset (merged into JSON)
Outputs: ../results/sim_results.json (summaries, configs, seeds, R, runtimes, versions)
         ../results/raw/X*.json (per-replication results)
"""
from __future__ import annotations

import os

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import argparse
import hashlib
import json
import platform
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import scipy
import matplotlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from attsim import generate as gen                      # noqa: E402
from attsim import fit as F                             # noqa: E402
from attsim import dif as D                             # noqa: E402
from attsim import listexp as L                         # noqa: E402
from attsim import mrp as M                             # noqa: E402
from attsim import index as IX                          # noqa: E402
from attsim import designs as DS                        # noqa: E402
from attsim import genfit as GF                         # noqa: E402
from attsim import tetrad as TT                         # noqa: E402
from attsim import listirt as LI                        # noqa: E402
from attsim.boundary import estimate_boundary, classify  # noqa: E402

BASE_SEED = 20261103
TAU = 0.5
# Seed index of each experiment.  X1-X5 were called E1-E5 in the first run (renamed to avoid a clash with
# the estimands (E1)-(E9) of sec:design-estimands); the indices, and so every random stream, are unchanged.
# X7 re-analyses the X2 data sets and therefore uses X2's streams; X2b uses its own index 22.
EXP_INDEX = dict(X1=1, X2=2, X3=3, X4=4, X5=5, X6=6, X8=8, X9=9, X2b=22)
RENAME = {"E1": "X1", "E1b": "X1b", "E2": "X2", "E3": "X3", "E4": "X4", "E5": "X5"}
RESULTS = os.path.join(HERE, "..", "results")


def seed(exp, *keys):
    return np.random.SeedSequence([BASE_SEED, EXP_INDEX[exp], *[int(k) for k in keys]])


def _py(x):
    """JSON-safe conversion."""
    if isinstance(x, dict):
        return {str(k): _py(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_py(v) for v in x]
    if isinstance(x, np.ndarray):
        return _py(x.tolist())
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        x = float(x)
        return None if not np.isfinite(x) else x
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def mc(v):
    """Mean, median, SD, Monte Carlo SE of the mean, and a robust MCSE of the median
    (1.2533 x IQR/1.349 / sqrt(R), the normal-theory formula with a robust scale), nan-aware."""
    v = np.asarray(v, float)
    v = v[np.isfinite(v)]
    if len(v) == 0:
        return dict(mean=None, median=None, sd=None, mcse=None, mcse_median=None, n=0)
    sd = float(np.std(v, ddof=1)) if len(v) > 1 else float("nan")
    iqr = float(np.subtract(*np.percentile(v, [75, 25])))
    return dict(mean=float(np.mean(v)), median=float(np.median(v)), sd=sd, mcse=sd / np.sqrt(len(v)),
                mcse_median=1.2533 * iqr / 1.349 / np.sqrt(len(v)), n=len(v))


def prop(v):
    v = np.asarray(v, float)
    v = v[np.isfinite(v)]
    p = float(np.mean(v)) if len(v) else float("nan")
    return dict(p=p, mcse=float(np.sqrt(p * (1 - p) / len(v))) if len(v) else None, n=len(v))


def rmse(err):
    e = np.asarray(err, float)
    e = e[np.isfinite(e)]
    r = float(np.sqrt(np.mean(e ** 2)))
    # delta-method MCSE of RMSE: sd(e^2) / (2 RMSE sqrt(R))
    return dict(rmse=r, mcse=float(np.std(e ** 2, ddof=1) / (2 * r * np.sqrt(len(e)))) if len(e) > 1 and r > 0 else None)


# =============================================================================
# X1: recovery and boundary sets
# =============================================================================
X1_CONFIGS = {   # name: (n_I, proportional S block?)
    "I6": (6, False), "I3": (3, False), "I2": (2, False), "I3p": (3, True),
}
X1B_CONFIGS = {"I3np": (3, "near")}   # X1b: nearly proportional S block, n_I = 3 (rem:id-heterogeneity)
ECV_S_NEAR = np.array([0.74, 0.66, 0.72, 0.68, 0.75, 0.65, 0.73, 0.67])
ALL_CONFIGS = {**X1_CONFIGS, **X1B_CONFIGS}


def x1_bank_cfg(cfg):
    n_I, prop_S = ALL_CONFIGS[cfg]
    if prop_S == "near":
        lgS, lsS = gen.loadings_from_ecv(ECV_S_NEAR, DS.H2_S_PROP)
        lgI, lsI = gen.loadings_from_ecv(DS.ECV_I[:n_I], DS.H2_I)
        spec = np.r_[np.ones(8, int), 2 * np.ones(n_I, int)]
        J = len(spec)
        names = [f"S{j + 1}" for j in range(8)] + [f"I{j + 1}" for j in range(n_I)]
        return gen.bank_from_standardised(np.r_[lgS, lgI], np.r_[lsS, lsI], spec,
                                          gen.base_thresholds(J, np.linspace(-0.3, 0.3, J)), names)
    return DS.x1_bank(n_I, prop_S)
X1_N = (500, 1000, 3000)


def x1_truth(cfg):
    n_I, prop_S = ALL_CONFIGS[cfg]
    bank = x1_bank_cfg(cfg)
    lamG, lamS = gen.std_loadings(bank)
    ecv = bank.ecv()
    # population fits: ident diagnostic and pseudo-true correlated-factors phi (population DWLS weights)
    tau, rho = gen.true_polychoric(bank)
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [100_000], seed("X1", 99, len(cfg), n_I))
    big = F.group_stats(Y, 5, corr_only=True)
    w = 1.0 / np.diag(big.Gamma)
    st = F.GroupStats(tau, rho, big.Gamma, 10 ** 9, True)
    m = F.BifactorMG(bank.spec, 4, fit_thresholds=False)
    fpop = m.fit([st], x0=np.c_[bank.aG, bank.aS].ravel(), weights=w)
    cf = F.fit_corrfactors(rho, m.pairs, bank.spec, w)
    out = dict(lamG=lamG, lamS=lamS, ecv=ecv, spec=bank.spec, names=bank.names,
               in_set=(ecv >= TAU), phi_pseudo=cf.phi, ident_pop=fpop.ident_diag(),
               pop_fit_cost=float(fpop.opt.cost),
               asy_se_ecv_n1000=fpop.ecv_se(V=fpop.cov() * big.n / 1000) if fpop.ident_diag() > 1e-6 else None)
    if n_I == 2:
        iI = np.flatnonzero(bank.spec == 2)
        sets = F.ecv_identified_set_two_items(lamG[iI[0]], lamG[iI[1]], lamS[iI[0]] * lamS[iI[1]])
        out["identified_sets"] = {bank.names[i]: s for i, s in zip(iI, sets)}
    return out


def x1_task(args):
    cfg, n, rep, B = args
    bank = x1_bank_cfg(cfg)
    ss = seed("X1", list(ALL_CONFIGS).index(cfg), n, rep)
    s_data, s_boot = ss.spawn(2)
    t0 = time.perf_counter()
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [n], np.random.default_rng(s_data))
    r = estimate_boundary(Y, bank.spec, 5, tau=TAU, B=B, rng=np.random.default_rng(s_boot))
    r["time"] = time.perf_counter() - t0
    r.update(cfg=cfg, n=n, rep=rep)
    return _py(r)


def x1_summary(raw, truth):
    out = {}
    for cfg in truth:
        tr = truth[cfg]
        spec = np.asarray(tr["spec"])
        iI = np.flatnonzero(spec == 2)
        iS = np.flatnonzero(spec == 1)
        ecv_t = np.asarray(tr["ecv"])
        in_t = ecv_t >= TAU
        for n in X1_N:
            rr = [r for r in raw if r["cfg"] == cfg and r["n"] == n]
            if not rr:
                continue
            E = np.array([r["ecv"] for r in rr])
            LG = np.array([r["lamG"] for r in rr])
            LS = np.array([r["lamS"] for r in rr])
            blo, bhi = np.array([r["boot_lo"] for r in rr]), np.array([r["boot_hi"] for r in rr])
            wlo, whi = np.array([r["wald_lo"] for r in rr]), np.array([r["wald_hi"] for r in rr])
            cls = classify(blo, bhi, TAU)                      # (R, J)
            cls_w = classify(wlo, whi, TAU)
            truth_cls = np.where(in_t, 1, -1)[None, :]
            cell = dict(R=len(rr), n=n, cfg=cfg, B=rr[0].get("B"),
                        time_mean=float(np.mean([r["time"] for r in rr])),
                        converged=prop([r["converged"] for r in rr]),
                        heywood=prop([r["heywood"] for r in rr]),
                        ident=mc([r["ident"] for r in rr]))
            items = {}
            for j in range(len(spec)):
                e = E[:, j] - ecv_t[j]
                it = dict(true=ecv_t[j], bias=mc(e), rmse=rmse(e),
                          lamG_bias=mc(LG[:, j] - tr["lamG"][j]), lamS_bias=mc(LS[:, j] - tr["lamS"][j]),
                          lamG_rmse=rmse(LG[:, j] - tr["lamG"][j]), lamS_rmse=rmse(LS[:, j] - tr["lamS"][j]),
                          cover_boot=prop((blo[:, j] <= ecv_t[j]) & (ecv_t[j] <= bhi[:, j])),
                          cover_wald=prop((wlo[:, j] <= ecv_t[j]) & (ecv_t[j] <= whi[:, j])),
                          width_boot=mc(bhi[:, j] - blo[:, j]), width_wald=mc(whi[:, j] - wlo[:, j]))
                if spec[j] == 2:
                    c = cls[:, j]
                    it.update(in_true=bool(in_t[j]), p_in=prop(c == 1), p_out=prop(c == -1), p_indet=prop(c == 0),
                              p_correct=prop(c == truth_cls[0, j]), p_wrong=prop(c == -truth_cls[0, j]),
                              p_point_correct=prop((E[:, j] >= TAU) == in_t[j]),
                              p_correct_wald=prop(cls_w[:, j] == truth_cls[0, j]),
                              p_wrong_wald=prop(cls_w[:, j] == -truth_cls[0, j]))
                    if "identified_sets" in tr:
                        lo, hi = tr["identified_sets"][tr["names"][j]]
                        it["in_identified_set"] = prop((E[:, j] >= lo - 1e-9) & (E[:, j] <= hi + 1e-9))
                        it["identified_set"] = [lo, hi]
                items[tr["names"][j]] = it
            cell["items"] = items
            eI = (E[:, iI] - ecv_t[iI]).ravel()
            eS = (E[:, iS] - ecv_t[iS]).ravel()
            cell["ecv_I"] = dict(bias=mc(eI), abs_err=mc(np.abs(eI)), rmse=rmse(eI),
                                 cover_boot=prop(((blo[:, iI] <= ecv_t[iI]) & (ecv_t[iI] <= bhi[:, iI])).ravel()),
                                 cover_wald=prop(((wlo[:, iI] <= ecv_t[iI]) & (ecv_t[iI] <= whi[:, iI])).ravel()))
            cell["ecv_S"] = dict(bias=mc(eS), abs_err=mc(np.abs(eS)), rmse=rmse(eS),
                                 cover_boot=prop(((blo[:, iS] <= ecv_t[iS]) & (ecv_t[iS] <= bhi[:, iS])).ravel()),
                                 cover_wald=prop(((wlo[:, iS] <= ecv_t[iS]) & (ecv_t[iS] <= whi[:, iS])).ravel()))
            cell["lam_rmse"] = dict(G_S=rmse((LG[:, iS] - np.asarray(tr["lamG"])[iS]).ravel()),
                                    G_I=rmse((LG[:, iI] - np.asarray(tr["lamG"])[iI]).ravel()),
                                    S=rmse((LS[:, iS] - np.asarray(tr["lamS"])[iS]).ravel()),
                                    I=rmse((LS[:, iI] - np.asarray(tr["lamS"])[iI]).ravel()))
            cI = cls[:, iI]
            tI = truth_cls[:, iI]
            cell["boundary"] = dict(p_correct=prop((cI == tI).ravel()), p_wrong=prop((cI == -tI).ravel()),
                                    p_indet=prop((cI == 0).ravel()),
                                    p_set_exact=prop(np.all(cI == tI, axis=1)),
                                    p_point_correct=prop(((E[:, iI] >= TAU) == in_t[iI][None, :]).ravel()),
                                    p_correct_wald=prop((cls_w[:, iI] == tI).ravel()),
                                    p_wrong_wald=prop((cls_w[:, iI] == -tI).ravel()))
            rngI = np.array([np.asarray(r["ecv_start_range"])[iI] for r in rr]).max(axis=1)
            # prop:id-boundary-test(b): Bonferroni-adjusted logit-Wald intervals over the |I| items;
            # simultaneous event B_in subset of B_tau subset of B_out
            from scipy.stats import norm
            zb = norm.ppf(1 - 0.05 / (2 * len(iI)))
            Ec = np.clip(E[:, iI], 1e-6, 1 - 1e-6)
            SE = np.array([np.asarray(r["ecv_se"])[iI] for r in rr]) / (Ec * (1 - Ec))
            Lb = 1 / (1 + np.exp(-(np.log(Ec / (1 - Ec)) - zb * SE)))
            Ub = 1 / (1 + np.exp(-(np.log(Ec / (1 - Ec)) + zb * SE)))
            tin = in_t[iI][None, :]
            set_ok = np.all((~(Lb >= TAU) | tin) & (~tin | (Ub >= TAU)), axis=1)
            cbon = classify(Lb, Ub, TAU)
            cell["boundary_bonferroni"] = dict(p_simultaneous=prop(set_ok), p_correct=prop((cbon == tI).ravel()),
                                               p_wrong=prop((cbon == -tI).ravel()), p_indet=prop((cbon == 0).ravel()),
                                               z=float(zb))
            cell["ecv_I_sd_mean"] = float(np.mean(np.std(E[:, iI], axis=0, ddof=1)))
            cell["nonident_diag"] = dict(start_range_I_max=mc(rngI), p_start_range_gt_0p01=prop(rngI > 0.01),
                                         p_ident_lt_0p01=prop(np.array([r["ident"] for r in rr]) < 0.01),
                                         n_near_opt=mc([r["n_near_opt"] for r in rr]),
                                         boot_width_I=mc((bhi[:, iI] - blo[:, iI]).ravel()))
            phi = np.array([r["phi"] for r in rr])
            phise = np.array([r["phi_se"] for r in rr])
            ep = phi - tr["phi_pseudo"]
            cell["phi"] = dict(pseudo_true=tr["phi_pseudo"], bias=mc(ep), rmse=rmse(ep),
                               cover=prop(np.abs(ep) <= 1.959964 * phise))
            out[f"{cfg}_n{n}"] = cell
    return out


# =============================================================================
# X2: DIF, anchors and partial invariance
# =============================================================================
X2_KAPPA = (0.0, 0.2, 0.4, 0.6)
X2_MAIN_KAPPA = 0.4
X2_N_PER_GROUP = 1500
X2_STRATS = ("naive", "oracle", "correct_fb", "correct_proc", "contam1_fb", "contam1_proc", "contam2_fb",
             "contam2_proc", "sonly_fb")
X2_S_ANCHORS = (0, 1, 2, 3)          # S1-S4: anchoring in the stereotype domain only (rem:id-anchor-S)


def _x2_fit_summary(f, V=None):
    V = f.cov() if V is None else V
    out = {}
    for fac, nm in enumerate(("G", "S", "I")):
        if ("mu", fac, 1) in f.model.names:
            est, se = D.latent_contrast(f, fac, V=V)
        else:                                   # fixed (not identified) in the S-anchored model
            est, se = float("nan"), float("nan")
        out["mu_" + nm] = est
        out["se_" + nm] = se
    p1 = f.params(1)
    out["var1"] = np.exp(p1["lv"])
    out["ecv0"] = f.ecv(0)
    out["ecv1"] = f.ecv(1)
    out["ecv1_std"] = f.ecv_std(1)
    out["converged"] = f.converged
    return out


def x2_task(args):
    kappa, rep, loo = args
    b0, b1 = DS.x2_banks(kappa)
    J = b0.J
    rng = np.random.default_rng(seed("X2", int(round(kappa * 100)), rep))
    t0 = time.perf_counter()
    Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.X2_MU1], [np.eye(3), np.eye(3)],
                           [X2_N_PER_GROUP, X2_N_PER_GROUP], rng)
    st = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
    res = dict(kappa=kappa, rep=rep)
    f = D.fit_mg(st, b0.spec, 4, np.zeros(J, bool))
    res["naive"] = _x2_fit_summary(f)
    fr = np.zeros(J, bool)
    fr[list(DS.X2_TRUE_DIF)] = True
    res["oracle"] = _x2_fit_summary(D.fit_mg(st, b0.spec, 4, fr))
    fs = np.ones(J, bool)
    fs[list(X2_S_ANCHORS)] = False
    res["sonly_fb"] = _x2_fit_summary(D.fit_mg_s_anchored(st, b0.spec, 4, fs))
    for nm, anchors in DS.X2_ANCHORS.items():
        pr = D.dif_procedure(st, b0.spec, 4, anchors)
        res[nm + "_fb"] = _x2_fit_summary(pr["fb"], V=pr["fb_cov"])
        res[nm + "_proc"] = _x2_fit_summary(pr["final"])
        res[nm + "_tests"] = dict(tested=pr["tested"], p=pr["p"], sig=pr["sig"], es=pr["es"], flagged=pr["flagged"])
        if loo:
            free0 = np.zeros(J, bool)
            free0[pr["flagged"]] = True
            mus = []
            for a in anchors:
                fa = free0.copy()
                fa[a] = True
                mus.append(D.latent_contrast(D.fit_mg(st, b0.spec, 4, fa), 0)[0])
            res[nm + "_loo"] = dict(mu_G=mus, spread=float(np.max(mus) - np.min(mus)))
    res["time"] = time.perf_counter() - t0
    return _py(res)


def x2_population():
    """Probability limits (fits to exact population statistics, population DWLS weights)."""
    out = {}
    for kappa in X2_KAPPA:
        b0, b1 = DS.x2_banks(kappa)
        J = b0.J
        Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.X2_MU1], [np.eye(3), np.eye(3)], [60_000, 60_000],
                               np.random.default_rng(seed("X2", 999, int(round(kappa * 100)))))
        big = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
        pop = []
        for k, (bk, mu) in enumerate([(b0, np.zeros(3)), (b1, DS.X2_MU1)]):
            tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
            pop.append(F.GroupStats(tau, rho, big[k].Gamma, 10 ** 9, False))
        res = {}
        frees = dict(naive=[], oracle=list(DS.X2_TRUE_DIF))
        for nm, anchors in DS.X2_ANCHORS.items():
            frees[nm + "_fb"] = [j for j in range(J) if j not in anchors]
        frees["sonly_fb"] = [j for j in range(J) if j not in X2_S_ANCHORS]
        for nm, free in frees.items():
            fr = np.zeros(J, bool)
            fr[free] = True
            f = D.fit_mg_s_anchored(pop, b0.spec, 4, fr) if nm == "sonly_fb" else D.fit_mg(pop, b0.spec, 4, fr)
            p1 = f.params(1)
            res[nm] = dict(mu=p1["mu"], var1=np.exp(p1["lv"]), ecv0=f.ecv(0), ecv1=f.ecv_std(1), cost=f.opt.cost)
        res["truth"] = dict(mu=DS.X2_MU1, ecv0=b0.ecv(), ecv1=b1.ecv())
        out[str(kappa)] = res
    return _py(out)


def x2_checks():
    """Exact population-level checks (fits to exact population thresholds/polychorics, unit weights)."""
    def popstats(banks, mus):
        out = []
        for bk, mu in zip(banks, mus):
            tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
            out.append(F.GroupStats(tau, rho, np.eye(tau.size + rho.size), 10 ** 9, False))
        return out
    b0, b1 = DS.x2_banks(X2_MAIN_KAPPA)
    J, A = b0.J, b0.A()
    v = np.array([0.25, -0.10, 0.15])
    res = {}
    # rem:id-anchor-S: stereotype-only anchors recover mu_G, mu_S and every focal ECV under I-item DIF
    fs = np.ones(J, bool)
    fs[list(X2_S_ANCHORS)] = False
    f = D.fit_mg_s_anchored(popstats([b0, b1], [np.zeros(3), DS.X2_MU1]), b0.spec, 4, fs)
    p = f.params(1)
    res["s_anchored"] = dict(kappa=X2_MAIN_KAPPA, mu_hat=p["mu"], mu_true=DS.X2_MU1, note="mu_I fixed at 0 (not identified)",
                             max_abs_ecv1_error=float(np.max(np.abs(f.ecv_std(1) - b1.ecv()))), cost=f.opt.cost)
    # thm:dif-bias(d)(i): uniform DIF -a_j'v on all items == latent mean shift v
    bd = b0.copy()
    bd.b = bd.b - (A @ v)[:, None]
    f = D.fit_mg(popstats([b0, bd], [np.zeros(3), DS.X2_MU1]), b0.spec, 4, np.zeros(J, bool))
    res["dif_bias_d_i"] = dict(v=v, mu_hat=f.params(1)["mu"], mu_expected=DS.X2_MU1 + v, cost=f.opt.cost)
    # prop:anchor(b): three anchors (S1, S2, I1) with uniform DIF -A_A v
    anch = [0, 1, 8]
    bd = b0.copy()
    bd.b[anch] = bd.b[anch] - (A[anch] @ v)[:, None]
    fr = np.ones(J, bool)
    fr[anch] = False
    f = D.fit_mg(popstats([b0, bd], [np.zeros(3), DS.X2_MU1]), b0.spec, 4, fr)
    k = [j for j in range(J) if j not in anch]
    sp = f.params(1)["b"][k] - f.params(0)["b"][k]
    res["anchor_b"] = dict(anchors=[b0.names[j] for j in anch], v=v, mu_hat=f.params(1)["mu"],
                           mu_expected=DS.X2_MU1 + v, cost=f.opt.cost,
                           max_abs_spurious_dif_minus_a_v=float(np.max(np.abs(sp - (A[k] @ v)[:, None]))))
    return _py(res)


def x2_summary(raw, popl):
    out = {}
    for kappa in X2_KAPPA:
        rr = [r for r in raw if abs(r["kappa"] - kappa) < 1e-9]
        if not rr:
            continue
        b0, b1 = DS.x2_banks(kappa)
        cell = dict(R=len(rr), kappa=kappa, n_per_group=X2_N_PER_GROUP, time_mean=float(np.mean([r["time"] for r in rr])))
        for s in X2_STRATS:
            d = {}
            for fac, nm in enumerate(("G", "S", "I")):
                est = np.array([r[s]["mu_" + nm] for r in rr], dtype=float)     # None (JSON null) -> nan
                se = np.array([r[s]["se_" + nm] for r in rr], dtype=float)
                err = est - DS.X2_MU1[fac]
                if not np.any(np.isfinite(err)):
                    d["mu_" + nm] = dict(identified=False)
                    continue
                cov = np.where(np.isfinite(se), (np.abs(err) <= 1.959964 * se).astype(float), np.nan)
                d["mu_" + nm] = dict(bias=mc(err), rmse=rmse(err), cover=prop(cov),
                                     se_mean=float(np.nanmean(se)), plim_bias=None)
            j3 = DS.X2_NONUNIFORM[0]
            # ECV^(g) of def:boundary (focal group: with the focal factor variances); true Sigma_1 = I
            for g, bk, key in ((0, b0, "ecv0"), (1, b1, "ecv1_std")):
                e = np.array([r[s][key][j3] for r in rr]) - bk.ecv()[j3]
                d[f"ecv{g}_I3"] = dict(true=bk.ecv()[j3], bias=mc(e), rmse=rmse(e))
            iI_ = np.flatnonzero(b0.spec == 2)
            e1all = np.array([np.asarray(r[s]["ecv1_std"])[iI_] for r in rr]) - b1.ecv()[iI_]
            d["ecv1_I_bias_by_item"] = {b0.names[j]: float(v) for j, v in zip(iI_, e1all.mean(axis=0))}
            B1t = b1.ecv()[iI_] >= TAU
            d["boundary1_point_correct"] = prop(((np.array([np.asarray(r[s]["ecv1_std"])[iI_] for r in rr]) >= TAU)
                                                 == B1t[None, :]).ravel())
            iI = np.flatnonzero(b0.spec == 2)
            e_all = np.array([np.asarray(r[s]["ecv0"])[iI] for r in rr]) - b0.ecv()[iI]
            d["ecv0_I_meanabsbias"] = float(np.mean(np.abs(e_all.mean(axis=0))))
            d["converged"] = prop([r[s]["converged"] for r in rr])
            d["var1_G"] = mc([r[s]["var1"][0] for r in rr])
            V1 = np.array([r[s]["var1"] for r in rr], float)
            d["p_var_at_bound"] = prop(np.any((V1 >= 0.999 * np.exp(3.0)) | (V1 <= 1.001 * np.exp(-3.0)), axis=1))
            pl = popl.get(str(kappa), {}).get(s)          # no plim for the data-dependent procedures
            if pl is not None:
                for fac, nm in enumerate(("G", "S", "I")):
                    if d["mu_" + nm].get("identified", True):
                        d["mu_" + nm]["plim_bias"] = pl["mu"][fac] - DS.X2_MU1[fac]
            cell[s] = d
        # DIF detection
        det = {}
        for nm in DS.X2_ANCHORS:
            tests = [r[nm + "_tests"] for r in rr]
            tested = tests[0]["tested"]
            per = {}
            for ii, j in enumerate(tested):
                flag = [j in t["flagged"] for t in tests]
                sig = [t["sig"][ii] for t in tests]
                per[b0.names[j]] = dict(dif_true=j in DS.X2_TRUE_DIF and kappa > 0,
                                        flag=prop(flag), sig_bh=prop(sig),
                                        es_mean=float(np.mean([t["es"][ii] for t in tests])))
            clean = [b0.names[j] for j in tested if not (j in DS.X2_TRUE_DIF and kappa > 0)]
            difi = [b0.names[j] for j in tested if j in DS.X2_TRUE_DIF and kappa > 0]
            det[nm] = dict(items=per,
                           fpr_flag=float(np.mean([per[c]["flag"]["p"] for c in clean])) if clean else None,
                           fpr_bh=float(np.mean([per[c]["sig_bh"]["p"] for c in clean])) if clean else None,
                           power_flag=float(np.mean([per[c]["flag"]["p"] for c in difi])) if difi else None,
                           power_bh=float(np.mean([per[c]["sig_bh"]["p"] for c in difi])) if difi else None,
                           any_false_flag=prop([any((j not in DS.X2_TRUE_DIF or kappa == 0) for j in t["flagged"])
                                                for t in tests]))
        cell["detection"] = det
        loo = {}
        for nm in DS.X2_ANCHORS:
            sp = [r[nm + "_loo"]["spread"] for r in rr if nm + "_loo" in r]
            if sp:
                loo[nm] = dict(spread=mc(sp), R=len(sp))
        if loo:
            cell["loo_spread_mu_G"] = loo
        out[str(kappa)] = cell
    return out


# =============================================================================
# X3: list experiments (sec:sensitive: prop:list-var, thm:joint-sdb, thm:design)
# =============================================================================
X3_N = 3000
X3_PI, X3_PID = 0.30, 0.20          # pi and the direct prevalence produced by the threshold shift
X3_A = 0.75                         # slope of the sensitive item on theta_G (standardised loading 0.6)
X3_REL = 0.85                       # reliability of the theta_G score used by the covariate-adjusted estimator
X3_PILOT = 300
X3_PHI = 0.02                       # false-endorsement rate phi in the non-monotone scenario
X3_MSE_N = (300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000)


def x3_design(J=4, rho=-0.6, phi=0.0, fc=0.0):
    return L.ListDesign(J=J, rho=rho, pi=X3_PI, pi_d_shift=X3_PID, a=X3_A, phi_rate=phi / (1 - X3_PI), kc=fc, kf=fc)


def x3_cells():
    cells = []
    for ctrl, rho in (("indep", 0.0), ("pairs", -0.6)):
        for alloc in ("equal", "neyman", "pilot"):
            cells.append(dict(id=f"A_{ctrl}_{alloc}", part="A", J=4, rho=rho, phi=0.0, fc=0.0, design="split",
                              alloc=alloc))
    for phi in (0.0, X3_PHI):
        for design, alloc in (("split", "neyman"), ("paired", "paired_opt"), ("paired", "equal")):
            cells.append(dict(id=f"B_phi{phi}_{design}_{alloc}", part="B", J=4, rho=-0.6, phi=phi, fc=0.0,
                              design=design, alloc=alloc))
    for J in (2, 3, 4, 5, 6):
        for rho in (0.0, -0.6):
            for fc in (0.0, 0.5):
                cells.append(dict(id=f"C_J{J}_rho{rho}_fc{fc}", part="C", J=J, rho=rho, phi=0.0, fc=fc,
                                  design="split", alloc="neyman"))
    return cells


def x3_alloc(des, cell, rng):
    if cell["alloc"] == "equal":
        return np.array([1, 1, 1]) / 3
    if cell["alloc"] == "neyman":
        return L.neyman_split(des.v_d(), des.sigma_c2(), des.sigma_t2())
    if cell["alloc"] == "paired_opt":
        return L.paired_alloc(des)
    # pilot: split pilot with equal allocation, plug-in Neyman shares (pilot data not reused)
    pdat = L.simulate(des, X3_PILOT, np.array([1, 1, 1]) / 3, rng)
    a, y, d = pdat["arm"], pdat["y"], pdat["d"]
    pd = d[a == 0].mean()
    return L.neyman_split(max(pd * (1 - pd), 1e-4), y[a == 1].var(ddof=1), y[a == 2].var(ddof=1))


def x3_task(args):
    ci, cell, reps = args
    des = x3_design(cell["J"], cell["rho"], cell["phi"], cell["fc"])
    s_m = np.sqrt((1 - X3_REL) / X3_REL)
    out = []
    for rep in reps:
        rng = np.random.default_rng(seed("X3", ci, rep))
        r = x3_alloc(des, cell, rng)
        dat = L.simulate(des, X3_N, r, rng, paired=cell["design"] == "paired")
        arm, y, d = dat["arm"], dat["y"], dat["d"]
        row = dict(cell=cell["id"], rep=rep, r=r)
        if cell["design"] == "split":
            e, pl, pd = L.split_sdb(arm, y, d)
            row.update(split=e.est, split_se=e.se, pi_list=pl, pi_d=pd)
            if cell["part"] == "A":
                x = dat["theta"] + s_m * rng.standard_normal(X3_N)
                ea = L.adjusted_split_sdb(arm, y, d, x)
                row.update(adj=ea.est, adj_se=ea.se)
        else:
            e = L.paired_ps(arm, y, d)
            c = L.paired_combined(arm, y, d)
            row.update(ps=e.est, ps_se=e.se, comb=c.est, comb_se=c.se)
        out.append(row)
    return _py(out)


def _metrics(v, se, truth, sd_theory=None, bias_theory=None):
    v, se = np.asarray(v, float), np.asarray(se, float)
    err = v - truth
    cov = np.where(np.isfinite(se), (np.abs(err) <= 1.959964 * se).astype(float), np.nan)
    return dict(bias=mc(err), rmse=rmse(err), mse=float(np.nanmean(err ** 2)), sd=float(np.nanstd(v, ddof=1)),
                se_mean=float(np.nanmean(se)), cover=prop(cov), sd_theory=sd_theory, bias_theory=bias_theory)


def x3_summary(raw):
    out = dict(cells={})
    for ci, cell in enumerate(x3_cells()):
        rr = [r for r in raw if r["cell"] == cell["id"]]
        if not rr:
            continue
        des = x3_design(cell["J"], cell["rho"], cell["phi"], cell["fc"])
        R_ = np.array([r["r"] for r in rr], float)
        d = dict(cell, R=len(rr), n=X3_N, r_mean=R_.mean(axis=0),
                 truth=dict(pi=des.pi, pi_d=des.pi_d, sdb=des.sdb, eta=des.eta, phi=des.phi, sigma_c2=des.sigma_c2(),
                            sigma_t2=des.sigma_t2(), v_d=des.v_d(), exposure=des.exposure(), fc_bias=des.fc_bias()))
        if cell["design"] == "split":
            sd_th = float(np.sqrt(np.mean([L.split_var(des, r, X3_N) for r in R_])))
            d["split"] = _metrics([r["split"] for r in rr], [r["split_se"] for r in rr], des.sdb, sd_th, des.fc_bias())
            d["pi_list"] = dict(bias=mc(np.array([r["pi_list"] for r in rr]) - des.pi))
            if "adj" in rr[0]:
                d["adj"] = _metrics([r["adj"] for r in rr], [r["adj_se"] for r in rr], des.sdb)
        else:
            v_ps, v_eta = L.paired_avar(des, R_.mean(axis=0))
            d["ps"] = _metrics([r["ps"] for r in rr], [r["ps_se"] for r in rr], des.sdb, float(np.sqrt(v_ps / X3_N)))
            d["comb_vs_sdb"] = _metrics([r["comb"] for r in rr], [r["comb_se"] for r in rr], des.sdb,
                                        float(np.sqrt(v_eta / X3_N)), des.phi)
            d["comb_vs_eta"] = _metrics([r["comb"] for r in rr], [r["comb_se"] for r in rr], des.eta)
        out["cells"][cell["id"]] = d
    # thm:design(c): MSE-optimal control list on the menu {J} x {rho}, by sample size (equal costs, B = n)
    menu = [(J, rho) for J in (2, 3, 4, 5, 6) for rho in (0.0, -0.6)]
    choice = {}
    for fc in (0.0, 0.5):
        rows = {}
        for n in X3_MSE_N:
            mse = {}
            for J, rho in menu:
                des = x3_design(J, rho, 0.0, fc)
                V = (np.sqrt(des.v_d()) + np.sqrt(des.sigma_c2()) + np.sqrt(des.sigma_t2())) ** 2
                mse[f"J{J}_rho{rho}"] = V / n + des.fc_bias() ** 2
            best = min(mse, key=mse.get)
            rows[str(n)] = dict(best=best, mse=mse)
        emp = {f"J{J}_rho{rho}": out["cells"].get(f"C_J{J}_rho{rho}_fc{fc}", {}).get("split", {}).get("mse")
               for J, rho in menu}
        emp = {k: v for k, v in emp.items() if v is not None}
        choice[f"fc{fc}"] = dict(theory_by_n=rows, empirical_n3000=dict(mse=emp, best=min(emp, key=emp.get) if emp else None))
    out["list_choice"] = choice
    out["checks"] = x3_checks()
    return out


def x3_checks():
    """Independent re-computation of the illustrative numbers in sec:sensitive and sec:design-list."""
    from scipy.stats import norm
    c = {}
    # prop:list-var illustration: J = 4, p = 1/2, pi = 0.2 independent of the controls
    for lab, rho in (("indep", 0.0), ("pairs_rho-0.6", -0.6)):
        sc2 = 2 * (1 + rho) / 2
        st2 = sc2 + 0.16
        c[f"Lstar_{lab}"] = (np.sqrt(st2) + np.sqrt(sc2)) ** 2 / 0.16
        c[f"sigmaC2_{lab}"] = sc2
    # rem:le-mse thresholds (pi^D close to pi = 0.2, independent controls)
    Ls = c["Lstar_indep"]
    c["rem_le_mse_threshold"] = {str(n): float(np.sqrt((Ls * 0.16 - 0.16) / n)) for n in (2000, 6000)}
    # thm:design(a) illustration: sigma_C^2 = sigma_T^2 = 1, pi^D = 0.2, equal costs
    vD = 0.16
    c["design_a_nvar_equal"] = 3 * (1 + 1 + vD)
    c["design_a_nvar_opt"] = (1 + 1 + np.sqrt(vD)) ** 2
    c["design_a_shares"] = list(L.neyman_split(vD, 1.0, 1.0))
    # thm:design(b) illustration: eta = 0.05, pi = 0.2, sigma_C^2 = 1, monotonicity
    P1 = 0.15
    P0 = 0.85
    D0 = 0.05 / P0
    nu0 = D0 ** 2 * P0 * P1
    bT, bC = P0 * (1 + D0 * (1 - D0)), P0 * 1.0
    bbar = np.sqrt(bT) + np.sqrt(bC)
    c["design_b_direct_arm_cost_ratio_threshold"] = nu0 / bbar ** 2
    c["paired_split_ratio"] = bbar ** 2 / (1 + np.sqrt(1.16)) ** 2
    # sec:design-list arithmetic: Var ~ (2 + 0.16)/m; m for power 0.8 at SDB = 0.10 and 0.05
    z = norm.ppf(0.975) + norm.ppf(0.8)
    c["design_list_m_sdb0.10"] = z ** 2 * 2.16 / 0.10 ** 2
    c["design_list_m_sdb0.05"] = z ** 2 * 2.16 / 0.05 ** 2
    return c


# =============================================================================
# X4: MRP
# =============================================================================
X4_N = (1000, 3000, 6000)
X4_A = 50
X4_SM = 0.40
X4_BINS = (0, 5, 10, 20, 50, 100, 10 ** 9)


def x4_task(args):
    n, reps = args
    out = []
    for rep in reps:
        ss = seed("X4", n, rep)
        sp, sd = ss.spawn(2)
        pop = M.make_population(np.random.default_rng(sp), A=X4_A)
        area, dcell, y, _ = M.draw_sample(pop, n, np.random.default_rng(sd), s_m=X4_SM)
        est, se, m = M.mrp_estimate(pop, area, dcell, y)
        yt, rho_eap = M.eap_scores(y, X4_SM)
        est_eap, se_eap, _ = M.mrp_estimate(pop, area, dcell, yt)
        unw, wtd, se_unw, na = M.direct_estimates(pop, area, dcell, y)
        T = pop.area_mean
        slope = lambda e: float(np.polyfit(T, e, 1)[0])
        out.append(dict(n=n, rep=rep, truth=T, mrp=est, mrp_se=se, mrp_eap=est_eap, mrp_eap_se=se_eap, rho_eap=rho_eap,
                        slope_mrp=slope(est), slope_eap=slope(est_eap), direct=unw, direct_w=wtd, direct_se=se_unw,
                        na=na, su=np.sqrt(m["su2"]), s2=m["s2"]))
    return _py(out)


def x4_summary(raw):
    out = {}
    for n in X4_N:
        rr = [r for r in raw if r["n"] == n]
        if not rr:
            continue
        T = np.array([r["truth"] for r in rr], float)
        Mx = np.array([r["mrp"] for r in rr], float)
        Ms = np.array([r["mrp_se"] for r in rr], float)
        Dx = np.array([r["direct"] for r in rr], float)
        Dw = np.array([r["direct_w"] for r in rr], float)
        Ds = np.array([r["direct_se"] for r in rr], float)
        NA = np.array([r["na"] for r in rr], float)
        ok = NA >= 2
        d = dict(R=len(rr), n=n, A=X4_A, s_m=X4_SM, empty_areas=mc((NA == 0).sum(axis=1)),
                 areas_lt5=mc((NA < 5).sum(axis=1)))
        em, ed, ew = Mx - T, Dx - T, Dw - T
        d["mrp_all"] = dict(rmse=rmse(em.ravel()), bias=mc(em.ravel()),
                            cover=prop((np.abs(em) <= 1.959964 * Ms).ravel()))
        d["mrp_ok"] = dict(rmse=rmse(em[ok]))
        d["direct_ok"] = dict(rmse=rmse(ed[ok]), bias=mc(ed[ok]),
                              cover=prop((np.abs(ed) <= 1.959964 * Ds)[ok & (NA >= 5)]))
        d["direct_w_ok"] = dict(rmse=rmse(ew[ok]), bias=mc(ew[ok]))
        bins = []
        for lo, hi in zip(X4_BINS[:-1], X4_BINS[1:]):
            m = (NA >= lo) & (NA < hi)
            m2 = m & ok
            bins.append(dict(lo=lo, hi=hi, n_areas=int(m.sum()), mrp_rmse=rmse(em[m])["rmse"] if m.any() else None,
                             direct_rmse=rmse(ed[m2])["rmse"] if m2.sum() > 1 else None,
                             direct_w_rmse=rmse(ew[m2])["rmse"] if m2.sum() > 1 else None,
                             mrp_cover=prop((np.abs(em) <= 1.959964 * Ms)[m])["p"] if m.any() else None))
        d["by_area_n"] = bins
        Me = np.array([r["mrp_eap"] for r in rr], float)
        Mes = np.array([r["mrp_eap_se"] for r in rr], float)
        ee = Me - T
        d["mrp_eap_two_step"] = dict(rmse=rmse(ee.ravel()), bias=mc(ee.ravel()),
                                     cover=prop((np.abs(ee) <= 1.959964 * Mes).ravel()),
                                     slope=mc([r["slope_eap"] for r in rr]), rho_eap=mc([r["rho_eap"] for r in rr]))
        d["mrp_all"]["slope"] = mc([r["slope_mrp"] for r in rr])
        # bias of the deviation of an area from the national mean (attenuation, eq:sa-eap)
        dev_t = T - T.mean(axis=1, keepdims=True)
        d["attenuation"] = dict(mrp=mc(((Mx - Mx.mean(axis=1, keepdims=True)) * dev_t).sum(1) / (dev_t ** 2).sum(1)),
                                eap=mc(((Me - Me.mean(axis=1, keepdims=True)) * dev_t).sum(1) / (dev_t ** 2).sum(1)))
        d["su_hat"] = mc([r["su"] for r in rr])
        d["true_area_sd"] = mc(T.std(axis=1, ddof=1))
        # share of areas where MRP beats direct (absolute error), among areas with >= 2 respondents
        d["p_mrp_better"] = prop((np.abs(em) < np.abs(ed))[ok])
        out[str(n)] = d
    return out


# =============================================================================
# X5: stereotype-count index sign reversals
# =============================================================================
X5_S_DIF = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5)
X5_DELTA = (0.05, 0.10, 0.20, 0.30)
X5_K = 4
X5_CONFIGS = 1000
X5_FS_N = 1000          # per group, finite-sample check
X5_FS_R = 300


def x5_task(args):
    s_dif, delta, k_list, n_configs = args
    bank = DS.x1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    aG, aS, b = bank.aG[S], bank.aS[S], bank.b[S, IX.C_AGREE - 1]
    sd = np.sqrt(1 + aG ** 2 + aS ** 2)
    rng = np.random.default_rng(seed("X5", int(round(s_dif * 100)), int(round(delta * 100))))
    base = {k: None for k in k_list}
    d0 = IX.population_count_dist(aG, aS, b)
    rows = []
    for c in range(n_configs):
        sign = 1.0 if rng.random() < 0.5 else -1.0
        dlt = sign * delta
        db = rng.normal(scale=s_dif, size=len(S)) * sd
        d1 = IX.population_count_dist(aG, aS, b + db, (dlt, 0.0))
        diffs = {k: IX.index_k(d1, k) - IX.index_k(d0, k) for k in k_list}
        mean_diff = float(np.dot(np.arange(len(S) + 1), d1 - d0))
        rows.append(dict(delta=dlt, diffs=diffs, mean_count_diff=mean_diff, mean_db=float(np.mean(db / sd))))
    return _py(dict(s_dif=s_dif, delta=delta, rows=rows))


def x5_fs_task(args):
    s_dif, delta, reps = args
    bank = DS.x1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    sub = bank.subset(S)
    sd = np.sqrt(1 + sub.aG ** 2 + sub.aS ** 2)
    out = []
    for rep in reps:
        rng = np.random.default_rng(seed("X5", 500 + int(round(s_dif * 100)), int(round(delta * 100)), rep))
        db = rng.normal(scale=s_dif, size=len(S)) * sd
        b1 = sub.copy()
        b1.b = b1.b + db[:, None]
        Y, g, _ = gen.simulate([sub, b1], [np.zeros(3), np.array([delta, 0, 0])], [np.eye(3)] * 2,
                               [X5_FS_N, X5_FS_N], rng)
        diff = IX.sample_index(Y[g == 1], X5_K) - IX.sample_index(Y[g == 0], X5_K)
        out.append(dict(rep=rep, diff=diff))
    return _py(dict(s_dif=s_dif, delta=delta, rows=out))


X5_SIGMA1 = (0.6, 0.8, 1.25, 1.5)
X5_SA = (0.2, 0.4, 0.6)


def _x5_items():
    bank = DS.x1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    return bank.aG[S], bank.aS[S], bank.b[S, IX.C_AGREE - 1]


def x5_variance():
    """prop:index(b) in the bifactor setting: full invariance, delta = mu_G^(1) - mu_G^(0) > 0,
    focal SD of G = sigma1 (reference 1); index difference P1(h) - P0(h) for h = 1..8."""
    aG, aS, b = _x5_items()
    d0 = IX.population_count_dist(aG, aS, b)
    out = {}
    for delta in (0.1, 0.2):
        for s1 in X5_SIGMA1:
            d1 = IX.population_count_dist(aG, aS, b, (delta, 0.0), (s1, 1.0))
            diff = IX.survival(d1) - IX.survival(d0)
            sg = np.sign(diff)
            out[f"d{delta}_s{s1}"] = dict(delta=delta, sigma1=s1, diff_by_h=diff, sign_by_h=sg,
                                          n_sign_changes=int(np.sum(sg[1:] != sg[:-1])))
    return out


def x5_nonuniform_task(args):
    """prop:index(d)-type configurations: random non-uniform DIF a_jG^(1) = a_jG^(0) exp(N(0, s_a^2))."""
    s_a, delta, n_configs = args
    aG, aS, b = _x5_items()
    rng = np.random.default_rng(seed("X5", 700 + int(round(s_a * 100)), int(round(delta * 100))))
    d0 = IX.population_count_dist(aG, aS, b)
    rows = []
    for c in range(n_configs):
        mult = np.exp(rng.normal(scale=s_a, size=len(aG)))
        d1 = IX.population_count_dist(aG * mult, aS, b, (delta, 0.0))
        rows.append(dict(diff_by_h=IX.survival(d1) - IX.survival(d0)))
    return _py(dict(s_a=s_a, delta=delta, rows=rows))


def x5_nonuniform_summary(raw):
    out = {}
    for r in raw:
        D_ = np.array([x["diff_by_h"] for x in r["rows"]])
        sg = np.sign(D_)
        hdep = np.any(sg != sg[:, :1], axis=1)
        out[f"sa{r['s_a']}_d{r['delta']}"] = dict(
            s_a=r["s_a"], delta=r["delta"], R=len(D_), p_h_dependent_sign=prop(hdep),
            reversal_by_h=[prop(sg[:, h] < 0)["p"] for h in range(D_.shape[1])],
            reversal_k4=prop(sg[:, X5_K - 1] < 0))
    return out


def x5_checks():
    """Re-computation of Example ex:sa-index (M = 10, logistic F, normal G_g)."""
    from scipy.special import ndtr
    M_ = 10
    a, b = np.full(M_, 1.5), np.linspace(0.5, 3.5, M_)
    P1 = IX.survival(IX.count_dist_1d(a, b, 0.2, 0.6))
    P2 = IX.survival(IX.count_dist_1d(a, b, 0.0, 1.4))
    ex1 = dict(sign_by_h=np.sign(P1 - P2), P1_h5=P1[4], P2_h5=P2[4])
    b0 = np.zeros(M_)
    P1 = IX.survival(IX.count_dist_1d(np.full(M_, 0.25), b0, 0.3, 1.0))
    P2 = IX.survival(IX.count_dist_1d(np.full(M_, 3.0), b0, 0.0, 1.0))
    ex2 = dict(P1_h1=P1[0], P2_h1=P2[0], P1_h10=P1[9], P2_h10=P2[9], sign_by_h=np.sign(P1 - P2))
    ex3 = dict(change_start_t_minus_3_by_0p5=float(ndtr(-2.5) - ndtr(-3.0)),
               change_start_t_by_0p25=float(ndtr(0.25) - ndtr(0.0)))
    return _py(dict(example_i=ex1, example_ii=ex2, example_iii=ex3))


def x5_summary(raw, raw_fs, k_list, n_configs):
    out = dict(k_main=X5_K, configs=n_configs, cells={})
    for r in raw:
        rows = r["rows"]
        dl = np.array([x["delta"] for x in rows])
        cell = dict(s_dif=r["s_dif"], delta=r["delta"], R=len(rows))
        for k in k_list:
            dd = np.array([x["diffs"][str(k)] for x in rows])
            cell[f"reversal_k{k}"] = prop(np.sign(dd) != np.sign(dl))
            cell[f"index_diff_k{k}"] = mc(dd * np.sign(dl))
        md = np.array([x["mean_count_diff"] for x in rows])
        cell["reversal_meancount"] = prop(np.sign(md) != np.sign(dl))
        out["cells"][f"s{r['s_dif']}_d{r['delta']}"] = cell
    fs = {}
    for r in raw_fs:
        d = np.array([x["diff"] for x in r["rows"]])
        fs[f"s{r['s_dif']}_d{r['delta']}"] = dict(s_dif=r["s_dif"], delta=r["delta"], R=len(d),
                                                  reversal=prop(np.sign(d) != np.sign(r["delta"])),
                                                  tie=prop(d == 0), diff=mc(d))
    out["finite_sample"] = dict(n_per_group=X5_FS_N, k=X5_K, cells=fs)
    return out


# =============================================================================
# Shared helpers for X2b, X6-X9
# =============================================================================
def subset_corr_stats(st, items, J):
    """Correlation-only GroupStats for a subset of items (pairs within the subset; Gamma sub-block)."""
    from attsim.polychoric import all_pairs
    items = np.asarray(items)
    pos = {tuple(p): i for i, p in enumerate(all_pairs(J))}
    sp = all_pairs(len(items))
    idx = np.array([pos[(items[a], items[b])] for a, b in sp])
    return F.GroupStats(None, st.rho[idx], st.Gamma[np.ix_(idx, idx)], st.n, True), idx


def bonf_classify(ecv, se, items, truth_in, tau=TAU, alpha=0.05):
    """Bonferroni-adjusted logit-Wald intervals over `items` (the plan's rule, prop:id-boundary-test(b)).
    Returns classification (+1 in, -1 out, 0 undetermined), and the pointwise and Bonferroni intervals."""
    from scipy.stats import norm
    e = np.clip(np.asarray(ecv, float)[items], 1e-6, 1 - 1e-6)
    sl = np.asarray(se, float)[items] / (e * (1 - e))
    zb = norm.ppf(1 - alpha / (2 * len(items)))
    lg = np.log(e / (1 - e))
    lo, hi = 1 / (1 + np.exp(-(lg - zb * sl))), 1 / (1 + np.exp(-(lg + zb * sl)))
    plo, phi = 1 / (1 + np.exp(-(lg - 1.959964 * sl))), 1 / (1 + np.exp(-(lg + 1.959964 * sl)))
    return classify(lo, hi, tau), (lo, hi), (plo, phi)


def residual_block_test(fit, Gamma, mask):
    """One-sided test that the mean residual polychoric correlation over the pairs in `mask` is zero,
    after a DWLS fit (PatternFit): e = r - rho(theta-hat), Cov(e) = P Gamma P', P = I - D H^{-1} D'W."""
    R, Dm = fit.model.implied(fit.theta)
    W = fit.weights
    e = fit.rho - R
    H = Dm.T @ (W[:, None] * Dm)
    P = np.eye(len(e)) - Dm @ np.linalg.pinv(H, rcond=1e-10) @ (Dm.T * W[None, :])
    c = mask.astype(float) / mask.sum()
    v = c @ P @ Gamma @ P.T @ c
    return float(c @ e), float(c @ e / np.sqrt(max(v, 1e-300)))


# =============================================================================
# X2b: DIF on the stereotype anchors (eq:id-anchor-bound)
# =============================================================================
X2B_KAPPA_I = (0.0, 0.4)
X2B_KAPPA_S = (0.1, 0.2, 0.3)
X2B_DEFAULT = DS.X2_ANCHORS["correct"]           # S1-S4, I5, I6: the default (registered) anchor set
X2B_STRATS = ("oracle", "default_fb", "default_proc", "sonly_fb")
X2B_DELTA_MAX = (0.1, 0.2, 0.3, 0.4)


def _x2b_fit(st, spec, anchors, sonly=False):
    J = len(spec)
    fr = np.ones(J, bool)
    fr[list(anchors)] = False
    return D.fit_mg_s_anchored(st, spec, 4, fr) if sonly else D.fit_mg(st, spec, 4, fr)


def x2b_task(args):
    ki, ks, rep = args
    b0, b1 = DS.x2b_banks(ki, ks)
    J = b0.J
    rng = np.random.default_rng(seed("X2b", int(round(ki * 100)), int(round(ks * 100)), rep))
    t0 = time.perf_counter()
    Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.X2_MU1], [np.eye(3), np.eye(3)],
                           [X2_N_PER_GROUP, X2_N_PER_GROUP], rng)
    st = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
    res = dict(kappa_I=ki, kappa_S=ks, rep=rep)
    dif_items = set(DS.X2B_S_DIF_ITEMS) | (set(DS.X2_TRUE_DIF) if ki > 0 else set())
    res["oracle"] = _x2_fit_summary(_x2b_fit(st, b0.spec, [j for j in range(J) if j not in dif_items]))
    res["default_fb"] = _x2_fit_summary(_x2b_fit(st, b0.spec, X2B_DEFAULT))
    res["sonly_fb"] = _x2_fit_summary(_x2b_fit(st, b0.spec, X2_S_ANCHORS, sonly=True))
    pr = D.dif_procedure(st, b0.spec, 4, X2B_DEFAULT, es_min=-1.0)        # revised screen: BH only
    res["default_proc"] = _x2_fit_summary(pr["final"])
    res["default_tests"] = dict(tested=pr["tested"], p=pr["p"], sig=pr["sig"], flagged=pr["flagged"])
    for nm, anchors, so in (("default", X2B_DEFAULT, False), ("sonly", X2_S_ANCHORS, True)):
        mus = []
        for a in anchors:
            mus.append(D.latent_contrast(_x2b_fit(st, b0.spec, [x for x in anchors if x != a], sonly=so), 0)[0])
        res[nm + "_loo"] = dict(mu_G=mus, spread=float(np.max(mus) - np.min(mus)))
    res["time"] = time.perf_counter() - t0
    return _py(res)


def _efficient_anchor_info(m, theta, weights, anchors, mu_names):
    """W of prop:anchor(c) for the DWLS estimator: the Schur complement, with respect to all parameters
    other than the focal latent means, of the weighted information of the anchors' focal intercepts.
    Returns (W, A_A, check) where check is the size of the part of d stats/d mu not spanned by
    D_iota A_A and the other parameters' columns (should be ~0)."""
    sig, Dl = m.implied(theta)
    Jn, C = m.J, m.C
    P = len(m.pairs)
    n0 = Jn * C + P
    p1 = m.expand(theta, 1)
    s2 = np.exp(p1["lv"])
    sd1 = np.sqrt(p1["aG"] ** 2 * s2[0] + p1["aS"] ** 2 * s2[m.spec] + 1)
    Di = np.zeros((len(sig), len(anchors)))
    for q, j in enumerate(anchors):
        Di[n0 + j * C:n0 + (j + 1) * C, q] = -1.0 / sd1[j]
    mu_cols = [m.names.index(nm) for nm in mu_names]
    eta_cols = [i for i in range(m.npar) if i not in mu_cols]
    De = Dl[:, eta_cols]
    V = weights
    Hee = De.T @ (V[:, None] * De)
    VDe = V[:, None] * De
    Q = np.diag(V) - VDe @ np.linalg.solve(Hee, VDe.T)
    W = Di.T @ Q @ Di
    p0 = m.expand(theta, 0)
    A_full = np.zeros((Jn, 3))
    A_full[:, 0] = p0["aG"]
    A_full[np.arange(Jn), m.spec] = p0["aS"]
    facs = [nm[1] for nm in mu_names]
    A_A = A_full[np.asarray(anchors)][:, facs]
    # check d stats / d mu = D_iota A_A + D_eta K
    Dmu = Dl[:, mu_cols]
    Rm = Dmu - Di @ A_A
    K = np.linalg.lstsq(np.sqrt(V)[:, None] * De, np.sqrt(V)[:, None] * Rm, rcond=None)[0]
    chk = float(np.max(np.abs(Rm - De @ K)) / max(np.max(np.abs(Dmu)), 1e-12))
    return W, A_A, chk


def x2b_bounds(b0, b1_noanchor, sd_anchor_items, weights_groups, anchors, sonly, d_actual):
    """First-order bias of the anchored DWLS fit and the bound eq:id-anchor-bound at stated maximum anchor
    DIF delta_max (|d_j| <= delta_max sd_j for every anchor, sd_j the latent-response SD of anchor j)."""
    J = b0.J
    pop = []
    for bk, mu in ((b0, np.zeros(3)), (b1_noanchor, DS.X2_MU1)):
        tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
        pop.append(F.GroupStats(tau, rho, None, 10 ** 9, False))
    fr = np.ones(J, bool)
    fr[list(anchors)] = False
    m = F.BifactorMG(b0.spec, 4, n_groups=2, free=fr, fit_thresholds=True)
    if sonly:
        D.fix_latent(m, [("mu", 2, 1), ("lv", 2, 1)])
    w = np.concatenate(weights_groups)
    f = m.fit(pop, weights=w)
    mu_names = [("mu", 0, 1), ("mu", 1, 1)] + ([] if sonly else [("mu", 2, 1)])
    W, A_A, chk = _efficient_anchor_info(m, f.theta, w, list(anchors), mu_names)
    Cm = np.linalg.solve(A_A.T @ W @ A_A, A_A.T @ W)
    ev, U = np.linalg.eigh(W)
    Wh = U @ np.diag(np.sqrt(np.maximum(ev, 0))) @ U.T
    M = Wh @ A_A
    smin = float(np.linalg.svd(M, compute_uv=False).min())
    Pi = M @ np.linalg.solve(M.T @ M, M.T)
    sd = np.asarray(sd_anchor_items, float)
    verts = np.array(np.meshgrid(*[[-1.0, 1.0]] * len(anchors))).reshape(len(anchors), -1).T
    out = dict(anchors=[b0.names[j] for j in anchors], fit_cost=float(f.opt.cost), span_check=chk,
               sigma_min_M=smin, C_muG=Cm[0], lev=np.diag(Wh @ Pi @ Wh), W_diag=np.diag(W),
               first_order_actual=Cm @ d_actual, by_delta_max={})
    for dm in X2B_DELTA_MAX:
        dv = dm * verts * sd[None, :]
        out["by_delta_max"][str(dm)] = dict(
            same_direction_muG=float(dm * np.sum(Cm[0] * sd)),
            same_direction_norm=float(np.linalg.norm(Cm @ (dm * sd))),
            worst_abs_muG=float(dm * np.sum(np.abs(Cm[0]) * sd)),
            worst_norm=float(np.max(np.linalg.norm(dv @ Cm.T, axis=1))),
            bound_middle=float(np.max(np.linalg.norm(dv @ (Pi @ Wh).T, axis=1)) / smin),
            bound_outer=float(np.max(np.linalg.norm(dv @ Wh.T, axis=1)) / smin))
    return out


def x2b_population():
    """Probability limits and first-order bounds per cell (population weights from 60,000 per group)."""
    out = {}
    for ki in X2B_KAPPA_I:
        for ks in X2B_KAPPA_S:
            b0, b1 = DS.x2b_banks(ki, ks)
            _, b1n = DS.x2_banks(ki)
            J = b0.J
            Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.X2_MU1], [np.eye(3), np.eye(3)], [60_000, 60_000],
                                   np.random.default_rng(seed("X2b", 999, int(round(ki * 100)), int(round(ks * 100)))))
            big = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
            wg = [1.0 / np.maximum(np.diag(b.Gamma), 1e-12) for b in big]
            pop = []
            for bk, mu in ((b0, np.zeros(3)), (b1, DS.X2_MU1)):
                tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
                pop.append(F.GroupStats(tau, rho, None, 10 ** 9, False))
            dif_items = set(DS.X2B_S_DIF_ITEMS) | (set(DS.X2_TRUE_DIF) if ki > 0 else set())
            res = {}
            for nm, anchors, so in (("oracle", [j for j in range(J) if j not in dif_items], False),
                                    ("default_fb", X2B_DEFAULT, False), ("sonly_fb", X2_S_ANCHORS, True)):
                fr = np.ones(J, bool)
                fr[list(anchors)] = False
                mm = F.BifactorMG(b0.spec, 4, n_groups=2, free=fr, fit_thresholds=True)
                if so:
                    D.fix_latent(mm, [("mu", 2, 1), ("lv", 2, 1)])
                f = mm.fit(pop, weights=np.concatenate(wg))
                p1 = f.params(1)
                res[nm] = dict(mu=p1["mu"], ecv1=f.ecv_std(1), cost=f.opt.cost)
            sd = np.sqrt(1 + b0.aG ** 2 + b0.aS ** 2)
            bounds = {}
            for nm, anchors, so in (("default_fb", X2B_DEFAULT, False), ("sonly_fb", X2_S_ANCHORS, True)):
                d_act = np.array([ks * sd[j] if j in DS.X2B_S_DIF_ITEMS else 0.0 for j in anchors])
                bounds[nm] = x2b_bounds(b0, b1n, sd[list(anchors)], wg, anchors, so, d_act)
            res["bounds"] = bounds
            res["truth"] = dict(mu=DS.X2_MU1, ecv1=b1.ecv())
            out[f"kI{ki}_kS{ks}"] = res
    return _py(out)


def x2b_summary(raw, popl):
    out = {}
    for ki in X2B_KAPPA_I:
        for ks in X2B_KAPPA_S:
            rr = [r for r in raw if abs(r["kappa_I"] - ki) < 1e-9 and abs(r["kappa_S"] - ks) < 1e-9]
            if not rr:
                continue
            key = f"kI{ki}_kS{ks}"
            b0, b1 = DS.x2b_banks(ki, ks)
            cell = dict(R=len(rr), kappa_I=ki, kappa_S=ks)
            for s in X2B_STRATS:
                d = {}
                for fac, nm in enumerate(("G", "S", "I")):
                    est = np.array([r[s]["mu_" + nm] for r in rr], dtype=float)
                    se = np.array([r[s]["se_" + nm] for r in rr], dtype=float)
                    err = est - DS.X2_MU1[fac]
                    if not np.any(np.isfinite(err)):
                        d["mu_" + nm] = dict(identified=False)
                        continue
                    cov = np.where(np.isfinite(se), (np.abs(err) <= 1.959964 * se).astype(float), np.nan)
                    pl = popl[key].get(s)
                    d["mu_" + nm] = dict(bias=mc(err), rmse=rmse(err), cover=prop(cov),
                                         plim_bias=(pl["mu"][fac] - DS.X2_MU1[fac]) if pl else None)
                iI = np.flatnonzero(b0.spec == 2)
                e1 = np.array([np.asarray(r[s]["ecv1_std"])[iI] for r in rr]) - b1.ecv()[iI]
                d["ecv1_I_bias_by_item"] = {b0.names[j]: float(v) for j, v in zip(iI, e1.mean(axis=0))}
                d["ecv1_I_maxabsbias"] = float(np.max(np.abs(e1.mean(axis=0))))
                V1 = np.array([r[s]["var1"] for r in rr], float)
                d["p_var_at_bound"] = prop(np.any((V1 >= 0.999 * np.exp(3.0)) | (V1 <= 1.001 * np.exp(-3.0)), axis=1))
                d["converged"] = prop([r[s]["converged"] for r in rr])
                cell[s] = d
            tests = [r["default_tests"] for r in rr]
            tested = tests[0]["tested"]
            cell["default_flags"] = {b0.names[j]: prop([j in t["flagged"] for t in tests]) for j in tested}
            for nm in ("default", "sonly"):
                cell[nm + "_loo_spread"] = mc([r[nm + "_loo"]["spread"] for r in rr])
            cell["bounds"] = popl[key]["bounds"]
            out[key] = cell
    return out


# =============================================================================
# X6: directional misspecifications (cross-loading of IT on S; acquiescence) and remedies
# =============================================================================
X6_N = 6000
X6_CELLS = ([dict(id=f"cross_c{c}", kind="cross", c=c) for c in (0.0, 0.1, 0.2, 0.3)]
            + [dict(id=f"acq_{k}_a{a}", kind="acq", alpha=a, keying=k, hetero=False)
               for k in ("registered", "balanced") for a in (0.25, 0.40, 0.55)]
            + [dict(id="acq_registered_a0.4_het", kind="acq", alpha=0.40, keying="registered", hetero=True)])
X6_MODELS = ("bif", "cross", "mf", "ipo", "twostage")
X6_STARTS = 3


def x6_dgp(cell):
    if cell["kind"] == "cross":
        A, b, spec, ecv = DS.x6_crossload(cell["c"])
        keys = np.ones(24)
        keys[list(DS.REG_REVERSED)] = -1.0          # the instrument's (registered) keying
    else:
        A, b, spec, ecv, keys = DS.x6_acquiescence(cell["alpha"], cell["keying"], cell.get("hetero", False))
    return A, b, spec, ecv, keys


def _x6_models(spec, keys):
    IT = DS.REG_IDX_IT
    return dict(bif=GF.PatternModel.bifactor(spec), cross=GF.PatternModel.bifactor(spec, cross={int(j): 1 for j in IT}),
                mf=GF.PatternModel.bifactor(spec, method_keys=keys))


def _x6_fit_all(rho, Gamma, w, spec, keys, rng, starts=X6_STARTS):
    """The standard bifactor fit and the three remedies; returns dict of PatternFits (+ the ID-only subset)."""
    mods = _x6_models(spec, keys)
    fits = {k: GF.fit_multistart(m, rho, w, rng, starts) for k, m in mods.items()}
    keep = np.r_[DS.REG_IDX_S, DS.REG_IDX_ID]
    stg = F.GroupStats(None, rho, Gamma, 0, True)
    sub, idx = subset_corr_stats(stg, keep, 24)
    fits["ipo"] = GF.fit_multistart(GF.PatternModel.bifactor(spec[keep]), sub.rho, w[idx], rng, starts)
    return fits, keep, idx


def residual_pair_tests(fit, Gamma, idx):
    """Two-sided z-tests of the residual polychoric correlations of the pairs `idx` after a DWLS fit."""
    from scipy.stats import norm
    R, Dm = fit.model.implied(fit.theta)
    W = fit.weights
    e = fit.rho - R
    H = Dm.T @ (W[:, None] * Dm)
    P = np.eye(len(e)) - Dm @ np.linalg.pinv(H, rcond=1e-10) @ (Dm.T * W[None, :])
    PG = P @ Gamma @ P.T
    z = e[idx] / np.sqrt(np.maximum(np.diag(PG)[idx], 1e-300))
    return z, 2 * norm.sf(np.abs(z))


def x6_plan_check(fits, st, w, spec, rng=None):
    """The plan's IT x S check: BH (q = 0.05) over the 60 IT x S residual correlations of the primary fit,
    and, for each IT item in turn, a fit that adds its loading on S (warm start, no random starts).
    Returns per IT item: residual flag, cross-loading z, the item's ECV and its share of common variance due
    to G, a_G^2 / (a_G^2 + a_S^2 + a_I^2), with delta-method SEs, from the one-item cross-loading model."""
    bif = fits["bif"]
    pairs = bif.model.pairs
    S_ = set(DS.REG_IDX_S.tolist())
    out = dict(items={})
    pidx = {int(k): [q for q, (a, c) in enumerate(pairs) if (a == k and c in S_) or (c == k and a in S_)]
            for k in DS.REG_IDX_IT}
    allidx = np.array([q for k in DS.REG_IDX_IT for q in pidx[int(k)]])
    z, pv = residual_pair_tests(bif, st.Gamma, allidx)
    sig = D.bh(pv, 0.05)
    flag_by_pair = dict(zip(allidx.tolist(), sig.tolist()))
    out["n_pairs_flagged"] = int(sig.sum())
    for k in DS.REG_IDX_IT:
        k = int(k)
        m = GF.PatternModel.bifactor(spec, cross={k: 1})
        f = m.fit(st.rho, w, x0=np.r_[bif.theta, 0.0])
        V = f.cov(st.Gamma)
        ia = m.names.index(f"ax{k}")
        zc = float(f.theta[ia] / np.sqrt(max(V[ia, ia], 1e-300)))
        iG, iI = m.names.index(f"aG{k}"), m.names.index(f"as{k}")

        def share(t):
            aG, aI, aS = t[iG], t[iI], t[ia]
            return aG ** 2 / (aG ** 2 + aS ** 2 + aI ** 2)

        def ecvk(t):
            return t[iG] ** 2 / (t[iG] ** 2 + t[iI] ** 2)
        g1, g2 = np.zeros(m.npar), np.zeros(m.npar)
        for i in (iG, iI, ia):
            tp, tm = f.theta.copy(), f.theta.copy()
            tp[i] += 1e-6
            tm[i] -= 1e-6
            g1[i] = (share(tp) - share(tm)) / 2e-6
            g2[i] = (ecvk(tp) - ecvk(tm)) / 2e-6
        out["items"][k] = dict(resid_flag=bool(any(flag_by_pair[q] for q in pidx[k])),
                               resid_zmax=float(np.max(np.abs(z[np.isin(allidx, pidx[k])]))),
                               cross=float(f.theta[ia]), cross_z=zc, share=float(share(f.theta)),
                               share_se=float(np.sqrt(max(g1 @ V @ g1, 0))), ecv=float(ecvk(f.theta)),
                               ecv_se=float(np.sqrt(max(g2 @ V @ g2, 0))))
    return out


def x6_task(args):
    ci, cell, rep = args
    A, b, spec, ecv_t, keys = x6_dgp(cell)
    s_data, s_fit = seed("X6", ci, rep).spawn(2)
    t0 = time.perf_counter()
    Fdim = A.shape[1]
    Y, _ = gen.simulate_general(A, b, np.zeros(Fdim), np.eye(Fdim), X6_N, np.random.default_rng(s_data))
    st = F.group_stats(Y, 5, corr_only=True)
    w = 1.0 / np.maximum(np.diag(st.Gamma), 1e-12)
    fits, keep, idx = _x6_fit_all(st.rho, st.Gamma, w, spec, keys, np.random.default_rng(s_fit))
    pairs = fits["bif"].model.pairs
    S_, IT = set(DS.REG_IDX_S.tolist()), set(DS.REG_IDX_IT.tolist())
    mask = np.array([(a in S_ and c in IT) or (a in IT and c in S_) for a, c in pairs])
    mres, z = residual_block_test(fits["bif"], st.Gamma, mask)
    out = dict(cell=cell["id"], rep=rep, resid_mean_ITxS=mres, resid_z_ITxS=z,
               plan_check=x6_plan_check(fits, st, w, spec))
    for nm, f in fits.items():
        G_ = st.Gamma if nm != "ipo" else st.Gamma[np.ix_(idx, idx)]
        V = f.cov(G_)
        out[nm] = dict(ecv=f.ecv(), se=f.ecv_se(V), ident=f.ident_diag(), converged=f.converged,
                       at_bound=bool(np.any(np.abs(f.theta) >= 0.999 * F.A_MAX)), cost=float(f.opt.cost))
        if nm == "mf":
            out[nm]["m"] = f.param("m")
            _, Jm = f.model.implied(f.theta)
            keepc = [i for i, q in enumerate(f.model.names) if q != "m"]
            sv = np.linalg.svd(np.sqrt(f.weights)[:, None] * Jm[:, keepc], compute_uv=False)
            out[nm]["ident_content"] = float(sv[-1] / sv[0])
        if nm == "cross":
            out[nm]["cross"] = [f.param(f"ax{j}") for j in DS.REG_IDX_IT]
    out["time"] = time.perf_counter() - t0
    return _py(out)


def x6_population_task(args):
    """Probability limits: each model fitted to the exact population polychorics with DWLS weights from a
    sample of 60,000 drawn from the same DGP."""
    ci, cell = args
    A, b, spec, ecv_t, keys = x6_dgp(cell)
    Fdim = A.shape[1]
    Y, _ = gen.simulate_general(A, b, np.zeros(Fdim), np.eye(Fdim), 60_000,
                                np.random.default_rng(seed("X6", 999, ci)))
    big = F.group_stats(Y, 5, corr_only=True)
    w = 1.0 / np.maximum(np.diag(big.Gamma), 1e-12)
    _, rho = gen.true_polychoric_general(A, b)
    fits, keep, idx = _x6_fit_all(rho, big.Gamma, w, spec, keys, np.random.default_rng(seed("X6", 998, ci)), starts=5)
    out = dict(cell=cell["id"], ecv_true=ecv_t)
    for nm, f in fits.items():
        out[nm] = dict(ecv=f.ecv(), ident=f.ident_diag(), cost=float(f.opt.cost))
        if nm == "mf":
            out[nm]["m"] = f.param("m")
    mask = np.array([(a in set(DS.REG_IDX_S) and c in set(DS.REG_IDX_IT)) or (a in set(DS.REG_IDX_IT) and c in set(DS.REG_IDX_S))
                     for a, c in fits["bif"].model.pairs])
    out["resid_mean_ITxS"] = float(np.mean((rho - fits["bif"].model.implied(fits["bif"].theta)[0])[mask]))
    if cell["kind"] == "acq":
        out["std_method_loading"] = DS.std_method_loading(A)
    else:
        sdv = np.sqrt(1 + np.sum(A ** 2, axis=1))
        out["std_cross_loading"] = (A[:, 1] / sdv)[DS.REG_IDX_IT]
    return _py(out)


def x6_summary(raw, popl):
    out = {}
    names = DS.reg_names()
    I_all = np.r_[DS.REG_IDX_ID, DS.REG_IDX_IT]
    for ci, cell in enumerate(X6_CELLS):
        rr = [r for r in raw if r["cell"] == cell["id"]]
        if not rr:
            continue
        A, b, spec, ecv_t, keys = x6_dgp(cell)
        pl = popl[cell["id"]]
        z = np.array([r["resid_z_ITxS"] for r in rr])
        rej = z > 1.644854
        d = dict(cell, R=len(rr), n=X6_N, resid_test_reject=prop(rej), resid_mean_ITxS=mc([r["resid_mean_ITxS"] for r in rr]),
                 plim_resid_mean_ITxS=pl["resid_mean_ITxS"], models={})
        for nm in X6_MODELS:
            if nm == "twostage":
                E = np.array([r["cross"]["ecv"] if rj else r["bif"]["ecv"] for r, rj in zip(rr, rej)], float)
                SE = np.array([r["cross"]["se"] if rj else r["bif"]["se"] for r, rj in zip(rr, rej)], float)
                items_all, truth = np.arange(24), ecv_t
                plim = None
            else:
                E = np.array([r[nm]["ecv"] for r in rr], float)
                SE = np.array([r[nm]["se"] for r in rr], float)
                items_all = np.arange(18) if nm == "ipo" else np.arange(24)
                truth = ecv_t[np.r_[DS.REG_IDX_S, DS.REG_IDX_ID]] if nm == "ipo" else ecv_t
                plim = np.asarray(pl[nm]["ecv"]) - truth
            iI = np.arange(10, 18) if nm == "ipo" else I_all
            nm_items = [names[j] for j in (np.r_[DS.REG_IDX_S, DS.REG_IDX_ID] if nm == "ipo" else np.arange(24))]
            err = E - truth[None, :]
            tin = truth[iI] >= TAU
            cls = np.array([bonf_classify(E[r_], SE[r_], iI, tin)[0] for r_ in range(len(rr))])
            tcl = np.where(tin, 1, -1)[None, :]
            lo_hi = [bonf_classify(E[r_], SE[r_], iI, tin) for r_ in range(len(rr))]
            pcov = np.array([(x[2][0] <= truth[iI]) & (truth[iI] <= x[2][1]) for x in lo_hi])
            blocks = dict(S=np.arange(10), ID=np.arange(10, 18))
            if nm != "ipo":
                blocks["IT"] = np.arange(18, 24)
            md = dict(
                bias_by_block={k: float(np.mean(err[:, v])) for k, v in blocks.items()},
                bias_by_item={nm_items[j]: float(err[:, j].mean()) for j in range(len(nm_items))},
                sd_by_item={nm_items[j]: float(err[:, j].std(ddof=1)) for j in range(len(nm_items))},
                rmse_I=rmse(err[:, iI].ravel()),
                maxabs_bias_I=float(np.max(np.abs(err[:, iI].mean(axis=0)))),
                plim_bias_by_block=({k: float(np.mean(plim[v])) for k, v in blocks.items()} if plim is not None else None),
                plim_bias_by_item=({nm_items[j]: float(plim[j]) for j in range(len(nm_items))} if plim is not None else None),
                plim_maxabs_bias_I=(float(np.max(np.abs(plim[iI]))) if plim is not None else None),
                cover_pointwise_I=prop(pcov.ravel()),
                p_correct=prop((cls == tcl).ravel()), p_wrong=prop((cls == -tcl).ravel()), p_indet=prop((cls == 0).ravel()),
                p_false_in=prop((cls[:, ~tin] == 1).ravel()), p_false_out=prop((cls[:, tin] == -1).ravel()),
                p_any_wrong=prop(np.any(cls == -tcl, axis=1)),
                false_in_by_item={nm_items[j]: prop(cls[:, q] == 1)["p"] for q, j in enumerate(iI) if not tin[q]},
                in_by_item={nm_items[j]: prop(cls[:, q] == 1)["p"] for q, j in enumerate(iI)})
            if nm != "twostage":
                md["ident"] = mc([r[nm]["ident"] for r in rr])
                md["converged"] = prop([r[nm]["converged"] for r in rr])
                md["at_bound"] = prop([r[nm]["at_bound"] for r in rr])
                md["plim_ident"] = pl[nm]["ident"]
            if nm == "mf":
                md["m"] = mc([r["mf"]["m"] for r in rr])
                md["ident_content"] = mc([r["mf"]["ident_content"] for r in rr])
                md["plim_m"] = pl["mf"]["m"]
            d["models"][nm] = md
        # the plan's pre-registered check (sec:design-decisions): flag, then classify a flagged IT item only if
        # the primary model and the one-item cross-loading model (G share) agree; Bonferroni z over the 14 I items
        from scipy.stats import norm
        zb = norm.ppf(1 - 0.05 / (2 * len(I_all)))
        IT = DS.REG_IDX_IT
        tin_IT = ecv_t[IT] >= TAU
        flag = np.array([[r["plan_check"]["items"][str(k)]["resid_flag"] or abs(r["plan_check"]["items"][str(k)]["cross_z"]) > 1.959964
                          for k in IT] for r in rr])
        rflag = np.array([[r["plan_check"]["items"][str(k)]["resid_flag"] for k in IT] for r in rr])
        xflag = np.array([[abs(r["plan_check"]["items"][str(k)]["cross_z"]) > 1.959964 for k in IT] for r in rr])
        c1 = np.array([bonf_classify(np.asarray(r["bif"]["ecv"]), np.asarray(r["bif"]["se"]), I_all, None)[0][-len(IT):]
                       for r in rr])
        c2 = []
        for r in rr:
            row = []
            for k in IT:
                it = r["plan_check"]["items"][str(k)]
                e = min(max(it["share"], 1e-6), 1 - 1e-6)
                sl = it["share_se"] / (e * (1 - e))
                lg = np.log(e / (1 - e))
                lo, hi = 1 / (1 + np.exp(-(lg - zb * sl))), 1 / (1 + np.exp(-(lg + zb * sl)))
                row.append(1 if lo >= TAU else (-1 if hi < TAU else 0))
            c2.append(row)
        c2 = np.array(c2)
        final = np.where(flag, np.where(c1 == c2, c1, 0), c1)
        tcl = np.where(tin_IT, 1, -1)[None, :]
        nmIT = [names[j] for j in IT]
        d["plan_check"] = dict(
            flag_by_item={nmIT[q]: prop(flag[:, q]) for q in range(len(IT))},
            resid_flag_by_item={nmIT[q]: prop(rflag[:, q]) for q in range(len(IT))},
            cross_flag_by_item={nmIT[q]: prop(xflag[:, q]) for q in range(len(IT))},
            p_any_IT_flagged=prop(np.any(flag, axis=1)),
            n_pairs_flagged=mc([r["plan_check"]["n_pairs_flagged"] for r in rr]),
            IT_primary=dict(p_correct=prop((c1 == tcl).ravel()), p_wrong=prop((c1 == -tcl).ravel()),
                            p_false_in=prop((c1[:, ~tin_IT] == 1).ravel())),
            IT_plan=dict(p_correct=prop((final == tcl).ravel()), p_wrong=prop((final == -tcl).ravel()),
                         p_false_in=prop((final[:, ~tin_IT] == 1).ravel()), p_indet=prop((final == 0).ravel())),
            false_in_by_item_primary={nmIT[q]: prop(c1[:, q] == 1)["p"] for q in range(len(IT)) if not tin_IT[q]},
            false_in_by_item_plan={nmIT[q]: prop(final[:, q] == 1)["p"] for q in range(len(IT)) if not tin_IT[q]},
            share_bias_vs_ecv_by_item={nmIT[q]: float(np.mean([r["plan_check"]["items"][str(k)]["share"] for r in rr]) - ecv_t[k])
                                       for q, k in enumerate(IT)},
            ecv1_bias_by_item={nmIT[q]: float(np.mean([r["plan_check"]["items"][str(k)]["ecv"] for r in rr]) - ecv_t[k])
                               for q, k in enumerate(IT)})
        d["true_ecv"] = {names[j]: float(ecv_t[j]) for j in range(24)}
        d["std_extra_loading"] = pl.get("std_method_loading") or pl.get("std_cross_loading")
        d["time_mean"] = float(np.mean([r["time"] for r in rr]))
        out[cell["id"]] = d
    return out


# =============================================================================
# X7: the revised DIF screen (Benjamini-Hochberg only), end to end, on the X2 data sets
# =============================================================================
X7_ANCHOR_SETS = ("correct", "contam1", "contam2")


def x7_task(args):
    kappa, rep = args
    b0, b1 = DS.x2_banks(kappa)
    J = b0.J
    rng = np.random.default_rng(seed("X2", int(round(kappa * 100)), rep))      # the X2 data set (same seed)
    t0 = time.perf_counter()
    Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.X2_MU1], [np.eye(3), np.eye(3)],
                           [X2_N_PER_GROUP, X2_N_PER_GROUP], rng)
    st = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
    res = dict(kappa=kappa, rep=rep)
    for nm in X7_ANCHOR_SETS:
        pr = D.dif_procedure(st, b0.spec, 4, DS.X2_ANCHORS[nm], es_min=-1.0)      # flag = BH-significant
        res[nm] = _x2_fit_summary(pr["final"])
        res[nm + "_tests"] = dict(tested=pr["tested"], p=pr["p"], sig=pr["sig"], flagged=pr["flagged"],
                                  es_mean=pr["es"], es_avg=D.effect_size_avg(pr["fb"], pr["tested"]))
    res["time"] = time.perf_counter() - t0
    return _py(res)


def x7_summary(raw, raw_x2):
    out = {}
    for kappa in X2_KAPPA:
        rr = [r for r in raw if abs(r["kappa"] - kappa) < 1e-9]
        if not rr:
            continue
        b0, b1 = DS.x2_banks(kappa)
        cell = dict(R=len(rr), kappa=kappa)
        x2 = {r["rep"]: r for r in raw_x2 if abs(r["kappa"] - kappa) < 1e-9}
        for nm in X7_ANCHOR_SETS:
            d = {}
            for fac, fn in enumerate(("G", "S", "I")):
                est = np.array([r[nm]["mu_" + fn] for r in rr], float)
                se = np.array([r[nm]["se_" + fn] for r in rr], float)
                err = est - DS.X2_MU1[fac]
                cov = np.where(np.isfinite(se), (np.abs(err) <= 1.959964 * se).astype(float), np.nan)
                d["mu_" + fn] = dict(bias=mc(err), rmse=rmse(err), cover=prop(cov))
            j3 = DS.X2_NONUNIFORM[0]
            for gg, bk, key in ((0, b0, "ecv0"), (1, b1, "ecv1_std")):
                e = np.array([r[nm][key][j3] for r in rr]) - bk.ecv()[j3]
                d[f"ecv{gg}_I3"] = dict(true=bk.ecv()[j3], bias=mc(e), rmse=rmse(e))
            # I3 not flagged: conditional bias
            tests = [r[nm + "_tests"] for r in rr]
            tested = tests[0]["tested"]
            fl3 = np.array([j3 in t["flagged"] for t in tests])
            e1 = np.array([r[nm]["ecv1_std"][j3] for r in rr]) - b1.ecv()[j3]
            d["ecv1_I3_bias_if_not_flagged"] = mc(e1[~fl3]) if (~fl3).any() else None
            d["ecv1_I3_bias_if_flagged"] = mc(e1[fl3]) if fl3.any() else None
            per = {}
            for ii, j in enumerate(tested):
                flag = np.array([j in t["flagged"] for t in tests])
                esa = np.array([t["es_avg"][ii] for t in tests])
                per[b0.names[j]] = dict(dif_true=bool(j in DS.X2_TRUE_DIF and kappa > 0), flag=prop(flag),
                                        es_avg_mean=float(esa.mean()),
                                        small_if_flagged=prop((esa[flag] < 0.25)) if flag.any() else None)
            clean = [k for k, v in per.items() if not v["dif_true"]]
            difi = [k for k, v in per.items() if v["dif_true"]]
            d["flags"] = per
            d["fpr"] = float(np.mean([per[c]["flag"]["p"] for c in clean])) if clean else None
            d["power"] = float(np.mean([per[c]["flag"]["p"] for c in difi])) if difi else None
            d["any_false_flag"] = prop([any(b0.names[j] in clean for j in t["flagged"]) for t in tests])
            # consistency with X2: the free-baseline tests are the same computation on the same data
            same = [np.array_equal(np.asarray(r[nm + "_tests"]["sig"], bool), np.asarray(x2[r["rep"]][nm + "_tests"]["sig"], bool))
                    for r in rr if r["rep"] in x2]
            d["bh_flags_identical_to_X2"] = float(np.mean(same)) if same else None
            cell[nm] = d
        out[str(kappa)] = cell
    return out


# =============================================================================
# X8: identification of the threshold shift delta_j by the list experiment (prop:list-irt(b),(c))
# =============================================================================
X8_ITEM = 11                      # I4 of the X1 six-item bank (ECV 0.60)
X8_CSTAR = 3                      # agreement = top two of five categories
X8_MUS = (np.zeros(3), np.array([0.5, 0.0, 0.3]))
X8_N_PER_GROUP = 3000
X8_CELLS = (dict(id="uniform", delta_sd=(0.4, 0.4), upsilon=1.0),
            dict(id="group_specific", delta_sd=(0.4, 0.8), upsilon=1.0),
            dict(id="nonuniform", delta_sd=(0.4, 0.4), upsilon=0.5))


def x8_task(args):
    ci, cell, reps = args
    bank = DS.x1_bank(6)
    rows = []
    for rep in reps:
        t0 = time.perf_counter()
        dat = LI.simulate(bank, X8_ITEM, X8_CSTAR, X8_MUS, (X8_N_PER_GROUP, X8_N_PER_GROUP), cell["delta_sd"],
                          np.random.default_rng(seed("X8", ci, rep)), upsilon=cell["upsilon"])
        r = LI.estimate(dat, bank.spec, X8_ITEM, X8_CSTAR)
        r.update(cell=cell["id"], rep=rep, time=time.perf_counter() - t0)
        rows.append(_py(r))
    return rows


def x8_summary(raw):
    bank = DS.x1_bank(6)
    out = {}
    for cell in X8_CELLS:
        rr = [r for r in raw if r["cell"] == cell["id"]]
        if not rr:
            continue
        tr = LI.truth(bank, X8_ITEM, X8_CSTAR, X8_MUS, cell["delta_sd"])
        sdj = tr["sdj"]
        d = dict(cell, R=len(rr), n_per_group=X8_N_PER_GROUP, sd_j=sdj, truth={str(x): tr[x] for x in (0, 1)},
                 b_private=tr["b_private"])
        for x in (0, 1):
            est = np.array([r[f"delta_{x}"] for r in rr])
            se = np.array([r[f"delta_se_{x}"] for r in rr])
            dd = dict(sd_scale=dict(bias=mc((est - tr[x]["delta"]) / sdj), sd=float(np.std(est / sdj, ddof=1)),
                                    se_mean=float(np.mean(se / sdj))),
                      cover=prop(np.abs(est - tr[x]["delta"]) <= 1.959964 * se),
                      se_meas_share=float(np.mean(np.array([r[f"delta_se_meas_{x}"] for r in rr]) ** 2 / se ** 2)),
                      b_private_bias=mc(np.array([r[f"b_private_{x}"] for r in rr]) - tr["b_private"]),
                      sdb_bias=mc(np.array([r[f"sdb_{x}"] for r in rr]) - tr[x]["sdb"]),
                      sdb_sd=float(np.std([r[f"sdb_{x}"] for r in rr], ddof=1)),
                      pi_bias=mc(np.array([r[f"pi_{x}"] for r in rr]) - tr[x]["pi"]),
                      piD_model_bias=mc(np.array([r[f"piD_model_{x}"] for r in rr]) - tr[x]["piD"]),
                      p_negative_root=prop(est < 0))
            d[f"group{x}"] = dd
        z = np.array([r["z_common"] for r in rr])
        d["test_common_reject"] = prop(np.abs(z) > 1.959964)
        pooled = np.array([r["delta_pooled"] for r in rr])
        pse = np.array([r["delta_pooled_se"] for r in rr])
        if cell["delta_sd"][0] == cell["delta_sd"][1] and cell["upsilon"] == 1.0:
            dl = tr[0]["delta"]
            d["pooled"] = dict(bias_sd=mc((pooled - dl) / sdj), sd_sd=float(np.std(pooled / sdj, ddof=1)),
                               cover=prop(np.abs(pooled - dl) <= 1.959964 * pse))
        d["converged"] = prop([r["converged"] for r in rr])
        out[cell["id"]] = d
    return out


# =============================================================================
# X9: tests of within-domain heterogeneity for D2(ii) at the registered sizes
# =============================================================================
X9_CFGS = ("prop", "one_off", "two_off", "near", "het")
X9_NULL = ("prop", "one_off")
X9_N = (1500, 6000)
X9_NT = TT.n_tetrads([10, 14])


def x9_task(args):
    from attsim.polychoric import all_pairs
    ci, cfg, n, reps = args
    bank = DS.x9_bank(cfg)
    rows = []
    for rep in reps:
        rng = np.random.default_rng(seed("X9", ci, n, rep))
        Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [n], rng)
        row = dict(cfg=cfg, n=n, rep=rep)
        for nm, idx in (("S", DS.REG_IDX_S), ("I", np.r_[DS.REG_IDX_ID, DS.REG_IDX_IT])):
            st = F.group_stats(Y[:, idx], 5, corr_only=True)
            Jd = len(idx)
            pairs = all_pairs(Jd)
            R = TT.corr_matrix(st.rho, pairs, Jd)
            PI = TT.pair_index(pairs, Jd)
            allj = np.arange(Jd)
            sj, dfj, pj = TT.proportionality_test(R, st.Gamma, PI, allj)
            sr, dfr, pr_ = TT.onefactor_residual_test(st.rho, st.Gamma, pairs, Jd)
            iut = TT.iut_domain(R, st.Gamma, PI, allj)
            brej, bz = TT.bonferroni_single(R, st.Gamma, PI, allj, X9_NT)
            row[nm] = dict(p_joint=pj, stat_joint=sj, df_joint=dfj, p_resid=pr_, p_iut=iut["p_iut"],
                           n_loo_reject=int(np.sum(iut["p_loo"] < 0.05)), bonf_reject=bool(brej), bonf_zmax=bz)
        rows.append(_py(row))
    return rows


def x9_summary(raw):
    out = {}
    for cfg in X9_CFGS:
        for n in X9_N:
            rr = [r for r in raw if r["cfg"] == cfg and r["n"] == n]
            if not rr:
                continue
            d = dict(cfg=cfg, n=n, R=len(rr), null=cfg in X9_NULL, ecv=dict(zip(("S", "I"), [list(v) for v in DS.X9_CONFIGS[cfg]])))
            for dom in ("S", "I"):
                pj = np.array([r[dom]["p_joint"] for r in rr])
                pr_ = np.array([r[dom]["p_resid"] for r in rr])
                pi_ = np.array([r[dom]["p_iut"] for r in rr])
                d[dom] = dict(joint=prop(pj < 0.05), joint_01=prop(pj < 0.01), resid=prop(pr_ < 0.05), iut=prop(pi_ < 0.05),
                              bonf=prop([r[dom]["bonf_reject"] for r in rr]), df_joint=rr[0][dom]["df_joint"],
                              mean_loo_reject=mc([r[dom]["n_loo_reject"] for r in rr]))
            # D2(ii): heterogeneity in at least one domain; alpha/2 per domain for the joint and IUT tests,
            # the earlier rule over all 3,633 tetrads at 0.05
            pjS, pjI = (np.array([r[dm]["p_joint"] for r in rr]) for dm in ("S", "I"))
            piS, piI = (np.array([r[dm]["p_iut"] for r in rr]) for dm in ("S", "I"))
            d["D2ii"] = dict(joint=prop((pjS < 0.025) | (pjI < 0.025)), iut=prop((piS < 0.025) | (piI < 0.025)),
                             bonf=prop([r["S"]["bonf_reject"] or r["I"]["bonf_reject"] for r in rr]))
            out[f"{cfg}_n{n}"] = d
    return out


# =============================================================================
# driver
# =============================================================================
def versions():
    return dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                matplotlib=matplotlib.__version__, platform=platform.platform())


def code_hashes():
    files = ["run_experiments.py"] + sorted(os.path.join("attsim", f) for f in os.listdir(os.path.join(HERE, "attsim"))
                                            if f.endswith(".py"))
    out = {}
    for f in files:
        with open(os.path.join(HERE, f), "rb") as fh:
            out[f] = hashlib.sha256(fh.read()).hexdigest()[:16]
    return out


CODE_HASHES = code_hashes()          # taken at import, i.e. the code this process actually runs


def chunks(seq, k):
    seq = list(seq)
    return [seq[i:i + k] for i in range(0, len(seq), k)]


def run(pool, fn, tasks, log, label):
    t0 = time.perf_counter()
    out = []
    for i, r in enumerate(pool.map(fn, tasks)):
        out.append(r)
        if (i + 1) % max(1, len(tasks) // 10) == 0:
            log(f"  {label}: {i + 1}/{len(tasks)} tasks, {time.perf_counter() - t0:.0f}s")
    return out, time.perf_counter() - t0


EXPERIMENT_NAME_NOTE = ("Experiments are labelled X1-X9 (X1b, X2b). X1-X5 were labelled E1-E5 (E1b) in the first run of "
                        "2026-11-03 and were renamed on 2026-11-03 to avoid a clash with the estimands (E1)-(E9) of "
                        "sec:design-estimands; their seeds (experiment indices 1-5), configurations and results are "
                        "unchanged. Mapping: E1->X1, E1b->X1b, E2->X2, E3->X3, E4->X4, E5->X5.")


def migrate_names(out_dir):
    """Rename E1-E5 to X1-X5 in sim_results.json and results/raw (keys, raw files); values untouched."""
    jpath = os.path.join(out_dir, "sim_results.json")
    with open(jpath) as f:
        res = json.load(f)
    exps = {}
    for k, v in res["experiments"].items():
        new = RENAME.get(k, k)
        if new != k:
            v["renamed_from"] = k
            if isinstance(v.get("description"), str):
                v["description"] = v["description"].replace("As E1 for", "As X1 for")
            src, dst = os.path.join(out_dir, "raw", f"{k}.json"), os.path.join(out_dir, "raw", f"{new}.json")
            if os.path.exists(src) and not os.path.exists(dst):
                os.rename(src, dst)
        exps[new] = v
    res["experiments"] = exps
    meta = res.get("meta", {})
    if "runtime_by_experiment" in meta:
        meta["runtime_by_experiment"] = {RENAME.get(k, k): v for k, v in meta["runtime_by_experiment"].items()}
    if "last_run" in meta and "which" in meta["last_run"]:
        meta["last_run"]["which"] = [RENAME.get(k, k) for k in meta["last_run"]["which"]]
    meta["experiment_names"] = EXPERIMENT_NAME_NOTE
    meta["description"] = "Simulation study for 'Where Does Criticism End?' (synthetic data only; no real survey data)."
    res["meta"] = meta
    with open(jpath, "w") as f:
        json.dump(res, f, indent=1)
    print("migrated", list(exps))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--out", default=RESULTS)
    ap.add_argument("--reuse-raw", nargs="*", default=[],
                    help="for these experiments (X1b only), reuse results/raw/<E>.json instead of re-running")
    ap.add_argument("--migrate-names", action="store_true",
                    help="one-off: rename experiments E1-E5 (first run) to X1-X5 in results/ (keys and raw files)")
    ap.add_argument("--resummarize", nargs="*", default=None,
                    help="recompute the summaries of these experiments (X1, X1b) from results/raw with the current code")
    args = ap.parse_args()
    q = args.quick
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    logf = open(os.path.join(args.out, "run_log.txt"), "a")

    def log(msg):
        line = time.strftime("%H:%M:%S ") + msg
        print(line, flush=True)
        logf.write(line + "\n")
        logf.flush()

    which = args.only or ["X1", "X1b", "X2", "X3", "X4", "X5", "X2b", "X6", "X7", "X8", "X9"]
    if args.migrate_names:
        migrate_names(args.out)
        return
    if args.resummarize:
        with open(os.path.join(args.out, "sim_results.json")) as f:
            res = json.load(f)
        for e in args.resummarize:
            with open(os.path.join(args.out, "raw", f"{e}.json")) as f:
                raw = json.load(f)
            if e == "X2":
                res["experiments"][e]["summary"] = x2_summary(raw, res["experiments"][e]["population"])
            elif e == "X2b":
                popl = x2b_population()
                res["experiments"][e]["population"] = popl
                res["experiments"][e]["config"]["delta_max"] = X2B_DELTA_MAX
                res["experiments"][e]["summary"] = x2b_summary(raw, popl)
            elif e == "X6":
                res["experiments"][e]["summary"] = x6_summary(raw, res["experiments"][e]["population"])
                res["experiments"][e]["config"]["ecv_ID"] = res["experiments"][e]["config"].pop("ecv_IP", DS.REG_ECV_ID)
                res["experiments"][e]["description"] = res["experiments"][e]["description"].replace(
                    "10 S, 8 IP, 6 IT", "10 S, 8 ID, 6 IT").replace("S2, S7, IP2, IP6", "S2, S7, ID2, ID6").replace(
                    "I = IP only", "I = ID only")
            elif e == "X7":
                with open(os.path.join(args.out, "raw", "X2.json")) as f2:
                    res["experiments"][e]["summary"] = x7_summary(raw, json.load(f2))
            elif e == "X8":
                res["experiments"][e]["summary"] = x8_summary(raw)
            elif e == "X9":
                res["experiments"][e]["summary"] = x9_summary(raw)
            else:
                res["experiments"][e]["summary"] = x1_summary(raw, res["experiments"][e]["truth"])
            res["experiments"][e]["summary_recomputed"] = dict(
                when=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), code_sha256_16=CODE_HASHES,
                note="summary recomputed from raw/%s.json with the code hashed here; the replications themselves "
                     "were produced by the code in code_sha256_16" % e)
        with open(os.path.join(args.out, "sim_results.json"), "w") as f:
            json.dump(_py(res), f, indent=1)
        print("resummarized", args.resummarize)
        return
    R = dict(X1_id=4 if q else 100, X1_nonid=3 if q else 50, X1_nonid_p=3 if q else 40, X1_B=20 if q else 100,
             X2=3 if q else 100, X2_loo=2 if q else 100, X1b=3 if q else 40,
             X3=50 if q else 2000, X3_sweep=50 if q else 1000,
             X4=5 if q else 200, X5_configs=20 if q else X5_CONFIGS, X5_fs=10 if q else X5_FS_R,
             X2b=2 if q else 100, X6=2 if q else 100, X8=6 if q else 300, X9_6000=6 if q else 400,
             X9_small=6 if q else 200)
    jpath = os.path.join(args.out, "sim_results.json")
    if os.path.exists(jpath) and args.only:
        with open(jpath) as f:
            res = json.load(f)
    else:
        res = dict(meta={}, experiments={})
    t_all = time.perf_counter()
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def save(res_):
        """Write the JSON after every experiment (code hashes stamped), so a later failure loses nothing."""
        for e_ in which:
            if e_ in res_["experiments"]:
                res_["experiments"][e_]["code_sha256_16"] = CODE_HASHES
                res_["experiments"][e_]["run_started"] = started
        with open(jpath, "w") as fh:
            json.dump(_py(res_), fh, indent=1)
    log(f"start {started} quick={q} workers={args.workers} which={which}")
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        if "X1" in which:
            truth = {c: _py(x1_truth(c)) for c in X1_CONFIGS}
            tasks = []
            for cfg in X1_CONFIGS:
                Rc = R["X1_id"] if cfg in ("I6", "I3") else (R["X1_nonid"] if cfg == "I2" else R["X1_nonid_p"])
                for n in X1_N:
                    for rep in range(Rc):
                        tasks.append((cfg, n, rep, R["X1_B"]))
            tasks.sort(key=lambda t: -t[1])           # big-n tasks first
            raw, wall = run(pool, x1_task, tasks, log, "X1")
            res["experiments"]["X1"] = dict(
                description="Recovery of loadings, item-level ECV, boundary set (tau=0.5) and S-I correlation; "
                            "single group, bifactor DGP (probit GRM), DWLS on polychorics, bootstrap percentile "
                            "and logit-Wald (sandwich) 95% intervals.",
                config=dict(n=X1_N, configs={k: dict(n_I=v[0], proportional_S=v[1]) for k, v in X1_CONFIGS.items()},
                            tau=TAU, B=R["X1_B"], n_starts=5, R=dict(I6=R["X1_id"], I3=R["X1_id"], I2=R["X1_nonid"],
                                                                        I3p=R["X1_nonid_p"]),
                            ecv_S=DS.ECV_S, h2_S=DS.H2_S, ecv_I=DS.ECV_I, h2_I=DS.H2_I,
                            ecv_S_prop=DS.ECV_S_PROP, h2_S_prop=DS.H2_S_PROP),
                seeds="data: SeedSequence([base, 1, cfg_index, n, rep]).spawn(2)[0]; bootstrap: .spawn(2)[1]",
                truth=truth, summary=x1_summary(raw, truth), wall_seconds=wall,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            with open(os.path.join(args.out, "raw", "X1.json"), "w") as f:
                json.dump(raw, f)
            log(f"X1 done in {wall:.0f}s")
        if "X1b" in which:
            t0 = time.perf_counter()
            truth = {c: _py(x1_truth(c)) for c in X1B_CONFIGS}
            tasks = [(cfg, n, rep, R["X1_B"]) for cfg in X1B_CONFIGS for n in X1_N for rep in range(R["X1b"])]
            tasks.sort(key=lambda t: -t[1])
            if "X1b" in args.reuse_raw:
                with open(os.path.join(args.out, "raw", "X1b.json")) as f:
                    raw = json.load(f)
                wall = float(sum(r["time"] for r in raw)) / args.workers   # approximate; see run_log.txt
                log(f"X1b: reused {len(raw)} raw replications from raw/X1b.json")
            else:
                raw, wall = run(pool, x1_task, tasks, log, "X1b")
                with open(os.path.join(args.out, "raw", "X1b.json"), "w") as f:
                    json.dump(raw, f)
            res["experiments"]["X1b"] = dict(
                description="As X1 for a design close to proportionality (rem:id-heterogeneity): S-block ECVs "
                            "0.65-0.75 (common communality 0.55), n_I = 3, so Assumption id-het holds only "
                            "weakly in S and fails in I.",
                config=dict(n=X1_N, configs={k: dict(n_I=v[0], S_block=v[1]) for k, v in X1B_CONFIGS.items()},
                            ecv_S=ECV_S_NEAR, h2_S=DS.H2_S_PROP, ecv_I=DS.ECV_I[:3], tau=TAU, B=R["X1_B"],
                            n_starts=5, R=R["X1b"]),
                seeds="data: SeedSequence([base, 1, 4, n, rep]).spawn(2)[0]; bootstrap: .spawn(2)[1]",
                truth=truth, summary=x1_summary(raw, truth), wall_seconds=wall,
                cpu_seconds=float(sum(r["time"] for r in raw)),
                raw_reused="X1b" in args.reuse_raw)
            if "X1b" in args.reuse_raw:
                res["experiments"]["X1b"]["note"] = ("replications computed in a run started 2026-11-03T22:11:23Z (wall 101 s, "
                                                    "see run_log.txt) that crashed later in the X2 summary; raw reused")
            save(res)
            log(f"X1b done in {time.perf_counter() - t0:.0f}s")
        if "X2" in which:
            t0 = time.perf_counter()
            popl = x2_population()
            tasks = [(kappa, rep, kappa == X2_MAIN_KAPPA and rep < R["X2_loo"])
                     for kappa in X2_KAPPA for rep in range(R["X2"])]
            raw, wall = run(pool, x2_task, tasks, log, "X2")
            with open(os.path.join(args.out, "raw", "X2.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X2"] = dict(
                description="Two groups (n=1500 each), DIF on Israel-related items I1, I2 (uniform) and I3 "
                            "(non-uniform); focal-group latent means (G,S,I) = (0.3, 0, 0.3); strategies: naive "
                            "(full invariance), oracle (true DIF items free), free-baseline with anchor sets "
                            "(correct, contam1, contam2) and the pre-registered procedure (Wald + BH q=0.05 + "
                            "expected-score effect size >= 0.25, then refit); stereotype-only anchors S1-S4 with "
                            "mu_I, sigma_I fixed (rem:id-anchor-S). Naive = concurrent calibration with equal group "
                            "sizes (rem:id-concurrent). Focal ECV per def:boundary (with focal factor variances).",
                config=dict(kappa=X2_KAPPA, main_kappa=X2_MAIN_KAPPA, n_per_group=X2_N_PER_GROUP, mu1=DS.X2_MU1,
                            uniform=DS.X2_UNIFORM, nonuniform=DS.X2_NONUNIFORM, anchors=DS.X2_ANCHORS,
                            R=R["X2"], R_loo=R["X2_loo"], q_fdr=0.05, es_min=0.25, s_anchors=X2_S_ANCHORS,
                            item_names=DS.x1_bank(6).names),
                seeds="SeedSequence([base, 2, round(100 kappa), rep]); population weights: [base, 2, 999, round(100 kappa)]",
                population=popl, summary=x2_summary(raw, popl), checks=x2_checks(),
                wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"X2 done in {time.perf_counter() - t0:.0f}s")
        if "X3" in which:
            t0 = time.perf_counter()
            tasks = []
            for ci, cell in enumerate(x3_cells()):
                Rc = R["X3"] if cell["part"] in ("A", "B") else R["X3_sweep"]
                for ch in chunks(range(Rc), 250):
                    tasks.append((ci, cell, ch))
            raw_nested, wall = run(pool, x3_task, tasks, log, "X3")
            raw = [x for ch in raw_nested for x in ch]
            with open(os.path.join(args.out, "raw", "X3.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X3"] = dict(
                description="One sensitive item, threshold-shift model of social desirability (def:le-shift, "
                            "normal ogive): pi = 0.30, pi^D = 0.20 (SDB = 0.10) unless false endorsement phi > 0. "
                            "Part A: split design, equal vs Neyman (thm:design(a)) vs pilot plug-in allocation; "
                            "SDB_S (eq:le-split) and a covariate-adjusted version. Part B: paired design "
                            "(thm:joint-sdb(b),(c)), post-stratified SDB_PS and combined eta-hat, under monotonicity "
                            "(phi = 0) and false endorsement (phi = 0.02), vs the split design. Part C: control-list "
                            "menu J in 2..6, binary within-pair correlation rho in {0, -0.6}, floor/ceiling "
                            "probability kc = kf in {0, 0.5} (thm:design(c),(d)).",
                config=dict(n=X3_N, pi=X3_PI, pi_d_shift=X3_PID, sdb=X3_PI - X3_PID, a_sensitive=X3_A,
                            phi_nonmonotone=X3_PHI, score_reliability=X3_REL, n_pilot=X3_PILOT, costs="equal",
                            control_prevalence=0.5, cells=x3_cells(), R_AB=R["X3"], R_C=R["X3_sweep"],
                            mse_n=X3_MSE_N),
                seeds="SeedSequence([base, 3, cell_index, rep])",
                summary=x3_summary(raw), wall_seconds=wall)
            save(res)
            log(f"X3 done in {time.perf_counter() - t0:.0f}s")
        if "X4" in which:
            t0 = time.perf_counter()
            tasks = [(n, ch) for n in X4_N for ch in chunks(range(R["X4"]), 25)]
            raw_nested, wall = run(pool, x4_task, tasks, log, "X4")
            raw = [x for ch in raw_nested for x in ch]
            with open(os.path.join(args.out, "raw", "X4.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X4"] = dict(
                description="MRP of the area mean of G (50 areas, 32 demographic cells per area, differential "
                            "non-response by age and education); score y = theta_G + N(0, s_m^2) (conditionally "
                            "unbiased); MRP = REML random-intercept model on y + poststratification (eq:mrp), which "
                            "in this Gaussian setting is the latent regression with measurement error integrated "
                            "out; two-step EAP = the same MRP on posterior-mean scores under one common prior "
                            "(prop:eap); direct = area sample mean (unweighted and national cell-weighted). A new "
                            "population is drawn in every replication.",
                config=dict(n=X4_N, A=X4_A, s_m=X4_SM, population=dict(total=10_000_000, size_sd=1.0, s_u=0.2,
                                                                         gamma=0.25, s_w=0.85), R=R["X4"],
                            bins=X4_BINS[:-1]),
                seeds="population: SeedSequence([base, 4, n, rep]).spawn(2)[0]; sample: .spawn(2)[1]",
                summary=x4_summary(raw), wall_seconds=wall)
            save(res)
            log(f"X4 done in {time.perf_counter() - t0:.0f}s")
        if "X5" in which:
            t0 = time.perf_counter()
            k_list = (2, 4, 6)
            tasks = [(s, d, k_list, R["X5_configs"]) for s in X5_S_DIF for d in X5_DELTA]
            raw, wall = run(pool, x5_task, tasks, log, "X5")
            nu_tasks = [(sa, 0.1, R["X5_configs"]) for sa in X5_SA]
            raw_nu, wall3 = run(pool, x5_nonuniform_task, nu_tasks, log, "X5nu")
            wall += wall3
            fs_tasks = [(s, 0.1, ch) for s in (0.0, 0.3) for ch in chunks(range(R["X5_fs"]), 100)]
            raw_fs_n, wall2 = run(pool, x5_fs_task, fs_tasks, log, "X5fs")
            merged = {}
            for r in raw_fs_n:
                key = (r["s_dif"], r["delta"])
                merged.setdefault(key, dict(s_dif=r["s_dif"], delta=r["delta"], rows=[]))["rows"] += r["rows"]
            raw_fs = list(merged.values())
            res["experiments"]["X5"] = dict(
                description="Population index P(agree with >= k of 8 S items) by group vs the latent mean "
                            "difference delta of G; random uniform DIF b_j^(1) = b_j^(0) + N(0, s^2) sd_j on the S "
                            "items; reversal = sign(index difference) != sign(delta). Exact (quadrature) for "
                            f"{R['X5_configs']} random configurations per (s, |delta|); finite-sample check with n = "
                            f"{X5_FS_N} per group.",
                config=dict(s_dif=X5_S_DIF, delta=X5_DELTA, k=k_list, k_main=X5_K, configs=R["X5_configs"],
                            agree="Y >= 3 (top two of five categories)", fs_n=X5_FS_N, fs_R=R["X5_fs"]),
                seeds="SeedSequence([base, 5, round(100 s), round(100 |delta|)]); finite sample [base, 5, 500 + round(100 s), round(100 delta), rep]",
                summary=x5_summary(raw, raw_fs, k_list, R["X5_configs"]), wall_seconds=wall + wall2,
                variance=_py(x5_variance()), nonuniform=x5_nonuniform_summary(raw_nu), checks=x5_checks())
            res["experiments"]["X5"]["config"].update(sigma1=X5_SIGMA1, s_a=X5_SA, delta_nonuniform=0.1)
            with open(os.path.join(args.out, "raw", "X5.json"), "w") as f:
                json.dump(dict(population=raw, finite_sample=raw_fs, nonuniform=raw_nu), f)
            save(res)
            log(f"X5 done in {time.perf_counter() - t0:.0f}s")
        if "X2b" in which:
            t0 = time.perf_counter()
            popl = x2b_population()
            tasks = [(ki, ks, rep) for ki in X2B_KAPPA_I for ks in X2B_KAPPA_S for rep in range(R["X2b"])]
            raw, wall = run(pool, x2b_task, tasks, log, "X2b")
            with open(os.path.join(args.out, "raw", "X2b.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X2b"] = dict(
                description="As X2 (two groups of 1500, focal latent means (0.3, 0, 0.3)), with ideology-type uniform DIF "
                            "on two of the four stereotype anchors (S1, S2: thresholds lowered by kappa_S latent-response "
                            "SDs in the focal group), with (kappa_I = 0.4) or without (kappa_I = 0) the X2 DIF on I1-I3. "
                            "Strategies: oracle (all DIF-free items as anchors), default anchors S1-S4, I5, I6 (free "
                            "baseline, and the revised BH-only screen + refit), stereotype-only anchors S1-S4 (mu_I, "
                            "sigma_I fixed). Leave-one-anchor-out spread of mu_G for both anchor sets. Population: "
                            "probability limits and the first-order bias and bound eq:id-anchor-bound with W the "
                            "efficient information of the anchors' focal intercepts for the DWLS estimator.",
                config=dict(kappa_I=X2B_KAPPA_I, kappa_S=X2B_KAPPA_S, s_dif_items=DS.X2B_S_DIF_ITEMS,
                            default_anchors=X2B_DEFAULT, s_anchors=X2_S_ANCHORS, n_per_group=X2_N_PER_GROUP,
                            mu1=DS.X2_MU1, R=R["X2b"], delta_max=X2B_DELTA_MAX, q_fdr=0.05),
                seeds="SeedSequence([base, 22, round(100 kappa_I), round(100 kappa_S), rep]); population weights: "
                      "[base, 22, 999, round(100 kappa_I), round(100 kappa_S)]",
                population=popl, summary=x2b_summary(raw, popl), wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"X2b done in {time.perf_counter() - t0:.0f}s")
        if "X6" in which:
            t0 = time.perf_counter()
            pop_raw, _ = run(pool, x6_population_task, list(enumerate(X6_CELLS)), log, "X6pop")
            popl = {r["cell"]: r for r in pop_raw}
            tasks = [(ci, cell, rep) for ci, cell in enumerate(X6_CELLS) for rep in range(R["X6"])]
            raw, wall = run(pool, x6_task, tasks, log, "X6")
            with open(os.path.join(args.out, "raw", "X6.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X6"] = dict(
                description="Directional misspecifications at the registered sizes (10 S, 8 ID, 6 IT items; n = 6000; "
                            "probit GRM, five categories). (a) the trope-based items IT1-IT6 cross-load on S with "
                            "standardised loading c; (b) an acquiescence (random-intercept) factor with slope alpha, "
                            "+alpha on positively worded and -alpha on reverse-keyed items, with the registered keying "
                            "(4 reverse-keyed items: S2, S7, ID2, ID6) or balanced keying (half of each block), and one "
                            "cell with item-specific acquiescence slopes (0.5-1.5 alpha). True ECVs are the content "
                            "ECVs a_G^2/(a_G^2 + a_s^2) of the item's own domain. Fitted: the standard bifactor model "
                            "(bif); with free cross-loadings of IT on S (cross); with a one-parameter acquiescence factor "
                            "using the instrument's keying (mf); refit with I = ID only (ipo); and a two-stage rule that "
                            "uses cross when the one-sided IT x S mean-residual test rejects at 5% (twostage); and the "
                            "plan's check (BH q = 0.05 over the 60 IT x S residual correlations, a one-item cross-loading "
                            "model for each IT item in turn; a flagged item is classified only if the primary model and "
                            "its G share in the one-item model agree). "
                            "Classification: Bonferroni logit-Wald intervals over the Israel-related items (the plan's rule).",
                config=dict(n=X6_N, cells=X6_CELLS, R=R["X6"], starts=X6_STARTS, ecv_S=DS.REG_ECV_S, h2_S=DS.REG_H2_S,
                            ecv_ID=DS.REG_ECV_ID, ecv_IT=DS.REG_ECV_IT, h2_I=DS.REG_H2_I, reversed_registered=DS.REG_REVERSED,
                            reversed_balanced=DS.REG_BALANCED, hetero_pattern=DS.X6_HETERO_PATTERN, tau=TAU),
                seeds="SeedSequence([base, 6, cell_index, rep]).spawn(2): data, starts; population weights [base, 6, 999, cell_index]",
                population=popl, summary=x6_summary(raw, popl), wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"X6 done in {time.perf_counter() - t0:.0f}s")
        if "X7" in which:
            t0 = time.perf_counter()
            tasks = [(kappa, rep) for kappa in X2_KAPPA for rep in range(R["X2"])]
            raw, wall = run(pool, x7_task, tasks, log, "X7")
            with open(os.path.join(args.out, "raw", "X7.json"), "w") as f:
                json.dump(raw, f)
            with open(os.path.join(args.out, "raw", "X2.json")) as f:
                raw_x2 = json.load(f)
            res["experiments"]["X7"] = dict(
                description="The revised DIF screen of sec:design-groups run end to end on the X2 data sets (same seeds): "
                            "free-baseline fit with the anchor set, Wald test of each non-anchor item, Benjamini-Hochberg "
                            "at q = 0.05, every BH-significant item freed (no effect-size requirement), partial-invariance "
                            "refit. The expected-score difference averaged over the focal latent distribution is recorded "
                            "as the secondary description (small DIF if < 0.25).",
                config=dict(kappa=X2_KAPPA, anchors=DS.X2_ANCHORS, n_per_group=X2_N_PER_GROUP, R=R["X2"], q_fdr=0.05,
                            es_small=0.25),
                seeds="the X2 data sets: SeedSequence([base, 2, round(100 kappa), rep])",
                summary=x7_summary(raw, raw_x2), wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"X7 done in {time.perf_counter() - t0:.0f}s")
        if "X8" in which:
            t0 = time.perf_counter()
            tasks = [(ci, cell, ch) for ci, cell in enumerate(X8_CELLS) for ch in chunks(range(R["X8"]), 50)]
            raw_n, wall = run(pool, x8_task, tasks, log, "X8")
            raw = [x for ch in raw_n for x in ch]
            with open(os.path.join(args.out, "raw", "X8.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X8"] = dict(
                description="Identification of the threshold shift delta_j by a list experiment (prop:list-irt(b),(c)). "
                            "X1 six-item bank, sensitive item I4 (ECV 0.60), agreement = top two categories; two groups "
                            "(theta ~ N(mu_x, I), mu_1 = (0.5, 0, 0.3)) of 3000, each randomised to direct, list-control "
                            "and list-treatment arms (1/3 each); J = 4 controls in two pairs with rho = -0.6. The two-group "
                            "bifactor model is fitted to the direct arm with I4 free across groups; delta_x solves "
                            "eq:le-irt-root in each group. Cells: common uniform shift 0.4 SD; group-specific shifts 0.4 "
                            "and 0.8 SD; non-uniform private response (slope x 0.5, prop:list-irt-ext). Test of a common "
                            "shift: z-test of delta_1 = delta_0.",
                config=dict(item=X8_ITEM, cstar=X8_CSTAR, mus=X8_MUS, n_per_group=X8_N_PER_GROUP, cells=X8_CELLS,
                            R=R["X8"], arms="equal thirds", controls=dict(J=4, rho=-0.6)),
                seeds="SeedSequence([base, 8, cell_index, rep])",
                summary=x8_summary(raw), wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"X8 done in {time.perf_counter() - t0:.0f}s")
        if "X9" in which:
            t0 = time.perf_counter()
            tasks = []
            for ci, cfg in enumerate(X9_CFGS):
                for n in X9_N:
                    Rn = R["X9_6000"] if n == 6000 else R["X9_small"]
                    for ch in chunks(range(Rn), 50):
                        tasks.append((ci, cfg, n, ch))
            tasks.sort(key=lambda t: -t[2])
            raw_n, wall = run(pool, x9_task, tasks, log, "X9")
            raw = [x for ch in raw_n for x in ch]
            with open(os.path.join(args.out, "raw", "X9.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["X9"] = dict(
                description="Tests of within-domain heterogeneity (asm:id-het; rule D2(ii)) at the registered sizes "
                            "(10 S items, 14 I items). Per domain: the joint Wald test of a non-redundant set of "
                            "|D|(|D|-3)/2 polychoric tetrads (null: all tetrads vanish, i.e. id-het fails); the "
                            "residual-based one-factor test (Browne 1984) of the same null; the intersection-union test "
                            "(reject iff the joint test rejects for every D minus one item); and the earlier rule (any "
                            "of the 3,633 within-domain tetrads significant after Bonferroni). Configurations: "
                            "proportional (null), all but one proportional (null), all but two proportional with the two "
                            "on a second line, near-proportional, and the registered heterogeneous bank.",
                config=dict(cfgs=X9_CFGS, null=X9_NULL, n=X9_N, R={"6000": R["X9_6000"], "1500": R["X9_small"]},
                            ecv={k: dict(S=v[0], I=v[1]) for k, v in DS.X9_CONFIGS.items()}, h2_S=DS.REG_H2_S,
                            h2_I=DS.REG_H2_I, n_tetrads_bonferroni=X9_NT, alpha=0.05),
                seeds="SeedSequence([base, 9, cfg_index, n, rep])",
                summary=x9_summary(raw), wall_seconds=time.perf_counter() - t0)
            save(res)
            log(f"X9 done in {time.perf_counter() - t0:.0f}s")
    for e in which:
        if e in res["experiments"]:
            res["experiments"][e]["code_sha256_16"] = CODE_HASHES
            res["experiments"][e]["run_started"] = started
    res["meta"] = dict(
        description="Simulation study for 'Where Does Criticism End?' (synthetic data only; no real survey data).",
        experiment_names=EXPERIMENT_NAME_NOTE,
        base_seed=BASE_SEED, seed_scheme="numpy SeedSequence([base_seed, experiment_index, cell keys..., rep])",
        quick=q, workers=args.workers, versions=versions(),
        code_sha256_16_note="per experiment: experiments.<E>.code_sha256_16 (hashes of the code that produced it)",
        last_run=dict(started=started, which=which, wall_seconds=time.perf_counter() - t_all),
        estimation="Limited-information: two-step polychoric correlations (Olsson 1979) with influence-function "
                   "asymptotic covariance; DWLS fit (diagonal weights) of the bifactor model in the IRT "
                   "(theta) parameterisation; sandwich SEs; nonparametric bootstrap for ECV intervals.",
        runtime_by_experiment={k: v.get("wall_seconds") for k, v in res["experiments"].items()})
    with open(jpath, "w") as f:
        json.dump(_py(res), f, indent=1)
    log(f"all done in {time.perf_counter() - t_all:.0f}s -> {jpath}")


if __name__ == "__main__":
    main()
