# NOTES-TEXT-REVISER: notation map and structural changes (revision 1)

Owner: TEXT-REVISER. For SIM-REVISER (Section 8, Appendix "Simulation details",
`tables/tab-sim-*.tex`, figure captions in 08) and the orchestrator.

## 1. Symbol renames (referee item 7)

| Quantity | Old | New | Where it changed |
|---|---|---|---|
| Shock loading of stream k | `\beta_k` (also `\beta_j`, `\beta_{k_i}`, `\beta_1` in the univariate case) | `\upsilon_k` (`\upsilon_j`, `\upsilon_{k_i}`, `\upsilon_1`) | everywhere; gamma-prior hyperparameters `a_\beta,b_\beta` -> `a_\upsilon,b_\upsilon` |
| Decay rate of an exponential kernel | `\beta`, `\beta_{kj}` | unchanged | -- |
| Classifier flag rates (eq:data-classerr) | `\eta_0,\eta_1` | `e_0,e_1` | 02, plan S7 |
| Response rate of an exponential shock response | `\eta`, `\eta_k` | unchanged | -- |
| Knot spacing of the spline background (days) | `K_b` (plan: "one knot per K_b=60 days", S1 grid) | `h_b` (`h_b=60`; S1: `h_b\in\{30,60,120,365\}`) | 06, 09, plan appendix, notation table |
| Number of background basis functions | `K_b` | `K_b` (only this meaning now) | -- |
| Dark-figure ratio (companion paper) | `D_k`, `D` (`p=1/D`, `Var(\hat D)/D^4`) | `\mathcal D_k`, `\mathcal D` | 02, 04 (cor:th-darkfig), notation table |
| Direct component of the surge decomposition | `D_k` | unchanged | -- |
| Reporting delay (ass:fc-report, prop:nowcast(c)) | `D`, `D_j`, `D_i`; `\E e^{-\beta D}` | `d`, `d_j`, `d_i`; `\E e^{-\beta d}` (matches 02's `d_i`) | 07, A2. **08 lines ~261 and ~317 still print `\E e^{-\beta D}`: please change to `\E e^{-\beta d}`.** |
| Placebo design (06, step 2) | `\mathcal D_c` | `\mathcal R_c` | 06 |
| Shock-response family in cor:equiv-id(i) | `\Psi_k` | `\mathfrak S_k` | 04 (`\Psi_k` now only the response CDF `\int_0^u\psi_k`) |
| Functional in the proof of prop:granger | `\Psi(t,x_{-j})` | `\tilde h_k(t,x_{-j})` | A1 |
| Cox/shot-noise driver | `\xi(t)`, `\xi_k` | unchanged (now the only meaning of `\xi`) | -- |
| Nuisance parameters of the boundary LRT | `\xi`, `\Xi`, `I_{\alpha\xi}`, `I_{\xi\xi}`, `I_{\alpha\alpha\cdot\xi}`, `U_{T,\xi}` | `\vartheta_2`, `\Theta_2`, `I_{\alpha2}`, `I_{22}`, `I_{\alpha\alpha\cdot2}`, `U_{T,2}` | 06, supplement, B |
| Forecasting/alerting state `(x(t),u(t))` | `\bm\xi(t)` | `\bm\chi(t)` (coordinates `\chi_i`) | 07, A2, supplement |
| Thinning matrix | `\bm P=\operatorname{diag}(p_k)`, `\bm N^{\bm P}` | `\operatorname{diag}(\bm p)`, `\bm N^{\bm p}` | 04, A1. Bold `\bm P` now means only the operator of prop:irf(c) (and A2's Hurwitz lemma). |
| Refinement index in the proof of prop:th-cm | `\iota` | `L` | A1 (`\iota_{kj}` stays the spike-and-slab indicator) |
| Resolvent residues in the proof of prop:th-cm | `\upsilon_l` | `\rho_l` | A1 (frees `\upsilon` for loadings) |
| Cumulant expression in the proof of cor:equiv-id(ii) | `\mathcal D` | `\mathcal Y` | A1 |
| Hypoexponential label | `eq:at-kappa` | `eq:at-hypoexp` | 05, A2 |

Notes for Section 8 and its tables. Table rows for the loading should read `\upsilon_3`, not `\beta_3`
(SIM-REVISER reports this is done). The E2 spline background is "`K_b=20` basis functions, knot
spacing `h_b\approx59` days" if you want to use the symbols.

## 2. New labels SIM-REVISER may cite

- `ex:th-mv-cross`: Example in Section 4. With `A=[[s,c],[c,s]]`, equal `\mu`, the second-order
  structure is impossible for any Cox process iff `c>s`; for `A=[[0,a],[a,0]]` the eigenvalue
  is `\bar\Lambda\{(1+a)^{-2}-1\}<0`. A scratch simulation (`a=0.5`, `\beta=\mu_k=1`, 3,996 windows of
  length 50) gives `Var(N_1-N_2)/E(N_1+N_2)=0.450` against the limit 0.444. Not part of Section 8.
- `eq:est-chibar` (chi-bar-square limit), `eq:est-suplr` (sup-LR statistic over a decay grid),
  `eq:est-pboot` (parametric-bootstrap p-value): Section 6.5.
- `app:est-supp`, `app:est-edge`, `app:est-gibbs`, `sec:est-nonpar`, `app:est-inar`,
  `app:est-lrt` (holds `prop:lrt`), `app:est-davies`, `app:est-gof` (holds `prop:rescaling`),
  `app:est-proofs`: supplement to Section 6. `app:fc-supp`, `app:fc-pgf` (`rem:fc-pgf`),
  `app:fc-sis` (`lem:fc-is`, `alg:alert`), `app:fc-brier` (`rem:fc-brier`),
  `sec:fc-cusum` (`rem:fc-cusum`): supplement to Section 7.
- `app:data`, `app:data-incidents` (holds `tab:data-streams`), `app:data-platform`,
  `sec:data-lit`; `app:plan` (all `sec:plan-*` labels, `tab:plan-timeline`); `app:ethics`
  (all `sec:ethics-*` labels).
- `app:fw-proofs` (proofs for Section 3, in Appendix A), `app:at-mean` (holds `lem:at-mean`),
  `app:at-remarks` (holds `rem:at-background`, `rem:at-expost`), `app:at-grad` (holds
  `eq:at-grad`), `sec:at-example` (holds `tab:at-illus`, now in Appendix B).

All old labels are preserved; only their location changed. `alg:em` is now in the
Section 6 supplement, so algorithm numbers changed (EM is Algorithm 1, imputation
Algorithm 2, Ogata thinning Algorithm 3).

## 3. Registered block test (referee item 6), for consistency with Section 8's "Not run"

Each step of the hierarchy (M0->M1, M1->M2, M2->M3, M3->M4 online->offline block, then the
offline->online block) is decided by the sup-LR statistic over `G=9` decays with half-lives
log-spaced from 0.5 to 21 days, referred to a parametric bootstrap from the smaller model's fit
with `B=499`; the block tests form a fixed sequence at level 0.05; entry-level tests within
accepted blocks form one Holm family at 0.05. Fallbacks if the synthetic dry run (V4) fails:
score-based sup-statistic with `B=999` (cost failure), then a decay fixed at the grid median
(half-life 3.2 days) with a bootstrap LR test (size failure), then log score only with
exploratory estimates. V4 uses `R=200` datasets per configuration and passes the size check
if the rejection rate is at most 0.075.

## 4. Simulation facts used in owned text (from results/SUMMARY.md, final)

Abstract, Section 1 (trap ii, C7), Section 4 (rem:th-spurious(ii), after cor:th-darkfig),
Section 7.1 (calibration paragraph) and Section 11 use: apparent branching ratios up to 0.63;
the ML gap of 0.06--0.07 below `n*` for rare large shocks persists at `T=10,000`; known event
times largely remove the artefact where tested, a single spline does not; max |mean ML - n'| =
0.0104; a 30--50% error in `p` sets a precision floor; forecasts that ignore future events
under-forecast, integrating forecasts are calibrated when pooled; 62% of surges begin with an
event in the window, recall 28% for these and 89% otherwise; the nowcast removes the state bias
but does not lower alert costs; on Hawkes-generated data the plug-in rule beats two simple
baselines that are not the plan's. All `% ALIGN-WITH-SIM` markers have been resolved and removed.
