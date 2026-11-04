"""SHA-256 of a canonicalised items file (and optionally the rubric), for pre-registration.

items_sha256 is the pre-registration hash. The raw-bytes SHA-256 (as printed by `sha256sum` and
bench/validate.py) is reported too; it changes with whitespace or line order, the canonical one does not.

Canonical form: every non-blank JSONL line is parsed and re-serialised with sorted keys, compact
separators and UTF-8 (no ASCII escaping); the records are sorted by "id" (then by their canonical
text); and the lines are joined with "\\n" plus a trailing newline. Whitespace, key order and line
order therefore do not change the hash, but any change to any field does.

    python -m harness.items_hash bench/items.jsonl [--rubric bench/rubric.json] [--json]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_items(path: str | pathlib.Path) -> str:
    records = []
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{n}: invalid JSON ({e})") from e
    lines = sorted((str(r.get("id", "")) if isinstance(r, dict) else "", canonical_json(r)) for r in records)
    return "".join(c + "\n" for _, c in lines)


def items_hash(path: str | pathlib.Path) -> str:
    return hashlib.sha256(canonical_items(path).encode("utf-8")).hexdigest()


def raw_file_hash(path: str | pathlib.Path) -> str:
    """SHA-256 of the file's exact bytes (what `sha256sum` and bench/validate.py print)."""
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def file_json_hash(path: str | pathlib.Path) -> str:
    with open(path, encoding="utf-8") as fh:
        return hashlib.sha256(canonical_json(json.load(fh)).encode("utf-8")).hexdigest()


def count_items(path: str | pathlib.Path) -> int:
    with open(path, encoding="utf-8") as fh:
        return sum(1 for line in fh if line.strip())


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("items", help="items JSONL file")
    ap.add_argument("--rubric", help="rubric JSON to hash as well")
    ap.add_argument("--json", action="store_true", help="print machine-readable JSON")
    a = ap.parse_args(argv)
    out = {"items_file": str(a.items), "items_count": count_items(a.items),
           "items_sha256": items_hash(a.items), "items_file_sha256_raw_bytes": raw_file_hash(a.items)}
    if a.rubric:
        out["rubric_file"] = str(a.rubric)
        out["rubric_sha256"] = file_json_hash(a.rubric)
        out["rubric_file_sha256_raw_bytes"] = raw_file_hash(a.rubric)
        try:
            r = json.load(open(a.rubric, encoding="utf-8"))
            out["rubric_version"] = r.get("rubric_version") or r.get("version")
        except Exception:  # noqa: BLE001
            pass
    if a.json:
        print(json.dumps(out, indent=2))
    else:
        for k, v in out.items():
            print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
