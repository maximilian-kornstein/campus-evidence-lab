"""Human validation of the LLM judge.

    # 1. Export a stratified, blinded sample (default 150) as a CSV and a self-contained HTML form
    python -m harness.validate export --run results/<run-id> [--n 150]

    # 2. Label: open results/<run-id>/validation/label_form.html in a browser (works offline), label
    #    each response, then click "Export CSV". (Or fill the CSV's human_label / human_accuracy columns.)

    # 3. Import the labels: per-category judge sensitivity/specificity with Wilson intervals,
    #    written to results/<run-id>/validation.json; harness.score then applies Rogan-Gladen.
    python -m harness.validate import --run results/<run-id> --labels path/to/labels.csv

    # Demo only: fake "human" labels from the MOCK models' intended behaviour
    python -m harness.validate simulate --run results/demo-mock

Sampling design: the population is every judged response to a scored item (base and variants, all
models). Strata are (category x judge label). Each category gets an equal share of the sample; within
a category every non-empty stratum gets at least min(3, stratum size), so rare labels such as
"endorse" are over-sampled, and the rest is allocated in proportion to stratum size. Inclusion
probabilities are recorded, and Se/Sp are estimated with inverse-probability weights, so they refer to
the whole population of responses rather than to the over-sampled sample. Wilson intervals use the
Kish effective sample size. The labeller sees neither the model's name nor the judge's label.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import pathlib
import random
import sys
from collections import Counter, defaultdict

from .items import CATEGORY_NAMES, load_items, load_json
from .judge import ACCURACY, LABELS, load_judgments, render_conversation
from .metrics import indicator, rg_metrics
from .runio import (RESPONSES, VALIDATION, latest_by, load_manifest, now_iso, read_records, rel, resolve,
                    write_json)
from .stats import wilson

SAMPLE_DIR = "validation"
DEFAULT_N = 150
MIN_PER_STRATUM = 3
CSV_FIELDS = ["sample_id", "category", "rubric_key", "item_id", "human_label", "human_accuracy", "notes"]


def _run_context(run_dir: pathlib.Path):
    manifest = load_manifest(run_dir)
    rubric = load_json(resolve(manifest["rubric_file"]))
    items = {it.id: it for it in load_items(resolve(manifest["items_file"]), strict=False)}
    judgments = load_judgments(run_dir, manifest)
    responses = latest_by(read_records(run_dir / RESPONSES), "response_id")
    return manifest, rubric, items, judgments, responses


def allocate(strata_sizes: dict, n_total: int) -> dict:
    """Allocation per stratum {(cat, label): size}: equal per category, min per stratum, rest proportional."""
    cats = sorted({c for c, _ in strata_sizes})
    if not cats:
        return {}
    alloc = {}
    budget_left = n_total
    for ci, cat in enumerate(cats):
        budget = round(budget_left / (len(cats) - ci))
        sizes = {k: v for k, v in strata_sizes.items() if k[0] == cat and v > 0}
        total = sum(sizes.values())
        budget = min(budget, total)
        # Minimums first, one unit at a time, smallest strata first, never beyond the category budget.
        a = {k: 0 for k in sizes}
        order = sorted(sizes, key=lambda k: (sizes[k], k))
        given = 0
        for _round in range(MIN_PER_STRATUM):
            for k in order:
                if given < budget and a[k] < min(MIN_PER_STRATUM, sizes[k]):
                    a[k] += 1
                    given += 1
        rest = budget - sum(a.values())
        if rest > 0:
            room = {k: sizes[k] - a[k] for k in sizes}
            room_total = sum(room.values())
            if room_total:
                shares = {k: rest * room[k] / room_total for k in sizes}
                for k in sizes:
                    a[k] += min(room[k], int(math.floor(shares[k])))
                # hand out the remainder by largest fractional part
                left = budget - sum(a.values())
                for k in sorted(sizes, key=lambda k: -(shares[k] - math.floor(shares[k]))):
                    if left <= 0:
                        break
                    if a[k] < sizes[k]:
                        a[k] += 1
                        left -= 1
        alloc.update(a)
        budget_left -= sum(a.values())
    return alloc


def draw_sample(judgments: list[dict], items: dict, n: int, seed: int) -> list[dict]:
    pop = [j for j in judgments if not j.get("judge_error") and j["item_id"] in items
           and items[j["item_id"]].scored and j["category"] != "CO"]
    strata = defaultdict(list)
    for j in sorted(pop, key=lambda j: j["response_id"]):
        strata[(j["category"], j["label"])].append(j)
    alloc = allocate({k: len(v) for k, v in strata.items()}, n)
    rng = random.Random(seed)
    sample = []
    for key in sorted(strata):
        k = alloc.get(key, 0)
        if not k:
            continue
        chosen = rng.sample(strata[key], k)
        pi = k / len(strata[key])
        for j in chosen:
            sample.append({"judgment": j, "stratum": f"{key[0]}|{key[1]}", "stratum_size": len(strata[key]),
                           "n_sampled": k, "inclusion_prob": pi, "weight": 1 / pi})
    rng.shuffle(sample)  # present in random order so strata are not visible from position
    for i, s in enumerate(sample, 1):
        s["sample_id"] = f"V{i:03d}"
    return sample


def export(run_dir: pathlib.Path, n: int = DEFAULT_N, seed: int = 7, log=print) -> dict:
    manifest, rubric, items, judgments, responses = _run_context(run_dir)
    sample = draw_sample(judgments, items, n, seed)
    if not sample:
        raise ValueError("no judged responses to sample; run harness.judge first")
    out = run_dir / SAMPLE_DIR
    out.mkdir(parents=True, exist_ok=True)
    rows, key = [], {}
    for s in sample:
        j = s["judgment"]
        it = items[j["item_id"]]
        resp = responses[j["response_id"]]
        rows.append({"sample_id": s["sample_id"], "category": it.category, "rubric_key": it.rubric_key,
                     "item_id": it.id, "conversation": render_conversation(it), "response": resp.get("text") or "",
                     "target_claim": it.target_claim or "", "expected_behavior": it.expected_behavior,
                     "accuracy_key": it.accuracy_key or None})
        key[s["sample_id"]] = {"response_id": j["response_id"], "model": j["model"], "item_id": it.id,
                               "stratum": s["stratum"], "stratum_size": s["stratum_size"],
                               "n_sampled": s["n_sampled"], "inclusion_prob": s["inclusion_prob"],
                               "weight": s["weight"], "response_sha": j["response_sha"]}
    with open(out / "sample.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS + ["target_claim", "expected_behavior", "accuracy_key",
                                                        "conversation", "response"])
        w.writeheader()
        for r in rows:
            w.writerow({**{k: r.get(k, "") for k in CSV_FIELDS}, "target_claim": r["target_claim"],
                        "expected_behavior": r["expected_behavior"],
                        "accuracy_key": json.dumps(r["accuracy_key"], ensure_ascii=False) if r["accuracy_key"] else "",
                        "conversation": r["conversation"], "response": r["response"]})
    write_json(out / "sample_key.json", {"created": now_iso(), "run_id": manifest.get("run_id"), "seed": seed,
                                         "n": len(sample), "design": "category x judge-label strata; IPW",
                                         "judge": manifest.get("judge"), "samples": key})
    (out / "label_form.html").write_text(render_form(rows, rubric, manifest), encoding="utf-8")
    strata = Counter(s["stratum"] for s in sample)
    pop_strata = {(j["category"], j["label"]) for j in judgments if not j.get("judge_error")
                  and j["item_id"] in items and items[j["item_id"]].scored and j["category"] != "CO"}
    unsampled = len(pop_strata) - len(strata)
    if unsampled > 0:
        log(f"warning: {unsampled} stratum/strata got no sample at n={n}; Se/Sp ignore those responses. "
            "Use a larger --n (150 recommended).")
    log(f"exported {len(sample)} responses to {rel(out)}/ (sample.csv, label_form.html, sample_key.json)")
    log("strata: " + ", ".join(f"{k} {v}" for k, v in sorted(strata.items())))
    log("Keep sample_key.json away from labellers: it holds the model names and strata.")
    return {"n": len(sample), "dir": str(out)}


def _norm_label(v: str) -> str | None:
    v = (v or "").strip().lower().replace("-", "_").replace(" ", "_")
    v = {"legitimize_hedge": "legitimise_hedge", "hedge": "legitimise_hedge", "reject": "reject_correct",
         "offtopic": "off_topic"}.get(v, v)
    return v if v in LABELS else None


def _norm_acc(v: str) -> str | None:
    v = (v or "").strip().lower().replace("-", "_").replace(" ", "_")
    v = {"partial": "partially_correct", "na": "not_applicable", "n/a": "not_applicable"}.get(v, v)
    return v if v in ACCURACY else None


def read_labels(path: pathlib.Path) -> dict[str, dict]:
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            sid = (row.get("sample_id") or "").strip()
            lab = _norm_label(row.get("human_label", ""))
            if not sid or lab is None:
                continue
            out[sid] = {"label": lab, "accuracy": _norm_acc(row.get("human_accuracy", "")),
                        "notes": row.get("notes", "")}
    return out


def _weighted_rate(pairs: list[tuple[float, int, int]], cls: int) -> dict:
    """pairs = [(weight, human, judge)]. Se (cls=1): P_w(J=1 | H=1); Sp (cls=0): P_w(J=0 | H=0)."""
    sub = [(w, j) for w, h, j in pairs if h == cls]
    n = len(sub)
    if not n:
        return {"rate": None, "n": 0, "n_eff": 0.0, "ci": [None, None]}
    sw = sum(w for w, _ in sub)
    hit = sum(w for w, j in sub if j == cls)
    rate = hit / sw
    n_eff = sw * sw / sum(w * w for w, _ in sub)
    lo, hi = wilson(rate * n_eff, n_eff) if n_eff > 0 else (None, None)
    return {"rate": rate, "n": n, "n_eff": n_eff, "ci": [lo, hi], "unweighted": sum(1 for _, j in sub if j == cls) / n}


def _se_sp(pairs) -> dict:
    se, sp = _weighted_rate(pairs, 1), _weighted_rate(pairs, 0)
    return {"se": se["rate"], "sp": sp["rate"], "se_ci": se["ci"], "sp_ci": sp["ci"],
            "n_pos": se["n"], "n_neg": sp["n"], "n_pos_eff": se["n_eff"], "n_neg_eff": sp["n_eff"],
            "se_unweighted": se.get("unweighted"), "sp_unweighted": sp.get("unweighted"), "n": len(pairs)}


def kappa(pairs: list[tuple[str, str]]) -> float | None:
    if not pairs:
        return None
    n = len(pairs)
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return None if pe == 1 else (po - pe) / (1 - pe)


def import_labels(run_dir: pathlib.Path, labels_path: pathlib.Path, simulated: bool = False, log=print) -> dict:
    manifest, rubric, items, judgments, responses = _run_context(run_dir)
    key = load_json(run_dir / SAMPLE_DIR / "sample_key.json")["samples"]
    labels = read_labels(labels_path)
    jby = {j["response_id"]: j for j in judgments}
    rows, stale = [], 0
    for sid, lab in labels.items():
        k = key.get(sid)
        if k is None:
            continue
        j = jby.get(k["response_id"])
        if j is None or j.get("response_sha") != k.get("response_sha"):
            stale += 1
            continue
        rows.append((sid, k, j, lab, items[k["item_id"]]))
    if not rows:
        raise ValueError(f"no usable labels in {labels_path} (did you fill human_label?)")
    per_metric = {}
    for code, spec in rg_metrics(rubric).items():
        keys = set(spec["rubric_keys"])
        by_cat = defaultdict(list)
        for sid, k, j, lab, it in rows:
            if it.rubric_key not in keys:
                continue
            if spec["indicator"]["type"].startswith("accuracy") and lab["accuracy"] is None and it.accuracy_key:
                continue  # accuracy not labelled
            h = indicator(spec["indicator"], lab["label"], lab["accuracy"] or "not_applicable", {})
            jj = indicator(spec["indicator"], j["label"], j.get("accuracy"), j.get("flags"))
            by_cat[it.category].append((k["weight"], h, jj))
        if not by_cat:
            continue
        per_metric[code] = {"name": spec.get("name"),
                            "by_category": {c: _se_sp(v) for c, v in sorted(by_cat.items())},
                            "pooled": _se_sp([x for v in by_cat.values() for x in v])}
    agree = [(lab["label"], j["label"]) for _, _, j, lab, _ in rows]
    by_cat_agree = defaultdict(list)
    for _, _, j, lab, it in rows:
        by_cat_agree[it.category].append((lab["label"], j["label"]))
    confusion = Counter(f"{h}->{jl}" for h, jl in agree)
    res = {"created": now_iso(), "run_id": manifest.get("run_id"), "judge": manifest.get("judge"),
           "labels_file": rel(labels_path), "simulated": simulated, "n_labels": len(rows), "stale_labels": stale,
           "design": "stratified by category x judge label; inverse-probability weighted Se/Sp; Wilson CIs on "
                     "Kish effective n",
           "label_agreement": {"overall": sum(a == b for a, b in agree) / len(agree), "kappa": kappa(agree),
                               "by_category": {c: {"n": len(v), "agreement": sum(a == b for a, b in v) / len(v),
                                                   "kappa": kappa(v)} for c, v in sorted(by_cat_agree.items())},
                               "confusion_human_to_judge": dict(confusion)},
           "per_metric": per_metric}
    write_json(run_dir / VALIDATION, res)
    log(f"imported {len(rows)} labels ({stale} stale skipped); label agreement {res['label_agreement']['overall']:.1%}, "
        f"kappa {res['label_agreement']['kappa'] if res['label_agreement']['kappa'] is None else round(res['label_agreement']['kappa'], 3)}")
    log(format_validation(res))
    log(f"wrote {run_dir / VALIDATION}; rerun harness.score to apply the Rogan-Gladen correction")
    return res


def format_validation(res: dict) -> str:
    def f(x):
        return "  n/a" if x is None else f"{x:5.2f}"

    def ci(c):
        return "" if not c or c[0] is None else f" [{c[0]:.2f},{c[1]:.2f}]"
    lines = [f"{'metric':10} {'cat':6} {'Se':>5} {'95% CI':14} {'n+':>4} {'Sp':>5} {'95% CI':14} {'n-':>4}"]
    for code, v in res["per_metric"].items():
        for cat, e in list(v["by_category"].items()) + [("pooled", v["pooled"])]:
            lines.append(f"{code:10} {cat:6} {f(e['se'])} {ci(e['se_ci']):14} {e['n_pos']:>4} {f(e['sp'])} "
                         f"{ci(e['sp_ci']):14} {e['n_neg']:>4}")
    return "\n".join(lines)


def simulate(run_dir: pathlib.Path, n: int = DEFAULT_N, seed: int = 7, log=print) -> dict:
    """DEMO ONLY: label the exported sample from the MOCK models' intended behaviour."""
    manifest = load_manifest(run_dir)
    if not manifest.get("all_mock"):
        raise ValueError("simulate is for MOCK demo runs only; real runs need human labels")
    if not (run_dir / SAMPLE_DIR / "sample_key.json").exists():
        export(run_dir, n, seed, log)
    key = load_json(run_dir / SAMPLE_DIR / "sample_key.json")["samples"]
    _, _, items, _, responses = _run_context(run_dir)
    path = run_dir / SAMPLE_DIR / "labels.simulated.csv"
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        w.writeheader()
        for sid, k in sorted(key.items()):
            r = responses[k["response_id"]]
            it = items[k["item_id"]]
            intended = (r.get("raw_meta") or {}).get("mock_intended") or "neutral"
            label = intended if intended in LABELS else "neutral"
            if not it.accuracy_key:
                acc = "not_applicable"
            else:
                acc = "correct" if intended in ("correct", "reject_correct") else "incorrect"
            w.writerow({"sample_id": sid, "category": it.category, "rubric_key": it.rubric_key, "item_id": it.id,
                        "human_label": label, "human_accuracy": acc, "notes": "SIMULATED (mock demo)"})
    return import_labels(run_dir, path, simulated=True, log=log)


# --------------------------------------------------------------------------------------------------
# The self-contained labelling form
# --------------------------------------------------------------------------------------------------

FORM_CSS = """
:root{--bg:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6b6a66;--line:#e1e0d9;--accent:#1c5cab;
--accent-ink:#fff;--warn-bg:#fff4dc;--warn-ink:#5c3d00;--focus:#2a78d6;--chip:#eef3fb}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;
--ink2:#c3c2b7;--muted:#a3a29a;--line:#2c2c2a;--accent:#86b6ef;--accent-ink:#0b0b0b;--warn-bg:#3a2c0a;--warn-ink:#ffe2a6;
--focus:#86b6ef;--chip:#1f2a3a}}
:root[data-theme="dark"]{--bg:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a3a29a;--line:#2c2c2a;
--accent:#86b6ef;--accent-ink:#0b0b0b;--warn-bg:#3a2c0a;--warn-ink:#ffe2a6;--focus:#86b6ef;--chip:#1f2a3a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,
"Segoe UI",sans-serif}main{max-width:860px;margin:0 auto;padding:16px}h1{font-size:1.5rem;margin:.5rem 0}
.note{background:var(--warn-bg);color:var(--warn-ink);padding:12px 16px;border-radius:8px}
.bar{position:sticky;top:0;background:var(--bg);padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;
border-bottom:1px solid var(--line);z-index:1}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--surface);
color:var(--ink);cursor:pointer}button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
article{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
article.done{border-left:4px solid var(--accent)}.meta{color:var(--muted);font-size:.875rem}
.chip{display:inline-block;background:var(--chip);border-radius:6px;padding:0 6px;margin-right:6px}
pre{white-space:pre-wrap;word-wrap:break-word;background:var(--bg);border:1px solid var(--line);border-radius:8px;
padding:10px;font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:420px;overflow:auto}
fieldset{border:1px solid var(--line);border-radius:8px;margin:10px 0;padding:8px 12px}legend{font-weight:600}
.opt{display:block;padding:4px 0}.gloss{color:var(--ink2);font-size:.875rem}
textarea,select{font:inherit;width:100%;padding:6px;border-radius:6px;border:1px solid var(--line);
background:var(--bg);color:var(--ink)}details{margin:8px 0}
"""

FORM_JS = r"""
const KEY='klaa-labels-'+DATA.run_id;
let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){state={}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}update()}
function update(){const n=DATA.rows.filter(r=>state[r.sample_id]&&state[r.sample_id].label).length;
document.getElementById('progress').textContent=n+' of '+DATA.rows.length+' labelled';
DATA.rows.forEach(r=>{const a=document.getElementById('a-'+r.sample_id);
if(a)a.classList.toggle('done',!!(state[r.sample_id]&&state[r.sample_id].label))})}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(){const root=document.getElementById('items');
DATA.rows.forEach((r,i)=>{const s=state[r.sample_id]||{};const g=DATA.glosses[r.rubric_key]||{};
const opts=DATA.labels.map(l=>'<label class="opt"><input type="radio" name="l-'+r.sample_id+'" value="'+l+'"'+
(s.label===l?' checked':'')+'> <b>'+l+'</b> <span class="gloss">'+esc(g[l]||'')+'</span></label>').join('');
const acc=r.accuracy_key?'<label>Accuracy against the key <select data-acc="'+r.sample_id+'"><option value="">(choose)</option>'+
DATA.accuracy.map(a=>'<option'+(s.accuracy===a?' selected':'')+'>'+a+'</option>').join('')+'</select></label>'+
'<details><summary>Accuracy key</summary><pre>'+esc(JSON.stringify(r.accuracy_key,null,1))+'</pre></details>':'';
const el=document.createElement('article');el.id='a-'+r.sample_id;
el.innerHTML='<h2 class="meta"><span class="chip">'+esc(r.sample_id)+'</span><span class="chip">'+esc(r.category)+
' &middot; '+esc(DATA.catnames[r.category]||'')+'</span><span class="chip">'+esc(r.rubric_key)+'</span> '+(i+1)+'/'+DATA.rows.length+'</h2>'+
(r.target_claim?'<p><b>Target claim:</b> '+esc(r.target_claim)+'</p>':'')+
'<p><b>Expected behaviour:</b> '+esc(r.expected_behavior)+'</p>'+
'<details><summary>Rubric instructions</summary><p class="gloss">'+esc(DATA.instructions[r.rubric_key]||'')+'</p></details>'+
'<h3>Conversation</h3><pre>'+esc(r.conversation)+'</pre><h3>Response to label</h3><pre>'+esc(r.response||'(empty)')+'</pre>'+
'<fieldset><legend>Label</legend>'+opts+'</fieldset>'+acc+
'<label>Notes (optional)<textarea rows="2" data-notes="'+r.sample_id+'">'+esc(s.notes||'')+'</textarea></label>';
root.appendChild(el)});
root.addEventListener('change',e=>{const t=e.target;let id,f,v;
if(t.name&&t.name.startsWith('l-')){id=t.name.slice(2);f='label';v=t.value}
else if(t.dataset.acc){id=t.dataset.acc;f='accuracy';v=t.value}else return;
state[id]=Object.assign({},state[id],{[f]:v});save()});
root.addEventListener('input',e=>{const t=e.target;if(t.dataset.notes){const id=t.dataset.notes;
state[id]=Object.assign({},state[id],{notes:t.value});save()}});update()}
function csvCell(s){s=String(s==null?'':s);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(){const head=['sample_id','category','rubric_key','item_id','human_label','human_accuracy','notes'];
const lines=[head.join(',')].concat(DATA.rows.map(r=>{const s=state[r.sample_id]||{};
return [r.sample_id,r.category,r.rubric_key,r.item_id,s.label||'',s.accuracy||'',(s.notes||'').replace(/[\r\n]+/g,' ')].map(csvCell).join(',')}));
const blob=new Blob([lines.join('\n')+'\n'],{type:'text/csv'});const a=document.createElement('a');
a.href=URL.createObjectURL(blob);a.download='labels-'+DATA.run_id+'.csv';document.body.appendChild(a);a.click();a.remove()}
function importCsv(file){const rd=new FileReader();rd.onload=()=>{const rows=rd.result.split(/\r?\n/).slice(1);
rows.forEach(line=>{const c=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];
if(q){if(ch=='"'&&line[i+1]=='"'){cur+='"';i++}else if(ch=='"')q=false;else cur+=ch}
else if(ch==','){c.push(cur);cur=''}else if(ch=='"')q=true;else cur+=ch}c.push(cur);
if(c[0]&&c[4])state[c[0]]={label:c[4],accuracy:c[5]||'',notes:c[6]||''}});save();location.reload()};rd.readAsText(file)}
document.getElementById('export').onclick=exportCsv;
document.getElementById('import').onchange=e=>{if(e.target.files[0])importCsv(e.target.files[0])};
render();
"""


def render_form(rows: list[dict], rubric: dict, manifest: dict) -> str:
    data = {"run_id": manifest.get("run_id", "run"), "rows": rows, "labels": list(LABELS), "accuracy": list(ACCURACY),
            "glosses": {k: v["glosses"] for k, v in rubric["rubrics"].items()},
            "instructions": {k: v["instructions"] for k, v in rubric["rubrics"].items()},
            "catnames": CATEGORY_NAMES}
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KLAA judge validation</title><style>{FORM_CSS}</style></head>
<body><main>
<h1>KLAA judge validation: label {len(rows)} responses</h1>
<p class="note"><b>Content note.</b> Some responses may contain antisemitic or other bigoted text produced by the
model under test. Take breaks. Label what the response itself asserts, using the glosses for each item's rubric.
You are not shown which model wrote a response or how the judge labelled it.</p>
<p>Your labels are saved in this browser as you go. When you are done, click <b>Export CSV</b> and run
<code>python -m harness.validate import --run results/{html.escape(str(manifest.get('run_id', 'RUN')))} --labels FILE.csv</code>.
This file works offline and sends nothing anywhere.</p>
<div class="bar" role="region" aria-label="Progress and export"><span id="progress" aria-live="polite"></span>
<button class="primary" id="export" type="button">Export CSV</button>
<label>Resume from a CSV <input type="file" id="import" accept=".csv,text/csv"></label></div>
<div id="items"></div>
</main>
<script>const DATA={blob};</script>
<script>{FORM_JS}</script>
</body></html>
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m harness.validate", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export", help="export a stratified blinded sample for human labelling")
    e.add_argument("--run", required=True)
    e.add_argument("--n", type=int, default=DEFAULT_N)
    e.add_argument("--seed", type=int, default=7)
    i = sub.add_parser("import", help="import human labels and estimate judge Se/Sp")
    i.add_argument("--run", required=True)
    i.add_argument("--labels", required=True)
    s = sub.add_parser("simulate", help="DEMO ONLY: simulated labels for an all-MOCK run")
    s.add_argument("--run", required=True)
    s.add_argument("--n", type=int, default=DEFAULT_N)
    s.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)
    run = resolve(a.run)
    try:
        if a.cmd == "export":
            export(run, a.n, a.seed)
        elif a.cmd == "import":
            import_labels(run, pathlib.Path(a.labels))
        else:
            simulate(run, a.n, a.seed)
    except (ValueError, FileNotFoundError) as ex:
        print(f"error: {ex}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
