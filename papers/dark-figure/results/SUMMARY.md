# Simulation study: summary of run 2 (after the code audit)

Saved by the orchestrator from SIM-FIX's report (subagents cannot write .md files). Source of truth: `results/sim_results.json` (run 2), started 2026-11-03T21:21:47Z. All data are synthetic.

- **Scope:** 3440 tasks: 640 record-level worlds (S1–S5), 1000 oracle-only worlds (S7) and 1800 LE tables (S8).
- **Runtime:** 2948 s wall (49.1 min), 2 workers, `nice -n 10`, `OPENBLAS_NUM_THREADS=1`; summed task time 5879 s.
- **Environment:** base seed 20261103; Python 3.13.18, numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2.
- **Run 1** is kept as `sim_results_run1.json`, `raw_run1/` and `SUMMARY-run1.md`.
- **Conventions:** "Bias" is the MEDIAN relative bias of N̂ (primary); mean, MAD spread and blow-up count (N̂ > 5N) are in the JSON and `tables/tab-sim-main.tex`. "Coverage" is of nominal 95% intervals.

**Replications**

| Scenario | R | LCMCR replicates |
|---|---|---|
| S1–S4 | 100 each | S1 10, S2 25, S3 10, S4 25 (4 chains per fit) |
| S5 | 40 per noise level | none |
| S7 | 200 per q | none |
| S8 | 200 per (δ, ε) cell | none |

**MC SEs:** coverage about 0.022 at R = 100, 0.015 at R = 200, 0.065 at R = 25. Median MCSEs are in the JSON (`relbias_median_mcse`).

## S8: observed table generated exactly by the LE model (validates cor:linkcorrect under its own model)
**Design.** Independent capture with p = (.2725, .305, .2275, .2075), N = 2000, `simulate_observed(t, δ, ε)` on δ ∈ {0.05, 0.1, 0.2} × ε ∈ {0, 0.02, 0.05}.

**Bias.**
- Known (δ, ε): the corrected estimators are median-unbiased: BMA −0.3% to +0.5%, LP −0.7% to +0.3%, Chao −0.4% to +1.5%, CF −3.2% to +7.3%.
- The naive table is badly biased: BMA +2.4% to +62.7%.

**Coverage with known rates (min–max over 9 cells)**

| Estimator | With v_link | Without v_link (run-1 interval) | Oracle |
|---|---|---|---|
| BMA | 0.945–0.985 | 0.725–0.965 | 0.950–0.970 |
| LP | 0.940–0.980 | 0.790–0.920 | — |
| Chao | 0.930–0.960 | 0.630–0.895 | — |
| CF | 0.905–0.965 | 0.700–0.930 | — |

Examples: at δ = 0.2, ε = 0, BMA covers 0.955 with v_link and 0.725 without; at δ = 0.1, ε = 0, 0.965 and 0.850.

**Rates from the random audit** (200 records + 100 linked edges, simulated from the LE truth).
- Point estimates stay median-unbiased: BMA −1.5% to +1.1%.
- With v_link alone the intervals undercover: BMA 0.750–0.835, Chao 0.695–0.810.
- Adding the delta-method audit variance restores coverage: BMA 0.925–0.985, LP 0.925–0.980, CF 0.920–0.975, Chao 0.905–0.970. The sum is conservative by rem:link-sameaudit.
- The audit's own 95% CIs cover the realised δ in 0.895–0.95 of replicates, and ε in 0.91–0.93.

## S4: heterogeneity + covariates + noisy records (ν = 1), realistic FS-EM + greedy linkage

**BMA medians**

| Pipeline | Bias | Coverage |
|---|---|---|
| Oracle | −7.5% | 0.41 |
| Naive | +40.0% | 0.07 |
| LE-corrected (audit rates + v_link) | +47.1% (mean +75.3%, 1 blow-up) | 0.24 (0.10 without v_link; 0.76 with audit variance, very wide intervals) |
| Corrected with realised rates | +38.5% | — |
| ε = 0 variant (post hoc) | −4.5% | 0.69 |
| Infeasible best-fit LE | +4.3% | 0.93 |
| MI (Gibbs draws) | +44.2% | 0.06 |

**LCMCR medians**

| Pipeline | Bias | Coverage |
|---|---|---|
| Oracle | −8.7% | 0.88 |
| Naive | +59.3% | 0.04 |
| Corrected | +79.8% | 0.32 |
| MI | +53.2% | 0.04 |

**Other estimators.**
- CF: naive +168.1% (7/100 blow-ups), corrected +458.8% (54/100 blow-ups).
- Chao: naive +14.3%, corrected +7.9%.

**Why the correction fails (a finding).** The audit estimates its frame rates well: δ̂ 0.107 vs frame 0.111, ε̂ 0.079 vs 0.081, with CI coverage 0.96 and 0.98. But the best-fit scalar LE has ε* = 0.000 and δ* = 0.079. Under the one-record-per-list constraint, false matches are mostly swaps that barely change the table, so inverting a merge rate that is not there over-corrects.

**S5 noise sweep, BMA medians at ν = 0, .25, .5, 1, 1.5, 2**

| Pipeline | Medians |
|---|---|
| Naive | 0.0, +4.5, +7.2, +40.4, +75.3, +117.8% |
| Corrected | +0.4, +1.5, +7.5, +63.4, +158.5, +367.2% |
| ε = 0 (post hoc) | −0.2, −3.1, −5.0, +3.0, +9.7, +15.0% |
| MI | +0.1, +8.7, +17.1, +41.1, +44.2, +53.3% |

Best-fit ε* ≤ 0.015 at every noise level.

## MI vs naive
The Gibbs draws are approximate posterior draws under the plug-in FS pairwise model.

**S4 (means over replicates; first 5 draws per replicate)**

| Quantity | Point linkage | Gibbs draw |
|---|---|---|
| False merges | 97.7 | 111.5 |
| Pairwise recall | 0.787 | 0.710 |
| Observed clusters − true observed incidents | +126.7 | +177.6 |

- Run 1's Bernoulli/greedy MI gave BMA +64.5%; the Gibbs MI gives +44.2% vs naive +40.0%, so it is no longer much worse but not better.
- MI beats naive only at high noise: ν = 1.5 (+44.2% vs +75.3%) and ν = 2 (+53.3% vs +117.8%), with coverage only 0.15–0.20.
- Sampler: lag-1 autocorrelation of the number of links across sweeps is −0.033 (S4); about 343 of 2186 active records move per sweep.

## Clean-record scenarios (S1–S3, S6, S7)
Oracle results are identical to run 1 (same worlds).
- **S1:** oracle within ±1.2%, all pipelines within ±2.0%, oracle coverage 0.90–0.98. CF is heavy-tailed (median −0.1%, mean +8.6%).
- **S2 (oracle):** LP −38.8%, CF +1.7%, BMA −12.9% (coverage 0.26), Chao −20.0%, LCMCR −10.2% (coverage 0.88 ± 0.065, R = 25).
- **S3:** LP −38.8%; provenance drop −1.1% (coverage 0.93); BMA −0.2%; LCMCR −2.3%.
- **S6:** |ω| ≤ 1 bands contain n₀ in 0.87 (S1), 0.93 (S2), 0.87 (S3) and 0.98 (S4).
- **S7:** provenance-drop LP −1.1% to −0.1% with coverage 0.945–0.970 for every q; BMA on all records fails at q = 1 (−29.5%).

## LCMCR diagnostics
4 chains × 7500 iterations (burn-in 2500, thin 5) = 30 000 iterations per fit, overdispersed starts. App. B protocol: R̂ < 1.01 and ESS ≥ 400.

| Table | R̂ median / max | Share with R̂ < 1.01 | ESS_bulk median | Share meeting protocol |
|---|---|---|---|---|
| S1 oracle | 1.002 / 1.004 | 100% | 2848 | 100% |
| S2 oracle | 1.042 / 1.240 | 8% | 95 (min 13) | 0% |
| S4 oracle | 1.031 / 1.197 | 8% | 174 | 4% |
| S4 naive | 1.024 / 1.278 | 12% | 140 | 0% |

Spread of the 4 chain medians as a share of N: median 2.9% in S2 (max 13.2%), 2.1% in S4 oracle (max 7.4%), 5.9% in S4 naive (max 20.6%).

## Caveats (honest reading)
1. **The LE correction is validated only under its own model (S8).** Under realistic FS + greedy linkage (S4, and S5 at ν ≥ 0.5) it over-corrects and is worse than naive. The ε = 0 variant is best but was chosen after seeing run 1. The infeasible best-fit LE shows the scalar LE family cannot represent swap-dominated errors.
2. **MI is not a full Bayesian linkage posterior.** The sampler targets a plug-in pairwise-composite FS posterior: m and u fixed, edges with π < 1e-3 truncated, floor odds τ/(1−τ) for other within-cluster pairs. Its draws split more true clusters than the point linkage, so it propagates uncertainty around a worse-centred table. Calibrating π on the audit sample was not tried.
3. **Corrected intervals need the audit variance when rates are estimated.** v_link alone undercovers (S8 BMA 0.75–0.84). The added variance is conservative and can be very wide (S4 BMA median width/N 2.36). v_link uses forward-difference gradients and is inexact for the heavy-tailed CF (coverage 0.905 at δ = 0.2, ε = 0).
4. **LCMCR runs on a reduced MCMC protocol.** In S2/S4, R̂ > 1.01 in about 90% of fits and bulk ESS is about 100–175. The 2–6% chain-median spread is small next to the −8.7% to −10.2% oracle bias, consistent with run 1 and with SIM-EST's 60k-iteration checks. LCMCR uses R = 10–25 (coverage MCSE up to 0.095); corrected and MI LCMCR fits pool one chain per imputation, so they have no R̂.
5. **The audit's frame differs from capture-level rates.** The audit targets the candidate-pair frame; blocking recall is 0.978 (S4) and 0.936 (ν = 2). At ν ≥ 1.5, δ̂ is below the frame δ (0.156 vs 0.175, 0.194 vs 0.221), with CI coverage 0.825–0.85. The code implements the random audit (prop:link-audit), not the targeted alg:review; reviewed links are not fixed.
6. **Lower limits relative to n_obs.** LP lower limits can lie below the 4-list n_obs (LP uses two lists). MI lower limits are ≥ min_m n_obs^(m); in 2 of 1920 MI fits the lower limit lies between that minimum and the mean n_obs.
7. **Runtime:** 49 min, over the ~35-min target, because of a concurrent 2-worker run.

## What changed vs run 1
- S8 added.
- v_link in corrected intervals: delta method through the LE Jacobian; `corrected_tv` uses the delta-method audit variance.
- MI: Gibbs sampler over constrained partitions replaces the Bernoulli + greedy draws.
- Rubin's rules on log(N̂ − min n_obs).
- Median-primary summaries; `relbias_n0` uses the common oracle denominator.
- LCMCR: 4 chains with R̂/ESS per fit.
- The audit is compared on the candidate-pair frame.
- Seeds keyed to scenario ids.
- FS-EM spec recorded in `meta.fs_em`.
- Jaro similarity reimplemented with `str.find` (identical values, about 2× faster).
- New: `tab-sim-le`, `tab-sim-lcmcr`, `tab-sim-mi`, `tab-sim-linkage-bias`, `fig-sim-le-validation`.
