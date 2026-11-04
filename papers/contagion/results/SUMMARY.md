# Simulation study (Paper 2): summary of results (revised)

All data are synthetic. Numbers are rounded from `results/sim_results.json`; per-replicate values are in `results/raw/E*.json`. MC SE in parentheses; coverage is of nominal 95% intervals. Revised by SIM-REVISER after the referee report and code audit (`../REFEREE-REPORT.md`); saved by the orchestrator.

## Runs and provenance
- **Setup:** 2 workers, OPENBLAS_NUM_THREADS=1, nice.
- **Seeds:** base seed 2026110302, `SeedSequence([seed, experiment, config, rep])`. New configs and methods use new keys, so old values are unchanged.
- **Versions:** Python 3.13.18, numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2, hawkes 1.0.0.
- **Main run** (21:08:49–21:48:24Z), wall time in seconds:

  | E1 | E5 (rerun) | E3 | E4 | E2 | E6 | Total | Total CPU |
  |---|---|---|---|---|---|---|---|
  | 503.0 | 34.6 | 103.0 | 760.4 | 795.1 | 209.9 | 2406.0 | 2237.2 |

  Later the same evening: E6 post-processing (21:49:52Z), E5 rerun with 20000 paths (21:49:53–21:50:28Z), merge (21:55:25Z).
- **Revision** (22:53:27–22:57:07Z), driver hash 7bb84df8f8f3c4ee:
  - E2 (`--augment-e2`), 54.1 s wall / 102.9 s CPU: the long-window configs (indices 12–13). The 240 stored main replicates were kept and the summary recomputed from them. Reruns of (config, rep) = (1,17), (11,7), (10,12), (0,0), including 3 ridge fits, reproduced every stored value exactly.
  - E3, 98.8 s / 191.3 s CPU; E6, 65.3 s / 119.6 s CPU. Both rerun in full. Every previously stored value came out bit-for-bit identical: all E3 replicate fields; for E6, the prob/PIT of the 7 original forecasters, Y, the fits, the state ratios and the new-event split. The new E3 cells use no new random draws. The E6 integrating forecasters use their own generator, `SeedSequence([seed, 6, 1, rep])`.
  - Total new compute: 218.2 s wall, 413.8 s CPU.
  - Check only (not written to results): rerunning E5 with the current driver reproduced the stored E5 summary exactly.
- **Driver hashes (`run_experiments.py`):**
  - 4214ba239bd036f8 (commit 10d25ad): the main run; stored E1, E4 and main-E2 come from it.
  - 97cd66769a8bd7a9: the E5 rerun and E6 post-processing. **Not in git.** `git diff 10d25ad 65f86dd` (4214ba23 → caf14514) contains only three changes: E5 paths 4000→20000; the E6 new-event split (`--postprocess-e6`); and merge metadata. 97cd6676 lies between them. Nothing depends on it any more: E5 reproduces with the current driver, and the E6 rerun supersedes the post-processing.
  - caf14514836f2036 (commit 65f86dd): the merge.
  - 7bb84df8f8f3c4ee: the revision.
- **Library:** unchanged except docstrings. inar.py fd6f6597 → fc311084; attribution.py e7f5e764 → 3544a33f. Both have syntax trees identical to commit 10d25ad once docstrings are stripped.
- **make_figures.py:** eec5d91235c0017f (final check: the E3 figure is saved with a tight bounding box and a shorter panel (c) y-label, so the label is no longer clipped; fb1522b654f5abf6 before; every table is byte-identical and no number changed).
- **R per experiment:**
  - E1: 100 per T.
  - E2: 20 per config (12 at T=1000, plus 2 at T=10000).
  - E3: 40 per n (3 n × 5 p × 3 error levels for p̂), plus 30 per heterogeneous case (4 cases).
  - E4: 160 under H0; 60 per other scenario.
  - E5: 20000 paths.
  - E6: 12 replicates × 150 windows, 11 forecasters.

## E1 / E5 (unchanged; detail in Appendix D)
- **E1, T=2000:** α (9 entries) mean |bias| 0.002, mean RMSE 0.026, coverage 92–99%. ϱ̂ 0.481 vs 0.485. The online loading υ₃ is overestimated by +0.137 (0.079).
- **E5:** max |z| between exact and label MC is 1.50. C^on₁ 5.779 exact vs 5.800 (0.026). Plug-in coverage 0.91–0.96 at T=2000.

## E2. Spurious contagion
- **Ridge rule β̂T < 1:** flags 9 of 620 fits (the old rule caught 2).
  - Shocks known: rare κ=1 rep 17 (α̂ 16.3, β̂T 0.010); rare κ=2 reps 17 and 19 (6.77 and 5.72; 0.012 and 0.010); frequent κ=0.5 rep 13 (2.06; 0.077); frequent κ=1 reps 16 and 19 (1.73 and 3.90; 0.040 and 0.014).
  - Constant background: slow κ=2 reps 5 and 12 (0.28 and 2.22; 0.88 and 0.038).
  - Spline: slow κ=8 rep 7 (29.1; 0.015; n_eff 0.231).
  - No long-window fit is on the ridge.
- **n_eff vs α̂:** agree within 0.0023 for constant-background fits to the shot-noise families (0.0001 in the long windows).
- **Shocks per path,** median [min, max]:
  - rare: 3.5 [1,8], 9 [4,20], 15.5 [9,30], 34.5 [25,43], 65.5 [52,77];
  - frequent: 69.5 [54,86], 133.5 [104,149], 258 [240,290], 390 [349,424];
  - rare at T=10000: 157.5 [135,183] and 322 [293,341].
- **Constant background,** mean (median):
  - rare: 0.124 (0.119), 0.275 (0.294), 0.365 (0.392), 0.487 (0.483), 0.628 (0.628), vs n* = 0.184, 0.293, 0.423, 0.553, 0.667;
  - frequent: within ±0.009 of n*;
  - slow: 0.069, 0.216, 0.435.
- **Long windows (T=10000):** n_eff 0.361 and 0.484. Gaps −0.062 (0.004) and −0.068 (0.002), vs −0.058 (0.014) and −0.066 (0.0085) at T=1000. The dispersion estimator reaches 0.408 and 0.541 vs targets 0.407 and 0.538. **The gap is not finite-sample bias.** The slow family was not run with long windows.
- **Spline background:** slow means 0.008, 0.007, 0.028 (medians 0.005, 0.002, 0.003); the last is 0.018 without its ridge fit. For shot-noise families it lowers n_eff by only 0.05–0.10.
- **Shocks known** (largely removes the artefact where tested: all rare κ, frequent κ≤1):
  - rare: means 0.035–0.055 (medians 0.017–0.055);
  - frequent: 0.047 and 0.076 (medians 0.012 and 0.048);
  - loadings recovered: 15.2–16.4 vs 16; 3.94 and 3.87 vs 4.

## E3. Thinning
- **Unchanged:**
  - max |n̂' − n'(p)| = 0.0104;
  - naive coverage at n=0.5: 97.5, 82.5, 17.5, 2.5, 0%;
  - p-known correction coverage 92.5–100% (n=0.5);
  - heterogeneous biases +0.0665, +0.0273, −0.0301, +0.0217.
- **Variance floor.** p̂ = clip(p(1+rZ), 0.02, 1), with the same Z for r = 10, 30, 50%. The floor SD is r·n(1−n)(2−n)/2: n=0.5 → 0.019, 0.056, 0.094; n=0.7 → 0.014, 0.041, 0.068.
- **Results at n=0.5,** across the five values of p:

  | p̂ error | RMSE | Coverage |
  |---|---|---|
  | p known / 10% | 0.030–0.076 | 95–100% |
  | 30% | 0.051–0.096 | 87.5–97.5% |
  | 50% | 0.099–0.167 | 77.5–92.5% |

  At 50% error the estimates skew upward: means 0.503–0.569, medians 0.497–0.531.

## E4 (unchanged)
- Size: rejection 0.0625 (0.019) at 5%; P(LR=0) = 0.5625.
- Power: 0.617, 0.983, 1.0.
- Common shock: rejects 1.0 with the calendar omitted, 0.083 with it included.

## E6. Alerting
- **Integrating forecasters (`*_int`):** each continuation also gets simulated clusters of events arriving in (t, t+7].
  - True version: rate 1/30 and log-normal(0.75) sizes.
  - Fitted version: the training rate (0.0353, MC SE 0.0018), sizes resampled from the training calendar, and the fitted loadings and η.
- **Delays:** the state is still a plug-in; Alg. 2 (SIS) was not run.

| Forecaster | Cost at 2 / 5 / 10 | Precision / recall at 1/6 | Brier | PIT χ²₉ | Bias |
|---|---|---|---|---|---|
| true par., no future events | .137 / .287 / .526 | .614 / .466 | .0655 | 175.3 | −1.91 (0.18) |
| true par., integrating | .136 / .285 / .512 | .503 / .511 | .0628 | 3.3 (p=.95) | +0.07 (0.18) |
| fitted, no future events | .137 / .287 / .534 | .594 / .471 | .0654 | 169.8 | −1.75 |
| fitted, integrating | .134 / .289 / .514 | .484 / .511 | .0629 | 17.1 (p=.048) | +0.38 (0.22) |
| moving-average Poisson | .221 / .451 / .792 | .216 / .247 | .1141 | 1994 | +0.06 |
| climatology | .193 / .483 / .898 | — / 0 | .0880 | 26.5 | +0.94 |
| delays, naive state, integrating | .137 / .279 / .502 | .550 / .506 | .0633 | 6.8 | −0.05 |
| delays, HT nowcast, integrating | .135 / .287 / .510 | .481 / .517 | .0630 | 13.3 | +0.37 |

- **Calibration:** the old miscalibration came from the misspecified forecaster that leaves out future events.
- **Timing limits recall:**
  - 108 of 174 surges (62%) fall in windows where an event arrives after the forecast origin;
  - the integrating PIT is not uniform once windows are split by arrival (χ² 106 without an event, 369 with one);
  - recall is 0.894 for the other surges and 0.278 for these.
- **Integrating vs no future events** (paired, true parameters): cost differences −0.001 (0.002), −0.002 (0.007), −0.014 (0.016); Brier difference −0.0027 (0.0006).
- **Delays:**
  - naive state averages 0.4752 of the true state (theory 0.475); HT nowcast 1.0033;
  - on windows without a new event, with the no-future forecasters: naive p = 0.033, HT p = 0.435;
  - with integrating forecasters, costs at ratio 5 are 0.289 (complete data), 0.279 (naive), 0.287 (HT); naive − HT = −0.008 (0.003).
  - **The results do not support "the nowcast keeps delays from hiding a surge".**

## Outputs
- Tables `tab-sim-e1.tex` … `tab-sim-e6.tex`, one metric per column; coverage rounds half-up (2.5 no longer prints as "2").
- Fig. 9: one legend for the whole figure, placed above the panels; new panels for the PIT split by event arrival and the PIT under delays.
- Other figures: long-window points added to the E2 figure; variance-floor panel added to the E3 figure; legends and cramped labels fixed.
- Moved to Appendix D: the design table, the E1/E4/E5 figures, the E1 table, and the E1/E4/E5 detail.
