# Simulation study (Paper 2): summary of results

All data synthetic. Numbers are rounded from `results/sim_results.json`; per-replicate values are in `results/raw/E*.json`. MC SE in parentheses; coverage is of nominal 95% intervals. Saved by the orchestrator from SIM-EXP's report, because subagents cannot write .md files.

## Run
- `code/run_experiments.py` with 2 workers, OPENBLAS_NUM_THREADS=1, nice.
- Base seed 2026110302, with `SeedSequence([2026110302, experiment, config, rep])`, so results don't depend on the worker count.
- Versions: Python 3.13.18, numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2, hawkes 1.0.0.
- Wall time (s): E1 503.0, E3 103.0, E4 760.4, E2 795.1, E6 209.9, E5 34.6; total 2406.0 (task CPU 2237.2). About 5 min over the 35-min budget, under load ~12.
- Main run 21:08:49Z–21:48:24Z.
  - E5 was rerun with 20000 paths; the earlier 4000-path run was overwritten.
  - E6 was post-processed (`--postprocess-e6`) to split calibration by new external events. The calendars were regenerated from the seeds and nothing was re-simulated.
- Code hashes: 4214ba239bd036f8 (E1–E4, E6); 97cd66769a8bd7a9 (E5 rerun and E6 post-processing; changes only the E5 default path count and the E6 flags).
- R:

| Experiment | R |
|---|---|
| E1 | 100 per horizon (T=1000, 2000) |
| E2 | 20 per config (12 configs) |
| E3 | 40 per n (3 n × 5 p), plus 30 per heterogeneous case (4 cases) |
| E4 | 160 (H0); 60 per power value (3); 60 (common shock) |
| E5 | 20000 label paths, plus the E1 fits |
| E6 | 12 replicates × 150 weekly windows |

## E1. EM recovery (offline A, offline B, online)
Truth:

| Parameter | Value |
|---|---|
| μ | (0.25, 0.20, 0.50) |
| A | [[.25,.08,.12],[.08,.20,.12],[.10,.10,.35]] |
| ϱ(A) | 0.485 |
| β | 1.5 |
| loadings | (3, 2, 6) |
| η | 0.4 |

- Mean events: 2209.0 (T=1000), 4451.8 (T=2000). All 200 fits converged, with positive-definite information and no boundary flags.
- T=2000:
  - α (9 entries): mean |bias| 0.002, mean RMSE 0.026 (max 0.038), coverage 92–99%.
  - μ: mean RMSE 0.022, coverage 92–99%.
  - β: 1.501, RMSE 0.117, coverage 95%.
  - η: 0.406, RMSE 0.055, coverage 97%.
  - loadings: mean RMSE 0.602, coverage 93–95%.
- T=1000: α mean |bias| 0.003, mean RMSE 0.036 (max 0.048), coverage 92–98%; β RMSE 0.173, coverage 92%.
- Multiplier M=(I−A)⁻¹ (delta method): coverage 93–99% (T=1000), 92–99% (T=2000).
- ϱ̂: 0.476 (T=1000) and 0.481 (T=2000) vs 0.485; coverage 96% and 97%.
- Surge decomposition (45 quantities per horizon): coverage 90–99% (T=1000), 91–96% (T=2000).

## E5. Surge attribution (shock at τ=300, S=3)
- `decompose_surge` exact vs branching-label MC (20000 paths): max |z| 1.48 (H=7) and 1.50 (H=14).
  - C_1: exact 9.694, MC 9.710 (0.034).
  - C^on_1: exact 5.779, MC 5.800 (0.026).
- Estimated vs true, T=2000, H=14:

| Quantity | Estimate | Truth | Coverage |
|---|---|---|---|
| B_1 | 7.406 | 7.381 | 92% |
| D_1 | 8.976 | 8.967 | 94% |
| C_1 | 9.779 | 9.694 | 92% |
| C_1/(D_1+C_1) | 0.523 | 0.519 | 92% |
| σ_1 | 0.602 | 0.596 | 94% |
| C_3 | 14.693 | 14.667 | 96% |
| C_1(∞) | 9.866 | 9.769 | 91% |

## E2. Spurious contagion (no true contagion; Λ=2, T=1000)
- Designs: shot noise with γ=0.5 in a "rare" family (m=16) and a "frequent" family (m=4); slow regime switching (q=0.02).
- Reported quantity: the in-window branching ratio n_eff = α̂·mean(1−e^{−β̂(T−t)}). It equals α̂ within 0.001 for the constant-background fits.
- Constant-background fit vs n*:

| Family | κ | n_eff | n* | gap (MC SE) |
|---|---|---|---|---|
| Rare | 0.5 | 0.124 | 0.184 | −0.059 (0.021) |
| Rare | 1 | 0.275 | 0.293 | −0.018 (0.017) |
| Rare | 2 | 0.365 | 0.423 | −0.058 (0.014) |
| Rare | 4 | 0.487 | 0.553 | −0.066 (0.0085) |
| Rare | 8 | 0.628 | 0.667 | −0.039 (0.008) |
| Frequent | all | | | within ±0.009 (each within 1 MC SE) |
| Slow | 0.5 | 0.069 | 0.184 | |
| Slow | 2 | 0.216 | 0.423 | |
| Slow | 8 | 0.435 | 0.667 | |

- The likelihood pseudo-true value is not n* in general (rem th-spurious(ii)).
- Dispersion estimator vs its finite-window target n*_w:
  - rare: 0.149/0.172, 0.321/0.278, 0.386/0.407, 0.539/0.538, 0.665/0.654;
  - frequent: 0.187/0.172, 0.266/0.278, 0.401/0.407, 0.461/0.484.
- Spline background: removes the slow-regime artefact (0.008, 0.007, 0.028) but not the fast-shock one (rare κ=8: 0.628→0.581; frequent κ=3: 0.497→0.438).
- Shock times known: n_eff falls to 0.035–0.055 (rare) and 0.047 and 0.076 (frequent). Loadings are recovered (15.23–16.38 vs 16; 3.94 and 3.87 vs 4).

## E3. Thinning (β=1, Λ=2, T=1500)
- Fit vs n'(p): max |n̂'−n'(p)| over 15 cells = 0.0104 (MC SE 0.0062).
- Naive coverage of n at n=0.5, for p = 1 down to 0.2: 97.5%, 82.5%, 17.5%, 2.5%, 0%.
- Corrected h_p⁻¹(n̂') with p known: bias −0.0004 to −0.0155; coverage 92.5–100% (n=0.5) and 90–95% (n=0.7).
- With p estimated: e.g. 0.491, coverage 97.5% (n=0.5, p=0.4).
- Heterogeneous recording (bias vs n̄):

| Case | bias | theoretical n_naive |
|---|---|---|
| Cov>0 | +0.0665 | 0.5774 |
| equal p | +0.0273 | 0.5358 |
| Cov<0 | −0.0301 | 0.4787 |
| complete | +0.0217 | 0.5358 |

## E4. Boundary LRT (M=2, T=600)
- Size: 0.0875 / 0.0625 (0.019) / 0.01875 at 10/5/1%. P(LR=0) = 0.5625. Naive χ²₁ rejects at 0.025.
- Power: 0.617 / 0.983 / 1.0 for α = 0.05 / 0.1 / 0.2.
- Common shock: calendar omitted → rejects 1.0 (α̂ 0.072); calendar included → 0.083 (0.036) (α̂ 0.010).
- Not run: the Davies bootstrap.

## E6. Alerting (surge = ≥21 incidents per 7 days; base rate 0.0967)
Cost per window:

| Method | c_miss=2 | c_miss=5 | c_miss=10 |
|---|---|---|---|
| Hawkes, true params | 0.137 | 0.287 | 0.526 |
| Hawkes, fitted | 0.137 | 0.287 | 0.534 |
| moving-average Poisson | 0.221 | 0.451 | 0.792 |
| climatology | 0.193 | 0.483 | 0.898 |

- Precision/recall at π*=1/6: 0.614/0.466 (true params) vs 0.216/0.247 (MA Poisson).
- Brier: 0.0655 vs 0.1141.
- Pooled PIT is not uniform even with true parameters (χ² 175.3; bias −1.913 per week), because new external events inside the window are not anticipated.
  - On the 1424 windows with no new event: χ² 11.6 (p=0.237) with true params; 12.5 (p=0.189) fitted.
  - On the 376 windows with a new event, 55.1% of PITs fall in the top decile.
- Delays:
  - The naive state averages 0.4752 of the true state (theory 0.475); the HT nowcast averages 1.0033.
  - PIT on no-new-event windows: naive p=0.0326; nowcast p=0.435.
  - Cost at c_miss=5: 0.287 (complete), 0.304 (naive), 0.297 (nowcast).

## Anomalies
1. Total wall time over budget.
2. E2: the fitted n is not n* in general. The spline does not fix fast shocks. With shocks known, the estimate stays slightly positive. β̂ hit its lower bound in 1 of 20 fits at rare κ=1 and at κ=2.
3. E2: the dispersion estimator is low at frequent κ=3 (0.461 vs 0.484).
4. E3: at n=0.3, p≤0.4, β̂' blows up (23.4, 110.8) and coverage is 85% and 70%.
5. E3: under heterogeneous recording, n̂'' is 0.008–0.014 below the second-order value.
6. E1: the online loading is slightly over-estimated (+0.199 at T=1000, +0.137 at T=2000).
7. E6: forecasts are calibrated only on windows with no new external event (unforecastable events are not in the model).
8. E5: the first run was superseded.
