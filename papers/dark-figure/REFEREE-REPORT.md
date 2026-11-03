# Whole-paper referee report — The Dark Figure (excludes §8 and App. C)

Recommendation: **major revision.** The theory is sound and well attributed, and every recomputed example is right. But the framing promises N where the lists identify only N_V; the paper claims the simulation implements LE (false); it oversells the linkage correction; the analysis plan cannot be executed as written; and the main text is about 65 pages before §8.

## MAJOR
**M1. Use N_V, not N, everywhere.** 07:8–26/70 and 06:51 restrict MSE to incidents reaching a recording channel.
- Abstract: add "List-based MSE estimates N_V, the incidents reaching some recording channel; the remainder needs a victim survey."
- 01:21 → "The incident must first reach a recording channel—by a report or by the channel's own detection—and then the police."
- 01:171–173 and 11:29 → "…incidents that never reach a recording channel…".
- fig-funnel.tex:62/69/86/107/127–137: "Disclosed / told anyone / never disclosed" → "Reaches a channel / reported to police or a recording org. / reached no channel".
- tab-notation.tex:29–33 and SPEC.md: same, with ρ_pol defined as "| reaches a channel".
- 03:7: add "U is U^V of Section 7."
- Plan:
  - The primary estimand N_d (09:7) is not identified; use N_{V,d}.
  - p_1 then corresponds to ρ_pol·ρ_cls, not ρ_vic·ρ_pol·ρ_cls (09:13).
  - The NCVS check (09:104) becomes p_1 ≤ r/ρ_vic.
  - Incidents that reach no channel only change μ_0, so ρ_vic can be folded into the ω̄ sensitivity analysis.

**M2. The linkage correction is oversold.**
- 01:181–183 → "Simulated records carry realistic attribute noise and are linked by FS-EM (Alg. 1); LE enters only through the correction, which is thereby tested under misspecification."
- 05:103 → "LE is a stylised forward model—the one Cor. linkcorrect inverts—not how the simulation generates errors."
- Add a remark after cor:linkcorrect on SWAPS:
  - LE has no move for linking a record to the wrong partner.
  - The audit (prop:link-audit) counts a swap as one missed pair plus one false edge. For K=2 a swap leaves the table unchanged, so the correction over-corrects.
  - This is the run-1 failure: +72% corrected vs +39% naive.
  - Recommend "table-effective" (δ, ε): the rates that best reproduce the observed table from the true table, fitted on audited clusters (the code's `le_projection` diagnostic already computes these). Also recommend a diagnostic for whether the errors are LE-like.
- 11:14–18 → "…whose first-order effect can be computed. The correction is valid only under LE-type errors; otherwise we mix over linkage draws (Alg. pipeline) and use the correction as a diagnostic." Add swaps to the limitations at 11:79–86.
- Abstract: "a corrected estimator" → "the correction implied under that model".
- Plan:
  - 09:55, decision rule D1 and tab:plan-sens must not pre-register a correction our own simulation shows failing. Make mixing over linkage draws (alg:pipeline) primary.
  - 09:54–55 estimates (δ, ε) "from the reviewed sample", which contradicts 05:365 (targeted review is not a probability sample). Use the random audit (prop:link-audit).

**M3. Scope of claims.**
- 01:145–147: the sparse/dense ranking is proved only under independent capture (cor:link-indep). Say so.
- 02:152–153: "typically biases downward/upward" contradicts prop:id-hetero. Use "downward for two lists; for K≥3 either sign".
- 10:34: add "for K=2 or under condition (H); the direction can reverse (rem link-reversal)".
- "Heterogeneity-robust lower bound" (04:8, 04:155, 06:51, 10:40) contradicts 04:181, 09:65 and 11:48.
  - Retitle §4.4 "Chao's bound and its reversal".
  - At 10:40/46, the only assumption-free floor is n; Chao is a diagnostic.
- Abstract: "We derive a closed-form K-list estimator" → "We retain ω in the classical closed form". Call the small-area model "specified", since it is not evaluated.

**M4. The plan is not executable.** The primary model (LCMCR) has no ω or q, yet 09:73 refits it over that grid. State how they enter, e.g. scaling the implied π_0/(1−π_0) by e^{ω̄}, or provenance recoding (prop:referral c).

**M5. Length.** The body is about 37k words; §5 alone has about 21 numbered environments over 14 pages.
- Move to the appendix: prop:link-fs, alg:fsem, lem:link-merge / lem:link-response, the remarks after thm:linkbias (except the key reversal remark), prop:link-audit details, thm:review(iv), rem 4.7–4.8, and the code-description paragraphs at 05:283 and 05:381.
- Condense §2 to about 3 pages.
- The NIBRS-2021 figures appear three times (01:29, 02:16, 06:114); keep one.

## MINOR
- 05:55: ∏_{k<k'} → Σ_{k<k'} (count of cross-list pairs).
- 06:51: "Two results… Third" → "Three".
- Notation clashes:
  - δ_{st} and γ_t (06:98) vs the linkage δ and γ.
  - The match probability is π_ℓ at 05:91 but ζ_ℓ in Alg. 1.
  - μ(φ) and λ(φ) (05:40) vs μ_h and λ_{jk}.
  - θ, η, ζ, κ, V and G each have 3+ meanings.
  - Λ* (03:125, Table 1) vs Λ⋆ (§5).
- Table 1 calls δ and ε "rates", but they are per-record probabilities (the pairwise false non-match rate is 1−(1−δ)²). Add ω̄, 𝒜 and s_h.
- 07:129 reads as empirical; use "In that case, places…". Make the §7 title say "antisemitic incidents".
- 07:8 sets n_FBI = n_{1+}, which conflicts with NYPD being list 1 in the plan.
- The intro uses 2023 FBI data, §2 uses 2025; harmonise.
- Bibliography:
  - Lost capitals ("anti-jewish", "united states", the Hate Crime Statistics Act and Clery Act titles).
  - aleshinguendel2024 and pezzella2019 are incomplete.
  - Check the CA DOJ URL ending "2025f.pdf".
- Figures: tiny glyph labels in the pipeline figure; the funnel's MSE bracket omits list 1.
- Add funding, competing-interest and code-availability statements. For author names, keep "Kornstein Lab for Antisemitism Research" unless the user decides otherwise.
