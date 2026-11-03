# Paper 2: whole-paper referee report and code audit (for the revision)

**Referee recommendation: MAJOR REVISION.** The math and simulations hold within their stated scope. The problems are scope, framing, an under-specified plan, notation and length. 12 numbers in §8 were spot-checked against the JSON, and all match.

## Referee — MAJOR
1. **Multivariate equivalence is overclaimed.**
   - 04:11–13, 01:133–135, 11:14–16 and main.tex:59–61 imply equivalence for exp/CM kernels "with no excite-only streams". Only M=1 or a diagonal Φ is proved.
   - Counterexample: A=[[0,a],[a,0]], equal μ, gives E_H(0)=λ̄{(I−A)⁻²−I}, whose eigenvalue on (1,−1) is λ̄{(1+a)⁻²−1}<0. Then Var(N₁−N₂)<E(N₁+N₂), which is impossible for any Cox process.
   - Fix: "proved for M=1 or diagonal Φ; otherwise requires E_H(ω)⪰0 ∀ω, which fails for excite-only streams and when cross-excitation dominates self-excitation". This strengthens the paper: cross-excitation is often second-order identifiable.
2. **The abstract overclaims.**
   - main.tex:67–68: the alert rule is Bayes-optimal only for the known state. Under delays the plug-in is not Bayes, and Alg. 2 (SIS) was not run.
   - main.tex:71–72: "evaluates these tools" sits next to Bayesian shrinkage and time rescaling, which were not evaluated.
   - main.tex:77: "only known event times remove" rests on a single spline (59-day knots).
   - Fix: "simulations evaluate EM, attribution, the boundary test, the thinning correction and a plug-in alert". In C7 (01:200–211), list every untested tool.
3. **The calibration finding is misattributed** (08:491–494 "a limitation of the method"; main.tex:79–80; 11:64–68). E6 forecasts assume no future external events, but the data contain Poisson(1/30) events. By Lemma 7.6(a), a forecast that integrates over the event process (07:29–31) is calibrated when windows are pooled. The miscalibration therefore comes from a misspecified forecaster; what no model can do is TIME the events, which shows up in recall, not calibration. Fix: rerun E6 with forecasts that integrate over future events (cheap), then reword.
4. **E2 confounds "MLE ≠ n*" with sample size.** Rare-family paths have 4.2–65.7 shocks; frequent-family paths have 67–389. So "the likelihood sees beyond second order" (08:253–259; 04:248–253) cannot be separated from finite-T bias. Fix: report shocks per path, and add a long-T run for the rare family or soften the claim. Known-shock fits for the frequent family exist only for κ≤1 (08:217–219), so "remove" → "largely remove, where tested".
5. **Placebo.** 01:178–180's "even under misspecification" omits the randomisation hypothesis Lemma 6.8 needs (06:997–1001). Plan V3 (09:226–229) draws placebo dates "off the holiday calendar", which breaks exchangeability when a real event falls on a holiday. Sample from all days, and state the hypothesis in the intro.
6. **The plan's weakest step is unspecified.** M1→M4 (09:157–161) uses block tests with a decay parameter unidentified under H₀, deferred to §6 and never run (08:405–411). Register the sup-LR statistic, β grid, bootstrap B, Holm family, and a fallback if V4 fails.
7. **Notation clashes.** Suggested renames: loadings → υ_k; classifier rates → e₀,e₁; knot spacing → h_b; dark-figure ratio → 𝒟_k.
   - K_b: number of basis functions (06:77,108) vs knot spacing in days (09:139,171).
   - β: decay vs loading (03:77–82; Table 5 rows "β" and "β₃").
   - η: response rate (05:242) vs classifier rates η₀,η₁ (02:227–243).
   - D_k: dark-figure ratio (02:278; 04:393) vs direct component (05:92) vs delay D (07:257).
   - Ψ_k: CDF (05:84) vs kernel family (04:282).
   - ξ: three meanings (04:44; 06:698; 07:56).
   - **P**: thinning matrix (04:445) vs map (05:231).
   - ι: newly reused as an index (A1:216).
   - Leftover label eq:at-kappa (05:246).
8. **Length.** The main text is 78 pp with 30 theorem-like statements, 13 remarks and 8 proofs; target ≤45 pp. Move to an appendix/supplement:
   - the proofs at 06:254–287, 414–431, 571–614, 737–792, 896–916 and 1005–1014, plus the §3 proofs;
   - Props 6.5 and 6.7, restated as cited facts;
   - the Gibbs sweep, §6.5, Davies/Rice (06:823–865), Rems 7.2 and 7.8;
   - the E1/E5 detail and Table 2;
   - most of §§9–10, keeping a one-page synopsis.

## Referee — MINOR
- **Table 5:** 62 rows in \scriptsize, and its last column mixes coverage, rejection rates and "—". Split it (E1 → appendix; E2–E3; E4–E5). tab-sim-main.tex:57 prints "2" where the text has 2.5%.
- **Fig. 9:** legends overlap the curves in (a), (b), (d) and (e); the top third of p.69 is blank. Labels in Fig. 4(b) and ticks in Fig. 7(c) are cramped.
- **Floats:** Table 3 lands in §6 (p.33) and Table 6 in §10 (p.75).
- **Bibliography:** protect capitals (sources.bib:47, :156 render "united states"); sources.bib:97 repeats the date; lewis2011 is unpublished; DOIs are used inconsistently.
- **E3:** p̂ uses a 10% relative error (08:315). Adding 30–50% would show the variance floor of Cor. 4.11.
- **11:31:** "the nowcast keeps delays from hiding a surge" is unsupported; E6 costs are unchanged (08:505–509).
- **08:534 "beats baselines":** say the simulated data come from a Hawkes model and the baselines are not the plan's.

## Code audit (no CRITICAL; nothing changes a reported number)
1. **MAJOR. E2 ridge undercount** (run_experiments.py:806 flags only b ≤ 1.01·1e-5).
   - raw/E2.json has 8 fits with β̂T < 0.1 and α̂ 1.7–29, but only 2 are flagged:
     - shocks-known: rare κ=1 rep 17; rare κ=2 reps 17, 19; frequent κ=0.5 rep 13; frequent κ=1 reps 16, 19;
     - constant background: slow κ=2 rep 12 (α̂ 2.22);
     - spline: slow κ=8 rep 7 (α̂ 29.1, n_eff 0.231).
   - The text (08 ~228, "one of 20 … at κ=1 and κ=2") is wrong.
   - Fix: flag β̂T < 1 and report the counts per configuration. The slow-spline κ=8 mean 0.028 is inflated by one fit (0.018 without it; median 0.003), so report medians too.
2. **MINOR.** "n_eff equals α̂ within 0.001" → "within 0.003" (max gap 0.0023 for the shot-noise families).
3. **MINOR.** hawkes/inar.py:26–28 docstring limit is wrong; use n_Δ ≈ n − ½n(1−n)βΔ (CLS 0.4413 matches the proposition). INAR is not used in E1–E6.
4. **MINOR.** attribution.py:204–215, `through=int j` zeroes the whole column, which is not Def at-channel. run_experiments passes the correct mask, so offline σ is identical; fix the docstring.
5. **MINOR.** E6 uses the PLUG-IN shortcut, not SIS (run_experiments.py:1224); the text must keep saying "plug-in".
6. **MINOR.** Provenance hashes: the current script hashes to caf14514. E1–E4 and E6 ran with 4214ba23; the E5 rerun and E6 post-processing with 97cd6676, which is not in git. The diff shows only the E5 path count, the E6 split and merge metadata. Record this in SUMMARY.md and the appendix.
