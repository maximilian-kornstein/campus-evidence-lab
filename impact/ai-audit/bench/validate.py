#!/usr/bin/env python3
"""Validate KLAA benchmark items against bench/schema.json and bench/rubric.json.

Usage:
    python3 bench/validate.py [items.jsonl ...]      (default: bench/items.jsonl and bench/items.sample.jsonl)
    python3 bench/validate.py --builtin [...]        (force the built-in validator even if jsonschema is installed)

Standard library only. If the `jsonschema` package is installed it is used for the
schema check; otherwise a minimal built-in validator handles the subset of JSON Schema
that schema.json uses. Cross-field rules that JSON Schema cannot express are checked
afterwards. Exit status 0 = valid, 1 = errors found.
"""
import collections
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LABELS = ["endorse", "legitimise_hedge", "neutral", "reject_correct", "refuse", "off_topic"]
CORE_KEYS = {"ST.evaluate", "ST.generate", "CT.evaluate", "CT.generate", "CR.evaluate", "CR.generate", "HF.denial_bait"}


# ----------------------------------------------------------------------------
# Minimal JSON Schema (2020-12 subset) validator
# ----------------------------------------------------------------------------
def _type_ok(value, t):
    if t == "object":
        return isinstance(value, dict)
    if t == "array":
        return isinstance(value, list)
    if t == "string":
        return isinstance(value, str)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "null":
        return value is None
    return True


def builtin_errors(value, schema, path="$"):
    errs = []
    if "type" in schema and not _type_ok(value, schema["type"]):
        return [f"{path}: expected {schema['type']}"]
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{path}: {value!r} not in {schema['enum']}")
    if "const" in schema and value != schema["const"]:
        errs.append(f"{path}: {value!r} != {schema['const']!r}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errs.append(f"{path}: shorter than {schema['minLength']}")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errs.append(f"{path}: longer than {schema['maxLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append(f"{path}: {value!r} does not match {schema['pattern']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errs.append(f"{path}: fewer than {schema['minItems']} items")
        if schema.get("uniqueItems") and len({json.dumps(v, sort_keys=True) for v in value}) != len(value):
            errs.append(f"{path}: items not unique")
        if "items" in schema:
            for i, v in enumerate(value):
                errs += builtin_errors(v, schema["items"], f"{path}[{i}]")
    if isinstance(value, dict):
        for r in schema.get("required", []):
            if r not in value:
                errs.append(f"{path}: missing required '{r}'")
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                errs += builtin_errors(v, props[k], f"{path}.{k}")
            elif schema.get("additionalProperties") is False:
                errs.append(f"{path}: unexpected property '{k}'")
    if "not" in schema and not builtin_errors(value, schema["not"], path):
        errs.append(f"{path}: matches a 'not' subschema")
    if "oneOf" in schema:
        n = sum(1 for s in schema["oneOf"] if not builtin_errors(value, s, path))
        if n != 1:
            errs.append(f"{path}: matches {n} of the oneOf subschemas (need exactly 1)")
    for s in schema.get("allOf", []):
        errs += builtin_errors(value, s, path)
    if "if" in schema and not builtin_errors(value, schema["if"], path):
        if "then" in schema:
            errs += builtin_errors(value, schema["then"], path)
    return errs


def make_schema_checker(schema, force_builtin):
    if not force_builtin:
        try:
            import jsonschema  # noqa: F401
            from importlib.metadata import version
            v = jsonschema.Draft202012Validator(schema)
            return "jsonschema " + version("jsonschema"), lambda it: [
                f"$.{'.'.join(str(p) for p in e.absolute_path)}: {e.message[:200]}" for e in v.iter_errors(it)]
        except ImportError:
            pass
    return "built-in", lambda it: builtin_errors(it, schema)


# ----------------------------------------------------------------------------
# Cross-field checks
# ----------------------------------------------------------------------------
def check_rubric(rubric):
    errs = []
    rubrics = rubric.get("rubrics", {})
    for key, r in rubrics.items():
        if not key.startswith(r.get("category", "?") + "."):
            errs.append(f"rubric {key}: category mismatch")
        missing = [l for l in LABELS if l not in r.get("glosses", {})]
        if missing:
            errs.append(f"rubric {key}: missing glosses for {missing}")
        if not r.get("instructions"):
            errs.append(f"rubric {key}: no instructions")
    for name, m in rubric.get("metrics", {}).items():
        if name.startswith("_"):
            continue
        for k in m.get("rubric_keys", []):
            if k not in rubrics:
                errs.append(f"metric {name}: unknown rubric key {k}")
        ind = m.get("indicator", {})
        for l in ind.get("labels", []):
            if l not in LABELS:
                errs.append(f"metric {name}: unknown label {l}")
    ks = rubric.get("metrics", {}).get("KS", {})
    if ks and abs(sum(ks["weights"].values()) - 1.0) > 1e-9:
        errs.append("metric KS: weights do not sum to 1")
    return errs


def check_items(items, rubric_keys, full_set):
    errs = []
    byid = {}
    for it in items:
        if it.get("id") in byid:
            errs.append(f"{it.get('id')}: duplicate id")
        byid[it.get("id")] = it
    mirror_count = collections.Counter()
    for it in items:
        iid, cat, rk = it.get("id", "?"), it.get("category"), it.get("rubric_key", "")
        if rk not in rubric_keys:
            errs.append(f"{iid}: rubric_key {rk} not in rubric.json")
        if not rk.startswith(f"{cat}."):
            errs.append(f"{iid}: rubric_key {rk} does not match category {cat}")
        if not iid.startswith(f"{cat}-"):
            errs.append(f"{iid}: id prefix does not match category {cat}")
        turns = it.get("turns")
        if turns:
            roles = [t["role"] for t in turns]
            if roles[0] != "user" or roles[-1] != "user" or any(a == b for a, b in zip(roles, roles[1:])):
                errs.append(f"{iid}: turns must alternate user/assistant and start and end with user")
        d = it.get("definitions", {})
        vals = (d.get("ihra"), d.get("jda"), d.get("nexus"))
        if it.get("scored") and rk in CORE_KEYS and vals != ("antisemitic",) * 3:
            errs.append(f"{iid}: consensus-core rule violated {vals}")
        if cat == "CO" and (vals == ("antisemitic",) * 3 or vals == ("not",) * 3):
            errs.append(f"{iid}: CO item has unanimous definitions {vals}; it belongs in a scored category")
        if cat in ("LC", "JK", "SY") and vals != ("not",) * 3:
            errs.append(f"{iid}: control/symmetry item should be 'not' under all three definitions, got {vals}")
        ak = it.get("accuracy_key", {})
        rg = ak.get("range")
        if rg and rg["min"] > rg["max"]:
            errs.append(f"{iid}: accuracy range min > max")
        if "variant_of" in it:
            b = byid.get(it["variant_of"])
            if full_set and b is None:
                errs.append(f"{iid}: variant_of {it['variant_of']} not found")
            elif b is not None:
                if "variant_of" in b:
                    errs.append(f"{iid}: variant_of points to another variant")
                if b["category"] != cat or not iid.startswith(b["id"] + "-"):
                    errs.append(f"{iid}: variant id/category does not match base {b['id']}")
                if b.get("rubric_key") != rk:
                    errs.append(f"{iid}: variant rubric_key differs from base")
        if cat == "SY":
            m = byid.get(it.get("mirror_of"))
            if full_set and m is None:
                errs.append(f"{iid}: mirror_of {it.get('mirror_of')} not found")
            elif m is not None and "variant_of" in m:
                errs.append(f"{iid}: mirror_of must point to a base item")
            if "variant_of" not in it:
                mirror_count[it.get("mirror_of")] += 1
                if m is not None:
                    gen_s, gen_m = rk.endswith(".generate"), m.get("rubric_key", "").endswith(".generate")
                    if gen_s != gen_m:
                        errs.append(f"{iid}: evaluate/generate mode differs from mirrored item {m['id']}")
    for mid, n in mirror_count.items():
        if n > 1:
            errs.append(f"{mid}: has {n} base SY mirrors (max 1)")
    return errs


def canonical_sha256(items):
    """Pre-registration hash of an item set. Same algorithm as `python -m harness.items_hash`:
    each record re-serialised with sorted keys, compact separators and UTF-8, records sorted by id
    (then by canonical text), joined with newlines plus a trailing newline. Whitespace, key order
    and line order do not change it; any change to any field does."""
    lines = sorted((str(r.get("id", "")) if isinstance(r, dict) else "",
                    json.dumps(r, sort_keys=True, separators=(",", ":"), ensure_ascii=False)) for r in items)
    return hashlib.sha256("".join(c + "\n" for _, c in lines).encode("utf-8")).hexdigest()


def summarise(items):
    base = [i for i in items if "variant_of" not in i]
    var = [i for i in items if "variant_of" in i]
    c = collections.Counter(i["category"] for i in base)
    s = collections.Counter(i["category"] for i in base if i["scored"])
    lines = [f"  items: {len(items)} ({len(base)} base, {len(var)} variants)"]
    lines.append("  base by category: " + ", ".join(f"{k}={c[k]} (scored {s[k]})" for k in ["HF", "ST", "CT", "CR", "LC", "JK", "SY", "CO"] if c[k]))
    if var:
        vt = collections.Counter(i["variant_type"] for i in var)
        lines.append("  variants: " + ", ".join(f"{k}={v}" for k, v in sorted(vt.items())))
    return "\n".join(lines)


def main(argv):
    force_builtin = "--builtin" in argv
    paths = [a for a in argv if not a.startswith("--")] or [
        os.path.join(HERE, "items.jsonl"), os.path.join(HERE, "items.sample.jsonl")]
    with open(os.path.join(HERE, "schema.json"), encoding="utf-8") as f:
        schema = json.load(f)
    with open(os.path.join(HERE, "rubric.json"), encoding="utf-8") as f:
        rubric = json.load(f)
    engine, schema_errors = make_schema_checker(schema, force_builtin)
    print(f"schema validator: {engine}")
    total = 0
    rerrs = check_rubric(rubric)
    for e in rerrs:
        print("  RUBRIC", e)
    total += len(rerrs)
    for path in paths:
        if not os.path.exists(path):
            print(f"{path}: not found, skipped")
            continue
        items, errs = [], []
        with open(path, "rb") as f:
            raw = f.read()
        for n, line in enumerate(raw.decode("utf-8").splitlines(), 1):
            if not line.strip():
                continue
            try:
                it = json.loads(line)
            except json.JSONDecodeError as e:
                errs.append(f"line {n}: invalid JSON ({e})")
                continue
            items.append(it)
            errs += [f"{it.get('id', 'line ' + str(n))}: {e}" for e in schema_errors(it)]
        full_set = os.path.basename(path) == "items.jsonl"
        errs += check_items(items, set(rubric["rubrics"]), full_set)
        print(f"{os.path.relpath(path)}: {'OK' if not errs else str(len(errs)) + ' error(s)'}")
        print(summarise(items))
        print(f"  items_sha256 (canonical, for pre-registration; = harness.items_hash): {canonical_sha256(items)}")
        for e in errs[:200]:
            print("  ERROR", e)
        total += len(errs)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
