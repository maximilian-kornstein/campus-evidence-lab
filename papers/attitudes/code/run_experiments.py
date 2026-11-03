#!/usr/bin/env python
"""Simulation study for "Where Criticism Ends" (sec:simulation, app:simdetails).

All data are synthetic, generated from models with known parameters.

  E1  recovery of loadings, item-level ECV, the boundary set B_tau (tau = 0.5) and the
      correlated-factors S-I correlation, vs sample size n and the number of I items
      (n_I = 2: not identified; n_I = 3 with a proportional S block: not identified;
      n_I = 3, 6: identified)
  E2  two-group DIF on Israel-related items: bias of the focal-minus-reference latent
      means and of ECV when DIF is ignored, with partial invariance and correct anchors,
      and with contaminated anchors; DIF detection rates; leave-one-anchor-out spread
  E3  list experiment (sec:sensitive): SDB estimation (bias, coverage, RMSE) in the split design
      under equal, Neyman-optimal and pilot-based allocations; paired design with the
      post-stratified and combined estimators, with and without monotonicity; choice of the
      control list (J, within-pair correlation) with and without floor/ceiling effects
  E4  MRP small-area estimates of the mean of G vs direct estimates and vs the two-step
      EAP shortcut (prop:eap)
  E5  stereotype-count index vs latent mean difference (prop:index): sign reversals under
      random uniform DIF, unequal latent variances, random non-uniform DIF; Example checks

Usage (from code/):
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py            # full study, 2 workers
  python run_experiments.py --quick                                       # smoke run
  python run_experiments.py --only E3 E4                                  # subset (merged into JSON)
Outputs: ../results/sim_results.json (summaries, configs, seeds, R, runtimes, versions)
         ../results/raw/E*.json (per-replication results)
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
from attsim.boundary import estimate_boundary, classify  # noqa: E402

BASE_SEED = 20261103
TAU = 0.5
EXP_INDEX = dict(E1=1, E2=2, E3=3, E4=4, E5=5)
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
    """Mean, median, SD and Monte Carlo SE of the mean of a 1-D sample (nan-aware)."""
    v = np.asarray(v, float)
    v = v[np.isfinite(v)]
    if len(v) == 0:
        return dict(mean=None, median=None, sd=None, mcse=None, n=0)
    sd = float(np.std(v, ddof=1)) if len(v) > 1 else float("nan")
    return dict(mean=float(np.mean(v)), median=float(np.median(v)), sd=sd, mcse=sd / np.sqrt(len(v)), n=len(v))


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
# E1: recovery and boundary sets
# =============================================================================
E1_CONFIGS = {   # name: (n_I, proportional S block?)
    "I6": (6, False), "I3": (3, False), "I2": (2, False), "I3p": (3, True),
}
E1B_CONFIGS = {"I3np": (3, "near")}   # E1b: nearly proportional S block, n_I = 3 (rem:id-heterogeneity)
ECV_S_NEAR = np.array([0.74, 0.66, 0.72, 0.68, 0.75, 0.65, 0.73, 0.67])
ALL_CONFIGS = {**E1_CONFIGS, **E1B_CONFIGS}


def e1_bank_cfg(cfg):
    n_I, prop_S = ALL_CONFIGS[cfg]
    if prop_S == "near":
        lgS, lsS = gen.loadings_from_ecv(ECV_S_NEAR, DS.H2_S_PROP)
        lgI, lsI = gen.loadings_from_ecv(DS.ECV_I[:n_I], DS.H2_I)
        spec = np.r_[np.ones(8, int), 2 * np.ones(n_I, int)]
        J = len(spec)
        names = [f"S{j + 1}" for j in range(8)] + [f"I{j + 1}" for j in range(n_I)]
        return gen.bank_from_standardised(np.r_[lgS, lgI], np.r_[lsS, lsI], spec,
                                          gen.base_thresholds(J, np.linspace(-0.3, 0.3, J)), names)
    return DS.e1_bank(n_I, prop_S)
E1_N = (500, 1000, 3000)


def e1_truth(cfg):
    n_I, prop_S = ALL_CONFIGS[cfg]
    bank = e1_bank_cfg(cfg)
    lamG, lamS = gen.std_loadings(bank)
    ecv = bank.ecv()
    # population fits: ident diagnostic and pseudo-true correlated-factors phi (population DWLS weights)
    tau, rho = gen.true_polychoric(bank)
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [100_000], seed("E1", 99, len(cfg), n_I))
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


def e1_task(args):
    cfg, n, rep, B = args
    bank = e1_bank_cfg(cfg)
    ss = seed("E1", list(ALL_CONFIGS).index(cfg), n, rep)
    s_data, s_boot = ss.spawn(2)
    t0 = time.perf_counter()
    Y, _, _ = gen.simulate([bank], [np.zeros(3)], [np.eye(3)], [n], np.random.default_rng(s_data))
    r = estimate_boundary(Y, bank.spec, 5, tau=TAU, B=B, rng=np.random.default_rng(s_boot))
    r["time"] = time.perf_counter() - t0
    r.update(cfg=cfg, n=n, rep=rep)
    return _py(r)


def e1_summary(raw, truth):
    out = {}
    for cfg in truth:
        tr = truth[cfg]
        spec = np.asarray(tr["spec"])
        iI = np.flatnonzero(spec == 2)
        iS = np.flatnonzero(spec == 1)
        ecv_t = np.asarray(tr["ecv"])
        in_t = ecv_t >= TAU
        for n in E1_N:
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
# E2: DIF, anchors and partial invariance
# =============================================================================
E2_KAPPA = (0.0, 0.2, 0.4, 0.6)
E2_MAIN_KAPPA = 0.4
E2_N_PER_GROUP = 1500
E2_STRATS = ("naive", "oracle", "correct_fb", "correct_proc", "contam1_fb", "contam1_proc", "contam2_fb",
             "contam2_proc", "sonly_fb")
E2_S_ANCHORS = (0, 1, 2, 3)          # S1-S4: anchoring in the stereotype domain only (rem:id-anchor-S)


def _e2_fit_summary(f, V=None):
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


def e2_task(args):
    kappa, rep, loo = args
    b0, b1 = DS.e2_banks(kappa)
    J = b0.J
    rng = np.random.default_rng(seed("E2", int(round(kappa * 100)), rep))
    t0 = time.perf_counter()
    Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.E2_MU1], [np.eye(3), np.eye(3)],
                           [E2_N_PER_GROUP, E2_N_PER_GROUP], rng)
    st = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
    res = dict(kappa=kappa, rep=rep)
    f = D.fit_mg(st, b0.spec, 4, np.zeros(J, bool))
    res["naive"] = _e2_fit_summary(f)
    fr = np.zeros(J, bool)
    fr[list(DS.E2_TRUE_DIF)] = True
    res["oracle"] = _e2_fit_summary(D.fit_mg(st, b0.spec, 4, fr))
    fs = np.ones(J, bool)
    fs[list(E2_S_ANCHORS)] = False
    res["sonly_fb"] = _e2_fit_summary(D.fit_mg_s_anchored(st, b0.spec, 4, fs))
    for nm, anchors in DS.E2_ANCHORS.items():
        pr = D.dif_procedure(st, b0.spec, 4, anchors)
        res[nm + "_fb"] = _e2_fit_summary(pr["fb"], V=pr["fb_cov"])
        res[nm + "_proc"] = _e2_fit_summary(pr["final"])
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


def e2_population():
    """Probability limits (fits to exact population statistics, population DWLS weights)."""
    out = {}
    for kappa in E2_KAPPA:
        b0, b1 = DS.e2_banks(kappa)
        J = b0.J
        Y, g, _ = gen.simulate([b0, b1], [np.zeros(3), DS.E2_MU1], [np.eye(3), np.eye(3)], [60_000, 60_000],
                               np.random.default_rng(seed("E2", 999, int(round(kappa * 100)))))
        big = [F.group_stats(Y[g == k], 5) for k in (0, 1)]
        pop = []
        for k, (bk, mu) in enumerate([(b0, np.zeros(3)), (b1, DS.E2_MU1)]):
            tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
            pop.append(F.GroupStats(tau, rho, big[k].Gamma, 10 ** 9, False))
        res = {}
        frees = dict(naive=[], oracle=list(DS.E2_TRUE_DIF))
        for nm, anchors in DS.E2_ANCHORS.items():
            frees[nm + "_fb"] = [j for j in range(J) if j not in anchors]
        frees["sonly_fb"] = [j for j in range(J) if j not in E2_S_ANCHORS]
        for nm, free in frees.items():
            fr = np.zeros(J, bool)
            fr[free] = True
            f = D.fit_mg_s_anchored(pop, b0.spec, 4, fr) if nm == "sonly_fb" else D.fit_mg(pop, b0.spec, 4, fr)
            p1 = f.params(1)
            res[nm] = dict(mu=p1["mu"], var1=np.exp(p1["lv"]), ecv0=f.ecv(0), ecv1=f.ecv_std(1), cost=f.opt.cost)
        res["truth"] = dict(mu=DS.E2_MU1, ecv0=b0.ecv(), ecv1=b1.ecv())
        out[str(kappa)] = res
    return _py(out)


def e2_checks():
    """Exact population-level checks (fits to exact population thresholds/polychorics, unit weights)."""
    def popstats(banks, mus):
        out = []
        for bk, mu in zip(banks, mus):
            tau, rho = gen.true_polychoric(bk, mu, (1, 1, 1))
            out.append(F.GroupStats(tau, rho, np.eye(tau.size + rho.size), 10 ** 9, False))
        return out
    b0, b1 = DS.e2_banks(E2_MAIN_KAPPA)
    J, A = b0.J, b0.A()
    v = np.array([0.25, -0.10, 0.15])
    res = {}
    # rem:id-anchor-S: stereotype-only anchors recover mu_G, mu_S and every focal ECV under I-item DIF
    fs = np.ones(J, bool)
    fs[list(E2_S_ANCHORS)] = False
    f = D.fit_mg_s_anchored(popstats([b0, b1], [np.zeros(3), DS.E2_MU1]), b0.spec, 4, fs)
    p = f.params(1)
    res["s_anchored"] = dict(kappa=E2_MAIN_KAPPA, mu_hat=p["mu"], mu_true=DS.E2_MU1, note="mu_I fixed at 0 (not identified)",
                             max_abs_ecv1_error=float(np.max(np.abs(f.ecv_std(1) - b1.ecv()))), cost=f.opt.cost)
    # thm:dif-bias(d)(i): uniform DIF -a_j'v on all items == latent mean shift v
    bd = b0.copy()
    bd.b = bd.b - (A @ v)[:, None]
    f = D.fit_mg(popstats([b0, bd], [np.zeros(3), DS.E2_MU1]), b0.spec, 4, np.zeros(J, bool))
    res["dif_bias_d_i"] = dict(v=v, mu_hat=f.params(1)["mu"], mu_expected=DS.E2_MU1 + v, cost=f.opt.cost)
    # prop:anchor(b): three anchors (S1, S2, I1) with uniform DIF -A_A v
    anch = [0, 1, 8]
    bd = b0.copy()
    bd.b[anch] = bd.b[anch] - (A[anch] @ v)[:, None]
    fr = np.ones(J, bool)
    fr[anch] = False
    f = D.fit_mg(popstats([b0, bd], [np.zeros(3), DS.E2_MU1]), b0.spec, 4, fr)
    k = [j for j in range(J) if j not in anch]
    sp = f.params(1)["b"][k] - f.params(0)["b"][k]
    res["anchor_b"] = dict(anchors=[b0.names[j] for j in anch], v=v, mu_hat=f.params(1)["mu"],
                           mu_expected=DS.E2_MU1 + v, cost=f.opt.cost,
                           max_abs_spurious_dif_minus_a_v=float(np.max(np.abs(sp - (A[k] @ v)[:, None]))))
    return _py(res)


def e2_summary(raw, popl):
    out = {}
    for kappa in E2_KAPPA:
        rr = [r for r in raw if abs(r["kappa"] - kappa) < 1e-9]
        if not rr:
            continue
        b0, b1 = DS.e2_banks(kappa)
        cell = dict(R=len(rr), kappa=kappa, n_per_group=E2_N_PER_GROUP, time_mean=float(np.mean([r["time"] for r in rr])))
        for s in E2_STRATS:
            d = {}
            for fac, nm in enumerate(("G", "S", "I")):
                est = np.array([r[s]["mu_" + nm] for r in rr], dtype=float)     # None (JSON null) -> nan
                se = np.array([r[s]["se_" + nm] for r in rr], dtype=float)
                err = est - DS.E2_MU1[fac]
                if not np.any(np.isfinite(err)):
                    d["mu_" + nm] = dict(identified=False)
                    continue
                cov = np.where(np.isfinite(se), (np.abs(err) <= 1.959964 * se).astype(float), np.nan)
                d["mu_" + nm] = dict(bias=mc(err), rmse=rmse(err), cover=prop(cov),
                                     se_mean=float(np.nanmean(se)), plim_bias=None)
            j3 = DS.E2_NONUNIFORM[0]
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
            pl = popl.get(str(kappa), {}).get(s)          # no plim for the data-dependent procedures
            if pl is not None:
                for fac, nm in enumerate(("G", "S", "I")):
                    if d["mu_" + nm].get("identified", True):
                        d["mu_" + nm]["plim_bias"] = pl["mu"][fac] - DS.E2_MU1[fac]
            cell[s] = d
        # DIF detection
        det = {}
        for nm in DS.E2_ANCHORS:
            tests = [r[nm + "_tests"] for r in rr]
            tested = tests[0]["tested"]
            per = {}
            for ii, j in enumerate(tested):
                flag = [j in t["flagged"] for t in tests]
                sig = [t["sig"][ii] for t in tests]
                per[b0.names[j]] = dict(dif_true=j in DS.E2_TRUE_DIF and kappa > 0,
                                        flag=prop(flag), sig_bh=prop(sig),
                                        es_mean=float(np.mean([t["es"][ii] for t in tests])))
            clean = [b0.names[j] for j in tested if not (j in DS.E2_TRUE_DIF and kappa > 0)]
            difi = [b0.names[j] for j in tested if j in DS.E2_TRUE_DIF and kappa > 0]
            det[nm] = dict(items=per,
                           fpr_flag=float(np.mean([per[c]["flag"]["p"] for c in clean])) if clean else None,
                           fpr_bh=float(np.mean([per[c]["sig_bh"]["p"] for c in clean])) if clean else None,
                           power_flag=float(np.mean([per[c]["flag"]["p"] for c in difi])) if difi else None,
                           power_bh=float(np.mean([per[c]["sig_bh"]["p"] for c in difi])) if difi else None,
                           any_false_flag=prop([any((j not in DS.E2_TRUE_DIF or kappa == 0) for j in t["flagged"])
                                                for t in tests]))
        cell["detection"] = det
        loo = {}
        for nm in DS.E2_ANCHORS:
            sp = [r[nm + "_loo"]["spread"] for r in rr if nm + "_loo" in r]
            if sp:
                loo[nm] = dict(spread=mc(sp), R=len(sp))
        if loo:
            cell["loo_spread_mu_G"] = loo
        out[str(kappa)] = cell
    return out


# =============================================================================
# E3: list experiments (sec:sensitive: prop:list-var, thm:joint-sdb, thm:design)
# =============================================================================
E3_N = 3000
E3_PI, E3_PID = 0.30, 0.20          # pi and the direct prevalence produced by the threshold shift
E3_A = 0.75                         # slope of the sensitive item on theta_G (standardised loading 0.6)
E3_REL = 0.85                       # reliability of the theta_G score used by the covariate-adjusted estimator
E3_PILOT = 300
E3_PHI = 0.02                       # false-endorsement rate phi in the non-monotone scenario
E3_MSE_N = (300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000)


def e3_design(J=4, rho=-0.6, phi=0.0, fc=0.0):
    return L.ListDesign(J=J, rho=rho, pi=E3_PI, pi_d_shift=E3_PID, a=E3_A, phi_rate=phi / (1 - E3_PI), kc=fc, kf=fc)


def e3_cells():
    cells = []
    for ctrl, rho in (("indep", 0.0), ("pairs", -0.6)):
        for alloc in ("equal", "neyman", "pilot"):
            cells.append(dict(id=f"A_{ctrl}_{alloc}", part="A", J=4, rho=rho, phi=0.0, fc=0.0, design="split",
                              alloc=alloc))
    for phi in (0.0, E3_PHI):
        for design, alloc in (("split", "neyman"), ("paired", "paired_opt"), ("paired", "equal")):
            cells.append(dict(id=f"B_phi{phi}_{design}_{alloc}", part="B", J=4, rho=-0.6, phi=phi, fc=0.0,
                              design=design, alloc=alloc))
    for J in (2, 3, 4, 5, 6):
        for rho in (0.0, -0.6):
            for fc in (0.0, 0.5):
                cells.append(dict(id=f"C_J{J}_rho{rho}_fc{fc}", part="C", J=J, rho=rho, phi=0.0, fc=fc,
                                  design="split", alloc="neyman"))
    return cells


def e3_alloc(des, cell, rng):
    if cell["alloc"] == "equal":
        return np.array([1, 1, 1]) / 3
    if cell["alloc"] == "neyman":
        return L.neyman_split(des.v_d(), des.sigma_c2(), des.sigma_t2())
    if cell["alloc"] == "paired_opt":
        return L.paired_alloc(des)
    # pilot: split pilot with equal allocation, plug-in Neyman shares (pilot data not reused)
    pdat = L.simulate(des, E3_PILOT, np.array([1, 1, 1]) / 3, rng)
    a, y, d = pdat["arm"], pdat["y"], pdat["d"]
    pd = d[a == 0].mean()
    return L.neyman_split(max(pd * (1 - pd), 1e-4), y[a == 1].var(ddof=1), y[a == 2].var(ddof=1))


def e3_task(args):
    ci, cell, reps = args
    des = e3_design(cell["J"], cell["rho"], cell["phi"], cell["fc"])
    s_m = np.sqrt((1 - E3_REL) / E3_REL)
    out = []
    for rep in reps:
        rng = np.random.default_rng(seed("E3", ci, rep))
        r = e3_alloc(des, cell, rng)
        dat = L.simulate(des, E3_N, r, rng, paired=cell["design"] == "paired")
        arm, y, d = dat["arm"], dat["y"], dat["d"]
        row = dict(cell=cell["id"], rep=rep, r=r)
        if cell["design"] == "split":
            e, pl, pd = L.split_sdb(arm, y, d)
            row.update(split=e.est, split_se=e.se, pi_list=pl, pi_d=pd)
            if cell["part"] == "A":
                x = dat["theta"] + s_m * rng.standard_normal(E3_N)
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


def e3_summary(raw):
    out = dict(cells={})
    for ci, cell in enumerate(e3_cells()):
        rr = [r for r in raw if r["cell"] == cell["id"]]
        if not rr:
            continue
        des = e3_design(cell["J"], cell["rho"], cell["phi"], cell["fc"])
        R_ = np.array([r["r"] for r in rr], float)
        d = dict(cell, R=len(rr), n=E3_N, r_mean=R_.mean(axis=0),
                 truth=dict(pi=des.pi, pi_d=des.pi_d, sdb=des.sdb, eta=des.eta, phi=des.phi, sigma_c2=des.sigma_c2(),
                            sigma_t2=des.sigma_t2(), v_d=des.v_d(), exposure=des.exposure(), fc_bias=des.fc_bias()))
        if cell["design"] == "split":
            sd_th = float(np.sqrt(np.mean([L.split_var(des, r, E3_N) for r in R_])))
            d["split"] = _metrics([r["split"] for r in rr], [r["split_se"] for r in rr], des.sdb, sd_th, des.fc_bias())
            d["pi_list"] = dict(bias=mc(np.array([r["pi_list"] for r in rr]) - des.pi))
            if "adj" in rr[0]:
                d["adj"] = _metrics([r["adj"] for r in rr], [r["adj_se"] for r in rr], des.sdb)
        else:
            v_ps, v_eta = L.paired_avar(des, R_.mean(axis=0))
            d["ps"] = _metrics([r["ps"] for r in rr], [r["ps_se"] for r in rr], des.sdb, float(np.sqrt(v_ps / E3_N)))
            d["comb_vs_sdb"] = _metrics([r["comb"] for r in rr], [r["comb_se"] for r in rr], des.sdb,
                                        float(np.sqrt(v_eta / E3_N)), des.phi)
            d["comb_vs_eta"] = _metrics([r["comb"] for r in rr], [r["comb_se"] for r in rr], des.eta)
        out["cells"][cell["id"]] = d
    # thm:design(c): MSE-optimal control list on the menu {J} x {rho}, by sample size (equal costs, B = n)
    menu = [(J, rho) for J in (2, 3, 4, 5, 6) for rho in (0.0, -0.6)]
    choice = {}
    for fc in (0.0, 0.5):
        rows = {}
        for n in E3_MSE_N:
            mse = {}
            for J, rho in menu:
                des = e3_design(J, rho, 0.0, fc)
                V = (np.sqrt(des.v_d()) + np.sqrt(des.sigma_c2()) + np.sqrt(des.sigma_t2())) ** 2
                mse[f"J{J}_rho{rho}"] = V / n + des.fc_bias() ** 2
            best = min(mse, key=mse.get)
            rows[str(n)] = dict(best=best, mse=mse)
        emp = {f"J{J}_rho{rho}": out["cells"].get(f"C_J{J}_rho{rho}_fc{fc}", {}).get("split", {}).get("mse")
               for J, rho in menu}
        emp = {k: v for k, v in emp.items() if v is not None}
        choice[f"fc{fc}"] = dict(theory_by_n=rows, empirical_n3000=dict(mse=emp, best=min(emp, key=emp.get) if emp else None))
    out["list_choice"] = choice
    out["checks"] = e3_checks()
    return out


def e3_checks():
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
# E4: MRP
# =============================================================================
E4_N = (1000, 3000, 6000)
E4_A = 50
E4_SM = 0.40
E4_BINS = (0, 5, 10, 20, 50, 100, 10 ** 9)


def e4_task(args):
    n, reps = args
    out = []
    for rep in reps:
        ss = seed("E4", n, rep)
        sp, sd = ss.spawn(2)
        pop = M.make_population(np.random.default_rng(sp), A=E4_A)
        area, dcell, y, _ = M.draw_sample(pop, n, np.random.default_rng(sd), s_m=E4_SM)
        est, se, m = M.mrp_estimate(pop, area, dcell, y)
        yt, rho_eap = M.eap_scores(y, E4_SM)
        est_eap, se_eap, _ = M.mrp_estimate(pop, area, dcell, yt)
        unw, wtd, se_unw, na = M.direct_estimates(pop, area, dcell, y)
        T = pop.area_mean
        slope = lambda e: float(np.polyfit(T, e, 1)[0])
        out.append(dict(n=n, rep=rep, truth=T, mrp=est, mrp_se=se, mrp_eap=est_eap, mrp_eap_se=se_eap, rho_eap=rho_eap,
                        slope_mrp=slope(est), slope_eap=slope(est_eap), direct=unw, direct_w=wtd, direct_se=se_unw,
                        na=na, su=np.sqrt(m["su2"]), s2=m["s2"]))
    return _py(out)


def e4_summary(raw):
    out = {}
    for n in E4_N:
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
        d = dict(R=len(rr), n=n, A=E4_A, s_m=E4_SM, empty_areas=mc((NA == 0).sum(axis=1)),
                 areas_lt5=mc((NA < 5).sum(axis=1)))
        em, ed, ew = Mx - T, Dx - T, Dw - T
        d["mrp_all"] = dict(rmse=rmse(em.ravel()), bias=mc(em.ravel()),
                            cover=prop((np.abs(em) <= 1.959964 * Ms).ravel()))
        d["mrp_ok"] = dict(rmse=rmse(em[ok]))
        d["direct_ok"] = dict(rmse=rmse(ed[ok]), bias=mc(ed[ok]),
                              cover=prop((np.abs(ed) <= 1.959964 * Ds)[ok & (NA >= 5)]))
        d["direct_w_ok"] = dict(rmse=rmse(ew[ok]), bias=mc(ew[ok]))
        bins = []
        for lo, hi in zip(E4_BINS[:-1], E4_BINS[1:]):
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
# E5: stereotype-count index sign reversals
# =============================================================================
E5_S_DIF = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5)
E5_DELTA = (0.05, 0.10, 0.20, 0.30)
E5_K = 4
E5_CONFIGS = 1000
E5_FS_N = 1000          # per group, finite-sample check
E5_FS_R = 300


def e5_task(args):
    s_dif, delta, k_list, n_configs = args
    bank = DS.e1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    aG, aS, b = bank.aG[S], bank.aS[S], bank.b[S, IX.C_AGREE - 1]
    sd = np.sqrt(1 + aG ** 2 + aS ** 2)
    rng = np.random.default_rng(seed("E5", int(round(s_dif * 100)), int(round(delta * 100))))
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


def e5_fs_task(args):
    s_dif, delta, reps = args
    bank = DS.e1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    sub = bank.subset(S)
    sd = np.sqrt(1 + sub.aG ** 2 + sub.aS ** 2)
    out = []
    for rep in reps:
        rng = np.random.default_rng(seed("E5", 500 + int(round(s_dif * 100)), int(round(delta * 100)), rep))
        db = rng.normal(scale=s_dif, size=len(S)) * sd
        b1 = sub.copy()
        b1.b = b1.b + db[:, None]
        Y, g, _ = gen.simulate([sub, b1], [np.zeros(3), np.array([delta, 0, 0])], [np.eye(3)] * 2,
                               [E5_FS_N, E5_FS_N], rng)
        diff = IX.sample_index(Y[g == 1], E5_K) - IX.sample_index(Y[g == 0], E5_K)
        out.append(dict(rep=rep, diff=diff))
    return _py(dict(s_dif=s_dif, delta=delta, rows=out))


E5_SIGMA1 = (0.6, 0.8, 1.25, 1.5)
E5_SA = (0.2, 0.4, 0.6)


def _e5_items():
    bank = DS.e1_bank(6)
    S = np.flatnonzero(bank.spec == 1)
    return bank.aG[S], bank.aS[S], bank.b[S, IX.C_AGREE - 1]


def e5_variance():
    """prop:index(b) in the bifactor setting: full invariance, delta = mu_G^(1) - mu_G^(0) > 0,
    focal SD of G = sigma1 (reference 1); index difference P1(h) - P0(h) for h = 1..8."""
    aG, aS, b = _e5_items()
    d0 = IX.population_count_dist(aG, aS, b)
    out = {}
    for delta in (0.1, 0.2):
        for s1 in E5_SIGMA1:
            d1 = IX.population_count_dist(aG, aS, b, (delta, 0.0), (s1, 1.0))
            diff = IX.survival(d1) - IX.survival(d0)
            sg = np.sign(diff)
            out[f"d{delta}_s{s1}"] = dict(delta=delta, sigma1=s1, diff_by_h=diff, sign_by_h=sg,
                                          n_sign_changes=int(np.sum(sg[1:] != sg[:-1])))
    return out


def e5_nonuniform_task(args):
    """prop:index(d)-type configurations: random non-uniform DIF a_jG^(1) = a_jG^(0) exp(N(0, s_a^2))."""
    s_a, delta, n_configs = args
    aG, aS, b = _e5_items()
    rng = np.random.default_rng(seed("E5", 700 + int(round(s_a * 100)), int(round(delta * 100))))
    d0 = IX.population_count_dist(aG, aS, b)
    rows = []
    for c in range(n_configs):
        mult = np.exp(rng.normal(scale=s_a, size=len(aG)))
        d1 = IX.population_count_dist(aG * mult, aS, b, (delta, 0.0))
        rows.append(dict(diff_by_h=IX.survival(d1) - IX.survival(d0)))
    return _py(dict(s_a=s_a, delta=delta, rows=rows))


def e5_nonuniform_summary(raw):
    out = {}
    for r in raw:
        D_ = np.array([x["diff_by_h"] for x in r["rows"]])
        sg = np.sign(D_)
        hdep = np.any(sg != sg[:, :1], axis=1)
        out[f"sa{r['s_a']}_d{r['delta']}"] = dict(
            s_a=r["s_a"], delta=r["delta"], R=len(D_), p_h_dependent_sign=prop(hdep),
            reversal_by_h=[prop(sg[:, h] < 0)["p"] for h in range(D_.shape[1])],
            reversal_k4=prop(sg[:, E5_K - 1] < 0))
    return out


def e5_checks():
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


def e5_summary(raw, raw_fs, k_list, n_configs):
    out = dict(k_main=E5_K, configs=n_configs, cells={})
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
    out["finite_sample"] = dict(n_per_group=E5_FS_N, k=E5_K, cells=fs)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--out", default=RESULTS)
    ap.add_argument("--reuse-raw", nargs="*", default=[],
                    help="for these experiments (E1b only), reuse results/raw/<E>.json instead of re-running")
    ap.add_argument("--resummarize", nargs="*", default=None,
                    help="recompute the summaries of these experiments (E1, E1b) from results/raw with the current code")
    args = ap.parse_args()
    q = args.quick
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    logf = open(os.path.join(args.out, "run_log.txt"), "a")

    def log(msg):
        line = time.strftime("%H:%M:%S ") + msg
        print(line, flush=True)
        logf.write(line + "\n")
        logf.flush()

    which = args.only or ["E1", "E1b", "E2", "E3", "E4", "E5"]
    if args.resummarize:
        with open(os.path.join(args.out, "sim_results.json")) as f:
            res = json.load(f)
        for e in args.resummarize:
            with open(os.path.join(args.out, "raw", f"{e}.json")) as f:
                raw = json.load(f)
            res["experiments"][e]["summary"] = e1_summary(raw, res["experiments"][e]["truth"])
            res["experiments"][e]["summary_recomputed"] = dict(
                when=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), code_sha256_16=CODE_HASHES,
                note="summary recomputed from raw/%s.json with the code hashed here; the replications themselves "
                     "were produced by the code in code_sha256_16" % e)
        with open(os.path.join(args.out, "sim_results.json"), "w") as f:
            json.dump(_py(res), f, indent=1)
        print("resummarized", args.resummarize)
        return
    R = dict(E1_id=4 if q else 100, E1_nonid=3 if q else 50, E1_nonid_p=3 if q else 40, E1_B=20 if q else 100,
             E2=3 if q else 100, E2_loo=2 if q else 100, E1b=3 if q else 40,
             E3=50 if q else 2000, E3_sweep=50 if q else 1000,
             E4=5 if q else 200, E5_configs=20 if q else E5_CONFIGS, E5_fs=10 if q else E5_FS_R)
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
        if "E1" in which:
            truth = {c: _py(e1_truth(c)) for c in E1_CONFIGS}
            tasks = []
            for cfg in E1_CONFIGS:
                Rc = R["E1_id"] if cfg in ("I6", "I3") else (R["E1_nonid"] if cfg == "I2" else R["E1_nonid_p"])
                for n in E1_N:
                    for rep in range(Rc):
                        tasks.append((cfg, n, rep, R["E1_B"]))
            tasks.sort(key=lambda t: -t[1])           # big-n tasks first
            raw, wall = run(pool, e1_task, tasks, log, "E1")
            res["experiments"]["E1"] = dict(
                description="Recovery of loadings, item-level ECV, boundary set (tau=0.5) and S-I correlation; "
                            "single group, bifactor DGP (probit GRM), DWLS on polychorics, bootstrap percentile "
                            "and logit-Wald (sandwich) 95% intervals.",
                config=dict(n=E1_N, configs={k: dict(n_I=v[0], proportional_S=v[1]) for k, v in E1_CONFIGS.items()},
                            tau=TAU, B=R["E1_B"], n_starts=5, R=dict(I6=R["E1_id"], I3=R["E1_id"], I2=R["E1_nonid"],
                                                                        I3p=R["E1_nonid_p"]),
                            ecv_S=DS.ECV_S, h2_S=DS.H2_S, ecv_I=DS.ECV_I, h2_I=DS.H2_I,
                            ecv_S_prop=DS.ECV_S_PROP, h2_S_prop=DS.H2_S_PROP),
                seeds="data: SeedSequence([base, 1, cfg_index, n, rep]).spawn(2)[0]; bootstrap: .spawn(2)[1]",
                truth=truth, summary=e1_summary(raw, truth), wall_seconds=wall,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            with open(os.path.join(args.out, "raw", "E1.json"), "w") as f:
                json.dump(raw, f)
            log(f"E1 done in {wall:.0f}s")
        if "E1b" in which:
            t0 = time.perf_counter()
            truth = {c: _py(e1_truth(c)) for c in E1B_CONFIGS}
            tasks = [(cfg, n, rep, R["E1_B"]) for cfg in E1B_CONFIGS for n in E1_N for rep in range(R["E1b"])]
            tasks.sort(key=lambda t: -t[1])
            if "E1b" in args.reuse_raw:
                with open(os.path.join(args.out, "raw", "E1b.json")) as f:
                    raw = json.load(f)
                wall = float(sum(r["time"] for r in raw)) / args.workers   # approximate; see run_log.txt
                log(f"E1b: reused {len(raw)} raw replications from raw/E1b.json")
            else:
                raw, wall = run(pool, e1_task, tasks, log, "E1b")
                with open(os.path.join(args.out, "raw", "E1b.json"), "w") as f:
                    json.dump(raw, f)
            res["experiments"]["E1b"] = dict(
                description="As E1 for a design close to proportionality (rem:id-heterogeneity): S-block ECVs "
                            "0.65-0.75 (common communality 0.55), n_I = 3, so Assumption id-het holds only "
                            "weakly in S and fails in I.",
                config=dict(n=E1_N, configs={k: dict(n_I=v[0], S_block=v[1]) for k, v in E1B_CONFIGS.items()},
                            ecv_S=ECV_S_NEAR, h2_S=DS.H2_S_PROP, ecv_I=DS.ECV_I[:3], tau=TAU, B=R["E1_B"],
                            n_starts=5, R=R["E1b"]),
                seeds="data: SeedSequence([base, 1, 4, n, rep]).spawn(2)[0]; bootstrap: .spawn(2)[1]",
                truth=truth, summary=e1_summary(raw, truth), wall_seconds=wall,
                cpu_seconds=float(sum(r["time"] for r in raw)),
                raw_reused="E1b" in args.reuse_raw)
            if "E1b" in args.reuse_raw:
                res["experiments"]["E1b"]["note"] = ("replications computed in a run started 2026-11-03T22:11:23Z (wall 101 s, "
                                                    "see run_log.txt) that crashed later in the E2 summary; raw reused")
            save(res)
            log(f"E1b done in {time.perf_counter() - t0:.0f}s")
        if "E2" in which:
            t0 = time.perf_counter()
            popl = e2_population()
            tasks = [(kappa, rep, kappa == E2_MAIN_KAPPA and rep < R["E2_loo"])
                     for kappa in E2_KAPPA for rep in range(R["E2"])]
            raw, wall = run(pool, e2_task, tasks, log, "E2")
            with open(os.path.join(args.out, "raw", "E2.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["E2"] = dict(
                description="Two groups (n=1500 each), DIF on Israel-related items I1, I2 (uniform) and I3 "
                            "(non-uniform); focal-group latent means (G,S,I) = (0.3, 0, 0.3); strategies: naive "
                            "(full invariance), oracle (true DIF items free), free-baseline with anchor sets "
                            "(correct, contam1, contam2) and the pre-registered procedure (Wald + BH q=0.05 + "
                            "expected-score effect size >= 0.25, then refit); stereotype-only anchors S1-S4 with "
                            "mu_I, sigma_I fixed (rem:id-anchor-S). Naive = concurrent calibration with equal group "
                            "sizes (rem:id-concurrent). Focal ECV per def:boundary (with focal factor variances).",
                config=dict(kappa=E2_KAPPA, main_kappa=E2_MAIN_KAPPA, n_per_group=E2_N_PER_GROUP, mu1=DS.E2_MU1,
                            uniform=DS.E2_UNIFORM, nonuniform=DS.E2_NONUNIFORM, anchors=DS.E2_ANCHORS,
                            R=R["E2"], R_loo=R["E2_loo"], q_fdr=0.05, es_min=0.25, s_anchors=E2_S_ANCHORS,
                            item_names=DS.e1_bank(6).names),
                seeds="SeedSequence([base, 2, round(100 kappa), rep]); population weights: [base, 2, 999, round(100 kappa)]",
                population=popl, summary=e2_summary(raw, popl), checks=e2_checks(),
                wall_seconds=time.perf_counter() - t0,
                cpu_seconds=float(sum(r["time"] for r in raw)))
            save(res)
            log(f"E2 done in {time.perf_counter() - t0:.0f}s")
        if "E3" in which:
            t0 = time.perf_counter()
            tasks = []
            for ci, cell in enumerate(e3_cells()):
                Rc = R["E3"] if cell["part"] in ("A", "B") else R["E3_sweep"]
                for ch in chunks(range(Rc), 250):
                    tasks.append((ci, cell, ch))
            raw_nested, wall = run(pool, e3_task, tasks, log, "E3")
            raw = [x for ch in raw_nested for x in ch]
            with open(os.path.join(args.out, "raw", "E3.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["E3"] = dict(
                description="One sensitive item, threshold-shift model of social desirability (def:le-shift, "
                            "normal ogive): pi = 0.30, pi^D = 0.20 (SDB = 0.10) unless false endorsement phi > 0. "
                            "Part A: split design, equal vs Neyman (thm:design(a)) vs pilot plug-in allocation; "
                            "SDB_S (eq:le-split) and a covariate-adjusted version. Part B: paired design "
                            "(thm:joint-sdb(b),(c)), post-stratified SDB_PS and combined eta-hat, under monotonicity "
                            "(phi = 0) and false endorsement (phi = 0.02), vs the split design. Part C: control-list "
                            "menu J in 2..6, binary within-pair correlation rho in {0, -0.6}, floor/ceiling "
                            "probability kc = kf in {0, 0.5} (thm:design(c),(d)).",
                config=dict(n=E3_N, pi=E3_PI, pi_d_shift=E3_PID, sdb=E3_PI - E3_PID, a_sensitive=E3_A,
                            phi_nonmonotone=E3_PHI, score_reliability=E3_REL, n_pilot=E3_PILOT, costs="equal",
                            control_prevalence=0.5, cells=e3_cells(), R_AB=R["E3"], R_C=R["E3_sweep"],
                            mse_n=E3_MSE_N),
                seeds="SeedSequence([base, 3, cell_index, rep])",
                summary=e3_summary(raw), wall_seconds=wall)
            save(res)
            log(f"E3 done in {time.perf_counter() - t0:.0f}s")
        if "E4" in which:
            t0 = time.perf_counter()
            tasks = [(n, ch) for n in E4_N for ch in chunks(range(R["E4"]), 25)]
            raw_nested, wall = run(pool, e4_task, tasks, log, "E4")
            raw = [x for ch in raw_nested for x in ch]
            with open(os.path.join(args.out, "raw", "E4.json"), "w") as f:
                json.dump(raw, f)
            res["experiments"]["E4"] = dict(
                description="MRP of the area mean of G (50 areas, 32 demographic cells per area, differential "
                            "non-response by age and education); score y = theta_G + N(0, s_m^2) (conditionally "
                            "unbiased); MRP = REML random-intercept model on y + poststratification (eq:mrp), which "
                            "in this Gaussian setting is the latent regression with measurement error integrated "
                            "out; two-step EAP = the same MRP on posterior-mean scores under one common prior "
                            "(prop:eap); direct = area sample mean (unweighted and national cell-weighted). A new "
                            "population is drawn in every replication.",
                config=dict(n=E4_N, A=E4_A, s_m=E4_SM, population=dict(total=10_000_000, size_sd=1.0, s_u=0.2,
                                                                         gamma=0.25, s_w=0.85), R=R["E4"],
                            bins=E4_BINS[:-1]),
                seeds="population: SeedSequence([base, 4, n, rep]).spawn(2)[0]; sample: .spawn(2)[1]",
                summary=e4_summary(raw), wall_seconds=wall)
            save(res)
            log(f"E4 done in {time.perf_counter() - t0:.0f}s")
        if "E5" in which:
            t0 = time.perf_counter()
            k_list = (2, 4, 6)
            tasks = [(s, d, k_list, R["E5_configs"]) for s in E5_S_DIF for d in E5_DELTA]
            raw, wall = run(pool, e5_task, tasks, log, "E5")
            nu_tasks = [(sa, 0.1, R["E5_configs"]) for sa in E5_SA]
            raw_nu, wall3 = run(pool, e5_nonuniform_task, nu_tasks, log, "E5nu")
            wall += wall3
            fs_tasks = [(s, 0.1, ch) for s in (0.0, 0.3) for ch in chunks(range(R["E5_fs"]), 100)]
            raw_fs_n, wall2 = run(pool, e5_fs_task, fs_tasks, log, "E5fs")
            merged = {}
            for r in raw_fs_n:
                key = (r["s_dif"], r["delta"])
                merged.setdefault(key, dict(s_dif=r["s_dif"], delta=r["delta"], rows=[]))["rows"] += r["rows"]
            raw_fs = list(merged.values())
            res["experiments"]["E5"] = dict(
                description="Population index P(agree with >= k of 8 S items) by group vs the latent mean "
                            "difference delta of G; random uniform DIF b_j^(1) = b_j^(0) + N(0, s^2) sd_j on the S "
                            "items; reversal = sign(index difference) != sign(delta). Exact (quadrature) for "
                            f"{R['E5_configs']} random configurations per (s, |delta|); finite-sample check with n = "
                            f"{E5_FS_N} per group.",
                config=dict(s_dif=E5_S_DIF, delta=E5_DELTA, k=k_list, k_main=E5_K, configs=R["E5_configs"],
                            agree="Y >= 3 (top two of five categories)", fs_n=E5_FS_N, fs_R=R["E5_fs"]),
                seeds="SeedSequence([base, 5, round(100 s), round(100 |delta|)]); finite sample [base, 5, 500 + round(100 s), round(100 delta), rep]",
                summary=e5_summary(raw, raw_fs, k_list, R["E5_configs"]), wall_seconds=wall + wall2,
                variance=_py(e5_variance()), nonuniform=e5_nonuniform_summary(raw_nu), checks=e5_checks())
            res["experiments"]["E5"]["config"].update(sigma1=E5_SIGMA1, s_a=E5_SA, delta_nonuniform=0.1)
            with open(os.path.join(args.out, "raw", "E5.json"), "w") as f:
                json.dump(dict(population=raw, finite_sample=raw_fs, nonuniform=raw_nu), f)
            save(res)
            log(f"E5 done in {time.perf_counter() - t0:.0f}s")
    for e in which:
        if e in res["experiments"]:
            res["experiments"][e]["code_sha256_16"] = CODE_HASHES
            res["experiments"][e]["run_started"] = started
    res["meta"] = dict(
        description="Simulation study for 'Where Criticism Ends' (synthetic data only; no real survey data).",
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
