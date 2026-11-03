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

Usage (from code/):
  nice -n 10 python run_experiments.py               # full study (2 workers)
  python run_experiments.py --quick                  # smoke run
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
from dataclasses import replace

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from darkfig.world import WorldConfig, generate_world           # noqa: E402
from darkfig.linkage import LinkageConfig                       # noqa: E402
from darkfig.pipeline import PipelineConfig, analyse_world, EST_NAMES  # noqa: E402
import darkfig.estimators  # noqa: E402,F401  (import before forking so all workers share one version)
import darkfig.linkerror  # noqa: E402,F401

BASE_SEED = 20261103
OMEGA_GRID = tuple(np.round(np.linspace(-1.5, 1.5, 61), 4).tolist())
OMEGA_BANDS = (0.25, 0.5, 1.0)

ALL_PIPES = ("oracle", "naive", "corrected", "corrected_tv", "corrected_true", "corrected_d",
             "corrected_lefit", "mi")


def scenario_grid(quick: bool = False):
    """Scenario definitions. R = replications per level, R_lcmcr = first reps that also run LCMCR."""
    r = (lambda full, q: q) if quick else (lambda full, q: full)
    return [
        dict(id="S1", label="independence, clean records",
             world=dict(capture_model="independent", noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(20, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S2", label="heterogeneity (latent classes), clean records",
             world=dict(capture_model="latent", noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(40, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S3", label="referral dependence q = 0.5 (independent capture), clean records",
             world=dict(capture_model="independent", referral_q=0.5, noise=0.0), levels=None,
             R=r(100, 3), R_lcmcr=r(20, 2), pipelines=ALL_PIPES, omega=True, referral_drop=True),
        dict(id="S4", label="heterogeneity + covariates + noisy records (noise = 1)",
             world=dict(capture_model="latent_cov", noise=1.0), levels=None,
             R=r(100, 3), R_lcmcr=r(40, 2), pipelines=ALL_PIPES, omega=True),
        dict(id="S5", label="record-noise sweep, independent capture",
             world=dict(capture_model="independent"), levels=dict(noise=[0.0, 0.25, 0.5, 1.0, 1.5, 2.0]),
             R=r(40, 2), R_lcmcr=0, pipelines=ALL_PIPES, omega=False),
        dict(id="S7", label="referral sweep with provenance correction (oracle linkage)",
             world=dict(capture_model="independent", noise=0.0), levels=dict(referral_q=[0.0, 0.25, 0.5, 0.75, 1.0]),
             R=r(200, 3), R_lcmcr=0, pipelines=("oracle",), omega=False, referral_drop=True),
    ]


def task_list(scen):
    tasks = []
    for si, sc in enumerate(scen):
        levels = [None] if sc["levels"] is None else list(range(len(next(iter(sc["levels"].values())))))
        for li in levels:
            for rep in range(sc["R"]):
                tasks.append((si, sc["id"], li, rep))
    return tasks


def _cfgs(sc, li, rep):
    wkw = dict(sc["world"])
    if li is not None:
        for k, vals in sc["levels"].items():
            wkw[k] = vals[li]
    wcfg = WorldConfig(**wkw)
    pcfg = PipelineConfig(linkage=LinkageConfig(), pipelines=sc["pipelines"],
                          run_lcmcr=rep < sc["R_lcmcr"],
                          omega_grid=OMEGA_GRID if sc.get("omega") else None,
                          referral_drop=bool(sc.get("referral_drop", False)))
    return wcfg, pcfg


def run_task(args):
    si, sid, li, rep, scen = args
    sc = scen[si]
    wcfg, pcfg = _cfgs(sc, li, rep)
    lev = -1 if li is None else li
    world_seed = [BASE_SEED, si, lev + 1, rep]
    pipe_seed = [BASE_SEED, si, lev + 1, rep, 7]
    t0 = time.perf_counter()
    w = generate_world(wcfg, world_seed)
    out = analyse_world(w, pcfg, pipe_seed)
    out["timing"]["world"] = out["timing"].get("total", 0.0)
    out["timing"]["wall"] = time.perf_counter() - t0
    out.update(scenario=sid, level=li, rep=rep, world_seed=world_seed, pipeline_seed=pipe_seed,
               lcmcr=pcfg.run_lcmcr)
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
    rb0 = ((Nh - nobs) - n0) / n0
    cov = (lo <= N) & (N <= hi)
    width = (hi - lo) / N
    rb_m, rb_se, _ = _mean_se(rb)
    rb0_m, rb0_se, _ = _mean_se(rb0)
    c = float(cov.mean())
    fw = np.isfinite(width)
    return dict(
        R=len(recs), n_ok=len(ok), n_fail=n_fail,
        relbias=rb_m, relbias_mcse=rb_se, relbias_median=float(np.median(rb)),
        rmse_over_N=float(np.sqrt(np.mean(rb ** 2))),
        relbias_n0=rb0_m, relbias_n0_mcse=rb0_se, relbias_n0_median=float(np.median(rb0)),
        rmse_n0_over_n0=float(np.sqrt(np.mean(rb0 ** 2))),
        coverage=c, coverage_mcse=float(math.sqrt(c * (1 - c) / len(ok))),
        width_over_N=float(np.mean(width[fw])) if fw.any() else float("nan"),
        width_over_N_median=float(np.median(width[fw])) if fw.any() else float("nan"),
        n_infinite_width=int((~fw).sum()),
        N_hat_mean=float(Nh.mean()), N_true_mean=float(N.mean()),
    )


def summarise_linkage(rows):
    rows = [r for r in rows if "linkage" in r]
    if not rows:
        return None

    def m(f):
        v = np.array([f(r) for r in rows], float)
        return dict(mean=float(np.nanmean(v)), sd=float(np.nanstd(v, ddof=1)) if len(v) > 1 else 0.0)

    rv = lambda r: r["linkage"]["review"]
    er = lambda r: r["linkage"]["error"]
    ea = lambda r: r["linkage"]["error_all_records"]
    d_cov = [abs(_num(rv(r)["delta_hat"]) - er(r)["delta"]) <= 1.96 * _num(rv(r)["se_delta"]) for r in rows]
    e_cov = [abs(_num(rv(r)["eps_hat"]) - er(r)["eps"]) <= 1.96 * _num(rv(r)["se_eps"]) for r in rows]
    out = dict(
        R=len(rows),
        precision=m(lambda r: ea(r)["precision"]), recall=m(lambda r: ea(r)["recall"]),
        precision_reps=m(lambda r: er(r)["precision"]), recall_reps=m(lambda r: er(r)["recall"]),
        delta_true=m(lambda r: er(r)["delta"]), eps_true=m(lambda r: er(r)["eps"]),
        delta_true_all_records=m(lambda r: ea(r)["delta"]), eps_true_all_records=m(lambda r: ea(r)["eps"]),
        delta_hat=m(lambda r: _num(rv(r)["delta_hat"])), eps_hat=m(lambda r: _num(rv(r)["eps_hat"])),
        delta_err=m(lambda r: _num(rv(r)["delta_hat"]) - er(r)["delta"]),
        eps_err=m(lambda r: _num(rv(r)["eps_hat"]) - er(r)["eps"]),
        delta_abs_err=m(lambda r: abs(_num(rv(r)["delta_hat"]) - er(r)["delta"])),
        eps_abs_err=m(lambda r: abs(_num(rv(r)["eps_hat"]) - er(r)["eps"])),
        se_delta=m(lambda r: _num(rv(r)["se_delta"])), se_eps=m(lambda r: _num(rv(r)["se_eps"])),
        delta_ci_coverage=float(np.mean(d_cov)), eps_ci_coverage=float(np.mean(e_cov)),
        review_B=m(lambda r: rv(r)["n_reviewed"]),
        lefit_delta=m(lambda r: r["linkage"]["lefit"]["delta"]), lefit_eps=m(lambda r: r["linkage"]["lefit"]["eps"]),
        lefit_chi2=m(lambda r: r["linkage"]["lefit"]["chi2"]),
        n_naive_minus_true=m(lambda r: sum(r["tables"]["naive"]) - r["truth"]["n_obs"]),
        n_false_dedup=m(lambda r: r["linkage"]["info"]["n_false_dedup"]),
        n_missed_dup=m(lambda r: r["linkage"]["info"]["n_missed_dup"]),
        n_true_dups=m(lambda r: r["linkage"]["info"]["n_true_dups"]),
        n_false_merges=m(lambda r: er(r)["n_false_merges"]),
        n_candidate_pairs=m(lambda r: r["linkage"]["info"]["n_candidate_pairs_all"]),
        mi_draw_delta=m(lambda r: r["linkage"].get("mi_draw_error", {}).get("delta", float("nan"))),
        mi_draw_eps=m(lambda r: r["linkage"].get("mi_draw_error", {}).get("eps", float("nan"))),
        mi_draw_recall=m(lambda r: r["linkage"].get("mi_draw_error", {}).get("recall", float("nan"))),
        mi_draw_precision=m(lambda r: r["linkage"].get("mi_draw_error", {}).get("precision", float("nan"))),
        fs_converged_frac=float(np.mean([r["linkage"]["info"]["fs_converged"] for r in rows])),
    )
    return out


def summarise_truth(rows):
    g = lambda k: np.array([r["truth"][k] for r in rows], float)
    return dict(N=float(g("N").mean()), n_obs_mean=float(g("n_obs").mean()), n0_mean=float(g("n0").mean()),
                n0_sd=float(g("n0").std(ddof=1)) if len(rows) > 1 else 0.0,
                omega_pop_mean=float(g("omega_pop").mean()), mu0_mean=float(g("mu0").mean()),
                n_records_mean=float(g("n_records").mean()),
                list_sizes_mean=np.mean([r["truth"]["list_sizes"] for r in rows], axis=0).tolist(),
                n_referral_only_mean=float(g("n_referral_only").mean()), n_dups_mean=float(g("n_dups").mean()))


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
    for si, sc in enumerate(scen):
        rows_s = [r for r in results if r["scenario"] == sc["id"]]
        levels = [None] if sc["levels"] is None else list(range(len(next(iter(sc["levels"].values())))))
        lev_out = []
        for li in levels:
            rows = [r for r in rows_s if r["level"] == li]
            pipes = sorted({p for r in rows for p in r["pipelines"]}, key=lambda p: (list(ALL_PIPES) + ["oracle_dropref"]).index(p))
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
                      truth=summarise_truth(rows), estimates=est, linkage=summarise_linkage(rows),
                      omega=summarise_omega(rows),
                      cpu_seconds=float(sum(r["timing"]["wall"] for r in rows)))
            lev_out.append(lv)
        out[sc["id"]] = dict(label=sc["label"], world=sc["world"], levels=sc["levels"], R=sc["R"],
                             R_lcmcr=sc["R_lcmcr"], pipelines=list(sc["pipelines"]), results=lev_out)
    return out


def file_hashes():
    h = {}
    for rel in ["run_experiments.py"] + [os.path.join("darkfig", f) for f in
                                                           sorted(os.listdir(os.path.join(HERE, "darkfig"))) if f.endswith(".py")]:
        p = os.path.join(HERE, rel)
        if os.path.exists(p):
            h[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()[:16]
    return h


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
    # heavy tasks first for load balance
    weight = {"S4": 4, "S5": 3, "S1": 2, "S2": 2, "S3": 2, "S7": 1}
    tasks.sort(key=lambda t: (-weight.get(t[1], 1) - (2 if t[3] < scen[t[0]]["R_lcmcr"] else 0), t[0], t[2] or 0, t[3]))
    payload = [t + (scen,) for t in tasks]
    hashes = file_hashes()
    t0 = time.time()
    results = []
    print(f"running {len(tasks)} worlds with {args.workers} workers", flush=True)
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for i, r in enumerate(ex.map(run_task, payload, chunksize=1)):
            results.append(r)
            if (i + 1) % 50 == 0 or i + 1 == len(tasks):
                print(f"  {i + 1}/{len(tasks)} done, {time.time() - t0:.0f}s", flush=True)
    wall = time.time() - t0
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    for sc in scen:
        rows = sorted([r for r in results if r["scenario"] == sc["id"]], key=lambda r: ((r["level"] or 0), r["rep"]))
        with open(os.path.join(args.out, "raw", f"{sc['id']}.json"), "w") as f:
            json.dump(rows, f, separators=(",", ":"))
    import scipy
    import matplotlib
    summary = dict(
        meta=dict(
            description="Simulation study for 'The Dark Figure' (synthetic data only; no real incidents).",
            note="Rerun after SIM-EST's fix of the LCMCR alpha update (lcmcr.py, 2026-11-03 ~20:18 UTC); "
                 "an earlier run that imported the pre-fix lcmcr.py was aborted and discarded.",
            base_seed=BASE_SEED,
            seed_scheme="world seed = SeedSequence([base_seed, scenario_index, level_index+1, rep]); "
                        "pipeline seed = SeedSequence([..., rep, 7]); level_index = -1 for single-level scenarios",
            quick=bool(args.quick), workers=args.workers, n_worlds=len(tasks),
            wall_seconds=wall, cpu_seconds=float(sum(r["timing"]["wall"] for r in results)),
            started=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t0)),
            versions=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                          matplotlib=matplotlib.__version__, platform=platform.platform()),
            code_sha256_16=hashes,
            world_config_default=WorldConfig().as_dict(),
            linkage_config=PipelineConfig().as_dict()["linkage"],
            pipeline_config_default={k: v for k, v in PipelineConfig().as_dict().items() if k != "omega_grid"},
            omega_grid=list(OMEGA_GRID), omega_bands=list(OMEGA_BANDS),
            estimators=dict(lp="lincoln_petersen(table, lists=(0,1)) [Chapman, police x NGO]",
                            cf="loglinear_closed_form(table, omega=0)",
                            bma="loglinear_bma(table, max_order=2, criterion='bic')",
                            chao="chao_lower_bound(table)",
                            lcmcr="lcmcr(table, **lcmcr_kw) with lcmcr_kw = " + json.dumps(PipelineConfig().lcmcr_kw)
                                  + f"; retained draws per run = (n_iter - burn) / thin = "
                                  + f"{(PipelineConfig().lcmcr_kw['n_iter'] - PipelineConfig().lcmcr_kw['burn']) // PipelineConfig().lcmcr_kw['thin']}"),
            pipelines=dict(
                oracle="true linkage", naive="single best linkage (3-class FS EM, greedy constrained, threshold 0.5)",
                corrected="linkage_corrected with review (delta_hat, eps_hat)",
                corrected_tv="corrected + review uncertainty: 20 draws of (delta, eps) ~ N(hat, se^2), Rubin's rules on log N",
                corrected_true="linkage_corrected with realised LE rates (representatives)",
                corrected_d="post-hoc variant: review delta_hat, eps = 0",
                corrected_lefit="diagnostic: best-fit scalar LE (delta*, eps*) using the oracle table (infeasible)",
                mi="20 Bernoulli(pi) linkage draws; Rubin's rules on log N (lp, cf, bma, chao); "
                   f"LCMCR: posterior draws pooled over the first {PipelineConfig().mi_draws_lcmcr} imputations",
                oracle_dropref="oracle linkage after dropping referral-only NGO records (provenance flag)"),
            metrics=dict(relbias="mean (N_hat - N)/N", rmse_over_N="sqrt(mean((N_hat-N)^2))/N",
                         relbias_n0="mean ((N_hat - n_obs_pipeline) - n0_true)/n0_true",
                         coverage="P(lo <= N <= hi) for the nominal 95% interval",
                         width_over_N="mean (hi - lo)/N",
                         mcse="Monte Carlo standard error"),
        ),
        scenarios=summarise(scen, results),
    )
    with open(os.path.join(args.out, "sim_results.json"), "w") as f:
        json.dump(_clean(summary), f, indent=1)
    print(f"done in {wall:.0f}s wall; wrote {os.path.join(args.out, 'sim_results.json')}")


if __name__ == "__main__":
    main()
