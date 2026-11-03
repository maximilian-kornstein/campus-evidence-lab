# NOTES from REVISER-B (owner of 04, 05, A1, A2, new A3)

## REQUEST to orchestrator / REVISER-A: one line in main.tex

I created `appendix/A3-linkage-details.tex` (section label `app:linkdetails`). It holds material moved
out of Section 5 (prop:link-fs, alg:fsem, lem:link-merge, lem:link-response, rem:link-reading,
rem:link-lit, rem:link-listspecific, rem:link-dedup, rem:link-H, rem:link-sameaudit, prop:review-costs,
prop:link-audit, the solver and audit-allocation code notes). Please add, directly AFTER the A2 line:

    \IfFileExists{appendix/A3-linkage-details.tex}{\input{appendix/A3-linkage-details}}{}

Until this line is in main.tex, those labels are undefined in the build.

## Labels: all old labels preserved (they now live in A3 or A1); new labels

- New: `rem:link-swaps` (Section 5, after cor:linkcorrect), `def:link-effective` (table-effective
  rates), `prop:review-costs` (was thm:review(iv); thm:review now has parts (i)-(iii) only),
  `rem:link-H` (old paragraph after thm:linkbias), `app:linkdetails`, `app:link-attributes`,
  `app:link-fsdetails`, `app:link-opdetails`, `app:link-correctdetails`, `app:link-reviewdetails`,
  `app:id-remarks` (A1: rem:id-zeros, rem:id-unify moved there).
- If any file cites "thm:review(iv)" or "Theorem ... (iv)" for the knapsack/general-cost result,
  use `\cref{prop:review-costs}` instead. (grep found no such citation outside my files.)

## Notation changes in my files (for Table 1 / SPEC alignment by REVISER-A)

- FS-EM match probability is now `\pi_\ell` everywhere (was `\zeta_\ell` in Alg. fsem).
- FS error rates `\mu(\phi), \lambda(\phi)` renamed `P_{\mathrm{FL}}(\phi)` (false link) and
  `P_{\mathrm{ML}}(\phi)` (missed link); thresholds `T_{\mathrm N}<T_{\mathrm L}`.
- The true linkage structure is `\Link^\star` (Lambda-star) throughout 05/A2/A3.
  03:125 and Table 1 use `\Link^*`; please align to `\Link^\star`.
- Table-effective rates: `(\delta_{\mathrm{eff}},\varepsilon_{\mathrm{eff}})`, fit statistic `X^2_{\mathrm{eff}}`
  (def:link-effective). Count-based audit rates remain `(\hat\delta,\hat\varepsilon)` from eq:link-psi.

## For SIM-WRITER (Section 8)

- 05 now says (rem:link-swaps): under realistic attribute noise the audited LE correction can be worse
  than no correction, "as the simulation of \cref{sec:simulation} shows", and that swaps are the
  mechanism. Please make sure Section 8 reports that comparison (corrected-by-audit vs naive under
  realistic noise) so the cross-reference holds; if the final run no longer shows it, tell the
  orchestrator and I (or whoever) will soften the sentence.
- Math note on the referee's M2 claim: for K=2 a swap leaves the table unchanged, but the two spurious
  corrections (one missed pair, one false edge) cancel to FIRST order in n_11, so for K=2 the
  over-correction is only second order in the swap rate. The first-order failure needs K>=3 (the
  simulation has K=4): LE spreads the implied detachments and merges over different cells. I checked
  this numerically with code/darkfig (linkage_corrected on swap-only tables): K=2 errors 0.1-3%,
  K=3/4 under heterogeneity up to +40% at a 3% swap rate, and of either sign. The remark states this.
- 05 describes `le_projection` (pipeline.py) as computing the table-effective rates from the oracle
  and naive tables (Neyman chi-square, Nelder-Mead from 3 starts, rates in [0, 0.95)).
