"""Smoke tests for the simulation study (run_experiments.py, make_figures.py).

Each experiment is run at a tiny configuration (``quick_config``: R = 2, short
horizons) with one worker. The tests check the output schema, that no replicate
failed, that a second run gives identical results (determinism), that the JSON
written to disk is strict JSON, and that the figure script runs on the output.
A few helper formulas are checked against independent computations.

Run from code/:  OPENBLAS_NUM_THREADS=1 nice python -m pytest tests/test_experiments.py -q
"""

from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
CODE = os.path.dirname(HERE)
if CODE not in sys.path:
    sys.path.insert(0, CODE)

import run_experiments as rx  # noqa: E402
import make_figures as mf  # noqa: E402
from hawkes import apparent_branching, inverse_apparent_branching  # noqa: E402

NAMES = ["E1", "E5", "E3", "E4", "E2", "E6"]


def _run_all():
    cfgs = rx.quick_config()
    ctx = {}
    out = {}
    for name in NAMES:
        out[name] = rx.run_experiment(name, cfgs[name], None, ctx)
    return out


def _strip_timing(x):
    """Drop wall-clock fields (the only legitimately non-deterministic outputs)."""
    if isinstance(x, dict):
        return {k: _strip_timing(v) for k, v in x.items()
                if k not in ("wall_seconds", "cpu", "seconds", "fit_seconds", "fit_sec", "sec")}
    if isinstance(x, list):
        return [_strip_timing(v) for v in x]
    return x


@pytest.fixture(scope="module")
def quick_results():
    return _run_all()


def test_schema_and_no_failures(quick_results):
    for name in NAMES:
        out = quick_results[name]
        for key in ("summary", "reps", "cpu", "R", "seeds", "wall_seconds", "config", "name"):
            assert key in out, (name, key)
        assert "scheme" in out["seeds"]
        failed = [r for r in out["reps"] if isinstance(r, dict) and r.get("ok") is False]
        assert not failed, (name, failed[:1])
    s1 = quick_results["E1"]["summary"]["by_T"][0]
    assert s1["R"] == 2 and s1["n_failed"] == 0
    for v in list(s1["params"].values()) + list(s1["derived"].values()):
        for key in ("truth", "mean", "bias", "rmse", "coverage", "coverage_mcse"):
            assert key in v
    assert set(s1["aggregates"]) == {"mu", "alpha", "shock_beta", "Mult"}
    assert any(k.startswith("sigma[0]@H") for k in s1["derived"])
    s5 = quick_results["E5"]["summary"]
    assert s5["n_mc"] == rx.quick_config()["E5"]["n_mc"]
    assert len(s5["mc_validation"]) == len(rx.quick_config()["E1"]["attribution"]["H_list"])
    s2 = quick_results["E2"]["summary"]["configs"]
    assert all("const" in c["fits"] and "n_star" in c["theory"] for c in s2)
    assert any("shocks" in c["fits"] for c in s2)
    s3 = quick_results["E3"]["summary"]
    for row in s3["homogeneous"][0]["by_p"]:
        for key in ("naive_vs_n", "naive_vs_napp", "corrected_known_p", "corrected_est_p"):
            assert "coverage" in row[key]
    assert "n_naive_theory" in s3["heterogeneous"][0]["theory"]
    s4 = quick_results["E4"]["summary"]["scenarios"]
    assert [r["name"] for r in s4][0] == "size" and s4[-1]["name"] == "common_shock"
    assert "with_shocks" in s4[-1] and "reject_0.05" in s4[0]["without_shocks"]
    s6 = quick_results["E6"]["summary"]
    assert set(s6["methods"]) == set(rx.E6_METHODS)
    for m in s6["methods"].values():
        assert set(m["alerts"]) == {f"{r:g}" for r in rx.quick_config()["E6"]["cost_ratios"]}
        assert sum(m["pit_hist"]) == rx.quick_config()["E6"]["R"] * rx.quick_config()["E6"]["n_windows"]
    assert s6["state"]["naive_le_full_pathwise"]


def test_values_are_sane(quick_results):
    s1 = quick_results["E1"]["summary"]["by_T"][0]
    assert all(np.isfinite(v["mean"]) for v in s1["params"].values())
    # truth of the multiplier is (I - A)^{-1}
    A = np.array(rx.quick_config()["E1"]["A"])
    Mm = np.linalg.inv(np.eye(3) - A)
    assert abs(s1["derived"]["Mult[0,2]"]["truth"] - Mm[0, 2]) < 1e-12
    # Monte Carlo labels agree with the exact decomposition (loose: tiny n_mc)
    for v in quick_results["E5"]["summary"]["mc_validation"]:
        z = np.array([r["z"] for r in v["rows"]], float)
        assert np.all(np.abs(z[np.isfinite(z)]) < 6)
    for c in quick_results["E2"]["summary"]["configs"]:
        assert abs(c["theory"]["n_star"] - (1 - (1 + c["kappa"]) ** -0.5)) < 1e-12
    for r in quick_results["E4"]["summary"]["scenarios"]:
        assert 0 <= r["without_shocks"]["reject_0.05"]["rate"] <= 1


def test_determinism(quick_results):
    again = _run_all()
    for name in NAMES:
        a = rx.jsonify(_strip_timing({k: quick_results[name][k] for k in ("summary", "reps")}))
        b = rx.jsonify(_strip_timing({k: again[name][k] for k in ("summary", "reps")}))
        assert a == b, name


def test_files_strict_json_and_figures(quick_results, tmp_path):
    res_dir = tmp_path / "results"
    for name in NAMES:
        rx.save_raw(str(res_dir), quick_results[name], quick=True, workers=1)
    doc = rx.merge(str(res_dir))
    assert set(doc["experiments"]) == set(NAMES)

    def no_constants(tok):
        raise ValueError(f"non-standard JSON constant {tok}")

    with open(res_dir / "sim_results.json") as f:
        loaded = json.loads(f.read(), parse_constant=no_constants)
    meta = loaded["meta"]
    for key in ("base_seed", "seed_scheme", "versions", "code_sha256_16", "total_wall_seconds"):
        assert key in meta
    for e in loaded["experiments"].values():
        for key in ("R", "seeds", "runtime", "versions", "config", "summary"):
            assert key in e
    for name in NAMES:
        with open(res_dir / "raw" / f"{name}.json") as f:
            json.loads(f.read(), parse_constant=no_constants)
    fig_dir, tab_dir = tmp_path / "figures", tmp_path / "tables"
    mf.main(["--results", str(res_dir), "--figures", str(fig_dir), "--tables", str(tab_dir)])
    for fn in ("fig-sim-recovery.pdf", "fig-sim-spurious.pdf", "fig-sim-thinning.pdf", "fig-sim-lrt.pdf",
               "fig-sim-attribution.pdf", "fig-sim-alert.pdf"):
        assert (fig_dir / fn).stat().st_size > 1000, fn
    tex = (tab_dir / "tab-sim-main.tex").read_text()
    assert tex.count(r"\begin{tabular}") == 1 and r"\toprule" in tex and r"\bottomrule" in tex
    assert "nan" not in tex.lower().replace("\\addlinespace", "")


# ---------------------------------------------------------------------------
# helper formulas
# ---------------------------------------------------------------------------
def test_delta_method_exact_for_linear_map():
    rng = np.random.default_rng(0)
    B = rng.normal(size=(3, 4))
    L = rng.normal(size=(4, 4))
    cov = L @ L.T
    x = np.abs(rng.normal(size=4)) + 0.5
    val, se = rx.delta_method(lambda z: B @ z, x, cov, np.ones(4, bool))
    assert np.allclose(val, B @ x)
    assert np.allclose(se, np.sqrt(np.diag(B @ cov @ B.T)), rtol=1e-6)


def test_corrected_se_matches_numerical_derivative():
    n_app, p, se = 0.35, 0.4, 0.03
    n, s = rx._corr_se(n_app, se, p)
    assert abs(n - inverse_apparent_branching(n_app, p)) < 1e-14
    h = 1e-6
    d = (inverse_apparent_branching(n_app + h, p) - inverse_apparent_branching(n_app - h, p)) / (2 * h)
    assert abs(s - abs(d) * se) < 1e-7
    # with p estimated: add the p term
    sp = 0.05
    _, s2 = rx._corr_se(n_app, se, p, p_hat=p, se_p=sp)
    dp = (inverse_apparent_branching(n_app, p + h) - inverse_apparent_branching(n_app, p - h)) / (2 * h)
    assert abs(s2 - math.sqrt((d * se) ** 2 + (dp * sp) ** 2)) < 1e-7
    assert abs(apparent_branching(n, p) - n_app) < 1e-12


def test_heterogeneous_thinning_theory_reduces_to_homogeneous():
    het = dict(pi=[0.5, 0.5], n_x=[0.4, 0.4], p_cases={"h": [0.3, 0.3]})
    th = rx.e3_het_theory(het, "h")
    assert abs(th["n_app_theory"] - apparent_branching(0.4, 0.3)) < 1e-12
    assert abs(th["n_naive_theory"] - 0.4) < 1e-12
    # positive covariance: the naive correction overstates n_bar (prop:th-hetthin)
    het2 = dict(pi=[0.5, 0.5], n_x=[0.1, 0.9], p_cases={"pos": [0.2, 0.8]})
    th2 = rx.e3_het_theory(het2, "pos")
    assert th2["n_naive_theory"] > th2["n_bar"]
    assert abs(th2["n_naive_check"] - th2["n_naive_theory"]) < 1e-12


def test_logit_ci_and_scores():
    lo, hi = rx.logit_ci(np.array([0.3]), np.array([0.05]))
    assert lo[0] < 0.3 < hi[0] and 0 < lo[0] and hi[0] < 1
    # CRPS and PIT of a point mass at y: CRPS 0, PIT = V
    K = 10
    pmf = np.zeros(K + 1)
    pmf[4] = 1.0
    cdf = np.cumsum(pmf)
    prob, pit, crps, logs, mean = rx._scores(cdf, pmf, 4, 5, 0.25, 1e-9)
    assert crps == 0 and abs(pit - 0.25) < 1e-12 and prob == 0 and logs == 0 and mean == 4
    _, _, crps2, _, _ = rx._scores(cdf, pmf, 6, 5, 0.5, 1e-9)
    assert crps2 == 2  # |6 - 4| for a point mass
