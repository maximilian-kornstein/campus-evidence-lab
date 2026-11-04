"""Run the KLAA items against one or more models and write responses.jsonl.

    python -m harness.run --models mock:safe,mock:overrefuse,mock:trope --judge mock:judge \\
        --out results/demo-mock
    python -m harness.run --models anthropic:MODEL,openai:MODEL --judge anthropic:MODEL --dry-run

Real providers are called only when they are named in --models/--judge, their API keys are in the
environment, --dry-run is not given and the cost confirmation is accepted (or --yes is passed).
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import pathlib
import platform
import sys
import threading
import time
from collections import Counter, defaultdict

from . import RESULTS_DIR, __version__, cost
from .items import CATEGORIES, Item, load_items, load_json
from .items_hash import file_json_hash, items_hash, raw_file_hash
from .providers import (LENGTH_STOPS, ConfigError, ProviderError, is_mock, load_provider_config,
                        make_provider, settings_hash)
from .runio import (JUDGMENTS, MANIFEST, RESPONSES, JsonlWriter, default_items_path, default_rubric_path,
                    default_schema_path, load_manifest, now_iso, read_records, rel, resolve, save_manifest)

MAX_CONSECUTIVE_FAILURES = 10


def split_specs(s: str | None) -> list[str]:
    if not s:
        return []
    out = [x.strip() for x in s.split(",") if x.strip()]
    if len(set(out)) != len(out):
        raise SystemExit("error: duplicate model in --models")
    return out


def select_items(items: list[Item], categories: list[str] | None, base_only: bool, limit: int | None
                 ) -> list[Item]:
    sel = [it for it in items if (not categories or it.category in categories) and not (base_only and it.is_variant)]
    if limit is not None and limit < len(sel):
        # Deterministic, category-balanced subset: round-robin over categories in file order.
        by_cat: dict[str, list[Item]] = defaultdict(list)
        for it in sel:
            by_cat[it.category].append(it)
        order = [c for c in CATEGORIES if c in by_cat]
        picked, i = [], 0
        while len(picked) < limit:
            progressed = False
            for c in order:
                if i < len(by_cat[c]) and len(picked) < limit:
                    picked.append(by_cat[c][i])
                    progressed = True
            if not progressed:
                break
            i += 1
        keep = {it.id for it in picked}
        sel = [it for it in sel if it.id in keep]
    return sel


def load_bench(items_path, schema_path=None, rubric_path=None, strict=True):
    schema = load_json(schema_path) if schema_path and pathlib.Path(schema_path).exists() else None
    rubric = load_json(rubric_path) if rubric_path and pathlib.Path(rubric_path).exists() else None
    items = load_items(items_path, schema=schema, rubric=rubric, strict=strict)
    return items, schema, rubric


def response_id(spec: str, item_id: str) -> str:
    return f"{spec}|{item_id}"


def build_params(args) -> dict:
    p = {"temperature": args.temperature, "max_tokens": args.max_tokens}
    if args.seed is not None:
        p["seed"] = args.seed
    if args.top_p is not None:
        p["top_p"] = args.top_p
    return p


def missing_keys(providers) -> list[str]:
    out = []
    for p in providers:
        if is_mock(p.spec):
            continue
        try:
            p.api_key(required=True)
        except ConfigError:
            out.append(f"{p.config.get('api_key_env')} (for {p.spec})")
    return out


def confirm(prompt: str) -> bool:
    if not sys.stdin.isatty():
        return False
    try:
        return input(prompt).strip().lower() in ("y", "yes")
    except EOFError:
        return False


def run_responses(items: list[Item], providers: list, params: dict, out_dir: pathlib.Path, *, resume: bool,
                  concurrency: int = 4, log=print) -> dict:
    """Call every provider on every item, appending to responses.jsonl. Returns counters."""
    path = out_dir / RESPONSES
    done: dict[tuple, dict] = {}
    if resume:
        for r in read_records(path):
            if r.get("status") == "ok":
                done[(r["item_id"], r["model"], r["settings_hash"], r["prompt_hash"])] = r
    tasks = []
    shash = {p.spec: settings_hash(p, params) for p in providers}
    for p in providers:
        for it in items:
            key = (it.id, p.spec, shash[p.spec], it.prompt_hash())
            if key not in done:
                tasks.append((p, it))
    counts = Counter(cached=len(items) * len(providers) - len(tasks))
    if counts["cached"]:
        log(f"resume: {counts['cached']} responses already cached, {len(tasks)} to run")
    if not tasks:
        return dict(counts)
    fails: Counter = Counter()
    disabled: set[str] = set()
    lock = threading.Lock()
    t0 = time.time()
    progress = {"n": 0}

    def work(p, it: Item):
        if p.spec in disabled:
            return "skipped"
        call_params = dict(params, _meta=it.meta())
        rec = {"response_id": response_id(p.spec, it.id), "item_id": it.id, "base_id": it.base_id,
               "category": it.category, "rubric_key": it.rubric_key, "variant_type": it.variant_type,
               "model": p.spec, "provider": p.name, "settings_hash": shash[p.spec],
               "prompt_hash": it.prompt_hash(), "params": p.effective_params(params) if hasattr(p, "effective_params") else params,
               "harness_version": __version__,
               "ts": now_iso()}
        start = time.time()
        try:
            out = p.complete(it.messages, it.system, call_params)
            meta = out.get("raw_meta", {})
            stop = meta.get("finish_reason") or meta.get("stop_reason")
            if not (out.get("text") or "").strip() and stop in LENGTH_STOPS:
                raise ProviderError(f"{p.spec}: empty reply because the output token limit was reached "
                                    f"(stop reason {stop}); raise --max-tokens or reasoning_max_tokens "
                                    "(reasoning models spend tokens on hidden thinking)", retryable=True)
            rec.update(status="ok", text=out["text"], usage=out.get("usage", {}),
                       model_reported=out.get("model"), raw_meta=meta)
            with lock:
                fails[p.spec] = 0
            status = "ok"
        except ConfigError:
            raise
        except ProviderError as e:
            rec.update(status="error", error=str(e), http_status=e.status)
            with lock:
                fails[p.spec] += 1
                if fails[p.spec] >= MAX_CONSECUTIVE_FAILURES and p.spec not in disabled:
                    disabled.add(p.spec)
                    log(f"! {p.spec}: {MAX_CONSECUTIVE_FAILURES} consecutive failures; skipping its remaining "
                        f"items (last error: {e}). Fix the problem and rerun with --resume.")
            status = "error"
        rec["latency_s"] = round(time.time() - start, 3)
        writer.write(rec)
        with lock:
            progress["n"] += 1
            n = progress["n"]
        if n == len(tasks) or n % max(1, len(tasks) // 20) == 0:
            rate = n / max(time.time() - t0, 1e-6)
            log(f"  responses {n}/{len(tasks)} ({rate:.1f}/s)")
        return status

    with JsonlWriter(path) as writer:
        if concurrency <= 1:
            for p, it in tasks:
                counts[work(p, it)] += 1
        else:
            with cf.ThreadPoolExecutor(max_workers=concurrency) as ex:
                futs = [ex.submit(work, p, it) for p, it in tasks]
                try:
                    for f in cf.as_completed(futs):
                        counts[f.result()] += 1
                except ConfigError:
                    for f in futs:
                        f.cancel()
                    raise
    return dict(counts)


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="python -m harness.run", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", required=True,
                    help="comma-separated provider:model list, e.g. anthropic:MODEL,openai:MODEL,google:MODEL,"
                         "together:ORG/MODEL,compat:MODEL,mock:safe")
    ap.add_argument("--items", default=None, help="items JSONL (default bench/items.jsonl, else the sample)")
    ap.add_argument("--schema", default=None, help="item schema (default bench/schema.json)")
    ap.add_argument("--rubric", default=None, help="rubric JSON (default bench/rubric.json)")
    ap.add_argument("--judge", default=None, help="provider:model for the LLM judge; judging and scoring "
                                                  "follow the responses when given")
    ap.add_argument("--out", default=None, help="run directory (default results/run-<timestamp>)")
    ap.add_argument("--dry-run", action="store_true", help="print the plan and an ESTIMATED cost; no API calls")
    ap.add_argument("--limit", type=int, default=None, help="use a deterministic category-balanced subset of N items")
    ap.add_argument("--categories", default=None, help="comma-separated categories to include (e.g. HF,LC)")
    ap.add_argument("--base-only", action="store_true", help="skip robustness variants")
    ap.add_argument("--resume", action="store_true", help="continue an existing run, reusing cached responses")
    ap.add_argument("--temperature", type=float, default=0.0, help="sampling temperature (default 0)")
    ap.add_argument("--top-p", type=float, default=None)
    ap.add_argument("--seed", type=int, default=None, help="sampling seed, sent to providers that support it")
    ap.add_argument("--max-tokens", type=int, default=1024, help="max output tokens per response (default 1024)")
    ap.add_argument("--concurrency", type=int, default=4, help="parallel requests (default 4)")
    ap.add_argument("--rpm", type=float, default=None, help="max requests per minute per model")
    ap.add_argument("--timeout", type=float, default=None, help="per-request timeout in seconds (default 120)")
    ap.add_argument("--max-retries", type=int, default=None, help="retries on transient errors (default 5)")
    ap.add_argument("--provider-config", default=None,
                    help="JSON with provider overrides (base_url, api_version, api_key_env, ...); never keys")
    ap.add_argument("--prices", default=None, help="price table JSON for estimates (default harness/prices.json)")
    ap.add_argument("--yes", action="store_true", help="skip the cost confirmation for real providers")
    ap.add_argument("--skip-schema", action="store_true",
                    help="do not validate items against bench/schema.json (cross-field checks still run)")
    ap.add_argument("--no-score", action="store_true", help="with --judge: judge but do not score")
    ap.add_argument("--bootstrap", type=int, default=2000, help="bootstrap replicates for scoring")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    items_path = resolve(args.items) if args.items else default_items_path()
    schema_path = resolve(args.schema) if args.schema else default_schema_path()
    rubric_path = resolve(args.rubric) if args.rubric else default_rubric_path()
    if not items_path.exists():
        print(f"error: items file {items_path} not found", file=sys.stderr)
        return 2
    try:
        all_items, _, rubric = load_bench(items_path, None if args.skip_schema else schema_path, rubric_path)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    cats = [c.strip().upper() for c in args.categories.split(",")] if args.categories else None
    items = select_items(all_items, cats, args.base_only, args.limit)
    specs = split_specs(args.models)
    if not specs:
        print("error: --models is empty", file=sys.stderr)
        return 2
    overrides = {k: v for k, v in {"rpm": args.rpm, "timeout": args.timeout,
                                   "max_retries": args.max_retries}.items() if v is not None}
    try:
        pconf = load_provider_config(args.provider_config)
        providers = [make_provider(s, pconf, overrides=overrides) for s in specs]
        judge_provider = make_provider(args.judge, pconf, overrides=overrides) if args.judge else None
    except (ValueError, ConfigError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    params = build_params(args)
    prices = cost.load_prices(args.prices)
    est = cost.estimate(items, specs, args.judge, prices, args.max_tokens,
                        reasoning={p.spec for p in providers if p.is_reasoning()})
    n_var = sum(1 for it in items if it.is_variant)
    ihash = items_hash(items_path)
    plan = [f"KLAA harness {__version__}",
            f"items: {len(items)} selected ({len(items) - n_var} base, {n_var} variants) of {len(all_items)} in "
            f"{rel(items_path)} (sha256 {ihash[:16]}...)",
            "by category: " + ", ".join(f"{c} {n}" for c, n in sorted(Counter(i.category for i in items).items())),
            f"models: {', '.join(specs)}",
            f"judge: {args.judge or '(none; run harness.judge later)'}",
            f"settings: temperature={args.temperature} max_tokens={args.max_tokens} seed={args.seed} "
            f"(seed is ignored by providers without seed support, e.g. Anthropic)",
            f"calls: {len(items) * len(specs):,} model calls"
            + (f" + {len(items) * len(specs):,} judge calls" if args.judge else "")]
    real = [p for p in providers + ([judge_provider] if judge_provider else []) if not is_mock(p.spec)]
    miss = missing_keys(real)
    if args.dry_run:
        print("\n".join(plan))
        print("\nDRY RUN: no API calls were made.\n")
        print(cost.format_estimate(est))
        if miss:
            print("\nMissing API keys (set these environment variables before a real run): " + "; ".join(miss))
        return 0

    if miss:
        print("error: missing API keys: " + "; ".join(miss) + ". Keys are read from environment variables only.",
              file=sys.stderr)
        return 2
    print("\n".join(plan))
    if real and not args.yes:
        print("\n" + cost.format_estimate(est))
        if not confirm("\nThis will call real model APIs and may cost money. Proceed? [y/N] "):
            print("aborted (use --yes to skip this confirmation in scripts)", file=sys.stderr)
            return 1

    # --out is relative to the current directory; the default is results/run-<timestamp> in the audit folder.
    out_dir = pathlib.Path(args.out) if args.out else RESULTS_DIR / f"run-{time.strftime('%Y%m%d-%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / MANIFEST
    if manifest_path.exists() and not args.resume:
        print(f"error: {out_dir} already holds a run. Use --resume to continue it, or choose a new --out.",
              file=sys.stderr)
        return 2
    manifest = load_manifest(out_dir) if manifest_path.exists() else {}
    if manifest and manifest.get("items_sha256") != ihash:
        print("warning: the items file changed since this run started; changed items will be re-run "
              "(responses are keyed by item id, model, settings and prompt hash)", file=sys.stderr)
    rubric_info = {}
    if rubric is not None:
        rubric_info = {"rubric_file": rel(rubric_path), "rubric_version": rubric.get("version"),
                       "rubric_sha256": file_json_hash(rubric_path)}
    manifest.update({
        "run_id": out_dir.name, "harness_version": __version__, "python": platform.python_version(),
        "created": manifest.get("created", now_iso()), "updated": now_iso(),
        "items_file": rel(items_path), "items_sha256": ihash, "items_file_sha256_raw": raw_file_hash(items_path),
        "items_total": len(all_items),
        "selected_items": [it.id for it in items] if len(items) != len(all_items) else None,
        "filters": {"limit": args.limit, "categories": cats, "base_only": args.base_only},
        **rubric_info,
        "params": params,
        "models": [{"spec": p.spec, "settings_hash": settings_hash(p, params), "settings": p.settings_fingerprint(),
                    "params": p.effective_params(params), "mock": is_mock(p.spec)} for p in providers],
        "demo": any(is_mock(p.spec) for p in providers),
        "all_mock": all(is_mock(p.spec) for p in providers),
        "judge": args.judge or manifest.get("judge"),
        "estimate_usd": est["total_cost_usd"],
    })
    save_manifest(out_dir, manifest)
    print(f"\nwriting {rel(out_dir / RESPONSES)}")
    try:
        counts = run_responses(items, providers, params, out_dir, resume=args.resume,
                               concurrency=args.concurrency)
    except ConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\ninterrupted; completed responses are saved. Rerun with --resume to continue.", file=sys.stderr)
        return 130
    manifest.update({"updated": now_iso(), "last_counts": counts})
    save_manifest(out_dir, manifest)
    print(f"responses: {counts}")
    if counts.get("error"):
        print(f"{counts['error']} call(s) failed; rerun with --resume to retry them.", file=sys.stderr)
    if judge_provider is not None:
        from . import judge as judge_mod
        jc = judge_mod.run_judging(out_dir, judge_provider, items_path=items_path, rubric_path=rubric_path,
                                   resume=True, concurrency=args.concurrency)
        print(f"judgments: {jc}")
        if not args.no_score:
            from . import score as score_mod
            res = score_mod.score_run(out_dir, bootstrap=args.bootstrap)
            print(f"scores: {rel(out_dir / 'scores.json')}, report: {rel(out_dir / 'report.md')}")
            print(score_mod.summary_table(res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
