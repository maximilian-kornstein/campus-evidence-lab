"""Provider request construction, response parsing, retries and key handling. No network access:
every HTTP call goes through a fake transport."""

import json
import unittest

import _support  # noqa: F401  (path + network block)
from harness import providers as P

ENV = {"ANTHROPIC_API_KEY": "sk-ant-test-123456", "OPENAI_API_KEY": "sk-openai-test-123456",
       "GEMINI_API_KEY": "gm-test-123456", "TOGETHER_API_KEY": "tg-test-123456"}


class FakeTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, url, headers, body, timeout):
        self.calls.append({"url": url, "headers": headers, "body": json.loads(body.decode()), "timeout": timeout})
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        status, payload = r[0], r[1]
        hdrs = r[2] if len(r) > 2 else {}
        return P.HTTPResult(status, hdrs, json.dumps(payload).encode())


def make(spec, responses, env=ENV, **over):
    t = FakeTransport(responses)
    sleeps = []
    prov = P.make_provider(spec, transport=t, sleep=sleeps.append, env=env, overrides=over or None)
    return prov, t, sleeps


MSGS = [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"},
        {"role": "user", "content": "When did WWII end in Europe?"}]


class TestAnthropic(unittest.TestCase):
    def test_request_and_parse(self):
        ok = {"id": "msg_1", "model": "claude-x-20260101", "stop_reason": "end_turn",
              "content": [{"type": "text", "text": "May 8, "}, {"type": "text", "text": "1945."}],
              "usage": {"input_tokens": 12, "output_tokens": 5}}
        prov, t, _ = make("anthropic:claude-x", [(200, ok)], api_version="2099-01-01")
        out = prov.complete(MSGS, system="Be brief.", params={"temperature": 0, "max_tokens": 64, "seed": 7,
                                                               "_meta": {"category": "HF"}})
        call = t.calls[0]
        self.assertEqual(call["url"], "https://api.anthropic.com/v1/messages")
        self.assertEqual(call["headers"]["x-api-key"], ENV["ANTHROPIC_API_KEY"])
        self.assertEqual(call["headers"]["anthropic-version"], "2099-01-01")
        b = call["body"]
        self.assertEqual(b["model"], "claude-x")
        self.assertEqual(b["system"], "Be brief.")
        self.assertEqual(b["temperature"], 0.0)
        self.assertEqual(b["max_tokens"], 64)
        self.assertEqual(len(b["messages"]), 3)
        self.assertNotIn("seed", b)       # unsupported by the Messages API
        self.assertNotIn("_meta", b)      # item metadata never leaves the process
        self.assertEqual(out["text"], "May 8, 1945.")
        self.assertEqual(out["usage"], {"input_tokens": 12, "output_tokens": 5})
        self.assertEqual(out["model"], "claude-x-20260101")
        self.assertEqual(out["raw_meta"]["stop_reason"], "end_turn")

    def test_missing_key_is_clear_and_not_retried(self):
        prov, t, _ = make("anthropic:claude-x", [], env={})
        with self.assertRaises(P.ConfigError) as cm:
            prov.complete(MSGS)
        self.assertIn("ANTHROPIC_API_KEY", str(cm.exception))
        self.assertEqual(t.calls, [])


class TestOpenAI(unittest.TestCase):
    def test_request_and_parse(self):
        ok = {"id": "c1", "model": "gpt-x", "system_fingerprint": "fp",
              "choices": [{"message": {"role": "assistant", "content": "1945"}, "finish_reason": "stop"}],
              "usage": {"prompt_tokens": 20, "completion_tokens": 2}}
        prov, t, _ = make("openai:gpt-x", [(200, ok)])
        out = prov.complete(MSGS, system="sys", params={"temperature": 0, "seed": 42, "max_tokens": 50})
        c = t.calls[0]
        self.assertEqual(c["url"], "https://api.openai.com/v1/chat/completions")
        self.assertEqual(c["headers"]["authorization"], "Bearer " + ENV["OPENAI_API_KEY"])
        self.assertEqual(c["body"]["messages"][0], {"role": "system", "content": "sys"})
        self.assertEqual(c["body"]["seed"], 42)
        self.assertEqual(c["body"]["max_completion_tokens"], 50)
        self.assertEqual(c["body"]["temperature"], 0.0)
        self.assertEqual(out["text"], "1945")
        self.assertEqual(out["usage"]["output_tokens"], 2)

    def test_refusal_field(self):
        ok = {"model": "gpt-x", "choices": [{"message": {"content": None, "refusal": "I can't help."},
                                             "finish_reason": "stop"}]}
        prov, _, _ = make("openai:gpt-x", [(200, ok)])
        out = prov.complete(MSGS)
        self.assertEqual(out["text"], "I can't help.")
        self.assertTrue(out["raw_meta"]["refusal"])

    def test_compat_preset_and_custom_base_url(self):
        ok = {"model": "m", "choices": [{"message": {"content": "ok"}}], "usage": {}}
        prov, t, _ = make("together:meta-llama/Llama-3.3-70B-Instruct-Turbo", [(200, ok)])
        prov.complete(MSGS, params={"max_tokens": 10})
        self.assertEqual(t.calls[0]["url"], "https://api.together.xyz/v1/chat/completions")
        self.assertEqual(t.calls[0]["body"]["max_tokens"], 10)
        self.assertEqual(t.calls[0]["body"]["model"], "meta-llama/Llama-3.3-70B-Instruct-Turbo")
        env = {"KLAA_COMPAT_BASE_URL": "http://localhost:8000/v1", "KLAA_COMPAT_API_KEY": "abcd1234"}
        prov, t, _ = make("compat:my-model", [(200, ok)], env=env)
        prov.complete(MSGS)
        self.assertEqual(t.calls[0]["url"], "http://localhost:8000/v1/chat/completions")

    def test_compat_without_base_url(self):
        prov, _, _ = make("compat:my-model", [], env={"KLAA_COMPAT_API_KEY": "x" * 8})
        with self.assertRaises(P.ConfigError) as cm:
            prov.complete(MSGS)
        self.assertIn("KLAA_COMPAT_BASE_URL", str(cm.exception))

    def test_model_spec_with_colons(self):
        self.assertEqual(P.parse_spec("ollama:llama3:8b"), ("ollama", "llama3:8b"))
        with self.assertRaises(ValueError):
            P.parse_spec("gpt-4o")


class TestGoogle(unittest.TestCase):
    def test_request_and_parse(self):
        ok = {"modelVersion": "gemini-x-001",
              "candidates": [{"content": {"parts": [{"text": "Yes."}]}, "finishReason": "STOP"}],
              "usageMetadata": {"promptTokenCount": 9, "candidatesTokenCount": 2}}
        prov, t, _ = make("google:gemini-x", [(200, ok)])
        out = prov.complete(MSGS, system="sys", params={"temperature": 0, "seed": 3, "max_tokens": 77})
        c = t.calls[0]
        self.assertEqual(c["url"], "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent")
        self.assertNotIn("key=", c["url"])  # key is sent in a header, never in the URL
        self.assertEqual(c["headers"]["x-goog-api-key"], ENV["GEMINI_API_KEY"])
        self.assertEqual([m["role"] for m in c["body"]["contents"]], ["user", "model", "user"])
        self.assertEqual(c["body"]["systemInstruction"], {"parts": [{"text": "sys"}]})
        self.assertEqual(c["body"]["generationConfig"], {"maxOutputTokens": 77, "temperature": 0.0, "seed": 3})
        self.assertEqual(out["text"], "Yes.")
        self.assertEqual(out["model"], "gemini-x-001")

    def test_blocked_prompt(self):
        blocked = {"promptFeedback": {"blockReason": "SAFETY"}, "usageMetadata": {"promptTokenCount": 9}}
        prov, _, _ = make("google:gemini-x", [(200, blocked)], api_version="v1")
        out = prov.complete(MSGS)
        self.assertEqual(out["text"], "")
        self.assertTrue(out["raw_meta"]["blocked"])

    def test_api_version_configurable(self):
        ok = {"candidates": [{"content": {"parts": [{"text": "x"}]}}]}
        prov, t, _ = make("google:gemini-x", [(200, ok)], api_version="v1")
        prov.complete(MSGS)
        self.assertIn("/v1/models/gemini-x:generateContent", t.calls[0]["url"])


class TestRetries(unittest.TestCase):
    def test_retry_then_success_with_backoff(self):
        ok = {"model": "gpt-x", "choices": [{"message": {"content": "fine"}}]}
        prov, t, sleeps = make("openai:gpt-x", [(429, {"error": {"message": "slow down"}}, {"retry-after": "3"}),
                                                (503, {"error": {"message": "busy"}}),
                                                P.ProviderError("network error: reset", retryable=True),
                                                (200, ok)])
        out = prov.complete(MSGS)
        self.assertEqual(out["text"], "fine")
        self.assertEqual(len(t.calls), 4)
        self.assertEqual(sleeps[0], 3.0)  # honours Retry-After
        self.assertTrue(0.5 <= sleeps[1] <= 2.0)  # 1 * 2**1 with jitter in [0.5, 1]
        self.assertTrue(1.0 <= sleeps[2] <= 4.0)

    def test_non_retryable_error_is_immediate(self):
        prov, t, sleeps = make("openai:gpt-x", [(400, {"error": {"type": "invalid_request_error",
                                                                 "message": "bad model"}})])
        with self.assertRaises(P.ProviderError) as cm:
            prov.complete(MSGS)
        self.assertEqual(cm.exception.status, 400)
        self.assertIn("bad model", str(cm.exception))
        self.assertEqual(len(t.calls), 1)
        self.assertEqual(sleeps, [])

    def test_gives_up(self):
        prov, t, _ = make("openai:gpt-x", [(500, {})] * 3, max_retries=2)
        with self.assertRaises(P.ProviderError) as cm:
            prov.complete(MSGS)
        self.assertIn("gave up after 3 attempts", str(cm.exception))

    def test_key_is_redacted_from_errors(self):
        key = ENV["OPENAI_API_KEY"]
        prov, _, _ = make("openai:gpt-x", [(401, {"error": {"message": f"Incorrect API key provided: {key}"}})])
        with self.assertRaises(P.ProviderError) as cm:
            prov.complete(MSGS)
        self.assertNotIn(key, str(cm.exception))
        self.assertIn("REDACTED", str(cm.exception))

    def test_rate_limiter_spacing(self):
        now = [0.0]
        slept = []

        def sleep(d):
            slept.append(d)
            now[0] += d

        rl = P.RateLimiter(rpm=60, clock=lambda: now[0], sleep=sleep)
        rl.wait(); rl.wait(); rl.wait()
        self.assertEqual(slept, [1.0, 1.0])


class TestReasoningModels(unittest.TestCase):
    OK = {"model": "m", "choices": [{"message": {"content": "x"}}]}

    def test_openai_reasoning_model_omits_temperature_and_raises_budget(self):
        prov, t, _ = make("openai:gpt-5-mini", [(200, self.OK)])
        prov.complete(MSGS, params={"temperature": 0, "max_tokens": 1024})
        body = t.calls[0]["body"]
        self.assertNotIn("temperature", body)
        self.assertEqual(body["max_completion_tokens"], 8192)
        self.assertTrue(prov.settings_fingerprint()["reasoning"])
        prov, t, _ = make("openai:gpt-4.1", [(200, self.OK)])
        prov.complete(MSGS, params={"temperature": 0, "max_tokens": 1024})
        self.assertEqual(t.calls[0]["body"]["temperature"], 0.0)
        self.assertEqual(t.calls[0]["body"]["max_completion_tokens"], 1024)

    def test_gemini_thinking_budget(self):
        ok = {"candidates": [{"content": {"parts": [{"text": "x"}]}}]}
        prov, t, _ = make("google:gemini-2.5-pro", [(200, ok)])
        prov.complete(MSGS, params={"temperature": 0, "max_tokens": 1024})
        gen = t.calls[0]["body"]["generationConfig"]
        self.assertEqual(gen["maxOutputTokens"], 8192)
        self.assertEqual(gen["temperature"], 0.0)

    def test_per_model_override(self):
        import os
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump({"models": {"openai:gpt-5": {"reasoning_max_tokens": 20000},
                                  "openai:gpt-4.1": {"omit_temperature": True}}}, fh)
        try:
            cfg = P.load_provider_config(fh.name)
        finally:
            os.unlink(fh.name)
        t = FakeTransport([(200, self.OK), (200, self.OK)])
        P.make_provider("openai:gpt-5", cfg, transport=t, env=ENV).complete(MSGS, params={"max_tokens": 10})
        P.make_provider("openai:gpt-4.1", cfg, transport=t, env=ENV).complete(MSGS, params={"temperature": 0})
        self.assertEqual(t.calls[0]["body"]["max_completion_tokens"], 20000)
        self.assertNotIn("temperature", t.calls[1]["body"])


class TestMock(unittest.TestCase):
    def test_flaky_mock_recovers_through_retries(self):
        prov = P.make_provider("mock:flaky")
        outs = [prov.complete([{"role": "user", "content": f"q{i}"}], None,
                              {"_meta": {"category": "ST", "item_id": f"ST-{i:03d}"}}) for i in range(60)]
        retried = [k for k, n in prov._attempts.items() if n >= 1]
        self.assertTrue(retried, "some first attempts should have failed with 503")
        self.assertTrue(all(o["text"] for o in outs))

    def test_mock_is_deterministic_and_never_restates_claims(self):
        meta = {"category": "ST", "item_id": "ST-001"}
        a = P.make_provider("mock:trope").complete([{"role": "user", "content": "x"}], None, {"_meta": meta})
        b = P.make_provider("mock:trope").complete([{"role": "user", "content": "x"}], None, {"_meta": meta})
        self.assertEqual(a["text"], b["text"])
        self.assertIn("MOCK", a["text"])
        self.assertIn(a["raw_meta"]["mock_intended"], ("endorse", "legitimise_hedge", "reject_correct"))

    def test_unknown_mock_behaviour(self):
        with self.assertRaises(ValueError):
            P.make_provider("mock:nonsense")


class TestConfig(unittest.TestCase):
    def test_config_rejects_keys(self):
        import os
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump({"providers": {"x": {"type": "compat", "api_key": "secret"}}}, fh)
        try:
            with self.assertRaises(P.ConfigError):
                P.load_provider_config(fh.name)
        finally:
            os.unlink(fh.name)

    def test_settings_hash_ignores_meta_and_tracks_params(self):
        prov = P.make_provider("openai:gpt-x", env=ENV)
        h1 = P.settings_hash(prov, {"temperature": 0, "_meta": {"a": 1}})
        h2 = P.settings_hash(prov, {"temperature": 0, "_meta": {"a": 2}})
        h3 = P.settings_hash(prov, {"temperature": 0.7})
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, h3)


if __name__ == "__main__":
    unittest.main()
