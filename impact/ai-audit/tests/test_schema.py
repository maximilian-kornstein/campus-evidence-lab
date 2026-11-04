"""Loading BENCH's schema, rubric and items; cross-field checks; the pre-registration hash."""

import json
import pathlib
import tempfile
import unittest

import _support as S  # noqa: F401  (path + network block)
from harness import items as I
from harness.items_hash import canonical_items, items_hash


class TestSchemaLoad(unittest.TestCase):
    def setUp(self):
        self.schema = I.load_json(S.SCHEMA)
        self.rubric = I.load_json(S.RUBRIC)

    def test_schema_and_sample_items_load(self):
        items = I.load_items(S.SAMPLE, schema=self.schema, rubric=self.rubric)
        self.assertGreater(len(items), 0)
        for it in items:
            self.assertIn(it.category, I.CATEGORIES)
            self.assertIn(it.rubric_key, self.rubric["rubrics"])
            self.assertEqual(it.messages[-1]["role"], "user")

    def test_rubric_has_what_the_harness_needs(self):
        r = self.rubric
        for k in ("system_prompt", "user_template", "output_schema", "parse_failure_policy"):
            self.assertIn(k, r["judge"])
        for k in ("AER", "HACC", "ORR", "SG", "KS"):
            self.assertIn(k, r["metrics"])
        self.assertAlmostEqual(sum(r["metrics"]["KS"]["weights"].values()), 1.0)
        self.assertEqual(set(r["judge"]["output_schema"]["properties"]["label"]["enum"]),
                         set(r["labels"]) | set(r["co_labels"]))
        self.assertEqual(r["rubrics"]["CO.describe"]["label_set"], "CO")
        self.assertEqual(set(r["rubrics"]["CO.describe"]["glosses"]), set(r["label_sets"]["CO"]))
        for k in ("AER_broad", "HF_DISTORTION", "LC_FACT"):
            self.assertIn(k, r["metrics"])
            self.assertFalse(r["metrics"][k]["headline"])
        for name, m in r["metrics"].items():  # CO is never aggregated
            if isinstance(m, dict):
                self.assertNotIn("CO.describe", m.get("rubric_keys", []), name)

    def test_validator_catches_bad_items(self):
        rec = S.sample_records()[0]
        bad = dict(rec, category="XX", extra=1)
        bad.pop("tags")
        errs = I.validate_against_schema(bad, self.schema)
        self.assertTrue(any("tags" in e for e in errs))
        self.assertTrue(any("XX" in e for e in errs))
        self.assertTrue(any("extra" in e for e in errs))
        both = dict(rec, turns=[{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"},
                                {"role": "user", "content": "c"}])
        self.assertTrue(any("oneOf" in e for e in I.validate_against_schema(both, self.schema)))

    def test_consensus_core_rule(self):
        st = next(r for r in S.sample_records() if r["rubric_key"] == "ST.evaluate")
        st["definitions"]["jda"] = "contested"
        errs = I.validate_against_schema(st, self.schema)
        self.assertTrue(any("antisemitic" in e for e in errs), errs)

    def test_cross_field_rules(self):
        recs = S.sample_records()
        recs.append(dict(recs[-1], id="HF-001-m2", variant_of="HF-999"))
        recs.append(dict(next(r for r in recs if r["category"] == "SY"), id="SY-999", mirror_of="ST-999"))
        probs = I.cross_field_problems(recs, self.rubric)
        self.assertTrue(any("HF-999" in p for p in probs))
        self.assertTrue(any("ST-999" in p for p in probs))
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "bad.jsonl"
            p.write_text("".join(json.dumps(r) + "\n" for r in recs))
            with self.assertRaises(ValueError):
                I.load_items(p, schema=self.schema, rubric=self.rubric)

    def test_variants_and_turns(self):
        items = {it.id: it for it in I.load_items(S.SAMPLE)}
        variants = [it for it in items.values() if it.is_variant]
        for v in variants:
            self.assertIn(v.variant_of, items)
            self.assertEqual(v.base_id, v.variant_of)
            if v.variant_type == "pressure":
                self.assertGreaterEqual(len(v.messages), 3)  # scripted assistant turns are kept


class TestBenchValidator(unittest.TestCase):
    """bench/validate.py cross-field rules added in v1.1: CO object coding, the HF.fact -> HF.denial_bait variant
    exception, mirror-set tags and the 25% cap on any one mirror group."""

    @classmethod
    def setUpClass(cls):
        import importlib.util
        spec = importlib.util.spec_from_file_location("bench_validate", S.BENCH / "validate.py")
        cls.V = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.V)
        cls.rubric = I.load_json(S.RUBRIC)
        cls.keys = set(cls.rubric["rubrics"])

    def errs(self, recs, full=False):
        return self.V.check_items(recs, self.keys, full)

    def test_full_item_set_passes(self):
        recs = [json.loads(l) for l in (S.BENCH / "items.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        self.assertEqual(self.errs(recs, full=True), [])
        self.assertEqual(self.V.check_rubric(self.rubric), [])
        schema = I.load_json(S.SCHEMA)
        bad = [e for r in recs for e in I.validate_against_schema(r, schema)]
        self.assertEqual(bad, [])

    def test_co_object_rules(self):
        co = json.loads(json.dumps(next(r for r in S.sample_records() if r["category"] == "CO")))
        self.assertEqual(self.errs([co]), [])
        unanimous = json.loads(json.dumps(co))
        unanimous["object_definitions"].update(ihra="not", jda="not", nexus="not")
        self.assertTrue(any("unanimous" in e for e in self.errs([unanimous])))
        wrong = json.loads(json.dumps(co))  # polarity 'opposes' but the target claim is coded as contested
        wrong["definitions"] = dict(co["object_definitions"])
        self.assertTrue(any("polarity" in e for e in self.errs([wrong])))
        scored = dict(co, scored=True)
        self.assertTrue(any("never scored" in e for e in self.errs([scored])))
        no_obj = {k: v for k, v in co.items() if k != "object"}
        self.assertTrue(I.validate_against_schema(no_obj, I.load_json(S.SCHEMA)))

    def test_denial_bait_variant_exception(self):
        recs = S.sample_records()
        m1 = next(r for r in recs if r["id"] == "HF-001-m1")
        self.assertEqual(m1["rubric_key"], "HF.denial_bait")
        self.assertEqual(self.errs(recs), [])
        other = json.loads(json.dumps(m1))
        other.update(id="HF-001-p9", variant_type="paraphrase")
        self.assertTrue(any("rubric_key differs" in e for e in self.errs(recs + [other])))

    def test_mirror_group_cap_and_mirror_sets(self):
        recs = [json.loads(l) for l in (S.BENCH / "items.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        sy = [r for r in recs if r["category"] == "SY" and "variant_of" not in r]
        for r in sy[:40]:
            r["group"] = "muslims"
        self.assertTrue(any("above the cap" in e for e in self.errs(recs, full=True)))
        recs = [json.loads(l) for l in (S.BENCH / "items.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        cr_mirror = next(r for r in recs if r["category"] == "SY" and r.get("mirror_of", "").startswith("CR-"))
        cr_mirror["tags"] = [t for t in cr_mirror["tags"] if not t.startswith("mirror_set:")]
        self.assertTrue(any("mirror_set" in e for e in self.errs(recs, full=True)))


class TestItemsHash(unittest.TestCase):
    def test_hash_ignores_formatting_and_order(self):
        recs = S.sample_records()
        with tempfile.TemporaryDirectory() as d:
            a, b, c = (pathlib.Path(d) / n for n in ("a.jsonl", "b.jsonl", "c.jsonl"))
            a.write_text("".join(json.dumps(r) + "\n" for r in recs))
            b.write_text("\n".join(json.dumps(r, indent=None, sort_keys=True, separators=(", ", ": "))
                                   for r in reversed(recs)) + "\n\n")
            self.assertEqual(items_hash(a), items_hash(b))
            recs[0]["prompt"] = recs[0].get("prompt", "") + "!"
            c.write_text("".join(json.dumps(r) + "\n" for r in recs))
            self.assertNotEqual(items_hash(a), items_hash(c))
            self.assertTrue(canonical_items(a).endswith("\n"))


if __name__ == "__main__":
    unittest.main()
