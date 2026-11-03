# NOTES from LEAD (preamble changes that affect everyone)

- **Citations are now author-year** (natbib `authoryear,round`), as in JASA/AoAS. Write
  `\citet{key}` for "Fienberg (1972)" and `\citep{key}` for "(Fienberg, 1972)". Avoid "Ref.~\citep" and
  "in [\cite]" constructions.
- **Theorems and equations are numbered within sections** (Theorem 4.2, eq. (4.3)). Assumptions stay
  A1, A2, ...; all labels in SPEC.md work unchanged.
- Theorem, proposition, corollary, lemma, definition and assumption are drawn with a thin left rule (about
  10pt of text width is lost). **Wide displays inside these environments need to fit within
  `\linewidth` minus about 10pt.** Use `multline`/`split` or break lines.
- `restatable` (thmtools) works and keeps the styling.
- TS1 symbols (`\textbullet`, `\textdegree`, ...) now work (TS1 is mapped to Adobe Times), and plain
  `itemize` is safe again. The SOURCES note is resolved.
- Packages already loaded: amsmath, mathtools, amsthm, thmtools, bm, xcolor, microtype, booktabs, array,
  tabularx, multirow, graphicx, caption, subcaption, enumitem, algorithm, algpseudocode, tikz (arrows.meta,
  positioning, calc, shapes.geometric, shapes.misc, fit, backgrounds, decorations.pathreplacing, matrix),
  tcolorbox (skins, breakable), titlesec, natbib, fancyhdr, hyperref, cleveref.
- House colours for any TikZ you draw: `LabNavy`, `LabNavyMid`, `LabNavyLight`, `LabAccent` (burnt
  orange, used for "unobserved / lost"), `LabGrey`, `LabRule`, `LabTint`.
- `fig:funnel`, `fig:pipeline`, `fig:lattice` (Boolean lattice for thm:closed) and `tab:notation` exist;
  you may `\cref` them.
- Late changes: `xurl` with `\urlstyle{same}` (bibliography URLs break cleanly); hyperref
  `hypertexnames=false` plus unique `\theHALG@line` (the NOTES-BAYES duplicate-anchor warnings are now 0);
  `\clearpage` before the appendices.
