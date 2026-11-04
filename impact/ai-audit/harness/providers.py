"""Provider adapters with one interface:

    provider.complete(messages, system, params) -> {"text", "usage", "model", "raw_meta"}

``messages`` is a list of {"role": "user" | "assistant", "content": str}. ``system`` is a string or
None. ``params`` may hold temperature, max_tokens, seed and top_p; unknown keys are ignored by the
HTTP adapters (the MOCK provider also reads ``params["_meta"]``, the item metadata, so that its
canned behaviours can depend on the item's category; real adapters never send it anywhere).

Adapters: Anthropic Messages API, OpenAI Chat Completions, Google Gemini generateContent, any
OpenAI-compatible endpoint (``compat`` and named presets such as ``together`` or ``ollama``), and MOCK.

API keys are read from environment variables only, are never written to disk or logs, and are
redacted from every error message. HTTP goes through an injectable ``transport`` so tests can check
request construction without any network access.
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import re
import socket
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable

USER_AGENT = "klaa-harness/1.0 (+Kornstein Lab AI Antisemitism Audit)"

# Default configuration per provider type. Everything here can be overridden with a provider config
# JSON (``--provider-config``) or with environment variables (KLAA_<PROVIDER>_BASE_URL).
PROVIDER_DEFAULTS: dict[str, dict[str, Any]] = {
    "anthropic": {
        "type": "anthropic",
        "base_url": "https://api.anthropic.com",
        "api_version": "2023-06-01",
        "api_key_env": "ANTHROPIC_API_KEY",
    },
    "openai": {
        "type": "openai",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        # Current OpenAI chat models accept max_completion_tokens; older compat servers want max_tokens.
        "max_tokens_field": "max_completion_tokens",
    },
    "google": {
        "type": "google",
        "base_url": "https://generativelanguage.googleapis.com",
        "api_version": "v1beta",
        "api_key_env": "GEMINI_API_KEY",
        "api_key_env_fallbacks": ["GOOGLE_API_KEY"],
    },
    "compat": {
        "type": "compat",
        "base_url": None,  # set KLAA_COMPAT_BASE_URL or use a provider config
        "api_key_env": "KLAA_COMPAT_API_KEY",
        "max_tokens_field": "max_tokens",
    },
    # Named OpenAI-compatible presets for hosted open models. Verify base URLs with each host.
    "together": {"type": "compat", "base_url": "https://api.together.xyz/v1", "api_key_env": "TOGETHER_API_KEY"},
    "groq": {"type": "compat", "base_url": "https://api.groq.com/openai/v1", "api_key_env": "GROQ_API_KEY"},
    "openrouter": {"type": "compat", "base_url": "https://openrouter.ai/api/v1", "api_key_env": "OPENROUTER_API_KEY"},
    "deepinfra": {"type": "compat", "base_url": "https://api.deepinfra.com/v1/openai", "api_key_env": "DEEPINFRA_API_KEY"},
    "mistral": {"type": "compat", "base_url": "https://api.mistral.ai/v1", "api_key_env": "MISTRAL_API_KEY"},
    "ollama": {"type": "compat", "base_url": "http://localhost:11434/v1", "api_key_env": None},
    "mock": {"type": "mock"},
}

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529}

# Models that spend hidden "thinking" tokens out of the output budget. For these the harness raises
# max_tokens to at least ``reasoning_max_tokens`` (default 8192) so that a reply is not cut off before
# any visible text (which the judge would otherwise score as off-topic, i.e. as over-refusal), and,
# for OpenAI reasoning models, omits temperature, which they reject. Override per provider or per
# model in --provider-config ("reasoning_pattern", "reasoning_max_tokens", "omit_temperature").
REASONING_PATTERNS = {
    "openai": r"^(o\d|gpt-5(?!.*chat))",
    "google": r"^(models/)?gemini-(2\.5|3)",
}
LENGTH_STOPS = {"length", "max_tokens", "MAX_TOKENS", "model_context_window_exceeded"}


class ProviderError(RuntimeError):
    """A provider call failed. The message never contains an API key."""

    def __init__(self, message: str, *, provider: str = "", model: str = "", status: int | None = None,
                 retryable: bool = False):
        super().__init__(message)
        self.provider = provider
        self.model = model
        self.status = status
        self.retryable = retryable


class ConfigError(ProviderError):
    """Misconfiguration, e.g. a missing API key or base URL. Never retried."""


@dataclass
class HTTPResult:
    status: int
    headers: dict[str, str]
    body: bytes


Transport = Callable[[str, dict, bytes, float], HTTPResult]


def urllib_transport(url: str, headers: dict, body: bytes, timeout: float) -> HTTPResult:
    """POST ``body`` to ``url``. Returns status/headers/body for any HTTP status; raises
    ProviderError(retryable=True) for network errors and timeouts."""
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return HTTPResult(resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read())
    except urllib.error.HTTPError as e:
        try:
            payload = e.read()
        except Exception:  # noqa: BLE001
            payload = b""
        return HTTPResult(e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, payload)
    except (socket.timeout, TimeoutError) as e:
        raise ProviderError(f"request timed out after {timeout:.0f}s", retryable=True) from e
    except urllib.error.URLError as e:
        raise ProviderError(f"network error: {e.reason}", retryable=True) from e
    except ConnectionError as e:
        raise ProviderError(f"connection error: {e}", retryable=True) from e


class RateLimiter:
    """Minimum spacing between request starts (requests per minute), shared by threads."""

    def __init__(self, rpm: float | None, clock: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep):
        self.interval = 60.0 / rpm if rpm else 0.0
        self._next = 0.0
        self._lock = threading.Lock()
        self._clock = clock
        self._sleep = sleep

    def wait(self) -> float:
        if not self.interval:
            return 0.0
        with self._lock:
            now = self._clock()
            start = max(now, self._next)
            self._next = start + self.interval
        delay = start - now
        if delay > 0:
            self._sleep(delay)
        return delay


def _redact(text: str, secrets: list[str]) -> str:
    for s in secrets:
        if s and len(s) >= 4:
            text = text.replace(s, "***REDACTED***")
    # Belt and braces: mask anything that looks like a bearer token or key parameter.
    text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{8,}", r"\1***", text)
    text = re.sub(r"(?i)(key=)[A-Za-z0-9._\-]{8,}", r"\1***", text)
    return text


def _error_detail(body: bytes) -> str:
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except Exception:  # noqa: BLE001
        return body.decode("utf-8", "replace")[:300]
    err = data.get("error", data) if isinstance(data, dict) else data
    if isinstance(err, dict):
        msg = err.get("message") or err.get("type") or json.dumps(err)[:300]
        typ = err.get("type") or err.get("status") or err.get("code")
        return f"{typ}: {msg}" if typ and typ != msg else str(msg)
    return str(err)[:300]


@dataclass
class Provider:
    """Base class. Subclasses implement ``build_request`` and ``parse_response``."""

    name: str
    model: str
    config: dict = field(default_factory=dict)
    transport: Transport | None = None
    sleep: Callable[[float], None] = time.sleep
    rng: random.Random = field(default_factory=lambda: random.Random(0))
    env: Any = None  # mapping used to look up keys (defaults to os.environ)

    def __post_init__(self):
        self.env = os.environ if self.env is None else self.env
        cfg = self.config
        self.timeout = float(cfg.get("timeout", 120))
        self.max_retries = int(cfg.get("max_retries", 5))
        self.backoff_base = float(cfg.get("backoff_base", 1.0))
        self.backoff_max = float(cfg.get("backoff_max", 60.0))
        self.limiter = RateLimiter(cfg.get("rpm"), sleep=self.sleep)
        self.transport = self.transport or urllib_transport

    # -- configuration -------------------------------------------------------------------------
    @property
    def spec(self) -> str:
        return f"{self.name}:{self.model}"

    def api_key(self, required: bool = True) -> str | None:
        names = [self.config.get("api_key_env")] + list(self.config.get("api_key_env_fallbacks", []))
        names = [n for n in names if n]
        for n in names:
            v = self.env.get(n)
            if v:
                return v.strip()
        if required and names:
            raise ConfigError(
                f"{self.spec}: no API key. Set the environment variable {names[0]}"
                + (f" (or {', '.join(names[1:])})" if len(names) > 1 else "")
                + ". Keys are read from the environment only and never written to disk.",
                provider=self.name, model=self.model)
        return None

    def is_reasoning(self) -> bool:
        pat = self.config.get("reasoning_pattern")
        if pat is None:
            pat = REASONING_PATTERNS.get(self.config.get("type", self.name))
        return bool(pat) and re.search(pat, self.model) is not None

    def effective_params(self, params: dict) -> dict:
        """The sampling params actually sent (reasoning models get a larger output budget)."""
        p = dict(params)
        p.update(self.config.get("params") or {})
        if self.is_reasoning():
            floor = int(self.config.get("reasoning_max_tokens", 8192))
            p["max_tokens"] = max(int(p.get("max_tokens", 1024)), floor)
        return p

    def omits_temperature(self) -> bool:
        flag = self.config.get("omit_temperature")
        if flag is None:
            return self.config.get("type", self.name) == "openai" and self.is_reasoning()
        return bool(flag)

    def settings_fingerprint(self) -> dict:
        """Settings that change the output, used in the cache key (never includes keys)."""
        keep = ("type", "base_url", "api_version", "max_tokens_field", "system_role", "extra_body",
                "safety_settings")
        fp = {k: self.config.get(k) for k in keep if self.config.get(k) is not None}
        fp["omit_temperature"] = self.omits_temperature()
        fp["reasoning"] = self.is_reasoning()
        return fp

    # -- the common interface --------------------------------------------------------------------
    def complete(self, messages: list[dict], system: str | None = None, params: dict | None = None) -> dict:
        params = self.effective_params(params or {})
        url, headers, body = self.build_request(messages, system, params)
        data = self._post(url, headers, body)
        out = self.parse_response(data)
        out.setdefault("model", self.model)
        out.setdefault("raw_meta", {})
        out["raw_meta"]["provider"] = self.name
        return out

    def build_request(self, messages, system, params) -> tuple[str, dict, dict]:  # pragma: no cover
        raise NotImplementedError

    def parse_response(self, data: dict) -> dict:  # pragma: no cover
        raise NotImplementedError

    # -- HTTP with retries -----------------------------------------------------------------------
    def _backoff(self, attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return min(self.backoff_max, max(0.0, float(retry_after)))
            except ValueError:
                pass
        base = min(self.backoff_max, self.backoff_base * (2 ** attempt))
        return base * (0.5 + 0.5 * self.rng.random())

    def _post(self, url: str, headers: dict, body: dict) -> dict:
        secrets = [self.api_key(required=False) or ""]
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"content-type": "application/json", "user-agent": USER_AGENT, **headers}
        last: ProviderError | None = None
        for attempt in range(self.max_retries + 1):
            self.limiter.wait()
            try:
                res = self.transport(url, headers, payload, self.timeout)
            except ProviderError as e:
                last = ProviderError(_redact(f"{self.spec}: {e}", secrets), provider=self.name, model=self.model,
                                     retryable=e.retryable)
                if not e.retryable:
                    raise last from e
                if attempt < self.max_retries:
                    self.sleep(self._backoff(attempt, None))
                continue
            if 200 <= res.status < 300:
                try:
                    return json.loads(res.body.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as e:
                    raise ProviderError(f"{self.spec}: response was not JSON ({e})", provider=self.name,
                                        model=self.model, status=res.status) from e
            detail = _redact(_error_detail(res.body), secrets)
            hint = {
                401: " Check that the API key environment variable is set and valid.",
                403: " The key may not have access to this model.",
                404: " Check the model name, base URL and API version.",
                429: " Rate limited; consider lowering --rpm or --concurrency.",
            }.get(res.status, "")
            retryable = res.status in RETRYABLE_STATUS
            last = ProviderError(f"{self.spec}: HTTP {res.status}: {detail}.{hint}", provider=self.name,
                                 model=self.model, status=res.status, retryable=retryable)
            if not retryable:
                raise last
            if attempt < self.max_retries:
                self.sleep(self._backoff(attempt, res.headers.get("retry-after")))
        assert last is not None
        raise ProviderError(f"{last} (gave up after {self.max_retries + 1} attempts)", provider=self.name,
                            model=self.model, status=last.status, retryable=True)


def _check_messages(messages: list[dict]) -> list[dict]:
    out = []
    for m in messages:
        role = m.get("role")
        if role not in ("user", "assistant"):
            raise ValueError(f"unsupported message role {role!r}; use user/assistant and pass system separately")
        out.append({"role": role, "content": str(m.get("content", ""))})
    if not out or out[-1]["role"] != "user":
        raise ValueError("the conversation must end with a user message")
    return out


class AnthropicProvider(Provider):
    def build_request(self, messages, system, params):
        key = self.api_key()
        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": int(params.get("max_tokens", 1024)),
            "messages": _check_messages(messages),
        }
        if system:
            body["system"] = system
        if params.get("temperature") is not None and not self.omits_temperature():
            body["temperature"] = float(params["temperature"])
        if params.get("top_p") is not None:
            body["top_p"] = float(params["top_p"])
        body.update(self.config.get("extra_body") or {})
        headers = {"x-api-key": key, "anthropic-version": self.config.get("api_version", "2023-06-01")}
        return f"{self.config['base_url'].rstrip('/')}/v1/messages", headers, body

    def parse_response(self, data):
        blocks = data.get("content") or []
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        u = data.get("usage") or {}
        return {
            "text": text,
            "usage": {"input_tokens": int(u.get("input_tokens", 0) or 0),
                      "output_tokens": int(u.get("output_tokens", 0) or 0)},
            "model": data.get("model", self.model),
            "raw_meta": {"id": data.get("id"), "stop_reason": data.get("stop_reason")},
        }


class OpenAIProvider(Provider):
    """OpenAI Chat Completions; also the base for OpenAI-compatible endpoints."""

    def build_request(self, messages, system, params):
        base = self.config.get("base_url")
        if not base:
            env_name = f"KLAA_{self.name.upper()}_BASE_URL"
            raise ConfigError(f"{self.spec}: no base_url. Set {env_name} or give one in --provider-config.",
                              provider=self.name, model=self.model)
        key = self.api_key(required=bool(self.config.get("api_key_env")))
        msgs = _check_messages(messages)
        if system:
            msgs = [{"role": self.config.get("system_role", "system"), "content": system}] + msgs
        body: dict[str, Any] = {"model": self.model, "messages": msgs}
        mt_field = self.config.get("max_tokens_field", "max_tokens")
        body[mt_field] = int(params.get("max_tokens", 1024))
        if params.get("temperature") is not None and not self.omits_temperature():
            body["temperature"] = float(params["temperature"])
        if params.get("top_p") is not None:
            body["top_p"] = float(params["top_p"])
        if params.get("seed") is not None and not self.config.get("omit_seed"):
            body["seed"] = int(params["seed"])
        body.update(self.config.get("extra_body") or {})
        headers = {"authorization": f"Bearer {key}"} if key else {}
        headers.update(self.config.get("extra_headers") or {})
        return f"{base.rstrip('/')}/chat/completions", headers, body

    def parse_response(self, data):
        choices = data.get("choices") or []
        msg = (choices[0].get("message") or {}) if choices else {}
        text = msg.get("content") or ""
        if isinstance(text, list):  # some compat servers return content parts
            text = "".join(p.get("text", "") for p in text if isinstance(p, dict))
        refusal = msg.get("refusal")
        if not text and refusal:
            text = refusal
        u = data.get("usage") or {}
        return {
            "text": text,
            "usage": {"input_tokens": int(u.get("prompt_tokens", 0) or 0),
                      "output_tokens": int(u.get("completion_tokens", 0) or 0)},
            "model": data.get("model", self.model),
            "raw_meta": {"id": data.get("id"), "finish_reason": choices[0].get("finish_reason") if choices else None,
                         "system_fingerprint": data.get("system_fingerprint"), "refusal": bool(refusal)},
        }


class GoogleProvider(Provider):
    """Gemini generateContent. The key goes in the x-goog-api-key header, never the URL."""

    def build_request(self, messages, system, params):
        key = self.api_key()
        contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                    for m in _check_messages(messages)]
        gen: dict[str, Any] = {"maxOutputTokens": int(params.get("max_tokens", 1024))}
        if params.get("temperature") is not None and not self.omits_temperature():
            gen["temperature"] = float(params["temperature"])
        if params.get("top_p") is not None:
            gen["topP"] = float(params["top_p"])
        if params.get("seed") is not None and not self.config.get("omit_seed"):
            gen["seed"] = int(params["seed"])
        body: dict[str, Any] = {"contents": contents, "generationConfig": gen}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if self.config.get("safety_settings"):
            body["safetySettings"] = self.config["safety_settings"]
        body.update(self.config.get("extra_body") or {})
        ver = self.config.get("api_version", "v1beta")
        model = self.model if self.model.startswith("models/") else f"models/{self.model}"
        url = f"{self.config['base_url'].rstrip('/')}/{ver}/{model}:generateContent"
        return url, {"x-goog-api-key": key}, body

    def parse_response(self, data):
        cands = data.get("candidates") or []
        text, finish = "", None
        if cands:
            parts = (cands[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
            finish = cands[0].get("finishReason")
        block = (data.get("promptFeedback") or {}).get("blockReason")
        u = data.get("usageMetadata") or {}
        return {
            "text": text,
            "usage": {"input_tokens": int(u.get("promptTokenCount", 0) or 0),
                      "output_tokens": int(u.get("candidatesTokenCount", 0) or 0)
                      + int(u.get("thoughtsTokenCount", 0) or 0)},
            "model": data.get("modelVersion", self.model),
            "raw_meta": {"finish_reason": finish, "block_reason": block,
                         "blocked": bool(block) or finish in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST")},
        }


# --------------------------------------------------------------------------------------------------
# Provider construction
# --------------------------------------------------------------------------------------------------

def parse_spec(spec: str) -> tuple[str, str]:
    """'provider:model' -> (provider, model). Only the first ':' splits, so 'ollama:llama3:8b' works."""
    if ":" not in spec:
        raise ValueError(f"model spec {spec!r} must look like provider:model (e.g. openai:gpt-4.1, mock:safe)")
    p, m = spec.split(":", 1)
    p, m = p.strip().lower(), m.strip()
    if not p or not m:
        raise ValueError(f"bad model spec {spec!r}")
    return p, m


def load_provider_config(path: str | None) -> dict[str, dict]:
    cfg = {k: dict(v) for k, v in PROVIDER_DEFAULTS.items()}
    if path:
        with open(path, encoding="utf-8") as fh:
            user = json.load(fh)
        sections = list((user.get("providers") or {}).items()) + list((user.get("models") or {}).items())
        for name, over in sections:
            if any(k.lower().endswith("api_key") or k.lower() == "key" for k in over):
                raise ConfigError(f"provider config for {name!r} contains an API key field; put keys in "
                                  f"environment variables and name them with api_key_env instead")
        for name, over in (user.get("providers") or {}).items():
            cfg.setdefault(name, {}).update(over)
        cfg["models"] = dict(user.get("models") or {})
    return cfg


def make_provider(spec: str, provider_config: dict | None = None, *, transport: Transport | None = None,
                  sleep: Callable[[float], None] | None = None, env: Any = None, overrides: dict | None = None
                  ) -> Provider:
    from . import mock  # local import to avoid a cycle

    name, model = parse_spec(spec)
    cfgs = provider_config or load_provider_config(None)
    if name not in cfgs or name == "models":
        raise ValueError(f"unknown provider {name!r}. Known: {', '.join(sorted(cfgs))}. "
                         "Add OpenAI-compatible endpoints with --provider-config.")
    cfg = dict(cfgs[name])
    cfg.update((cfgs.get("models") or {}).get(f"{name}:{model}", {}))  # per-model overrides
    environ = os.environ if env is None else env
    env_base = environ.get(f"KLAA_{name.upper()}_BASE_URL")
    if env_base:
        cfg["base_url"] = env_base
    cfg.update(overrides or {})
    kind = cfg.get("type", name)
    cls = {"anthropic": AnthropicProvider, "openai": OpenAIProvider, "compat": OpenAIProvider,
           "google": GoogleProvider, "mock": mock.MockProvider}.get(kind)
    if cls is None:
        raise ValueError(f"provider {name!r} has unknown type {kind!r}")
    kwargs: dict[str, Any] = {"name": name, "model": model, "config": cfg, "transport": transport, "env": env}
    if sleep is not None:
        kwargs["sleep"] = sleep
    return cls(**kwargs)


def is_mock(spec: str) -> bool:
    try:
        return parse_spec(spec)[0] == "mock"
    except ValueError:
        return False


def settings_hash(provider: Provider, params: dict) -> str:
    """Stable hash of the provider settings and sampling params that determine a response (not the
    prompt, which is hashed separately, and never the API key)."""
    eff = provider.effective_params(params) if hasattr(provider, "effective_params") else params
    clean = {k: v for k, v in sorted(eff.items()) if not k.startswith("_")}
    blob = json.dumps({"spec": provider.spec, "settings": provider.settings_fingerprint(), "params": clean},
                      sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
