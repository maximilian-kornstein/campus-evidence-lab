"""End to end with MOCK providers: run -> judge -> score -> validate (simulated) -> rescore -> site.

The safe mock must score best on endorsement and the over-refuser worst on over-refusal."""

import importlib.util
import io
import json
import pathlib
import re
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

import _support as S
from harness import judge as J
from harness import run as R
from harness import score as SC
from harness import validate as V

MODELS = ["mock:safe", "mock:overrefuse", "mock:trope", "mock:hedge"]


def load_site_builder():
    spec = importlib.util.spec_from_file_location("build_site", S.AUDIT / "site" / "build_site.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        d = pathlib.Path(cls.tmp.name)
        cls.items = S.make_fixture_items(d / "items.jsonl", copies=12)
        cls.run_dir = d / "demo"
        out = io.StringIO()
        with redirect_stdout(out), redirect_stderr(io.StringIO()):
            cls.rc = R.main(["--models", ",".join(MODELS), "--judge", "mock:judge", "--items", str(cls.items),
                             "--out", str(cls.run_dir), "--bootstrap", "300", "--concurrency", "4"])
        cls.stdout = out.getvalue()
        cls.scores = json.loads((cls.run_dir / "scores.json").read_text())
        cls.M = {m["model"]: m for m in cls.scores["models"]}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def metric(self, model, code):
        if code == "SG":
            return self.M[model]["SG"]["value"]
        if code == "KS":
            return self.M[model]["KS"]["value"]
        return self.M[model]["metrics"][code]["value"]

    def test_pipeline_ran(self):
        self.assertEqual(self.rc, 0)
        for f in ("run.json", "responses.jsonl", "judgments.jsonl", "scores.json", "report.md"):
            self.assertTrue((self.run_dir / f).exists(), f)
        self.assertTrue(self.scores["demo"])
        self.assertIn("DEMO DATA", (self.run_dir / "report.md").read_text())

    def test_safe_best_on_endorsement(self):
        aer = {m: self.metric(m, "AER") for m in MODELS}
        self.assertEqual(min(aer, key=aer.get), "mock:safe")
        self.assertEqual(max(aer, key=aer.get), "mock:trope")
        self.assertLess(aer["mock:safe"], 0.05)

    def test_overrefuser_worst_on_over_refusal(self):
        orr = {m: self.metric(m, "ORR") for m in MODELS}
        self.assertEqual(max(orr, key=orr.get), "mock:overrefuse")
        self.assertGreater(orr["mock:overrefuse"], 0.3)

    def test_symmetry_and_composite(self):
        self.assertGreater(self.metric("mock:trope", "SG"), self.metric("mock:safe", "SG"))
        ks = {m: self.metric(m, "KS") for m in MODELS}
        self.assertEqual(max(ks, key=ks.get), "mock:safe")
        self.assertEqual(self.M["mock:safe"]["rank"], 1)
        trope_vs_safe = [c for c in self.scores["comparisons"] if c["metric"] == "AER"
                         and {c["a"], c["b"]} == {"mock:safe", "mock:trope"}][0]
        self.assertLess(trope_vs_safe["p_bootstrap_holm"], 0.05)

    def test_pressure_variants_hurt_the_trope_model(self):
        rob = self.M["mock:trope"]["robustness"]["pressure"]["metrics"]
        self.assertIn("AER", rob)
        self.assertIsNotNone(rob["AER"]["variant"])

    def test_judge_resume_is_cached(self):
        from harness.providers import make_provider
        counts = J.run_judging(self.run_dir, make_provider("mock:judge"), log=lambda *a: None)
        self.assertEqual(counts.get("cached"), len(MODELS) * sum(1 for _ in open(self.items)))
        self.assertEqual(sum(v for k, v in counts.items() if k != "cached"), 0)

    def test_validation_and_correction_then_site(self):
        # Copy the run so the other tests keep the uncorrected scores.
        import shutil
        run2 = pathlib.Path(self.tmp.name) / "demo2"
        shutil.copytree(self.run_dir, run2)
        # Re-judge with the noisy judge so there is misclassification to correct.
        from harness.providers import make_provider
        manifest = json.loads((run2 / "run.json").read_text())
        J.run_judging(run2, make_provider("mock:judge-noisy"), log=lambda *a: None)
        res = V.simulate(run2, n=150, seed=1, log=lambda *a: None)
        self.assertTrue(res["simulated"])
        self.assertEqual(res["n_labels"], 150)
        self.assertLess(res["label_agreement"]["overall"], 1.0)
        scored = SC.score_run(run2, bootstrap=200)
        bases = {m["model"]: m["metrics"]["AER"]["basis"] for m in scored["models"]}
        self.assertIn("corrected", bases.values())
        self.assertTrue(scored["validation"]["simulated"])
        self.assertNotEqual(manifest.get("judge"), json.loads((run2 / "run.json").read_text())["judge"])
        # site
        mod = load_site_builder()
        page = mod.build(scored)
        self.assertIn("DEMO DATA (mock models)", page)
        self.assertIn("Pre-registered", page)
        self.assertIn(scored["items_sha256"], page)
        self.assertIn("<svg", page)
        self.assertIn("Neutrality statement", page)
        self.assertIsNone(re.search(r'<(script|link|img)[^>]+(src|href)="(https?:)?//', page))
        self.assertNotIn("@import", page)
        self.assertIn("prefers-color-scheme:dark", page)
        # usage / data-card statement (Review A #14)
        self.assertIn("How to use these results", page)
        self.assertIn("not a definition of antisemitism", page)
        self.assertIn("DATA_CARD.md", page)
        # CO shown only with neutral labels (rule R4)
        self.assertIn("Leans affirm", page)
        self.assertIn("never scored, ranked or aggregated", page)
        # persona variants appear only pooled across models (Review B #9)
        self.assertIn("pooled across all models", page)
        if "system-persona" in scored["robustness_pooled"]:
            self.assertIn("System persona", page)
        for m in scored["models"]:
            per_model_persona = (m.get("robustness") or {}).get("system-persona", {}).get("metrics", {}).get("AER")
            if per_model_persona and per_model_persona["variant"] is not None:
                cell = f'{100 * per_model_persona["variant"]:.1f}% / {100 * per_model_persona["matched_base"]:.1f}%'
                pooled = scored["robustness_pooled"]["system-persona"]["metrics"]["AER"]
                pooled_cell = f'{100 * pooled["variant"]:.1f}% / {100 * pooled["matched_base"]:.1f}%'
                if cell != pooled_cell:
                    self.assertNotIn(cell, page)
        # secondary metrics and SG subsets
        self.assertIn("Holocaust distortion rate", page)
        if any(m["SG"].get("subsets") for m in scored["models"]):
            self.assertIn("Hamas / armed-group mirrors", page)

    def test_co_labels_are_descriptive_and_unscored(self):
        for m in self.scores["models"]:
            co = m["categories"].get("CO")
            self.assertIsNotNone(co)
            self.assertEqual(co["label_set"], "CO")
            self.assertTrue(set(co["labels"]) <= set(J.CO_LABELS))
            self.assertGreater(sum(co["labels"].values()), 0)
        judged_co = [json.loads(l) for l in open(self.run_dir / "judgments.jsonl") if '"category": "CO"' in l]
        self.assertTrue(judged_co)
        self.assertTrue(all(j["label"] in J.CO_LABELS for j in judged_co if j.get("label")))

    def test_validation_form_blurs_trope_responses(self):
        import shutil
        run3 = pathlib.Path(self.tmp.name) / "demo3"
        shutil.copytree(self.run_dir, run3)
        V.export(run3, n=60, seed=2, log=lambda *a: None)
        html_form = (run3 / "validation" / "label_form.html").read_text()
        self.assertIn("Show response (may contain hateful content)", html_form)
        self.assertIn('"sensitive": true', html_form)
        self.assertIn("at most 50 responses", html_form)

    def test_site_publishes_persona_results_only_pooled(self):
        mod = load_site_builder()
        fake = json.loads(json.dumps(self.scores))
        rates = [0.123, 0.456, 0.789, 0.321]
        per_model = []
        for m, r in zip(fake["models"], rates):
            m["robustness"]["system-persona"] = {"flip_rate": r, "n_flip_pairs": 10, "flip_by_metric": {},
                                                 "metrics": {"AER": {"variant": r, "n": 10, "wilson": [0, 1],
                                                                     "matched_base": 0.05, "n_base": 10}}}
            per_model.append(m["robustness"])
        fake["robustness_pooled"] = SC.RunScorer.pooled_robustness(per_model)
        page = mod.build(fake)
        pooled = fake["robustness_pooled"]["system-persona"]["metrics"]["AER"]["variant"]
        self.assertAlmostEqual(pooled, sum(rates) / len(rates))
        self.assertIn(f"{100 * pooled:.1f}%", page)
        for r in rates:  # no per-model persona figure appears anywhere on the public page
            self.assertNotIn(f"{100 * r:.1f}%", page)

    def test_site_without_mock_has_no_banner(self):
        mod = load_site_builder()
        fake = json.loads(json.dumps(self.scores))
        fake["demo"] = False
        for m in fake["models"]:
            m["mock"] = False
        page = mod.build(fake)
        self.assertNotIn("DEMO DATA", page)


if __name__ == "__main__":
    unittest.main()
