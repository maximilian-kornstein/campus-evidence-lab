"""KLAA harness: run, judge, validate and score the Kornstein Lab AI Antisemitism Audit.

Standard library only. No network calls happen unless a real (non-MOCK) provider is
selected on the command line and its API key is present in the environment.
"""

__version__ = "1.1.0"

import pathlib

PACKAGE_DIR = pathlib.Path(__file__).resolve().parent
AUDIT_DIR = PACKAGE_DIR.parent
BENCH_DIR = AUDIT_DIR / "bench"
RESULTS_DIR = AUDIT_DIR / "results"
SITE_DIR = AUDIT_DIR / "site"
