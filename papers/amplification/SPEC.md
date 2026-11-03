# Paper 4 — Supply or Demand? (team spec)

**Working title:** *Supply or Demand? Auditing Algorithmic Amplification of Antisemitic Content*
**Subtitle idea:** counterfactual sock-puppet audits, Markov exposure models, and misclassification-corrected measurement.
**Author line:** Kornstein Lab for Antisemitism Research · November 2026
**Genre:** rigorous methods paper. It contains (a) formal results with complete proofs, (b) a reproducible **simulation study on a synthetic recommender system with known ground truth**, and (c) a **pre-registered audit protocol**. Companions: Papers 1–3 in `../dark-figure/`, `../contagion/` and `../attitudes/`. Match their style. `preamble.tex` is a copy of Paper 1's final preamble.

## Non-negotiable rules
1. **No empirical findings about any real platform.** We have run no audit. Never claim that platform X amplifies antisemitism. Published audit studies may be cited only as exactly reported, with verified citations.
2. **Every simulation number comes from `results/*.json` produced by `code/`.**
3. **Every theorem gets a complete proof.** Attribute known results honestly:
   - auditing algorithms: Sandvig et al. 2014;
   - YouTube audits: Ribeiro et al. 2020; Hosseinmardi et al. 2024 (counterfactual bots); Haroon et al. 2023;
   - Twitter/X amplification: Huszár et al. 2022;
   - Markov chains: Kemeny & Snell (absorption, fundamental matrix);
   - potential outcomes: Rubin; Imbens & Rubin 2015;
   - interference: Hudgens & Halloran 2008; Aronow & Samii 2017;
   - prevalence under misclassification: Rogan & Gladen 1978;
   - sequential testing: Wald 1945; anytime-valid inference, e.g. Howard et al. 2021;
   - feedback loops: Chaney, Stewart & Engelhardt 2018; Jiang et al. 2019 (degenerate feedback loops).
4. **Ethics and law are first-class.** Minimal platform footprint. No inflating engagement metrics of hateful content, no posting, no interacting with real users. Rate limits. Data minimisation. Use of the vetted-researcher data access route under the EU Digital Services Act Art. 40 where possible. Platform-neutral language.
5. **Measurement depends on a classifier.** Link this to the lab's detection proposal. Classifier error must be modelled and corrected.

## Contributions
- **C1 Estimands.** In a potential-outcomes framework:
  - Def `def:amplification`: the amplification ratio AR = E[exposure to antisemitic content under the algorithmic feed, for a fixed demand profile] / E[exposure under a reference policy], with reference policies such as reverse-chronological, random-from-eligible-pool, or popularity-only.
  - The supply/demand decomposition of observed exposure: exposure = demand-driven + algorithm-driven, via a counterfactual-policy decomposition with an explicit path-independence / interaction term (Thm `thm:decomp`).
- **C2 Markov exposure model.** A user's session as a Markov chain over content states (e.g. neutral, borderline, antisemitic), with the algorithm-induced transition matrix P_alg vs. the reference P_ref.
  - Stationary exposure, expected hitting times and absorption probabilities into "rabbit-hole" classes, via the fundamental matrix (Prop `prop:markov`).
  - A perturbation bound on how much a small change in recommendation probabilities toward antisemitic states changes long-run exposure: a sensitivity/condition-number result via the group inverse / Kemeny constant (Thm `thm:perturb`).
- **C3 Identification from sock-puppet audits.**
  - Randomized persona-training designs identify AR and the decomposition under stated assumptions: no interference across puppets, stable policy during the audit window, and classifier error independent of arm given true label (Thm `thm:identify`).
  - Interference: puppets can change the model they audit through shared model updates. Give bounds on bias under bounded interference (Prop `prop:interference`).
  - Drift: time-varying policy and a blocked/rotating design.
- **C4 Misclassification-corrected measurement.** Rogan–Gladen-type correction of exposure prevalence with sensitivity and specificity estimated from a validation sample. The variance of the corrected AR via the delta method, and the bias of the naive AR when classifier error differs across arms (Thm `thm:misclass`). Differential error arises because content mixes differ by arm, so error rates differ if they depend on content type.
- **C5 Sequential, anytime-valid audit.** Platforms change, so audits must stop early when evidence is clear. Use a confidence sequence / e-process for AR (Alg `alg:sequential`), with a power/sample-size calculation for the number of puppets and sessions (Prop `prop:power`).
- **C6 Simulation study.** A synthetic recommender (e.g. a two-tower/embedding model with engagement-optimising updates and a feedback loop) with known amplification. Evaluate:
  - estimator accuracy;
  - interference bias;
  - misclassification correction;
  - sequential-test validity and power;
  - Markov exposure predictions vs. simulated sessions.
- **C7 Pre-registered audit protocol and ethics.**

## File ownership
| File | Owner |
|---|---|
| `main.tex`, `preamble.tex`, `sections/01-introduction.tex`, `sections/10-discussion.tex`, `figures/*.tex`, `bib/lead.bib`, `tables/tab-notation.tex` | LEAD |
| `sections/02-background.tex` (prior audits, platform governance, DSA), `sections/08-protocol.tex` (pre-registered audit), `sections/09-ethics.tex`, `refs.bib`, `bib/sources.bib`, `bib/KEYS.md` | SOURCES (also BIB curator) |
| `sections/03-estimands.tex`, `sections/04-markov.tex`, `appendix/A-proofs-estimands.tex`, `bib/theory.bib` | THEORY |
| `sections/05-identification.tex`, `sections/06-measurement.tex` (misclassification and sequential), `appendix/B-proofs-design.tex`, `bib/design.bib` | DESIGN |
| `code/**`, `results/`, `figures/*.pdf`, `tables/*.tex` (except tab-notation) | SIM |
| `sections/07-simulation.tex`, `appendix/C-simulation-details.tex` | phase 2, from real results |

## Notation
- Puppets (synthetic accounts) u = 1..U. Personas (demand profiles) d ∈ \mathcal{D}. Sessions s, with recommendation slates over steps t = 1..T.
- Content items c with true label L_c ∈ {0,1} (antisemitic), classifier label \hat L_c, sensitivity Se and specificity Sp.
- Policies π ∈ {alg, ref}. Exposure E_u(π) = (1/T) Σ_t 1{L_{c_t}=1}.
- AR(d) = E[E(alg) | d] / E[E(ref) | d]. Additive amplification AA(d) = E[E(alg) | d] − E[E(ref) | d].
- Markov chain over content states 𝒳 = {1..m}, with transition matrices P_alg and P_ref, stationary distributions ϖ_alg and ϖ_ref, fundamental matrix Z = (I − P + 1ϖ')^{-1}.
- Interference: the exposure mapping of Aronow & Samii; bound parameter ξ.

## Label registry
- Sections: `sec:intro`, `sec:background`, `sec:estimands`, `sec:markov`, `sec:identification`, `sec:measurement`, `sec:simulation`, `sec:protocol`, `sec:ethics`, `sec:discussion`.
- Appendices: `app:proofs-estimands`, `app:proofs-design`, `app:simdetails`.
- Results: `def:amplification`, `thm:decomp`, `prop:markov`, `thm:perturb` (THEORY); `thm:identify`, `prop:interference`, `thm:misclass`, `alg:sequential`, `prop:power` (DESIGN); `fig:markov`, `fig:design` (LEAD); `fig:sim-*`, `tab:sim-*` (SIM).

## LaTeX and Python rules
Same as Paper 1:
- Compile with `bash tools/compile.sh` from `papers/amplification/` once main.tex exists; before that, use a scratch wrapper outside the paper dir.
- Python 3.13 with numpy/scipy/matplotlib/pytest only; `nice`; at most 2 processes; deterministic seeds.
- No git commits or pushes.
