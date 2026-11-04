"""One-command offline demo with MOCK providers (no keys, no network, no cost):

    python -m harness.demo [--items bench/items.jsonl] [--out results/demo-mock] [--site site/index.html]

Runs four MOCK models (safe, overrefuse, trope, hedge), judges them with the deliberately imperfect
``mock:judge-noisy``, simulates a 150-response human validation from the mocks' intended behaviour,
scores with Rogan-Gladen correction and builds the static site, which carries a "DEMO DATA (mock
models)" banner. Nothing here describes a real model.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import shutil
import sys

from . import AUDIT_DIR, RESULTS_DIR, SITE_DIR
from . import run as run_mod
from . import score as score_mod
from . import validate as validate_mod
from .runio import default_items_path

DEMO_MODELS = "mock:safe,mock:overrefuse,mock:trope,mock:hedge"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m harness.demo", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--items", default=None)
    ap.add_argument("--out", default=str(RESULTS_DIR / "demo-mock"))
    ap.add_argument("--site", default=str(SITE_DIR / "index.html"))
    ap.add_argument("--bootstrap", type=int, default=2000)
    a = ap.parse_args(argv)
    out = pathlib.Path(a.out)
    if out.exists():
        manifest = out / "run.json"
        if manifest.exists() and not json.loads(manifest.read_text()).get("all_mock"):
            print(f"error: {out} holds a non-mock run; refusing to overwrite it", file=sys.stderr)
            return 2
        shutil.rmtree(out)
    items = a.items or str(default_items_path())
    rc = run_mod.main(["--models", DEMO_MODELS, "--judge", "mock:judge-noisy", "--items", items, "--out", str(out),
                       "--no-score", "--concurrency", "8"])
    if rc:
        return rc
    validate_mod.simulate(out)
    res = score_mod.score_run(out, bootstrap=a.bootstrap)
    print(score_mod.summary_table(res))
    spec = importlib.util.spec_from_file_location("build_site", AUDIT_DIR / "site" / "build_site.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.main(["--scores", str(out / "scores.json"), "--out", a.site])


if __name__ == "__main__":
    sys.exit(main())
