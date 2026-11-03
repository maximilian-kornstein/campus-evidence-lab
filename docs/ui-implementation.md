# Kornstein Lab implementation and visual acceptance

Status: the user-reviewed Kornstein Lab UI is finalized on `rebrand/kornstein-ui-reset` and recorded in local Git. No push, merge into `main`, or deployment is authorized by this finalization. Visual comparison was performed; remaining font/rendering differences are documented rather than described as pixel-identical.

## Latest review refinement — 2026-11-03

Following user review, removed the repeated Research proposal label from paper pages, PDF subtitles and reader transcripts while retaining prospective study prose. Data & Methods now has three concise descriptions without subtopic lists, and consistently centered row content instead of per-row position offsets. All eight updated desktop captures and scoped checks are in `artifacts/visual/refinement-2026-11-03/`. Earlier evidence remains a historical record of the approved first pass.

## Approved reference mapping

All reference PNGs are unchanged copies in `docs/design-references/`, excluded from deployment. The reference size is 1536 by 1024 pixels.

| Route | Reference |
| --- | --- |
| `/` | `01-home.png` |
| `/research/` | `02-research.png` |
| `/methods/` | `03-methods.png` |
| `/about/` | `04-about.png` |
| `/research/measurement/` | `05-paper-measurement.png` |
| `/research/detection/` | `06-paper-detection.png` |
| `/research/narratives/` | `07-paper-narratives.png` |
| `/reader/?paper=measurement` | `08-reader-latex.png` |

The user authorized replacing the public-records paper with quantitative/algorithmic research. The new measurement title is “Measuring antisemitism in online discourse”; the detection title is “Evaluating algorithms for antisemitism detection.” Paper text describes proposals and contains no fabricated empirical results. These intended text changes must not be treated as accidental image differences.

## Implementation details

- Semantic, selectable HTML text rather than screenshot overlays.
- Shared 1430px desktop shell, 76px header, local Inter variable font under the OFL, warm-white background, orange links, hairline rules.
- The homepage uses the untouched homepage reference as an artwork atlas. Other pages use ten artwork-only crops from their respective approved mockups, preventing aspect-ratio changes from distorting their compositions. Crop rectangles are recorded in `artifacts/visual/artwork-provenance.json`; no reference text or interactive UI is used as a page image.
- Responsive layouts at 1250, 900, 650, and 480px, with mobile navigation wrapping and paper cards stacking.
- Real Times-compatible Nimbus Roman LaTeX PDFs, 511.2 by 558pt, one page each. SVG previews are rendered from those PDFs. The reader's desktop document footprint is 710 by 775px.
- Reader paper selection is allowlisted. Zoom is limited to 75/100/125/150 percent. Downloads and return links follow the selected paper. A full accessible text transcript accompanies each preview.

## Checks completed

Final validation on 2026-11-03 used Node 22.23.1. `npm run check` passes all nine tests and validates 33 public files. The original browser pass covered all eight desktop routes and 40 responsive states; the final refinement passed 108 browser check groups across 35 affected page/viewport states at 1536, 320, 390, 768 and 1024px. Navigation, paper methods anchors, keyboard focus, all three readers, four zoom levels, resizing and real PDF downloads were checked. No browser exceptions, failed requests, page overflow, clipped text or overlapping reader controls were observed.

All three PDFs were regenerated with matching SVG previews and visually inspected. Each is one page with embedded fonts and selectable body text. Study-specific TeX sources and reader research content are unchanged. The measurement PDF's CMEX10 large-symbol font lacks a Unicode map under Tectonic, so equation extraction is imperfect; the accessible reader transcript supplies its full equation.

Full screenshot comparisons and machine-readable checks remain in the ignored local `artifacts/visual/` directory; they are deliberately excluded from the published site and this source commit. The approved original mockups in `docs/design-references/` remain unchanged. The user approved the visual result and requested repository finalization after reviewing the label and Methods refinements.

## Local browser comparison

The local session used installed Chrome through bundled Playwright, without adding a site runtime dependency. Baselines were captured with Chrome 156.0.8078.74 and finals with 156.0.8078.80, at 1536×1024 CSS pixels, device scale factor 1, browser zoom 100%, and reader zoom 100%, after fonts and images loaded.

The team corrected font optical sizing/weight/tracking, header/footer metrics, card and row geometry, artwork crops, page-specific paper spacing/buttons, and the reader's LaTeX typography. All active pages and the 404 page now give the skip link a focusable main landmark. The reader toolbar is centered independently of its side links. The paper build uses installed Tectonic when pdfLaTeX is absent and retains one-page/no-overfull-box checks.

See `artifacts/visual/REPORT.md` for the reference/capture/comparison gallery, authorized topic differences, measurements, responsive/functional evidence, and rendering limitations. The preview remains at `http://localhost:5173`. The reviewed implementation is saved locally in Git; visual artifacts remain local and excluded from the public build.
