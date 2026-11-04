# Simulation code for Paper 4, *Supply or Demand?*

Everything here is synthetic: a generated catalogue, classifier, personas and users. No real platform, item or
user is represented, and no number produced by this code is a finding about any service.

## Layout

| Path | Content |
|---|---|
| `ampsim/world.py` | catalogue, classifier regimes (ND, DU, DD, NDI), personas |
| `ampsim/engine.py` | recommender policies (alg, chron, random, popular), accounts, training and measurement sessions |
| `ampsim/measurement.py` | validation sampling, Rogan–Gladen corrections, delta-method variances (E1) |
| `ampsim/doublesample.py` | the double-sampled exposure of the registered protocol, the pilot coding, the closed-form variance A + nB_ds (E5b) |
| `ampsim/markov.py` | content-state chains: estimation, stationary law, fundamental matrix, perturbation; slate confusion and the corrected chain (E4b) |
| `ampsim/sequential.py` | confidence sequences: normal mixture (Algorithm 1 and its version for a mean), betting |
| `run_experiments.py` | experiments E1, E1b, E2, E3, E4, E5, E4b, E5b; writes `../results/sim_results.json` |
| `write_summary.py` | `../results/SUMMARY.md`, every number printed from the JSON |
| `make_figures.py` | `../figures/fig-sim-*.pdf` and `../tables/tab-sim-*.tex` |
| `tests/test_ampsim.py` | unit tests |

The simulated personas are coded P1–P4 in figures, tables and the paper (P1 general interest, the baseline d0;
P2 Jewish interest; P3 Middle East news; P4 conspiracy-adjacent; see appendix C of the paper). The JSON keys keep
the internal names `general`, `jewish`, `mideast`, `conspiracy`.

## Reproduction

From this directory:

```
OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E1,E2,E3,E4
OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E5 --merge
OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E1b --merge
OPENBLAS_NUM_THREADS=1 nice -n 10 python run_experiments.py --only E4b,E5b --merge
python write_summary.py
python make_figures.py
OPENBLAS_NUM_THREADS=1 nice -n 10 python -m pytest tests -q
```

`--merge` updates only the named experiments inside the existing JSON and loads the E1 pools from
`../results/raw/`. E4b and E5b use detailed pools, `../results/raw/pool_detail_<regime>.npz`: the E1 pools
re-simulated with the same seeds and chunks while recording per-session counts, opened positions and slate states.
The recording draws no random numbers, so the counts are identical to the E1 pools; the JSON records the check
(`E5b.pools.<regime>.reproduces_E1_pool`). Without `--only`, all experiments run at once from the same seeds.
`--quick --out <dir>` makes a smoke run.

## Run history

`meta.runtime_s.runs` of the JSON lists every run, with its wall time and the CPU time of each part;
`meta.runtime_s.total_wall` is the sum of the runs' wall times. The run logs are in `../results/`.

| Run | Experiments | Status | Log |
|---|---|---|---|
| 1 | E1, E2, E3, E4 | current for E1–E4 | `run_log.txt` |
| 2 | E5 | superseded | — |
| 3 | E1b, E5 | superseded | `run_log_E1b_E5.txt` |
| 4 | E5 | current for E5 | `run_log_E5.txt` |
| 5 | E1b | current for E1b | `run_log_E1b.txt` |
| 6 | E4b, E5b | current for E4b, E5b | `run_log_E4b_E5b.txt` |

**Runs 2 and 3 (E5, superseded).** They evaluated an earlier version of the paper's Algorithm 1: a Fieller-type
confidence sequence for AR on the flagged shares, with the false-positive rate of each arm bounded through an
anytime-valid sequence for the positive predictive value (50 coded flagged exposures per arm and wave), the ratio of
the arms' Youden indices given the range [0.95, 1.05], and alpha split 80/20 between the sequence and the
validation. They used R = 1,000 audits and regime ND only. Run 3 repeated run 2 with one correction: the confidence
sequence for AA had been checked after every pair rather than at the end of every wave. The algorithm was then
revised into its present form (the confirmed-flagged statistic Y_u, the delta-method normal-mixture sequence for
log AR, the burn-in, and the declared range for the sensitivity ratio), and E5 was rewritten to evaluate it as
stated, with the null case, regime DD, runs with and without the burn-in, the peeking comparator on the same
statistic, the stopping rules on the log scale, and prop:power(d). Run 4 replaced all E5 results. No number from
runs 2 or 3 appears in the paper, and their results are no longer in the JSON. The code of the earlier algorithm
(`ampsim.sequential.fieller_cs`, `bernoulli_mixture_cs`) is kept, with its unit tests.

**Run 5 (E1b).** It recomputed E1b with the same seeds to add two diagnostics, kappa_Sp and the median
delta-method s.d. of log AR. Every quantity that runs 3 and 5 share is identical.

**Run 6 (E4b, E5b).** It added the slate-state chains of the protocol (E4b) and the registered primary analysis on
the double-sampled exposure (E5b). E5 is kept unchanged as a benchmark: a conventional small-lab design with the
confirmed-flagged statistic, 40 pairs per persona in 8 waves of 5, and 10 sessions per puppet. The protocol no longer
registers that design.

**Field `meta.runtime_s.total_wall`.** Until run 6 it held the wall time of run 1 only (755.2 s), because later
`--merge` runs appended to `runs` without updating it. Run 6 set it to the sum over runs and added
`total_wall_definition`; the redundant top-level `by_experiment_cpu` (a copy of run 1's) was removed.

**Warnings in the log of run 1.** They come from the configurations in which the pooled correction is undefined
in every audit (regime DU, random reference, general persona, U >= 20); their summaries are recorded as missing.
