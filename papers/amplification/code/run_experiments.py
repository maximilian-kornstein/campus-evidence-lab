#!/usr/bin/env python
"""Simulation study runner for "Supply or Demand?" (sec:simulation, app:simdetails). All data synthetic.

Experiments
  E1  AR / AA estimation accuracy and coverage vs puppet count; true vs naive vs Rogan-Gladen-corrected
      (pooled vs arm-stratified) classifier measurement under non-differential and differential error.
  E2  interference through the shared popularity model: puppet traffic share vs bias of AA; bound of
      prop:interference; remedy designs (limited co-viewing, staggered waves).
  E3  supply / demand decomposition (thm:decomp) for real users with evolving demand; fixed-demand audit
      estimates; demand-sufficiency gaps (asm:demand); persona-contrast decomposition.
  E4  Markov exposure model (prop:markov, prop:markov-mle): predictions vs simulated sessions; perturbation
      (thm:perturb) for a score tilt toward antisemitic items and for the replacement nudge of thm:perturb(c).
  E5  sequential audit (alg:sequential) on the confirmed-flagged statistic Y_u, at a conventional small-lab
      design kept as a benchmark (waves of 5 pairs, up to 8 waves; 10 sessions per puppet): time-uniform coverage,
      stopping times vs fixed-n, power vs prop:power.
  E4b slate-state Markov chains of protocol puppets (sec:prot-estimands): true slate states, observed states, and
      the slate-level misclassification correction; predictions vs simulated slate and impression exposure.
  E5b the REGISTERED primary analysis (sec:prot-stopping): double-sampled exposure E~_u (m = 10 flagged, m' = 25
      unflagged codes per puppet: 5 openings + 20 over score bands by Neyman allocation), S = 4 of the 10 sessions,
      waves of 20 pairs, W_max = 6, b = 1, alpha in {0.05, 0.025}; AR and AA confidence sequences (normal mixture
      and betting) under the null, ND and DD; tails of E~_u; variance vs A + n B_ds; the pilot resampling check.
  E5s E5b's statistic and pilot check under two stress designs (waves of 5 or 2 pairs, no burn-in, t* = 40) on
      which the normal-mixture sequence fails; tests whether the pilot check detects the failure.
  E4b, E5b and E5s use detailed pools (raw/pool_detail_<regime>.npz): the E1 pools re-simulated with the same seeds,
  recording per-session counts, opened positions and slate states (identical counts; checked against raw/pool_*).

Usage (from code/):
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py            # full study (2 worker processes)
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E4b,E5b --merge   # add E4b, E5b
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E5s --merge       # add E5s
  python run_experiments.py --quick                                       # smoke run
Outputs: ../results/sim_results.json (summaries, configs, seeds, R, runtimes, versions)
         ../results/raw/pool_<regime>.npz (E1 puppet pools: per-puppet impression counts by type x band)
"""
from __future__ import annotations

import os

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import argparse  # noqa: E402
import json  # noqa: E402
import math  # noqa: E402
import platform  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
from concurrent.futures import ProcessPoolExecutor  # noqa: E402
from dataclasses import replace  # noqa: E402

import numpy as np  # noqa: E402
import scipy  # noqa: E402
from scipy.stats import norm  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from ampsim import __version__ as AMPSIM_VERSION  # noqa: E402
from ampsim import doublesample as ds  # noqa: E402
from ampsim import markov as mk  # noqa: E402
from ampsim import measurement as ms  # noqa: E402
from ampsim import sequential as sq  # noqa: E402
from ampsim.engine import (POL, POLICIES, ChoiceConfig, EvolveConfig, GlobalState, RecConfig,  # noqa: E402
                           SessionConfig, exposure_true, make_puppets, make_real_users, measure, train)
from ampsim.world import PERSONAS, REAL_USER_SHARES, REGIMES, World, WorldConfig  # noqa: E402

BASE_SEED = 20261103
EXP_ID = dict(world=0, E1=1, E2=2, E3=3, E4=4, E5=5, E4b=6, E5b=7, E5s=8)
REG_IDX = {g: i for i, g in enumerate(REGIMES)}
Z95 = float(norm.ppf(0.975))

WCFG = WorldConfig()
REC = RecConfig()
CH = ChoiceConfig()                                       # protocol puppets (avoid-on-flag)
CH_NAT = ChoiceConfig(beta_cur=2.0)                       # naturalistic users (may skip a slate)
CH_NAT_OPEN = ChoiceConfig(beta_cur=2.0, outside=-50.0)   # naturalistic, always open one item (E4 chains)
SES = SessionConfig()
EVO = EvolveConfig()
N_IMPR = SES.n_sessions * SES.T * REC.slate_k


RUNTIME_NOTE = ("sum of the wall times of all runs listed in runs; each run's by_experiment_cpu gives CPU seconds "
                "by part (summed over worker processes)")
E2_XI_NOTE = ("oracle: the sensitivity interval of prop:interference(d) uses xi_Delta at its simulated value (the largest "
              "|bias| / load over the grid, from the paired comparison with the no-audit state), which no audit observes")


def sseq(exp, *keys):
    return np.random.SeedSequence([BASE_SEED, EXP_ID[exp], *[int(k) for k in keys]])


def rng_for(exp, *keys):
    return np.random.default_rng(sseq(exp, *keys))


_WORLD = None


def get_world():
    global _WORLD
    if _WORLD is None:
        _WORLD = World(WCFG, [BASE_SEED, EXP_ID["world"]])
    return _WORLD


def experiment_config(quick: bool):
    q = quick
    return dict(
        E1=dict(pool=150 if q else 1000, chunk=1000, regimes=list(REGIMES), U_grid=[5, 10, 20, 40, 80],
                R=100 if q else 1000, n_val=500, n_val_sens=[250, 1000], U_sens=20,
                refs=["chron", "random", "popular"], primary_ref="chron"),
        E1b=dict(pool=150 if q else 1000, chunk=1000,
                 variants=dict(ND=["ND", 0.0], DD=["DD", 0.0], ND_buckets=["ND", 1.0]), U_grid=[10, 20, 40],
                 R=200 if q else 2000, n1=300, n0=1500),
        E2=dict(U=15 if not q else 6, n_sentinels=8 if not q else 4, refs=["chron", "popular"],
                rho_grid=[0.0, 0.02, 0.05, 0.1, 0.2, 0.3] if not q else [0.0, 0.1, 0.2],
                rho_remedy=[0.0, 0.1, 0.3] if not q else [0.0, 0.1],
                designs=dict(
                    simultaneous=dict(seed_pool=40, waves=1, gap_days=0),
                    low_coview=dict(seed_pool=200, waves=1, gap_days=0),
                    staggered=dict(seed_pool=40, waves=5, gap_days=5)),
                saturation_pairs=[[0.05, 0.1], [0.1, 0.2], [0.1, 0.3]] if not q else [[0.1, 0.2]],
                R=24 if not q else 4, half_life_days=1.0),
        E3=dict(n_users=400 if q else 3000, checkpoints=[3, 10, 20, 40] if not q else [3, 10],
                n_eval=3, n_burn=3, ref="chron"),
        E4=dict(n_acc=60 if q else 250, burn=3, S=10, T=20, T_long=200, tail_from=100,
                tilt=[0.0, 0.1, 0.25, 0.5, 1.0] if not q else [0.0, 0.5],
                replace=[0.0, 0.01, 0.02, 0.05] if not q else [0.0, 0.02], n_boot=200 if not q else 20),
        E5=dict(ref="chron", regimes=["ND", "DD"], N_max=400 if not q else 100, wave=5, m=10, alpha=0.05,
                alpha_protocol=0.0125, lam_range=[0.95, 1.05], lam_range_wide=[0.8, 1.2], t_star=40, delta=1.25,
                W_max=8, W_max_list=[8, 40], grid=[0.1, 10.0, 300], R=2000 if not q else 100,
                R_bet=200 if not q else 20, power_target=0.8),
        DETAIL=dict(regimes=["ND", "DU", "DD"], policies=["alg", "chron"], T_long=200, tail_from=100),
        E4b=dict(regimes=["ND", "DU", "DD"], ref="chron", S=4, T=20, T_long=200, tail_from=100, n_audit=120,
                 R=500 if not q else 50, borderline_band=2),
        E5b=dict(ref="chron", regimes=["ND", "DD"], S=4, wave=20, W_max=6, burn=1, t_star=120, alphas=[0.05, 0.025],
                 m=10, m_open=5, m_unf=20, delta=1.25, R=2000 if not q else 200, grid_ratio=[0.1, 10.0, 300],
                 grid_aa=[-0.1, 0.1, 801],
                 pilot=dict(n_per_cell=10, m_open=10, m_unf=40, R=200 if not q else 10, B=1000 if not q else 50)),
        E5s=dict(note="stress designs, run only to test whether the pilot check detects a failing sequence",
                 designs=[dict(name="moderate", wave=5, burn=0, t_star=40), dict(name="severe", wave=2, burn=0, t_star=40)],
                 N=120, R=2000 if not q else 200),
    )


# =============================================================================================
# helpers
# =============================================================================================
def _clean(x):
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, np.ndarray):
        return _clean(x.tolist())
    if isinstance(x, (np.floating, float)):
        v = float(x)
        if math.isnan(v):
            return None
        if math.isinf(v):
            return "inf" if v > 0 else "-inf"
        return v
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def _mean_se(x):
    x = np.asarray(x, float)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return dict(mean=None, se=None, median=None, n=0)
    return dict(mean=float(x.mean()), se=float(x.std(ddof=1) / np.sqrt(x.size)) if x.size > 1 else None,
                median=float(np.median(x)), n=int(x.size))


def _fun_se(f, X):
    """Value and delta-method SE of f(column means of X) for iid rows X (n, k)."""
    X = np.asarray(X, float)
    n = X.shape[0]
    m = X.mean(0)
    v = f(m)
    g = np.zeros_like(m)
    for j in range(m.size):
        h = 1e-6 * max(abs(m[j]), 1e-3)
        up, dn = m.copy(), m.copy()
        up[j] += h
        dn[j] -= h
        g[j] = (f(up) - f(dn)) / (2 * h)
    S = np.cov(X, rowvar=False)
    return float(v), float(np.sqrt(max(g @ S @ g, 0.0) / n))


# =============================================================================================
# E1: puppet pools (no interference) and estimator evaluation
# =============================================================================================
def task_e1_pool(args):
    regime, P, chunk = args
    w = get_world()
    t0 = time.perf_counter()
    pers = np.repeat(np.arange(4), 4 * P)
    pol = np.tile(np.repeat(np.arange(4), P), 4)
    n = pers.size
    counts = np.zeros((n, 20), np.int32)
    opens = np.zeros((n, 3), np.int32)
    perm = rng_for("E1", 0, REG_IDX[regime]).permutation(n)
    for ci, c0 in enumerate(range(0, n, chunk)):
        idx = perm[c0:c0 + chunk]
        rng = rng_for("E1", 1, REG_IDX[regime], ci)
        acc = make_puppets(w, pers[idx], pol[idx], rng)
        glob = GlobalState(w, REC)
        train(w, acc, glob, REC, SES)
        out = measure(w, acc, glob, REC, CH, SES, rng, regime)
        counts[idx] = out["counts"]
        opens[idx] = out["opens_state"]
    return dict(regime=regime, counts=counts.reshape(4, 4, P, 20), opens=opens.reshape(4, 4, P, 3),
                runtime=time.perf_counter() - t0, seed=[BASE_SEED, EXP_ID["E1"], 1, REG_IDX[regime], "chunk"])


def summarise_estimates(est, AR0, AA0):
    res = {}
    for m, e in est.items():
        if m.startswith("_"):
            continue
        R = e["ar"].size
        ok = e["ok"] & np.isfinite(e["ar"]) & np.isfinite(e["log_se"])
        ar = e["ar"][ok]
        lar = np.log(ar)
        lse = e["log_se"][ok]
        cov_ar = np.zeros(R, bool)
        cov_ar[ok] = np.abs(lar - np.log(AR0)) <= Z95 * lse
        aa, aase = e["aa"], e["aa_se"]
        cov_aa = np.abs(aa - AA0) <= Z95 * aase
        c1, c2 = cov_ar.mean(), cov_aa.mean()
        res[m] = dict(
            R=R, n_ok=int(ok.sum()),
            ar_mean=float(ar.mean()), ar_median=float(np.median(ar)), ar_sd=float(ar.std(ddof=1)),
            ar_bias=float(ar.mean() - AR0), ar_relbias=float(ar.mean() / AR0 - 1),
            ar_relbias_median=float(np.median(ar) / AR0 - 1), ar_bias_mcse=float(ar.std(ddof=1) / np.sqrt(ar.size)),
            ar_rmse=float(np.sqrt(np.mean((ar - AR0) ** 2))),
            log_ar_sd=float(lar.std(ddof=1)), log_se_mean=float(lse.mean()),
            se_ratio=float(lse.mean() / lar.std(ddof=1)) if lar.std() > 0 else None,
            ar_cov=float(c1), ar_cov_mcse=float(np.sqrt(c1 * (1 - c1) / R)),
            aa_mean=float(aa.mean()), aa_median=float(np.median(aa)), aa_sd=float(aa.std(ddof=1)),
            aa_bias=float(aa.mean() - AA0), aa_bias_mcse=float(aa.std(ddof=1) / np.sqrt(R)),
            aa_rmse=float(np.sqrt(np.mean((aa - AA0) ** 2))), aa_se_mean=float(np.mean(aase)),
            aa_cov=float(c2), aa_cov_mcse=float(np.sqrt(c2 * (1 - c2) / R)))
    return res


def pool_truth(counts, opens):
    """Population (pool) quantities per persona x policy from per-puppet counts (4, 4, P, 20)."""
    C = counts.astype(np.int64)
    e_true, e_naive, _ = ms.per_puppet(C, N_IMPR)
    P = C.shape[2]
    c = C.reshape(4, 4, P, 4, 5)
    pos = c[..., 2:, :].sum((2, 3))
    neg = c[..., :2, :].sum((2, 3))
    flag = ms.FLAG
    se = (pos * flag).sum(-1) / pos.sum(-1)
    sp = (neg * (1 - flag)).sum(-1) / neg.sum(-1)
    border = c[..., 1, :].sum((2, 3)) / (P * N_IMPR)
    coded = c[..., 2, :].sum((2, 3)) / np.maximum(c[..., 2:, :].sum((2, 3, 4)), 1)
    out = {}
    for d, pn in enumerate(PERSONAS):
        out[pn] = {}
        for q, pol in enumerate(POLICIES):
            x = e_true[d, q]
            out[pn][pol] = dict(mu=float(x.mean()), mu_mcse=float(x.std(ddof=1) / np.sqrt(P)), sd=float(x.std(ddof=1)),
                                q_naive=float(e_naive[d, q].mean()), se=float(se[d, q]), sp=float(sp[d, q]),
                                borderline_share=float(border[d, q]), coded_share_of_A=float(coded[d, q]),
                                opens_A_per_puppet=float(opens[d, q, :, 2].mean()),
                                opens_per_puppet=float(opens[d, q].sum(-1).mean()))
    return out, e_true, e_naive


def analyse_e1(pools, cfg):
    t0 = time.perf_counter()
    res = dict(config=cfg, regimes={})
    for regime, pl in pools.items():
        truth, e_true, e_naive = pool_truth(pl["counts"], pl["opens"])
        P = e_true.shape[2]
        reg = dict(label=REGIMES[regime]["label"], classifier=REGIMES[regime], pool_size_per_cell=P,
                   pool_runtime_s=pl["runtime"], truth=truth, contrasts={})
        C = pl["counts"].astype(np.int64)
        for ref in cfg["refs"]:
            qr = POL[ref]
            reg["contrasts"][ref] = {}
            for d, pn in enumerate(PERSONAS):
                ea, er = e_true[d, 0], e_true[d, qr]
                AR0, AR0_se = _fun_se(lambda m: m[0] / m[1], np.c_[ea, er])
                AA0 = float(ea.mean() - er.mean())
                AA0_se = float(np.sqrt(ea.var(ddof=1) / P + er.var(ddof=1) / P))
                ta, tr_ = truth[pn]["alg"], truth[pn][ref]
                naive_pop = ta["q_naive"] / tr_["q_naive"]
                # thm:misclass check: naive AR from (p, Se, Sp) of each arm
                qa = ta["se"] * ta["mu"] + (1 - ta["sp"]) * (1 - ta["mu"])
                qrr = tr_["se"] * tr_["mu"] + (1 - tr_["sp"]) * (1 - tr_["mu"])
                cres = dict(AR=AR0, AR_mcse=AR0_se, AA=AA0, AA_mcse=AA0_se, naive_AR_pop=naive_pop,
                            naive_AA_pop=ta["q_naive"] - tr_["q_naive"], naive_AR_formula=qa / qrr,
                            se_alg=ta["se"], se_ref=tr_["se"], sp_alg=ta["sp"], sp_ref=tr_["sp"], by_U={})
                for U in cfg["U_grid"]:
                    rng = rng_for("E1", 2, REG_IDX[regime], qr, d, U)
                    ia = rng.integers(0, P, (cfg["R"], U))
                    ir = rng.integers(0, P, (cfg["R"], U))
                    est = ms.estimate_contrast(C[d, 0][ia], C[d, qr][ir], N_IMPR, cfg["n_val"], rng)
                    s = summarise_estimates(est, AR0, AA0)
                    s["_realised_se_sp"] = {k: float(v.mean()) for k, v in est["_diag"].items()}
                    cres["by_U"][str(U)] = s
                if ref == cfg["primary_ref"]:
                    cres["n_val_sensitivity"] = {}
                    for nv in cfg["n_val_sens"]:
                        U = cfg["U_sens"]
                        rng = rng_for("E1", 3, REG_IDX[regime], qr, d, nv)
                        ia = rng.integers(0, P, (cfg["R"], U))
                        ir = rng.integers(0, P, (cfg["R"], U))
                        est = ms.estimate_contrast(C[d, 0][ia], C[d, qr][ir], N_IMPR, nv, rng,
                                                   methods=("rg_pooled", "rg_strat"))
                        cres["n_val_sensitivity"][str(nv)] = summarise_estimates(est, AR0, AA0)
                reg["contrasts"][ref][pn] = cres
        res["regimes"][regime] = reg
    res["analysis_runtime_s"] = time.perf_counter() - t0
    return res


# =============================================================================================
# E1b: DESIGN's estimators (thm:identify, thm:misclass) with session-level data
# =============================================================================================
def task_e1b_pool(args):
    """Protocol puppets, 4 personas x {alg, chron}, with per-session counts (impressions with L = 1, flagged).
    Variant `buckets`: each account carries a persistent shift ~ N(0, bucket_sd^2) of the alg's bait weight,
    as if the platform served accounts from different experiment buckets (induces intra-puppet correlation)."""
    name, regime, P, chunk, bucket_sd = args
    w = get_world()
    t0 = time.perf_counter()
    pols = [POL["alg"], POL["chron"]]
    pers = np.repeat(np.arange(4), 2 * P)
    pol = np.tile(np.repeat(pols, P), 4)
    n = pers.size
    sess = np.zeros((n, SES.n_sessions, 2), np.int32)
    counts = np.zeros((n, 20), np.int32)
    vkey = 0 if bucket_sd == 0 else 1
    perm = rng_for("E1", 10, REG_IDX[regime], vkey).permutation(n)
    for ci, c0 in enumerate(range(0, n, chunk)):
        idx = perm[c0:c0 + chunk]
        rng = rng_for("E1", 11, REG_IDX[regime], vkey, ci)
        acc = make_puppets(w, pers[idx], pol[idx], rng)
        if bucket_sd > 0:
            acc.bucket = rng.normal(0.0, bucket_sd, acc.B)
        glob = GlobalState(w, REC)
        train(w, acc, glob, REC, SES)
        out = measure(w, acc, glob, REC, CH, SES, rng, regime, record_sessions=True)
        sess[idx] = out["sessions"]
        counts[idx] = out["counts"]
    return dict(regime=regime, name=name, bucket_sd=bucket_sd, sess=sess.reshape(4, 2, P, SES.n_sessions, 2),
                counts=counts.reshape(4, 2, P, 20), runtime=time.perf_counter() - t0)


def _cov(est, se, truth):
    c = float(np.mean(np.abs(est - truth) <= Z95 * se))
    return dict(coverage=c, coverage_mcse=float(np.sqrt(c * (1 - c) / est.size)))


def analyse_e1b(pools, cfg):
    t0 = time.perf_counter()
    kT = SES.T * REC.slate_k
    out = dict(config=cfg, regimes={})
    for regime, pl in pools.items():
        reg = dict(runtime_s=pl["runtime"], classifier_regime=pl["regime"], bucket_sd=pl["bucket_sd"], personas={})
        rk = 100 * REG_IDX[pl["regime"]] + (1 if pl["bucket_sd"] > 0 else 0)
        for d, pn in enumerate(PERSONAS):
            Qs = pl["sess"][d, :, :, :, 1] / kT          # (2, P, S) session flagged shares
            Es = pl["sess"][d, :, :, :, 0] / kT
            Qb, Eb = Qs.mean(-1), Es.mean(-1)
            P, S = Qb.shape[1], Qs.shape[2]
            mu = Eb.mean(1)
            AR0, AA0 = float(mu[0] / mu[1]), float(mu[0] - mu[1])
            c = pl["counts"][d].astype(np.int64).reshape(2, P, 4, 5)
            pos, neg = c[:, :, 2:, :].sum((1, 2)), c[:, :, :2, :].sum((1, 2))
            se_arm = (pos * ms.FLAG).sum(-1) / pos.sum(-1)
            sp_arm = (neg * (1 - ms.FLAG)).sum(-1) / neg.sum(-1)
            se_pool = (pos * ms.FLAG).sum() / pos.sum()
            sp_pool = (neg * (1 - ms.FLAG)).sum() / neg.sum()
            J_arm, J_pool = se_arm + sp_arm - 1, se_pool + sp_pool - 1
            q = Qb.mean(1)
            # design effect and intra-puppet correlation (thm:identify), per arm
            sig2 = Qb.var(1, ddof=1)
            tau2 = Qs.var(1, ddof=1).mean(-1)
            deff = S * sig2 / tau2
            gamma = (deff - 1) / (S - 1)
            # thm:misclass checks at the population level
            omega = (1 - sp_pool) / q[1]
            kap = q / mu
            sp_bar = sp_pool
            ar_pool_formula = (J_arm[0] * mu[0] + sp_bar - sp_arm[0]) / (J_arm[1] * mu[1] + sp_bar - sp_arm[1])
            res = dict(AR=AR0, AA=AA0, mu=mu.tolist(), q=q.tolist(), se_arm=se_arm.tolist(), sp_arm=sp_arm.tolist(),
                       se_pool=float(se_pool), sp_pool=float(sp_pool), deff=deff.tolist(), gamma=gamma.tolist(),
                       naive_AR_pop=float(q[0] / q[1]), omega=float(omega),
                       naive_AR_attenuation_formula=float(omega + (1 - omega) * AR0),
                       naive_AR_kappa_formula=float(AR0 * kap[0] / kap[1]), AR_pool_formula=float(ar_pool_formula),
                       by_U={})
            for U in cfg["U_grid"]:
                rng = rng_for("E1", 12, rk, d, U)
                R = cfg["R"]
                ia, ir = rng.integers(0, P, (R, U)), rng.integers(0, P, (R, U))
                qa, qr = Qb[0][ia].mean(1), Qb[1][ir].mean(1)
                Vc = (Qb[0][ia].var(1, ddof=1) / U, Qb[1][ir].var(1, ddof=1) / U)          # cluster-robust
                Vs = (Qs[0][ia].reshape(R, -1).var(1, ddof=1) / (U * S),
                      Qs[1][ir].reshape(R, -1).var(1, ddof=1) / (U * S))                   # sessions as independent
                rowU = {}
                # (A) known error rates, thm:identify: pooled (valid under asm:id-nondiff) and arm-specific
                for kn, (Sa, Sr, Ja, Jr) in (("known_pooled", (sp_pool, sp_pool, J_pool, J_pool)),
                                             ("known_arm", (sp_arm[0], sp_arm[1], J_arm[0], J_arm[1]))):
                    ma, mr = (qa + Sa - 1) / Ja, (qr + Sr - 1) / Jr
                    aa, lar = ma - mr, np.log(ma / mr)
                    blk = dict(AA_mean=float(aa.mean()), AA_bias=float(aa.mean() - AA0),
                               AR_median=float(np.median(np.exp(lar))), logAR_sd_mc=float(lar.std(ddof=1)))
                    for vn, V in (("cluster", Vc), ("session", Vs)):
                        se_aa = np.sqrt(V[0] / Ja ** 2 + V[1] / Jr ** 2)
                        se_l = np.sqrt(V[0] / (Ja * ma) ** 2 + V[1] / (Jr * mr) ** 2)
                        blk[vn] = dict(AA=_cov(aa, se_aa, AA0), logAR=_cov(lar, se_l, np.log(AR0)),
                                       logAR_se_mean=float(np.nanmean(se_l)))
                    rowU[kn] = blk
                # (B) external validation (thm:misclass(b), (d)): Se, Sp estimated from n1 coded positives and
                #     n0 coded negatives, pooled over arms or separately per arm; delta-method variances
                n1, n0 = cfg["n1"], cfg["n0"]
                for vn, strat in (("external_pooled", False), ("external_strat", True)):
                    if strat:
                        seh = rng.binomial(n1, se_arm[:, None], (2, R)) / n1
                        sph = rng.binomial(n0, sp_arm[:, None], (2, R)) / n0
                    else:
                        seh = np.repeat((rng.binomial(n1, se_pool, R) / n1)[None], 2, 0)
                        sph = np.repeat((rng.binomial(n0, sp_pool, R) / n0)[None], 2, 0)
                    Jh = seh + sph - 1
                    ma, mr = (qa + sph[0] - 1) / Jh[0], (qr + sph[1] - 1) / Jh[1]
                    ok = (ma > 0) & (mr > 0)
                    aa = ma - mr
                    lar = np.where(ok, np.log(np.maximum(ma, 1e-12) / np.maximum(mr, 1e-12)), np.nan)
                    vse, vsp = seh * (1 - seh) / n1, sph * (1 - sph) / n0
                    if strat:
                        va = (Vc[0] + ma ** 2 * vse[0] + (1 - ma) ** 2 * vsp[0]) / Jh[0] ** 2
                        vr = (Vc[1] + mr ** 2 * vse[1] + (1 - mr) ** 2 * vsp[1]) / Jh[1] ** 2
                        v_aa = va + vr
                        v_l = va / ma ** 2 + vr / mr ** 2
                    else:   # eq. (mc-varAA), (mc-varAR)
                        Jc = Jh[0]
                        v_aa = (Vc[0] + Vc[1] + aa ** 2 * (vse[0] + vsp[0])) / Jc ** 2
                        v_l = (Vc[0] / ma ** 2 + Vc[1] / mr ** 2 + (1 / ma - 1 / mr) ** 2 * vsp[0]) / Jc ** 2
                    lv = lar[ok]
                    rowU[vn] = dict(n_ok=int(ok.sum()), AA_mean=float(aa.mean()), AA_bias=float(aa.mean() - AA0),
                                    AA_sd_mc=float(aa.std(ddof=1)), AA_sd_delta=float(np.sqrt(np.mean(v_aa))),
                                    AR_median=float(np.median(np.exp(lv))), logAR_sd_mc=float(lv.std(ddof=1)),
                                    logAR_sd_delta=float(np.sqrt(np.nanmean(v_l[ok]))),
                                    logAR_sd_delta_median=float(np.sqrt(np.nanmedian(v_l[ok]))),
                                    kappa_Sp=float(np.sqrt(sp_arm[1] * (1 - sp_arm[1]) / n0) / (J_arm[1] * mu[1])),
                                    AA=_cov(aa, np.sqrt(v_aa), AA0),
                                    logAR=_cov(np.where(ok, lar, 1e9), np.sqrt(np.where(ok, v_l, 1.0)), np.log(AR0)))
                rowU["naive_AR_median"] = float(np.median(qa / qr))
                res["by_U"][str(U)] = rowU
            reg["personas"][pn] = res
        out["regimes"][regime] = reg
    out["runtime"] = time.perf_counter() - t0
    return out


def e2_bounds(e2):
    """Post-hoc checks of prop:interference computed from the E2 summary: curvature zeta of AA(l) and the
    extrapolation bound zeta l1 l2 / 2 (part (c)); the log-ratio bound of part (a)."""
    out = {}
    sim = e2["designs"]["simultaneous"]
    rhos = sorted(sim["by_rho"], key=float)
    loads = np.array([sim["by_rho"][r]["load"]["mean"] for r in rhos])
    for pn in PERSONAS:
        out[pn] = {}
        for ref in e2["config"]["refs"]:
            b = np.array([sim["by_rho"][r]["personas"][pn][ref]["bias_AA"]["mean"] for r in rhos])
            # second divided differences of AA(l) (= AA0 + bias) on consecutive grid triples
            dd = [2 * abs((b[i + 1] - b[i]) / (loads[i + 1] - loads[i]) - (b[i] - b[i - 1]) / (loads[i] - loads[i - 1]))
                  / (loads[i + 1] - loads[i - 1]) for i in range(1, len(rhos) - 1)]
            cq = np.polyfit(loads, b, 2)[0]
            zeta_dd, zeta_q = float(max(dd)), float(abs(2 * cq))
            sat = {}
            for key, sv in e2.get("saturation", {}).items():
                x = sv[pn][ref]
                l1, l2 = x["load1"], x["load2"]
                sat[key] = dict(bound_dd=0.5 * zeta_dd * l1 * l2, bound_quadfit=0.5 * zeta_q * l1 * l2,
                                abs_bias_extrapolated=abs(x["bias_extrapolated"]["mean"]),
                                bias_extrapolated_se=x["bias_extrapolated"]["se"])
            ratio = {}
            for r in rhos[1:]:
                row = sim["by_rho"][r]
                ell = row["load"]["mean"]
                terms = []
                for arm in ("alg", ref):
                    xi = sim["xi"][pn][arm]
                    M = row["personas"][pn]["mu"][arm]["mean"]
                    terms.append(xi * ell / (M - xi * ell) if M > xi * ell else float("inf"))
                ratio[r] = dict(bound=float(sum(terms)), abs_bias_logAR=abs(row["personas"][pn][ref]["bias_logAR"]["mean"]),
                                bound_AA=sim["xi"][pn]["Delta_" + ref] * ell,
                                bound_AA_sum=(sim["xi"][pn]["alg"] + sim["xi"][pn][ref]) * ell,
                                abs_bias_AA=abs(row["personas"][pn][ref]["bias_AA"]["mean"]))
            out[pn][ref] = dict(zeta_second_difference=zeta_dd, zeta_quadratic_fit=zeta_q, saturation=sat, part_a=ratio)
    return out


# =============================================================================================
# E2: interference through the shared popularity model
# =============================================================================================
def run_dynamic_audit(w, design, rho, cfg, rep, crn_key):
    """One audit with puppets feeding the global popularity model (dynamic GlobalState).

    The platform's background engagement volume V is fixed by the target traffic share rho of the full audit
    run simultaneously: V = n_puppets (1 - rho) / rho opens per round. Staggered designs split the same
    puppets into waves separated by a washout, which lowers the instantaneous load. Returns per-puppet true
    exposures by cell, sentinel exposures (before and during the audit), the realised traffic share and the
    local load (puppets' share of the engagement signal on the items they opened), wave-averaged."""
    U, nS = cfg["U"], cfg["n_sentinels"]
    refs = [POL[r] for r in cfg["refs"]]
    pols = [POL["alg"]] + refs
    waves = design["waves"]
    delta = 0.5 ** (1.0 / (cfg["half_life_days"] * SES.day_rounds))
    rng = rng_for("E2", 1, *crn_key, rep)
    pers = np.repeat(np.arange(4), len(pols) * U)
    pol = np.tile(np.repeat(pols, U), 4)
    n_aud = pers.size
    wave_of = rng.permutation(np.arange(n_aud) % waves)
    sent_wave = np.arange(nS) % waves
    V = (n_aud + nS) * (1 - rho) / rho if rho > 0 else 1.0
    glob = GlobalState(w, REC, V=V, delta=delta, dynamic=rho > 0)
    # baseline sentinels: measured before the audit starts; they do not feed popularity
    sen0 = make_puppets(w, np.zeros(nS, np.int64), POL["alg"], rng, train=False)
    sen0.counted[:] = False
    out0 = measure(w, sen0, glob, REC, CH, SES, rng, "ND", idle_after=False)
    sent_base = exposure_true(w, out0["counts"], out0["n_impr"])
    glob.local_load(reset=True)
    aud = make_puppets(w, pers, pol, rng, seed_pool=design["seed_pool"])
    sen = make_puppets(w, np.zeros(nS, np.int64), POL["alg"], rng, train=False)
    e_aud = np.zeros(n_aud)
    e_sen = np.zeros(nS)
    shifts, loads, shares = [], [], []
    for wv in range(waves):
        ia = np.flatnonzero(wave_of == wv)
        isn = np.flatnonzero(sent_wave == wv)
        both = _concat_accounts([aud.subset(ia), sen.subset(isn)])
        p0 = glob.puppet_opens
        train(w, both, glob, REC, SES)
        out = measure(w, both, glob, REC, CH, SES, rng, "ND")
        e = exposure_true(w, out["counts"], out["n_impr"])
        e_aud[ia] = e[:ia.size]
        e_sen[isn] = e[ia.size:]
        shifts.append(glob.share_shift())
        act = SES.train_days * SES.seeds_per_day + SES.n_sessions * SES.T
        po = glob.puppet_opens - p0
        shares.append(po / (po + V * act) if rho > 0 else 0.0)
        loads.append(glob.local_load(reset=True) if rho > 0 else 0.0)
        if wv < waves - 1:
            glob.idle(design["gap_days"] * SES.day_rounds)
            glob.local_load(reset=True)
    return dict(e=e_aud.reshape(4, len(pols), U), sent_base=sent_base, sent_audit=e_sen,
                tv_shift_end_of_wave=shifts, realised_share=float(np.mean(shares)), load=float(np.mean(loads)), V=V)


def _concat_accounts(lst):
    from ampsim.engine import Accounts
    out = {}
    for k in Accounts.__dataclass_fields__:
        vals = [getattr(a, k) for a in lst]
        out[k] = None if vals[0] is None else np.concatenate(vals, axis=0)
    return Accounts(**out)


def task_e2(args):
    dname, design, rho, cfg, reps = args
    w = get_world()
    t0 = time.perf_counter()
    dkey = list(cfg["designs"]).index(dname)
    res = []
    for rep in reps:
        # common random numbers across rho within a design: the seed does not depend on rho
        r = run_dynamic_audit(w, design, rho, cfg, rep, crn_key=(dkey,))
        res.append(r)
    return dict(design=dname, rho=rho, reps=list(reps), out=res, runtime=time.perf_counter() - t0)


def analyse_e2(raw, cfg):
    """Bias of AA / log AR under interference (paired with the rho = 0 audit of the same replication, i.e.
    common random numbers), the slopes xi of asm:id-bounded, the bound of prop:interference(a), the direction
    of part (b), randomised-saturation extrapolation (part (c)), sensitivity intervals (part (d)) and sentinel
    slopes."""
    refs = cfg["refs"]
    arms = ["alg"] + refs
    designs = {}
    for dname in cfg["designs"]:
        by_rho = {}
        for r in raw:
            if r["design"] == dname:
                by_rho.setdefault(r["rho"], []).extend(zip(r["reps"], r["out"]))
        rhos = sorted(by_rho)
        for k in rhos:
            by_rho[k] = [o for _, o in sorted(by_rho[k], key=lambda t: t[0])]
        base = by_rho[0.0]
        R = len(base)
        E0 = np.stack([o["e"] for o in base])            # (R, 4, n_arms, U)
        m0 = E0.mean(-1)
        U = E0.shape[-1]
        truth = m0.mean(0)                               # no-audit means (rho = 0), MC over R x U puppets
        rows = {}
        for rho in rhos:
            cur = by_rho[rho]
            E = np.stack([o["e"] for o in cur])
            m = E.mean(-1)
            v = E.var(-1, ddof=1) / U
            load = np.array([o["load"] for o in cur])
            ell = float(load.mean())
            row = dict(R=R, traffic_share=_mean_se([o["realised_share"] for o in cur]), load=_mean_se(load),
                       tv_shift=_mean_se([np.max(o["tv_shift_end_of_wave"]) for o in cur]),
                       sentinel=dict(base=_mean_se(np.concatenate([o["sent_base"] for o in cur])),
                                     audit=_mean_se(np.concatenate([o["sent_audit"] for o in cur])),
                                     shift=_mean_se([np.mean(o["sent_audit"]) - np.mean(o["sent_base"]) for o in cur])),
                       personas={})
            for d, pn in enumerate(PERSONAS):
                pr = dict(shift={}, mu={})
                for j, arm in enumerate(arms):
                    pr["shift"][arm] = _mean_se(m[:, d, j] - m0[:, d, j])     # m_{d,pi}(l) - m_{d,pi}(0), paired
                    pr["mu"][arm] = _mean_se(m[:, d, j])
                    pr["mu_truth_" + arm] = float(truth[d, j])
                for j, ref in enumerate(refs, start=1):
                    aa = m[:, d, 0] - m[:, d, j]
                    aa0 = m0[:, d, 0] - m0[:, d, j]
                    se = np.sqrt(v[:, d, 0] + v[:, d, j])
                    AA0 = float(truth[d, 0] - truth[d, j])
                    cov = float(np.mean(np.abs(aa - AA0) <= Z95 * se))
                    pr[ref] = dict(AA_truth=AA0, AA_hat=_mean_se(aa), bias_AA=_mean_se(aa - aa0),
                                   rel_bias_AA=float((aa - aa0).mean() / AA0) if AA0 != 0 else None,
                                   bias_logAR=_mean_se(np.log(m[:, d, 0] / m[:, d, j]) - np.log(m0[:, d, 0] / m0[:, d, j])),
                                   coverage_wald=cov, coverage_wald_mcse=float(np.sqrt(cov * (1 - cov) / R)),
                                   se_mean=float(se.mean()))
                row["personas"][pn] = pr
            rows[str(rho)] = row
        # slopes xi per unit of load (asm:id-bounded), estimated as max over the grid of |shift| / load
        xi = {}
        pos = [r for r in rhos if r > 0]
        for pn in PERSONAS:
            xi[pn] = {}
            for arm in arms:
                xi[pn][arm] = max(abs(rows[str(r)]["personas"][pn]["shift"][arm]["mean"]) / rows[str(r)]["load"]["mean"]
                                  for r in pos) if pos else None
            for ref in refs:
                xi[pn]["Delta_" + ref] = max(abs(rows[str(r)]["personas"][pn][ref]["bias_AA"]["mean"])
                                            / rows[str(r)]["load"]["mean"] for r in pos) if pos else None
        designs[dname] = dict(design=cfg["designs"][dname], by_rho=rows, xi=xi)
    out = dict(config=cfg, designs=designs)
    # ---- prop:interference(b): direction (exposure non-increasing in load for popularity-learning arms)
    sim = designs["simultaneous"]
    rhos = sorted(float(r) for r in sim["by_rho"])
    direction = {}
    for pn in PERSONAS:
        direction[pn] = {}
        for arm in ["alg"] + [r for r in refs if r == "popular"]:
            sh = [sim["by_rho"][str(r)]["personas"][pn]["shift"][arm]["mean"] for r in rhos]
            direction[pn][arm] = dict(shift_by_rho=sh, non_increasing=bool(np.all(np.diff(sh) <= 1e-12)))
    out["direction"] = direction
    # ---- prop:interference(c): randomised saturation from independent replications at two loads
    sat = {}
    raw_sim = {}
    for r in raw:
        if r["design"] == "simultaneous":
            raw_sim.setdefault(r["rho"], []).extend(zip(r["reps"], r["out"]))
    for k in raw_sim:
        raw_sim[k] = [o for _, o in sorted(raw_sim[k], key=lambda t: t[0])]
    for (r1, r2) in cfg["saturation_pairs"]:
        if r1 not in raw_sim or r2 not in raw_sim:
            continue
        A1, A2 = raw_sim[r1], raw_sim[r2]
        R = len(A1)
        sh = R // 2
        key = f"{r1}/{r2}"
        sat[key] = {}
        for d, pn in enumerate(PERSONAS):
            sat[key][pn] = {}
            for j, ref in enumerate(refs, start=1):
                aa1 = np.array([o["e"][d, 0].mean() - o["e"][d, j].mean() for o in A1])
                aa2 = np.array([A2[(i + sh) % R]["e"][d, 0].mean() - A2[(i + sh) % R]["e"][d, j].mean() for i in range(R)])
                l1 = np.array([o["load"] for o in A1])
                l2 = np.array([A2[(i + sh) % R]["load"] for i in range(R)])
                ex = (l2 * aa1 - l1 * aa2) / (l2 - l1)
                slope = (aa2 - aa1) / (l2 - l1)
                AA0 = sim["by_rho"]["0.0"]["personas"][pn][ref]["AA_truth"]
                sat[key][pn][ref] = dict(load1=float(l1.mean()), load2=float(l2.mean()),
                                         bias_naive_l1=_mean_se(aa1 - AA0), bias_extrapolated=_mean_se(ex - AA0),
                                         sd_naive_l1=float(aa1.std(ddof=1)), sd_extrapolated=float(ex.std(ddof=1)),
                                         variance_ratio=float(ex.var(ddof=1) / aa1.var(ddof=1)),
                                         slope=_mean_se(slope))
    out["saturation"] = sat
    # ---- prop:interference(d): sensitivity interval with xi_Delta = empirical slope; breakdown values
    sens = {}
    for r in rhos:
        if r == 0:
            continue
        cur = [o for o in raw_sim[r]]
        sens[str(r)] = {}
        for d, pn in enumerate(PERSONAS):
            sens[str(r)][pn] = {}
            for j, ref in enumerate(refs, start=1):
                aa = np.array([o["e"][d, 0].mean() - o["e"][d, j].mean() for o in cur])
                se = np.array([np.sqrt(o["e"][d, 0].var(ddof=1) / o["e"].shape[-1] + o["e"][d, j].var(ddof=1) / o["e"].shape[-1])
                               for o in cur])
                ell = np.array([o["load"] for o in cur])
                AA0 = sim["by_rho"]["0.0"]["personas"][pn][ref]["AA_truth"]
                xiD = sim["xi"][pn]["Delta_" + ref]
                cov_wald = float(np.mean(np.abs(aa - AA0) <= Z95 * se))
                cov_sens = float(np.mean(np.abs(aa - AA0) <= Z95 * se + xiD * ell))
                brk = np.maximum(np.abs(aa) - Z95 * se, 0) / ell
                sens[str(r)][pn][ref] = dict(xi_Delta=xiD, coverage_wald=cov_wald, coverage_sensitivity=cov_sens,
                                             breakdown_xi=_mean_se(brk),
                                             sign_established_wald=float(np.mean(np.abs(aa) > Z95 * se)))
    out["sensitivity"] = sens
    # ---- sentinels: slope of sentinel exposure in load vs slopes of trained arms
    L = np.concatenate([[o["load"]] * len(o["sent_audit"]) for r in rhos for o in raw_sim[r]])
    Y = np.concatenate([o["sent_audit"] - np.mean(o["sent_base"]) for r in rhos for o in raw_sim[r]])
    slope_s = float(np.polyfit(L, Y, 1)[0]) if np.ptp(L) > 0 else None
    arm_slopes = {}
    for d, pn in enumerate(PERSONAS):
        arm_slopes[pn] = {}
        for j, arm in enumerate(arms):
            x = np.array([sim["by_rho"][str(r)]["load"]["mean"] for r in rhos])
            y = np.array([sim["by_rho"][str(r)]["personas"][pn]["shift"][arm]["mean"] for r in rhos])
            arm_slopes[pn][arm] = float(np.polyfit(x, y, 1)[0])
    out["sentinel_slope"] = dict(sentinel=slope_s, trained_arms=arm_slopes)
    return out


# =============================================================================================
# E3: supply / demand decomposition with evolving demand
# =============================================================================================
def _fixed_demand(w, glob, src, a, n_burn, n_eval, rng):
    """Persona-level mean exposure mu_a(d) for each account's demand d: a fresh account (v = 0) with that
    demand held fixed, served by policy a for n_burn sessions, then measured for n_eval sessions."""
    acc = src.copy()
    acc.policy[:] = a
    acc.v[:] = 0.0
    measure(w, acc, glob, REC, CH_NAT, SES, rng, "ND", n_sessions=n_burn)
    out = measure(w, acc, glob, REC, CH_NAT, SES, rng, "ND", n_sessions=n_eval)
    return exposure_true(w, out["counts"], out["n_impr"])


def _decomp(c):
    """Decomposition of thm:decomp from per-user cell exposures c[(a, b)] (paired by user)."""
    X = np.c_[c[("alg", "alg")], c[("ref", "alg")], c[("alg", "ref")], c[("ref", "ref")]]
    f = dict(
        mu_alg_alg=lambda m: m[0], mu_ref_alg=lambda m: m[1], mu_alg_ref=lambda m: m[2], mu_ref_ref=lambda m: m[3],
        tau=lambda m: m[0] - m[3], tau_sup=lambda m: m[2] - m[3], tau_dem=lambda m: m[1] - m[3],
        iota=lambda m: m[0] - m[1] - m[2] + m[3],
        phi_sup=lambda m: (m[2] - m[3]) + 0.5 * (m[0] - m[1] - m[2] + m[3]),
        phi_dem=lambda m: (m[1] - m[3]) + 0.5 * (m[0] - m[1] - m[2] + m[3]),
        TR=lambda m: m[0] / m[3], AR_Fref=lambda m: m[2] / m[3], AR_Falg=lambda m: m[0] / m[1],
        DR_ref=lambda m: m[1] / m[3], DR_alg=lambda m: m[0] / m[2],
        Phi_sup=lambda m: np.sqrt((m[2] / m[3]) * (m[0] / m[1])),
        Phi_dem=lambda m: np.sqrt((m[1] / m[3]) * (m[0] / m[2])),
        iota_mult=lambda m: (m[0] / m[1]) / (m[2] / m[3]))
    out = {}
    for k, fn in f.items():
        v, se = _fun_se(fn, X)
        out[k] = dict(value=v, se=se)
    return out


def task_e3(cfg):
    w = get_world()
    t0 = time.perf_counter()
    ref = POL[cfg["ref"]]
    pol_of = dict(alg=POL["alg"], ref=ref)
    users = make_real_users(w, cfg["n_users"], rng_for("E3", 0))
    glob = GlobalState(w, REC)
    out = dict(n_users=cfg["n_users"], type_counts=np.bincount(users.persona, minlength=4).tolist(), checkpoints={})
    # fixed-demand audit at the initial demand distribution F0
    F0 = {a: _fixed_demand(w, glob, users, pol_of[a], cfg["n_burn"], cfg["n_eval"], rng_for("E3", 1, i))
          for i, a in enumerate(("alg", "ref"))}
    out["AA_ref_F0"] = dict(zip(("value", "se"), _fun_se(lambda m: m[0] - m[1], np.c_[F0["alg"], F0["ref"]])))
    out["AR_ref_F0"] = dict(zip(("value", "se"), _fun_se(lambda m: m[0] / m[1], np.c_[F0["alg"], F0["ref"]])))
    out["mu_F0"] = {a: _mean_se(F0[a]) for a in F0}
    out["AA_ref_F0_by_type"] = {PERSONAS[t]: float(F0["alg"][users.persona == t].mean()
                                                    - F0["ref"][users.persona == t].mean()) for t in range(4)}
    formed = {}
    for b in ("alg", "ref"):
        acc = users.copy()
        acc.policy[:] = pol_of[b]
        formed[b] = acc
    h = 0
    traj = {b: [] for b in formed}
    for ci, H in enumerate(cfg["checkpoints"]):
        for bi, b in enumerate(("alg", "ref")):
            rng = rng_for("E3", 2, bi, H)
            for _ in range(H - h):
                o = measure(w, formed[b], glob, REC, CH_NAT, SES, rng, "ND", n_sessions=1, evolve=EVO)
                traj[b].append(float(exposure_true(w, o["counts"], o["n_impr"]).mean()))
        h = H
        cells, fixed, demand = {}, {}, {}
        for bi, b in enumerate(("alg", "ref")):
            acc_b = formed[b]
            demand[b] = dict(alpha_B=float(acc_b.alpha[:, 1].mean()), alpha_A=float(acc_b.alpha[:, 2].mean()),
                             fringe=float(acc_b.fringe.mean()), theta_eA=float(acc_b.theta[:, 6].mean()))
            for ai, a in enumerate(("alg", "ref")):
                acc = acc_b.copy()
                acc.policy[:] = pol_of[a]
                o = measure(w, acc, glob, REC, CH_NAT, SES, rng_for("E3", 3, H, bi, ai), "ND", n_sessions=cfg["n_eval"])
                cells[(a, b)] = exposure_true(w, o["counts"], o["n_impr"])
                fixed[(a, b)] = _fixed_demand(w, glob, acc_b, pol_of[a], cfg["n_burn"], cfg["n_eval"],
                                              rng_for("E3", 4, H, bi, ai))
        dec = _decomp(cells)
        dec_fixed = _decomp(fixed)
        gaps = {f"{a};{b}": _mean_se(cells[(a, b)] - fixed[(a, b)]) for a in ("alg", "ref") for b in ("alg", "ref")}
        # bilinear form (thm:decomp(c)) under asm:demand: tau_sup = AA(F_ref), tau_sup + iota = AA(F_alg)
        out["checkpoints"][str(H)] = dict(
            H=H, demand=demand, decomposition=dec, fixed_demand_decomposition=dec_fixed, asm_demand_gap=gaps,
            AA_ref_Fref=dec_fixed["tau_sup"], AA_ref_Falg=dict(
                value=dec_fixed["tau_sup"]["value"] + dec_fixed["iota"]["value"]),
            audit_F0_minus_tau=dict(zip(("value", "se"), _fun_se(
                lambda m: (m[0] - m[1]) - (m[2] - m[3]),
                np.c_[F0["alg"], F0["ref"], cells[("alg", "alg")], cells[("ref", "ref")]]))))
    out["formation_trajectory"] = traj
    out["runtime"] = time.perf_counter() - t0
    return out


def persona_contrast_decomp(e_true, ref):
    """Registered persona-contrast decomposition (sec:est-audit) relative to the baseline persona d0."""
    q = POL[ref]
    mu = e_true.mean(-1)
    P = e_true.shape[-1]
    out = {}
    for d in range(1, 4):
        a0, r0, a1, r1 = mu[0, 0], mu[0, q], mu[d, 0], mu[d, q]
        iota = (a1 - r1) - (a0 - r0)
        se = lambda *xs: float(np.sqrt(sum(e_true[i, j].var(ddof=1) for i, j in xs) / P))
        out[PERSONAS[d]] = dict(total=float(a1 - r0), supply_contrast=float(a0 - r0), demand_contrast=float(r1 - r0),
                                interaction=float(iota), phi_sup=float(a0 - r0 + iota / 2),
                                phi_dem=float(r1 - r0 + iota / 2),
                                interaction_mcse=se((d, 0), (d, q), (0, 0), (0, q)))
    return out


# =============================================================================================
# E4: Markov exposure model
# =============================================================================================
def task_e4(args):
    kind, eps, cfg = args
    w = get_world()
    t0 = time.perf_counter()
    if kind == "base":
        rec, pols = REC, [POL["alg"], POL["chron"]]
    elif kind == "tilt":
        rec, pols = replace(REC, eps_anti=float(eps)), [POL["alg"]]
    else:
        rec, pols = replace(REC, replace_anti=float(eps)), [POL["alg"]]
    n = cfg["n_acc"]
    pers = np.repeat(np.arange(4), len(pols) * n)
    pol = np.tile(np.repeat(pols, n), 4)
    G = 4 * len(pols)
    grp = np.repeat(np.arange(G), n)
    glob = GlobalState(w, rec)
    rng = rng_for("E4", 1, 0 if kind == "base" else 1)       # CRN across eps within a kind
    acc = make_puppets(w, pers, pol, rng, choice=1, train=False, group=grp)
    measure(w, acc, glob, rec, CH_NAT_OPEN, SES, rng, "ND", n_sessions=cfg["burn"])
    est = measure(w, acc, glob, rec, CH_NAT_OPEN, SES, rng, "ND", n_sessions=cfg["S"], T=cfg["T"],
                  record_markov=True, n_groups=G)
    lng = measure(w, acc, glob, rec, CH_NAT_OPEN, SES, rng, "ND", n_sessions=1, T=cfg["T_long"],
                  record_markov=True, n_groups=G)
    res = []
    for g in range(G):
        m = grp == g
        res.append(dict(persona=PERSONAS[int(pers[m][0])], policy=POLICIES[int(pol[m][0])],
                        trans=est["trans"][m], occ_est=est["occ"][g], occ_long=lng["occ"][g],
                        slateA_est=est["expA"][g] / (est["gsize"][g] * REC.slate_k),
                        hit_long=lng["hit"][m][:, 0], n_acc=int(m.sum())))
    return dict(kind=kind, eps=eps, groups=res, runtime=time.perf_counter() - t0)


def _chain_preds(trans_sum, T, T_long):
    P, _ = mk.estimate_P(trans_sum)
    a = np.array([1.0, 0.0, 0.0])
    s = mk.summaries(P, a, horizons=(T, T_long))
    s["E_pi_tau_A"] = float(mk.stationary(P) @ mk.mfpt(P)[:, 2])
    s["p_reach_T_long"] = 1.0 - mk.prob_no_hit(P, a, T_long)
    return P, s


def analyse_e4(raw, cfg):
    T, TL, tf = cfg["T"], cfg["T_long"], cfg["tail_from"]
    rngb = rng_for("E4", 9)
    fit = {}
    groups = {}
    for r in raw:
        for g in r["groups"]:
            groups[(r["kind"], r["eps"], g["persona"], g["policy"])] = g

    def sim_stats(g):
        occ = g["occ_est"] / g["occ_est"].sum(1, keepdims=True)
        ol = g["occ_long"] / g["occ_long"].sum(1, keepdims=True)
        per_acc_e = g["trans"][:, 2, :].sum(1) / g["trans"].sum((1, 2))
        hit = g["hit_long"]
        return dict(e_T=float(occ[:, 2].mean()), e_T_se=float(per_acc_e.std(ddof=1) / np.sqrt(per_acc_e.size)),
                    e_T_long=float(ol[:, 2].mean()), tail=float(ol[tf:, 2].mean()),
                    p_reach_T=float(np.mean((hit >= 0) & (hit < T))), p_reach_T_long=float(np.mean(hit >= 0)),
                    slate_e_T=float(g["slateA_est"].mean()))

    def boot(g, keys, B):
        tr = g["trans"]
        vals = {k: [] for k in keys}
        for _ in range(B):
            i = rngb.integers(0, tr.shape[0], tr.shape[0])
            s = _chain_preds(tr[i].sum(0), T, TL)[1]
            for k in keys:
                vals[k].append(s[k])
        return {k: float(np.std(v, ddof=1)) for k, v in vals.items()}

    for (kind, eps, pn, pol), g in groups.items():
        if kind != "base":
            continue
        P, s = _chain_preds(g["trans"].sum(0), T, TL)
        sim = sim_stats(g)
        se = boot(g, ("e_%d" % T, "e_%d" % TL, "pi_A", "p_reach_20", "kappa_A"), cfg["n_boot"])
        fit.setdefault(pn, {})[pol] = dict(P=P, pred=s, pred_boot_se=se, sim=sim)
    # perturbation
    pert = {}
    for kind in ("tilt", "replace"):
        eps_list = cfg[kind]
        pert[kind] = {}
        for pn in PERSONAS:
            g0 = groups[(kind, eps_list[0], pn, "alg")]
            P0, s0 = _chain_preds(g0["trans"].sum(0), T, TL)
            sim0 = sim_stats(g0)
            rows = []
            for eps in eps_list:
                g1 = groups[(kind, eps, pn, "alg")]
                P1, s1 = _chain_preds(g1["trans"].sum(0), T, TL)
                sim1 = sim_stats(g1)
                pt = mk.perturbation(P0, P1, a=np.array([1.0, 0, 0]), T=T)
                row = dict(eps=eps, P=P1, model=pt, sim_delta_tail=sim1["tail"] - sim0["tail"],
                           sim_delta_eT=sim1["e_T"] - sim0["e_T"], sim_delta_slate=sim1["slate_e_T"] - sim0["slate_e_T"],
                           sim_tail=sim1["tail"], sim_eT=sim1["e_T"], sim_slate=sim1["slate_e_T"])
                if kind == "replace" and eps > 0:
                    # thm:perturb(c): predicted from the base chain alone
                    Pe = (1 - eps) * P0 + eps * np.outer(np.ones(3), [0, 0, 1.0])
                    piA = mk.stationary(Pe)[2]
                    row["pred_c_exact_piA"] = float(piA)
                    row["pred_c_first_order_piA"] = float(s0["pi_A"] * (1 + eps * s0["E_pi_tau_A"]))
                    row["pred_c_eT"] = mk.e_T(Pe, np.array([1.0, 0, 0]), T)
                rows.append(row)
            pert[kind][pn] = dict(base_pi_A=s0["pi_A"], base_kappa_A=s0["kappa_A"], base_E_pi_tau_A=s0["E_pi_tau_A"],
                                  base_sim_tail=sim0["tail"], rows=rows)
    return dict(config=cfg, fit=fit, perturbation=pert)


# =============================================================================================
# E5: sequential audit
# =============================================================================================
def _pool_arm(C, d, q):
    """Per-puppet flagged share Q, true exposure E, flagged-positive and flagged-negative counts for a cell."""
    c = C[d, q].astype(np.int64).reshape(-1, 4, 5)
    flag = ms.FLAG.astype(bool)
    Q = c[..., flag].sum((1, 2)) / N_IMPR
    E = c[:, 2:, :].sum((1, 2)) / N_IMPR
    fpos = c[:, 2:, :][..., flag].sum((1, 2))
    fneg = c[:, :2, :][..., flag].sum((1, 2))
    pos = c[:, 2:, :].sum((1, 2))
    neg = c[:, :2, :].sum((1, 2))
    return dict(Q=Q, E=E, fpos=fpos, fneg=fneg, pos=pos, neg=neg)


def _decision(L, U, delta):
    """Conclusion of tab:prot-decisions from the final interval [L, U] for log AR."""
    ld = np.log(delta)
    if not (L <= U):
        return "empty"
    if L > ld:
        return "material_amplification"
    if U < -ld:
        return "material_deamplification"
    if L > -ld and U < ld:
        return "no_material_difference"
    if L > 0 or U < 0:
        return "difference_materiality_undetermined"
    return "inconclusive"


def _wrong(dec, L, U, logAR, delta):
    """Is the stated conclusion contradicted by the true AR?"""
    ld = np.log(delta)
    if dec == "material_amplification":
        return logAR <= ld
    if dec == "material_deamplification":
        return logAR >= -ld
    if dec == "no_material_difference":
        return not (-ld < logAR < ld)
    if dec == "difference_materiality_undetermined":
        return (L > 0 and logAR <= 0) or (U < 0 and logAR >= 0)
    return False


def _y_stat(X, idx, m, rng):
    """Confirmed-flagged statistic Y_u = Qbar_u Phat_u: m of the puppet's flagged positions are coded
    (without replacement; all of them if fewer than m)."""
    fp, fn = X["fpos"][idx], X["fneg"][idx]
    fl = fp + fn
    mu_ = np.minimum(m, fl)
    a = np.zeros(idx.shape, np.int64)
    k = mu_ > 0
    a[k] = rng.hypergeometric(fp[k], fn[k], mu_[k])
    return np.where(k, (fl / N_IMPR) * a / np.maximum(mu_, 1), 0.0)


def _stop_and_decide(L, U, delta, Wmax, burn, logAR):
    R = L.shape[0]
    ld = np.log(delta)
    stop = np.full(R, Wmax)
    dec, wrong = [], 0
    for i in range(R):
        ws = Wmax
        for w in range(burn, Wmax):
            l_, u_ = L[i, w], U[i, w]
            if l_ > ld or u_ < -ld or (-ld < l_ <= u_ < ld):
                ws = w + 1
                break
        stop[i] = ws
        dd = _decision(L[i, ws - 1], U[i, ws - 1], delta)
        dec.append(dd)
        wrong += _wrong(dd, L[i, ws - 1], U[i, ws - 1], logAR, delta)
    cats, cnt = np.unique(dec, return_counts=True)
    return dict(mean_stop_wave=float(stop.mean()), median_stop_wave=float(np.median(stop)),
                stopped_early=float(np.mean(stop < Wmax)), decisions={str(k): float(c / R) for k, c in zip(cats, cnt)},
                wrong_conclusion=float(wrong / R), wrong_conclusion_mcse=float(np.sqrt(wrong / R * (1 - wrong / R) / R)),
                mean_pairs_used=float(stop.mean() * 5))


def analyse_e5(pools, cfg):
    """alg:sequential (Algorithm 1 as revised by DESIGN) on synthetic audits resampled from E1 puppet pools
    (no interference): pairs (alg puppet, ref puppet) arrive in waves of `wave`; each puppet codes m flagged
    positions; Y_u = Qbar_u Phat_u."""
    t0 = time.perf_counter()
    q = POL[cfg["ref"]]
    wave, Nmax, m = cfg["wave"], cfg["N_max"], cfg["m"]
    looks = np.arange(wave, Nmax + 1, wave)
    Wn = looks.size
    zb = float(norm.ppf(cfg["power_target"]))
    out = dict(config=cfg, c_alpha={str(a): sq.c_alpha(a) for a in (0.05, 0.0125)}, personas={})
    for d, pn in enumerate(PERSONAS):
        res = {}
        for regime in cfg["regimes"]:
            C = pools[regime]["counts"]
            A_, R_ = _pool_arm(C, d, 0), _pool_arm(C, d, q)
            mu_a, mu_r = A_["E"].mean(), R_["E"].mean()
            AR0 = mu_a / mu_r
            se_a, se_r = A_["fpos"].sum() / A_["pos"].sum(), R_["fpos"].sum() / R_["pos"].sum()
            lam = se_a / se_r
            rr = dict(AR=float(AR0), logAR=float(np.log(AR0)), lambda_S=float(lam), mu_alg=float(mu_a),
                      mu_ref=float(mu_r), Se_alg=float(se_a), Se_ref=float(se_r))
            rng = rng_for("E5", 2, REG_IDX[regime], d)
            R = cfg["R"]
            P = A_["Q"].size
            cases = {"alt": (A_, R_, float(np.log(AR0)))}
            if regime == "ND":
                cases["null"] = (R_, R_, 0.0)                       # both arms from the reference pool: AR = 1
            for case, (XA, XR, target) in cases.items():
                ia, ir = rng.integers(0, P, (R, Nmax)), rng.integers(0, P, (R, Nmax))
                Ya, Yr = _y_stat(XA, ia, m, rng), _y_stat(XR, ir, m, rng)
                cr = {}
                variants = [("a05_b1", 0.05, (1.0, 1.0), 1), ("a05_b0", 0.05, (1.0, 1.0), 0),
                            ("a0125_b1", 0.0125, (1.0, 1.0), 1), ("a0125_b0", 0.0125, (1.0, 1.0), 0),
                            ("a0125_b1_lam5", 0.0125, tuple(cfg["lam_range"]), 1)]
                if regime != "ND":
                    variants = [("a05_b1", 0.05, (1.0, 1.0), 1), ("a05_b1_lam20", 0.05, tuple(cfg["lam_range_wide"]), 1),
                                ("a0125_b1_lam20", 0.0125, tuple(cfg["lam_range_wide"]), 1)]
                for nm, alpha, lr, b in variants:
                    o = sq.alg1_cs(Ya, Yr, looks, alpha, cfg["t_star"], lr, burn=b)
                    Lr, Ur = o["L"], o["U"]
                    okc = (Lr <= target) & (target <= Ur)
                    cov = float(np.all(okc, 1).mean())
                    cov8 = float(np.all(okc[:, :cfg["W_max"]], 1).mean())
                    v = dict(alpha=alpha, lam_range=list(lr), burn=b,
                             coverage_all_waves=cov, coverage_all_waves_mcse=float(np.sqrt(cov * (1 - cov) / R)),
                             coverage_to_Wmax=cov8, coverage_to_Wmax_mcse=float(np.sqrt(cov8 * (1 - cov8) / R)),
                             excludes_0_by_wave={str(w): float(np.mean((Lr[:, w - 1] > 0) | (Ur[:, w - 1] < 0)))
                                                 for w in (2, 4, 8, 16, 40, Wn) if w <= Wn},
                             median_width_by_wave={str(w): float(np.median(Ur[:, w - 1] - Lr[:, w - 1]))
                                                   for w in (2, 4, 8, 16, 40, Wn) if w <= Wn})
                    if alpha == cfg["alpha_protocol"] or case == "null" or regime != "ND":
                        for Wmax in cfg["W_max_list"]:
                            v[f"W_max_{Wmax}"] = _stop_and_decide(Lr, Ur, cfg["delta"], min(Wmax, Wn), b, target)
                    cr[nm] = v
                # naive peeking: fixed-sample 95% interval on the same statistic, recomputed after every wave
                o = sq.alg1_cs(Ya, Yr, looks, 0.05, cfg["t_star"], (1.0, 1.0), burn=0)
                se_l = np.sqrt(np.maximum(o["h"] / sq.normal_mixture_radius(looks, 1.0, 0.05,
                                                                              sq.mixture_a(0.05) / cfg["t_star"]), 0) ** 2 / looks)
                okw = np.abs(o["lth"] - target) <= Z95 * se_l
                rej = np.abs(o["lth"]) > Z95 * se_l
                cr["peeking"] = dict(coverage_waves_1_to_Wmax=float(np.all(okw[:, :cfg["W_max"]], 1).mean()),
                                     coverage_waves_2_to_Wmax=float(np.all(okw[:, 1:cfg["W_max"]], 1).mean()),
                                     coverage_all_waves=float(np.all(okw, 1).mean()),
                                     coverage_single_look_wave8=float(okw[:, cfg["W_max"] - 1].mean()),
                                     rejects_AR1_by_Wmax=float(np.any(rej[:, :cfg["W_max"]], 1).mean()),
                                     rejects_AR1_by_last_wave=float(np.any(rej, 1).mean()))
                if case == "alt" and regime == "ND":
                    # exact variant (thm:sequential(b)) on Y, lambda_S = 1
                    Rb = cfg["R_bet"]
                    gb = np.exp(np.linspace(np.log(cfg["grid"][0]), np.log(cfg["grid"][1]), cfg["grid"][2]))
                    blo, bhi = sq.betting_ratio_cs(Ya[:Rb], Yr[:Rb], cfg["alpha"], gb)
                    blo = np.fmax.accumulate(np.nan_to_num(blo, nan=np.inf), 1)
                    bhi = np.fmin.accumulate(np.nan_to_num(bhi, nan=-np.inf), 1)
                    okb = (blo <= AR0 * lam) & (AR0 * lam <= bhi)
                    cr["betting_exact"] = dict(R=Rb, coverage_all_t=float(np.all(okb, 1).mean()),
                                               median_log_width={str(t): float(np.median(np.log(bhi[:, t - 1]) - np.log(blo[:, t - 1])))
                                                                 for t in (40, 200, Nmax) if t <= Nmax},
                                               excludes_1_by={str(t): float(np.mean((blo[:, t - 1] > 1) | (bhi[:, t - 1] < 1)))
                                                              for t in (40, 200, Nmax) if t <= Nmax})
                    # AA: normal-mixture CS (plug-in variance) on corrected pair differences, known J, b = 1
                    J_a = se_a - A_["fneg"].sum() / A_["neg"].sum()
                    Dd = (XA["Q"][ia] - XR["Q"][ir]) / J_a
                    AA0 = mu_a - mu_r
                    lo, hi = sq.asymptotic_cs(Dd, cfg["alpha"], cfg["t_star"])
                    lo_l, hi_l = lo[:, looks - 1], hi[:, looks - 1]
                    lo_r, hi_r = np.fmax.accumulate(lo_l[:, 1:], 1), np.fmin.accumulate(hi_l[:, 1:], 1)
                    cva = float(np.all((lo_r <= AA0) & (AA0 <= hi_r), 1).mean())
                    cr["aa_cs"] = dict(AA=float(AA0), coverage_after_burn_in=cva,
                                       coverage_mcse=float(np.sqrt(cva * (1 - cva) / R)),
                                       excludes_0_by_wave8=float(np.mean((lo_r[:, 6] > 0) | (hi_r[:, 6] < 0))))
                    # prop:power (c) and (d)
                    L_ = abs(np.log(AR0))
                    kTS = N_IMPR
                    PPV = lambda X: X["fpos"].sum() / (X["fpos"].sum() + X["fneg"].sum())
                    qa, qr = A_["Q"].mean(), R_["Q"].mean()
                    AY_formula = sum((X["E"].var(ddof=1) + mu * (1 - se_) / (se_ * kTS)
                                      + qq ** 2 * PPV(X) * (1 - PPV(X)) / (m * se_ ** 2)) / mu ** 2
                                     for X, mu, se_, qq in ((A_, mu_a, se_a, qa), (R_, mu_r, se_r, qr)))
                    AY_direct = Ya.var() / Ya.mean() ** 2 + Yr.var() / Yr.mean() ** 2
                    ca_ = {a_: sq.c_alpha(a_) for a_ in (0.05, 0.0125)}
                    pw = dict(L=float(L_), A_Y_formula=float(AY_formula), A_Y_direct=float(AY_direct),
                              n_fix_Y=float((Z95 + zb) ** 2 * AY_direct / L_ ** 2),
                              n_seq_Y=float((ca_[0.05] + zb) ** 2 * AY_direct / L_ ** 2),
                              n_seq_Y_lam5=float((ca_[0.05] + zb) ** 2 * AY_direct
                                                 / (L_ - np.log(cfg["lam_range"][1] / cfg["lam_range"][0])) ** 2)
                              if L_ > np.log(cfg["lam_range"][1] / cfg["lam_range"][0]) else None)
                    nf = int(math.ceil(pw["n_fix_Y"]))
                    if 2 <= nf <= Nmax:
                        ya_, yr_ = Ya[:, :nf].mean(1), Yr[:, :nf].mean(1)
                        s_ = np.sqrt(((Ya[:, :nf] / ya_[:, None] - Yr[:, :nf] / yr_[:, None]) ** 2).mean(1) / nf)
                        pw["fixed_power_at_n_fix_Y"] = float(np.mean(np.abs(np.log(ya_ / yr_)) > Z95 * s_))
                        pw["n_fix_Y_used"] = nf
                    ns = pw["n_seq_Y"]
                    w_h = max(int(math.ceil(ns / wave)), 2)          # at least one wave after the burn-in
                    if w_h <= Wn:
                        o = sq.alg1_cs(Ya, Yr, looks, 0.05, max(ns, wave), (1.0, 1.0), burn=1)
                        ex = (o["L"] > 0) | (o["U"] < 0)
                        exh = ex[:, :w_h]
                        first = np.where(exh.any(1), exh.argmax(1) + 1, w_h)
                        pw.update(horizon_waves=w_h, seq_power_by_horizon=float(exh[:, -1].mean()),
                                  seq_mean_stop_pairs=float(first.mean() * wave),
                                  seq_mean_stop_over_n_fix=float(first.mean() * wave / pw["n_fix_Y"]))
                    cr["power"] = pw
                rr[case] = cr
            res[regime] = rr
        out["personas"][pn] = res
    out["runtime"] = time.perf_counter() - t0
    return out


# =============================================================================================
# Detailed pools (E4b, E5b): the E1 pools re-simulated with the same seeds, with per-session records
# =============================================================================================
def task_detail_pool(args):
    """Re-simulate the E1 pool of `regime` exactly (same seeds, same chunks; record_detail draws no random
    numbers) and keep, for the algorithmic and reverse-chronological puppets, per-session impression counts,
    opened positions and slate states, plus one further session of T_long steps (slate states only)."""
    regime, P, chunk, T_long, tail_from = args
    w = get_world()
    t0 = time.perf_counter()
    pers = np.repeat(np.arange(4), 4 * P)
    pol = np.tile(np.repeat(np.arange(4), P), 4)
    n = pers.size
    S, k = SES.n_sessions, REC.slate_k
    counts = np.zeros((n, 20), np.int32)
    D = dict(sc=np.zeros((4, 2, P, S, 20), np.int16), so=np.zeros((4, 2, P, S, 20), np.int16),
             st=np.zeros((4, 2, P, S, 2), np.int8), tr=np.zeros((4, 2, P, S, 2, 3, 3), np.int16),
             comp=np.zeros((4, 2, P, (k + 1) ** 2), np.int32),
             Lc=np.zeros((4, 2, P, 20), np.int32), Lst=np.zeros((4, 2, P, 2), np.int8),
             Ltr=np.zeros((4, 2, P, 2, 3, 3), np.int16), Ltail=np.zeros((4, 2, P, 3), np.int16),
             LposA=np.zeros((4, 2, P), np.int32))
    perm = rng_for("E1", 0, REG_IDX[regime]).permutation(n)
    for ci, c0 in enumerate(range(0, n, chunk)):
        idx = perm[c0:c0 + chunk]
        rng = rng_for("E1", 1, REG_IDX[regime], ci)
        acc = make_puppets(w, pers[idx], pol[idx], rng)
        glob = GlobalState(w, REC)
        train(w, acc, glob, REC, SES)
        out = measure(w, acc, glob, REC, CH, SES, rng, regime, record_detail=True)
        counts[idx] = out["counts"]
        sel = np.flatnonzero(pol[idx] <= 1)
        gi = idx[sel]
        dd, qq, pp = gi // (4 * P), (gi // P) % 4, gi % P
        D["sc"][dd, qq, pp] = out["sess_counts"][sel]
        D["so"][dd, qq, pp] = out["sess_opened"][sel]
        D["st"][dd, qq, pp] = out["sl_start"][sel]
        D["tr"][dd, qq, pp] = out["sl_trans"][sel]
        D["comp"][dd, qq, pp] = out["sl_comp"][sel]
        lng = measure(w, acc.subset(sel), glob, REC, CH, SES, rng, regime, n_sessions=1, T=T_long,
                      record_detail=True, tail_from=tail_from)
        D["Lc"][dd, qq, pp] = lng["counts"]
        D["Lst"][dd, qq, pp] = lng["sl_start"][:, 0]
        D["Ltr"][dd, qq, pp] = lng["sl_trans"][:, 0]
        D["Ltail"][dd, qq, pp] = lng["sl_occ_tail"][:, 0]
        D["LposA"][dd, qq, pp] = lng["posA_tail"][:, 0]
    return dict(regime=regime, counts=counts.reshape(4, 4, P, 20), detail=D, runtime=time.perf_counter() - t0)


def _moments(x):
    x = np.asarray(x, float).ravel()
    m, sd = x.mean(), x.std()
    z = (x - m) / sd if sd > 0 else np.zeros_like(x)
    return dict(mean=float(m), sd=float(sd), skew=float(np.mean(z ** 3)), exkurt=float(np.mean(z ** 4) - 3),
                max=float(x.max()), q99=float(np.quantile(x, 0.99)), q999=float(np.quantile(x, 0.999)),
                p_zero=float(np.mean(x == 0)))


def _decide_vec(L, U, delta):
    """Conclusions of tab:prot-decisions for final intervals (R,) for log AR; 'empty' if L > U."""
    ld = np.log(delta)
    out = np.full(L.shape, "inconclusive", dtype=object)
    und = (L > 0) | (U < 0)
    out[und] = "difference_materiality_undetermined"
    out[(L > -ld) & (U < ld)] = "no_material_difference"
    out[U < -ld] = "material_deamplification"
    out[L > ld] = "material_amplification"
    out[~(L <= U)] = "empty"
    return out


def _wrong_vec(dec, L, U, logAR, delta):
    ld = np.log(delta)
    w = np.zeros(L.shape, bool)
    w |= (dec == "material_amplification") & (logAR <= ld)
    w |= (dec == "material_deamplification") & (logAR >= -ld)
    w |= (dec == "no_material_difference") & ~((-ld < logAR) & (logAR < ld))
    w |= (dec == "difference_materiality_undetermined") & (((L > 0) & (logAR <= 0)) | ((U < 0) & (logAR >= 0)))
    return w


def _stop_vec(L, U, delta, burn, logAR, wave):
    """Rules S1-S3 (sec:prot-stopping) on running intervals L, U (R, W) for log AR."""
    R, W = L.shape
    ld = np.log(delta)
    cond = (L > ld) | (U < -ld) | ((L > -ld) & (U < ld) & (L <= U))
    cond[:, :burn] = False
    stop = np.where(cond.any(1), cond.argmax(1), W - 1)
    Lf, Uf = L[np.arange(R), stop], U[np.arange(R), stop]
    dec = _decide_vec(Lf, Uf, delta)
    wrong = _wrong_vec(dec, Lf, Uf, logAR, delta)
    cats, cnt = np.unique(dec.astype(str), return_counts=True)
    wr = float(wrong.mean())
    return dict(mean_stop_wave=float(stop.mean() + 1), stopped_early=float(np.mean(stop < W - 1)),
                mean_pairs_used=float((stop.mean() + 1) * wave), decisions={str(c): float(n / R) for c, n in zip(cats, cnt)},
                wrong_conclusion=wr, wrong_conclusion_mcse=float(np.sqrt(wr * (1 - wr) / R)),
                detects=float(np.mean(((Lf > 0) | (Uf < 0)) & (Lf <= Uf))), empty=float(np.mean(~(Lf <= Uf))))


def _cov(L, U, target, cols=slice(None)):
    ok = (L[:, cols] <= target) & (target <= U[:, cols])
    c = float(np.all(ok, 1).mean())
    return c, float(np.sqrt(c * (1 - c) / L.shape[0]))


def _draw_records(D, d, q, idx, rng, S):
    """Records of puppets idx (any shape) of cell (d, q), each aggregated over S of its sessions drawn at random
    without replacement. Returns strata (ampsim.doublesample.strata)."""
    sc, so = D["sc"][d, q], D["so"][d, q]
    nS = sc.shape[1]
    ss = np.argsort(rng.random(idx.shape + (nS,)), -1)[..., :S]
    cnt = sc[idx[..., None], ss].sum(-2, dtype=np.int64)
    opn = so[idx[..., None], ss].sum(-2, dtype=np.int64)
    return ds.strata(cnt, opn)


def _band_weights(D):
    """Design input of the Neyman allocation: s_h = sqrt(FOR_h (1 - FOR_h)) of the non-opened unflagged
    positions in score band h, pooled over the regime's personas and both arms (an 'ideal pilot')."""
    st = ds.strata(D["sc"].reshape(-1, 20).astype(np.int64), D["so"].reshape(-1, 20).astype(np.int64))
    a, nb = st["aB"].sum(0), st["nB"].sum(0)
    f = a / np.maximum(nb, 1)
    return np.sqrt(f * (1 - f)), f


def analyse_e5b(dp, cfg):
    """The registered primary analysis on synthetic audits resampled from the detailed pools."""
    t0 = time.perf_counter()
    q_ref = POL[cfg["ref"]]
    assert q_ref == 1
    wave, Wm, S = cfg["wave"], cfg["W_max"], cfg["S"]
    N = wave * Wm
    looks = np.arange(wave, N + 1, wave)
    R, b = cfg["R"], cfg["burn"]
    kTS = S * SES.T * REC.slate_k
    gr = np.exp(np.linspace(np.log(cfg["grid_ratio"][0]), np.log(cfg["grid_ratio"][1]), cfg["grid_ratio"][2]))
    ga = np.linspace(*cfg["grid_aa"][:2], cfg["grid_aa"][2])
    gx = (ga + 1) / 2
    pcfg = cfg["pilot"]
    out = dict(config=cfg, looks=looks, design={}, personas={})
    for g in cfg["regimes"]:
        s_band, for_band = _band_weights(dp[g])
        out["design"][g] = dict(s_band=s_band, FOR_band=for_band)
    for d, pn in enumerate(PERSONAS):
        res = {}
        for g in cfg["regimes"]:
            D = dp[g]
            P = D["sc"].shape[2]
            s_band = out["design"][g]["s_band"]
            rates = {pol: ds.cell_rates(D["sc"][d, qq].reshape(-1, 20)) for pol, qq in (("alg", 0), ("chron", 1))}
            rr = dict(rates=rates, AR=float(rates["alg"]["mu"] / rates["chron"]["mu"]),
                      AA=float(rates["alg"]["mu"] - rates["chron"]["mu"]))
            for ci, (case, qa, qr) in enumerate((("alt", 0, 1), ("null", 1, 1))):
                rng = rng_for("E5b", REG_IDX[g], ci, d)
                logAR = float(np.log(rr["AR"])) if case == "alt" else 0.0
                AA0 = rr["AA"] if case == "alt" else 0.0
                ia, ir = rng.integers(0, P, (R, N)), rng.integers(0, P, (R, N))
                sa, sr = _draw_records(D, d, qa, ia, rng, S), _draw_records(D, d, qr, ir, rng, S)
                Ea, codes_a = ds.ds_exposure(sa, rng, s_band, cfg["m"], cfg["m_open"], cfg["m_unf"])
                Er, codes_r = ds.ds_exposure(sr, rng, s_band, cfg["m"], cfg["m_open"], cfg["m_unf"])
                mua, mur = rates["alg" if qa == 0 else "chron"]["mu"], rates["chron"]["mu"]
                cr = dict(target_logAR=logAR, target_AA=AA0, opened_flagged_max=int(max(sa["nO_flagged"].max(), sr["nO_flagged"].max())),
                          mean_codes_per_puppet=float((codes_a.mean() + codes_r.mean()) / 2),
                          Etilde_mean_over_mu=[float(Ea.mean() / mua), float(Er.mean() / mur)])
                # tails of the primary statistic, and of the true exposure of a puppet (S sessions)
                cr["tails"] = dict(alg=dict(Etilde=_moments(Ea), Etrue=_moments(sa["E"]), mu=float(mua)),
                                   ref=dict(Etilde=_moments(Er), Etrue=_moments(sr["E"]), mu=float(mur)),
                                   psi=_moments(Ea / mua - Er / mur))
                for arm, X, mu_ in (("alg", Ea, mua), ("ref", Er, mur)):
                    t_ = cr["tails"][arm]
                    t_["max_over_mu"] = float(X.max() / mu_)
                    t_["q999_over_mu"] = float(np.quantile(X, 0.999) / mu_)
                    t_["p_over_5mu"] = float(np.mean(X > 5 * mu_))
                # variance per pair of the influence psi vs the closed form A + n B_ds
                sim = dict(alg=float(Ea.var() / mua ** 2), ref=float(Er.var() / mur ** 2),
                           alg_true=float(sa["E"].var() / mua ** 2), ref_true=float(sr["E"].var() / mur ** 2))
                cf = {}
                for arm, qq, st_ in (("alg", qa, sa), ("ref", qr, sr)):
                    rt = rates["alg" if qq == 0 else "chron"]
                    cf[arm] = ds.var_closed_form(rt["mu"], float(st_["E"].var()), rt["q"], rt["PPV"], rt["FOR"], rt["Se"],
                                                 rt["Sp"], kTS, cfg["m"], cfg["m_open"] + cfg["m_unf"])
                tot_sim = sim["alg"] + sim["ref"]
                tot_cf = cf["alg"]["total"] + cf["ref"]["total"]
                cr["variance"] = dict(sim=sim, closed_form=cf, sim_total=tot_sim, closed_form_total=tot_cf,
                                      ratio_closed_over_sim=tot_cf / tot_sim,
                                      sim_true_total=sim["alg_true"] + sim["ref_true"],
                                      A_closed_total=cf["alg"]["A"] + cf["ref"]["A"])
                Dd = Ea - Er
                for alpha in cfg["alphas"]:
                    ka = f"a{alpha:g}"
                    v = {}
                    o1 = sq.alg1_cs(Ea, Er, looks, alpha, cfg["t_star"], (1.0, 1.0), burn=b)
                    o0 = sq.alg1_cs(Ea, Er, looks, alpha, cfg["t_star"], (1.0, 1.0), burn=0)
                    c1, m1 = _cov(o1["L"], o1["U"], logAR)
                    c0, m0 = _cov(o0["L"], o0["U"], logAR)
                    v["nm_ar"] = dict(coverage=c1, coverage_mcse=m1, coverage_no_burn_in=c0, coverage_no_burn_in_mcse=m0,
                                      excludes_1_by_wave={str(w + 1): float(np.mean((o1["L"][:, w] > 0) | (o1["U"][:, w] < 0)))
                                                          for w in range(Wm)},
                                      median_width_final=float(np.median(o1["U"][:, -1] - o1["L"][:, -1])),
                                      stop=_stop_vec(o1["L"], o1["U"], cfg["delta"], b, logAR, wave))
                    La, Ua = sq.alg1_cs_mean(Dd, looks, alpha, cfg["t_star"], burn=b)
                    ca, ma = _cov(La, Ua, AA0)
                    v["nm_aa"] = dict(coverage=ca, coverage_mcse=ma, excludes_0_final=float(np.mean((La[:, -1] > 0) | (Ua[:, -1] < 0))),
                                      median_width_final=float(np.median(Ua[:, -1] - La[:, -1])))
                    blo, bhi = sq.betting_ratio_cs(Ea, Er, alpha, gr)
                    with np.errstate(divide="ignore", invalid="ignore"):
                        BL = np.log(np.nan_to_num(blo[:, looks - 1], nan=np.inf))
                        BU = np.log(np.nan_to_num(bhi[:, looks - 1], nan=0.0))
                    cb, mb = _cov(BL, BU, logAR)
                    v["bet_ar"] = dict(coverage=cb, coverage_mcse=mb,
                                       excludes_1_by_wave={str(w + 1): float(np.mean(((BL[:, w] > 0) | (BU[:, w] < 0)) & (BL[:, w] <= BU[:, w])))
                                                           for w in range(Wm)},
                                       median_width_final=float(np.median(BU[:, -1] - BL[:, -1])),
                                       stop=_stop_vec(BL, BU, cfg["delta"], b, logAR, wave))
                    xlo, xhi = sq.betting_cs((Dd + 1) / 2, alpha, gx)
                    AL = np.nan_to_num(2 * xlo[:, looks - 1] - 1, nan=np.inf)
                    AU = np.nan_to_num(2 * xhi[:, looks - 1] - 1, nan=-np.inf)
                    cba, mba = _cov(AL, AU, AA0)
                    v["bet_aa"] = dict(coverage=cba, coverage_mcse=mba,
                                       excludes_0_final=float(np.mean(((AL[:, -1] > 0) | (AU[:, -1] < 0)) & (AL[:, -1] <= AU[:, -1]))),
                                       median_width_final=float(np.median(AU[:, -1] - AL[:, -1])))
                    cr[ka] = v
                # the pilot check of sec:prot-stopping: resample 10 pilot puppets per arm to estimate the miss rate
                cr["pilot_check"] = _pilot_check(D, d, qa, qr, s_band, cfg, pcfg, looks, rng)
                rr[case] = cr
            res[g] = rr
        out["personas"][pn] = res
    out["runtime"] = time.perf_counter() - t0
    return out


def _pilot_check(D, d, qa, qr, s_band, cfg, pcfg, looks, rng):
    """For each of pcfg['R'] simulated pilots (n_per_cell puppets per arm, S sessions, pilot coding: all flagged
    and m_open + m_unf unflagged positions), estimate the time-uniform miss rate of the registered sequences by
    resampling the pilot puppets (B audits of the registered design, the registered statistic re-drawn from the
    pilot's codes, the pilot's ratio and difference of mean exposures as the truth). The check fails ('flags')
    when the estimate exceeds the level by more than its Monte Carlo error sqrt(alpha (1 - alpha) / B)."""
    P = D["sc"].shape[2]
    n, B, Rp = pcfg["n_per_cell"], pcfg["B"], pcfg["R"]
    N = looks[-1]
    est = {f"a{a:g}": dict(ar=[], aa=[]) for a in cfg["alphas"]}
    n_ok = 0
    for _ in range(Rp):
        pcs = []
        for q in (qa, qr):
            st = _draw_records(D, d, q, rng.integers(0, P, n), rng, cfg["S"])
            pcs.append(ds.pilot_codes(st, rng, s_band, pcfg["m_open"], pcfg["m_unf"], cfg["m_unf"]))
        ma, mr = pcs[0]["Ehat"].mean(), pcs[1]["Ehat"].mean()
        ja, jr = rng.integers(0, n, (B, N)), rng.integers(0, n, (B, N))
        Ea = ds.ds_from_pilot(pcs[0], ja, rng, cfg["m"], cfg["m_open"])
        Er = ds.ds_from_pilot(pcs[1], jr, rng, cfg["m"], cfg["m_open"])
        ok = ma > 0 and mr > 0
        n_ok += ok
        for alpha in cfg["alphas"]:
            k = f"a{alpha:g}"
            if ok:
                o = sq.alg1_cs(Ea, Er, looks, alpha, cfg["t_star"], (1.0, 1.0), burn=cfg["burn"])
                est[k]["ar"].append(1 - _cov(o["L"], o["U"], float(np.log(ma / mr)))[0])
            La, Ua = sq.alg1_cs_mean(Ea - Er, looks, alpha, cfg["t_star"], burn=cfg["burn"])
            est[k]["aa"].append(1 - _cov(La, Ua, float(ma - mr))[0])
    out = dict(R_pilots=Rp, B=B, n_per_cell=n, computable_ar=float(n_ok / Rp))
    for alpha in cfg["alphas"]:
        k = f"a{alpha:g}"
        thr = alpha + np.sqrt(alpha * (1 - alpha) / B)
        o = dict(threshold=float(thr))
        for s_ in ("ar", "aa"):
            x = np.asarray(est[k][s_], float)
            o[s_] = dict(n=int(x.size), flag_rate=float(np.mean(x > thr)) if x.size else None,
                         mean_miss=float(x.mean()) if x.size else None, median_miss=float(np.median(x)) if x.size else None,
                         q10_miss=float(np.quantile(x, 0.1)) if x.size else None, q90_miss=float(np.quantile(x, 0.9)) if x.size else None)
        out[k] = o
    return out


def analyse_e5s(dp, cfg, cfg5b):
    """E5b's statistic and pilot check under stress designs (more looks, no burn-in), on which the normal-mixture
    sequence is expected to fail; tests whether the pilot resampling check detects the failure."""
    t0 = time.perf_counter()
    R, N, S = cfg["R"], cfg["N"], cfg5b["S"]
    out = dict(config=cfg, personas={})
    for d, pn in enumerate(PERSONAS):
        res = {}
        for g in cfg5b["regimes"]:
            D = dp[g]
            P = D["sc"].shape[2]
            s_band = _band_weights(D)[0]
            mu = {qq: ds.cell_rates(D["sc"][d, qq].reshape(-1, 20))["mu"] for qq in (0, 1)}
            rr = {}
            for ci, (case, qa, qr) in enumerate((("alt", 0, 1), ("null", 1, 1))):
                rng = rng_for("E5s", REG_IDX[g], ci, d)
                logAR = float(np.log(mu[qa] / mu[qr]))
                AA0 = float(mu[qa] - mu[qr])
                sa = _draw_records(D, d, qa, rng.integers(0, P, (R, N)), rng, S)
                sr = _draw_records(D, d, qr, rng.integers(0, P, (R, N)), rng, S)
                Ea, _ = ds.ds_exposure(sa, rng, s_band, cfg5b["m"], cfg5b["m_open"], cfg5b["m_unf"])
                Er, _ = ds.ds_exposure(sr, rng, s_band, cfg5b["m"], cfg5b["m_open"], cfg5b["m_unf"])
                cr = {}
                for di, des in enumerate(cfg["designs"]):
                    looks = np.arange(des["wave"], N + 1, des["wave"])
                    v = dict(design=des)
                    for alpha in cfg5b["alphas"]:
                        o = sq.alg1_cs(Ea, Er, looks, alpha, des["t_star"], (1.0, 1.0), burn=des["burn"])
                        La, Ua = sq.alg1_cs_mean(Ea - Er, looks, alpha, des["t_star"], burn=des["burn"])
                        c1, m1 = _cov(o["L"], o["U"], logAR)
                        c2, m2 = _cov(La, Ua, AA0)
                        v[f"a{alpha:g}"] = dict(nm_ar_coverage=c1, nm_ar_coverage_mcse=m1, nm_aa_coverage=c2,
                                                nm_aa_coverage_mcse=m2)
                    c5 = dict(cfg5b, burn=des["burn"], t_star=des["t_star"])
                    v["pilot_check"] = _pilot_check(D, d, qa, qr, s_band, c5, cfg5b["pilot"], looks,
                                                    rng_for("E5s", REG_IDX[g], ci, d, 1 + di))
                    cr[des["name"]] = v
                rr[case] = cr
            res[g] = rr
        out["personas"][pn] = res
    out["runtime"] = time.perf_counter() - t0
    return out


def analyse_e4b(dp, cfg):
    """Slate-state chains of protocol puppets (sec:prot-estimands) against simulated slate and impression exposure."""
    t0 = time.perf_counter()
    S_all, T, TL, tf = SES.n_sessions, cfg["T"], cfg["T_long"], cfg["tail_from"]
    k = REC.slate_k
    a2 = 1                                                       # index of A in the collapsed chain
    out = dict(config=cfg, regimes={})

    def pi_safe(P, a, A):
        """Long-run share of A from the start law a: the stationary law if it is unique, else the Cesaro limit
        (a corrected chain with clipped entries can be reducible)."""
        try:
            pi = mk.stationary(P)
            if np.all(np.isfinite(pi)) and np.all(pi > -1e-9):
                return float(pi[A])
        except np.linalg.LinAlgError:
            pass
        x, acc_ = np.asarray(a, float), 0.0
        for t_ in range(4000):
            x = x @ P
            if t_ >= 2000:
                acc_ += x[A]
        return float(acc_ / 2000)

    def chain(tr, st, A=2):
        P, _ = mk.estimate_P(tr)
        a = np.asarray(st, float) / max(float(np.sum(st)), 1e-300)
        return dict(e_T=mk.e_T(P, a, T, A), e_TL=mk.e_T(P, a, TL, A), pi_A=pi_safe(P, a, A), P=P)

    def corrected(tr2o, st2o, C, A=a2):
        P, a, nneg = mk.correct_chain(tr2o, st2o, C)
        return dict(e_T=mk.e_T(P, a, T, A), e_TL=mk.e_T(P, a, TL, A), pi_A=pi_safe(P, a, A), P=P, n_neg=nneg)

    for g in cfg["regimes"]:
        D = dp[g]
        P_ = D["sc"].shape[2]
        reg = {}
        rng = rng_for("E4b", REG_IDX[g])
        for d, pn in enumerate(PERSONAS):
            cell = {}
            for qq, pol in ((0, "alg"), (1, "chron")):
                sc = D["sc"][d, qq].astype(np.int64)                 # (P, S, 20)
                c = sc.reshape(-1, 4, 5).sum(0)
                posA, npos = int(c[2:].sum()), int(c.sum())
                tr = D["tr"][d, qq].astype(np.int64)                 # (P, S, 2, 3, 3)
                st = D["st"][d, qq]                                  # (P, S, 2)
                trT, trO = tr[:, :, 0].sum((0, 1)), tr[:, :, 1].sum((0, 1))
                stT = np.bincount(st[..., 0].ravel(), minlength=3)
                stO = np.bincount(st[..., 1].ravel(), minlength=3)
                occT = stT + trT.sum(0)
                occO = stO + trO.sum(0)
                kbarA = posA / max(occT[2], 1)
                # long session
                Ltr, Lst = D["Ltr"][d, qq].astype(np.int64), D["Lst"][d, qq]
                LoccT = np.bincount(Lst[:, 0], minlength=3) + Ltr[:, 0].sum((0, 1))
                LoccO = np.bincount(Lst[:, 1], minlength=3) + Ltr[:, 1].sum((0, 1))
                Lc = D["Lc"][d, qq].astype(np.int64).reshape(-1, 4, 5).sum(0)
                sim = dict(slate_e_T=float(occT[2] / occT.sum()), mu=posA / npos, kbar_A=float(kbarA),
                           slate_e_TL=float(LoccT[2] / LoccT.sum()), mu_TL=float(Lc[2:].sum() / Lc.sum()),
                           slate_tail=float(D["Ltail"][d, qq, :, 2].sum() / D["Ltail"][d, qq].sum()),
                           mu_tail=float(D["LposA"][d, qq].sum() / (D["Ltail"][d, qq].sum() * k)),
                           obs_slate_e_T=float(occO[2] / occO.sum()), obs_slate_e_TL=float(LoccO[2] / LoccO.sum()))
                # item-level confusion: true state (N, B, A) -> observed class (band <= 1, band 2, flagged)
                tb = np.stack([c[0], c[1], c[2] + c[3]])                     # (3 states, 5 bands)
                Ci = np.stack([tb[:, :2].sum(1), tb[:, 2], tb[:, 3:].sum(1)], 1).astype(float)
                Ci /= Ci.sum(1, keepdims=True)
                Se = Ci[2, 2]
                negs = tb[:2].sum(1)
                Sp = 1 - float((tb[:2, 3:].sum(1)).sum() / negs.sum())
                C2min = np.array([[Sp ** k, 1 - Sp ** k], [(1 - Se) * Sp ** (k - 1), 1 - (1 - Se) * Sp ** (k - 1)]])
                comp = D["comp"][d, qq].sum(0).reshape(k + 1, k + 1)        # (n_B, n_A) histogram over slates
                fN, fB = Ci[0, 2], Ci[1, 2]
                p0 = sum(comp[nb, 0] * (1 - (1 - fN) ** (k - nb) * (1 - fB) ** nb) for nb in range(k + 1)) / max(comp[:, 0].sum(), 1)
                p1 = sum(comp[nb, na] * (1 - (1 - fN) ** (k - nb - na) * (1 - fB) ** nb * (1 - Se) ** na)
                         for nb in range(k + 1) for na in range(1, k + 1 - nb)) / max(comp[:, 1:].sum(), 1)
                C2orc = np.array([[1 - p0, p0], [1 - p1, p1]])
                C3 = mk.slate_confusion(Ci, k)
                cond3 = float(np.linalg.cond(C3))
                tr2O, st2O = mk.collapse_A(trO, stO)
                tr2T, st2T = mk.collapse_A(trT, stT)
                pred = dict(true3=chain(trT, stT), true2=chain(tr2T, st2T, a2), naive3=chain(trO, stO),
                            corr2_min=corrected(tr2O, st2O, C2min), corr2_oracle=corrected(tr2O, st2O, C2orc))
                if cond3 < 100:
                    pred["corr3_min"] = corrected(trO, stO, C3, A=2)
                for v in pred.values():
                    v["mu_T"], v["mu_TL"], v["mu_pi"] = (v["e_T"] * kbarA / k, v["e_TL"] * kbarA / k, v["pi_A"] * kbarA / k)
                cell[pol] = dict(sim=sim, pred=pred, item_conf=Ci, Se=float(Se), Sp=float(Sp), C2_min=C2min, C2_oracle=C2orc,
                                 C3_min=C3, cond_C3=cond3, false_A_slate_min=float(C2min[0, 1]),
                                 share_A_slates_single=float(comp[:, 1].sum() / max(comp[:, 1:].sum(), 1)))
            # replications at the size of the registered design (n_audit puppets per arm, S sessions each)
            n_a, S, Rr = cfg["n_audit"], cfg["S"], cfg["R"]
            rep = {key: {pol: [] for pol in ("alg", "chron")} for key in
                   ("sesavg_mu", "sesavg_slate", "true3_eT", "true3_pi", "corr2_eT", "corr2_pi", "naive3_pi", "corr2_neg")}
            for _ in range(Rr):
                for qq, pol in ((0, "alg"), (1, "chron")):
                    idx = rng.integers(0, P_, n_a)
                    ss = np.argsort(rng.random((n_a, S_all)), 1)[:, :S]
                    tr = D["tr"][d, qq][idx[:, None], ss].astype(np.int64).sum((0, 1))       # (2, 3, 3)
                    st = D["st"][d, qq][idx[:, None], ss]
                    stT = np.bincount(st[..., 0].ravel(), minlength=3)
                    stO = np.bincount(st[..., 1].ravel(), minlength=3)
                    scs = D["sc"][d, qq][idx[:, None], ss].astype(np.int64).sum((0, 1)).reshape(4, 5)
                    occT = stT + tr[0].sum(0)
                    rep["sesavg_mu"][pol].append(scs[2:].sum() / scs.sum())
                    rep["sesavg_slate"][pol].append(occT[2] / occT.sum())
                    c3 = chain(tr[0], stT)
                    rep["true3_eT"][pol].append(c3["e_T"])
                    rep["true3_pi"][pol].append(c3["pi_A"])
                    rep["naive3_pi"][pol].append(chain(tr[1], stO)["pi_A"])
                    t2O, s2O = mk.collapse_A(tr[1], stO)
                    cc = corrected(t2O, s2O, cell[pol]["C2_min"])
                    rep["corr2_eT"][pol].append(cc["e_T"])
                    rep["corr2_pi"][pol].append(cc["pi_A"])
                    rep["corr2_neg"][pol].append(cc["n_neg"] > 0)
            summ = {}
            targets = dict(sesavg_mu=("mu", "mu"), sesavg_slate=("slate_e_T", "slate_e_T"), true3_eT=("slate_e_T", "slate_e_T"),
                           true3_pi=("slate_tail", "slate_tail"), corr2_eT=("slate_e_T", "slate_e_T"),
                           corr2_pi=("slate_tail", "slate_tail"), naive3_pi=("slate_tail", "slate_tail"))
            for key, (ta, _) in targets.items():
                xa, xr = np.asarray(rep[key]["alg"], float), np.asarray(rep[key]["chron"], float)
                tA, tR = cell["alg"]["sim"][ta], cell["chron"]["sim"][ta]
                with np.errstate(divide="ignore", invalid="ignore"):
                    lr = np.log(xa / xr)
                fin = np.isfinite(lr)
                summ[key] = dict(target_alg=tA, target_ref=tR,
                                 rel_bias_median_alg=float(np.median(xa) / tA - 1), rel_bias_median_ref=float(np.median(xr) / tR - 1),
                                 cv_alg=float(xa.std() / tA), cv_ref=float(xr.std() / tR),
                                 log_ratio_target=float(np.log(tA / tR)),
                                 log_ratio_median=float(np.median(lr[fin])) if fin.any() else None,
                                 log_ratio_sd=float(lr[fin].std()) if fin.sum() > 1 else None, finite_share=float(fin.mean()))
            summ["corr2_neg_share"] = {pol: float(np.mean(rep["corr2_neg"][pol])) for pol in ("alg", "chron")}
            cell["replications"] = dict(n_audit=n_a, S=S, R=Rr, summary=summ)
            reg[pn] = cell
        out["regimes"][g] = reg
    out["runtime"] = time.perf_counter() - t0
    return out


# =============================================================================================
# main
# =============================================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--only", default="E1,E1b,E2,E3,E4,E5,E4b,E5b,E5s")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--merge", action="store_true",
                    help="update the experiments in --only inside an existing sim_results.json; E1 pools not "
                         "recomputed in this run are loaded from raw/pool_<regime>.npz")
    a = ap.parse_args()
    only = set(a.only.split(","))
    cfg = experiment_config(a.quick)
    os.makedirs(os.path.join(a.out, "raw"), exist_ok=True)
    T0 = time.perf_counter()
    w = get_world()
    results = dict(meta=dict(
        title="Supply or Demand? simulation study (synthetic recommender; no real platform data)",
        quick=a.quick, base_seed=BASE_SEED, experiment_seed_ids=EXP_ID,
        seed_scheme="np.random.SeedSequence([base_seed, experiment_id, *keys]); keys listed per experiment in code",
        versions=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                      ampsim=AMPSIM_VERSION),
        workers=a.workers, configs=dict(world=WCFG.to_dict(), rec=REC.to_dict(), choice_puppet=CH.to_dict(),
                                         choice_naturalistic=CH_NAT.to_dict(), choice_naturalistic_open=CH_NAT_OPEN.to_dict(),
                                         session=SES.to_dict(), evolve=EVO.to_dict(), regimes=REGIMES,
                                         experiments=cfg),
        world_summary=w.summary(), n_impressions_per_puppet=N_IMPR))
    runtimes = {}
    pools = {}
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        futs = {}
        need_pools = "E1" in only or (bool(only & {"E3", "E5"}) and not (a.merge and all(
            os.path.exists(os.path.join(a.out, "raw", f"pool_{g}.npz")) for g in cfg["E1"]["regimes"])))
        if need_pools:
            for g in cfg["E1"]["regimes"]:
                futs[("E1", g)] = ex.submit(task_e1_pool, (g, cfg["E1"]["pool"], cfg["E1"]["chunk"]))
        if "E1b" in only:
            for nm, (g, bsd) in cfg["E1b"]["variants"].items():
                futs[("E1b", nm)] = ex.submit(task_e1b_pool, (nm, g, cfg["E1b"]["pool"], cfg["E1b"]["chunk"], bsd))
        if "E3" in only:
            futs[("E3",)] = ex.submit(task_e3, cfg["E3"])
        if "E4" in only:
            jobs = [("base", 0.0)] + [("tilt", e) for e in cfg["E4"]["tilt"]] + [("replace", e) for e in cfg["E4"]["replace"]]
            for kind, e in jobs:
                futs[("E4", kind, e)] = ex.submit(task_e4, (kind, e, cfg["E4"]))
        if "E2" in only:
            c2 = cfg["E2"]
            for dname, des in c2["designs"].items():
                rhos = c2["rho_grid"] if dname == "simultaneous" else c2["rho_remedy"]
                for rho in rhos:
                    futs[("E2", dname, rho)] = ex.submit(task_e2, (dname, des, rho, c2, list(range(c2["R"]))))
        cd = cfg["DETAIL"]
        dpath = lambda g: os.path.join(a.out, "raw", f"pool_detail_{g}.npz")  # noqa: E731
        need_detail = bool(only & {"E4b", "E5b", "E5s"}) and not (a.merge and all(os.path.exists(dpath(g)) for g in cd["regimes"]))
        if need_detail:
            for g in cd["regimes"]:
                futs[("DETAIL", g)] = ex.submit(task_detail_pool, (g, cfg["E1"]["pool"], cfg["E1"]["chunk"],
                                                                   cd["T_long"], cd["tail_from"]))
        done = {k: f.result() for k, f in futs.items()}
    for k, v in done.items():
        if k[0] == "E1":
            pools[k[1]] = v
            np.savez_compressed(os.path.join(a.out, "raw", f"pool_{k[1]}.npz"), counts=v["counts"], opens=v["opens"])
    if a.merge and not ({"E1"} & only):
        for g in cfg["E1"]["regimes"]:
            fn = os.path.join(a.out, "raw", f"pool_{g}.npz")
            if os.path.exists(fn):
                z = np.load(fn)
                pools[g] = dict(counts=z["counts"], opens=z["opens"], runtime=None)
    if "E1" in only:
        runtimes["E1_pools"] = {g: pools[g]["runtime"] for g in pools}
    if "E1" in only:
        results["E1"] = analyse_e1(pools, cfg["E1"])
    if "E1b" in only:
        pb = {k[1]: v for k, v in done.items() if k[0] == "E1b"}
        results["E1b"] = analyse_e1b(pb, cfg["E1b"])
        runtimes["E1b"] = sum(v["runtime"] for v in pb.values())
    if "E2" in only:
        raw2 = [v for k, v in done.items() if k[0] == "E2"]
        results["E2"] = analyse_e2(raw2, cfg["E2"])
        runtimes["E2"] = sum(r["runtime"] for r in raw2)
    if "E3" in only:
        e3 = done[("E3",)]
        _, e_nd, _ = pool_truth(pools["ND"]["counts"], pools["ND"]["opens"])
        e3["persona_contrast"] = persona_contrast_decomp(e_nd, cfg["E3"]["ref"])
        mu = e_nd.mean(-1)
        Qw = np.asarray(REAL_USER_SHARES)
        qa, qr = float(Qw @ mu[:, 0]), float(Qw @ mu[:, POL[cfg["E3"]["ref"]]])
        e3["protocol_audit_Q"] = dict(weights=dict(zip(PERSONAS, REAL_USER_SHARES)), mu_alg=qa, mu_ref=qr,
                                      AA=qa - qr, AR=qa / qr)
        e3["config"] = cfg["E3"]
        results["E3"] = e3
        runtimes["E3"] = e3["runtime"]
    if "E4" in only:
        raw4 = [v for k, v in done.items() if k[0] == "E4"]
        results["E4"] = analyse_e4(raw4, cfg["E4"])
        runtimes["E4"] = sum(r["runtime"] for r in raw4)
    if "E5" in only:
        results["E5"] = analyse_e5(pools, cfg["E5"])
        runtimes["E5"] = results["E5"]["runtime"]
    if only & {"E4b", "E5b", "E5s"}:
        dp, dinfo = {}, {}
        for g in cd["regimes"]:
            if ("DETAIL", g) in done:
                v = done[("DETAIL", g)]
                dp[g] = v["detail"]
                np.savez_compressed(dpath(g), counts=v["counts"], **v["detail"])
                dinfo[g] = dict(runtime=v["runtime"])
                ref_counts = pools[g]["counts"] if g in pools else (
                    np.load(os.path.join(a.out, "raw", f"pool_{g}.npz"))["counts"]
                    if os.path.exists(os.path.join(a.out, "raw", f"pool_{g}.npz")) else None)
                sess_ok = bool(np.array_equal(v["detail"]["sc"].astype(np.int64).sum(3), v["counts"][:, :2].astype(np.int64)))
                dinfo[g].update(sessions_sum_to_counts=sess_ok,
                                reproduces_E1_pool=None if ref_counts is None else bool(np.array_equal(ref_counts, v["counts"])))
            else:
                z = np.load(dpath(g))
                dp[g] = {kk: z[kk] for kk in z.files if kk != "counts"}
                dinfo[g] = dict(runtime=None, loaded_from=os.path.relpath(dpath(g), os.path.join(HERE, "..")))
        runtimes["DETAIL_pools"] = {g: dinfo[g]["runtime"] for g in dinfo}
        with ProcessPoolExecutor(max_workers=a.workers) as ex:
            jobs = {}
            if "E5b" in only:
                for g in cfg["E5b"]["regimes"]:
                    jobs[("E5b", g)] = ex.submit(analyse_e5b, {g: dp[g]}, dict(cfg["E5b"], regimes=[g]))
            if "E4b" in only:
                jobs[("E4b",)] = ex.submit(analyse_e4b, dp, cfg["E4b"])
            if "E5s" in only:
                for g in cfg["E5b"]["regimes"]:
                    jobs[("E5s", g)] = ex.submit(analyse_e5s, {g: dp[g]}, cfg["E5s"], dict(cfg["E5b"], regimes=[g]))
            got = {k: f.result() for k, f in jobs.items()}
        if "E5b" in only:
            e5b = dict(config=cfg["E5b"], pools=dinfo, design={}, personas={p_: {} for p_ in PERSONAS})
            for g in cfg["E5b"]["regimes"]:
                r_ = got[("E5b", g)]
                e5b["looks"] = r_["looks"]
                e5b["design"][g] = r_["design"][g]
                for p_ in PERSONAS:
                    e5b["personas"][p_][g] = r_["personas"][p_][g]
            results["E5b"] = e5b
            runtimes["E5b"] = sum(got[("E5b", g)]["runtime"] for g in cfg["E5b"]["regimes"])
        if "E5s" in only:
            e5s = dict(config=cfg["E5s"], personas={p_: {} for p_ in PERSONAS})
            for g in cfg["E5b"]["regimes"]:
                for p_ in PERSONAS:
                    e5s["personas"][p_][g] = got[("E5s", g)]["personas"][p_][g]
            results["E5s"] = e5s
            runtimes["E5s"] = sum(got[("E5s", g)]["runtime"] for g in cfg["E5b"]["regimes"])
        if "E4b" in only:
            results["E4b"] = got[("E4b",)]
            results["E4b"]["pools"] = dinfo
            runtimes["E4b"] = results["E4b"]["runtime"]
    path = os.path.join(a.out, "sim_results.json" if not a.quick else "sim_results_quick.json")
    if a.merge and os.path.exists(path):
        with open(path) as f:
            old = json.load(f)
        rt = old["meta"].get("runtime_s", {})
        runs = rt.get("runs", [])
        runs.append(dict(experiments=sorted(only), total_wall=time.perf_counter() - T0, by_experiment_cpu=runtimes))
        for k in only:
            if k in results:
                old[k] = _clean(results[k])
        if "E2" in old:
            old["E2"]["bounds"] = _clean(e2_bounds(old["E2"]))
            old["E2"]["sensitivity_xi_source"] = E2_XI_NOTE
        old["meta"]["configs"]["experiments"].update({k: cfg[k] for k in only if k in cfg})
        if only & {"E4b", "E5b", "E5s"}:
            old["meta"]["configs"]["experiments"]["DETAIL"] = cfg["DETAIL"]
            old["meta"]["configs"]["experiments"]["E5b"] = cfg["E5b"]
        old["meta"]["experiment_seed_ids"] = EXP_ID
        old["meta"]["runtime_s"]["runs"] = _clean(runs)
        old["meta"]["runtime_s"]["total_wall"] = float(sum(r_["total_wall"] for r_ in runs))
        old["meta"]["runtime_s"]["total_wall_definition"] = RUNTIME_NOTE
        old["meta"]["runtime_s"].pop("by_experiment_cpu", None)
        results = old
    else:
        if "E2" in results:
            results["E2"]["bounds"] = e2_bounds(_clean(results["E2"]))
        if "E2" in results:
            results["E2"]["sensitivity_xi_source"] = E2_XI_NOTE
        wall = time.perf_counter() - T0
        results["meta"]["runtime_s"] = dict(total_wall=wall, total_wall_definition=RUNTIME_NOTE,
                                            runs=[dict(experiments=sorted(only), total_wall=wall,
                                                       by_experiment_cpu=runtimes)])
    with open(path, "w") as f:
        json.dump(_clean(results), f, indent=1)
    print(f"wrote {path} in {time.perf_counter() - T0:.1f} s")


if __name__ == "__main__":
    main()
