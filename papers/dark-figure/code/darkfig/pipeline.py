"""One-world analysis pipeline for the simulation study (Sec. sec:simulation).

For a synthetic world this module builds capture tables under several linkage
pipelines and applies the SIM-EST estimators to each:

  oracle          true linkage (records grouped by their true incident id)
                  -> the true capture histories.
  naive           single best linkage (greedy constrained clustering of the
                  3-class Fellegi-Sunter posteriors at threshold 0.5).
  corrected       ``linkage_corrected`` applied to the naive table with the
                  clerical-review estimates (delta_hat, eps_hat) (Cor cor:linkcorrect).
  corrected_tv    as ``corrected`` but propagating the review uncertainty:
                  D draws (delta, eps) ~ N(hat, se^2) truncated to [0, 0.9],
                  combined by Rubin's rules on log N (total-variance analogue of
                  Prop prop:totalvar).
  corrected_true  ``linkage_corrected`` with the realised (ground-truth) LE
                  rates of the naive linkage (computed on the de-duplicated
                  representatives, the population the review samples from);
                  isolates LE-model misspecification from review error.
  corrected_d     detachment-only correction: review delta_hat with eps = 0.
                  POST-HOC sensitivity variant, added after observing that the
                  full (delta, eps) correction over-corrects under noisy records
                  (false matches under the one-record-per-list constraint are
                  mostly 'swaps' that leave the capture table nearly unchanged).
  corrected_lefit diagnostic: (delta*, eps*) minimising the Pearson distance
                  between E[T(delta, eps) t_true] and the naive table (uses the
                  ORACLE table, so it is not a feasible estimator); the best the
                  scalar LE family can do.
  mi              multiple imputation over approximate posterior linkage
                  structures (Bernoulli(pi) link draws respecting the
                  one-record-per-list constraint). Frequentist estimators are
                  combined by Rubin's rules on log N (within-draw variance from
                  the interval width on the log scale); LCMCR by mixing, i.e.
                  pooling the posterior draws of N over imputations.

Estimators (darkfig.estimators): lincoln_petersen on (police, NGO) [lp],
loglinear_closed_form with omega = 0 [cf], loglinear_bma (BIC, pairwise)
[bma], chao_lower_bound [chao] and lcmcr [lcmcr].
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import math
import time
import numpy as np
from scipy import stats

from .world import World, world_truth, true_capture_table, histories_to_table, K_LISTS
from .linkage import (LinkageConfig, run_linkage, linkage_error, clerical_review,
                      sample_linkage, table_from_labels)

EST_NAMES = ("lp", "cf", "bma", "chao", "lcmcr")
PIPELINES = ("oracle", "naive", "corrected", "corrected_tv", "corrected_true", "corrected_d",
             "corrected_lefit", "mi")


@dataclass
class PipelineConfig:
    linkage: LinkageConfig = field(default_factory=LinkageConfig)
    estimators: tuple = EST_NAMES
    pipelines: tuple = PIPELINES
    run_lcmcr: bool = True               # per-world switch (the runner uses it to subsample)
    lcmcr_kw: dict = field(default_factory=lambda: dict(J=10, n_iter=6000, burn=2000, thin=4))
    mi_draws: int = 20
    mi_draws_lcmcr: int = 4
    tv_draws: int = 20
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


def _summ(est, keep_samples=False):
    d = dict(N_hat=float(est.N_hat), lo=float(est.lo), hi=float(est.hi), n_obs=float(est.n_obs), ok=True)
    ex = est.extra or {}
    for k in ("ess", "best_weight", "corrected", "converged", "bias_corrected", "n_dropped"):
        if k in ex and isinstance(ex[k], (int, float, bool, np.floating, np.integer)):
            d[k] = float(ex[k]) if not isinstance(ex[k], bool) else bool(ex[k])
    if keep_samples and "samples" in ex:
        d["_samples"] = ex["samples"]
    return d


def _fail(e):
    return dict(N_hat=float("nan"), lo=float("nan"), hi=float("nan"), n_obs=float("nan"), ok=False,
                error=f"{type(e).__name__}: {e}"[:200])


def estimate(name, table, rng=None, cfg: PipelineConfig = None, correct=None, keep_samples=False):
    """Apply estimator ``name`` to ``table``; ``correct=(delta, eps)`` wraps it in linkage_corrected."""
    from . import estimators as E
    fn, kw = _est_funcs()[name]
    kw = dict(kw)
    if name == "lcmcr":
        kw.update(cfg.lcmcr_kw if cfg is not None else {})
        kw["seed"] = int(rng.integers(2 ** 31 - 1)) if rng is not None else 0
        if keep_samples:
            kw["return_samples"] = True
    try:
        if correct is None:
            est = fn(table, **kw)
        else:
            d, e = correct
            est = E.linkage_corrected(table, float(d), float(e), estimator=fn, **kw)
        return _summ(est, keep_samples)
    except Exception as exc:  # recorded, never silently dropped
        return _fail(exc)


def rubin_log(results, level=0.95):
    """Rubin's rules on theta = log N_hat with U = ((log hi - log lo) / (2 z))^2."""
    z = stats.norm.ppf(0.5 + level / 2)
    th, U, nobs = [], [], []
    for r in results:
        if not r.get("ok") or not all(np.isfinite([r["N_hat"], r["lo"], r["hi"]])) or r["lo"] <= 0:
            continue
        th.append(math.log(r["N_hat"]))
        U.append(((math.log(r["hi"]) - math.log(r["lo"])) / (2 * z)) ** 2)
        nobs.append(r["n_obs"])
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
    return dict(N_hat=float(math.exp(qbar)), lo=float(math.exp(qbar - tq * se)),
                hi=float(math.exp(qbar + tq * se)), n_obs=float(np.mean(nobs)), ok=True,
                m_valid=int(M), frac_between=float((1 + 1 / M) * B / T) if T > 0 else 0.0)


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
        from . import estimators as E
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
        lab_all = L.labels_all()
        err_all = linkage_error(lab_all, world.records.true_id, world.records.list_id)
        err = linkage_error(L.labels, L.true_id, L.list_id)      # LE rates on representatives
        rv = clerical_review(L.pairs, L.post, L.labels, L.accepted, L.true_id, cfg.review_B, rng)
        tab_naive = table_from_labels(L.labels, L.list_id)
        out["tables"]["naive"] = _tab_list(tab_naive)
        lefit = le_projection(tab_oracle, tab_naive)
        out["linkage"] = dict(error=err, error_all_records=err_all, review=rv, info=L.info, lefit=lefit)
        t2 = time.perf_counter()
        if "naive" in cfg.pipelines:
            res["naive"] = {e: estimate(e, tab_naive, rng, cfg) for e in ests}
        if "corrected" in cfg.pipelines:
            de = (min(rv["delta_hat"], 0.95), min(rv["eps_hat"], 0.95))
            res["corrected"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in ests}
        if "corrected_true" in cfg.pipelines:
            de = (min(err["delta"], 0.95), min(err["eps"], 0.95))
            res["corrected_true"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        if "corrected_d" in cfg.pipelines:
            de = (min(rv["delta_hat"], 0.95), 0.0)
            res["corrected_d"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        if "corrected_lefit" in cfg.pipelines:
            de = (lefit["delta"], lefit["eps"])
            res["corrected_lefit"] = {e: estimate(e, tab_naive, rng, cfg, correct=de) for e in cheap}
        if "corrected_tv" in cfg.pipelines:
            sd = rv["se_delta"] if np.isfinite(rv["se_delta"]) else 0.0
            se = rv["se_eps"] if np.isfinite(rv["se_eps"]) else 0.0
            draws = []
            for _ in range(cfg.tv_draws):
                d = _trunc_normal(rng, rv["delta_hat"], sd, 0.0, 0.9)
                e_ = _trunc_normal(rng, rv["eps_hat"], se, 0.0, 0.9)
                draws.append((d, e_))
            res["corrected_tv"] = {}
            for e in cheap:
                rr = [estimate(e, tab_naive, rng, cfg, correct=de) for de in draws]
                res["corrected_tv"][e] = rubin_log(rr, cfg.level)
        out["timing"]["corrections"] = time.perf_counter() - t2
        if "mi" in cfg.pipelines:
            t3 = time.perf_counter()
            mi_tabs = []
            mi_err = []
            for m in range(cfg.mi_draws):
                lab = sample_linkage(len(L.list_id), L.list_id, L.pairs, L.post, rng)
                mi_tabs.append(table_from_labels(lab, L.list_id))
                if m < 5:
                    mi_err.append(linkage_error(L.labels_all(lab), world.records.true_id, world.records.list_id))
            res["mi"] = {}
            for e in cheap:
                res["mi"][e] = rubin_log([estimate(e, t, rng, cfg) for t in mi_tabs], cfg.level)
            if "lcmcr" in ests:
                rr = [estimate("lcmcr", t, rng, cfg, keep_samples=True) for t in mi_tabs[:cfg.mi_draws_lcmcr]]
                res["mi"]["lcmcr"] = pool_samples(rr, cfg.level)
            out["linkage"]["mi_draw_error"] = {k: float(np.mean([x[k] for x in mi_err]))
                                              for k in ("precision", "recall", "delta", "eps")}
            out["linkage"]["mi_n_obs"] = [float(sum(t.values())) for t in mi_tabs]
            out["timing"]["mi"] = time.perf_counter() - t3
    # attach truth-based errors
    for p, d in res.items():
        for e, r in d.items():
            r.pop("_samples", None)
            if r.get("ok"):
                r["relbias"] = (r["N_hat"] - N) / N
                r["covers"] = bool(r["lo"] <= N <= r["hi"])
                r["width"] = (r["hi"] - r["lo"]) / N
    out["pipelines"] = res
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
