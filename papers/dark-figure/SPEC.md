# Paper 1 — The Dark Figure (team spec)

**Working title:** *The Dark Figure: Estimating Unreported Antisemitic Hate Crime with Bayesian Record Linkage and Multiple-Systems Estimation*
**Author line:** Kornstein Lab for Antisemitism Research · November 2026
**Genre:** a rigorous methods paper. It contains (a) new formal results with complete proofs, (b) a reproducible **simulation study on synthetic data with known ground truth**, and (c) a **pre-registered analysis plan** for real data.

## Non-negotiable honesty rules
1. **No empirical findings about real-world antisemitism are reported.** We have not linked any real incident data. Never write sentences like "we find that X% of incidents are unreported". Real-world facts may be cited only when they are published by the named source and appear in `refs.bib` with a verified citation. If you are not sure a fact is true, leave it out or write `\factcheck{...}` (renders a red marker), and the verification pass will resolve it.
2. **Every number in the simulation section must come from `results/*.json` produced by the code in `code/`.** No invented numbers.
3. **Every theorem gets a complete proof** (main text or appendix). State the assumptions explicitly. Do not claim novelty for known results. Attribute them: Lincoln–Petersen, Fienberg 1972 log-linear, the Chao 1987 lower bound, Fellegi–Sunter 1969, Ding–Fienberg 1994, Manrique-Vallier 2016, Sadinle 2017/2018, and so on. Frame our contributions as *synthesis, generalisation, and application to antisemitic hate crime*. Where a result is new to our knowledge, say "we show"; do not say "first ever".
4. The data subject is sensitive (victims of hate crime). Privacy and ethics are first-class concerns.

## Contributions (the Introduction will list these; keep labels consistent)
- **C1 Identification.** A closed-form K-list estimator of the dark figure under a log-linear model whose untestable highest-order interaction is a sensitivity parameter ω (Thm `thm:closed`). It comes with sharp sensitivity bounds (Cor `cor:bounds`), the sign of bias under positive or negative list dependence (Prop `prop:direction`), and Chao's lower bound (Thm `thm:chao`, attributed to Chao), which holds only under heterogeneity across incidents (model M_h); list heterogeneity reverses it (Prop `prop:id-mt`), so it is reported as a diagnostic, not a floor. The only assumption-free floor is n. It also gives a formal model of **referral dependence**, where an NGO audit ingests police reports (Prop `prop:referral`).
- **C2 Linkage error as a linear operator.** Imperfect record linkage maps the true capture-history table through a stochastic operator T(δ, ε), where δ is the false-non-match rate and ε the false-match rate. We derive the bias of MSE estimators (Thm `thm:linkbias`, which generalises Ding–Fienberg from 2 to K lists), the correction implied under the stylised LE model (Cor `cor:linkcorrect`), and a total-variance decomposition (Prop `prop:totalvar`). LE has no move for a swap (a record linked to the wrong partner); under swap-dominated errors the correction over-corrects, so mixing over linkage draws (Alg `alg:pipeline`) is the primary approach and the correction is a diagnostic. We also give an optimal design for clerical (human) review of uncertain links (Thm `thm:review`, Alg `alg:review`).
- **C3 Bayesian joint model.** (a) Latent-class MSE with a Dirichlet-process prior (attributed to Manrique-Vallier). (b) Covariate-dependent capture. (c) A spatiotemporal hierarchical small-area model for N_{s,t} over states and years, with police-list coverage modelled through agency participation (specified, not evaluated). (d) Joint propagation of linkage uncertainty (Alg `alg:pipeline`).
- **C4 The reporting funnel.** A multiplicative funnel identity, incident → reaches a recording channel (by a report or the channel's own detection) → reaches the police → classified as antisemitic → submitted to the FBI. It comes with a Shapley-value decomposition that attributes cross-jurisdiction differences in recorded rates to each funnel stage (Prop `prop:funnel`, Thm `thm:shapley`): *where antisemitic incidents go missing*.
- **C5 Simulation study.** Synthetic worlds with heterogeneity, referral dependence and noisy records. It compares Lincoln–Petersen, log-linear model averaging, latent-class DP-MSE, the Chao bound, and naive vs. linkage-corrected vs. uncertainty-propagated pipelines on bias, RMSE and coverage.
- **C6 Pre-registered analysis plan** for real sources: FBI hate-crime data (UCR/NIBRS), ADL Audit / H.E.A.T. Map, community security organisations, campus (Clery) data and NCVS. It covers definitional harmonisation, privacy-preserving linkage and an ethics protocol.

## File ownership (write ONLY your own files)
| File | Owner |
|---|---|
| `main.tex`, `preamble.tex`, `sections/01-introduction.tex`, `sections/11-discussion.tex`, `figures/*.tex` (TikZ) | LEAD |
| `sections/02-sources.tex`, `sections/09-analysis-plan.tex`, `sections/10-ethics.tex`, `bib/sources.bib` | SOURCES |
| `sections/03-framework.tex`, `sections/04-identification.tex`, `appendix/A1-identification-proofs.tex`, `bib/theory.bib` | THEORY |
| `sections/05-linkage.tex`, `appendix/A2-linkage-proofs.tex`, `bib/linkage.bib` | LINKAGE |
| `sections/06-models.tex`, `sections/07-funnel.tex`, `appendix/B-computation.tex`, `bib/bayes.bib` | BAYES |
| `refs.bib` (canonical verified core bibliography) | BIB |
| `code/darkfig/estimators.py`, `code/darkfig/loglinear.py`, `code/darkfig/lcmcr.py`, `code/tests/test_estimators.py` | SIM-EST |
| `code/darkfig/world.py`, `code/darkfig/linkage.py`, `code/darkfig/pipeline.py`, `code/run_experiments.py`, `code/make_figures.py`, `code/tests/test_world_linkage.py`, `results/`, `figures/*.pdf`, `tables/*.tex` | SIM-WORLD |
| `sections/08-simulation.tex`, `appendix/C-simulation-details.tex` | written in phase 2 from real results |

If you need a citation that is not in `refs.bib`, add a full BibTeX entry to **your own** `bib/<owner>.bib`. Use key style `lastnameYEAR` (lowercase, first author, e.g. `fellegi1969`, `manriquevallier2016`). Before adding a key, check `refs.bib` and the other `bib/*.bib` files. Add `note = {VERIFY}` to any entry you are not certain of.

## Notation (use exactly; macros in `preamble.tex`)
- Domain d (e.g. state s × year t). Population U_d of in-scope antisemitic incidents **that reach some recording channel** (U_d^V of §7) with **unknown size N** (= N_V; list-based MSE cannot see incidents that reach no channel, and recovering all incidents needs ρ_vic from a victim survey). Incident i ∈ {1,…,N}.
- Lists/sources k ∈ [K] = {1,…,K}. Canonical K = 4: k=1 police (FBI UCR/NIBRS), k=2 NGO audit (ADL-type), k=3 community security organisation, k=4 campus/community self-report portal.
- Capture indicator Y_{ik} ∈ {0,1}; capture history h = (h_1,…,h_K) ∈ \Hset = {0,1}^K; |h| = Σ h_k. Use **0** for the all-zero history.
- Cell counts n_h; observed distinct incidents n = Σ_{h≠0} n_h; dark figure **n_0 = N − n**; list sizes n_{k+}. Frequency counts f_j = #incidents captured by exactly j lists.
- Expected counts μ_h = E[n_h]. Log-linear: log μ_h = Σ_{S ⊆ supp(h)} u_S (with u_∅ the intercept). Highest-order interaction u_{[K]} =: **ω**.
- Capture probabilities p_{ik} = P(Y_{ik}=1 | x_i); latent class z_i ∈ {1,…,J}, weights π_j, class-list probabilities λ_{jk}.
- Records r ∈ R_k (list k), attribute vector a_r. Linkage structure **Λ**: a partition of R = ∪_k R_k into latent incidents (at most one record per list per incident after within-list dedup). True Λ*, estimated \hat Λ.
- Comparison vector γ_{rr'}; m(γ) = P(γ | match), u(γ) = P(γ | non-match). FS weight w = log(m/u).
- Linkage error parameters (per-record probabilities under LE): **δ** (detachment: a record splits off its true incident; the pairwise false non-match rate is 1−(1−δ)²) and **ε** (false merge of a singleton). Linkage operator **T(δ, ε)**. Oriented top interaction ω̄ = (−1)^K ω; alternating sign s_h = (−1)^{|h|+1}; alternating product 𝒜(x) = ∏_{h≠0} x_h^{s_h}.
- Funnel stages: ρ_vic (incident reaches a recording channel, by a report or the channel's own detection), ρ_pol (reaches the police | reaches a channel), ρ_cls (police classify as antisemitic bias | reaches the police), ρ_sub (agency submits to the FBI | classified). E n_FBI = N_all·ρ_vic·ρ_pol·ρ_cls·ρ_sub over all in-scope incidents, = N_V·ρ_pol·ρ_cls·ρ_sub; n_FBI = n_{1+} only when list 1 is the FBI submission (for a local police list, n_{1+} counts classified records and ρ_sub drops out). Incidents reaching no channel change only μ_0, so ρ_vic can be folded into the ω̄ sensitivity analysis.
- Small-area model (§6): incidence θ_{st}; state effect b_s (BYM2), national trend τ_t (RW2), state-specific trend χ_{st} (RW1), SDs σ_b, σ_τ, σ_χ; police coverage offset c_{st,1} with coverage noise SD σ_c.
- Dark-figure ratio relative to list k: D_k = N / n_{k+}.

## Label registry (use these exact labels; do not invent \ref targets elsewhere)
Sections: `sec:intro`, `sec:sources`, `sec:framework`, `sec:identification`, `sec:linkage`, `sec:models`, `sec:funnel`, `sec:simulation`, `sec:plan`, `sec:ethics`, `sec:discussion`.
Appendices: `app:idproofs`, `app:linkproofs`, `app:computation`, `app:simdetails`.
Results: `thm:nonid`, `thm:closed`, `cor:bounds`, `prop:direction`, `thm:chao`, `prop:referral` (THEORY); `thm:linkbias`, `cor:linkcorrect`, `prop:totalvar`, `thm:review`, `alg:fsem`, `alg:review` (LINKAGE); `prop:funnel`, `thm:shapley`, `alg:pipeline`, `eq:lcmcr`, `eq:smallarea` (BAYES); `fig:funnel`, `fig:pipeline` (LEAD TikZ); `fig:sim-*`, `tab:sim-*` (SIM).
You may add extra labels with your own prefix (e.g. `eq:link-…`, `lem:link-…`).

## LaTeX rules
- Each section file starts with `\section{Title}\label{sec:...}`. No preamble, no `\begin{document}`.
- Theorem environments: `theorem`, `proposition`, `lemma`, `corollary`, `definition`, `assumption`, `remark`, `example` (shared counter). Use `proof`.
- Use `\cref{}` for references and `\citet` / `\citep` (natbib) for citations.
- Algorithms: `algorithm` + `algpseudocode` (algorithmicx).
- Compile check: `bash tools/compile.sh` from `papers/dark-figure/`. It compiles into `build/<random>` so concurrent agents don't collide. Your files must compile without errors. Fix overfull boxes over 10pt in your files.
- Do not use `\usepackage` in section files. If you need a package, ask LEAD by writing a line in `NOTES-<owner>.md`.

## Python rules (SIM)
- Python 3.13, numpy, scipy, matplotlib only (no statsmodels or pymc).
- Deterministic seeds. Use `nice` and at most 2 worker processes; the machine has 4 cores shared with other agents.
- Figures: matplotlib PDF, serif font (`font.family='serif'`, `mathtext.fontset='stix'`), width 6.0in or 2.9in, colour-blind-safe palette.

### Estimator API (SIM-EST implements, SIM-WORLD consumes)
```python
# A capture table is dict[tuple[int,...], int] mapping each nonzero history h (length K) to n_h.
from darkfig.estimators import (
    lincoln_petersen,      # (table, lists=(0,1)) -> Estimate
    loglinear_closed_form, # (table, omega=0.0) -> Estimate      # Thm thm:closed
    loglinear_bma,         # (table, max_order=2, criterion="bic") -> Estimate  # model averaging over hierarchical models
    chao_lower_bound,      # (table) -> Estimate                  # Thm thm:chao
    lcmcr,                 # (table, J=10, n_iter=..., burn=..., seed=...) -> Estimate  # DP latent-class, Gibbs
    linkage_corrected,     # (table, delta, eps, estimator=...) -> Estimate  # Cor cor:linkcorrect
)
# Estimate: dataclass(N_hat: float, lo: float, hi: float, n_obs: int, method: str, extra: dict)
```

## Canonical linkage-error model (LE) — shared by LINKAGE (theory) and SIM (code)
This model defines the operator **T(δ, ε)** on a *true* capture table t = (t_h)_{h≠0}, giving the expected *observed* (post-linkage) table. LINKAGE may generalise it, but the theorems must contain this model as a stated special case, and the code implements exactly this model.
1. **Detachment (false non-matches, rate δ).** Take a true incident with support S = supp(h). Each of its records independently *detaches* with probability δ. The non-detached records R ⊆ S stay together as one cluster (if R ≠ ∅). Each detached record forms its own singleton cluster. So E[ñ_g] after step 1 = Σ_{h ⊇ g} t_h δ^{|h|−|g|}(1−δ)^{|g|} + 1{|g|=1, g=e_k} · δ · Σ_{h ∋ k} t_h. This map is linear, upper-triangular on the Boolean lattice and invertible for δ < 1.
2. **Merging (false matches, rate ε).** After step 1, each *singleton* cluster from list k independently merges with probability ε into a cluster B chosen uniformly at random among clusters whose support excludes k, giving support B ∪ {k}. Merges are applied sequentially in random order, and a cluster that already contains k is ineligible. In expectation, to first order, the singleton count in e_k loses ε·ñ_{e_k}, and each B with k ∉ B moves mass ε·ñ_{e_k}·ñ_B / M_k to B ∪ {k}, where M_k = Σ_{B ∌ k, B≠∅} ñ_B.
3. **Correction.** `linkage_corrected` solves E[T(t)] = ñ for t ≥ 0 by damped fixed-point iteration t ← max(0, t + (ñ − E[T(t)])), starting from t = ñ. It then applies the chosen estimator to t̂. Float counts are allowed throughout the estimator API.
4. **Scope (revision).** LE is a stylised forward model, the one Cor `cor:linkcorrect` inverts. It is not how the simulation generates linkage errors: simulated records carry realistic attribute noise and are linked by FS-EM (Alg `alg:fsem`), so LE enters only through the correction, which is thereby tested under misspecification. LE has no move for a swap; the audit of Prop `prop:link-audit` counts a swap as one missed pair plus one false edge. In the analysis plan the correction is a diagnostic, mixing over linkage draws is primary, and (δ, ε) come from the random audit, never from targeted review.
