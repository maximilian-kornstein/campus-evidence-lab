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
        self.assertEqual(set(r["judge"]["output_schema"]["properties"]["label"]["enum"]), set(r["labels"]))

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
