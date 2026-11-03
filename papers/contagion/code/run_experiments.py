#!/usr/bin/env python
"""Simulation study for Paper 2, "Shock and Contagion" (sec:simulation).

Synthetic data only: every dataset is simulated from a known model, and no real
incident data are used anywhere.

Experiments (see SPEC.md and sections 04, 05 and 07 of the paper)
  E1  EM recovery of mu, A, beta and the shock loadings (M = 3: two offline
      regions + one online stream). Bias, RMSE and Wald-CI coverage from the
      observed-information SEs; delta-method coverage for the contagion
      multiplier M = (I - A)^{-1}, the spectral radius, and the surge
      decomposition (B, D, C, shares, online-channel spillover).
  E2  Spurious contagion (thm:spurious): shot-noise / regime-switching Cox
      processes with no contagion, fitted by a constant-background Hawkes model
      (MLE vs the second-order prediction n* = 1 - (1 + kappa)^{-1/2}), by a
      spline-background Hawkes model, and by a Hawkes model with the shocks known
      (cor:equiv-id); plus a moment (dispersion) estimator.
  E3  Thinning (thm:thinning, cor:th-darkfig, prop:th-hetthin): fitted n of
      p-thinned exp-Hawkes data vs n'(p); dark-figure correction with p known and
      with p estimated; heterogeneous recording.
  E4  Online -> offline boundary LRT (prop:lrt): size, power, and false positives
      under a common shock with and without the shock calendar in the model.
  E5  Surge attribution (thm:attribution, prop:at-channel): exact B/D/C and
      spillover vs Monte Carlo branching-label truth; estimated vs true (from the
      E1 fits).
  E6  Alerting (thm:alert, prop:nowcast): predictive alerts at pi* = c_FA /
      (c_FA + c_miss); cost, precision/recall, Brier/CRPS/log score and PIT of
      the Hawkes predictive vs moving-average Poisson and climatology baselines;
      reporting delays (naive state vs Horvitz-Thompson nowcast).

Usage (from code/):
  OPENBLAS_NUM_THREADS=1 nice python run_experiments.py [--only E1,E5] [--quick]
        [--workers 2] [--results ../results] [--merge-only]

Outputs
  <results>/raw/<E>.json     config, seeds, R, runtime, per-replicate values, summary
  <results>/sim_results.json meta (versions, seeds, runtimes) + config + summary of
                             every experiment found in <results>/raw/
Seeds: every replicate has its own generator,
  np.random.default_rng(SeedSequence([BASE_SEED, experiment_index, config_index, rep(, sub)])),
so results do not depend on the number of workers or the scheduling order.
"""

from __future__ import annotations

import os

for _v in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import argparse  # noqa: E402
import copy  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import math  # noqa: E402
import multiprocessing as mp  # noqa: E402
import platform  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
import warnings  # noqa: E402
from datetime import datetime, timezone  # noqa: E402
from importlib import metadata  # noqa: E402

import numpy as np  # noqa: E402
import scipy  # noqa: E402
from scipy import stats  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import hawkes  # noqa: E402
from hawkes import (  # noqa: E402
    HawkesSpec,
    PiecewiseConstant,
    cluster_info,
    decompose_surge,
    fit_em,
    inverse_apparent_branching,
    apparent_branching,
    lrt_alpha_zero,
    multiplier,
    predictive_count_dist,
    simulate,
    spectral_radius,
    spurious_branching,
)
from hawkes.alert import excitation_state  # noqa: E402
from hawkes.alert import _future_counts  # noqa: E402  (private; see NOTES-SIMEXP.md, issue 1)
from hawkes.thinning import apparent_beta, apparent_mu  # noqa: E402

BASE_SEED = 2026110302
EXP_INDEX = {"E1": 1, "E2": 2, "E3": 3, "E4": 4, "E5": 5, "E6": 6}
ORDER = ["E1", "E5", "E3", "E4", "E2", "E6"]
Z95 = float(stats.norm.ppf(0.975))
NAN = float("nan")


# ---------------------------------------------------------------------------
# Configurations
# ---------------------------------------------------------------------------
def _e1_shocks(T_max):
    sizes = [1.0, 2.0, 3.0, 1.0, 2.0, 1.0, 3.0, 2.0]
    times = np.arange(60.0, T_max, 120.0)
    return [(float(t), sizes[i % len(sizes)]) for i, t in enumerate(times)]


DEFAULT = {
    "E1": dict(
        M=3,
        stream_names=["offline A", "offline B", "online"],
        offline=[0, 1],
        online=[2],
        mu=[0.25, 0.20, 0.50],
        A=[[0.25, 0.08, 0.12], [0.08, 0.20, 0.12], [0.10, 0.10, 0.35]],
        beta=1.5,
        shocks=_e1_shocks(2000.0),
        shock_beta=[3.0, 2.0, 6.0],
        shock_rate=0.4,
        T_list=[1000.0, 2000.0],
        R=100,
        tol=1e-8,
        max_iter=2000,
        attribution=dict(shock_index=2, H_list=[7.0, 14.0]),
    ),
    "E5": dict(n_mc=20000, chunk=1000),  # model and shock taken from E1 (first run: n_mc=4000, superseded)
    "E2": dict(
        Lam=2.0,
        gamma=0.5,
        T=1000.0,
        burn=40.0,
        n_basis=20,
        moment_window=25.0,
        R=20,
        tol=1e-8,
        max_iter=2000,
        families=[
            dict(name="rare", kind="shot", m=16.0, kappas=[0.5, 1.0, 2.0, 4.0, 8.0],
                 fits=["const", "spline", "shocks"], shocks_max_kappa=None),
            dict(name="frequent", kind="shot", m=4.0, kappas=[0.5, 1.0, 2.0, 3.0],
                 fits=["const", "spline", "shocks"], shocks_max_kappa=1.0),
            dict(name="slow", kind="regime", q=0.02, kappas=[0.5, 2.0, 8.0],
                 fits=["const", "spline"], shocks_max_kappa=None),
        ],
    ),
    "E3": dict(
        n_list=[0.3, 0.5, 0.7],
        beta=1.0,
        Lam=2.0,
        T=1500.0,
        p_list=[1.0, 0.8, 0.6, 0.4, 0.2],
        R=40,
        p_rel_se=0.10,
        tol=1e-8,
        max_iter=2000,
        het=dict(pi=[0.5, 0.5], n_x=[0.1, 0.9], beta=1.0, Lam=2.0, T=1500.0, R=30,
                 p_cases={"positive": [0.2, 0.8], "homogeneous": [0.5, 0.5],
                          "negative": [0.8, 0.2], "complete": [1.0, 1.0]}),
    ),
    "E4": dict(
        M=2,
        stream_names=["offline", "online"],
        k=0,
        j=1,
        mu=[0.4, 0.8],
        A0=[[0.3, 0.0], [0.2, 0.4]],
        beta=1.0,
        T=600.0,
        alt_values=[0.05, 0.1, 0.2],
        R_size=160,
        R_power=60,
        tol=1e-9,
        max_iter=2000,
        common_shock=dict(rate=0.05, size_logsd=0.5, shock_beta=[4.0, 12.0], shock_rate=[0.25, 2.0], R=60),
    ),
    "E6": dict(
        M=2,
        stream_names=["offline", "online"],
        target=0,
        mu=[0.3, 0.8],
        A=[[0.35, 0.10], [0.25, 0.45]],
        beta=1.0,
        shock_cal_rate=1.0 / 30.0,
        shock_logsd=0.75,
        shock_beta=[6.0, 15.0],
        shock_rate=0.3,
        T_train=1000.0,
        n_windows=150,
        Delta=7.0,
        n_sim=2000,
        ma_windows=4,
        surge_quantile=0.90,
        pilot_T=30000.0,
        pilot_burn=100.0,
        cost_ratios=[2.0, 5.0, 10.0],
        delay=dict(p0=0.3, mean=3.0, streams=[0]),
        R=12,
        tol=1e-8,
        max_iter=2000,
        pit_bins=10,
    ),
}


def quick_config():
    """Tiny configurations for the smoke tests (minutes -> seconds)."""
    q = copy.deepcopy(DEFAULT)
    q["E1"].update(T_list=[400.0], R=2, shocks=_e1_shocks(400.0), tol=1e-6)
    q["E5"].update(n_mc=40, chunk=20)
    q["E2"].update(T=300.0, R=2, n_basis=6, tol=1e-6)
    q["E2"]["families"] = [
        dict(name="rare", kind="shot", m=8.0, kappas=[1.0], fits=["const", "spline", "shocks"], shocks_max_kappa=None),
        dict(name="slow", kind="regime", q=0.05, kappas=[1.0], fits=["const"], shocks_max_kappa=None),
    ]
    q["E3"].update(n_list=[0.5], T=300.0, p_list=[1.0, 0.5], R=2, tol=1e-6)
    q["E3"]["het"].update(T=300.0, R=2, p_cases={"positive": [0.2, 0.8]})
    q["E4"].update(T=200.0, alt_values=[0.2], R_size=2, R_power=2, tol=1e-6)
    q["E4"]["common_shock"].update(R=2)
    q["E6"].update(T_train=200.0, n_windows=6, n_sim=200, R=2, pilot_T=2000.0, tol=1e-6)
    return q


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------
def rng_for(exp, *keys):
    return np.random.default_rng(np.random.SeedSequence([BASE_SEED, EXP_INDEX[exp], *[int(k) for k in keys]]))


def jsonify(x):
    if isinstance(x, dict):
        return {str(k): jsonify(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [jsonify(v) for v in x]
    if isinstance(x, np.ndarray):
        return jsonify(x.tolist())
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        x = float(x)
        if math.isnan(x):
            return None
        if math.isinf(x):
            return "inf" if x > 0 else "-inf"
        return x
    return x


def _arr(x):
    return np.array([NAN if v is None else (np.inf if v == "inf" else (-np.inf if v == "-inf" else v)) for v in x], float)


def mstat(x):
    """Mean, Monte Carlo SE, SD, median and quartiles of the finite values."""
    x = np.asarray(x, float)
    n_all = x.size
    x = x[np.isfinite(x)]
    n = x.size
    if n == 0:
        return dict(n=0, n_nonfinite=n_all, mean=NAN, mcse=NAN, sd=NAN, median=NAN, q25=NAN, q75=NAN)
    sd = float(x.std(ddof=1)) if n > 1 else NAN
    return dict(n=n, n_nonfinite=n_all - n, mean=float(x.mean()), mcse=sd / math.sqrt(n) if n > 1 else NAN, sd=sd,
                median=float(np.median(x)), q25=float(np.quantile(x, 0.25)), q75=float(np.quantile(x, 0.75)))


def rate(flags):
    f = np.asarray(flags, bool)
    n = f.size
    p = float(f.mean()) if n else NAN
    return dict(n=n, rate=p, mcse=math.sqrt(p * (1 - p) / n) if n else NAN)


def err_stats(est, truth, lo=None, hi=None):
    """Bias, RMSE (with Monte Carlo SEs) and CI coverage. A missing CI (no SE,
    e.g. an estimate on the boundary) counts as a miss; their number is reported."""
    est = np.asarray(est, float)
    ok = np.isfinite(est)
    e = est[ok] - truth
    n = e.size
    out = dict(truth=float(truth), n=n, n_nonfinite=int((~ok).sum()))
    if n == 0:
        out.update(mean=NAN, bias=NAN, bias_mcse=NAN, rel_bias=NAN, rmse=NAN, rmse_mcse=NAN, sd=NAN)
    else:
        bias = float(e.mean())
        sd = float(e.std(ddof=1)) if n > 1 else NAN
        mse = float(np.mean(e**2))
        rmse = math.sqrt(mse)
        rmse_mcse = float(np.std(e**2, ddof=1) / (2 * rmse * math.sqrt(n))) if n > 1 and rmse > 0 else NAN
        out.update(mean=float(est[ok].mean()), bias=bias, bias_mcse=sd / math.sqrt(n) if n > 1 else NAN,
                   rel_bias=bias / truth if truth != 0 else NAN, rmse=rmse, rmse_mcse=rmse_mcse,
                   rel_rmse=rmse / abs(truth) if truth != 0 else NAN, sd=sd)
    if lo is not None:
        lo = np.asarray(lo, float)
        hi = np.asarray(hi, float)
        have = np.isfinite(lo) & np.isfinite(hi)
        cov = have & (lo <= truth) & (truth <= hi)
        R = cov.size
        c = float(cov.mean()) if R else NAN
        out.update(coverage=c, coverage_mcse=math.sqrt(c * (1 - c) / R) if R else NAN, n_ci_missing=int((~have).sum()),
                   coverage_given_ci=float(cov[have].mean()) if have.any() else NAN,
                   mean_halfwidth=float(np.mean((hi - lo)[have]) / 2) if have.any() else NAN)
    return out


def logit_ci(s, se):
    """95% CI for a share s in (0, 1) on the logit scale (delta method)."""
    s = np.asarray(s, float)
    se = np.asarray(se, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        ok = (s > 0) & (s < 1) & np.isfinite(se)
        lg = np.log(s / (1 - s))
        sel = se / (s * (1 - s))
        lo = np.where(ok, 1 / (1 + np.exp(-(lg - Z95 * sel))), NAN)
        hi = np.where(ok, 1 / (1 + np.exp(-(lg + Z95 * sel))), NAN)
    return lo, hi


def delta_method(fun, x, cov, positive):
    """Values and delta-method SEs of the vector function fun at x, with
    central-difference Jacobian."""
    x = np.asarray(x, float)
    y0 = np.asarray(fun(x), float)
    if cov is None or not np.all(np.isfinite(cov)):
        return y0, np.full(y0.size, NAN)
    J = np.zeros((y0.size, x.size))
    for i in range(x.size):
        h = 1e-5 * max(abs(x[i]), 1e-2)
        if positive[i]:
            h = min(h, 0.5 * x[i])
        xp = x.copy()
        xm = x.copy()
        xp[i] += h
        xm[i] -= h
        J[:, i] = (np.asarray(fun(xp), float) - np.asarray(fun(xm), float)) / (2 * h)
    V = J @ cov @ J.T
    d = np.diag(V)
    se = np.where(np.isfinite(d), np.sqrt(np.clip(d, 0.0, None)), NAN)
    return y0, se


def spec_from_names(spec, names, x):
    """Copy of a fitted spec with the free parameters (FitResult.info['se_names']) set to x."""
    mu = np.array(spec.mu, float).copy()
    A = spec.alpha.copy()
    beta = float(np.asarray(spec.beta, float).ravel()[0])
    sb = spec.shock_beta.copy()
    eta = float(spec.shock_rate_vec[0])
    for (key, ix), v in zip(names, x):
        if key == "mu":
            mu[ix] = v
        elif key == "A":
            A[ix] = v
        elif key == "Bm_all":
            beta = v
        elif key == "sb":
            sb[ix] = v
        elif key == "eta_all":
            eta = v
        else:  # pragma: no cover
            raise ValueError(f"unsupported parameter {key}")
    return spec.copy(mu=mu, alpha=A, beta=beta, shock_beta=sb, shock_rate=eta)


def n_eff(alpha, beta, events, T):
    """In-window branching ratio of a univariate fit: expected offspring inside
    [0, T] per event, alpha * mean(1 - exp(-beta (T - t_l))). Equals the
    fraction of events EM attributes to self-excitation at the fixed point."""
    t = np.asarray(events, float)
    if t.size == 0:
        return NAN
    return float(alpha * np.mean(-np.expm1(-beta * (T - t))))


class Runner:
    """Map tasks over at most ``workers`` processes (spawn), in order."""

    def __init__(self, workers=1, log=print):
        self.workers = int(workers)
        self.log = log
        self.pool = mp.get_context("spawn").Pool(self.workers, initializer=_worker_init) if self.workers > 1 else None

    def map(self, fn, tasks, label=""):
        out = []
        n = len(tasks)
        step = max(1, n // 10)
        t0 = time.time()
        it = self.pool.imap(fn, tasks, chunksize=1) if self.pool is not None else map(fn, tasks)
        for i, r in enumerate(it):
            out.append(r)
            if (i + 1) % step == 0 or i + 1 == n:
                self.log(f"  [{label}] {i + 1}/{n} tasks, {time.time() - t0:.0f}s")
        return out

    def close(self):
        if self.pool is not None:
            self.pool.close()
            self.pool.join()


def _worker_init():
    warnings.simplefilter("ignore")


class _timed:
    """Picklable task wrapper: catch errors (recorded, not fatal), time the
    task, mute warnings. Failed tasks keep their identifiers in ``ids``."""

    def __init__(self, fn):
        self.fn = fn

    def __call__(self, args):
        t0 = time.process_time()
        w0 = time.time()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                res = self.fn(args)
                res["ok"] = True
            except Exception as exc:  # noqa: BLE001 - recorded in the results
                res = {"ok": False, "error": f"{type(exc).__name__}: {exc}",
                       "ids": [a for a in args if isinstance(a, (int, str, float))]}
        return res, {"cpu": time.process_time() - t0, "wall": time.time() - w0}


def _split_timing(results):
    reps = [r for r, _ in results]
    cpu = float(sum(t["cpu"] for _, t in results))
    return reps, cpu


# ---------------------------------------------------------------------------
# E1  Recovery (and the per-replicate attribution estimates used by E5)
# ---------------------------------------------------------------------------
def e1_spec(cfg, T):
    shocks = [s for s in cfg["shocks"] if s[0] < T]
    return HawkesSpec(cfg["M"], np.array(cfg["mu"], float), np.array(cfg["A"], float), beta=cfg["beta"],
                      shocks=shocks, shock_beta=np.array(cfg["shock_beta"], float), shock_rate=cfg["shock_rate"])


def e1_param_names(M):
    names = [f"mu[{k}]" for k in range(M)]
    names += [f"alpha[{k},{j}]" for k in range(M) for j in range(M)]
    names += ["beta"] + [f"shock_beta[{k}]" for k in range(M)] + ["eta"]
    return names


def e1_params(spec):
    M = spec.M
    v = list(np.asarray(spec.mu, float)) + list(spec.alpha.ravel())
    v += [float(np.asarray(spec.beta, float).ravel()[0])] + list(spec.shock_beta) + [float(spec.shock_rate_vec[0])]
    return np.array(v, float), e1_param_names(M)


def e1_se(fit, M):
    se = fit.se
    v = list(se["mu"]) + list(se["alpha"].ravel()) + [float(se["beta"][0, 0])]
    v += list(se["shock_beta"]) + [float(se["shock_rate"][0])]
    return np.array(v, float)


def channel_mask(cfg):
    M = cfg["M"]
    mask = np.zeros((M, M), bool)
    mask[np.ix_(cfg["offline"], cfg["online"])] = True
    return mask


def derived(spec, cfg):
    """Derived quantities: multiplier entries, spectral radius, and the surge
    decomposition of the attribution shock. Returns (names, values, kinds)."""
    M = cfg["M"]
    names, vals, kinds = [], [], []
    Mm = multiplier(spec.alpha)
    for k in range(M):
        for j in range(M):
            names.append(f"Mult[{k},{j}]")
            vals.append(Mm[k, j])
            kinds.append("mult")
    names.append("rho(A)")
    vals.append(spectral_radius(spec.alpha))
    kinds.append("rho")
    att = cfg["attribution"]
    e = att["shock_index"]
    mask = channel_mask(cfg)
    off = cfg["offline"]
    inf_done = False
    for H in att["H_list"]:
        d = decompose_surge(spec, e, H, spillover_through=mask)
        by = d["by_stream"]
        sp = d["spillover"]
        B = by["background"] + by["other_shocks"]
        D, C = by["direct"], by["contagion"]
        tag = f"H{H:g}"
        for k in range(M):
            for nm, v, kd in ((f"B[{k}]@{tag}", B[k], "count"), (f"D[{k}]@{tag}", D[k], "count"),
                              (f"C[{k}]@{tag}", C[k], "count"), (f"share[{k}]@{tag}", C[k] / (D[k] + C[k]), "share")):
                names.append(nm)
                vals.append(v)
                kinds.append(kd)
        for k in off:
            names += [f"Con[{k}]@{tag}", f"sigma[{k}]@{tag}"]
            vals += [sp["horizon"][k], sp["share_horizon"][k]]
            kinds += ["count", "share"]
        if not inf_done:
            inf_done = True
            Di, Ci = d["infinite"]["direct"], d["infinite"]["contagion"]
            for k in range(M):
                names += [f"D[{k}]@inf", f"C[{k}]@inf", f"share[{k}]@inf"]
                vals += [Di[k], Ci[k], Ci[k] / (Di[k] + Ci[k])]
                kinds += ["count", "count", "share"]
            for k in off:
                names += [f"Con[{k}]@inf", f"sigma[{k}]@inf"]
                vals += [sp["infinite"][k], sp["share_infinite"][k]]
                kinds += ["count", "share"]
    return names, np.array(vals, float), kinds


def _e1_task(args):
    cfg, ti, rep = args
    T = cfg["T_list"][ti]
    spec = e1_spec(cfg, T)
    rng = rng_for("E1", ti, rep)
    ev = simulate(spec, T, rng)
    t0 = time.time()
    fit = fit_em(ev, T, cfg["M"], shocks=spec.shocks, tol=cfg["tol"], max_iter=cfg["max_iter"], compute_se=True)
    fit_sec = time.time() - t0
    est, _ = e1_params(fit.spec)
    se = e1_se(fit, cfg["M"])
    names_x = fit.info["se_names"]
    cov = fit.info["cov"]
    x0 = []
    for key, ix in names_x:
        if key == "mu":
            x0.append(fit.spec.mu[ix])
        elif key == "A":
            x0.append(fit.spec.alpha[ix])
        elif key == "Bm_all":
            x0.append(float(np.asarray(fit.spec.beta).ravel()[0]))
        elif key == "sb":
            x0.append(fit.spec.shock_beta[ix])
        elif key == "eta_all":
            x0.append(float(fit.spec.shock_rate_vec[0]))
    x0 = np.array(x0, float)
    positive = np.ones(x0.size, bool)

    def g(x):
        return derived(spec_from_names(fit.spec, names_x, x), cfg)[1]

    dval, dse = delta_method(g, x0, cov, positive)
    return dict(ti=ti, rep=rep, n_events=[int(e.size) for e in ev], est=est, se=se, se_flag=fit.se_flag,
                converged=bool(fit.converged), n_iter=int(fit.n_iter), loglik=float(fit.loglik), fit_sec=fit_sec,
                derived=dval, derived_se=dse)


def run_E1(cfg, runner, ctx):
    # longest series first (load balance); results are matched by (ti, rep)
    tasks = [(cfg, ti, rep) for ti in reversed(range(len(cfg["T_list"]))) for rep in range(cfg["R"])]
    res, cpu = _split_timing(runner.map(_timed(_e1_task), tasks, "E1"))
    res = sorted(res, key=lambda r: (r.get("ti", -1), r.get("rep", -1)))
    M = cfg["M"]
    pnames = e1_param_names(M)
    summary = {"by_T": []}
    for ti, T in enumerate(cfg["T_list"]):
        spec = e1_spec(cfg, T)
        truth, _ = e1_params(spec)
        dnames, dtruth, dkinds = derived(spec, cfg)
        reps = [r for r in res if r.get("ok") and r["ti"] == ti]
        est = np.array([r["est"] for r in reps])
        se = np.array([r["se"] for r in reps])
        dv = np.array([r["derived"] for r in reps])
        ds = np.array([r["derived_se"] for r in reps])
        params = {}
        for i, nm in enumerate(pnames):
            params[nm] = err_stats(est[:, i], truth[i], est[:, i] - Z95 * se[:, i], est[:, i] + Z95 * se[:, i])
            params[nm]["mean_se"] = mstat(se[:, i])["mean"]
        der = {}
        for i, nm in enumerate(dnames):
            if dkinds[i] == "share":
                lo, hi = logit_ci(dv[:, i], ds[:, i])
            else:
                lo, hi = dv[:, i] - Z95 * ds[:, i], dv[:, i] + Z95 * ds[:, i]
            der[nm] = err_stats(dv[:, i], dtruth[i], lo, hi)
            der[nm]["kind"] = dkinds[i]
            der[nm]["mean_se"] = mstat(ds[:, i])["mean"]
        alpha_names = [n for n in pnames if n.startswith("alpha")]
        mult_names = [n for n in dnames if n.startswith("Mult")]
        agg = {}
        for grp, nms, src in (("mu", [n for n in pnames if n.startswith("mu")], params), ("alpha", alpha_names, params),
                              ("shock_beta", [n for n in pnames if n.startswith("shock_beta")], params),
                              ("Mult", mult_names, der)):
            agg[grp] = dict(
                mean_abs_bias=float(np.mean([abs(src[n]["bias"]) for n in nms])),
                mean_rmse=float(np.mean([src[n]["rmse"] for n in nms])),
                max_rmse=float(np.max([src[n]["rmse"] for n in nms])),
                mean_rel_rmse=float(np.mean([src[n]["rel_rmse"] for n in nms])),
                coverage_mean=float(np.mean([src[n]["coverage"] for n in nms])),
                coverage_min=float(np.min([src[n]["coverage"] for n in nms])),
                coverage_max=float(np.max([src[n]["coverage"] for n in nms])),
            )
        flags = [r["se_flag"] for r in reps]
        summary["by_T"].append(dict(
            T=T, R=len(reps), n_failed=cfg["R"] - len(reps),
            n_events=mstat([sum(r["n_events"]) for r in reps]),
            n_events_by_stream=[mstat([r["n_events"][k] for r in reps])["mean"] for k in range(M)],
            converged=rate([r["converged"] for r in reps]),
            se_flag_ok=rate([f == "ok" for f in flags]),
            se_flags_not_ok=sorted(set(f for f in flags if f != "ok")),
            fit_seconds=mstat([r["fit_sec"] for r in reps]),
            params=params, derived=der, aggregates=agg,
        ))
    raw_reps = [{k: v for k, v in r.items() if k != "fit_sec"} for r in res]
    ctx["E1"] = dict(config=cfg, reps=raw_reps)
    return dict(summary=summary, reps=raw_reps, cpu=cpu, R=cfg["R"],
                seeds=dict(scheme="SeedSequence([BASE_SEED, 1, T_index, rep])"))


# ---------------------------------------------------------------------------
# E5  Surge attribution: exact vs branching-label Monte Carlo; estimates from E1
# ---------------------------------------------------------------------------
def _label_components(ev, lab, cfg, e, H_list):
    """Per stream and horizon: counts in (tau_e, tau_e + H] of background-rooted
    (incl. other shocks), direct, contagion and online-channel contagion."""
    info = cluster_info(ev, lab)
    M = cfg["M"]
    tau = cfg["shocks"][e][0]
    times, dims, parent, gen, root = info["times"], info["dims"], info["parent"], info["generation"], info["root"]
    off = np.zeros(M, bool)
    off[cfg["offline"]] = True
    on = np.zeros(M, bool)
    on[cfg["online"]] = True
    cross = np.zeros(times.size, bool)
    has_par = parent >= 0
    step = np.zeros(times.size, bool)
    step[has_par] = on[dims[parent[has_par]]] & off[dims[has_par]]
    for gg in range(1, int(gen.max()) + 1 if gen.size else 1):
        idx = np.flatnonzero(gen == gg)
        cross[idx] = cross[parent[idx]] | step[idx]
    out = []
    for H in H_list:
        w = (times > tau) & (times <= tau + H)
        mine = root == -2 - e
        res = np.zeros((4, M))
        for k in range(M):
            s = w & (dims == k)
            res[0, k] = np.sum(s & ~mine)
            res[1, k] = np.sum(s & mine & (gen == 0))
            res[2, k] = np.sum(s & mine & (gen > 0))
            res[3, k] = np.sum(s & mine & (gen > 0) & cross)
        out.append(res)
    return np.array(out)  # (nH, 4, M)


def _e5_task(args):
    cfg1, chunk_i, n = args
    att = cfg1["attribution"]
    e = att["shock_index"]
    H_list = att["H_list"]
    T_end = cfg1["shocks"][e][0] + max(H_list) + 1.0
    spec = e1_spec(cfg1, T_end)
    rng = rng_for("E5", 0, chunk_i)
    s1 = None
    s2 = None
    for _ in range(n):
        ev, lab = simulate(spec, T_end, rng, return_branching=True)
        c = _label_components(ev, lab, cfg1, e, H_list)
        s1 = c if s1 is None else s1 + c
        s2 = c**2 if s2 is None else s2 + c**2
    return dict(chunk=chunk_i, n=n, sum=s1, sumsq=s2)


def run_E5(cfg, runner, ctx):
    if "E1" in ctx:
        e1 = ctx["E1"]
    else:
        with open(os.path.join(ctx["results"], "raw", "E1.json")) as f:
            e1 = json.load(f)
    cfg1 = e1["config"]
    cfg1 = {**cfg1, "shocks": [tuple(s) for s in cfg1["shocks"]]}
    n_chunks = int(math.ceil(cfg["n_mc"] / cfg["chunk"]))
    tasks = [(cfg1, c, min(cfg["chunk"], cfg["n_mc"] - c * cfg["chunk"])) for c in range(n_chunks)]
    res, cpu = _split_timing(runner.map(_timed(_e5_task), tasks, "E5"))
    res = [r for r in res if r.get("ok")]
    N = sum(r["n"] for r in res)
    S1 = sum(np.asarray(r["sum"], float) for r in res)
    S2 = sum(np.asarray(r["sumsq"], float) for r in res)
    mean = S1 / N
    var = (S2 - N * mean**2) / (N - 1)
    mcse = np.sqrt(np.clip(var, 0, None) / N)
    att = cfg1["attribution"]
    e = att["shock_index"]
    M = cfg1["M"]
    spec_true = e1_spec(cfg1, max(cfg1["T_list"]))
    mask = channel_mask(cfg1)
    validation = []
    for hi, H in enumerate(att["H_list"]):
        d = decompose_surge(spec_true, e, H, spillover_through=mask)
        by = d["by_stream"]
        exact = np.vstack([by["background"] + by["other_shocks"], by["direct"], by["contagion"], d["spillover"]["horizon"]])
        rows = []
        for ci, comp in enumerate(["B", "D", "C", "Con"]):
            for k in range(M):
                if comp == "Con" and k not in cfg1["offline"]:
                    continue
                z = (mean[hi, ci, k] - exact[ci, k]) / mcse[hi, ci, k] if mcse[hi, ci, k] > 0 else NAN
                rows.append(dict(component=comp, stream=k, exact=exact[ci, k], mc_mean=mean[hi, ci, k], mc_se=mcse[hi, ci, k], z=z))
        shares = []
        for k in range(M):
            sh_mc = mean[hi, 2, k] / (mean[hi, 1, k] + mean[hi, 2, k])
            sh_ex = by["contagion"][k] / (by["direct"][k] + by["contagion"][k])
            row = dict(stream=k, share_exact=sh_ex, share_mc=sh_mc)
            if k in cfg1["offline"]:
                row.update(sigma_exact=d["spillover"]["share_horizon"][k], sigma_mc=mean[hi, 3, k] / mean[hi, 2, k])
            shares.append(row)
        zs = np.array([r["z"] for r in rows], float)
        validation.append(dict(H=H, rows=rows, shares=shares, max_abs_z=float(np.nanmax(np.abs(zs)))))
    # estimated vs true, from the E1 fits
    est = []
    e1_summary = ctx.get("E1_summary")
    if e1_summary is None:
        e1_summary = e1.get("summary")
    for bt in e1_summary["by_T"]:
        rows = {nm: v for nm, v in bt["derived"].items() if not nm.startswith("Mult") and nm != "rho(A)"}
        est.append(dict(T=bt["T"], R=bt["R"], quantities=rows))
    summary = dict(shock=dict(index=e, tau=cfg1["shocks"][e][0], S=cfg1["shocks"][e][1]), H_list=att["H_list"],
                   n_mc=N, mc_validation=validation, estimated=est,
                   note="B includes clusters rooted in other shocks (B = B^mu + O); Con = online-channel contagion "
                        "(paths with >= 1 online->offline step), sigma = Con/C.")
    return dict(summary=summary, reps=[], cpu=cpu, R=N,
                seeds=dict(scheme="SeedSequence([BASE_SEED, 5, 0, chunk]); estimates reuse the E1 replicates"))


# ---------------------------------------------------------------------------
# E2  Spurious contagion
# ---------------------------------------------------------------------------
def e2_configs(cfg):
    out = []
    for fi, fam in enumerate(cfg["families"]):
        for ki, kappa in enumerate(fam["kappas"]):
            fits = list(fam["fits"])
            if "shocks" in fits and fam.get("shocks_max_kappa") is not None and kappa > fam["shocks_max_kappa"] + 1e-12:
                fits.remove("shocks")
            out.append(dict(family=fam["name"], kind=fam["kind"], kappa=float(kappa), fam=fam, fi=fi, ki=ki, fits=fits))
    return out


def e2_theory(cfg, c):
    Lam, kappa = cfg["Lam"], c["kappa"]
    th = dict(kappa=kappa, n_star=float(spurious_branching(kappa)), mu_star=Lam / math.sqrt(1 + kappa))
    if c["kind"] == "shot":
        m = c["fam"]["m"]
        s = kappa / m
        g = cfg["gamma"]
        th.update(m=m, share_shock=s, shot_rate=s * Lam / m, nu=Lam * (1 - s), a=m * g, gamma=g,
                  beta_star=g * math.sqrt(1 + kappa))
        w = cfg["moment_window"]
        fw = 1 + kappa * (1 - (1 - math.exp(-g * w)) / (g * w))
        th.update(moment_window=w, n_star_window=1 - fw ** -0.5)
    else:
        q = c["fam"]["q"]
        delta = math.sqrt(kappa * Lam * q / 2)
        th.update(q=q, delta=delta, rates=[Lam - delta, Lam + delta], gamma=q, beta_star=q * math.sqrt(1 + kappa))
    return th


def _e2_task(args):
    cfg, ci, rep = args
    c = e2_configs(cfg)[ci]
    th = e2_theory(cfg, c)
    T = cfg["T"]
    rng = rng_for("E2", ci, rep)
    shots = None
    if c["kind"] == "shot":
        L = cfg["burn"]
        ns = rng.poisson(th["shot_rate"] * (T + L))
        shots = np.sort(-L + (T + L) * rng.random(ns))
        spec = HawkesSpec(1, [th["nu"]], [[0.0]], beta=1.0, shocks=[(float(x), 1.0) for x in shots],
                          shock_beta=[th["m"]], shock_rate=th["gamma"])
    else:
        q2 = th["q"] / 2.0
        state = int(rng.random() < 0.5)
        breaks, vals, t = [0.0], [], 0.0
        while t < T:
            vals.append(th["rates"][state])
            t += rng.exponential(1.0 / q2)
            breaks.append(t)
            state = 1 - state
        spec = HawkesSpec(1, PiecewiseConstant(breaks, np.array(vals)), [[0.0]], beta=1.0)
    ev = simulate(spec, T, rng)
    t_ev = ev[0]
    out = dict(ci=ci, rep=rep, n_events=int(t_ev.size), n_shots=None if shots is None else int(shots.size))
    lo_bound = 0.01 / T
    for fk in c["fits"]:
        t0 = time.time()
        if fk == "const":
            f = fit_em(ev, T, 1, tol=cfg["tol"], max_iter=cfg["max_iter"])
        elif fk == "spline":
            f = fit_em(ev, T, 1, background="spline", n_basis=cfg["n_basis"], tol=cfg["tol"], max_iter=cfg["max_iter"])
        else:
            f = fit_em(ev, T, 1, shocks=[(float(x), 1.0) for x in shots], tol=cfg["tol"], max_iter=cfg["max_iter"])
        a = float(f.spec.alpha[0, 0])
        b = float(np.asarray(f.spec.beta).ravel()[0])
        rec = dict(alpha=a, beta=b, mu_bar=float(f.spec.mu_bar(T)[0]), n_eff=n_eff(a, b, t_ev, T),
                   loglik=float(f.loglik), converged=bool(f.converged), n_iter=int(f.n_iter),
                   beta_at_lower_bound=bool(b <= 1.01 * lo_bound), sec=time.time() - t0)
        if fk == "shocks":
            rec.update(shock_beta=float(f.spec.shock_beta[0]), eta=float(f.spec.shock_rate_vec[0]))
        out[fk] = rec
    if c["kind"] == "shot":
        w = cfg["moment_window"]
        cnt = np.bincount(np.minimum((t_ev // w).astype(int), int(T // w) - 1), minlength=int(T // w))
        F = float(cnt.var(ddof=1) / cnt.mean())
        out["moment"] = dict(F=F, n_F=1 - F ** -0.5 if F > 0 else NAN)
    return out


def run_E2(cfg, runner, ctx):
    confs = e2_configs(cfg)
    tasks = [(cfg, ci, rep) for ci in range(len(confs)) for rep in range(cfg["R"])]
    # most expensive (shocks-known, many shots) first for load balance
    order = sorted(range(len(tasks)), key=lambda i: -(("shocks" in confs[tasks[i][1]]["fits"]) * confs[tasks[i][1]]["kappa"]
                                                     / confs[tasks[i][1]]["fam"].get("m", 1e9) ** 2))
    out_ordered = runner.map(_timed(_e2_task), [tasks[i] for i in order], "E2")
    res_t = [None] * len(tasks)
    for pos, i in enumerate(order):
        res_t[i] = out_ordered[pos]
    res, cpu = _split_timing(res_t)
    summary = []
    for ci, c in enumerate(confs):
        th = e2_theory(cfg, c)
        reps = [r for r in res if r.get("ok") and r["ci"] == ci]
        row = dict(family=c["family"], kind=c["kind"], kappa=c["kappa"], theory=th, R=len(reps),
                   n_failed=cfg["R"] - len(reps), n_events=mstat([r["n_events"] for r in reps]),
                   n_shots=mstat([r["n_shots"] for r in reps]) if c["kind"] == "shot" else None, fits={})
        for fk in c["fits"]:
            al = np.array([r[fk]["alpha"] for r in reps])
            ne = np.array([r[fk]["n_eff"] for r in reps])
            be = np.array([r[fk]["beta"] for r in reps])
            row["fits"][fk] = dict(
                alpha=mstat(al), n_eff=mstat(ne), beta=mstat(be), mu_bar=mstat([r[fk]["mu_bar"] for r in reps]),
                gap_alpha_minus_nstar=mstat(al - th["n_star"]), gap_neff_minus_nstar=mstat(ne - th["n_star"]),
                beta_at_lower_bound=rate([r[fk]["beta_at_lower_bound"] for r in reps]),
                converged=rate([r[fk]["converged"] for r in reps]), seconds=mstat([r[fk]["sec"] for r in reps]))
            if fk == "shocks":
                row["fits"][fk]["shock_beta"] = mstat([r[fk]["shock_beta"] for r in reps])
                row["fits"][fk]["eta"] = mstat([r[fk]["eta"] for r in reps])
        if "const" in c["fits"] and "spline" in c["fits"]:
            row["dloglik_spline_minus_const"] = mstat([r["spline"]["loglik"] - r["const"]["loglik"] for r in reps])
        if c["kind"] == "shot":
            row["moment"] = dict(n_F=mstat([r["moment"]["n_F"] for r in reps]), F=mstat([r["moment"]["F"] for r in reps]))
        summary.append(row)
    raw = [{k: (({kk: vv for kk, vv in v.items() if kk != "sec"}) if isinstance(v, dict) else v) for k, v in r.items()}
           for r in res]
    return dict(summary=dict(configs=summary, lower_beta_bound=0.01 / cfg["T"],
                             note="alpha = fitted branching ratio n_hat; n_eff = alpha * mean(1 - exp(-beta (T - t_l))) "
                                  "= share of events EM attributes to self-excitation (differs from alpha when beta_hat T is small)."),
                reps=raw, cpu=cpu, R=cfg["R"], seeds=dict(scheme="SeedSequence([BASE_SEED, 2, config_index, rep])"))


# ---------------------------------------------------------------------------
# E3  Thinning
# ---------------------------------------------------------------------------
def _corr_se(n_app, se_app, p, p_hat=None, se_p=None):
    """Corrected n = h_p^{-1}(n_app) and its delta-method SE (eq:th-delta)."""
    pp = p if p_hat is None else p_hat
    if not np.isfinite(n_app) or n_app >= 1 or n_app < 0:
        return NAN, NAN
    n = float(inverse_apparent_branching(n_app, pp))
    v = ((1 - n) ** 3 / (pp * (1 - n_app) ** 3)) ** 2 * se_app**2
    if se_p is not None:
        v += (n * (1 - n) * (2 - n) / (2 * pp)) ** 2 * se_p**2
    return n, math.sqrt(v) if np.isfinite(v) else NAN


def _e3_task(args):
    cfg, kind, ci, rep = args
    if kind == "hom":
        n = cfg["n_list"][ci]
        T = cfg["T"]
        spec = HawkesSpec(1, [cfg["Lam"] * (1 - n)], [[n]], beta=cfg["beta"])
        rng = rng_for("E3", ci, rep)
        ev = simulate(spec, T, rng)[0]
        U = rng.random(ev.size)
        Z = rng.standard_normal(len(cfg["p_list"]))
        out = dict(kind=kind, ci=ci, rep=rep, by_p=[])
        for pi, p in enumerate(cfg["p_list"]):
            evp = ev[U < p]
            f = fit_em([evp], T, 1, tol=cfg["tol"], max_iter=cfg["max_iter"], compute_se=True)
            na = float(f.spec.alpha[0, 0])
            sa = float(f.se["alpha"][0, 0])
            nk, sk = _corr_se(na, sa, p)
            se_p = cfg["p_rel_se"] * p
            p_hat = float(np.clip(p + se_p * Z[pi], 0.02, 1.0))
            ne, se_e = _corr_se(na, sa, p, p_hat=p_hat, se_p=cfg["p_rel_se"] * p_hat)
            out["by_p"].append(dict(p=p, N=int(evp.size), n_app=na, se_app=sa, beta_app=float(np.asarray(f.spec.beta).ravel()[0]),
                                    mu_app=float(f.spec.mu[0]), se_flag=f.se_flag, n_corr_known=nk, se_corr_known=sk,
                                    p_hat=p_hat, n_corr_est=ne, se_corr_est=se_e))
        return out
    het = cfg["het"]
    case = list(het["p_cases"])[ci]
    px = np.array(het["p_cases"][case], float)
    pi_ = np.array(het["pi"], float)
    nx = np.array(het["n_x"], float)
    nbar = float(pi_ @ nx)
    A = np.outer(pi_, nx)
    spec = HawkesSpec(2, het["Lam"] * (1 - nbar) * pi_, A, beta=het["beta"])
    rng = rng_for("E3", 100 + ci, rep)
    ev = simulate(spec, het["T"], rng)
    kept = [e[rng.random(e.size) < px[k]] for k, e in enumerate(ev)]
    merged = np.sort(np.concatenate(kept))
    f = fit_em([merged], het["T"], 1, tol=cfg["tol"], max_iter=cfg["max_iter"], compute_se=True)
    na = float(f.spec.alpha[0, 0])
    pbar = float(pi_ @ px)
    ncorr = float(inverse_apparent_branching(na, pbar)) if 0 <= na < 1 else NAN
    return dict(kind=kind, ci=ci, rep=rep, case=case, N=int(merged.size), n_app=na, se_app=float(f.se["alpha"][0, 0]),
                beta_app=float(np.asarray(f.spec.beta).ravel()[0]), n_corr_naive=ncorr)


def e3_het_theory(het, case):
    px = np.array(het["p_cases"][case], float)
    pi_ = np.array(het["pi"], float)
    nx = np.array(het["n_x"], float)
    nbar = float(pi_ @ nx)
    pbar = float(pi_ @ px)
    Epn = float(pi_ @ (px * nx))
    En2 = float(pi_ @ nx**2)
    covpn = Epn - pbar * nbar
    varn = En2 - nbar**2
    npp = 1 - (1 - nbar) / math.sqrt((1 - nbar) ** 2 + 2 * (1 - nbar) * Epn + pbar * En2)
    nnaive = 1 - (1 - nbar) / math.sqrt(1 + 2 * (1 - nbar) * covpn / pbar + varn)
    return dict(p_x=list(px), pi=list(pi_), n_x=list(nx), n_bar=nbar, p_bar=pbar, cov_pn=covpn, var_n=varn,
                n_app_theory=npp, n_naive_theory=nnaive, n_app_homogeneous=float(apparent_branching(nbar, pbar)),
                n_naive_check=float(inverse_apparent_branching(npp, pbar)))


def run_E3(cfg, runner, ctx):
    het = cfg["het"]
    tasks = [(cfg, "hom", ci, rep) for ci in range(len(cfg["n_list"])) for rep in range(cfg["R"])]
    tasks += [(cfg, "het", ci, rep) for ci in range(len(het["p_cases"])) for rep in range(het["R"])]
    res, cpu = _split_timing(runner.map(_timed(_e3_task), tasks, "E3"))
    hom = []
    for ci, n in enumerate(cfg["n_list"]):
        reps = [r for r in res if r.get("ok") and r["kind"] == "hom" and r["ci"] == ci]
        rows = []
        for pi, p in enumerate(cfg["p_list"]):
            d = [r["by_p"][pi] for r in reps]
            na = np.array([x["n_app"] for x in d])
            sa = np.array([x["se_app"] for x in d])
            nk = np.array([x["n_corr_known"] for x in d])
            sk = np.array([x["se_corr_known"] for x in d])
            ne = np.array([x["n_corr_est"] for x in d])
            se_ = np.array([x["se_corr_est"] for x in d])
            n_app_th = float(apparent_branching(n, p))
            rows.append(dict(
                p=p, n_true=n, n_app_theory=n_app_th, N=mstat([x["N"] for x in d]),
                naive_vs_n=err_stats(na, n, na - Z95 * sa, na + Z95 * sa),
                naive_vs_napp=err_stats(na, n_app_th, na - Z95 * sa, na + Z95 * sa),
                corrected_known_p=err_stats(nk, n, nk - Z95 * sk, nk + Z95 * sk),
                corrected_est_p=err_stats(ne, n, ne - Z95 * se_, ne + Z95 * se_),
                beta_app=err_stats([x["beta_app"] for x in d], float(apparent_beta(n, cfg["beta"], p))),
                mu_app=err_stats([x["mu_app"] for x in d], float(apparent_mu(cfg["Lam"] * (1 - n), n, p))),
                se_flag_ok=rate([x["se_flag"] == "ok" for x in d]),
            ))
        hom.append(dict(n=n, R=len(reps), by_p=rows))
    hets = []
    for ci, case in enumerate(het["p_cases"]):
        reps = [r for r in res if r.get("ok") and r["kind"] == "het" and r["ci"] == ci]
        th = e3_het_theory(het, case)
        hets.append(dict(case=case, theory=th, R=len(reps), N=mstat([r["N"] for r in reps]),
                         n_app_vs_theory=err_stats([r["n_app"] for r in reps], th["n_app_theory"]),
                         n_corrected_vs_naive_theory=err_stats([r["n_corr_naive"] for r in reps], th["n_naive_theory"]),
                         n_corrected_vs_nbar=err_stats([r["n_corr_naive"] for r in reps], th["n_bar"])))
    return dict(summary=dict(homogeneous=hom, heterogeneous=hets,
                             note="corrected_est_p: p_hat = clip(p (1 + p_rel_se Z), 0.02, 1), SE(p_hat) = p_rel_se * p_hat, "
                                  "independent of the data; CIs from eq:th-delta. Missing SE (alpha on the boundary) counts as non-coverage."),
                reps=res, cpu=cpu, R=cfg["R"],
                seeds=dict(scheme="hom: SeedSequence([BASE_SEED, 3, n_index, rep]); het: SeedSequence([BASE_SEED, 3, 100 + case_index, rep])"))


# ---------------------------------------------------------------------------
# E4  Online -> offline LRT
# ---------------------------------------------------------------------------
def e4_scenarios(cfg):
    sc = [dict(name="size", alpha=0.0, R=cfg["R_size"])]
    sc += [dict(name=f"power_{a:g}", alpha=float(a), R=cfg["R_power"]) for a in cfg["alt_values"]]
    sc += [dict(name="common_shock", alpha=0.0, R=cfg["common_shock"]["R"])]
    return sc


def _e4_task(args):
    cfg, si, rep = args
    sc = e4_scenarios(cfg)[si]
    k, j, T = cfg["k"], cfg["j"], cfg["T"]
    A = np.array(cfg["A0"], float)
    A[k, j] = sc["alpha"]
    rng = rng_for("E4", si, rep)
    out = dict(si=si, rep=rep)
    if sc["name"] != "common_shock":
        spec = HawkesSpec(cfg["M"], np.array(cfg["mu"], float), A, beta=cfg["beta"])
        ev = simulate(spec, T, rng)
        st, p, fa, fn = lrt_alpha_zero(ev, T, k, j, tol=cfg["tol"], max_iter=cfg["max_iter"], return_fits=True)
        out.update(n_events=[int(e.size) for e in ev], stat=float(st), p=float(p), alpha_hat=float(fa.spec.alpha[k, j]))
        return out
    cs = cfg["common_shock"]
    n_sh = rng.poisson(cs["rate"] * T)
    tau = np.sort(T * rng.random(n_sh))
    S = np.exp(cs["size_logsd"] * rng.standard_normal(n_sh))
    shocks = [(float(a), float(b)) for a, b in zip(tau, S)]
    spec = HawkesSpec(cfg["M"], np.array(cfg["mu"], float), A, beta=cfg["beta"], shocks=shocks,
                      shock_beta=np.array(cs["shock_beta"], float), shock_rate=np.array(cs["shock_rate"], float))
    ev = simulate(spec, T, rng)
    st0, p0, fa0, _ = lrt_alpha_zero(ev, T, k, j, tol=cfg["tol"], max_iter=cfg["max_iter"], return_fits=True)
    st1, p1, fa1, _ = lrt_alpha_zero(ev, T, k, j, shocks=shocks, shock_rate_structure="vector", tol=cfg["tol"],
                                     max_iter=cfg["max_iter"], return_fits=True)
    out.update(n_events=[int(e.size) for e in ev], n_shocks=int(n_sh),
               stat=float(st0), p=float(p0), alpha_hat=float(fa0.spec.alpha[k, j]),
               stat_shocks=float(st1), p_shocks=float(p1), alpha_hat_shocks=float(fa1.spec.alpha[k, j]),
               shock_beta_hat=list(fa1.spec.shock_beta), eta_hat=list(fa1.spec.shock_rate_vec))
    return out


def _lrt_summary(stat, p):
    stat = np.asarray(stat, float)
    p = np.asarray(p, float)
    d = {f"reject_{lv:g}": rate(p < lv) for lv in (0.10, 0.05, 0.01)}
    d["reject_naive_chi2_1_0.05"] = rate(stats.chi2.sf(stat, 1) < 0.05)
    d["P_stat_zero"] = rate(stat <= 1e-8)
    d["stat"] = mstat(stat)
    return d


def run_E4(cfg, runner, ctx):
    scs = e4_scenarios(cfg)
    tasks = [(cfg, si, rep) for si in range(len(scs)) for rep in range(scs[si]["R"])]
    # common-shock tasks are the most expensive: schedule them first
    order = sorted(range(len(tasks)), key=lambda i: 0 if scs[tasks[i][1]]["name"] == "common_shock" else 1)
    out_o = runner.map(_timed(_e4_task), [tasks[i] for i in order], "E4")
    res_t = [None] * len(tasks)
    for pos, i in enumerate(order):
        res_t[i] = out_o[pos]
    res, cpu = _split_timing(res_t)
    summary = []
    for si, sc in enumerate(scs):
        reps = [r for r in res if r.get("ok") and r["si"] == si]
        row = dict(name=sc["name"], alpha_true=sc["alpha"], R=len(reps), n_failed=sc["R"] - len(reps),
                   n_events=mstat([sum(r["n_events"]) for r in reps]),
                   without_shocks=_lrt_summary([r["stat"] for r in reps], [r["p"] for r in reps]),
                   alpha_hat=mstat([r["alpha_hat"] for r in reps]))
        if sc["name"] == "common_shock":
            row["with_shocks"] = _lrt_summary([r["stat_shocks"] for r in reps], [r["p_shocks"] for r in reps])
            row["alpha_hat_with_shocks"] = mstat([r["alpha_hat_shocks"] for r in reps])
            row["n_shocks"] = mstat([r["n_shocks"] for r in reps])
            row["shock_beta_hat"] = [mstat([r["shock_beta_hat"][m] for r in reps]) for m in range(cfg["M"])]
            row["eta_hat"] = [mstat([r["eta_hat"][m] for r in reps]) for m in range(cfg["M"])]
        summary.append(row)
    return dict(summary=dict(scenarios=summary, null_distribution="0.5 chi2_0 + 0.5 chi2_1 (Self & Liang 1987); 5% critical value 2.706",
                             sup_lr_bootstrap="not run: lrt_alpha_zero_sup with n_boot = 99 needs ~600 EM fits per dataset, "
                                              "beyond the compute budget; the common-beta LRT is the one studied"),
                reps=res, cpu=cpu, R={sc["name"]: sc["R"] for sc in scs},
                seeds=dict(scheme="SeedSequence([BASE_SEED, 4, scenario_index, rep])"))


# ---------------------------------------------------------------------------
# E6  Alerting and nowcasting
# ---------------------------------------------------------------------------
def e6_spec(cfg, shocks):
    return HawkesSpec(cfg["M"], np.array(cfg["mu"], float), np.array(cfg["A"], float), beta=cfg["beta"], shocks=shocks,
                      shock_beta=np.array(cfg["shock_beta"], float), shock_rate=cfg["shock_rate"])


def e6_calendar(cfg, T, rng):
    n = rng.poisson(cfg["shock_cal_rate"] * T)
    tau = np.sort(T * rng.random(n))
    S = np.exp(cfg["shock_logsd"] * rng.standard_normal(n))
    return [(float(a), float(b)) for a, b in zip(tau, S)]


def e6_threshold(cfg):
    """Surge threshold c: smallest integer with P(N_target(t, t+Delta] >= c) <= 1 - q in a long pilot."""
    rng = rng_for("E6", 999, 0)
    T = cfg["pilot_T"]
    cal = e6_calendar(cfg, T, rng)
    ev = simulate(e6_spec(cfg, cal), T, rng)
    D = cfg["Delta"]
    edges = np.arange(cfg["pilot_burn"], T - D + 1e-9, D)
    cnt = np.histogram(ev[cfg["target"]], bins=np.append(edges, edges[-1] + D))[0]
    c = 1
    while np.mean(cnt >= c) > 1 - cfg["surge_quantile"]:
        c += 1
    return dict(c=int(c), base_rate=float(np.mean(cnt >= c)), n_windows=int(cnt.size), mean_count=float(cnt.mean()),
                var_count=float(cnt.var(ddof=1)))


def _delay_cdf(d, dl):
    d = np.asarray(d, float)
    return np.where(d >= 0, dl["p0"] + (1 - dl["p0"]) * (-np.expm1(-np.maximum(d, 0) / dl["mean"])), 0.0)


def _ht_state(spec, avail, t, dl):
    """Horvitz-Thompson nowcast of the excitation state E(t) (prop:nowcast(b),
    delta = 0): available events of delayed streams weighted by 1/F(t - s)."""
    M = spec.M
    Bm = spec.beta_matrix
    E = np.zeros((M, M))
    for j in range(M):
        s = np.asarray(avail[j], float)
        s = s[s <= t]
        if s.size == 0:
            continue
        w = 1.0 / _delay_cdf(t - s, dl) if j in dl["streams"] else np.ones(s.size)
        for k in range(M):
            if spec.alpha[k, j] > 0:
                E[k, j] = spec.alpha[k, j] * Bm[k, j] * np.sum(w * np.exp(-Bm[k, j] * (t - s)))
    return E


def _cdf_from_samples(x, K):
    pmf = np.bincount(np.minimum(x, K), minlength=K + 1).astype(float) / x.size
    return np.cumsum(pmf), pmf


def _scores(cdf, pmf, y, c, V, floor):
    K = cdf.size - 1
    F_ym1 = cdf[y - 1] if 1 <= y <= K + 1 else (0.0 if y < 1 else 1.0)
    F_y = cdf[y] if y <= K else 1.0
    pit = F_ym1 + V * (F_y - F_ym1)
    z = np.arange(K + 1)
    crps = float(np.sum((cdf - (y <= z)) ** 2) + max(0, y - K - 1))
    py = pmf[y] if y <= K else 0.0
    logs = -math.log(max(py, floor))
    prob = 1.0 - (cdf[c - 1] if c >= 1 else 0.0)
    mean = float(z @ pmf)
    return prob, pit, crps, logs, mean


def e6_new_shock_flags(cfg, cal):
    """For each forecast window (t, t + Delta]: does a salient event arrive inside it?
    The forecasts condition on an empty future calendar (sec:fc-predictive), so
    they are the exact conditional law only on windows without a new event."""
    D = cfg["Delta"]
    tau = np.array([s[0] for s in cal], float)
    out = []
    for w in range(cfg["n_windows"]):
        t = cfg["T_train"] + D * w
        out.append(bool(np.any((tau > t) & (tau <= t + D))))
    return out


def e6_regenerate_calendar(cfg, rep):
    """The calendar of replicate ``rep`` is the first draw from its generator in
    :func:`_e6_task`, so it can be regenerated exactly from the seed."""
    rng = rng_for("E6", 0, rep)
    T = cfg["T_train"] + cfg["Delta"] * cfg["n_windows"]
    return e6_calendar(cfg, T, rng)


def e6_calibration_split(cfg, reps, flags):
    """PIT histograms and mean forecast bias split by whether a new salient event
    arrives inside the forecast window."""
    out = {}
    nb = cfg["pit_bins"]
    F = np.concatenate([np.asarray(f, bool) for f in flags])
    Y = np.concatenate([np.asarray(r["Y"], float) for r in reps])
    out["n_windows_new_shock"] = int(F.sum())
    out["n_windows_no_new_shock"] = int((~F).sum())
    out["mean_count_new_shock"] = float(Y[F].mean()) if F.any() else NAN
    out["mean_count_no_new_shock"] = float(Y[~F].mean()) if (~F).any() else NAN
    for m in E6_METHODS:
        pit = np.concatenate([np.asarray(r["pit"][m] if "pit" in r else r["methods"][m]["pit"], float) for r in reps])
        row = {}
        for lab, sel in (("no_new_shock", ~F), ("new_shock", F)):
            h = np.histogram(pit[sel], bins=nb, range=(0, 1))[0]
            e = sel.sum() / nb
            chi2 = float(np.sum((h - e) ** 2 / e)) if e > 0 else NAN
            row[lab] = dict(n=int(sel.sum()), pit_hist=h.tolist(), pit_chi2=chi2,
                            pit_chi2_pvalue=float(stats.chi2.sf(chi2, nb - 1)) if e > 0 else NAN,
                            pit_top_decile_share=float(np.mean(pit[sel] >= 0.9)) if sel.any() else NAN)
        out[m] = row
    return out


E6_METHODS = ["oracle", "fitted", "fitted_naive_delay", "fitted_ht_delay", "ma_poisson", "ma_poisson_delay", "climatology"]


def _e6_task(args):
    cfg, rep, c = args
    rng = rng_for("E6", 0, rep)
    D = cfg["Delta"]
    Ttr = cfg["T_train"]
    Ttot = Ttr + D * cfg["n_windows"]
    tgt = cfg["target"]
    dl = cfg["delay"]
    cal = e6_calendar(cfg, Ttot, rng)
    spec = e6_spec(cfg, cal)
    ev = simulate(spec, Ttot, rng)
    # reporting delays (delayed streams only): 0 w.p. p0, else Exp(mean)
    delays = []
    for k, e in enumerate(ev):
        if k in dl["streams"]:
            d = np.where(rng.random(e.size) < dl["p0"], 0.0, rng.exponential(dl["mean"], e.size))
        else:
            d = np.zeros(e.size)
        delays.append(d)
    ev_tr = [e[e <= Ttr] for e in ev]
    cal_tr = [s for s in cal if s[0] < Ttr]
    fit = fit_em(ev_tr, Ttr, cfg["M"], shocks=cal_tr, tol=cfg["tol"], max_iter=cfg["max_iter"])
    fspec = fit.spec.copy(shocks=cal)  # predictive uses only shocks with tau <= t
    # climatology from the training period (complete data)
    edges = np.arange(cfg["pilot_burn"], Ttr - D + 1e-9, D)
    clim = np.histogram(ev_tr[tgt], bins=np.append(edges, edges[-1] + D))[0]
    n_sim = cfg["n_sim"]
    rows = {m: dict(prob=[], pit=[], crps=[], logs=[], mean=[]) for m in E6_METHODS}
    Y, state = [], dict(full=[], naive=[], ht=[])
    for w in range(cfg["n_windows"]):
        t = Ttr + D * w
        y = int(np.sum((ev[tgt] > t) & (ev[tgt] <= t + D)))
        Y.append(y)
        avail = [e[(e <= t) & (e + d <= t)] for e, d in zip(ev, delays)]
        samples = {
            "oracle": predictive_count_dist(spec, ev, t, D, n_sim=n_sim, rng=rng)[:, tgt],
            "fitted": predictive_count_dist(fspec, ev, t, D, n_sim=n_sim, rng=rng)[:, tgt],
            "fitted_naive_delay": predictive_count_dist(fspec, avail, t, D, n_sim=n_sim, rng=rng)[:, tgt],
            "fitted_ht_delay": _future_counts(fspec, _ht_state(fspec, avail, t, dl), t, D, n_sim, rng)[:, tgt],
        }
        # state diagnostics with the true parameters: excitation carried by the delayed stream(s)
        cols = dl["streams"]
        state["full"].append(float(excitation_state(spec, ev, t)[:, cols].sum()))
        state["naive"].append(float(excitation_state(spec, avail, t)[:, cols].sum()))
        state["ht"].append(float(_ht_state(spec, avail, t, dl)[:, cols].sum()))
        past = [np.sum((ev[tgt] > t - D * (l + 1)) & (ev[tgt] <= t - D * l)) for l in range(cfg["ma_windows"])]
        past_av = [np.sum((avail[tgt] > t - D * (l + 1)) & (avail[tgt] <= t - D * l)) for l in range(cfg["ma_windows"])]
        lam_ma = max(float(np.mean(past)), 0.1)
        lam_ma_d = max(float(np.mean(past_av)), 0.1)
        K = int(max(400, y + 1, *(int(s.max()) + 1 for s in samples.values())))
        z = np.arange(K + 1)
        V = rng.random(len(E6_METHODS))
        for mi, m in enumerate(E6_METHODS):
            if m in samples:
                cdf, pmf = _cdf_from_samples(samples[m], K)
                floor = 0.5 / n_sim
            elif m == "climatology":
                cdf, pmf = _cdf_from_samples(clim, K)
                floor = 0.5 / clim.size
            else:
                lam = lam_ma if m == "ma_poisson" else lam_ma_d
                pmf = stats.poisson.pmf(z, lam)
                cdf = np.minimum(np.cumsum(pmf), 1.0)
                floor = 1e-300
            pr, pit, crps, logs, mean = _scores(cdf, pmf, y, c, V[mi], floor)
            for key, val in zip(("prob", "pit", "crps", "logs", "mean"), (pr, pit, crps, logs, mean)):
                rows[m][key].append(val)
    fit_par = dict(mu=list(np.asarray(fit.spec.mu, float)), alpha=fit.spec.alpha.tolist(),
                   beta=float(np.asarray(fit.spec.beta).ravel()[0]), shock_beta=list(fit.spec.shock_beta),
                   eta=float(fit.spec.shock_rate_vec[0]))
    new_shock = e6_new_shock_flags(cfg, cal)
    return dict(rep=rep, Y=Y, methods=rows, state=state, fit=fit_par, n_events=[int(e.size) for e in ev], n_shocks=len(cal),
                new_shock=new_shock)


def run_E6(cfg, runner, ctx):
    thr = e6_threshold(cfg)
    c = thr["c"]
    tasks = [(cfg, rep, c) for rep in range(cfg["R"])]
    res, cpu = _split_timing(runner.map(_timed(_e6_task), tasks, "E6"))
    reps = [r for r in res if r.get("ok")]
    Yall = np.concatenate([np.asarray(r["Y"]) for r in reps])
    S = (Yall >= c)
    methods = {}
    for m in E6_METHODS:
        prob = [np.asarray(r["methods"][m]["prob"]) for r in reps]
        ys = [np.asarray(r["Y"]) >= c for r in reps]
        P = np.concatenate(prob)
        pit = np.concatenate([np.asarray(r["methods"][m]["pit"]) for r in reps])
        hist = np.histogram(pit, bins=cfg["pit_bins"], range=(0, 1))[0]
        chi2 = float(np.sum((hist - pit.size / cfg["pit_bins"]) ** 2 / (pit.size / cfg["pit_bins"])))
        brier_rep = [float(np.mean((p_ - y_) ** 2)) for p_, y_ in zip(prob, ys)]
        crps_rep = [float(np.mean(r["methods"][m]["crps"])) for r in reps]
        logs_rep = [float(np.mean(r["methods"][m]["logs"])) for r in reps]
        bias_rep = [float(np.mean(np.asarray(r["methods"][m]["mean"]) - np.asarray(r["Y"]))) for r in reps]
        alerts = {}
        for ratio in cfg["cost_ratios"]:
            pstar = 1.0 / (1.0 + ratio)  # c_FA = 1, c_miss = ratio
            cost_rep = []
            TP = FP = FN = TN = 0
            for p_, y_ in zip(prob, ys):
                a = p_ >= pstar
                cost_rep.append(float(np.mean(a & ~y_) * 1.0 + np.mean(~a & y_) * ratio))
                TP += int(np.sum(a & y_))
                FP += int(np.sum(a & ~y_))
                FN += int(np.sum(~a & y_))
                TN += int(np.sum(~a & ~y_))
            alerts[f"{ratio:g}"] = dict(
                pi_star=pstar, cost_per_window=mstat(cost_rep), alert_rate=(TP + FP) / max(TP + FP + FN + TN, 1),
                precision=TP / (TP + FP) if TP + FP else NAN, recall=TP / (TP + FN) if TP + FN else NAN,
                false_alarm_rate=FP / (FP + TN) if FP + TN else NAN, TP=TP, FP=FP, FN=FN, TN=TN)
        # calibration of the surge probability: reliability in 5 bins
        bins = np.array([0, 0.05, 0.1, 0.2, 0.4, 1.0001])
        rel = []
        for lo_, hi_ in zip(bins[:-1], bins[1:]):
            sel = (P >= lo_) & (P < hi_)
            rel.append(dict(lo=float(lo_), hi=float(min(hi_, 1.0)), n=int(sel.sum()),
                            mean_prob=float(P[sel].mean()) if sel.any() else NAN,
                            freq=float(S[sel].mean()) if sel.any() else NAN))
        methods[m] = dict(brier=mstat(brier_rep), crps=mstat(crps_rep), log_score=mstat(logs_rep),
                          mean_bias=mstat(bias_rep), pit_hist=hist.tolist(), pit_chi2=chi2,
                          pit_chi2_pvalue=float(stats.chi2.sf(chi2, cfg["pit_bins"] - 1)),
                          mean_prob=float(P.mean()), alerts=alerts, reliability=rel)
    st = {k: np.concatenate([np.asarray(r["state"][k]) for r in reps]) for k in ("full", "naive", "ht")}
    dl = cfg["delay"]
    theory_ratio = dl["p0"] + (1 - dl["p0"]) / (1 + cfg["beta"] * dl["mean"])
    state = dict(mean_full=float(st["full"].mean()), mean_naive=float(st["naive"].mean()), mean_ht=float(st["ht"].mean()),
                 ratio_naive=float(st["naive"].mean() / st["full"].mean()), ratio_ht=float(st["ht"].mean() / st["full"].mean()),
                 ratio_naive_rep=mstat([np.mean(r["state"]["naive"]) / np.mean(r["state"]["full"]) for r in reps]),
                 ratio_ht_rep=mstat([np.mean(r["state"]["ht"]) / np.mean(r["state"]["full"]) for r in reps]),
                 theory_ratio_naive=theory_ratio,
                 naive_le_full_pathwise=bool(np.all(st["naive"] <= st["full"] + 1e-9)),
                 rmse_naive=float(np.sqrt(np.mean((st["naive"] - st["full"]) ** 2))),
                 rmse_ht=float(np.sqrt(np.mean((st["ht"] - st["full"]) ** 2))))
    fits = dict(alpha=mstat([np.asarray(r["fit"]["alpha"])[0, 0] for r in reps]))
    summary = dict(threshold=thr, n_windows_total=int(Yall.size), surge_rate_test=float(S.mean()),
                   surge_rate_test_mcse=float(math.sqrt(S.mean() * (1 - S.mean()) / S.size)),
                   methods=methods, state=state, fitted_alpha00=fits["alpha"],
                   note="c_FA = 1, c_miss = ratio, pi* = 1/(1+ratio). fitted = plug-in EM fit on [0, T_train]. "
                        "Delays only on the target (offline) stream; outcomes are settled counts. "
                        "fitted_ht_delay plugs the HT state into the cluster continuation (no state-uncertainty integration). "
                        "state ratios use the true parameters; theory_ratio_naive = E exp(-beta D) holds under stationarity without shocks.")
    summary["calibration_by_new_shock"] = e6_calibration_split(cfg, reps, [r["new_shock"] for r in reps])
    raw = [dict(rep=r["rep"], Y=r["Y"], prob={m: r["methods"][m]["prob"] for m in E6_METHODS},
                pit={m: r["methods"][m]["pit"] for m in E6_METHODS}, fit=r["fit"], n_events=r["n_events"],
                n_shocks=r["n_shocks"], new_shock=r["new_shock"]) if r.get("ok") else r for r in res]
    return dict(summary=summary, reps=raw, cpu=cpu, R=cfg["R"],
                seeds=dict(scheme="rep: SeedSequence([BASE_SEED, 6, 0, rep]); threshold pilot: SeedSequence([BASE_SEED, 6, 999, 0])"))


RUNNERS = {"E1": run_E1, "E2": run_E2, "E3": run_E3, "E4": run_E4, "E5": run_E5, "E6": run_E6}


def run_experiment(name, cfg, runner=None, ctx=None):
    """Run one experiment and return its result dict (no file I/O)."""
    own = runner is None
    runner = runner or Runner(1, log=lambda *a: None)
    ctx = {} if ctx is None else ctx
    t0 = time.time()
    out = RUNNERS[name](cfg, runner, ctx)
    out["wall_seconds"] = time.time() - t0
    out["config"] = cfg
    out["name"] = name
    if name == "E1":
        ctx["E1_summary"] = out["summary"]
    if own:
        runner.close()
    return out


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------
def versions():
    v = dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__, hawkes=hawkes.__version__,
             platform=platform.platform())
    try:
        v["matplotlib"] = metadata.version("matplotlib")
    except metadata.PackageNotFoundError:  # pragma: no cover
        v["matplotlib"] = None
    return v


def code_hashes():
    files = [os.path.join(HERE, "run_experiments.py")]
    hdir = os.path.join(HERE, "hawkes")
    files += sorted(os.path.join(hdir, f) for f in os.listdir(hdir) if f.endswith(".py"))
    out = {}
    for f in files:
        with open(f, "rb") as fh:
            out[os.path.relpath(f, HERE)] = hashlib.sha256(fh.read()).hexdigest()[:16]
    return out


def save_raw(results_dir, out, quick, workers):
    os.makedirs(os.path.join(results_dir, "raw"), exist_ok=True)
    doc = dict(name=out["name"], quick=quick, workers=workers, R=out["R"], seeds=dict(base_seed=BASE_SEED, **out["seeds"]),
               runtime=dict(wall_seconds=out["wall_seconds"], task_cpu_seconds=out["cpu"]),
               finished=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               versions=versions(), code_sha256_16=code_hashes(), config=out["config"], summary=out["summary"],
               reps=out["reps"])
    with open(os.path.join(results_dir, "raw", f"{out['name']}.json"), "w") as f:
        json.dump(jsonify(doc), f)


def postprocess_e6(results_dir):
    """Add the calibration split by new-event arrival to an existing raw/E6.json.
    The calendars are regenerated from the replicate seeds (no re-simulation of
    incidents and no refits); the result is identical to what the current
    ``run_E6`` computes. Provenance is recorded under ``postprocess``."""
    p = os.path.join(results_dir, "raw", "E6.json")
    with open(p) as f:
        doc = json.load(f)
    cfg = doc["config"]
    reps = [r for r in doc["reps"] if "Y" in r]
    flags = []
    for r in reps:
        cal = e6_regenerate_calendar(cfg, r["rep"])
        if len(cal) != r["n_shocks"]:
            raise RuntimeError(f"calendar of replicate {r['rep']} does not match the stored run")
        flags.append(e6_new_shock_flags(cfg, cal))
        r["new_shock"] = flags[-1]
    doc["summary"]["calibration_by_new_shock"] = e6_calibration_split(cfg, reps, flags)
    doc["postprocess"] = dict(what="summary.calibration_by_new_shock and reps[].new_shock added by "
                                   "run_experiments.py --postprocess-e6 (calendars regenerated from the seeds)",
                              when=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                              code_sha256_16=code_hashes())
    with open(p, "w") as f:
        json.dump(jsonify(doc), f)


def merge(results_dir, started=None):
    raw_dir = os.path.join(results_dir, "raw")
    exps = {}
    for name in ORDER:
        p = os.path.join(raw_dir, f"{name}.json")
        if os.path.exists(p):
            with open(p) as f:
                d = json.load(f)
            exps[name] = {k: d[k] for k in ("quick", "workers", "R", "seeds", "runtime", "finished", "versions",
                                             "code_sha256_16", "config", "summary", "postprocess") if k in d}
    meta = dict(
        description="Simulation study for 'Shock and Contagion' (Paper 2). Synthetic data only; no real incidents.",
        base_seed=BASE_SEED,
        seed_scheme="each replicate: np.random.default_rng(SeedSequence([BASE_SEED, experiment_index, config_index, rep]))",
        experiment_index=EXP_INDEX,
        total_wall_seconds=float(sum(e["runtime"]["wall_seconds"] for e in exps.values())),
        total_task_cpu_seconds=float(sum(e["runtime"]["task_cpu_seconds"] for e in exps.values())),
        merged=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        versions=versions(),
        code_sha256_16=code_hashes(),
        raw_files={n: f"raw/{n}.json" for n in exps},
    )
    meta["experiments_finished"] = {n: e.get("finished") for n, e in exps.items()}
    if started:
        meta["last_invocation_started"] = started  # experiments may come from several invocations (see run_log.txt)
    doc = dict(meta=meta, experiments=exps)
    with open(os.path.join(results_dir, "sim_results.json"), "w") as f:
        json.dump(jsonify(doc), f, indent=1)
    return doc


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default=",".join(ORDER), help="comma-separated experiments (default: all)")
    ap.add_argument("--quick", action="store_true", help="tiny configuration (smoke test)")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--merge-only", action="store_true")
    ap.add_argument("--postprocess-e6", action="store_true", help="add the new-event calibration split to raw/E6.json")
    a = ap.parse_args(argv)
    results_dir = os.path.abspath(a.results)
    os.makedirs(results_dir, exist_ok=True)
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if a.postprocess_e6:
        postprocess_e6(results_dir)
        merge(results_dir)
        return
    if a.merge_only:
        merge(results_dir)
        return
    cfgs = quick_config() if a.quick else DEFAULT
    log_path = os.path.join(results_dir, "run_log.txt")

    def log(msg):
        line = f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {msg}"
        print(line, flush=True)
        with open(log_path, "a") as fh:
            fh.write(line + "\n")

    names = [n for n in ORDER if n in a.only.split(",")]
    log(f"start {started} quick={a.quick} workers={a.workers} experiments={names}")
    runner = Runner(a.workers, log=log)
    ctx = {"results": results_dir}
    try:
        for name in names:
            log(f"{name}: running")
            out = run_experiment(name, cfgs[name], runner, ctx)
            save_raw(results_dir, out, a.quick, a.workers)
            log(f"{name}: done, wall {out['wall_seconds']:.0f}s, task cpu {out['cpu']:.0f}s")
    finally:
        runner.close()
    merge(results_dir, started)
    log("merged sim_results.json")


if __name__ == "__main__":
    main()
