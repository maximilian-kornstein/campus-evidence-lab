"""Response caching and --resume: keyed by item id, model, settings hash and prompt hash."""

import io
import json
import os
import pathlib
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

import _support as S
from harness import providers as P
from harness import run as R
from harness.items import load_items
from harness.runio import read_records


class FakeProvider:
    """Minimal provider: counts calls, fails for chosen items."""

    def __init__(self, spec="fake:model", fail_ids=(), base_url="x"):
        self.spec = spec
        self.name = spec.split(":")[0]
        self.config = {"type": "compat", "base_url": base_url}
        self.fail_ids = set(fail_ids)
        self.calls = []

    def settings_fingerprint(self):
        return {"base_url": self.config["base_url"]}

    def complete(self, messages, system=None, params=None):
        iid = params["_meta"]["item_id"]
        self.calls.append(iid)
        if iid in self.fail_ids:
            raise P.ProviderError("HTTP 503: busy (gave up)", status=503, retryable=True)
        return {"text": f"reply to {iid}", "usage": {"input_tokens": 1, "output_tokens": 1}, "model": "m",
                "raw_meta": {}}


def quiet(fn, *a, **k):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        rc = fn(*a, **k)
    return rc, out.getvalue(), err.getvalue()


class TestRunResponses(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        self.items = load_items(S.SAMPLE)
        self.params = {"temperature": 0.0, "max_tokens": 100}

    def tearDown(self):
        self.tmp.cleanup()

    def run_once(self, prov, resume, params=None):
        return R.run_responses(self.items, [prov], params or self.params, self.dir, resume=resume, concurrency=1,
                               log=lambda *a: None)

    def test_resume_skips_cached(self):
        p = FakeProvider()
        c1 = self.run_once(p, resume=False)
        self.assertEqual(c1.get("ok"), len(self.items))
        p2 = FakeProvider()
        c2 = self.run_once(p2, resume=True)
        self.assertEqual(p2.calls, [])
        self.assertEqual(c2["cached"], len(self.items))
        self.assertEqual(len(read_records(self.dir / "responses.jsonl")), len(self.items))

    def test_settings_change_invalidates(self):
        self.run_once(FakeProvider(), resume=False)
        p = FakeProvider()
        self.run_once(p, resume=True, params={"temperature": 0.7, "max_tokens": 100})
        self.assertEqual(len(p.calls), len(self.items))
        p3 = FakeProvider(base_url="y")  # provider settings are part of the key too
        self.run_once(p3, resume=True)
        self.assertEqual(len(p3.calls), len(self.items))

    def test_prompt_change_invalidates_only_that_item(self):
        self.run_once(FakeProvider(), resume=False)
        self.items[0].messages[-1]["content"] += " (edited)"
        p = FakeProvider()
        self.run_once(p, resume=True)
        self.assertEqual(p.calls, [self.items[0].id])

    def test_errors_are_recorded_and_retried_on_resume(self):
        bad = self.items[1].id
        c = self.run_once(FakeProvider(fail_ids={bad}), resume=False)
        self.assertEqual(c["error"], 1)
        recs = read_records(self.dir / "responses.jsonl")
        err = [r for r in recs if r["status"] == "error"]
        self.assertEqual(err[0]["item_id"], bad)
        self.assertIn("503", err[0]["error"])
        p = FakeProvider()
        self.run_once(p, resume=True)
        self.assertEqual(p.calls, [bad])

    def test_empty_reply_at_token_limit_is_an_error_not_a_refusal(self):
        class Truncating(FakeProvider):
            def complete(self, messages, system=None, params=None):
                self.calls.append(params["_meta"]["item_id"])
                return {"text": "", "usage": {}, "model": "m", "raw_meta": {"finish_reason": "length"}}

        c = self.run_once(Truncating(), resume=False)
        self.assertEqual(c["error"], len(self.items))
        rec = read_records(self.dir / "responses.jsonl")[0]
        self.assertIn("output token limit", rec["error"])

    def test_truncated_last_line_tolerated(self):
        self.run_once(FakeProvider(), resume=False)
        with open(self.dir / "responses.jsonl", "a") as fh:
            fh.write('{"response_id": "partial')
        p = FakeProvider()
        self.run_once(p, resume=True)
        self.assertEqual(p.calls, [])


class TestCli(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        self.items = S.make_fixture_items(self.dir / "items.jsonl", copies=2)

    def tearDown(self):
        self.tmp.cleanup()

    def args(self, *extra, out="run"):
        return ["--items", str(self.items), "--out", str(self.dir / out), *extra]

    def test_cli_resume_and_refuse_overwrite(self):
        rc, _, _ = quiet(R.main, ["--models", "mock:safe,mock:flaky", *self.args()])
        self.assertEqual(rc, 0)
        n1 = len(read_records(self.dir / "run" / "responses.jsonl"))
        rc, _, err = quiet(R.main, ["--models", "mock:safe,mock:flaky", *self.args()])
        self.assertEqual(rc, 2)
        self.assertIn("--resume", err)
        rc, out, _ = quiet(R.main, ["--models", "mock:safe,mock:flaky", "--resume", *self.args()])
        self.assertEqual(rc, 0)
        self.assertEqual(len(read_records(self.dir / "run" / "responses.jsonl")), n1)
        self.assertIn("cached", out)
        manifest = json.loads((self.dir / "run" / "run.json").read_text())
        self.assertTrue(manifest["all_mock"])
        self.assertEqual(manifest["params"]["temperature"], 0.0)

    def test_limit_is_category_balanced(self):
        rc, _, _ = quiet(R.main, ["--models", "mock:safe", "--limit", "8", *self.args()])
        self.assertEqual(rc, 0)
        recs = read_records(self.dir / "run" / "responses.jsonl")
        self.assertEqual(len(recs), 8)
        self.assertEqual(len({r["category"] for r in recs}), 8)

    def test_dry_run_makes_no_calls_and_reports_missing_keys(self):
        with mock.patch.dict(os.environ, {}, clear=True), \
                mock.patch.object(P, "urllib_transport", side_effect=AssertionError("network!")):
            rc, out, _ = quiet(R.main, ["--models", "anthropic:claude-x,openai:gpt-4.1,mock:safe",
                                        "--judge", "google:gemini-2.5-pro", "--dry-run", *self.args()])
        self.assertEqual(rc, 0)
        self.assertIn("DRY RUN", out)
        self.assertIn("ESTIMATE ONLY", out)
        self.assertIn("ANTHROPIC_API_KEY", out)
        self.assertIn("GEMINI_API_KEY", out)
        self.assertFalse((self.dir / "run").exists())

    def test_real_run_without_keys_or_confirmation_stops(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            rc, _, err = quiet(R.main, ["--models", "openai:gpt-4.1", *self.args()])
        self.assertEqual(rc, 2)
        self.assertIn("OPENAI_API_KEY", err)
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-abcdefgh"}, clear=True), \
                mock.patch.object(P, "urllib_transport", side_effect=AssertionError("network!")), \
                mock.patch("sys.stdin", io.StringIO("")):
            rc, _, err = quiet(R.main, ["--models", "openai:gpt-4.1", *self.args()])
        self.assertEqual(rc, 1)  # not a TTY, no --yes: aborted before any call
        self.assertIn("aborted", err)

    def test_api_key_never_written(self):
        key = "sk-secret-key-0123456789"

        def leaky(url, headers, body, timeout):
            return P.HTTPResult(401, {}, json.dumps({"error": {"message": f"bad key {key}"}}).encode())

        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": key}, clear=True), \
                mock.patch.object(P, "urllib_transport", leaky):
            rc, out, err = quiet(R.main, ["--models", "openai:gpt-4.1", "--yes", "--limit", "3", *self.args()])
        self.assertEqual(rc, 0)
        for f in (self.dir / "run").iterdir():
            self.assertNotIn(key, f.read_text(), f.name)
        self.assertNotIn(key, out + err)
        recs = read_records(self.dir / "run" / "responses.jsonl")
        self.assertTrue(all(r["status"] == "error" and "REDACTED" in r["error"] for r in recs))


if __name__ == "__main__":
    unittest.main()
