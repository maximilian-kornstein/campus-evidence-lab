"""One-world analysis pipeline for the simulation study (Sec. sec:simulation).

For a synthetic world this module builds capture tables under several linkage
pipelines and applies the estimators to each:

  oracle          true linkage (records grouped by their true incident id)
                  -> the true capture histories.
  naive           single best linkage (greedy constrained clustering of the
                  3-class Fellegi-Sunter posteriors at threshold 0.5).
  corrected       ``linkage_corrected`` applied to the naive table with the
                  clerical-audit estimates (delta_hat, eps_hat) (Cor cor:linkcorrect).
                  Run 2: the interval adds the linkage variance v_link of
                  Cor cor:linkcorrect(i) (delta method through the LE Jacobian;
                  LCMCR: imputation of t ~ N(t_hat, J^-1 Sigma J^-T), 4 chains pooled).
                  The inner-only (run-1) interval is kept as lo_cap / hi_cap.
  corrected_tv    as ``corrected`` plus the audit variance v_aud of Cor
                  cor:linkcorrect(iii) for (delta_hat, eps_hat) (delta method; the sum
                  v_link + v_aud is conservative because the audit sampled the same
                  linkage, Rem. rem:link-sameaudit). Run 1 used 20 draws and Rubin's
                  rules on log N instead.
  corrected_true  ``linkage_corrected`` with the realised (ground-truth) LE
                  rates of the naive linkage (computed on the de-duplicated
                  representatives at the capture level); isolates LE-model
                  misspecification from audit error.
  corrected_d     detachment-only correction: audit delta_hat with eps = 0.
                  POST-HOC sensitivity variant, added in run 1 after observing that the
                  full (delta, eps) correction over-corrects under noisy records
                  (false matches under the one-record-per-list constraint are
                  mostly 'swaps' that leave the capture table nearly unchanged).
  corrected_lefit diagnostic: (delta*, eps*) minimising the Pearson distance
                  between E[T(delta, eps) t_true] and the naive table (uses the
                  ORACLE table, so it is not a feasible estimator); the best the
                  scalar LE family can do.
  mi              multiple imputation over approximate posterior linkage
                  structures: M draws of a single-record Gibbs sampler over
                  constrained partitions targeting the plug-in FS pairwise posterior
                  (darkfig.linkage.gibbs_linkage; run 1 used independent
                  Bernoulli(pi) proposals resolved greedily, which are not posterior
                  draws). Frequentist estimators are combined by Rubin's rules on
                  log(N_hat - c), c = min_m n_obs^(m) (rubin_log); LCMCR by pooling
                  one chain per imputation (Prop. prop:totalvar).

Estimators (darkfig.estimators): lincoln_petersen on (police, NGO) [lp],
loglinear_closed_form with omega = 0 [cf], loglinear_bma (BIC, pairwise)
[bma], chao_lower_bound [chao] and lcmcr [lcmcr].

``analyse_le_table`` is the table-level analysis of scenario S8, in which the
observed table is generated exactly by the LE model (no record linkage).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import math
import time
import numpy as np
from scipy import stats

from .world import World, world_truth, true_capture_table, histories_to_table, K_LISTS
from .linkage import (LinkageConfig, run_linkage, linkage_error, clerical_review, audit_frame_truth,
                      gibbs_linkage, table_from_labels)

EST_NAMES = ("lp", "cf", "bma", "chao", "lcmcr")
PIPELINES = ("oracle", "naive", "corrected", "corrected_tv", "corrected_true", "corrected_d",
             "corrected_lefit", "mi")
LE_PIPELINES = ("oracle", "naive", "corrected_known", "corrected_review", "corrected_review_tv")


@dataclass
class PipelineConfig:
    linkage: LinkageConfig = field(default_factory=LinkageConfig)
    estimators: tuple = EST_NAMES
    pipelines: tuple = PIPELINES
    run_lcmcr: bool = True               # per-world switch (the runner uses it to subsample)
    # LCMCR protocol (run 2): 4 chains x 7500 iterations (2500 burn-in, thin 5) = the 30000
    # iterations recommended by SIM-EST, split over 4 overdispersed chains -> 4000 pooled draws,
    # split-Rhat and bulk/tail ESS for every oracle / naive fit.
    lcmcr_kw: dict = field(default_factory=lambda: dict(J=10, n_iter=7500, burn=2500, thin=5))
    lcmcr_chains: int = 4
    mi_draws: int = 20
    mi_burn: int = 5                     # Gibbs sweeps before the first kept draw (start: point linkage)
    mi_thin: int = 1                     # sweeps between kept draws (lag-1 ACF of #links ~ 0, reported)
    mi_tau: float = 1e-3                 # FS posterior below which candidate edges are truncated
    mi_draws_lcmcr: int = 4              # imputations that get one LCMCR chain each (pooled)
    mi_error_draws: int = 5              # draws scored against the truth (linkage_error)
    link_var: bool = True                # add v_link (Cor cor:linkcorrect(i)) to corrected intervals
    corrected_lcmcr_imp: int = 4         # LCMCR on corrected tables: imputations of t_hat
    review_B: int = 300
    omega_grid: tuple | None = None      # S6: closed-form n0(omega) on the oracle table
    referral_drop: bool = False          # S7: also analyse tables without referral-only NGO records
    level: float = 0.95

    def as_dict(self):
        d = asdict(self)
        d["linkage"] = asdict(self.linkage)
        return d


# ---------------------------------------------------------------------------
# estimator dispatch
# ---------------------------------------------------------------------------
def _est_funcs():
    from . import estimators as E
    return {
        "lp": (E.lincoln_petersen, dict(lists=(0, 1))),
        "cf": (E.loglinear_closed_form, dict(omega=0.0)),
        "bma": (E.loglinear_bma, dict(max_order=2, criterion="bic")),
        "chao": (E.chao_lower_bound, dict()),
        "lcmcr": (E.lcmcr, dict()),
    }


_KEEP_EXTRA = ("ess", "best_weight", "corrected", "converged", "bias_corrected", "n_dropped", "rhat", "ess_bulk",
               "ess_tail", "n_chains", "post_sd", "v_link", "v_aud", "se_log_n0_link", "lo_cap", "hi_cap",
               "lo_tv", "hi_tv", "interval_offset", "n_zero_cells", "median_sd_between", "n12")


def _summ(est, keep_samples=False):
    d = dict(N_hat=float(est.N_hat), lo=float(est.lo), hi=float(est.hi), n_obs=float(est.n_obs), ok=True)
    ex = est.extra or {}
    for k in _KEEP_EXTRA:
        if k in ex and isinstance(ex[k], (int, float, bool, np.floating, np.integer)):
            d[k] = float(ex[k]) if not isinstance(ex[k], (bool, np.bool_)) else bool(ex[k])
    if "chain_medians" in ex:
        d["chain_medians"] = [float(x) for x in ex["chain_medians"]]
    # offset of the log-normal interval (n_obs, or n12 for LP) and the log-scale sd of n0
    a = float(ex.get("interval_offset", ex.get("n12", est.n_obs) if str(est.method).startswith("lincoln") else est.n_obs))
    d["offset"] = a
    if keep_samples and "samples" in ex:
        d["_samples"] = ex["samples"]
    return d


def _fail(e):
    return dict(N_hat=float("nan"), lo=float("nan"), hi=float("nan"), n_obs=float("nan"), ok=False,
                error=f"{type(e).__name__}: {e}"[:200])


def estimate(name, table, rng=None, cfg: PipelineConfig = None, correct=None, keep_samples=False,
             rate_se=None, n_chains=None):
    """Apply estimator ``name`` to ``table``; ``correct=(delta, eps)`` wraps it in linkage_corrected."""
    from . import estimators as E
    fn, kw = _est_funcs()[name]
    kw = dict(kw)
    cfg = cfg if cfg is not None else PipelineConfig()
    seed = int(rng.integers(2 ** 31 - 1)) if rng is not None else 0
    if name == "lcmcr":
        kw.update(cfg.lcmcr_kw)
    try:
        if correct is None:
            if name == "lcmcr":
                kw["seed"] = seed
                kw["n_chains"] = cfg.lcmcr_chains if n_chains is None else n_chains
                if keep_samples:
                    kw["return_samples"] = True
            est = fn(table, **kw)
        else:
            d, e = correct
            if name == "lcmcr":
                lv = "impute" if cfg.link_var else "none"
                if lv == "none":
                    kw.update(seed=seed, n_chains=cfg.lcmcr_chains)
                est = E.linkage_corrected(table, float(d), float(e), estimator=fn, link_var=lv,
                                          n_imp=cfg.corrected_lcmcr_imp, seed=seed, **kw)
            else:
                est = E.linkage_corrected(table, float(d), float(e), estimator=fn,
                                          link_var="delta" if cfg.link_var else "none", rate_se=rate_se, **kw)
        return _summ(est, keep_samples)
    except Exception as exc:  # recorded, never silently dropped
        return _fail(exc)


def _tv_from(r):
    """corrected_tv record from a corrected record that carries lo_tv / hi_tv."""
    if not r.get("ok") or not np.isfinite(r.get("lo_tv", float("nan"))):
        return dict(r, ok=False, error="no audit variance") if r.get("ok") else dict(r)
    out = {k: v for k, v in r.items() if k not in ("lo_tv", "hi_tv")}
    out.update(lo=r["lo_tv"], hi=r["hi_tv"])
    return out


def rubin_log(results, level=0.95):
    """Rubin's rules on theta_m = log(N_hat_m - c), c = min_m n_obs_m (run 2).

    The inner intervals are log-normal on the dark figure N - a_m (a_m = n_obs_m, or
    n12 for LP), so the within-imputation variance is taken on that scale,
    U_m^(0) = ((log(hi - a) - log(lo - a)) / (2 z))^2, and transported to the common
    scale log(N - c) by the delta method, U_m = U_m^(0) ((N_hat_m - a_m)/(N_hat_m - c))^2.
    A common offset c is needed because n_obs differs between imputations; its
    between-imputation variation then enters B. Interval: c + exp(qbar +- t_nu sqrt(T)),
    so the lower limit is never below min_m n_obs_m. (Run 1 combined log N_hat with
    U from log(hi/lo), which mixed scales and gave lower limits below n_obs.)
    """
    z = stats.norm.ppf(0.5 + level / 2)
    rs = [r for r in results if r.get("ok") and all(np.isfinite([r["N_hat"], r["lo"], r["hi"], r["n_obs"]]))]
    M = len(rs)
    if M == 0:
        return dict(N_hat=float("nan"), lo=float("nan"), hi=float("nan"), n_obs=float("nan"), ok=False,
                    error="no valid draws", m_valid=0)
    c = min(min(r["n_obs"], r.get("offset", r["n_obs"])) for r in rs)
    th, U = [], []
    for r in rs:
        a = r.get("offset", r["n_obs"])
        f0 = r["N_hat"] - a
        fc = r["N_hat"] - c
        if fc <= 0:
            continue
        if f0 > 0 and r["lo"] > a and r["hi"] > r["lo"]:
            u0 = ((math.log(r["hi"] - a) - math.log(r["lo"] - a)) / (2 * z)) ** 2
            u = u0 * (f0 / fc) ** 2
        else:
            u = 0.0
        th.append(math.log(fc))
        U.append(u)
    M = len(th)
    if M == 0:
        return dict(N_hat=float("nan"), lo=float("nan"), hi=float("nan"), n_obs=float("nan"), ok=False,
                    error="no valid draws", m_valid=0)
    th, U = np.array(th), np.array(U)
    qbar, W = th.mean(), U.mean()
    B = th.var(ddof=1) if M > 1 else 0.0
    T = W + (1 + 1 / M) * B
    if B > 0 and M > 1:
        nu = (M - 1) * (1 + W / ((1 + 1 / M) * B)) ** 2
        tq = stats.t.ppf(0.5 + level / 2, nu)
    else:
        nu, tq = float("inf"), z
    se = math.sqrt(T)
    return dict(N_hat=float(c + math.exp(qbar)), lo=float(c + math.exp(qbar - tq * se)),
                hi=float(c + math.exp(qbar + tq * se)), n_obs=float(np.mean([r["n_obs"] for r in rs])), ok=True,
                m_valid=int(M), frac_between=float((1 + 1 / M) * B / T) if T > 0 else 0.0, offset=float(c),
                se_log=float(se), df=float(nu))


def pool_samples(results, level=0.95):
    """Mix posterior draws of N across imputations (LCMCR)."""
    S = [np.asarray(r["_samples"]) for r in results if r.get("ok") and "_samples" in r]
    if not S:
        return dict(N_hat=float("nan"), lo=float("nan"), hi=float("nan"), n_obs=float("nan"), ok=False,
                    error="no valid draws", m_valid=0)
    allS = np.concatenate(S)
    a = 1 - level
    lo, med, hi = np.quantile(allS, [a / 2, 0.5, 1 - a / 2])
    nobs = np.mean([r["n_obs"] for r in results if r.get("ok") and "_samples" in r])
    return dict(N_hat=float(med), lo=float(lo), hi=float(hi), n_obs=float(nobs), ok=True, m_valid=len(S))


# ---------------------------------------------------------------------------
# main entry
# ---------------------------------------------------------------------------
def oracle_table_from_records(records, keep=None):
    """Capture table of the true linkage (optionally restricted to a record subset)."""
    tid, lid = records.true_id, records.list_id
    if keep is not None:
        tid, lid = tid[keep], lid[keep]
    return table_from_labels(tid, lid, K_LISTS)


def analyse_world(world: World, cfg: PipelineConfig, seed) -> dict:
    """Run all pipelines and estimators on one world; returns a JSON-able dict."""
    from . import estimators as E
    t0 = time.perf_counter()
    rng = np.random.default_rng(np.random.SeedSequence(seed))
    ests = [e for e in cfg.estimators if e != "lcmcr" or cfg.run_lcmcr]
    cheap = [e for e in ests if e != "lcmcr"]
    out = dict(truth=world_truth(world), tables={}, pipelines={}, timing={})
    N = world.N

    # ---------------- oracle
    tab_oracle = oracle_table_from_records(world.records)
    assert tab_oracle == true_capture_table(world), "oracle table must equal the true capture histories"
    out["tables"]["oracle"] = _tab_list(tab_oracle)
    res = {}
    if "oracle" in cfg.pipelines:
        for e in ests:
            res.setdefault("oracle", {})[e] = estimate(e, tab_oracle, rng, cfg)
    if cfg.omega_grid is not None:
        e0 = E.loglinear_closed_form(tab_oracle, omega=0.0)
        out["omega_curve"] = dict(
            n0=[float(E.loglinear_closed_form(tab_oracle, omega=w).n0_hat) for w in cfg.omega_grid],
            n0_at_0=float(e0.n0_hat), se_log_n0=float(e0.extra.get("se_log_n0", float("nan"))),
            n_obs=float(e0.n_obs), zero_cell_corrected=bool(e0.extra.get("corrected", False)))
    if cfg.referral_drop:
        keep = world.records.provenance == 0
        tab_drop = oracle_table_from_records(world.records, keep)
        out["tables"]["oracle_dropref"] = _tab_list(tab_drop)
        res["oracle_dropref"] = {e: estimate(e, tab_drop, rng, cfg) for e in cheap}
    out["timing"]["oracle"] = time.perf_counter() - t0

    need_link = any(p in cfg.pipelines for p in ("naive", "corrected", "corrected_tv", "corrected_true", "mi"))
    if need_link:
        t1 = time.perf_counter()
        L = run_linkage(world.records, world.adjacency, cfg.linkage)
        out["timing"]["linkage"] = time.perf_counter() - t1
        tid_all, lid_all = world.records.true_id, world.records.list_id
        err_all = linkage_error(L.labels_all(), tid_all, lid_all)
        err = linkage_error(L.labels, L.true_id, L.list_id)      # capture-level LE rates on representatives
        frame = audit_frame_truth(L.pairs, L.labels, L.accepted, L.true_id)   # the audit's estimand
        rv = clerical_review(L.pairs, L.post, L.labels, L.accepted, L.true_id, cfg.review_B, rng)
        tab_naive = table_from_labels(L.labels, L.list_id)
        out["tables"]["naive"] = _tab_list(tab_naive)
        lefit = le_projection(tab_oracle, tab_naive)
        out["linkage"] = dict(error=err, error_all_records=err_all, frame=frame, review=rv, info=L.info, lefit=lefit)
        t2 = time.perf_counter()
        if "naive" in cfg.pipelines:
            res["naive"] = {e: estimate(e, tab_naive, rng, cfg) for e in ests}
        if "corrected" in cfg.pipelines or "corrected_tv" in cfg.pipelines:
            de = (min(rv["delta_hat"], 0.95), min(rv["eps_hat"], 0.95))
            rse = (rv["se_delta"], rv["se_eps"]) if "corrected_tv" in cfg.pipelines else None
            res["corrected"] = {e: estimate(e, tab_naive, rng, cfg, correct=de, rate_se=rse if e != "lcmcr" else None)
                                for e in ests}
            if "corrected_tv" in cfg.pipelines:
                res["corrected_tv"] = {e: _tv_from(res["corrected"][e]) for e in cheap}
            if "corrected" not in cfg.pipelines:
                del res["corrected"]
        if "corrected_true" in cfg.pipelines:
            de = (min(err["delta"], 0.95), min(err["eps"], 0.95))
            res["corrected_true"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        if "corrected_d" in cfg.pipelines:
            de = (min(rv["delta_hat"], 0.95), 0.0)
            res["corrected_d"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        if "corrected_lefit" in cfg.pipelines:
            de = (lefit["delta"], lefit["eps"])
            res["corrected_lefit"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        out["timing"]["corrections"] = time.perf_counter() - t2
        if "mi" in cfg.pipelines:
            t3 = time.perf_counter()
            draws, tr = gibbs_linkage(len(L.list_id), L.list_id, L.pairs, L.post, rng, n_draws=cfg.mi_draws,
                                      burn=cfg.mi_burn, thin=cfg.mi_thin, init_labels=L.labels, tau=cfg.mi_tau,
                                      return_trace=True)
            out["timing"]["mi_gibbs"] = time.perf_counter() - t3
            mi_tabs = [table_from_labels(lab, L.list_id) for lab in draws]
            mi_err = [linkage_error(L.labels_all(lab), tid_all, lid_all) for lab in draws[:cfg.mi_error_draws]]
            mi_frame = [audit_frame_truth(L.pairs, lab, np.zeros(len(L.pairs), bool), L.true_id)
                        for lab in draws[:cfg.mi_error_draws]]
            res["mi"] = {}
            for e in cheap:
                res["mi"][e] = rubin_log([estimate(e, t, rng, cfg) for t in mi_tabs], cfg.level)
            if "lcmcr" in ests:
                try:
                    pe = E.lcmcr_pooled(mi_tabs[:cfg.mi_draws_lcmcr], seed=int(rng.integers(2 ** 31 - 1)),
                                        level=cfg.level, **cfg.lcmcr_kw)
                    res["mi"]["lcmcr"] = _summ(pe)
                    res["mi"]["lcmcr"]["m_valid"] = len(mi_tabs[:cfg.mi_draws_lcmcr])
                except Exception as exc:
                    res["mi"]["lcmcr"] = _fail(exc)
            keys = ("precision", "recall", "delta", "eps", "n_false_merges", "n_clusters", "n_split_captures")
            out["linkage"]["mi_draw_error"] = {k: float(np.mean([x[k] for x in mi_err])) for k in keys}
            out["linkage"]["mi_draw_frame"] = {k: float(np.mean([x[k] for x in mi_frame]))
                                               for k in ("TP", "FN", "recall_frame", "delta_frame")}
            out["linkage"]["mi_n_obs"] = [float(sum(t.values())) for t in mi_tabs]
            nl = np.asarray(tr["n_links"][cfg.mi_burn:], float)
            out["linkage"]["mi_gibbs"] = dict(
                n_active=tr["n_active"], n_edges=tr["n_edges"], sweeps=len(tr["n_links"]),
                moves_per_sweep=float(np.mean(tr["n_moves"])), links_point=int(len(L.list_id) - len(np.unique(L.labels))),
                links_mean=float(nl.mean()), links_sd=float(nl.std(ddof=1)) if len(nl) > 1 else 0.0,
                links_lag1_acf=float(np.corrcoef(nl[:-1], nl[1:])[0, 1]) if len(nl) > 3 and nl.std() > 0 else float("nan"))
            out["timing"]["mi"] = time.perf_counter() - t3
    _attach_truth(res, N)
    out["pipelines"] = res
    out["timing"]["total"] = time.perf_counter() - t0
    return out


def _attach_truth(res, N):
    for p, d in res.items():
        for e, r in d.items():
            r.pop("_samples", None)
            if r.get("ok"):
                r["relbias"] = (r["N_hat"] - N) / N
                r["covers"] = bool(r["lo"] <= N <= r["hi"])
                r["width"] = (r["hi"] - r["lo"]) / N
                if np.isfinite(r.get("lo_cap", float("nan"))):
                    r["covers_cap"] = bool(r["lo_cap"] <= N <= r["hi_cap"])


# ---------------------------------------------------------------------------
# S8: observed table generated exactly by the LE model (no record linkage)
# ---------------------------------------------------------------------------
@dataclass
class LEConfig:
    N: int = 2000
    p: tuple = (0.2725, 0.305, 0.2275, 0.2075)   # independent capture; = the S1 marginals
    delta: float = 0.1
    eps: float = 0.0
    audit_records: int = 200                     # record-level audit sample (delta)
    audit_edges: int = 100                       # linked-edge audit sample (eps)
    estimators: tuple = ("lp", "cf", "bma", "chao")
    level: float = 0.95

    def as_dict(self):
        return asdict(self)


def analyse_le_table(cfg: LEConfig, seed) -> dict:
    """Scenario S8: t_true from independent capture, observed = simulate_observed(t_true, delta, eps).

    Pipelines: oracle (t_true), naive (observed table), corrected_known (true model
    rates), corrected_review (rates from a random audit simulated from the LE
    ground truth: darkfig.linkerror.simulate_audit), corrected_review_tv (+ audit
    variance). Corrected intervals include v_link; the inner-only interval is kept
    as lo_cap / hi_cap (its coverage is reported as coverage_cap).
    """
    from . import estimators as E
    from .linkerror import simulate_records, simulate_audit
    t0 = time.perf_counter()
    rng = np.random.default_rng(np.random.SeedSequence(seed))
    K = len(cfg.p)
    Y = rng.random((cfg.N, K)) < np.asarray(cfg.p)
    t_true = histories_to_table(Y)
    sim = simulate_records(t_true, cfg.delta, cfg.eps, rng)
    tab_obs = sim["table_out"](t_true)
    err = linkage_error(sim["labels"], sim["true_id"], sim["list_id"])
    audit = simulate_audit(sim, cfg.audit_records, cfg.audit_edges, rng)
    n_obs_true = int(sum(t_true.values()))
    out = dict(truth=dict(N=cfg.N, n_obs=n_obs_true, n0=cfg.N - n_obs_true, n_records=int(len(sim["labels"]))),
               tables=dict(oracle=_tab_list(t_true), naive=_tab_list(tab_obs)), timing={})
    fns = _est_funcs()
    res = {p: {} for p in LE_PIPELINES}
    for e in cfg.estimators:
        fn, kw = fns[e]
        for p, tab in (("oracle", t_true), ("naive", tab_obs)):
            try:
                res[p][e] = _summ(fn(tab, **kw))
            except Exception as exc:
                res[p][e] = _fail(exc)
        try:
            res["corrected_known"][e] = _summ(E.linkage_corrected(tab_obs, cfg.delta, cfg.eps, estimator=fn,
                                                                  link_var="delta", **kw))
        except Exception as exc:
            res["corrected_known"][e] = _fail(exc)
        try:
            de = (min(audit["delta_hat"], 0.95), min(audit["eps_hat"], 0.95))
            r = _summ(E.linkage_corrected(tab_obs, de[0], de[1], estimator=fn, link_var="delta",
                                          rate_se=(audit["se_delta"], audit["se_eps"]), **kw))
            res["corrected_review"][e] = r
            res["corrected_review_tv"][e] = _tv_from(r)
        except Exception as exc:
            res["corrected_review"][e] = _fail(exc)
            res["corrected_review_tv"][e] = _fail(exc)
    _attach_truth(res, cfg.N)
    out["pipelines"] = res
    out["linkage"] = dict(error=err, audit=audit)
    out["timing"]["total"] = time.perf_counter() - t0
    return out


def le_projection(t_true, t_obs):
    """Diagnostic: (delta*, eps*) = argmin sum_h (E[T(delta, eps) t]_h - n~_h)^2 / max(n~_h, 1)."""
    from scipy.optimize import minimize
    from .linkerror import expected_observed
    from .loglinear import table_to_array
    yt, K = table_to_array(t_true)
    yo, _ = table_to_array(t_obs)

    def obj(x):
        d, e = x
        if not (0.0 <= d < 0.95 and 0.0 <= e < 0.95):
            return 1e12
        p = expected_observed(yt, d, e)
        return float(np.sum((p[1:] - yo[1:]) ** 2 / np.maximum(yo[1:], 1.0)))

    best = None
    for x0 in ([0.02, 0.0], [0.1, 0.05], [0.25, 0.15]):
        r = minimize(obj, x0, method="Nelder-Mead", options=dict(xatol=1e-5, fatol=1e-6, maxiter=2000))
        if best is None or r.fun < best.fun:
            best = r
    d, e = (float(min(max(v, 0.0), 0.94)) for v in best.x)
    return dict(delta=d, eps=e, chi2=float(best.fun))


def _trunc_normal(rng, mu, sd, lo, hi):
    if sd <= 0:
        return float(min(max(mu, lo), hi))
    for _ in range(1000):
        x = rng.normal(mu, sd)
        if lo <= x <= hi:
            return float(x)
    return float(min(max(mu, lo), hi))


def _tab_list(tab):
    """Table as a list of counts in bitmask order (h with bit k = list k), length 2^K - 1."""
    K = len(next(iter(tab)))
    return [float(tab[tuple((c >> k) & 1 for k in range(K))]) for c in range(1, 2 ** K)]
