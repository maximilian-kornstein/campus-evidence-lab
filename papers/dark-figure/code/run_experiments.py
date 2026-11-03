#!/usr/bin/env python
"""Simulation study runner for "The Dark Figure" (Sec. sec:simulation, App. app:simdetails).

Scenarios (all data synthetic):
  S1  independence + clean records
  S2  heterogeneity (pure latent-class capture) + clean records
  S3  referral dependence (NGO ingests police-captured incidents, q = 0.5) + clean records
  S4  heterogeneity + covariate-dependent capture + noisy records ("realistic")
  S5  sweep of the record-noise level under independent capture (bias vs linkage error)
  S6  sensitivity of the closed-form estimator to omega (computed on the oracle
      tables of S1-S4; no extra worlds)
  S7  referral correction with provenance metadata, sweep of q (oracle linkage)
  S8  (run 2) observed table generated EXACTLY by the LE model:
      simulate_observed(t_true, delta, eps) on independent-capture tables, grid
      delta in {0.05, 0.1, 0.2} x eps in {0, 0.02, 0.05}; correction with the known
      rates and with rates from a random audit simulated from the LE ground truth.
      Validates Cor cor:linkcorrect under its own model (no record linkage).

Usage (from code/):
  OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py      # full study (2 workers)
  python run_experiments.py --quick                                 # smoke run
Outputs: ../results/sim_results.json (summaries, configs, seeds, versions, runtime)
         ../results/raw/<scenario>.json (per-replication results)
"""
from __future__ import annotations

import os

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import argparse
import hashlib
import json
import math
import platform
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from darkfig.world import WorldConfig, generate_world           # noqa: E402
from darkfig.linkage import LinkageConfig, FS_EM_SPEC            # noqa: E402
from darkfig.pipeline import (PipelineConfig, LEConfig, analyse_world, analyse_le_table,  # noqa: E402
                              EST_NAMES, LE_PIPELINES)
import darkfig.estimators  # noqa: E402,F401  (import before forking so all workers share one version)
import darkfig.linkerror  # noqa: E402,F401

BASE_SEED = 20261103
# Seeds are keyed to FIXED scenario ids (run 1 used the position in the --only-filtered list).
# The values equal each scenario's index in the full run-1 list, so the run-2 worlds of
# S1-S5 and S7 are the same synthetic worlds as in run 1; S8 is new.
SEED_ID = dict(S1=0, S2=1, S3=2, S4=3, S5=4, S7=5, S8=7)
OMEGA_GRID = tuple(np.round(np.linspace(-1.5, 1.5, 61), 4).tolist())
OMEGA_BANDS = (0.25, 0.5, 1.0)
BLOWUP = 5.0          # replicates with N_hat > BLOWUP * N are counted separately

ALL_PIPES = ("oracle", "naive", "corrected", "corrected_tv", "corrected_true", "corrected_d",
             "corrected_lefit", "mi")
PIPE_ORDER = list(ALL_PIPES) + ["oracle_dropref"] + [p for p in LE_PIPELINES if p not in ALL_PIPES]
S8_DELTA = (0.05, 0.1, 0.2)
S8_EPS = (0.0, 0.02, 0.05)


def scenario_grid(quick: bool = False):
    """Scenario definitions. R = replications per level, R_lcmcr = first reps that also run LCMCR."""
    r = (lambda full, q: q) if quick else (lambda full, q: full)
    d8 = [d for d in S8_DELTA for _ in S8_EPS]
    e8 = [e for _ in S8_DELTA for e in S8_EPS]
    return [
        dict(id="S1", label="independence, clean records",
             world=dict(capture_model="independent", noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(10, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S2", label="heterogeneity (latent classes), clean records",
             world=dict(capture_model="latent", noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(25, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S3", label="referral dependence q = 0.5 (independent capture), clean records",
             world=dict(capture_model="independent", referral_q=0.5, noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(10, 2), pipelines=ALL_PIPES, omega=True, referral_drop=True),
        dict(id="S4", label="heterogeneity + covariates + noisy records (noise = 1)",
             world=dict(capture_model="latent_cov", noise=1.0), levels=None,
             R=r(100, 3), R_lcmcr=r(25, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S5", label="record-noise sweep, independent capture",
             world=dict(capture_model="independent"), levels=dict(noise=[0.0, 0.25, 0.5, 1.0, 1.5, 2.0]),
             R=r(40, 2), R_lcmcr=0, pipelines=ALL_PIPES, omega=False),
        dict(id="S7", label="referral sweep with provenance correction (oracle linkage)",
             world=dict(capture_model="independent", noise=0.0), levels=dict(referral_q=[0.0, 0.25, 0.5, 0.75, 1.0]),
             R=r(200, 3), R_lcmcr=0, pipelines=("oracle",), omega=False, referral_drop=True),
        dict(id="S8", label="observed table generated exactly by the LE model (independent capture, N = 2000)",
             world=dict(table_level=True, **{k: v for k, v in LEConfig().as_dict().items() if k not in ("delta", "eps")}),
             levels=dict(delta=d8, eps=e8), R=r(200, 3), R_lcmcr=0, pipelines=LE_PIPELINES, omega=False),
    ]


def task_list(scen):
    tasks = []
    for sc in scen:
        levels = [None] if sc["levels"] is None else list(range(len(next(iter(sc["levels"].values())))))
        for li in levels:
            for rep in range(sc["R"]):
                tasks.append((sc["id"], li, rep))
    return tasks


def seeds_for(sid, li, rep):
    """World / pipeline seeds keyed to the fixed scenario id (not to its position in a list)."""
    lev = -1 if li is None else li
    world_seed = [BASE_SEED, SEED_ID[sid], lev + 1, rep]
    return world_seed, world_seed + [7]


def _cfgs(sc, li, rep):
    wkw = dict(sc["world"])
    if li is not None:
        for k, vals in sc["levels"].items():
            wkw[k] = vals[li]
    if sc["id"] == "S8":
        wkw.pop("table_level", None)
        return LEConfig(**{k: (tuple(v) if isinstance(v, list) else v) for k, v in wkw.items()}), None
    wcfg = WorldConfig(**wkw)
    pcfg = PipelineConfig(linkage=LinkageConfig(), pipelines=sc["pipelines"],
                          run_lcmcr=rep < sc["R_lcmcr"],
                          omega_grid=OMEGA_GRID if sc.get("omega") else None,
                          referral_drop=bool(sc.get("referral_drop", False)))
    return wcfg, pcfg


def run_task(args):
    sid, li, rep, scen = args
    sc = next(s for s in scen if s["id"] == sid)
    wcfg, pcfg = _cfgs(sc, li, rep)
    world_seed, pipe_seed = seeds_for(sid, li, rep)
    t0 = time.perf_counter()
    if sid == "S8":
        out = analyse_le_table(wcfg, world_seed)
        lc = False
    else:
        w = generate_world(wcfg, world_seed)
        out = analyse_world(w, pcfg, pipe_seed)
        lc = pcfg.run_lcmcr
    out["timing"]["wall"] = time.perf_counter() - t0
    out.update(scenario=sid, level=li, rep=rep, world_seed=world_seed, pipeline_seed=pipe_seed, lcmcr=lc)
    return _clean(out)


def _clean(x):
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, (np.floating,)):
        x = float(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    if isinstance(x, float) and not math.isfinite(x):
        return None if math.isnan(x) else ("inf" if x > 0 else "-inf")
    return x


def _num(v):
    if v is None:
        return float("nan")
    if v == "inf":
        return float("inf")
    if v == "-inf":
        return float("-inf")
    return float(v)


# ---------------------------------------------------------------------------
# summaries
# ---------------------------------------------------------------------------
def _mean_se(x):
    x = np.asarray([v for v in x if np.isfinite(v)], float)
    if len(x) == 0:
        return float("nan"), float("nan"), 0
    return float(x.mean()), float(x.std(ddof=1) / math.sqrt(len(x))) if len(x) > 1 else float("nan"), len(x)


def _median_mcse(x):
    """Median and a distribution-free MCSE: half-width of the order-statistic 95% CI / 1.96."""
    x = np.sort(np.asarray([v for v in x if np.isfinite(v)], float))
    n = len(x)
    if n == 0:
        return float("nan"), float("nan")
    med = float(np.median(x))
    if n < 5:
        return med, float("nan")
    j = max(int(math.floor(n / 2 - 1.96 * math.sqrt(n) / 2)) - 1, 0)
    k = min(int(math.ceil(n / 2 + 1.96 * math.sqrt(n) / 2)) - 1, n - 1)
    return med, float((x[k] - x[j]) / (2 * 1.96))


def _mad_sd(x):
    x = np.asarray([v for v in x if np.isfinite(v)], float)
    if len(x) < 2:
        return float("nan")
    return float(1.4826 * np.median(np.abs(x - np.median(x))))


def _q(x, p):
    x = np.asarray([v for v in x if np.isfinite(v)], float)
    return float(np.quantile(x, p)) if len(x) else float("nan")


def summarise_estimates(rows, pipe, est):
    recs = [r["pipelines"].get(pipe, {}).get(est) for r in rows]
    recs = [(r, x) for r, x in zip(rows, recs) if x is not None]
    if not recs:
        return None
    ok = [(r, x) for r, x in recs if x.get("ok") and np.isfinite(_num(x["N_hat"]))]
    n_fail = len(recs) - len(ok)
    if not ok:
        return dict(R=len(recs), n_ok=0, n_fail=n_fail)
    N = np.array([r["truth"]["N"] for r, _ in ok], float)
    n0 = np.array([r["truth"]["n0"] for r, _ in ok], float)
    Nh = np.array([_num(x["N_hat"]) for _, x in ok])
    lo = np.array([_num(x["lo"]) for _, x in ok])
    hi = np.array([_num(x["hi"]) for _, x in ok])
    nobs = np.array([_num(x["n_obs"]) for _, x in ok])
    rb = (Nh - N) / N
    # dark-figure error with the COMMON oracle observed count and denominator n0_true:
    # (N_hat - n_obs_true) - n0_true = N_hat - N, scaled by n0_true
    rb0 = (Nh - N) / n0
    # the pipeline's OWN dark-figure estimate N_hat - n_obs(pipeline) against n0_true
    rb0_own = ((Nh - nobs) - n0) / n0
    cov = (lo <= N) & (N <= hi)
    width = (hi - lo) / N
    fw = np.isfinite(width)
    med, med_se = _median_mcse(rb)
    mean, mean_se, _ = _mean_se(rb)
    med0, med0_se = _median_mcse(rb0)
    mean0, mean0_se, _ = _mean_se(rb0)
    c = float(cov.mean())
    out = dict(
        R=len(recs), n_ok=len(ok), n_fail=n_fail,
        relbias_median=med, relbias_median_mcse=med_se,
        relbias_mean=mean, relbias_mean_mcse=mean_se,
        relbias_mad_sd=_mad_sd(rb), relbias_q25=_q(rb, 0.25), relbias_q75=_q(rb, 0.75),
        n_blowup=int((Nh > BLOWUP * N).sum()), frac_blowup=float((Nh > BLOWUP * N).mean()),
        rmse_over_N=float(np.sqrt(np.mean(rb ** 2))),
        relbias_n0_median=med0, relbias_n0_median_mcse=med0_se,
        relbias_n0_mean=mean0, relbias_n0_mean_mcse=mean0_se, relbias_n0_mad_sd=_mad_sd(rb0),
        relbias_n0_own_median=float(np.median(rb0_own)), relbias_n0_own_mean=float(np.mean(rb0_own)),
        coverage=c, coverage_mcse=float(math.sqrt(max(c * (1 - c), 1e-12) / len(ok))),
        width_over_N_median=float(np.median(width[fw])) if fw.any() else float("nan"),
        width_over_N_mean=float(np.mean(width[fw])) if fw.any() else float("nan"),
        n_infinite_width=int((~fw).sum()),
        n_lower_below_nobs=int((lo < nobs - 1e-6).sum()),
        N_hat_median=float(np.median(Nh)), N_true_mean=float(N.mean()),
    )
    cc = [x.get("covers_cap") for _, x in ok if x.get("covers_cap") is not None]
    if cc:
        out["coverage_cap"] = float(np.mean(cc))      # inner (v_cap-only, run-1 style) interval
        out["coverage_cap_mcse"] = float(math.sqrt(max(out["coverage_cap"] * (1 - out["coverage_cap"]), 1e-12) / len(cc)))
    vl = [(_num(x.get("v_link")), r["truth"]["N"]) for r, x in ok if x.get("v_link") is not None]
    if vl:
        sl = [_num(x.get("se_log_n0_link")) for _, x in ok if x.get("se_log_n0_link") is not None]
        out["sd_link_over_N_median"] = float(np.nanmedian([math.sqrt(max(v, 0)) / n for v, n in vl]))
        out["se_log_n0_link_median"] = float(np.nanmedian(sl)) if sl else float("nan")
    if est == "lcmcr":
        rh = np.array([_num(x.get("rhat")) for _, x in ok if x.get("rhat") is not None])
        eb = np.array([_num(x.get("ess_bulk")) for _, x in ok if x.get("ess_bulk") is not None])
        et = np.array([_num(x.get("ess_tail")) for _, x in ok if x.get("ess_tail") is not None])
        es = np.array([_num(x.get("ess")) for _, x in ok if x.get("ess") is not None])
        if len(rh):
            out["diag"] = dict(n_fits=int(len(rh)), rhat_median=float(np.median(rh)), rhat_max=float(rh.max()),
                               frac_rhat_lt_1_01=float((rh < 1.01).mean()), frac_rhat_lt_1_05=float((rh < 1.05).mean()),
                               ess_bulk_median=float(np.median(eb)), ess_bulk_min=float(eb.min()),
                               ess_tail_median=float(np.median(et)), ess_tail_min=float(et.min()),
                               frac_ess_ge_400=float(((eb >= 400) & (et >= 400)).mean()),
                               frac_meets_protocol=float(((rh < 1.01) & (eb >= 400) & (et >= 400)).mean()))
        elif len(es):
            out["diag"] = dict(n_fits=int(len(es)), ess_sum_chains_median=float(np.median(es)),
                               ess_sum_chains_min=float(es.min()))
    return out


def m_sub(rows, f):
    v = np.array([f(r) for r in rows], float)
    return dict(mean=float(np.nanmean(v)), sd=float(np.nanstd(v, ddof=1)) if len(v) > 1 else 0.0,
                median=float(np.nanmedian(v)))


def summarise_linkage(rows):
    rows = [r for r in rows if "linkage" in r and "info" in r.get("linkage", {})]
    if not rows:
        return None
    m = lambda f: m_sub(rows, f)
    rv = lambda r: r["linkage"]["review"]
    er = lambda r: r["linkage"]["error"]
    ea = lambda r: r["linkage"]["error_all_records"]
    fr = lambda r: r["linkage"]["frame"]
    inf = lambda r: r["linkage"]["info"]
    d_cov_frame = [abs(_num(rv(r)["delta_hat"]) - fr(r)["delta_frame"]) <= 1.96 * _num(rv(r)["se_delta"]) for r in rows]
    e_cov_frame = [abs(_num(rv(r)["eps_hat"]) - fr(r)["eps_frame"]) <= 1.96 * _num(rv(r)["se_eps"]) for r in rows]
    d_cov_cap = [abs(_num(rv(r)["delta_hat"]) - er(r)["delta"]) <= 1.96 * _num(rv(r)["se_delta"]) for r in rows]
    e_cov_cap = [abs(_num(rv(r)["eps_hat"]) - er(r)["eps"]) <= 1.96 * _num(rv(r)["se_eps"]) for r in rows]
    out = dict(
        R=len(rows),
        precision=m(lambda r: ea(r)["precision"]), recall=m(lambda r: ea(r)["recall"]),
        precision_reps=m(lambda r: er(r)["precision"]), recall_reps=m(lambda r: er(r)["recall"]),
        # capture-level LE rates of the naive linkage (representatives; all true pairs)
        delta_true=m(lambda r: er(r)["delta"]), eps_true=m(lambda r: er(r)["eps"]),
        delta_true_all_records=m(lambda r: ea(r)["delta"]), eps_true_all_records=m(lambda r: ea(r)["eps"]),
        # the audit's estimand on the SAME frame (candidate pairs among representatives)
        delta_frame=m(lambda r: fr(r)["delta_frame"]), eps_frame=m(lambda r: fr(r)["eps_frame"]),
        recall_frame=m(lambda r: fr(r)["recall_frame"]),
        blocking_recall=m(lambda r: inf(r)["blocking_recall"]),
        blocking_recall_reps=m(lambda r: inf(r)["blocking_recall_reps"]),
        delta_hat=m(lambda r: _num(rv(r)["delta_hat"])), eps_hat=m(lambda r: _num(rv(r)["eps_hat"])),
        delta_err_frame=m(lambda r: _num(rv(r)["delta_hat"]) - fr(r)["delta_frame"]),
        eps_err_frame=m(lambda r: _num(rv(r)["eps_hat"]) - fr(r)["eps_frame"]),
        delta_abs_err_frame=m(lambda r: abs(_num(rv(r)["delta_hat"]) - fr(r)["delta_frame"])),
        eps_abs_err_frame=m(lambda r: abs(_num(rv(r)["eps_hat"]) - fr(r)["eps_frame"])),
        delta_err_capture=m(lambda r: _num(rv(r)["delta_hat"]) - er(r)["delta"]),
        eps_err_capture=m(lambda r: _num(rv(r)["eps_hat"]) - er(r)["eps"]),
        se_delta=m(lambda r: _num(rv(r)["se_delta"])), se_eps=m(lambda r: _num(rv(r)["se_eps"])),
        delta_ci_coverage_frame=float(np.mean(d_cov_frame)), eps_ci_coverage_frame=float(np.mean(e_cov_frame)),
        delta_ci_coverage_capture=float(np.mean(d_cov_cap)), eps_ci_coverage_capture=float(np.mean(e_cov_cap)),
        review_B=m(lambda r: rv(r)["n_reviewed"]),
        lefit_delta=m(lambda r: r["linkage"]["lefit"]["delta"]), lefit_eps=m(lambda r: r["linkage"]["lefit"]["eps"]),
        lefit_chi2=m(lambda r: r["linkage"]["lefit"]["chi2"]),
        n_naive_minus_true=m(lambda r: sum(r["tables"]["naive"]) - r["truth"]["n_obs"]),
        n_false_dedup=m(lambda r: inf(r)["n_false_dedup"]),
        n_missed_dup=m(lambda r: inf(r)["n_missed_dup"]),
        n_true_dups=m(lambda r: inf(r)["n_true_dups"]),
        n_false_merges=m(lambda r: ea(r)["n_false_merges"]),
        n_candidate_pairs=m(lambda r: inf(r)["n_candidate_pairs_all"]),
        fs_converged_frac=float(np.mean([inf(r)["fs_converged"] for r in rows])),
    )
    mi_rows = [r for r in rows if "mi_draw_error" in r["linkage"]]
    if mi_rows:
        g = lambda f: m_sub(mi_rows, f)
        out["mi"] = dict(
            R=len(mi_rows),
            n_false_merges_draw=g(lambda r: r["linkage"]["mi_draw_error"]["n_false_merges"]),
            n_false_merges_point=g(lambda r: ea(r)["n_false_merges"]),
            recall_draw=g(lambda r: r["linkage"]["mi_draw_error"]["recall"]),
            recall_point=g(lambda r: ea(r)["recall"]),
            precision_draw=g(lambda r: r["linkage"]["mi_draw_error"]["precision"]),
            precision_point=g(lambda r: ea(r)["precision"]),
            delta_draw=g(lambda r: r["linkage"]["mi_draw_error"]["delta"]),
            eps_draw=g(lambda r: r["linkage"]["mi_draw_error"]["eps"]),
            n_obs_draw_minus_true=g(lambda r: np.mean(r["linkage"]["mi_n_obs"]) - r["truth"]["n_obs"]),
            n_obs_point_minus_true=g(lambda r: sum(r["tables"]["naive"]) - r["truth"]["n_obs"]),
            n_obs_draw_sd=g(lambda r: np.std(r["linkage"]["mi_n_obs"], ddof=1)),
            moves_per_sweep=g(lambda r: r["linkage"]["mi_gibbs"]["moves_per_sweep"]),
            n_active=g(lambda r: r["linkage"]["mi_gibbs"]["n_active"]),
            links_lag1_acf=g(lambda r: r["linkage"]["mi_gibbs"]["links_lag1_acf"]),
            links_draw_minus_point=g(lambda r: r["linkage"]["mi_gibbs"]["links_mean"] - r["linkage"]["mi_gibbs"]["links_point"]),
        )
    return out


def summarise_le_audit(rows):
    rows = [r for r in rows if "audit" in r.get("linkage", {})]
    if not rows:
        return None
    au = lambda r: r["linkage"]["audit"]
    er = lambda r: r["linkage"]["error"]
    dc = [abs(au(r)["delta_hat"] - au(r)["delta_true"]) <= 1.96 * _num(au(r)["se_delta"]) for r in rows]
    ec = [abs(au(r)["eps_hat"] - au(r)["eps_true"]) <= 1.96 * _num(au(r)["se_eps"]) for r in rows
          if np.isfinite(_num(au(r)["se_eps"])) and _num(au(r)["se_eps"]) > 0]
    return dict(R=len(rows),
                delta_realised=m_sub(rows, lambda r: au(r)["delta_true"]), eps_realised=m_sub(rows, lambda r: au(r)["eps_true"]),
                delta_hat=m_sub(rows, lambda r: au(r)["delta_hat"]), eps_hat=m_sub(rows, lambda r: au(r)["eps_hat"]),
                se_delta=m_sub(rows, lambda r: _num(au(r)["se_delta"])), se_eps=m_sub(rows, lambda r: _num(au(r)["se_eps"])),
                delta_ci_coverage=float(np.mean(dc)), eps_ci_coverage=float(np.mean(ec)) if ec else float("nan"),
                n_false_merges=m_sub(rows, lambda r: er(r)["n_false_merges"]),
                n_obs_naive_minus_true=m_sub(rows, lambda r: sum(r["tables"]["naive"]) - r["truth"]["n_obs"]))


def summarise_truth(rows):
    def g(k):
        return np.array([r["truth"].get(k, float("nan")) for r in rows], float)
    out = dict(N=float(g("N").mean()), n_obs_mean=float(g("n_obs").mean()), n0_mean=float(g("n0").mean()),
               n0_sd=float(g("n0").std(ddof=1)) if len(rows) > 1 else 0.0,
               n_records_mean=float(g("n_records").mean()))
    if "omega_pop" in rows[0]["truth"]:
        out.update(omega_pop_mean=float(g("omega_pop").mean()), mu0_mean=float(g("mu0").mean()),
                   list_sizes_mean=np.mean([r["truth"]["list_sizes"] for r in rows], axis=0).tolist(),
                   n_referral_only_mean=float(g("n_referral_only").mean()), n_dups_mean=float(g("n_dups").mean()))
    return out


def summarise_omega(rows):
    rows = [r for r in rows if "omega_curve" in r]
    if not rows:
        return None
    C = np.array([r["omega_curve"]["n0"] for r in rows], float)
    n0 = np.array([r["truth"]["n0"] for r in rows], float)
    from scipy.stats import norm
    z = norm.ppf(0.975)
    g = np.array(OMEGA_GRID)
    bands = {}
    for Om in OMEGA_BANDS:
        il, ih = int(np.argmin(np.abs(g + Om))), int(np.argmin(np.abs(g - Om)))
        point = (C[:, il] <= n0) & (n0 <= C[:, ih])
        se = np.array([r["omega_curve"]["se_log_n0"] for r in rows], float)
        lo_u = C[:, il] * np.exp(-z * se)
        hi_u = C[:, ih] * np.exp(z * se)
        union = (lo_u <= n0) & (n0 <= hi_u)
        bands[str(Om)] = dict(point_bounds_cover=float(point.mean()), ci_union_cover=float(union.mean()),
                              lower_median=float(np.median(C[:, il])), upper_median=float(np.median(C[:, ih])),
                              ci_union_lo_median=float(np.median(lo_u)), ci_union_hi_median=float(np.median(hi_u)))
    i0 = int(np.argmin(np.abs(g)))
    se = np.array([r["omega_curve"]["se_log_n0"] for r in rows], float)
    ci0 = (C[:, i0] * np.exp(-z * se) <= n0) & (n0 <= C[:, i0] * np.exp(z * se))
    return dict(grid=list(OMEGA_GRID), n0_median=np.median(C, axis=0).tolist(),
                n0_q05=np.quantile(C, 0.05, axis=0).tolist(), n0_q95=np.quantile(C, 0.95, axis=0).tolist(),
                n0_q25=np.quantile(C, 0.25, axis=0).tolist(), n0_q75=np.quantile(C, 0.75, axis=0).tolist(),
                n0_true_mean=float(n0.mean()), n0_true_q05=float(np.quantile(n0, 0.05)),
                n0_true_q95=float(np.quantile(n0, 0.95)),
                omega_pop_mean=float(np.mean([r["truth"]["omega_pop"] for r in rows])),
                omega0_relbias_n0_median=float(np.median((C[:, i0] - n0) / n0)),
                omega0_ci_cover=float(ci0.mean()),
                zero_cell_corrected_frac=float(np.mean([r["omega_curve"]["zero_cell_corrected"] for r in rows])),
                bands=bands, R=len(rows))


def summarise(scen, results):
    out = {}
    for sc in scen:
        rows_s = [r for r in results if r["scenario"] == sc["id"]]
        levels = [None] if sc["levels"] is None else list(range(len(next(iter(sc["levels"].values())))))
        lev_out = []
        for li in levels:
            rows = [r for r in rows_s if r["level"] == li]
            if not rows:
                continue
            pipes = sorted({p for r in rows for p in r["pipelines"]}, key=lambda p: PIPE_ORDER.index(p))
            est = {}
            for p in pipes:
                est[p] = {}
                for e in EST_NAMES:
                    s_ = summarise_estimates(rows, p, e)
                    if s_ is not None:
                        est[p][e] = s_
            lv = dict(level_index=li,
                      level_values=None if li is None else {k: v[li] for k, v in sc["levels"].items()},
                      R=len(rows), R_lcmcr=int(sum(r["lcmcr"] for r in rows)),
                      truth=summarise_truth(rows), estimates=est,
                      linkage=summarise_linkage(rows) if sc["id"] != "S8" else None,
                      audit=summarise_le_audit(rows) if sc["id"] == "S8" else None,
                      omega=summarise_omega(rows),
                      cpu_seconds=float(sum(r["timing"]["wall"] for r in rows)))
            lev_out.append(lv)
        out[sc["id"]] = dict(label=sc["label"], world=sc["world"], levels=sc["levels"], R=sc["R"],
                             R_lcmcr=sc["R_lcmcr"], pipelines=list(sc["pipelines"]), seed_id=SEED_ID[sc["id"]],
                             results=lev_out)
    return out


def file_hashes():
    h = {}
    for rel in ["run_experiments.py"] + [os.path.join("darkfig", f) for f in
                                           sorted(os.listdir(os.path.join(HERE, "darkfig"))) if f.endswith(".py")]:
        p = os.path.join(HERE, rel)
        if os.path.exists(p):
            h[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()[:16]
    return h


def meta_block(args, n_tasks, wall, results, t0):
    import scipy
    import matplotlib
    pc = PipelineConfig()
    lk = pc.lcmcr_kw
    return dict(
        description="Simulation study for 'The Dark Figure' (synthetic data only; no real incidents). Run 2.",
        run="run 2 (after the 2026-11-03 code audit); run 1 is kept in results/sim_results_run1.json",
        base_seed=BASE_SEED, seed_ids=SEED_ID,
        seed_scheme="world seed = SeedSequence([base_seed, SEED_ID[scenario], level_index+1, rep]); "
                    "pipeline seed = SeedSequence([..., rep, 7]); level_index = -1 for single-level scenarios. "
                    "SEED_ID is fixed per scenario id (independent of --only); its values equal the run-1 "
                    "positions, so S1-S5 and S7 use the same worlds as run 1. S8 uses the world seed.",
        quick=bool(args.quick), workers=args.workers, n_tasks=n_tasks,
        wall_seconds=wall, cpu_seconds=float(sum(r["timing"]["wall"] for r in results)),
        started=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t0)),
        versions=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                      matplotlib=matplotlib.__version__, platform=platform.platform()),
        code_sha256_16=file_hashes(),
        world_config_default=WorldConfig().as_dict(),
        linkage_config=pc.as_dict()["linkage"],
        fs_em=FS_EM_SPEC,
        pipeline_config_default={k: v for k, v in pc.as_dict().items() if k != "omega_grid"},
        le_config_default=LEConfig().as_dict(),
        omega_grid=list(OMEGA_GRID), omega_bands=list(OMEGA_BANDS),
        estimators=dict(lp="lincoln_petersen(table, lists=(0,1)) [Chapman, police x NGO]",
                        cf="loglinear_closed_form(table, omega=0)",
                        bma="loglinear_bma(table, max_order=2, criterion='bic')",
                        chao="chao_lower_bound(table)",
                        lcmcr=f"lcmcr(table, J={lk['J']}, n_iter={lk['n_iter']}, burn={lk['burn']}, thin={lk['thin']}, "
                              f"n_chains={pc.lcmcr_chains}); per fit {pc.lcmcr_chains} chains x {lk['n_iter']} "
                              f"iterations = {pc.lcmcr_chains * lk['n_iter']} iterations (the 30000 recommended by "
                              f"SIM-EST, split over {pc.lcmcr_chains} chains with overdispersed n0 starts 0.5/1/2/4 x "
                              f"the Chao-type default) -> {pc.lcmcr_chains * (lk['n_iter'] - lk['burn']) // lk['thin']} "
                              "pooled draws; rank-normalised split-Rhat and bulk/tail ESS of N for every oracle / "
                              "naive fit (Vehtari et al. 2021). This is a REDUCED protocol relative to "
                              "App. app:comp-diag (which requires Rhat < 1.01 and ESS >= 400); the fraction of fits "
                              "meeting it is reported in estimates[...]['lcmcr']['diag']."),
        lcmcr_protocol=dict(n_chains=pc.lcmcr_chains, **lk, init_spread=[0.5, 1.0, 2.0, 4.0],
                            corrected="link_var='impute': one chain per imputed table t* ~ N(t_hat, J^-1 Sigma J^-T) "
                                      f"({pc.corrected_lcmcr_imp} imputations), draws pooled; no Rhat",
                            mi=f"one chain per Gibbs linkage draw for the first {pc.mi_draws_lcmcr} draws, pooled; no Rhat"),
        linkage_variance=dict(
            method="delta method (link_var='delta'): v_link = a' Sigma a, a = J^{-T} grad F(t_hat); J = Jacobian of "
                   "t -> E[T(delta, eps) t] at t_hat (D_delta times the first-order merge Jacobian); Sigma = Cov(n~|t_hat) "
                   "under LE (exact detachment covariance sum_h t_h Cov(Z_h) of Cor cor:linkcorrect(i), propagated "
                   "through the merge Jacobian, plus the first-order merge covariance); grad F by forward differences "
                   "(step max(0.05, 1e-3 t_h)). v_link is added to the inner interval on its log(N - a) scale "
                   "(a = n_obs, or n12 for LP): s^2 -> s^2 + log(1 + v_link / (N_hat - a)^2), per side.",
            why_not_bootstrap="a parametric bootstrap through simulate_observed was the alternative; the delta method "
                              "costs ~16 estimator calls instead of ~100-200 per table and, on S8, its covariance of the "
                              "observed table matches Monte Carlo (tests/test_estimators.py::test_observed_covariance_matches_monte_carlo)",
            audit_variance="corrected_tv / corrected_review_tv: + v_aud = sum_j (dN_hat/dtheta_j)^2 se_j^2 (central "
                           "differences; Cor cor:linkcorrect(iii)); conservative when the audit sampled the same linkage "
                           "(Rem. rem:link-sameaudit)",
            lcmcr="one chain per imputation t* ~ N(t_hat, J^-1 Sigma J^-T) (4 imputations), pooled"),
        mi_sampler=dict(
            kind="approximate posterior draws: single-record Gibbs sampler over constrained partitions targeting the "
                 "plug-in FS pairwise posterior prod_{within-cluster pairs} omega_rr' (omega = pi/(1-pi) for "
                 f"candidate pairs with pi >= tau = {pc.mi_tau}, omega_0 = tau/(1-tau) for other within-cluster pairs); "
                 "<= 1 record per list per cluster; clusters connected via retained edges; start = point linkage; "
                 f"{pc.mi_burn} burn-in sweeps then {pc.mi_draws} draws every {pc.mi_thin} sweep(s). Empirical Bayes "
                 "(m, u, p fixed at FS-EM values): not a full Bayesian record-linkage posterior.",
            run1="independent Bernoulli(pi) link proposals resolved greedily (darkfig.linkage.sample_linkage_bernoulli): "
                 "NOT posterior draws; replaced in run 2"),
        review=dict(
            kind="random stratified audit of Prop. prop:link-audit (Neyman allocation over link status x posterior "
                 "bins, B = 300 candidate pairs); NOT the targeted review of Alg. alg:review; reviewed links are "
                 "not fixed in the linkage",
            frame="candidate (blocked) cross-list pairs among de-duplicated representatives; the estimand on that "
                  "frame is linkage.frame (delta_frame, eps_frame), compared with the review in "
                  "linkage.delta_err_frame / delta_ci_coverage_frame; blocking recall is reported separately; "
                  "delta_true / eps_true are the capture-level LE rates over all true pairs",
            s8_audit="S8: simple random sample of 200 records (true counterparts revealed; ratio estimator of "
                     "pairwise recall) + 100 linked spanning-forest edges (false fraction) -> (delta_hat, eps_hat)"),
        pipelines=dict(
            oracle="true linkage", naive="single best linkage (3-class FS EM, greedy constrained, threshold 0.5)",
            corrected="linkage_corrected with audit (delta_hat, eps_hat); interval = v_cap + v_link",
            corrected_tv="corrected + audit variance v_aud (delta method); conservative",
            corrected_true="linkage_corrected with realised capture-level LE rates (representatives); + v_link",
            corrected_d="post-hoc variant (run 1): audit delta_hat, eps = 0; + v_link",
            corrected_lefit="diagnostic: best-fit scalar LE (delta*, eps*) using the oracle table (infeasible); + v_link",
            mi=f"{pc.mi_draws} Gibbs linkage draws; Rubin's rules on log(N_hat - c), c = min_m n_obs^(m), within "
               "variance from each draw's log-normal interval on N - a (lp, cf, bma, chao); LCMCR: one chain per "
               f"draw for the first {pc.mi_draws_lcmcr} draws, pooled",
            oracle_dropref="oracle linkage after dropping referral-only NGO records (provenance flag)",
            corrected_known="S8: linkage_corrected with the true LE (delta, eps); interval v_cap + v_link "
                            "(coverage_cap = without v_link)",
            corrected_review="S8: linkage_corrected with audit-estimated rates; v_cap + v_link",
            corrected_review_tv="S8: + audit variance"),
        metrics=dict(relbias_median="PRIMARY: median over replicates of (N_hat - N)/N",
                     relbias_median_mcse="half-width of the distribution-free 95% order-statistic CI for the median / 1.96",
                     relbias_mean="secondary: mean (N_hat - N)/N (sensitive to blow-ups)",
                     relbias_mad_sd="1.4826 x median absolute deviation of (N_hat - N)/N (robust spread)",
                     n_blowup=f"number of replicates with N_hat > {BLOWUP} N",
                     rmse_over_N="sqrt(mean((N_hat-N)^2))/N (secondary; blow-up dominated)",
                     relbias_n0="(N_hat - N)/n0_true = ((N_hat - n_obs_true) - n0_true)/n0_true: dark-figure error with "
                                "the COMMON oracle observed count and denominator (median primary, mean secondary)",
                     relbias_n0_own="((N_hat - n_obs_pipeline) - n0_true)/n0_true: the pipeline's own dark-figure "
                                    "estimate (run-1 'relbias_n0'), reported for reference",
                     coverage="P(lo <= N <= hi) for the nominal 95% interval",
                     coverage_cap="corrected pipelines: coverage of the inner interval without v_link (the run-1 interval)",
                     width_over_N_median="median (hi - lo)/N", mcse="Monte Carlo standard error"),
        changes_vs_run1=[
            "S8 added (table generated exactly by the LE model; known and audit-estimated rates)",
            "corrected intervals include v_link (delta method); run-1 intervals kept as coverage_cap",
            "corrected_tv: delta-method audit variance instead of 20 draws + Rubin on log N",
            "MI: Gibbs sampler over constrained partitions instead of Bernoulli(pi) + greedy",
            "Rubin's rules on log(N_hat - c) with within-variance from se on log(N - a) (was log N)",
            "summaries: median relative bias primary, mean secondary, MAD spread, blow-up count",
            "relbias_n0 uses the common oracle n_obs / n0_true; the per-pipeline version is relbias_n0_own",
            "LCMCR: 4 chains x 7500 (burn 2500, thin 5) with Rhat/ESS; R_lcmcr = 10 (S1, S3), 25 (S2, S4)",
            "audit compared with its estimand on the candidate-pair frame; blocking recall reported",
            "seeds keyed to fixed scenario ids",
            "FS-EM specification recorded in meta.fs_em",
            "Jaro similarity reimplemented with str.find (identical values, ~2x faster)",
        ],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--out", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--only", default=None, help="comma-separated scenario ids")
    args = ap.parse_args()
    if args.workers > 2:
        raise SystemExit("at most 2 worker processes on the shared machine")
    scen = scenario_grid(args.quick)
    if args.only:
        keep = set(args.only.split(","))
        scen = [s for s in scen if s["id"] in keep]
    tasks = task_list(scen)
    R_lc = {s["id"]: s["R_lcmcr"] for s in scen}
    # heavy tasks first for load balance (LCMCR worlds, then noisy-linkage worlds)
    weight = {"S5": 3, "S4": 3, "S1": 2, "S2": 2, "S3": 2, "S8": 1, "S7": 0}
    tasks.sort(key=lambda t: (-(10 if t[2] < R_lc[t[0]] else 0) - weight.get(t[0], 1) - (t[1] or 0) * 0.1,
                              t[0], t[1] or 0, t[2]))
    payload = [t + (scen,) for t in tasks]
    t0 = time.time()
    results = []
    print(f"running {len(tasks)} tasks with {args.workers} workers", flush=True)
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for i, r in enumerate(ex.map(run_task, payload, chunksize=1)):
            results.append(r)
            if (i + 1) % 100 == 0 or i + 1 == len(tasks):
                print(f"  {i + 1}/{len(tasks)} done, {time.time() - t0:.0f}s", flush=True)
    wall = time.time() - t0
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    for sc in scen:
        rows = sorted([r for r in results if r["scenario"] == sc["id"]], key=lambda r: ((r["level"] or 0), r["rep"]))
        with open(os.path.join(args.out, "raw", f"{sc['id']}.json"), "w") as f:
            json.dump(rows, f, separators=(",", ":"))
    summary = dict(meta=meta_block(args, len(tasks), wall, results, t0), scenarios=summarise(scen, results))
    with open(os.path.join(args.out, "sim_results.json"), "w") as f:
        json.dump(_clean(summary), f, indent=1)
    print(f"done in {wall:.0f}s wall; wrote {os.path.join(args.out, 'sim_results.json')}")


if __name__ == "__main__":
    main()
