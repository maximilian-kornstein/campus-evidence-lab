# `darkfig`: code for the simulation study of *The Dark Figure*

| module | contents |
|---|---|
| `darkfig/estimators.py` | public estimator API (`Estimate`, LP, closed form, log-linear model / BMA, Chao, LCMCR incl. multi-chain and pooled, linkage-corrected with linkage variance) |
| `darkfig/loglinear.py` | capture-table utilities, design matrices, batched Poisson IRLS, hierarchical-model enumeration |
| `darkfig/lcmcr.py` | Gibbs sampler for the DP latent-class model (Manrique-Vallier 2016); split-R-hat / bulk-tail ESS |
| `darkfig/linkerror.py` | the canonical linkage-error operator T(δ, ε) of SPEC (expected, Monte Carlo, record level), Cov(ñ given t), Jacobian, LE audit simulator |
| `darkfig/world.py` | synthetic worlds (incidents, capture, noisy records) |
| `darkfig/linkage.py` | blocking, comparison vectors, 3-class FS-EM (`FS_EM_SPEC`), de-duplication, greedy point linkage, Gibbs linkage sampler for MI, random audit (`clerical_review`) and its estimand on the frame (`audit_frame_truth`) |
| `darkfig/pipeline.py` | one-world analysis (`analyse_world`) and the table-level LE scenario S8 (`analyse_le_table`) |
| `run_experiments.py`, `make_figures.py` | the simulation study and its figures / tables |
| `tests/test_estimators.py`, `tests/test_world_linkage.py` | tests |

Requirements: Python 3.13 with numpy, scipy, matplotlib and pytest. Nothing else.

## Run 2 (after the 2026-11-03 code audit): what changed

* **Linkage variance in corrected intervals.** `linkage_corrected(..., link_var="delta")` (default) adds
  `v_link` of Cor `cor:linkcorrect`(i) by the delta method, `v_link = a' Σ a` with `a = J^{-T} ∇F(t̂)`.
  Here `J` is the Jacobian of `t ↦ E[T(δ,ε)t]`, which is `D_δ` times the first-order merge Jacobian, and
  `Σ = Cov(ñ | t̂)` under LE (`linkerror.observed_covariance`). The detachment part of `Σ` is exact; merging is
  first order. The inner interval is widened on its log(N − a) scale (`widen_interval`). `rate_se=(se_δ, se_ε)`
  also returns the interval with the audit variance of part (iii) (`extra["lo_tv"]`, `extra["hi_tv"]`), which
  is conservative for an audit of the same linkage. For LCMCR (`link_var="impute"`), one chain is run per
  imputed table `t* ~ N(t̂, J^{-1} Σ J^{-T})` and the draws are pooled. A parametric bootstrap was the
  alternative. We chose the delta method because it costs about 16 estimator calls per table, and its `Σ`
  matches Monte Carlo (`test_observed_covariance_matches_monte_carlo`). On LE-generated tables it restores
  nominal coverage (`test_v_link_restores_coverage_in_small_le_case`, scenario S8).
* **MI draws.** `linkage.gibbs_linkage` is a single-record Gibbs sampler over partitions, with at most one
  record per list per cluster and clusters connected through retained edges. It targets
  `Π_{within-cluster pairs} π/(1−π)` (candidate pairs with π ≥ τ = 1e-3; other within-cluster pairs get the
  floor τ/(1−τ)). These are approximate posterior draws under the plug-in (empirical-Bayes) FS pairwise model,
  not a full Bayesian record-linkage posterior. `test_gibbs_linkage_targets_the_documented_distribution`
  checks the target exactly on a toy problem. The run-1 sampler (`sample_linkage_bernoulli`: Bernoulli(π) +
  greedy) is not a posterior sampler and is kept only for reference.
* **Rubin's rules** (`pipeline.rubin_log`) combine on `log(N̂ − c)`, with `c = min_m n_obs^(m)`. The
  within-imputation variance comes from each draw's log-normal interval on `N − a`. Lower limits are therefore
  never below `c`.
* **LCMCR.** `lcmcr(..., n_chains=4)` runs chains whose `n0` starts are 0.5/1/2/4 × the Chao-type default. It
  pools the draws and reports the rank-normalised split-R̂ and bulk/tail ESS (`lcmcr.convergence_diagnostics`,
  Vehtari et al. 2021). The study uses 4 × 7500 iterations (burn-in 2500, thin 5). That is the 30 000
  iterations recommended below, split over 4 chains. This is a reduced protocol relative to App.
  `app:comp-diag`, and the diagnostics are reported. `lcmcr_pooled(tables)` runs one chain per table (MI,
  corrected) and pools the draws.
* **Audit.** `clerical_review` is the random stratified audit of Prop. `prop:link-audit`. It is not the
  targeted review of Alg. `alg:review`, and reviewed links are not fixed. Its estimand on the same frame
  (candidate pairs among de-duplicated records) is `audit_frame_truth`. Blocking recall is in `LinkageResult.info`.
* **S8.** `linkerror.simulate_records` is `simulate_observed` with record-level output, using the same random
  stream and returning the same table. `linkerror.simulate_audit` is a random audit of an LE linkage: a
  200-record sample for δ (ratio estimator of the pairwise recall) and a 100-edge sample for ε.
* **Seeds** are keyed to fixed scenario ids (`run_experiments.SEED_ID`). **Summaries:** the median relative bias
  is primary, with the mean, the MAD-based spread and the count of replicates with N̂ > 5N alongside.
  `relbias_n0` uses the common oracle n_obs.
* `FS_EM_SPEC` (in `linkage.py`) records the FS-EM details: the missing levels, the 3 classes and the tied
  date/hour distributions. It is copied into `results/sim_results.json` as `meta.fs_em`.
* `linkage.jaro` uses `str.find`. It gives identical values to the textbook loop
  (`test_jaro_fast_equals_reference`) and is about 2× faster.

## Running the tests

```bash
cd papers/dark-figure/code
nice python -m pytest tests/ -q                                  # all 58 tests, about 40-90 s under load
nice python -m pytest tests/test_estimators.py -q -m "not slow" # quick estimator subset
```

The tests carrying the `slow` marker are the LCMCR coverage run, the LCMCR Geweke test, the Monte Carlo check of the LE model, and the Monte Carlo check of linkage correction. The marker is not registered in a pytest config, so pytest may print an "unknown mark" warning. It is harmless.

## Capture tables

* A capture table is a `dict[tuple[int, ...], float]` mapping each nonzero history `h = (h_1..h_K)` to `n_h`.
  * Float counts are allowed.
  * Missing histories count as 0.
  * An all-zero key is ignored.
  * Numpy integer keys are fine.
* Every function also accepts a float array of length `2**K` in **bitmask order**, `mask(h) = Σ_k h_k 2^(k-1)`, with list 1 as the least-significant bit. Index 0 is the unobserved cell and is ignored.
* Helpers in `darkfig.loglinear`:
  * `table_to_array`, `array_to_table` and `histories(K)` convert between the two forms; `histories(K)` gives the `(2**K, K)` 0/1 matrix in bitmask order.
  * `collapse(table, lists)` marginalises onto a subset of lists.
  * `frequency_counts(table)` returns `f_0..f_K`.

## `Estimate`

```python
@dataclass
class Estimate:
    N_hat: float      # point estimate of N
    lo: float         # interval for N at `level` (default 0.95)
    hi: float
    n_obs: int|float  # distinct units observed; N_hat - n_obs = estimated dark figure
    method: str
    extra: dict       # diagnostics (JSON-safe except linkage_corrected's t_hat)
    # helpers: .n0_hat, .covers(N), .to_dict() (JSON-safe)
```

## Estimator API (`from darkfig.estimators import ...`)

Timings are for K = 4 and N ≈ 2000 on the shared 4-core machine, under load.

| function | estimator | interval | time |
|---|---|---|---|
| `lincoln_petersen(table, lists=(0,1), variant="chapman")` | Two lists, collapsed from the table. `N_hat` is Chapman (or the classic LP with `variant="classic"`); both are in `extra`. | Log-normal on the unseen part (Chao 1987 transform), using the Chapman variance of Seber (1970). Lower limit ≥ n₁₂. | 0.3 ms |
| `loglinear_closed_form(table, omega=0.0, correction="auto", n0_sampling_var=True)` | Thm `thm:closed`: `n̂0(ω) = e^{(-1)^K ω} Π_{\|h\| odd} n_h / Π_{\|h\| even, h≠0} n_h`. Zero cells: `"auto"` adds 0.5 to every cell if any is 0. | Delta method on log n̂0, with `Var = Σ_{h≠0} 1/n_h + 1/n̂0` (see note 1). | 0.2 ms |
| `loglinear_model(table, terms=None)` | One hierarchical Poisson log-linear model (`None` means independence, `"all2"` means all 2-way terms, or a list of terms such as `[(0,1),(2,3)]`). | Delta method: `Var(log μ̂0) = [I⁻¹]₀₀ + 1/μ̂0`. | 1 ms |
| `loglinear_bma(table, max_order=2, criterion="bic")` | Averages over all hierarchical models with main effects and interactions up to `max_order`, clamped to K−1 (64 models for K = 4, order 2; 113 for order 3), with BIC weights (`log n` penalty) or AIC weights. Fitted by batched IRLS. Models whose MLE does not exist are dropped. | MATA-Wald (Turek & Fletcher 2012): quantiles of the weighted mixture of per-model log-normal deltas. | 6 ms |
| `chao_lower_bound(table, bias_corrected=False)` | Thm `thm:chao`: `n + ((K-1)/K) f1²/(2 f2)`. If f2 = 0, falls back to the bias-corrected `c f1(f1-1)/(2(f2+1))`. | Chao (1987) log-normal interval with the multinomial delta variance `f2[(c/2)r² + c²r³ + (c²/4)r⁴]`, where r = f1/f2 and c = (K-1)/K. | 0.2 ms |
| `lcmcr(table, J=10, n_iter=10000, burn=2000, thin=4, seed=None, alpha_prior=(0.25,0.25))` | Eq `eq:lcmcr`: truncated stick-breaking DP latent-class model, Beta(1,1) priors on λ, Gamma(a, b) prior on α, p(N) ∝ 1/N. Gibbs sampler at cell level (negative-binomial `n_0`, multinomial class allocations). `N_hat` is the posterior median. Float counts are rounded. | Equal-tailed credible interval. | 0.7–0.9 s |
| `linkage_corrected(table, delta, eps, estimator=loglinear_closed_form, link_var="delta", rate_se=None, **kw)` | Cor `cor:linkcorrect`: solves `E[T(δ,ε) t] = ñ` with `t ← max(0, t + (ñ − E[T(t)]))` starting from `t = ñ`, then applies `estimator(t̂, **kw)`. `extra["t_hat"]` holds the corrected table. `n_obs = Σ t̂`. | Inner interval plus `v_link` (delta method; see Run 2). The inner-only interval is in `extra["lo_cap"]`, `extra["hi_cap"]`. | 1.5 ms plus about 16 inner-estimator calls |

All functions take `level=0.95`.

### LE model (`darkfig.linkerror`)

* `detachment_matrix(K, delta)` returns the `(2^K−1)²` detachment operator in bitmask order. It is upper-triangular and invertible for δ < 1.
* `expected_observed(t, delta, eps)` returns the expected observed table: exact detachment, followed by first-order merging exactly as in SPEC. The output has the same type as `t`.
* `simulate_observed(t, delta, eps, rng)` is the Monte Carlo version, applied to individual incidents. Detached records become singletons. Each singleton is selected with probability ε. Selected singletons merge one at a time, in random order, into a uniformly chosen current cluster that does not already contain their list. A selected singleton that has itself been absorbed earlier does not merge again; this convention affects only O(ε²) terms.

## Notes

1. **The `n_0` sampling term.** The log-linear intervals add `1/μ̂0` to `Var(log μ̂0)` by default (`n0_sampling_var=True`). This covers the *realised* N, because `N̂ − N = μ̂0 − n_0` and `Var = Var(μ̂0) + μ0`. For K = 2 it reproduces the classic LP multinomial variance exactly. Without the term, the independence model and the BMA reached only about 0.90 coverage in our checks. For the saturated closed form it is negligible. `n0_sampling_var=False` gives SPEC's `Σ 1/n_h`.
2. **LCMCR verification.**
   * With `J = 1` the sampler matches the exact posterior of N, which has a closed form for J = 1. This checks the `n_0` step.
   * A Geweke (2004) joint-distribution test with N fixed recovers the prior of (λ, π, α). This checks the allocation, λ, stick-breaking and α steps. It caught a real numerical bug: with small α, a floor on `1 − V_j` biased the α update. The stick-breaking is now computed in log space.
   * The chain starts with all units in one class. A uniform random start needs about 2000 extra burn-in iterations.
   * The defaults retain 2000 draws (10000 iterations, 2000 burn-in, thin 4). Passing only `n_iter=3000, burn=1000` keeps `thin=4` and therefore only 500 draws.
   * Coverage results are in the section below.
3. **Log-linear fits.** The IRLS reports `converged=False` when coefficients diverge, that is, when zero cells put the MLE on the boundary. `loglinear_bma` drops those models (`extra["n_dropped"]`). For very sparse tables, use `cell_correction=0.5`.
4. **Chao interval.** Chao's variance is a lower-bound-type approximation. Under homogeneity its log-normal interval covered 0.91 (R = 200) and 0.95 (R = 400, a different seed) in our checks.

## Verification runs (developer checks, not paper results)

Setup: N = 2000, K = 4, R = 200 tables per scenario, run with the current code. These numbers come from scratch scripts. They are not in `results/` and must not be quoted in the paper.

| scenario | LCMCR | BMA | indep. model | closed form | Chao | LP |
|---|---|---|---|---|---|---|
| independent capture, p = (.30, .25, .20, .35) | bias −0.2%, cov 0.94 | −0.1%, 0.95 | −0.1%, 0.94 | +5.1%, 0.94 | +0.8%, 0.91 | −0.6%, 0.96 |
| two classes (50/50), λ = (.5,.4,.45,.5) and (.15,.2,.1,.25) | −7.6%, 0.68 | −10.6%, 0.06 | −13.3%, 0.00 | +5.0%, 0.95 | −9.2%, 0.01 | −15.2%, 0.05 |

**LCMCR in the weakly identified two-class case.**
* The low-capture class is barely identified with K = 4 lists.
* Long chains (60k iterations, 3 seeds) agree, so this is not a mixing artefact.
* J = 2 gives the same posterior as J = 10.
* The two-class MLE is about unbiased in median but very unstable.
* The shift is therefore prior-driven: the λ ~ Beta(1,1) and p(N) ∝ 1/N priors pull N down.
* The ESS there is low (about 70 per 2000 retained draws). Use longer chains for heterogeneous scenarios, e.g. `n_iter=30000, burn=5000, thin=12`, which takes about 2.5 s.

**Linkage correction** at (δ, ε) = (0.1, 0.02), mean over 150 tables, p = (.5,.45,.4,.55):

| estimator | naive | corrected | oracle |
|---|---|---|---|
| closed form | 3414 | 2027 | 2008 |
| BMA | 2578 | 2003 | 2000 |

