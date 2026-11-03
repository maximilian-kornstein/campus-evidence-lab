# Research proposal documents

These three one-page documents are design-stage research proposals. They contain prospective methods and illustrative equations, not completed research or empirical results.

The source is standard LaTeX `article` with embedded Times-compatible Nimbus Roman fonts. The custom page size is 7.10 × 7.75 inches (511.2 × 558 PDF points), matching the proportions of the approved reader mockup.

Regenerate the committed PDFs and their SVG page renderings with:

```sh
node scripts/build-papers.mjs
```

This uses `pdflatex` (with `geometry`, `amsmath`, `hyperref`, `fontenc`, and `mathptmx`), or the installed `tectonic` compiler when `pdflatex` is unavailable, plus Poppler's `pdftocairo`. Normal site builds use the committed artifacts and do not need TeX installed. The script disables shell escape, compiles in a temporary directory, verifies one page per document, and removes its intermediate files.

`pdfs/measurement.pdf`, `pdfs/detection.pdf`, and `pdfs/narratives.pdf` contain selectable text and embedded fonts. The corresponding `*-page.svg` files are generated directly from those PDFs to give the reader a consistent visual rendering. The website provides the paper's text separately for accessible reading.
