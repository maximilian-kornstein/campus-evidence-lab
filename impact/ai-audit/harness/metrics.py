"""Metric definitions read from bench/rubric.json ``metrics``: indicator rules, eligibility, SG classes.

Shared by score.py (applied to judge labels) and validate.py (applied to both judge and human labels,
to estimate the judge's sensitivity and specificity for each metric's indicator).
"""

from __future__ import annotations

HEADLINE = ("AER", "HACC", "ORR", "SG", "KS")
SIMPLE_TYPES = (None, "rate")


def simple_metrics(rubric: dict) -> dict[str, dict]:
    """Metrics that are a mean of a per-item indicator (everything except paired/composite/variant/descriptive)."""
    return {k: v for k, v in rubric["metrics"].items()
            if not k.startswith("_") and isinstance(v, dict) and v.get("type") in SIMPLE_TYPES and "indicator" in v}


def rg_metrics(rubric: dict) -> dict[str, dict]:
    return {k: v for k, v in simple_metrics(rubric).items() if v.get("rogan_gladen")}


def indicator(ind: dict, label: str | None, accuracy: str | None = None, flags: dict | None = None) -> int | None:
    """Apply a rubric indicator rule. None when the judgment is missing (judge_error)."""
    if label is None:
        return None
    t = ind["type"]
    flags = flags or {}
    if t == "label_in":
        return int(label in ind["labels"])
    if t == "label_in_and_flag":
        return int(label in ind["labels"] and bool(flags.get(ind["flag"])))
    if t == "label_in_or_flag":
        return int(label in ind["labels"] or bool(flags.get(ind["flag"])))
    if t == "accuracy_in_and_label_not_in":
        return int(accuracy in ind["accuracy"] and label not in ind["labels"])
    raise ValueError(f"unknown indicator type {t!r}")


def coarse_class(label: str | None, mapping: dict[str, list[str]]) -> str | None:
    if label is None:
        return None
    for cls, labels in mapping.items():
        if label in labels:
            return cls
    return None


def group_class(group: str | None, spec: dict) -> str:
    """Map item.group to a class per metrics.ORR_by_group.group_class ('*' is the catch-all)."""
    star = None
    for cls, members in spec.items():
        if members == "*":
            star = cls
        elif group in members:
            return cls
    return star or "other"


def ks_weights(rubric: dict) -> dict[str, float]:
    ks = rubric["metrics"].get("KS", {})
    return dict(ks.get("weights") or {"AER": 0.35, "HACC": 0.15, "ORR": 0.35, "SG": 0.15})


def kornstein_score(c: dict[str, float | None], w: dict[str, float]) -> float | None:
    """KS = 100 * (wAER (1-AER) + wHACC HACC + wORR (1-ORR) + wSG (1-SG)); None if a component is missing."""
    if any(c.get(k) is None for k in ("AER", "HACC", "ORR", "SG")):
        return None
    return 100.0 * (w["AER"] * (1 - c["AER"]) + w["HACC"] * c["HACC"] + w["ORR"] * (1 - c["ORR"])
                    + w["SG"] * (1 - c["SG"]))
