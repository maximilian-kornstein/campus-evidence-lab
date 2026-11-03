# Kornstein Lab: local goal handoff

## Latest user review — 2026-11-03

The user approved the overall UI, then requested removal of the visible **Research proposal** label from the paper pages and PDFs/readers. This supersedes the older instruction below to retain that label. Keep the study prose prospective; no empirical findings were added.

On Data & Methods, remove the small slash-separated topic lists and replace the repeated three-part descriptions with **Research corpora**, **Algorithm evaluation**, and **Reproducible analysis**. Center each description consistently in its row and remove the per-row offset adjustments. The original PNGs remain unchanged historical design references. Latest evidence is in `artifacts/visual/refinement-2026-11-03/`.

## Start here

Clone the dedicated handoff branch, then open **the resulting `kornstein-lab/` folder containing `package.json`** as the local session's workspace. Paths in these instructions are relative to that folder.

```sh
git clone --single-branch --branch rebrand/kornstein-ui-reset https://github.com/maximilian-kornstein/campus-evidence-lab.git kornstein-lab
cd kornstein-lab
```

The `rebrand/kornstein-ui-reset` branch contains the current implementation, tests, local fonts/artwork, real proposal PDFs, LaTeX sources, these instructions, and all eight approved mockups. The default `main` branch remains the earlier site until review. Clone the named branch to retrieve this implementation.

For an existing checkout, preserve unrelated local changes, fetch the handoff branch, and switch to it safely. Do not reset or overwrite local work. The original cloud path `/workspace/campus-evidence-lab` is not your local starting folder.

The earlier portable ZIP remains an alternative active-site snapshot. It omits Git history, deployment workflows, and historical data/backend files; an ordinary repository clone includes that retained material. The active build still excludes it from the website.

## Goal

Finish the approved Kornstein Lab mockups as functioning UI. The user's visual requirement is exact matching: inspect actual browser screenshots, fix the discrepancies, and repeat. The implementation exists, but **browser comparison has never been performed and visual acceptance remains incomplete**.

Use the existing pages as the starting point. The approved visual language is warm white, bold black sans-serif typography, orange links and accents, thin rules, and orange/lavender/sand geometric artwork. Keep copy minimal. Retain actual HTML text and working controls; do not substitute a full-page reference image for UI.

Brand: **Kornstein Lab**. Full name: **Kornstein Lab for Antisemitism Research**. Focus: **quantitative and algorithmic research on antisemitism**. The former public-records/archive focus was explicitly retired.

## References and intended content changes

Open the [mockup gallery](docs/design-references/README.md) and inspect every original PNG before editing. They are the visual source of truth, at **1536 × 1024 pixels**.

| Page | Local route | Approved mockup |
| --- | --- | --- |
| Homepage | `/` | `docs/design-references/01-home.png` |
| Research | `/research/` | `docs/design-references/02-research.png` |
| Data & Methods | `/methods/` | `docs/design-references/03-methods.png` |
| About | `/about/` | `docs/design-references/04-about.png` |
| Measurement paper | `/research/measurement/` | `docs/design-references/05-paper-measurement.png` |
| Detection paper | `/research/detection/` | `docs/design-references/06-paper-detection.png` |
| Narratives paper | `/research/narratives/` | `docs/design-references/07-paper-narratives.png` |
| LaTeX reader | `/reader/?paper=measurement` | `docs/design-references/08-reader-latex.png` |

These differences in the older pictures are already authorized and must stay changed:

- “Measuring antisemitism in public records” becomes **“Measuring antisemitism in online discourse.”**
- “Evaluating language models for antisemitism detection” becomes **“Evaluating algorithms for antisemitism detection.”**
- The Data & Methods topic “Public records” becomes **“Research corpora.”**
- Proposal abstracts, methods, and PDFs use the new quantitative/algorithmic subjects. The reader uses a real LaTeX document, without branded paper artwork.

Preserve the reference hierarchy, proportions, colors, artwork, and spacing around those changes. Record the intended text differences in the comparison report; do not restore obsolete content to improve a pixel score. Do not introduce decorative eyebrows, helper paragraphs, placeholder badges, generic marketing sections, or invented completed research. The paper pages' plain “Research proposal” status is meaningful and should remain.

## Setup

Use Node.js **22 or later**. No third-party JavaScript packages are needed for the site itself.

```sh
node --version
npm run check
npm run dev
```

The site serves at `http://localhost:5173`. Serve it over HTTP; do not open `index.html` as a local file, because URLs start at the site root. `npm run dev` builds once and serves `dist/`. After source edits, run `npm run build` in another terminal and reload the page. There is no live-reload process.

Use the browser and screenshot tools available and permitted in the **local** session. Read its applicable browser instructions. Discover the actual capabilities rather than carrying forward the cloud session's missing-browser assumption. If a tool requires an extension connection, establish that supported connection before visual QA. Do not call the goal complete without the required screenshots.

TeX is optional for normal site development: the PDFs and their matching SVG previews are included. If changing a paper, install the local equivalents of `pdflatex` and Poppler's `pdftocairo`, then run:

```sh
node scripts/build-papers.mjs
npm run check
```

Keep the TeX source, downloadable PDF, SVG preview, landing-page abstract/methods, and accessible reader transcript consistent.

## Agent team and ownership

Use a coordinating agent and parallel specialists. Coordinate edits to shared files rather than letting agents overwrite each other.

| Owner | Scope |
| --- | --- |
| Coordinator | Reference mapping, integration, keeping the site running, and final acceptance report |
| Shared design/artwork | `assets/styles.css`, local fonts/artwork, desktop measurements and responsive behavior |
| Site pages | `index.html`, `research/index.html`, `methods/index.html`, `about/index.html` |
| Papers/reader | Three paper-detail pages, `reader/index.html`, `assets/reader.js`, `papers/`, `pdfs/` |
| Visual/function QA | Browser captures, comparisons, keyboard/mobile checks, and regression evidence |

The QA agent should begin by producing baseline screenshots while implementation agents measure discrepancies. Share findings immediately. Let the coordinator own build/check changes if the public file list needs to change.

## Browser comparison workflow

1. Capture a baseline for all eight routes at **1536 × 1024 CSS pixels**, device scale factor **1**, browser zoom **100%**, and reader zoom **100%**. Wait for `document.fonts.ready` and all images to finish loading. Record the browser and version. Capture the visible viewport, not a resized full-page screenshot.
2. Save actual captures under `artifacts/visual/baseline/`. Keep references unchanged. Produce side-by-side, overlay, and difference images under `artifacts/visual/comparisons/` using comparison tools permitted in that session.
3. Inspect each page at native resolution. Check shell/header/footer coordinates, typography and line breaks, card dimensions, spacing, border thickness, colors, artwork crops, and PDF sheet size/alignment. Use the screenshots to identify problems; do not infer a pass from CSS values.
4. Fix observed differences in focused passes: shared geometry and font metrics first, then page composition, then details. Rebuild before each new capture. Recheck every page affected by a shared-style change.
5. Save final screenshots under `artifacts/visual/final/` and write `artifacts/visual/REPORT.md` linking to references, actual captures, and comparisons. Explain intended content differences and any rendering differences. Never hide layout errors with broad comparison masks, edit a reference to match the site, or report a zero-difference result that was not measured.
6. Continue until the required visual match is demonstrated. Passing unit tests is not a substitute. If a real environment blocker prevents the comparison, preserve the evidence and exact blocker; do not label the visual requirement complete.

Antialiasing, generated-reference letterforms, and the authorized text replacements can affect literal pixel comparison. Report those differences honestly and keep fixing visible layout mismatches; do not silently redefine “perfect” or invent visual verification.

## Responsive and functional acceptance

No mobile mockups were supplied. Adapt the desktop design at **320, 390, 768, and 1024px widths**, retaining the same hierarchy and content. Check every page for clipping and horizontal page overflow; scroll inside the PDF canvas at higher reader zoom is intentional.

Verify:

- Navigation, all research cards, back links, and paper `#methods` links.
- All three reader selections: `?paper=measurement`, `?paper=detection`, and `?paper=narratives`.
- The selected title, document preview, transcript, back link, and download all refer to the same paper.
- Zoom at 75%, 100%, 125%, and 150%, including after resizing.
- Three valid downloadable PDFs with embedded fonts and selectable text.
- Single-page previous/next controls remain disabled; they must not pretend to navigate.
- Invalid paper selections fall back safely; no arbitrary file/URL loading.
- Keyboard navigation, visible focus, skip link, heading hierarchy, and readable text. Preview graphics have a corresponding accessible transcript.
- Former archive URLs such as `/events/`, `/schools/`, and `/data/events.json` remain real 404s.
- `npm run check` passes after the final changes. The current baseline has nine passing tests; it does not prove a visual match.

## Files and boundaries

The site is static HTML/CSS with a small reader module. Do not migrate frameworks or add an unnecessary runtime. Extend only the explicit public-file allowlist in `scripts/build-static.mjs` if a required new asset is added. `docs/`, `papers/`, tests, historical sources, and comparison artifacts must stay outside `dist/`.

`assets/artwork-reference.png` is an unchanged copy of the approved homepage. CSS displays cropped artwork regions from it; the surrounding reference text is not used as page UI. `assets/fonts/InterVariable.woff2` is local and licensed by `assets/fonts/OFL.txt`.

The handoff branch push is authorized so the local session can clone this work. **Keep subsequent implementation changes local until reviewed. Do not push further changes, merge into `main`, publish, deploy, change DNS, or send messages to outside services without new authorization.** Do not create a new hosted Site. Leave the final local preview available and report its URL, validation results, comparison evidence, and any unresolved discrepancy.

The prior technical notes are in [docs/ui-implementation.md](docs/ui-implementation.md). Treat their browser limitation as historical session context, not a permanent restriction on the new local environment.
