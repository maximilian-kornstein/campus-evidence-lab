# TEXT-REVISER notes (Paper 4, major revision) -- 2026-11-04

For the SIM-REVISER (owner of 07, appendix C, `tables/tab-sim-*.tex`, `figures/fig-sim-*.pdf`)
and the orchestrator. All files listed under "TEXT-REVISER owns" in the brief now use the
notation below. Table 1 (`tables/tab-notation.tex`) lists each symbol once.

## 1. Notation: old -> new

| Old | New | Meaning / where |
|---|---|---|
| `\alpha_\pi(d)`, `e_T(P,\alpha)`, `b(\alpha)` | `\nu_\pi(d)`, `e_T(P,\nu)`, `b(\nu)` | initial distribution of a chain (alpha is now only the error level) |
| `\nu_x` (expected departures, old Prop 4.4) | `\bar n_x` | expected departures from x per session |
| `n_x`, `N_{xy}`, `N_x` (counts, old Prop 4.4) | `n_{0x}`, `n_{xy}`, `n_{x+}` | start counts, transition counts, departures |
| `N=(I-P_{TT})^{-1}` (transient fundamental matrix) | `Z_{\mathcal T}` | Prop 4.1(d) |
| `\tau_{\mathcal S}`, `\E_\varpi[\tau_y]`, `\E_\varpi\tau_A` | `T_{\mathcal S}`, `\E_\varpi[T_y]`, `\E_\varpi[T_{\mathsf A}]` | hitting time |
| `\tau_1(B)` (ergodicity coefficient) | `\operatorname{erg}(B)` (macro `\erg`) | Thm 4.2 |
| stopping time `\tau` | `N` (number of pairs at stopping) | Thm 6.2, Fig. 1 ("stop") |
| `\tau_{\mathrm{safe}}` | `s_{\mathrm{safe}}` | opening threshold |
| `\tau^2_{d\pi}`, `\tau^2_\pi` (session-level variance) | `\sigma^2_{\mathrm s,d\pi}`, `\sigma^2_{\mathrm s,\pi}` | Sec. 5, Sec. 6 |
| `\kappa_\pi = q_\pi/\mu_\pi`, `\kappa_\mp(\mu)` | `r_\pi`, `r_\mp(\mu)` | Thm 6.1(c), Lemma B (lem:mc-range) |
| `\kappa_{\Sp}` | `\mathrm{cv}_{\Sp}` | delta-method accuracy index, Sec. 6.1 |
| attenuation weight `\omega` | `w_0` | Thm 6.1(a) |
| `\omega^2_\pi` (classifier variance) | `\sigma^2_{\mathrm c,\pi}` | eq:pw-var |
| `Q_{\mathrm{drift}}`, `\widehat V_w` | `X^2_{\mathrm{drift}}`, `\widehat v_w` | Sec. 5.4 |
| `A`, `A_0`, `A_Y` (per-pair variances) | `V`, `V_0`, `V_Y` | Prop 6.3 |
| `B_{\mathrm{pool}}`, `B_{\mathrm{st}}`, `B_{\mathrm{ds}}`, generic `B` | `V^{\mathrm{pool}}_{\mathrm{val}}`, `V^{\mathrm{st}}_{\mathrm{val}}`, `V^{\mathrm{ds}}_{\mathrm{val}}`, `V_{\mathrm{val}}` | validation term |
| "A for double sampling" | `V^{\mathrm{ds}}` | primary per-pair variance is `V^{ds}+nV^{ds}_{val}` |
| `a_0`, `a_1` (Prop power (b)) | `v_{\mathrm p}`, `v_{\mathrm s}` | `S^*={(c_p/c_s) v_s/v_p}^{1/2}` |
| `L=\lvert\log r_1-\log r_0\rvert` | `\Delta` | Prop 6.3 |
| `V_\pi=\sigma^2_\pi/n_\pi` (Thm 6.1(b)) | `v_\pi` | Prop B (prop:mc-variance) |
| `V_j` (saturation) | `v_j` | Prop B (prop:int-saturation) |
| `Z_u=(D_u,\Pi_u)` | dropped; write `(D_u,\Pi_u)` | Sec. 5, App. B |
| weighting distribution `Q`, `\mu_\pi(Q)`, `\mathrm{AR}_\rho(Q)`, `w_Q` | `\Lambda`, `\mu_\pi(\Lambda)`, `\mathrm{AR}_\rho(\Lambda)`, `w_\Lambda` | Sec. 3 (Q is now only the flagged share `Q_{us}`, `\bar Q_u`) |
| eligible pool `\mathcal C_t` | `\mathcal P_t` | Sec. 3 |
| confidence sequence `C_t`, pair count `t`, planned pairs `t^*`, burn-in pairs `m_0` | `C_n`, `n`, `n^\ast`, `n_{\mathrm b}=\lceil c n^\ast\rceil` | Alg. 1, Thm 6.2 (t is now only the session step) |
| running interval `[L,U]` | `[\mathrm{LB},\mathrm{UB}]` | Alg. 1, stopping rules, Table 6 |
| mixture parameter `\varrho^2=a/t^*` | removed: the radius is `h_n=\widehat\sigma_n (n^\ast)^{1/2} h(n/n^\ast)/n` with boundary `h(s)={2(1+as)a^{-1}\log((1+as)^{1/2}/\alpha)}^{1/2}`; tuning constant `a` unchanged; `c_\alpha=h(1)` | Alg. 1 |
| `g_a(s)`, `H_a(c)` | `h(s)`, `\bar\alpha(c)` | Thm 6.2, Lemma B |
| `\widehat s_t`, `s^2` (variance of psi) | `\widehat\sigma_n`, `\sigma^2_\psi` | Alg. 1, Thm 6.2 |
| Brownian motion `B`, `W` | `\mathbb B`, `\mathbb W` | Thm 6.2, App. B |
| capital process `K_t(\vartheta)` | `\mathrm{Cap}_n(\vartheta)` | Thm 6.2(b) |
| `M_\pi(d)` (wave-averaged exposure under load) | `\bar m_\pi(d)` | Prop 5.2 (M is now only the mean first-passage time `M_{xy}`) |
| popularity exponent `\beta`, weight `w_\ell` | `\theta`, `\epsilon_\ell` (weight on `\chi^P`, from 0) | Prop B (prop:int-direction) |
| type-level flag rates `\phi_k`, exposure shares `w_{\pi k}` | `q_k`, `e_{\pi k}` | Thm 6.1(c), Table 4 |
| Wasserstein `W_1` | `\dW` (`d_{\mathrm W}`) | Sec. 3, App. A |
| formation period `W_0`, window `W` | words ("formation period", "evaluation window") | Sec. 3 (W is now only the number of waves) |
| Example 4.3 entry `a`, exit `\delta` | `p`, `q` (`q=q(\{\mathsf R\})`) | delta is now only the margin |
| content states `N, B, A, R` | `\mathsf N, \mathsf B, \mathsf A, \mathsf R` | Sec. 4, 8, App. A, D, Figs 2 and 1 |
| confusion matrix `C` | `\Gamma` | Sec. 4.4, App. D |
| complement `\mathcal O=\mathcal X\setminus\mathcal A` | `\bar{\mathcal A}` | Prop 4.1(c) |
| number of states `m` | `\lvert\mathcal X\rvert` | m is now only codes per puppet |
| functional `\theta(\alpha,P)` (old Prop 4.4) | `\Psi(\nu,P)` | App. A |
| Table 4 scenarios A, B | scenarios I, II | Sec. 6.1 |
| Cohen's `\kappa` | "Cohen's kappa" (word) | App. D |
| session lengths `T_{alg}/T_{ref}` | `\bar T_{\mathrm{alg}}/\bar T_{\mathrm{ref}}` | Sec. 3 |
| generic puppet statistic | `O_u` (outcome), with `\vartheta=\E O_a/\E O_r=\lambda\,\mathrm{AR}`, `\lambda\in[\lambda_-,\lambda_+]`; instances `\widetilde E_u` (lambda=1, primary) and `Y_u=\bar Q_u\widehat P_u` (lambda=lambda_S) | Alg. 1, Thm 6.2 |

Unchanged: `\tau, \tau_{sup}, \tau_{dem}, \iota` (decomposition), `\omega_w` (wave weights), `\kappa_{\mathcal A}` (sensitivity
coefficient), `\varpi`, `Z`, `H`, `K(P)`, `M_{xy}`, `\xi_\pi`, `\xi_\Delta`, `\ell`, `\lambda_S`, `J`, `q_\pi`, `Y_u`, `\widetilde E_u`, `\delta`, `\alpha`, `\beta` (power), `\rho` (reference policy), `F_b`.

### Still to align in SIM-owned files (grep, 2026-11-04, after the last compile)
- `07:50` `\kappa_a/\kappa_r` -> `r_a/r_r` (eq:mc-diff now reads `\mathrm{AR}\cdot r_a/r_r`).
- `07:48` "scenario A of tab:mc-signflip" -> "scenario I".
- `07:68` `Q=F_0` -> `\Lambda=F_0`.
- `C:173`, `C:204`, `tables/tab-sim-designs.tex:41` `A_Y` -> `V_Y`.
- `C:196` `\tau^2` -> `\sigma^2_{\mathrm s}`.
- Page budget: Section 7 now spans about 10 pages (31-41); my sections total about 39 pages, so the main text is about 49 pages. Reaching ~45 needs Section 7 at about 6 pages (e.g. E1b, E2 and E3 detail to Appendix C).

## 2. Structural changes that move labels (all labels preserved)
- Prop 4.4 `prop:markov-mle` -> Appendix A.6 (`app:markov-estimation`); Sec. 4.4 keeps a short summary (`sec:markov-estimation`).
- Table 3 panel B -> new `tab:markov-nudge` in App. A.7 (`app:markov-nudge`); `tab:markov-illus` is panel A only.
- Thm 4.2(b) sharpness statement -> `rem:perturb-sharp` (App. A).
- Prop 5.2 keeps parts (a)-(d) with the same letters; full statements of (b) and (c) are `prop:int-direction` and `prop:int-saturation` (App. B.3). Rotation design -> `app:rotation` (B.4).
- Thm 6.1 keeps parts (a)-(e); the variances of (b) are `prop:mc-variance` (App. B.5) with `eq:mc-varAA`, `eq:mc-varAR`; the range of the naive ratio is `lem:mc-range`; `rem:pw-markov` -> end of App. B.
- Tables 5 and 9 merged: one table with labels `tab:prot-power` and `tab:pw-illus`, in Sec. 8.3. Detection and materiality now share the alternative `AR = delta^2 = 1.5625` (rows recomputed from the closed forms; old Table 5's S=10 materiality row = new row "R1, S=10 sessions").
- Sec. 8 is a ~4-page summary (`sec:prot-summary`, `sec:prot-stopping`, `sec:prot-power`, `tab:prot-decisions`); the full registered text is new Appendix D `appendix/D-protocol.tex` (`app:protocol`) with `sec:prot-scope`, `sec:prot-personas`, `sec:prot-randomisation`, `sec:prot-interference`, `sec:prot-validation`, `sec:prot-estimands`, new `sec:prot-monitoring`, new `sec:prot-sizes`, `sec:prot-data`, `sec:prot-timeline`, `tab:prot-design`, `tab:prot-timeline`.
- Named benchmark: "a conventional small-lab design, with 40 puppets per cell over eight waves of five pairs" (S=10, 2,000 coded items); all protocol-history narration removed from my files.

## 3. Protocol changes the simulation may need to know
- U_max now counts every account created (pilot and sentinels included); illustrative caps U_max = 400 accounts, 15,000 coded positions (pilot included). Rung R4 = 122 pairs in six equal waves of about 20 pairs; 352 accounts; ~13,900 codes.
- The randomised-saturation design runs only on rungs R1-R2; on R3-R4 waves are equal-sized.
- Pilot gate: conservative end of an 80% interval -- bootstrap for variances/costs, Clopper-Pearson for coded proportions (FOR by band etc.).
- AA(d) becomes primary for a persona whose pilot upper bound for mu_ref(d) is below a registered floor (0.002; additive margin delta_A = 0.005).
- No population weighting Lambda is registered (persona-level estimands only).
- Markov summaries: exploratory, on the two-state chain {A, not A} unless the pilot shows the borderline band separates B from N (aligned with E4b).

## 4. ALIGN-WITH-SIM comments (aligned with E5b/E4b as written in 07 on 2026-11-04)
- `sections/06-measurement.tex` (Sec. 6.2, "What is exact and what is approximate", item 2)
- `sections/08-protocol.tex` (primary analysis; Markov status; pilot check; closed-form variance)
- `sections/10-discussion.tex` (Markov status; feasibility limitation)
- `appendix/D-protocol.tex` (Markov status; slate-chain correction; coverage and pilot check)
