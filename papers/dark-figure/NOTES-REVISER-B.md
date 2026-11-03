# NOTES from REVISER-B (owner of 04, 05, A1, A2, new A3)

## REQUEST to orchestrator / REVISER-A: one line in main.tex (still needed)

I created `appendix/A3-linkage-details.tex` (section label `app:linkdetails`). Please add, directly
AFTER the A2 line in main.tex:

    \IfFileExists{appendix/A3-linkage-details.tex}{\input{appendix/A3-linkage-details}}{}

Until this line is in main.tex, ~40 references (alg:fsem, alg:review, thm:review, prop:link-audit,
lem:link-merge, ...) are undefined. With the line added (tested via a scratch copy of main.tex):
0 errors, 0 undefined references, 0 overfull boxes.

## What moved where (all old labels preserved, so every \cref still resolves)

- To A3 (`app:linkdetails`): attribute/comparison details (`app:link-attributes`); prop:link-fs, alg:fsem,
  eq:link-fslik and the Bayesian-linkage literature (`app:link-fsdetails`); lem:link-merge,
  lem:link-response, eq:link-response, eq:link-splitsens, the Moebius factorisation (`app:link-opdetails`);
  rem:link-H (new; was the paragraph after thm:linkbias), rem:link-reading, rem:link-lit,
  rem:link-listspecific, rem:link-dedup (`app:link-biasremarks`); rem:link-sameaudit and the solver
  description (`app:link-correctdetails`); thm:review with its (R1)-(R2) setup and eq:link-sigma,
  prop:review-linear (new; was thm:review(iii)), prop:review-costs (new; was thm:review(iv)),
  alg:review, the audit design and prop:link-audit (`app:link-reviewdetails`).
  Section 5.4 keeps a one-paragraph statement of the review rule pointing to these.
- To A1 (`app:id-remarks`): rem:id-untestable, rem:id-intervals, rem:id-zeros, rem:id-unify,
  ex:id-hetero, rem:id-hetero-more (new), rem:id-calibrate, ex:id-referral3 (new), ex:id-frontier.
  Section 4 keeps one-sentence pointers with the key numbers.
- thm:review now has parts (i)-(ii) only. Nobody outside my files cites thm:review(iii)/(iv).
  Section 8 cites cor:linkcorrect(i)-(iii) and prop:totalvar(iv): both kept intact in Section 5.

## New content (M2, M3)

- 05: LE is "a stylised forward model ... not how the simulation generates errors" (after def:link-le).
- `rem:link-swaps` (after cor:linkcorrect), `def:link-effective` (table-effective rates
  `(\delta_{\mathrm{eff}},\varepsilon_{\mathrm{eff}})`, fit `X^2_{\mathrm{eff}}`), three LE diagnostics
  (share of swap-like missed pairs, bootstrap fit of X^2_eff, count-based vs table-effective gap), and a
  "Recommendation" paragraph: mixing over linkage draws (alg:pipeline) is primary; the LE correction
  is a diagnostic/sensitivity tool.
- 04: Section 4.4 retitled "Chao's bound and its reversal"; Chao is a lower bound under M_h only, a
  diagnostic otherwise; the only assumption-free floor is n. 05: the sparse/dense ranking is
  "proved only under independent capture (cor:link-indep)".

## Notation changes in my files (for Table 1 / SPEC alignment by REVISER-A)

- FS-EM match probability is now `\pi_\ell` everywhere (was `\zeta_\ell` in Alg. fsem).
- FS error rates `\mu(\phi), \lambda(\phi)` renamed `P_{\mathrm{FL}}(\phi)`, `P_{\mathrm{ML}}(\phi)`;
  thresholds `T_{\mathrm N}<T_{\mathrm L}`. Merge-lemma remainder `\bm\zeta` -> `\bm\rho_{\mathrm{int}}`.
  KKT multipliers in the audit proof renamed (no longer mu_h, nu_h). A1's cumulant function
  `\Lambda(t)` -> `\mathcal L(t)` (Lambda is the linkage structure).
- True linkage is `\Link^\star` throughout 05/A2/A3. 03:125 and Table 1 use `\Link^*`: please align.
- 05:55 product over list pairs is now a sum.

## For SIM-WRITER (Section 8)

- rem:link-swaps says the audited LE correction "can be worse than no correction, as the simulation of
  \cref{sec:simulation} shows". Section 8 (Q4) supports this. 05 calls the oracle best-fit rates
  `(\delta^\ast,\varepsilon^\ast)` "the population version" of the table-effective rates, and computed
  by `le_projection` (chi-squared distance, Nelder-Mead from 3 starts over [0,0.95)^2), matching Section 8.
- Math note: 08:183 uses a K=2 swap example and says inverting the merge rate "over-corrects". For K=2
  the two spurious corrections (one missed pair, one false edge) cancel to FIRST order in n_11, so the
  K=2 over-correction is only second order. The first-order failure needs K>=3 (the simulation has
  K=4), because LE spreads the implied detachments and merges over different cells. I checked this
  numerically with code/darkfig (linkage_corrected on swap-only tables): K=2 errors 0.1-3%; K=3/4
  under heterogeneity up to about +40% at a 3% swap rate, and of either sign. Consider saying "with
  K>=3 lists" at 08:183 so that 05 and 08 agree.
