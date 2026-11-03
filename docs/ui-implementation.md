# Kornstein Lab implementation and visual acceptance

Status: implementation shared on `rebrand/kornstein-ui-reset` for local continuation; functional checks passing; **visual acceptance blocked, not complete**. No merge into `main` or deployment has been performed.

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
- The untouched homepage reference is used as an artwork atlas: CSS crops orange, lavender, and sand artwork regions. Original source rectangles: orange `(746,276,737,299)`; lavender `(433,612,319,248)`; sand `(1164,612,319,248)`.
- Responsive layouts at 1250, 900, 650, and 480px, with mobile navigation wrapping and paper cards stacking.
- Real Computer Modern LaTeX PDFs, 511.2 by 558pt, one page each. SVG previews are rendered from those PDFs. The reader's desktop document footprint is 710 by 775px.
- Reader paper selection is allowlisted. Zoom is limited to 75/100/125/150 percent. Downloads and return links follow the selected paper. A full accessible text transcript accompanies each preview.

## Checks completed

The build checks every local asset, route, fragment, page heading/landmark, PDF signature, SVG rendering, and sitemap entry. Integration tests cover stale output/legacy exclusion, retired-route 404s, supported MIME types, reader routing, downloads, transcript updates, zoom, resizing, and preview-load errors. PDFs compile without overfull boxes, contain embedded fonts and selectable text, and have one page each. The compiled measurement PDF was visually inspected as a raster rendering.

## Browser acceptance still required

No browser-control, CUA, or screenshot tool was exposed in this session. No browser screenshots of the implemented UI have been captured. PDF raster inspection and source-level geometry checks do not establish a perfect browser match.

When browser access becomes available:

1. Run the local build and server. Capture each route at 1536×1024 with fonts loaded and the reader at 100%.
2. Compare against its reference, checking shell/header/footer coordinates, type weight and line breaks, borders, artwork crops, card sizes, and document alignment. Inspect differences visually; account for the intended research-text replacements.
3. Iterate CSS and capture again until the desktop design is accepted. Do not claim perfect matching from the current static checks.
4. Verify 320, 390, 768, and 1024px widths for overflow, keyboard navigation, readable content, and functioning reader controls. Mobile layout is an adaptation because no mobile mockup was supplied.
5. Keep the work local until the user reviews it. Visual acceptance remains pending until the screenshot evidence exists.
