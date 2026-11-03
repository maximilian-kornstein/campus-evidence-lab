# `darkfig`: code for the simulation study of *The Dark Figure*

This README covers the **estimator** half of the package (owner: SIM-EST):

| module | contents |
|---|---|
| `darkfig/estimators.py` | public estimator API (`Estimate`, LP, closed form, log-linear model / BMA, Chao, LCMCR, linkage-corrected) |
| `darkfig/loglinear.py` | capture-table utilities, design matrices, batched Poisson IRLS, hierarchical-model enumeration |
| `darkfig/lcmcr.py` | Gibbs sampler for the DP latent-class model (Manrique-Vallier 2016) |
| `darkfig/linkerror.py` | the canonical linkage-error operator T(δ, ε) of SPEC (expected and Monte Carlo) |
| `tests/test_estimators.py` | tests for all of the above |

`world.py`, `linkage.py` and `pipeline.py` (synthetic worlds, record linkage, pipelines) are maintained by SIM-WORLD.

Requirements: Python 3.13 with numpy, scipy and pytest. Nothing else.

## Running the tests

```bash
cd papers/dark-figure/code
nice python -m pytest tests/test_estimators.py -q               # all 32 tests, about 30 s
nice python -m pytest tests/test_estimators.py -q -m "not slow" # 27 quick tests, about 5 s
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
| `linkage_corrected(table, delta, eps, estimator=loglinear_closed_form, **kw)` | Cor `cor:linkcorrect`: solves `E[T(δ,ε) t] = ñ` with `t ← max(0, t + (ñ − E[T(t)]))` starting from `t = ñ`, then applies `estimator(t̂, **kw)`. `extra["t_hat"]` holds the corrected table. `n_obs = Σ t̂`. | As the inner estimator. | 1.5 ms plus the inner estimator |

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

