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
