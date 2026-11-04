# UI spec: adding the four methods papers to the Kornstein Lab site

The user asked: "Add the papers to the UI and update the pages." The site is static HTML/CSS with a small reader module (see LOCAL_SESSION.md and docs/ui-implementation.md). Keep the approved visual language: warm white, bold black Inter, orange links and accents, thin rules, and orange/lavender/sand textured geometric artwork. Keep copy minimal and honest. Use no frameworks and no third-party JS. Build checks must pass (`npm run check`).

## The papers (slugs, display titles, source)
| slug | Paper title (as in PDF) | Subtitle (one line, sentence case) | Source dir | PDF |
|---|---|---|---|---|
| `dark-figure` | The Dark Figure | Estimating unreported antisemitic hate crime | papers/dark-figure | papers/dark-figure/pdf/The-Dark-Figure.pdf (107 pp) |
| `contagion` | Shock and Contagion | Separating outside shocks from contagion in incident surges | papers/contagion | papers/contagion/pdf/Shock-and-Contagion.pdf (115 pp) |
| `attitudes` | Where Does Criticism End? | A latent-variable map of antisemitic attitudes | papers/attitudes | papers/attitudes/pdf/Where-Does-Criticism-End.pdf (99 pp) |
| `amplification` | Supply or Demand? | Auditing algorithmic amplification of antisemitic content | papers/amplification | papers/amplification/pdf/Supply-or-Demand.pdf (91 pp) |

Plain-language briefs for wording are in `impact/briefs/*.html`. Abstracts are in each paper's `main.tex`. **Honesty rule:** these are methods papers with simulation studies on synthetic data. They contain no real-world findings, and the site must never imply otherwise. Each paper page's abstract text must make this clear in one plain sentence. They are not peer-reviewed or published; do not say so.

The three existing one-page proposals (`measurement`, `detection`, `narratives`) stay, unchanged in content.

## Public assets (new)
- `pdfs/<slug>.pdf`: copy of the final PDF.
- `pdfs/<slug>/page-01.webp` … `page-12.webp`: preview renders of the first 12 pages, about 1065 px wide (≈1.5× the 710 px reader sheet), WebP quality ~80. Rendered by a new script `scripts/build-paper-previews.mjs` (or .py, invoked via node), using `pdftocairo` + Pillow, and committed like the existing SVGs.
- `assets/artwork-paper-<slug>.png` (paper hero) and `assets/artwork-research-<slug>.png` (research row), plus home-card crops as needed. Created by the ART agent in the same visual language (see below).
- `scripts/build-static.mjs` gets a second list `FULL_PAPER_SLUGS` with their files in REQUIRED_FILES and INDEXED_ROUTES. `scripts/check-site.mjs` and `test/site-reset.test.mjs` are extended accordingly.

## Pages
- `/research/`: two groups. "Papers" (the four, in the order above) first, then "Proposals" (the three existing). Each group gets a plain h2 label in the site's heading style; the row titles become h3. Each new row shows the title plus a one-line subtitle under it, with artwork on the left as now. Keep the row design.
- `/research/<slug>/` for each new paper, cloned from the existing paper template:
  - back link;
  - H1 = paper title, with a subtitle line;
  - "View PDF ↗" to the reader, plus a secondary "Download PDF" text link;
  - hero artwork;
  - **Abstract**: 3–5 sentences, plain, honest, including the methods/synthetic/no-findings sentence;
  - **Methods** (id="methods"): 4–5 short items, the core methods;
  - optionally **What the simulations show**: 2–3 short items in "in simulated data, …" phrasing, including any honest negative result. Keep it short.
- `/` (home): featured card = The Dark Figure; 2-card grid = Shock and Contagion, Where Does Criticism End?; then Supply or Demand? as a second wide card in the featured style (rhythm: wide, half, half, wide); then "All research →". Each card shows the title, with a subtitle if it fits the card design (it's fine to omit subtitles on cards if they crowd them).
- `/about/`: update the description to cover the current program (unrecorded incidents, surges and contagion, attitude measurement, algorithmic amplification), keeping it to one sentence of similar length. The links become the four papers.
- `/methods/`: keep the three rows and their text. Retarget the arrows: Data → /research/dark-figure/#methods; Methods → /research/amplification/#methods; Reproducibility → /research/contagion/#methods. Update the aria-labels.
- `/reader/?paper=<slug>`: multi-page preview for the new papers.
  - Real previous/next controls over the 12 preview pages, with the page count showing "N / 12".
  - After the last preview page, a clear end-of-preview note with "Open full PDF ↗" (target _blank to /pdfs/<slug>.pdf) and "Download PDF".
  - Zoom works on every page. Sheet aspect ratio: letter (612×792), not the proposals' 710×775.
  - Lazy-load preview images.
  - The accessible transcript for new papers = title, abstract, and the table of contents (section headings), plus "The full text is in the PDF."
  - Proposals keep the current single-page behaviour, with prev/next disabled (existing tests).
  - Invalid slugs fall back safely; no arbitrary URL loading.
  - Keyboard support: the arrow keys page when the canvas has focus.
  - Update the noscript links.

## Artwork (ART agent)
Create four new artworks matching the approved style. Study assets/artwork-research-*.png, assets/artwork-paper-*.png, assets/artwork-reference.png and docs/design-references/*.png. The style is flat, overlapping geometric shapes (arcs, rectangles, diagonals) with soft tonal steps, a fine paper/grain texture and subtle vignetting, in a single dominant hue family per artwork. Suggested motifs, which should be abstract and evocative, not literal:
- dark-figure: deep ochre/sand with a large half-circle mostly below a horizon line (the hidden mass).
- contagion: orange, with branching or cascading arcs.
- attitudes: lavender, with overlapping circles and a soft lens-shaped overlap.
- amplification: sand to orange, with stepped rectangles that grow along a diagonal.
Generate them procedurally in Python (numpy + Pillow; seeded, reproducible) at 2× the display sizes:
- research row 928×388 (display 464×194);
- paper hero 1254×566 (display 627×283);
- home featured 1476×604 (display ≈738×302);
- home card 640×500 (display ≈320×250).
Commit the generator as scripts/generate-artwork.py. Check that they look like they belong next to the existing artworks by rendering a contact sheet.

## Ownership (to avoid edit conflicts)
- **ART:** scripts/generate-artwork.py, the new assets/artwork-*-{dark-figure,contagion,attitudes,amplification}*.png. No HTML or CSS.
- **READER:**
  - reader/index.html, assets/reader.js, scripts/build-paper-previews.*, pdfs/<new slug>.pdf, pdfs/<slug>/*.webp;
  - scripts/build-static.mjs, scripts/check-site.mjs, test/*.test.mjs (site + reader tests);
  - reader-specific CSS ONLY in a clearly delimited block appended at the END of assets/styles.css (`/* === Reader: multi-page === */`). Re-read the file right before each edit.
- **PAGES:** index.html, research/index.html, research/<new slug>/index.html, about/index.html, methods/index.html, and all other CSS in assets/styles.css (never touch the reader block). Re-read styles.css right before each edit.
- **QA** (later): screenshots and checks only; reports issues.

## Acceptance
- `npm run check` passes.
- The desktop at 1536×1024 matches the existing visual language; the existing pages' approved composition is preserved apart from the requested additions.
- Responsive at 320/390/768/1024 with no horizontal overflow.
- Keyboard and focus work; the heading hierarchy is valid.
- Every new link works.
- The reader works for all 7 slugs.
- Do not push, deploy or publish. The orchestrator commits to the working branch.
