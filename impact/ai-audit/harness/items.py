"""Loading bench items (bench/schema.json, version 1.1.0) and the rubric.

One JSONL line is one conversation. Robustness variants (paraphrase, system-persona, pressure) are
their own items with ``variant_of`` pointing at a base item; headline metrics use base items and the
variants feed the robustness analysis. Multi-turn items carry SCRIPTED assistant turns and are sent
as is: the model under test only produces the reply to the final user turn.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import re
from dataclasses import dataclass, field
from typing import Any

CATEGORIES = ("HF", "ST", "CT", "CR", "LC", "JK", "SY", "CO")
CATEGORY_NAMES = {
    "HF": "Holocaust facts",
    "ST": "Stereotype endorsement",
    "CT": "Conspiracy tropes",
    "CR": "Collective responsibility",
    "LC": "Legitimate criticism (control)",
    "JK": "Jewish knowledge & culture (control)",
    "SY": "Symmetry probes (other groups)",
    "CO": "Contested (descriptive only)",
}
TROPE_CATEGORIES = ("ST", "CT", "CR")


@dataclass
class Item:
    id: str
    category: str
    rubric_key: str
    messages: list[dict]
    system: str | None
    expected_behavior: str
    scored: bool
    framing: str = "none"
    variant_of: str | None = None
    variant_type: str | None = None
    target_claim: str | None = None
    accuracy_key: dict | None = None
    mirror_of: str | None = None
    group: str | None = None
    tags: list[str] = field(default_factory=list)
    definitions: dict = field(default_factory=dict)
    raw: dict = field(default_factory=dict)

    @property
    def base_id(self) -> str:
        return self.variant_of or self.id

    @property
    def is_variant(self) -> bool:
        return self.variant_of is not None

    @property
    def denial_bait(self) -> bool:
        return self.rubric_key == "HF.denial_bait"

    @property
    def final_prompt(self) -> str:
        return self.messages[-1]["content"]

    def prompt_hash(self) -> str:
        blob = json.dumps({"system": self.system, "messages": self.messages}, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]

    def prompt_chars(self) -> int:
        return len(self.system or "") + sum(len(m["content"]) for m in self.messages)

    def meta(self) -> dict:
        """Item metadata for the MOCK provider (never sent to a real model API)."""
        key = self.accuracy_key or {}
        reject = key.get("reject") or []
        return {"item_id": self.id, "category": self.category, "rubric_key": self.rubric_key,
                "denial_bait": self.denial_bait, "group": self.group,
                "target_is_jewish": self.category in TROPE_CATEGORIES or self.category == "HF",
                "answer": key.get("canonical") if self.rubric_key in ("HF.fact", "JK.fact") else None,
                "wrong_answer": reject[0] if reject else None, "variant_type": self.variant_type}


def item_from_raw(raw: dict) -> Item:
    if "turns" in raw:
        messages = [{"role": t["role"], "content": t["content"]} for t in raw["turns"]]
    else:
        messages = [{"role": "user", "content": raw["prompt"]}]
    return Item(
        id=raw["id"], category=raw["category"], rubric_key=raw["rubric_key"], messages=messages,
        system=raw.get("system"), expected_behavior=raw.get("expected_behavior", ""),
        scored=bool(raw.get("scored", False)), framing=raw.get("framing", "none"),
        variant_of=raw.get("variant_of"), variant_type=raw.get("variant_type"),
        target_claim=raw.get("target_claim"), accuracy_key=raw.get("accuracy_key"),
        mirror_of=raw.get("mirror_of"), group=raw.get("group"), tags=list(raw.get("tags") or []),
        definitions=raw.get("definitions") or {}, raw=raw)


def read_jsonl(path: str | pathlib.Path) -> list[dict]:
    out = []
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{n}: invalid JSON ({e})") from e
    return out


def load_json(path: str | pathlib.Path) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_items(path: str | pathlib.Path, schema: dict | None = None, rubric: dict | None = None,
               strict: bool = True) -> list[Item]:
    """Load and check items. With ``schema`` every record is validated against it; cross-field rules
    from the schema description are always checked. Raises ValueError listing the problems."""
    raws = read_jsonl(path)
    problems: list[str] = []
    if schema is not None:
        for r in raws:
            problems += validate_against_schema(r, schema)
    problems += cross_field_problems(raws, rubric)
    if problems and strict:
        head = "\n  ".join(problems[:25])
        more = f"\n  ... and {len(problems) - 25} more" if len(problems) > 25 else ""
        raise ValueError(f"{path}: {len(problems)} item problem(s):\n  {head}{more}")
    return [item_from_raw(r) for r in raws]


def cross_field_problems(raws: list[dict], rubric: dict | None = None) -> list[str]:
    problems = []
    ids = [r.get("id") for r in raws]
    seen = set()
    for i in ids:
        if i in seen:
            problems.append(f"{i}: duplicate id")
        seen.add(i)
    by_id = {r.get("id"): r for r in raws}
    rubric_keys = set((rubric or {}).get("rubrics", {}).keys())
    for r in raws:
        rid = r.get("id")
        turns = r.get("turns")
        if turns:
            roles = [t.get("role") for t in turns]
            if roles[-1] != "user" or roles[0] != "user":
                problems.append(f"{rid}: turns must start and end with a user turn")
            if any(a == b for a, b in zip(roles, roles[1:])):
                problems.append(f"{rid}: turns must alternate user/assistant")
        v = r.get("variant_of")
        if v and (v not in by_id or by_id[v].get("variant_of")):
            problems.append(f"{rid}: variant_of {v} is not a base item in the file")
        if v and by_id.get(v, {}).get("category") not in (None, r.get("category")):
            problems.append(f"{rid}: variant category differs from base {v}")
        m = r.get("mirror_of")
        if m and m not in by_id:
            problems.append(f"{rid}: mirror_of {m} not found")
        if rubric_keys and r.get("rubric_key") not in rubric_keys:
            problems.append(f"{rid}: rubric_key {r.get('rubric_key')} not in rubric.json")
    return problems


# --------------------------------------------------------------------------------------------------
# A JSON Schema (draft 2020-12) subset validator, sufficient for bench/schema.json, stdlib only:
# type, enum, const, required, properties, additionalProperties, items, minItems, minLength, pattern,
# uniqueItems, allOf, anyOf, oneOf, not, if/then/else.
# --------------------------------------------------------------------------------------------------

def validate_against_schema(x: Any, schema: dict, path: str | None = None) -> list[str]:
    if path is None:
        path = x.get("id", "item") if isinstance(x, dict) else "item"
    return _errors(x, schema, path)


def _errors(x: Any, s: Any, path: str) -> list[str]:
    if not isinstance(s, dict):
        return []
    errs: list[str] = []
    t = s.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        if not any(_is_type(x, tt) for tt in types):
            return [f"{path}: expected {t}, got {type(x).__name__}"]
    if "enum" in s and x not in s["enum"]:
        errs.append(f"{path}: {x!r} is not one of {s['enum']}")
    if "const" in s and x != s["const"]:
        errs.append(f"{path}: must be {s['const']!r}")
    if isinstance(x, str):
        if "minLength" in s and len(x) < s["minLength"]:
            errs.append(f"{path}: shorter than {s['minLength']} characters")
        if "pattern" in s and not re.search(s["pattern"], x):
            errs.append(f"{path}: {x!r} does not match {s['pattern']}")
    if isinstance(x, list):
        if "minItems" in s and len(x) < s["minItems"]:
            errs.append(f"{path}: fewer than {s['minItems']} entries")
        if s.get("uniqueItems"):
            canon = [json.dumps(v, sort_keys=True) for v in x]
            if len(set(canon)) != len(canon):
                errs.append(f"{path}: entries are not unique")
        if isinstance(s.get("items"), dict):
            for i, v in enumerate(x):
                errs += _errors(v, s["items"], f"{path}[{i}]")
    if isinstance(x, dict):
        for r in s.get("required", []):
            if r not in x:
                errs.append(f"{path}: missing required field {r!r}")
        props = s.get("properties", {})
        for k, v in x.items():
            if k in props:
                errs += _errors(v, props[k], f"{path}.{k}")
            elif s.get("additionalProperties") is False:
                errs.append(f"{path}: unexpected field {k!r}")
    for sub in s.get("allOf", []):
        errs += _errors(x, sub, path)
    if "anyOf" in s and not any(not _errors(x, sub, path) for sub in s["anyOf"]):
        errs.append(f"{path}: matches none of anyOf")
    if "oneOf" in s:
        n = sum(1 for sub in s["oneOf"] if not _errors(x, sub, path))
        if n != 1:
            errs.append(f"{path}: must match exactly one of oneOf (matched {n})")
    if "not" in s and not _errors(x, s["not"], path):
        errs.append(f"{path}: matches a forbidden form")
    if "if" in s:
        if not _errors(x, s["if"], path):
            if "then" in s:
                errs += [e + (f" ({s['description']})" if s.get("description") else "")
                         for e in _errors(x, s["then"], path)]
        elif "else" in s:
            errs += _errors(x, s["else"], path)
    return errs


def _is_type(x, t) -> bool:
    return {
        "object": isinstance(x, dict), "array": isinstance(x, list), "string": isinstance(x, str),
        "integer": isinstance(x, int) and not isinstance(x, bool),
        "number": isinstance(x, (int, float)) and not isinstance(x, bool),
        "boolean": isinstance(x, bool), "null": x is None,
    }.get(t, True)
