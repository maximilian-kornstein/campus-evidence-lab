"""Token and cost ESTIMATES for --dry-run and the pre-run confirmation.

These are rough planning numbers, not quotes. Input tokens are approximated from character counts
(about 4 characters per token for English), output tokens from a fixed per-response range, and prices
from harness/prices.json (USD per million tokens, which you should check against each provider's
current price list). The low end uses the low token assumptions; the high end the high ones. Models
that are not in the price table use a deliberately wide default price range.
"""

from __future__ import annotations

import json
import pathlib

from . import PACKAGE_DIR
from .providers import parse_spec

DEFAULT_PRICES = PACKAGE_DIR / "prices.json"


def load_prices(path: str | pathlib.Path | None = None) -> dict:
    with open(path or DEFAULT_PRICES, encoding="utf-8") as fh:
        return json.load(fh)


def price_for(spec: str, prices: dict) -> tuple[tuple[float, float], tuple[float, float], str]:
    """((in_low, out_low), (in_high, out_high), source) in USD per 1M tokens."""
    provider, model = parse_spec(spec)
    table = prices["prices"].get(provider, {})
    best = None
    for prefix, pair in table.items():
        if model.lower().startswith(prefix.lower()) and (best is None or len(prefix) > len(best[0])):
            best = (prefix, pair)
    if best is not None:
        pair = tuple(best[1])
        return pair, pair, f"{provider}:{best[0] or '*'}"
    d = prices["prices"]["default"]
    return tuple(d["low"]), tuple(d["high"]), "default (unknown model: wide range)"


def estimate(items, model_specs: list[str], judge_spec: str | None, prices: dict, max_tokens: int = 1024,
             reasoning: set[str] | None = None) -> dict:
    ta = prices.get("token_assumptions", {})
    cpt = float(ta.get("chars_per_token", 4.0))
    in_lo_f, in_hi_f = ta.get("input_uncertainty", [0.85, 1.25])
    out_lo, out_hi = ta.get("output_tokens_per_response", [150, 650])
    out_lo, out_hi = min(out_lo, max_tokens), min(out_hi, max_tokens)
    j_rubric = ta.get("judge_rubric_tokens", 900)
    j_out_lo, j_out_hi = ta.get("judge_output_tokens", [60, 160])

    n = len(items)
    prompt_tokens = sum(it.prompt_chars() for it in items) / cpt
    rows = []
    r_lo, r_hi = ta.get("reasoning_output_tokens_per_response", [600, 4000])
    for spec in model_specs:
        (pil, pol), (pih, poh), src = price_for(spec, prices)
        tin = (prompt_tokens * in_lo_f, prompt_tokens * in_hi_f)
        if reasoning and spec in reasoning:
            tout = (n * r_lo, n * r_hi)
            src += " (reasoning model: hidden thinking tokens assumed)"
        else:
            tout = (n * out_lo, n * out_hi)
        cost = ((tin[0] * pil + tout[0] * pol) / 1e6, (tin[1] * pih + tout[1] * poh) / 1e6)
        rows.append({"model": spec, "role": "model", "calls": n, "input_tokens": tin, "output_tokens": tout,
                     "cost_usd": cost, "price_source": src})
    if judge_spec:
        (pil, pol), (pih, poh), src = price_for(judge_spec, prices)
        calls = n * len(model_specs)
        base = calls * j_rubric + len(model_specs) * prompt_tokens
        tin = ((base + calls * out_lo) * in_lo_f, (base + calls * out_hi) * in_hi_f)
        tout = (calls * j_out_lo, calls * j_out_hi)
        cost = ((tin[0] * pil + tout[0] * pol) / 1e6, (tin[1] * pih + tout[1] * poh) / 1e6)
        rows.append({"model": judge_spec, "role": "judge", "calls": calls, "input_tokens": tin,
                     "output_tokens": tout, "cost_usd": cost, "price_source": src})
    total = (sum(r["cost_usd"][0] for r in rows), sum(r["cost_usd"][1] for r in rows))
    return {"items": n, "rows": rows, "total_cost_usd": total, "calls": sum(r["calls"] for r in rows),
            "prices_as_of": prices.get("as_of")}


def _fmt_tok(lo: float, hi: float) -> str:
    def f(x):
        return f"{x / 1e6:.2f}M" if x >= 1e6 else f"{x / 1e3:.0f}k" if x >= 1e3 else f"{x:.0f}"
    return f"{f(lo)}-{f(hi)}"


def format_estimate(est: dict) -> str:
    lines = [f"{'model':44} {'role':6} {'calls':>7} {'input tok':>14} {'output tok':>14} {'USD (estimate)':>18}"]
    for r in est["rows"]:
        lo, hi = r["cost_usd"]
        lines.append(f"{r['model'][:44]:44} {r['role']:6} {r['calls']:>7,} {_fmt_tok(*r['input_tokens']):>14} "
                     f"{_fmt_tok(*r['output_tokens']):>14} {f'${lo:,.2f}-${hi:,.2f}':>18}")
    lo, hi = est["total_cost_usd"]
    lines.append(f"{'TOTAL':44} {'':6} {est['calls']:>7,} {'':>14} {'':>14} {f'${lo:,.2f}-${hi:,.2f}':>18}")
    unknown = [r["model"] for r in est["rows"] if r["price_source"].startswith("default")]
    lines.append("")
    lines.append("ESTIMATE ONLY. Token counts are approximated from characters (~4 chars/token) and an assumed "
                 "output length range; prices come from harness/prices.json "
                 f"(as of {est.get('prices_as_of')}), which may be out of date. Retries, reasoning tokens and "
                 "provider-side minimums can raise the real cost. Check provider pricing pages before running.")
    if unknown:
        lines.append("Not in the price table (wide default range used): " + ", ".join(unknown))
    return "\n".join(lines)
