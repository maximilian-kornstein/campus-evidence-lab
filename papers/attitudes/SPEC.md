# Paper 3 — Where Criticism Ends (team spec)

**Working title:** *Where Criticism Ends: A Latent-Variable Map of Antisemitic Attitudes*
**Subtitle idea:** measurement invariance, social-desirability correction, and small-area estimation for the boundary between antisemitism and criticism of Israel.
**Author line:** Kornstein Lab for Antisemitism Research · November 2026
**Genre:** rigorous methods paper. It contains (a) formal results with complete proofs, (b) a reproducible **simulation study on synthetic survey data with known ground truth**, and (c) a **pre-registered survey design and analysis plan**. Companions: Paper 1 *The Dark Figure* (`../dark-figure/`) and Paper 2 *Shock and Contagion* (`../contagion/`). Match their style. `preamble.tex` is a copy of Paper 1's final preamble.

## Non-negotiable rules
1. **No empirical findings about real attitudes.** We have fielded no survey and fitted no model to real data. Published survey results may be cited only as exactly reported by their authors, with verified citations. If you are unsure of a fact, omit it.
2. **Every simulation number comes from `results/*.json` produced by `code/`.**
3. **Every theorem gets a complete proof.** Attribute known results honestly:
   - IRT: Lord 1980; Birnbaum 1968; Samejima 1969 (graded response).
   - Measurement invariance: Meredith 1993; Millsap 2011.
   - DIF: Holland & Thayer 1988 (Mantel–Haenszel); Thissen, Steinberg & Wainer 1993 (LR-DIF).
   - Bifactor models: Gibbons & Hedeker 1992; Reise 2012.
   - List experiments: Miller 1984; Glynn 2013; Imai 2011; Blair & Imai 2012.
   - Randomized response: Warner 1965.
   - MRP: Gelman & Little 1997; Park, Gelman & Bafumi 2004.
   - Anchor / partial invariance: Byrne, Shavelson & Muthén 1989.
4. **Political neutrality is essential.** We do not adjudicate definitions (IHRA working definition, Jerusalem Declaration, Nexus Document). We provide tools to **test empirical claims embedded in competing definitions**, for example "anti-Israel attitude X is a manifestation of the same latent hostility toward Jews as classic stereotypes" versus "X is a distinct political attitude". The paper must be equally useful to people on every side of that debate. Describe the definitions accurately and neutrally.
5. Survey respondents are human subjects. Ethics and privacy are first-class concerns.

## Contributions (the Introduction lists these)
- **C1 Measurement model.** A multidimensional IRT model (graded response) with a bifactor structure: a general factor G ("hostility toward Jews as Jews") and specific factors for classic stereotypes (S) and Israel-related attitudes (I). Within it, the "boundary" estimands: (i) the share of each Israel-related item's reliable variance that is due to G (an item-level explained common variance, ECV); (ii) the latent correlation between the stereotype factor and the Israel-attitude factor in a correlated-factors model; (iii) a *boundary set*, the items whose G-loading share exceeds a pre-registered threshold τ. Defined formally in Def `def:boundary`.
- **C2 Identification and invariance.**
  - Thm `thm:ident`: when are the bifactor boundary estimands identified? It needs conditions on the number of items per specific factor and on the loadings. Prove necessary and sufficient conditions, or sufficient conditions with clear statements.
  - Thm `thm:dif-bias`: if Israel-related items have DIF across groups (e.g. by political ideology or age cohort) and DIF is ignored, the group comparisons of latent means and of the boundary estimands are biased. Give an explicit first-order bias formula.
  - Prop `prop:anchor`: identification of group comparisons with partial invariance and anchor items, including the failure mode when anchors themselves have DIF.
- **C3 Social-desirability correction.**
  - The list experiment (item count technique) for sensitive items. Its estimator and the variance cost relative to direct questioning (Prop `prop:list-var`).
  - A **joint model** combining direct items and list experiments to estimate item-level social-desirability bias (Thm `thm:joint-sdb`).
  - The optimal allocation of the sample between direct and list arms, and the choice of control-item count J, to minimise the MSE of the bias estimate (Thm `thm:design`). Design effects for floor/ceiling (Blair & Imai).
- **C4 Small-area estimation.** MRP on the latent trait, for state/region/campus-level estimates of G and of the boundary estimands, with an explicit poststratification identity (Eq `eq:mrp`). Also a result on **why raw "% agreeing with k of N stereotypes" indices are not comparable across groups** when invariance fails (Prop `prop:index`). Relevant to widely used stereotype-count indices, but no claims about any real index's actual results.
- **C5 Simulation study** on synthetic survey data with known parameters:
  - recovery of the boundary estimands;
  - bias from ignoring DIF;
  - anchor-misspecification failure;
  - list-experiment correction accuracy and the optimal design;
  - MRP small-area accuracy.
- **C6 Pre-registered survey design and analysis plan.** An item bank structure, with items described generically by construct; no claims that they're validated. Also the list-experiment design, sampling frame and MRP poststrata, decision rules, and an ethics protocol.

## File ownership
| File | Owner |
|---|---|
| `main.tex`, `preamble.tex`, `sections/01-introduction.tex`, `sections/10-discussion.tex`, `figures/*.tex`, `bib/lead.bib`, `tables/tab-notation.tex` | LEAD |
| `sections/02-background.tex` (definitions debate, prior surveys, prior empirical work), `sections/08-design.tex` (pre-registered survey and analysis plan), `sections/09-ethics.tex`, `bib/sources.bib`, `refs.bib`, `bib/KEYS.md` | SOURCES (also the BIB curator for this paper) |
| `sections/03-model.tex`, `sections/04-identification.tex`, `appendix/A-proofs-measurement.tex`, `bib/theory.bib` | THEORY |
| `sections/05-sensitive.tex` (list experiments, joint SDB model, design), `sections/06-smallarea.tex` (MRP, indices), `appendix/B-proofs-design.tex`, `bib/models.bib` | MODELS |
| `code/**`, `results/`, `figures/*.pdf`, `tables/*.tex` (except tab-notation) | SIM |
| `sections/07-simulation.tex`, `appendix/C-simulation-details.tex` | written in phase 2 from real results |

## Notation
- Respondents i = 1..n. Groups g (e.g. ideology, cohort, country). Items j = 1..J_items with ordinal responses Y_ij ∈ {0,…,C_j}.
- Item sets: \mathcal{S} (classic stereotype items), \mathcal{I} (Israel-related items), \mathcal{A} (anchor items).
- Bifactor graded response model: P(Y_ij ≥ c | θ_i) = logistic(a_jG θ_iG + a_js θ_is − b_jc), where s ∈ {S, I} is item j's specific factor. θ_i ~ N(μ_g, Σ_g).
- DIF: group-specific item parameters a_j^{(g)}, b_jc^{(g)}. Uniform DIF = shift in b; non-uniform DIF = change in a.
- ECV_j = a_jG² / (a_jG² + a_js²) (item-level), on the standard-normal latent scale. Boundary set B_τ = { j ∈ \mathcal{I} : ECV_j ≥ τ }.
- List experiment: J control items, treatment adds the sensitive item. Y_i^{list} = count. Difference-in-means estimator π̂ = Ȳ_T − Ȳ_C. Direct-question prevalence π^D. Social-desirability bias SDB = π − π^D.
- MRP: cells k with population counts N_k; θ̄_area = Σ_k N_k E[θ | cell k] / Σ_k N_k.

## Label registry
- Sections: `sec:intro`, `sec:background`, `sec:model`, `sec:identification`, `sec:sensitive`, `sec:smallarea`, `sec:simulation`, `sec:design`, `sec:ethics`, `sec:discussion`.
- Appendices: `app:proofs-measurement`, `app:proofs-design`, `app:simdetails`.
- Results: `def:boundary`, `thm:ident`, `thm:dif-bias`, `prop:anchor` (THEORY); `prop:list-var`, `thm:joint-sdb`, `thm:design`, `eq:mrp`, `prop:index` (MODELS); `fig:bifactor`, `fig:boundary` (LEAD); `fig:sim-*`, `tab:sim-*` (SIM).
- Add your own prefixed labels freely.

## LaTeX and Python rules
Same as Paper 1:
- `\section{}\label{}` per file; shared theorem counter; `\cref`; natbib author-year (`\citet`, `\citep`).
- Compile with `bash tools/compile.sh` from `papers/attitudes/` once LEAD creates main.tex. Before that, use a scratch wrapper outside the paper dir.
- Python 3.13 with numpy/scipy/matplotlib/pytest only. Use `nice`, at most 2 processes, deterministic seeds. Figures in matplotlib PDF matching Paper 1's look (`../dark-figure/code/make_figures.py`).
- No git commits or pushes; the orchestrator commits.
