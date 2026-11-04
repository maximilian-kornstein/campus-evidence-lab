"""Run-directory I/O: manifests, append-only JSONL with a lock, latest-record views, path defaults."""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import threading

from . import AUDIT_DIR, BENCH_DIR, RESULTS_DIR

MANIFEST = "run.json"
RESPONSES = "responses.jsonl"
JUDGMENTS = "judgments.jsonl"
SCORES = "scores.json"
REPORT = "report.md"
VALIDATION = "validation.json"


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def default_items_path() -> pathlib.Path:
    full = BENCH_DIR / "items.jsonl"
    return full if full.exists() else BENCH_DIR / "items.sample.jsonl"


def default_rubric_path() -> pathlib.Path:
    return BENCH_DIR / "rubric.json"


def default_schema_path() -> pathlib.Path:
    return BENCH_DIR / "schema.json"


def rel(path: str | os.PathLike) -> str:
    """Path relative to the audit directory when possible (keeps manifests portable)."""
    p = pathlib.Path(path).resolve()
    try:
        return str(p.relative_to(AUDIT_DIR))
    except ValueError:
        return str(p)


def resolve(path: str | os.PathLike) -> pathlib.Path:
    p = pathlib.Path(path)
    if p.is_absolute() or p.exists():
        return p
    alt = AUDIT_DIR / p
    return alt if alt.exists() else p


def new_run_id(prefix: str = "run") -> str:
    return f"{prefix}-{_dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"


def default_out(run_id: str | None = None) -> pathlib.Path:
    return RESULTS_DIR / (run_id or new_run_id())


class JsonlWriter:
    """Thread-safe append-only JSONL writer that flushes every record (safe to interrupt)."""

    def __init__(self, path: pathlib.Path):
        self.path = pathlib.Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._fh = open(self.path, "a", encoding="utf-8")

    def write(self, record: dict) -> None:
        line = json.dumps(record, ensure_ascii=False, sort_keys=True)
        with self._lock:
            self._fh.write(line + "\n")
            self._fh.flush()

    def close(self) -> None:
        with self._lock:
            self._fh.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def read_records(path: pathlib.Path) -> list[dict]:
    """Read a JSONL file, skipping a truncated last line (e.g. after a crash)."""
    out = []
    if not pathlib.Path(path).exists():
        return out
    with open(path, encoding="utf-8") as fh:
        lines = fh.readlines()
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            if i == len(lines) - 1:
                continue  # partial final line from an interrupted write
            raise
    return out


def latest_by(records: list[dict], key: str, ok_only: bool = True) -> dict[str, dict]:
    """The last record per ``key`` (later lines win), optionally only status == ok."""
    out: dict[str, dict] = {}
    for r in records:
        if ok_only and r.get("status", "ok") != "ok":
            continue
        out[r[key]] = r
    return out


def load_manifest(run_dir: pathlib.Path) -> dict:
    p = pathlib.Path(run_dir) / MANIFEST
    if not p.exists():
        raise FileNotFoundError(f"{p} not found: is {run_dir} a run directory created by harness.run?")
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def save_manifest(run_dir: pathlib.Path, manifest: dict) -> None:
    p = pathlib.Path(run_dir) / MANIFEST
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False, sort_keys=False)
        fh.write("\n")
    os.replace(tmp, p)


def write_json(path: pathlib.Path, data) -> None:
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, path)
