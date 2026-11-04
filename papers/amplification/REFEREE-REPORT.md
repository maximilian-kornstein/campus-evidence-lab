# Paper 4 — whole-paper referee report (saved by orchestrator)
Recommendation: MAJOR REVISION. Estimand theory strong; design results honest about approximation. 14 §7 numbers checked vs JSON, all match. Problems: coherence & validation — registered primary analysis never simulated; infeasibility missing from abstract/intro/discussion; two statements contradict own results.

## MAJOR
1. 06-measurement.tex:136 "more so at α=0.05 than at per-persona level" is backwards. Replace: "Even with it, at five pairs per wave the miss rate exceeds its nominal level at α=0.0125 (coverage 98.0–98.8% against 98.75%), though not at α=0.05 (95.0–96.2%)."
2. 01-introduction.tex:137–139 "biases exposure downwards" contradicts 05:165 and 08:92. Replace: "…show that the direction of the bias depends on how much puppet engagement reaches false negatives, so no sign can be assumed, and give…"
3. Primary analysis not validated (07:115 lists the gap honestly but not acceptable). Primary statistic Ẽ_u likely heavy-tailed (each coded unflagged position stands for ~16; one false negative adds ~0.04 vs μ≈0.02) — normal-mixture CS fails there; pilot check (08:148, resampling 10 pilot puppets) can't see tails. REQUIRED E5b: Ẽ_u with m=10, m′=25 (Neyman bands + openings stratum), S=4 from the 10 sessions, waves ~20 pairs, W_max=6, b=1, α∈{.05,.025}; AR and AA sequences under null, ND, DD; compare simulated variance with A+nB_ds; evaluate the pilot check itself. REQUIRED E4b: slate-state chains, true and with slate confusion correction (08:137, misread prob ≈k(1−Sp)); JSON stores slate exposure (sim_slate). Otherwise demote Markov summaries to exploratory. Fix descriptions calling the Y_u sequence "the" audit sequence: fig-design.tex:238, 01:162, Algorithm 1 (state for generic puppet statistic).
4. Infeasibility hidden; discussion overclaims. Abstract, C5/C7 (01:168–189) and discussion never say rung R1 needs ~4,900 accounts and ~170,000 codes or that caps select R4 (detection, one persona). 10-discussion.tex:11–26 promises decomposition and Markov summaries (only R1 delivers) and calls the CS "valid however early the audit stopped" (only approximately). Add to abstract: "Under plausible inputs a materiality audit of four personas needs thousands of accounts; the protocol therefore commits only to a pilot and a registered feasibility gate." Add infeasibility as a sixth limitation.
5. Protocol-history leftovers: 06:204–205 ("at most 40 per cell", "2,000 items", "800 per persona at 40 pairs"); 07:95, 08:50,106,219, App C.5 narrate superseded versions. Reframe as named benchmark ("conventional small-lab design: 40/cell, 8 waves"); move superseded runs to repo README.
6. Notation clashes: α (level vs initial distribution, both in Table 1); 𝒞_t/C_t (pool vs CS, both in Table 1); t (step vs pair count); τ (effect, hitting time, τ₁, τ²_π, stopping time, τ_safe); κ (κ_𝒜, κ_π, κ_Sp); ω (wave weight, attenuation weight, ω²_π); Q (weighting, Q_us, Q_drift); M_xy vs M_π(d); Z vs Z_u; A (state) vs A/A_Y (variance); B (state, Brownian, validation term); K vs K_t; W (waves, window, W₁); δ (margin vs Ex 4.3); β; φ_k vs φ_sup; ρ vs ϱ. Suggested: initial distribution → ν; hitting time → T_𝒮; stopping time → N; τ_safe → s_safe; κ_π → r_π; attenuation weight → w₀; Q_drift → X²_drift; A,B → V, V_val; drop Z_u.
7. Length: main ~69 pp, target ~40. Cut §2 to 2 pp (keep Table 2); move Prop 4.4, Table 3 panel B, Prop 5.2(b–c), rotation design, Thm 6.1(b) variances to appendices; merge Tables 5 & 9; move §8 to a supplementary registered protocol (keep 4-pp summary); condense §9.

## MINOR
- code/make_figures.py:349 legend prints "thm:perturb(c)" → "Thm 4.2(c), base chain".
- meta.runtime_s.total_wall=755.2 is run 1 only → store sum (1,435.2 s) or rename; delete apology in C:106.
- Table 3 floats into §5; Alg 1 line 9 comment wraps; Fig 6(a) needs log axes.
- Stamp "SYNTHETIC" in every simulation figure, or code personas P1–P4, so cropped panels can't circulate as findings.
- Pilot gate (08:230): with ~500 unflagged codes/cell FOR̂ often 0 → bootstrap degenerates; use Clopper–Pearson upper bounds.
- Say whether U_max counts pilot puppets and sentinels; R4+pilot exceeds 320.
- Saturation doubling conflicts with "~20 pairs per wave".
- Detection alternative 1.5 in Table 5 vs δ²=1.5625 in Table 9.
- Table 9 CV=0.5 row reverses "double sampling more efficient" claim.
- 03:63 promises AR(Q) for declared Q but protocol registers none.
- Register AA as primary when pilot μ_ref≈0.
- E2 sensitivity-interval coverage uses oracle ξ_Δ — label it.
- "one provider" (02:73, 09:14) vs bib title naming X — be consistent.
- Legal additions: hiQ v. LinkedIn (contract liability), state computer-crime statutes, GDPR Art 9(2)(j) & 89, DSM Directive Art 3, IRB justification for delaying Art 16 notices to wave end.
- Cite Armitage et al. (1969) for 17.6%; link double sampling to prediction-powered inference (Angelopoulos 2023) & Egami et al. (2023); interference: Johari et al. (2022), Bajari et al. (2023).
- Bib: "Stĳn" ligature → "Stijn"; case entries print year twice; companion-paper status inconsistent.
