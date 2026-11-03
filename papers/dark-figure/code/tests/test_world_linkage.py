"""Tests for the synthetic world, the record-linkage pipeline and the one-world analysis.

Run from ``code/``:  python -m pytest tests/test_world_linkage.py -q
Pipeline-level tests use a tiny local Lincoln-Petersen stub so that they do
not depend on the SIM-EST estimator module; the cross-checks against the real
estimators are skipped if ``darkfig.estimators`` is unavailable.
"""
import os
import sys
from dataclasses import dataclass, field

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from darkfig.world import (WorldConfig, generate_world, histories_to_table, true_capture_table,
                           expected_cell_counts, population_omega, world_truth)
from darkfig.linkage import (jaro_winkler, normalize_venue, fs_em, run_linkage, linkage_error,
                             clerical_review, sample_linkage, table_from_labels, LinkageConfig,
                             cluster_constrained, N_LEVELS, jaro, _jaro_reference, gibbs_linkage,
                             audit_frame_truth, sample_linkage_bernoulli)
from darkfig import pipeline as P


# ---------------------------------------------------------------------------
# local Lincoln-Petersen stub (Chapman form, Wald interval)
# ---------------------------------------------------------------------------
@dataclass
class _Est:
    N_hat: float
    lo: float
    hi: float
    n_obs: float
    method: str = "lp_stub"
    extra: dict = field(default_factory=dict)


def lp_stub(table, lists=(0, 1)):
    a, b = lists
    n1 = sum(v for h, v in table.items() if h[a])
    n2 = sum(v for h, v in table.items() if h[b])
    m = sum(v for h, v in table.items() if h[a] and h[b])
    N = (n1 + 1) * (n2 + 1) / (m + 1) - 1
    var = (n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m) / ((m + 1) ** 2 * (m + 2))
    se = var ** 0.5
    return _Est(N, N - 1.96 * se, N + 1.96 * se, float(sum(table.values())))


# ---------------------------------------------------------------------------
# world
# ---------------------------------------------------------------------------
def test_world_determinism():
    cfg = WorldConfig(N=600, capture_model="latent_cov", noise=1.0, referral_q=0.3)
    w1 = generate_world(cfg, [7, 1])
    w2 = generate_world(cfg, [7, 1])
    w3 = generate_world(cfg, [7, 2])
    assert np.array_equal(w1.Y, w2.Y)
    for f in ("list_id", "date", "hour", "county", "true_id", "provenance", "is_dup"):
        assert np.array_equal(getattr(w1.records, f), getattr(w2.records, f))
    assert list(w1.records.venue) == list(w2.records.venue)
    assert list(w1.records.type_label) == list(w2.records.type_label)
    assert not np.array_equal(w1.Y, w3.Y)


def test_world_structure_and_noise():
    w = generate_world(WorldConfig(N=800, capture_model="latent_cov", noise=1.0, referral_q=0.5), 3)
    r = w.records
    # every captured (incident, list) has >= 1 record and records only for captured lists
    cap = set(zip(r.true_id.tolist(), r.list_id.tolist()))
    assert cap == {(i, k) for i, k in zip(*np.nonzero(w.Y))}
    # referral-only records: NGO list, police-captured, not directly NGO-captured
    ref = r.provenance == 1
    assert np.all(r.list_id[ref] == 1)
    assert np.all(w.Y[r.true_id[ref], 0]) and not np.any(w.Y_direct[r.true_id[ref], 1])
    assert r.is_dup.sum() > 0 and ref.sum() > 0
    # clean world: no duplicates, exact dates and counties
    wc = generate_world(WorldConfig(N=800, capture_model="independent", noise=0.0), 3)
    rc = wc.records
    assert rc.is_dup.sum() == 0
    assert np.all(rc.date == wc.date[rc.true_id]) and np.all(rc.county == wc.county[rc.true_id])


def test_oracle_table_equals_true_capture_histories():
    for cfg in (WorldConfig(N=700, capture_model="latent", noise=0.0),
                WorldConfig(N=700, capture_model="latent_cov", noise=1.5, referral_q=0.5)):
        w = generate_world(cfg, 11)
        tab = P.oracle_table_from_records(w.records)
        assert tab == histories_to_table(w.Y) == true_capture_table(w)
        assert sum(tab.values()) == int(w.Y.any(axis=1).sum())
        # dropping referral-only records reproduces the 'direct NGO' table
        keep = w.records.provenance == 0
        assert P.oracle_table_from_records(w.records, keep) == true_capture_table(w, use_direct_ngo=True)


def test_population_omega_zero_under_independence_and_referral():
    for q in (0.0, 0.5):
        cfg = WorldConfig(N=500, capture_model="independent", referral_q=q)
        w = generate_world(cfg, 2)
        mu = expected_cell_counts(cfg, w.itype, w.target, w.campus)
        assert abs(sum(mu.values()) - cfg.N) < 1e-6
        assert abs(population_omega(mu)) < 1e-9
    cfg = WorldConfig(N=500, capture_model="latent")
    w = generate_world(cfg, 2)
    assert abs(population_omega(expected_cell_counts(cfg, w.itype, w.target, w.campus))) > 0.01


# ---------------------------------------------------------------------------
# linkage components
# ---------------------------------------------------------------------------
def test_jaro_winkler_reference_values():
    assert jaro_winkler("MARTHA", "MARHTA") == pytest.approx(0.9611, abs=1e-4)
    assert jaro_winkler("DWAYNE", "DUANE") == pytest.approx(0.84, abs=1e-4)
    assert jaro_winkler("DIXON", "DICKSONX") == pytest.approx(0.8133, abs=1e-4)
    assert jaro_winkler("abc", "abc") == 1.0 and jaro_winkler("", "abc") == 0.0
    assert normalize_venue("CONG BETH ISRAEL, 3rd Avenue") == normalize_venue("Congregation Beth Israel 3rd Ave")


def test_fs_em_recovers_simulated_mixture():
    rng = np.random.default_rng(0)
    n, p = 40000, 0.05
    m = [np.array(x) for x in ([.8, .1, .07, .03], [.7, .1, .05, .15], [.9, .07, .03], [.6, .3, .1], [.8, .1, .05, .02, .03])]
    u = [np.array(x) for x in ([.05, .15, .35, .45], [.1, .15, .6, .15], [.4, .4, .2], [.2, .3, .5], [.01, .01, .03, .9, .05])]
    z = rng.random(n) < p
    g = np.stack([np.where(z, rng.choice(len(m[f]), n, p=m[f]), rng.choice(len(u[f]), n, p=u[f]))
                  for f in range(5)], axis=1)
    mod = fs_em(g, N_LEVELS, n_classes=2)
    assert abs(mod.p - p) < 0.01
    assert np.max(np.abs(mod.m[0] - m[0])) < 0.05
    post = mod.posterior(g)
    assert ((post > 0.5) == z).mean() > 0.97


def test_jaro_fast_equals_reference():
    rng = np.random.default_rng(3)
    alphabet = list("abcd efgh")
    for _ in range(20000):
        a = "".join(rng.choice(alphabet, rng.integers(0, 20)))
        b = "".join(rng.choice(alphabet, rng.integers(0, 20)))
        assert jaro(a, b) == _jaro_reference(a, b)


def test_constrained_clustering_and_mi_draws_respect_one_record_per_list():
    w = generate_world(WorldConfig(N=600, capture_model="latent_cov", noise=1.5), 4)
    L = run_linkage(w.records, w.adjacency)
    rng = np.random.default_rng(1)
    gibbs = gibbs_linkage(len(L.list_id), L.list_id, L.pairs, L.post, rng, n_draws=3, burn=2, thin=1,
                          init_labels=L.labels)
    for lab in [L.labels] + [sample_linkage(len(L.list_id), L.list_id, L.pairs, L.post, rng) for _ in range(3)] + gibbs:
        for c in np.unique(lab):
            lists = L.list_id[lab == c]
            assert len(lists) == len(set(lists.tolist()))
    # a forced conflicting chain is refused
    lab, acc = cluster_constrained(3, np.array([0, 1, 0]), np.array([[0, 1], [1, 2]]), np.array([0, 1]))
    assert lab[0] == lab[1] != lab[2] and acc.tolist() == [True, False]


def test_linkage_high_precision_recall_on_clean_data():
    for model in ("independent", "latent", "latent_cov"):
        w = generate_world(WorldConfig(N=2000, capture_model=model, noise=0.0), 21)
        L = run_linkage(w.records, w.adjacency)
        err = linkage_error(L.labels_all(), w.records.true_id, w.records.list_id)
        assert err["precision"] > 0.97 and err["recall"] > 0.97, (model, err)
        tab = table_from_labels(L.labels, L.list_id)
        assert abs(sum(tab.values()) - w.Y.any(axis=1).sum()) <= 0.02 * w.N


def test_linkage_error_metrics_on_known_partitions():
    tid = np.array([0, 0, 0, 1, 1, 2])
    lid = np.array([0, 1, 2, 0, 1, 2])
    e = linkage_error(tid, tid, lid)                  # perfect linkage
    assert e["precision"] == e["recall"] == 1.0 and e["delta"] == 0.0 and e["eps"] == 0.0
    e = linkage_error(np.arange(6), tid, lid)         # everything split
    assert e["recall"] == 0.0 and e["delta"] == 1.0
    lab = np.array([0, 0, 0, 1, 1, 1])                # incident 2 falsely merged into incident 1
    e = linkage_error(lab, tid, lid)
    assert e["recall"] == 1.0 and e["n_false_merges"] == 1 and e["precision"] < 1.0


def test_review_estimates_near_empirical_rates():
    diffs_d, diffs_e = [], []
    for s in range(4):
        w = generate_world(WorldConfig(N=2000, capture_model="latent_cov", noise=0.75), [5, s])
        L = run_linkage(w.records, w.adjacency)
        err = linkage_error(L.labels, L.true_id, L.list_id)
        rv = clerical_review(L.pairs, L.post, L.labels, L.accepted, L.true_id, 400, np.random.default_rng(s))
        assert rv["n_reviewed"] == 400
        diffs_d.append(rv["delta_hat"] - err["delta"])
        diffs_e.append(rv["eps_hat"] - err["eps"])
    assert np.mean(np.abs(diffs_d)) < 0.04, diffs_d
    assert np.mean(np.abs(diffs_e)) < 0.04, diffs_e
    # a census review (B = all candidate pairs) recovers the edge-based rates exactly
    rv = clerical_review(L.pairs, L.post, L.labels, L.accepted, L.true_id, len(L.pairs), np.random.default_rng(0))
    same = L.labels[L.pairs[:, 0]] == L.labels[L.pairs[:, 1]]
    truth = L.true_id[L.pairs[:, 0]] == L.true_id[L.pairs[:, 1]]
    assert rv["TP_hat"] == pytest.approx((same & truth).sum())
    assert rv["FN_hat"] == pytest.approx((~same & truth).sum())


def test_gibbs_linkage_targets_the_documented_distribution():
    """Exact check on a toy problem: 3 records from 3 lists, all pairs candidates.

    Target: p(partition) propto prod_{within-cluster pairs} pi/(1-pi), clusters connected
    via retained edges (all pairs retained here). Enumerate the 5 partitions of 3 records.
    """
    pairs = np.array([[0, 1], [0, 2], [1, 2]])
    post = np.array([0.8, 0.3, 0.6])
    odds = post / (1 - post)
    parts = {"123": odds.prod(), "12|3": odds[0], "13|2": odds[1], "23|1": odds[2], "1|2|3": 1.0}
    Z = sum(parts.values())
    exact = {k: v / Z for k, v in parts.items()}
    draws = gibbs_linkage(3, np.array([0, 1, 2]), pairs, post, np.random.default_rng(0), n_draws=40000, burn=10,
                          thin=1)
    def key(lab):
        a, b, c = lab
        if a == b == c:
            return "123"
        if a == b:
            return "12|3"
        if a == c:
            return "13|2"
        if b == c:
            return "23|1"
        return "1|2|3"
    freq = {k: 0 for k in exact}
    for d in draws:
        freq[key(d)] += 1
    for k in exact:
        assert freq[k] / len(draws) == pytest.approx(exact[k], abs=0.015), (k, freq[k] / len(draws), exact[k])
    # the one-record-per-list constraint: two records of list 0 never share a cluster
    draws = gibbs_linkage(3, np.array([0, 0, 1]), pairs, np.array([0.9, 0.9, 0.9]), np.random.default_rng(1),
                          n_draws=200, burn=5, thin=1)
    assert all(d[0] != d[1] for d in draws)


def test_gibbs_draws_have_fewer_false_merges_than_bernoulli_imputation():
    w = generate_world(WorldConfig(N=1500, capture_model="latent_cov", noise=1.0), 6)
    L = run_linkage(w.records, w.adjacency)
    rng = np.random.default_rng(2)
    tid, lid = w.records.true_id, w.records.list_id
    fm = lambda lab: linkage_error(L.labels_all(lab), tid, lid)["n_false_merges"]
    g = [fm(d) for d in gibbs_linkage(len(L.list_id), L.list_id, L.pairs, L.post, rng, n_draws=3, burn=3, thin=1,
                                      init_labels=L.labels)]
    b = [fm(sample_linkage_bernoulli(len(L.list_id), L.list_id, L.pairs, L.post, rng)) for _ in range(3)]
    assert np.mean(g) < np.mean(b)


def test_audit_frame_truth_and_blocking_recall():
    w = generate_world(WorldConfig(N=1500, capture_model="latent_cov", noise=1.0), 7)
    L = run_linkage(w.records, w.adjacency)
    fr = audit_frame_truth(L.pairs, L.labels, L.accepted, L.true_id)
    rv = clerical_review(L.pairs, L.post, L.labels, L.accepted, L.true_id, len(L.pairs), np.random.default_rng(0))
    # a census audit recovers the frame estimand exactly
    assert rv["TP_hat"] == pytest.approx(fr["TP"]) and rv["FN_hat"] == pytest.approx(fr["FN"])
    assert rv["FE_hat"] == pytest.approx(fr["FE"])
    assert rv["delta_hat"] == pytest.approx(fr["delta_frame"]) and rv["eps_hat"] == pytest.approx(fr["eps_frame"])
    assert 0.5 < L.info["blocking_recall"] <= 1.0 and 0.5 < L.info["blocking_recall_reps"] <= 1.0
    assert L.info["n_true_cross_candidates"] <= L.info["n_true_cross_pairs"]


# ---------------------------------------------------------------------------
# pipeline (with the local stub)
# ---------------------------------------------------------------------------
def test_rubin_and_pooling():
    # identical draws whose interval is log-normal on N - n_obs are returned unchanged
    z = 1.959963984540054
    lo, hi = 60 + 40 * np.exp(-z * 0.1), 60 + 40 * np.exp(z * 0.1)
    rs = [dict(N_hat=100.0, lo=lo, hi=hi, n_obs=60.0, ok=True) for _ in range(5)]
    r = P.rubin_log(rs)
    assert r["N_hat"] == pytest.approx(100.0) and r["lo"] == pytest.approx(lo) and r["hi"] == pytest.approx(hi)
    rs2 = rs + [dict(N_hat=float("nan"), lo=0, hi=0, n_obs=0, ok=False)]
    assert P.rubin_log(rs2)["m_valid"] == 5
    pooled = P.pool_samples([dict(ok=True, n_obs=1, _samples=list(range(100))),
                             dict(ok=True, n_obs=1, _samples=list(range(100, 200)))])
    assert pooled["N_hat"] == pytest.approx(99.5)


def test_rubin_scale_lower_limit_never_below_observed():
    """Rubin's rules on log(N_hat - c): with skewed dark-figure uncertainty the run-1 rule (log N_hat with
    U from log(hi/lo)) put the lower limit below n_obs; the run-2 rule cannot."""
    rng = np.random.default_rng(4)
    z = 1.959963984540054
    rs = []
    for _ in range(20):
        nobs = 1000.0 + rng.normal(0, 5)
        n0 = 150.0 * np.exp(rng.normal(0, 0.3))
        s = 0.9
        rs.append(dict(N_hat=nobs + n0, lo=nobs + n0 * np.exp(-z * s), hi=nobs + n0 * np.exp(z * s), n_obs=nobs, ok=True))
    r = P.rubin_log(rs)
    assert r["lo"] >= min(x["n_obs"] for x in rs) - 1e-9
    assert r["offset"] == pytest.approx(min(x["n_obs"] for x in rs))
    # the run-1 rule on log N_hat for comparison: its lower limit falls below n_obs here
    th = np.log([x["N_hat"] for x in rs])
    U = ((np.log([x["hi"] for x in rs]) - np.log([x["lo"] for x in rs])) / (2 * z)) ** 2
    T = U.mean() + (1 + 1 / 20) * th.var(ddof=1)
    assert np.exp(th.mean() - z * np.sqrt(T)) < min(x["n_obs"] for x in rs)
    # the within-imputation variance is on the log dark-figure scale: widths agree with the inner one
    assert np.log((r["hi"] - r["offset"]) / (r["N_hat"] - r["offset"])) == pytest.approx(z * 0.9, rel=0.25)


def test_seeds_keyed_to_scenario_ids_not_list_positions():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import run_experiments as RX
    full = RX.scenario_grid(quick=True)
    only = [s for s in full if s["id"] == "S7"]
    t_full = [t for t in RX.task_list(full) if t[0] == "S7"]
    t_only = RX.task_list(only)
    assert t_full == t_only
    assert [RX.seeds_for(*t) for t in t_full] == [RX.seeds_for(*t) for t in t_only]
    assert RX.seeds_for("S7", 0, 1)[0] == [RX.BASE_SEED, RX.SEED_ID["S7"], 1, 1]
    # same task, run inside the filtered and the full grid -> identical results
    a = RX.run_task(t_only[0] + (only,))
    b = RX.run_task(t_full[0] + (full,))
    for k in ("pipelines", "tables", "truth"):
        assert a[k] == b[k]


def test_pipeline_smoke_with_lp_stub(monkeypatch):
    monkeypatch.setattr(P, "_est_funcs", lambda: {"lp": (lp_stub, dict(lists=(0, 1)))})
    # replace linkage_corrected by a pass-through for this smoke test
    import types
    stub_E = types.SimpleNamespace(
        linkage_corrected=lambda t, d, e, estimator, link_var=None, rate_se=None, n_imp=None, seed=None, **kw:
        estimator(t, **kw))
    monkeypatch.setitem(sys.modules, "darkfig.estimators", stub_E)
    import darkfig
    monkeypatch.setattr(darkfig, "estimators", stub_E, raising=False)
    w = generate_world(WorldConfig(N=800, capture_model="independent", noise=0.5), 9)
    cfg = P.PipelineConfig(estimators=("lp",), mi_draws=4, review_B=100,
                           pipelines=("oracle", "naive", "corrected", "corrected_d", "mi"))
    out1 = P.analyse_world(w, cfg, [1, 2])
    out2 = P.analyse_world(w, cfg, [1, 2])
    for p in cfg.pipelines:
        assert out1["pipelines"][p]["lp"]["ok"], (p, out1["pipelines"][p])
        assert out1["pipelines"][p]["lp"]["N_hat"] == out2["pipelines"][p]["lp"]["N_hat"]
    # oracle LP under independence: within 25% of the truth for N = 800
    assert abs(out1["pipelines"]["oracle"]["lp"]["relbias"]) < 0.25
    assert out1["truth"]["N"] == 800


# ---------------------------------------------------------------------------
# cross-checks against the SIM-EST estimators (skipped if unavailable)
# ---------------------------------------------------------------------------
def test_closed_form_omega_convention_matches_world():
    E = pytest.importorskip("darkfig.estimators")
    cfg = WorldConfig(N=1500, capture_model="latent_cov", referral_q=0.3)
    w = generate_world(cfg, 8)
    mu = expected_cell_counts(cfg, w.itype, w.target, w.campus)
    om = population_omega(mu)
    tab = {h: v for h, v in mu.items() if any(h)}
    assert E.loglinear_closed_form(tab, omega=om).n0_hat == pytest.approx(mu[(0, 0, 0, 0)], rel=1e-8)


def test_le_projection_recovers_simulated_rates():
    pytest.importorskip("darkfig.estimators")
    from darkfig.linkerror import expected_observed
    w = generate_world(WorldConfig(N=3000, capture_model="latent"), 1)
    t = true_capture_table(w)
    obs = expected_observed(t, 0.08, 0.03)
    fit = P.le_projection(t, obs)
    assert fit["delta"] == pytest.approx(0.08, abs=2e-3) and fit["eps"] == pytest.approx(0.03, abs=2e-3)
