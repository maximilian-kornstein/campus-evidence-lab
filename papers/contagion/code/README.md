# `hawkes`: Hawkes-process library for *Shock and Contagion*

Owner: SIM-CORE. This is the library that the simulation study (SIM-EXP, `run_experiments.py`) runs on. It handles multivariate Hawkes processes with exponential kernels and exogenous shocks, in the notation of `../SPEC.md`:

```
lambda_k(t) = mu_k(t) + sum_e shock_beta[k] S_e eta_k exp(-eta_k (t - tau_e))
                      + sum_j sum_{t_l^j < t} alpha[k, j] beta[k, j] exp(-beta[k, j] (t - t_l^j))
```

`alpha[k, j]` is the expected number of direct offspring in stream k per event in stream j, so the branching matrix is A = `alpha`. Streams are indexed `k = 0..M-1`. Events are a `list` of M sorted `np.ndarray`s on `[0, T]`.

Requirements: Python 3.13 with numpy and scipy (pytest for the tests). Nothing else.

## Running the tests

```bash
cd papers/contagion/code
OPENBLAS_NUM_THREADS=1 nice python -m pytest tests/test_hawkes.py -q                # all 24 tests, ~75 s (load avg ~11)
OPENBLAS_NUM_THREADS=1 nice python -m pytest tests/test_hawkes.py -q -m "not slow"  # 21 quick tests, ~20 s
```

`OPENBLAS_NUM_THREADS=1` stops BLAS from spawning threads on the shared machine. The `slow` marker covers the LRT size/power study, the Davies bootstrap and the pairwise-beta EM recovery. It is not registered in a pytest config, so pytest may print an "unknown mark" warning (add `-p no:warnings` to silence it).

Import the package with `code/` on `sys.path`, e.g. run from `code/`, or `sys.path.insert(0, ".../code")` as the tests do.

## API

### `hawkes.model`

| object | description |
|---|---|
| `HawkesSpec(M, mu, alpha, beta=1.0, shocks=[], shock_beta=None, shock_rate=1.0)` | Dataclass. `mu` is an `(M,)` array of constants, a `Background`, or any callable `t -> (M,)`. `beta` is a scalar or `(M, M)`. `shocks` is a list of `(tau_e, S_e)`. `shock_beta` holds the `(M,)` loadings. `shock_rate` (η) is a scalar or `(M,)`, with response kernel ψ(t) = η e^{−ηt}; `shock_kernel_rate=` is accepted as an alias. Properties: `beta_matrix`, `shock_rate_vec`, `shock_times`, `shock_sizes`, `constant_mu`. Methods: `mu_at(t)` → (n, M), `mu_cumulative(t)` → (n, M), `mu_bar(T)`, `spectral_radius()`, `multiplier()`, `stationary_mean(T=None)`, `copy(**changes)`. |
| `PiecewiseConstant(breaks, values)` | Piecewise-constant background; `values` is (P, M). Cluster simulation is exact. |
| `BSplineBasis(T, n_basis=8, degree=3)`, `FourierBasis(T, period, n_harmonics, trend=False)` | Bases B(t). |
| `LogLinearBackground(theta, basis)` | μ_k(t) = exp(B(t)'θ_k), with θ of shape (M, n_basis). The EM spline fits return this. |
| `FunctionBackground(f, M, vectorized=None, bound=None)` | Wraps a user callable. Use `vectorized=True` if `f` maps (n,) → (n, M). `bound` is a known upper bound for thinning. |
| `spectral_radius(A)`, `multiplier(A)` (= (I − A)^{-1}, alias `contagion_multiplier`), `stationary_mean(spec)` or `stationary_mean(mu, A)` | Helpers. `stationary_mean(spec, T)` time-averages a varying μ. |
| `merge_events(events)` → `(times, dims, pos)` | The time-sorted merged sequence. It defines the **global index** used by branching labels. |

### `hawkes.simulate`

* `simulate(spec, T, rng, return_branching=False, method="auto", mu_bound=None)` → `events` or `(events, labels)`.
  * `method="auto"`/`"cluster"` is exact cluster/branching simulation (Hawkes & Oakes 1974), vectorised by generation.
    * Constant and piecewise-constant backgrounds draw their immigrants directly.
    * A callable background draws its immigrants by Lewis–Shedler/Ogata thinning against `mu_bound` (default: 1.05 × grid maximum).
    * Shock immigrants are drawn as Poisson(β_k S_e) events at τ_e + Exp(η_k).
  * `method="ogata"` is Ogata (1981) thinning of the whole process (Python loop, ~10x slower). It is an independent exact algorithm, tested against the cluster method.
  * `labels[k][i]` is −1 for a background immigrant, −2−e for an immigrant of shock e, and otherwise the global index of the parent.
* `cluster_info(events, labels)` returns a dict of merged arrays: `times`, `dims`, `parent`, `root` (−1 or −2−e), `root_index` and `generation`.
* `simulate_shot_noise_cox(nu, rho, a, gamma, T, rng, return_shots=False)` simulates a stationary shot-noise Cox process (no contagion) for the identification experiments. Its intensity is ν_k + Σ_{s_i<t} a_k e^{−γ_k(t−s_i)}, with common Poisson(ρ) shots; pre-sample shots go back 40/γ.
* `cascade(alpha, beta, t0, d0, t_end, rng, carry=None)` is the low-level vectorised branching engine.

### `hawkes.likelihood`

* `loglik(spec, events, T, per_stream=False)` is the exact log-likelihood. It uses the vectorised O(n) Ogata recursion, with all shock terms and the full compensator.
* `intensity(spec, events, t)` → (n, M): λ(t−) at arbitrary times.
* `compensator(spec, events, t)` → (n, M): Λ(t).
* `DecaySums(src, b, lag=False)` is the core kernel. It computes Σ_{s<t} e^{−b(t−s)} (and the lag-weighted sum) at any targets in O(n). It is exact (chunked rescaling, no truncation window); relative error ~1e-13, limited by the rounding of absolute times.

### `hawkes.em`

`fit_em(events, T, M=None, background="const"|"spline", shocks=None, n_basis=8, beta_fixed=None, max_iter=500, tol=1e-6, *, beta_structure="scalar"|"matrix", alpha_mask=None, shock_rate_structure="scalar"|"vector", shock_rate_fixed=None, basis=None, init=None, beta_init=None, beta_bounds=None, compute_se=False, ...)` → `FitResult`.

* EM via the latent branching structure (Veen & Schoenberg 2008).
  * **E-step:** exact. It uses the exponential-kernel recursions (`DecaySums`), with no pairwise matrix and no truncation window, at O(n M²) per iteration.
  * **M-step:** μ_k = Σ P(bg)/T in closed form.
    * The spline θ_k gets a few Newton steps with step halving.
    * (α, β): α is profiled out as α_kj = N_kj/G_j(β), and β solves N/β − W − N G′/G = 0 by a monotone fixed-point iteration, with Brent as a fallback.
    * Shock loadings and η are handled in the same way.
  * The log-likelihood is non-decreasing (`loglik_trace`).
* `beta_fixed` is a scalar or an (M, M) array; NaN entries are free.
* `alpha_mask` is a bool (M, M); `False` fixes the entry at 0.
* The likelihood can be multimodal in β. With weak excitation or slow kernels there is a spurious "tiny α, huge β" mode. So, without `init`/`beta_init`, the **profile** log-likelihood (EM with β fixed, `grid_iter=40`) is evaluated on an `n_grid=8`-point log grid over [min(0.05 n/T, 20/T), 200 n/T]. The free EM then starts from every local maximum of that grid profile (at most `n_starts=3`) and keeps the best optimum. Across 25 datasets, including weak and slow kernels, this came within 0.03 log-lik units of a dense 13-start reference.
* `accelerate=True` (the default) adds SQUAREM extrapolation (Varadhan & Roland 2008). It is accepted only if it increases the log-likelihood, so the fixed point is the same as plain EM and the trace stays monotone. It cuts EM-map evaluations 2–7x. `n_iter` counts EM-map evaluations.
* Cost: one E-step is ~1–1.5 ms for 2000 events with M = 3. A full fit with the β grid takes ~0.5–1.5 s on the shared machine; with `init` (warm start) it takes ~0.1 s.
* `FitResult` fields:
  * `spec`, `loglik`, `n_iter`, `converged`, `loglik_trace`, `n_params`, `aic`, `bic(n)`.
  * `se`: a dict with `mu`/`theta`, `alpha`, `beta`, and, if shocks are present, `shock_beta`/`shock_rate`. It comes from the numerical Hessian of the exact log-likelihood.
  * `se_flag`: "ok", or which entries sit on the boundary (α ≈ 0 has no SE).
* `decluster(spec, events, T)` gives per-stream (n_k, 1+E+M) branching probabilities, with columns [background, shocks, parent stream].
* Use `tol=1e-8` for parameter-recovery and LRT work. The default `1e-6` (relative) stops within ~0.05 log-lik units of the maximum.

### `hawkes.tests_alpha`

* `lrt_alpha_zero(events, T, k, j, *, shocks=None, background="const", beta_mode="common"|"fixed", fit_alt=None, tol=1e-9, return_fits=False, multistart_null=True, **fit_kwargs)` → `(stat, pvalue)`. This is the boundary LRT of H0: α_kj = 0, with the χ̄² null 0.5χ²₀ + 0.5χ²₁ (Self & Liang 1987). Its p-value is 0.5·P(χ²₁ ≥ stat); the 5% critical value is `CHIBAR_CRIT_05` = 2.706.
  * `"common"` (the default): a shared β re-estimated under both hypotheses; regular when another α > 0.
  * `"fixed"`: β fixed at the alternative's estimate in both fits; usable with pairwise β, but ignores the Davies problem.
  * The null fit is started from the alternative optimum (with α_kj = 0) and, by default, also from the profile-grid multistart. If the null ever beats the alternative, the alternative is refitted from the null optimum.
* `lrt_alpha_zero_sup(events, T, k, j, beta_grid=None, n_boot=99, rng=None, ...)` → dict(`stat`, `pvalue` (parametric bootstrap from the H0 fit), `pvalue_naive`, `beta_hat`, `lr_profile`, `boot_stats`, `fit_null`, `fit_alt`). This is the Davies-aware sup-LR over a grid of a pair-specific β_kj, while the other entries share a free β.
* `chibar_pvalue(stat)`.

### `hawkes.rescaling`

* `time_rescale_ks(spec, events, T, pooled=False)` → `(ks_stat (M,), pvalue (M,))`. It runs a KS test of the compensator increments against Exp(1) (Brown et al. 2002).
* `rescaled_intervals(spec, events, T)`.
* `ks_uniform_bands(n)`.

### `hawkes.inar`

* `bin_counts(events, T, delta)` → (n_bins, M).
* `fit_inar(counts, p, method="cls"|"nnls"|"poisson")` → `INARFit(nu, Theta (p, M, M), ...)`. CLS is Kirchner's estimator. The Gram matrix is built exactly from lagged cross-products, so 60k bins × 60 lags takes ~0.5 s.
* `inar_to_hawkes(fit, delta)` → dict(`mu` = ν/Δ, `A` = Σ_l Θ_l, `beta` (geometric-decay moment estimator, rough), `kernel` = Θ_l/Δ, `lags`).
* Approximation (Kirchner 2016, 2017): Θ_l ≈ Δ Φ(lΔ), with O(Δ) error. For an exponential kernel, A is biased by about −βΔ/2 (right Riemann sum) and by −A e^{−βpΔ} (truncation). Use βΔ ≲ 0.1 and pΔ ≳ 5/β.

### `hawkes.attribution`

* `decompose_surge(spec, shock_index, H, background="process"|"stationary", spillover_through=None)` → dict.
  * Scalar totals `background`, `other_shocks`, `direct`, `contagion`, `total`, `shock_total`.
  * `by_stream`: (M,) arrays.
  * `infinite`: H = ∞; direct = β∘S, total = (I − A)^{-1} direct.
  * `window` and, optionally, `spillover`.
* Exact for exponential kernels: the expected-intensity response is a finite linear ODE system, solved with `scipy.linalg.expm`. "process" gives the exact expectation for the process started empty at 0, which is what `simulate` produces.
* `spillover(spec, e, H, through)` is the counterfactual "total − total with A[:, j] (or A[k, j], or a mask) zeroed". It returns `horizon`, `infinite` and shares of the shock-e contagion. Equivalently, it counts the shock-rooted events whose ancestry passes through j (or uses the j → k channel); this is checked by Monte Carlo.
* `impulse_response(spec, u, shock_index=e | source=j)` gives the IRF (Prop prop:irf). `source=j` gives the resolvent column R(u)[:, j].
* `expected_counts(spec, t0, t1)` returns the exact expected counts split by root.

### `hawkes.alert`

* `predictive_count_dist(spec, history_events, t, Delta, n_sim, rng, include_future_shocks=False)` → (n_sim, M) counts. It is an exact Monte Carlo continuation from the excitation state E(t), with all replicates vectorised.
* `predictive_mean(...)` is the exact mean.
* `excitation_state(spec, history, t)` → E (M, M).
* `exceedance_probability(counts, c, streams=None)`.
* `optimal_alert_threshold(c_fa, c_miss)` = c_FA/(c_FA + c_miss). `alert_decision(prob, c_fa, c_miss)` returns `prob >= π*`.
* `alert_rule_intensity(spec, Delta, c, pi_star | (c_fa, c_miss), n_sim, rng, streams=None, state_direction=None, t=0)` → dict(`s_star`, `lambda_star`, `grid`, `prob`). It finds the equivalent threshold on the current intensity, using a coupled simulation that is exactly monotone in the state. This is exact for M = 1. For M > 1 it holds along a state direction D, by default ∝ α∘β.

### `hawkes.thinning`

* `thin(events, p, rng)`: p is a scalar or per stream.
* `apparent_branching(n, p)` = 1 − (1−n)/√((1−n)² + p(1−(1−n)²)).
* `apparent_beta(n, beta, p)` = √(β²(1−n)² + pβ²(1−(1−n)²)).
* `apparent_mu(mu, n, p)`.
* `inverse_apparent_branching(n_app, p)`.
* `correct_thinning(n_app, beta_app, mu_app, p)` → (n, β, μ).
* `spurious_branching(kappa)` = 1 − (1+κ)^{-1/2}, where κ is the excess Fano factor of the background.
* `shot_noise_equivalent_hawkes(nu, rho, a, gamma)`.
* Second-order helpers `hawkes_covariance_density`, `hawkes_count_variance` (the variance-time curve) and `thinned_count_variance`.

These formulas are for univariate exponential Hawkes processes (Thm thm:thinning, thm:equiv, thm:spurious). They are matched on the mean and the Bartlett spectrum.

## Validation summary (tests/test_hawkes.py)

* Simulation:
  * mean counts match the exact expectation and (I − A)^{-1}μT;
  * piecewise backgrounds and shocks match exact window expectations;
  * Ogata and cluster sampling agree;
  * branching labels are consistent.
* The log-likelihood, intensity and compensator match O(n²) brute force to 1e-11, including with shocks (with τ < 0), pairwise β, spline backgrounds and piecewise backgrounds.
* EM recovers μ, A and β (z-scores within 4 observed-information SEs), with a monotone trace.
  * It is also tested with pairwise β, with shocks (loadings and η), and with a spline background. The spline fit beats the constant fit, and the misspecified constant fit inflates ρ(A).
* LRT: size ≤ 0.15 at nominal 0.05 (R = 40); about half the statistics are 0 (χ̄²); power ≥ 0.75. The Davies bootstrap runs end to end.

Larger offline checks (not part of the suite; scratch scripts, so the numbers are not citable in the paper):

* EM recovery for M = 3, β = 1.5, 50 replicates per size:
  * T = 1500 (~2100 events): RMSE(μ_k) ≈ 0.02 (7–10% relative); RMSE(α_kj) has mean 0.029 and max 0.039; β has bias +0.019 and RMSE 0.14 (9%).
  * T = 3000 (~4200 events): RMSE(μ) ≈ 0.015; RMSE(α) has mean 0.020; β has bias +0.004 and RMSE 0.07.
  * Observed-information SEs: z-score SD 0.93–1.03; 95% coverage 0.94–0.96 at T = 1500.
* LRT size (M = 2, ~900 events, 200 replicates): 0.085 / 0.03 / 0.01 at nominal 0.10 / 0.05 / 0.01, with P(stat ≈ 0) = 0.565. It is slightly conservative.
* Time-rescaling KS p-values are uniform under the true model, and a Poisson model is rejected.
* `decompose_surge` (background, other shocks, direct, contagion and two spillover variants) matches Monte Carlo branching-label counts within 4 SE. IRF integrals equal (I − A)^{-1} − I.
* Thinned variance-time curves match the formula (the unthinned n is rejected). The shot-noise Cox process matches its equivalent Hawkes process's variance-time curve.
* INAR on Δ = 0.1 bins recovers A within 0.07 and μ within 20%.
* The predictive MC mean equals the exact predictive mean, and P(surge) at the intensity threshold equals π*.
