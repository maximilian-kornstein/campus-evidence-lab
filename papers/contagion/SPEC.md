# Paper 2 — Shock and Contagion (team spec)

**Working title:** *Shock and Contagion: Self-Exciting Point Processes for Surges in Antisemitic Incidents*
**Subtitle idea:** separating exogenous shocks, offline contagion, and online-to-offline spillover.
**Author line:** Kornstein Lab for Antisemitism Research · November 2026
**Genre:** a rigorous methods paper. It contains (a) new formal results with complete proofs, (b) a reproducible **simulation study on synthetic data with known ground truth**, and (c) a **pre-registered analysis plan** for real data.
**Companion:** Paper 1, *The Dark Figure* (`../dark-figure/`). It estimates how many incidents go unrecorded. Paper 2 uses its output: recorded incidents are a *thinned* version of true incidents.

## Non-negotiable honesty rules
1. **No empirical findings about real-world antisemitism are reported.** We have fit no model to real data. Never write "we find that incidents are contagious" or "X% of the surge was contagion". Real-world facts may be cited only when they are published by the named source and appear in a bib file with a verified citation. If unsure, leave it out or wrap it in `\factcheck{...}`.
2. **Every number in the simulation section must come from `results/*.json` produced by `code/`.** No invented numbers.
3. **Every theorem gets a complete proof.** State the assumptions explicitly. Attribute known results honestly:
   - Hawkes 1971;
   - Hawkes & Oakes 1974 (cluster representation);
   - Ogata 1981/1988 (thinning simulation, ETAS);
   - Daley & Vere-Jones (point-process theory, Bartlett spectrum);
   - Brémaud & Massoulié;
   - Veen & Schoenberg 2008 (EM);
   - Marsan & Lengliné 2008 (MISD);
   - Mohler et al. 2011 (self-exciting crime models);
   - Eichler, Dahlhaus & Dueck 2017 (Granger causality for Hawkes);
   - Kirchner 2016 (Hawkes ↔ INAR(∞));
   - Self & Liang 1987 (boundary LRT);
   - Brown et al. 2002 (time-rescaling).
   Frame our contributions as synthesis, generalisation and application, and say "we show" only where something is new to our knowledge.
4. Politically sensitive subject. Exogenous "shocks" are described neutrally as *salient external events* (e.g. geopolitical escalations, terror attacks, high-profile public statements). The paper takes no political position on any event.

## Contributions (the Introduction will list these)
- **C1 Framework.** Multivariate marked Hawkes processes with exogenous shocks for antisemitic incidents across regions, offence types and online/offline channels. The branching matrix A, the contagion multiplier M = (I − A)^{-1} and stationarity (spectral radius < 1).
- **C2 Identification: contagion vs. common shocks.**
  - (a) Second-order observational equivalence: a stationary Hawkes process with an exponential kernel has exactly the same mean and Bartlett spectrum as a shot-noise Cox process with no contagion (Thm `thm:equiv`). Second-order statistics, i.e. autocorrelation of counts, cannot distinguish contagion from clustered exogenous shocks.
  - (b) Identification restored by exogenous shock timing, by likelihood (higher-order) information, or by marks (Cor `cor:equiv-id`).
  - (c) A misspecified (constant) background produces *spurious contagion*, with an explicit pseudo-true branching ratio (Thm `thm:spurious`).
  - (d) Granger non-causality from online to offline ⇔ α_{off,on} = 0 (Prop `prop:granger`, attributed to Eichler et al.).
- **C3 Under-reporting masks contagion.** If each incident is recorded independently with probability p (Paper 1's coverage), the recorded process has an *attenuated apparent branching ratio* n_obs < n, with a closed form for exponential kernels (Thm `thm:thinning`). Dark-figure correction feeds into contagion estimation.
- **C4 Surge attribution.** Closed-form decomposition of expected incidents after a shock into background, direct shock response and contagion cascade via the resolvent/multiplier (Thm `thm:attribution`), with impulse-response functions for exponential kernels (Prop `prop:irf`) and the multivariate online→offline spillover share.
- **C5 Estimation & testing.**
  - EM via the latent branching structure (Alg `alg:em`).
  - Bayesian estimation with shrinkage on A.
  - Discrete-time INAR approximation for binned online volumes.
  - Nonparametric kernels.
  - Time-rescaling goodness of fit.
  - A boundary-corrected likelihood-ratio test for α_kj = 0 (Prop `prop:lrt`, chi-bar-square, attributed to Self & Liang).
- **C6 Forecasting and alerting.** Predictive distributions over the next Δ days. An optimal alert rule that minimises expected cost of false alarms vs. missed surges (Thm `thm:alert`, Alg `alg:alert`). Proper scoring, calibration (PIT), and nowcasting under reporting delays.
- **C7 Simulation study** with known ground truth: recovery of A, spurious contagion under misspecification, thinning attenuation and its correction, surge-attribution accuracy, and alert performance.
- **C8 Pre-registered analysis plan** (e.g. city-level daily incident data such as NYPD hate-crime complaints, national incident audits, an external-event calendar from event datasets such as ACLED/GDELT, and online volume series), with an ethics protocol.

## File ownership (write ONLY your own files)
| File | Owner |
|---|---|
| `main.tex`, `preamble.tex`, `sections/01-introduction.tex`, `sections/11-discussion.tex`, `figures/*.tex` (TikZ) | LEAD |
| `sections/02-data.tex`, `sections/09-analysis-plan.tex`, `sections/10-ethics.tex`, `bib/sources.bib` | SOURCES |
| `sections/03-framework.tex`, `sections/04-identification.tex`, `appendix/A1-identification-proofs.tex`, `bib/theory.bib` | THEORY |
| `sections/05-attribution.tex`, `sections/07-forecasting.tex`, `appendix/A2-attribution-proofs.tex`, `bib/attribution.bib` | ATTRIB |
| `sections/06-estimation.tex`, `appendix/B-computation.tex`, `bib/estimation.bib` | ESTIM |
| `refs.bib` (canonical verified core bibliography), `bib/KEYS.md` | BIB |
| `code/hawkes/*.py` (simulate, likelihood, em, tests-of-α, rescaling, inar, attribution, alert), `code/tests/test_hawkes.py` | SIM-CORE |
| `code/run_experiments.py`, `code/make_figures.py`, `code/tests/test_experiments.py`, `results/`, `figures/*.pdf`, `tables/*.tex` | SIM-EXP |
| `sections/08-simulation.tex`, `appendix/C-simulation-details.tex` | written in phase 2 from real results |

Bib keys: lowercase `lastnameYEAR` (e.g. `hawkes1971`, `mohler2011`, `eichler2017`). Extra refs go in your own `bib/<owner>.bib`. Add `note = {VERIFY}` if unsure.

## Notation (use exactly)
- Streams (dimensions) k ∈ [M]; for example offline incidents by region and type, and online volume streams. Points t_i^k on [0, T]. Counting process N_k(t), history \Hist_t.
- Conditional intensity:
  λ_k(t) = μ_k(t) + Σ_e β_k S_e ψ_k(t − τ_e) + Σ_j ∫_0^{t−} φ_kj(t − s) dN_j(s),
  where φ_kj = α_kj g_kj, ∫ g_kj = 1, and α_kj ≥ 0 (expected direct offspring in k per event in j).
- Branching matrix **A** = [α_kj] (macro `\Amat`); spectral radius ρ(A) < 1 (macro `\spr`). Contagion multiplier **M** = (I − A)^{-1} (`\Mmat`). Kernel matrix Φ(t) = [φ_kj(t)] (`\Phik`); resolvent R = Σ_{n≥1} Φ^{*n} (`\Rker`).
- Exponential kernels: g(t) = β e^{−βt}. Univariate branching ratio n = α. Stationary mean rate Λ̄ = μ/(1−n).
- Exogenous shocks e: times τ_e, sizes S_e, response kernel ψ_k (∫ψ = 1), loadings β_k.
- Background μ_k(t) = exp(B(t)'θ_k) with a spline/seasonal basis B. Note: calendar effects, e.g. holiday periods, are background, not shocks.
- Recording (thinning) probability p_k, the reciprocal of Paper 1's dark-figure ratio. Reporting delay distribution F_k(d).
- Surge decomposition after shock e over horizon H: E[N_k(τ_e, τ_e+H]] = B_k + D_k + C_k (background, direct, contagion).
- Alerting: window Δ, count threshold c, alert probability threshold π*, costs c_FA and c_miss.

## Label registry
Sections: `sec:intro`, `sec:data`, `sec:framework`, `sec:identification`, `sec:attribution`, `sec:estimation`, `sec:forecasting`, `sec:simulation`, `sec:plan`, `sec:ethics`, `sec:discussion`. Appendices: `app:idproofs`, `app:attrproofs`, `app:computation`, `app:simdetails`.
Results:
- THEORY: `thm:equiv`, `cor:equiv-id`, `thm:spurious`, `thm:thinning`, `prop:granger`, `prop:stationary`.
- ATTRIB: `thm:attribution`, `prop:irf`, `thm:alert`, `alg:alert`, `prop:nowcast`.
- ESTIM: `alg:em`, `prop:lrt`, `prop:rescaling`, `eq:inar`.
- LEAD: `fig:branching`, `fig:network`, `fig:attribution`.
- SIM: `fig:sim-*`, `tab:sim-*`.
Use your own prefix for extra labels.

## LaTeX rules
Same as Paper 1:
- Each section file starts with `\section{...}\label{...}`.
- Shared theorem counter; environments theorem/proposition/lemma/corollary/definition/assumption/remark/example; `\cref`; natbib `\citet`/`\citep`; `algorithm` + `algpseudocode`.
- Compile with `bash tools/compile.sh` from `papers/contagion/`. It builds into `build/<random>` and is safe for parallel runs. Fix overfull boxes over 10pt in your files.
- No `\usepackage` in section files; request packages in `NOTES-<owner>.md`.
- Paper-2 macros are at the bottom of `preamble.tex`.

## Python rules (SIM)
- Python 3.13, numpy, scipy, matplotlib, pytest only. Deterministic seeds. Use `nice` and at most 2 worker processes on the shared 4-core machine.
- Figures: matplotlib PDF, serif font, mathtext 'stix', width 6.0in or 2.9in, colour-blind-safe palette, no in-plot titles. Match Paper 1's look (`../dark-figure/code/make_figures.py` once it exists).

### Hawkes library API (SIM-CORE implements, SIM-EXP consumes)
```python
from hawkes.model import HawkesSpec      # M, mu (callable or array of const), alpha (MxM), beta (MxM or scalar), shocks: list[(tau, S)], shock_beta (M,), shock_kernel_rate
from hawkes.simulate import simulate     # (spec, T, rng) -> list[np.ndarray] event times per dim (Ogata thinning / cluster sim) [+ optional branching labels]
from hawkes.likelihood import loglik     # (spec, events, T) -> float  (exact for exp kernels, O(n) recursion)
from hawkes.em import fit_em             # (events, T, M, background="const"|"spline", shocks=None, n_basis=..., max_iter=..., tol=...) -> FitResult(spec, loglik, n_iter, se?)
from hawkes.tests_alpha import lrt_alpha_zero  # (events, T, k, j, ...) -> (stat, pvalue)  chi-bar-square 0.5χ²0+0.5χ²1
from hawkes.rescaling import time_rescale_ks  # (spec, events, T) -> (ks_stat, pvalue)
from hawkes.inar import fit_inar        # (counts (T_bins x M), p_lags) -> INAR fit; mapping to Hawkes params (Kirchner)
from hawkes.attribution import decompose_surge  # (spec, shock_index, H) -> dict(background, direct, contagion, by_stream)
from hawkes.alert import predictive_count_dist, optimal_alert_threshold  # Monte Carlo predictive; cost-based threshold
from hawkes.thinning import thin, apparent_branching  # thin events w.p. p; closed-form n_obs for exp kernels (Thm thm:thinning)
```
