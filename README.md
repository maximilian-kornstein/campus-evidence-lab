# Kornstein Lab

For a local session continuing the visual goal, start with [LOCAL_SESSION.md](LOCAL_SESSION.md), the [approved mockup gallery](docs/design-references/README.md), and [the ready-to-paste goal prompt](LOCAL_GOAL_PROMPT.txt).

Clone the `rebrand/kornstein-ui-reset` branch to retrieve this implementation. The default `main` branch still contains the earlier site pending review; the handoff branch has not been deployed.

Kornstein Lab for Antisemitism Research focuses on quantitative methods and algorithms for studying antisemitism.

This local implementation follows the approved homepage, Research, Data & Methods, About, three paper-detail mockups, and LaTeX PDF reader. The paper content is explicitly a set of research proposals, not completed findings. The retired public-records UI remains excluded from the site.

## Development

The website requires Node.js 22 or later and no third-party JavaScript dependencies. Fonts and artwork are served locally.

```sh
npm run check
npm run dev
```

`check` builds the site, validates routes/assets/metadata, and runs the integration tests. `dev` rebuilds and serves only `dist/` at `http://localhost:5173`. Restart it after editing source files. Set `PORT` to change the local port.

## Pages

- `/`: homepage
- `/research/`: research index
- `/methods/`: Data & Methods
- `/about/`: About
- `/research/measurement/`: Measuring antisemitism in online discourse
- `/research/detection/`: Evaluating algorithms for antisemitism detection
- `/research/narratives/`: Mapping the spread of antisemitic narratives
- `/reader/?paper=measurement`: PDF reader; also accepts `detection` and `narratives`

The reader displays SVG pages rendered directly from the real, downloadable LaTeX PDFs. Zoom, download, paper selection, and return navigation work locally. A screen-reader transcript accompanies each preview; the PDF itself contains selectable text. The one-page proposals intentionally disable previous/next page controls.

## Papers

Sources are in `papers/`, with committed PDF and SVG output in `pdfs/`. Normal site builds do not require TeX. To rebuild the papers after editing the sources:

```sh
node scripts/build-papers.mjs
```

This requires `pdflatex` and `pdftocairo`. See [papers/README.md](papers/README.md).

## Visual verification

The eight approved references are retained in `docs/design-references/`. Layout measurements, responsive styling, and static checks are implemented, but **browser screenshot comparison is still blocked because this session has no browser-control or screenshot tool**. Do not describe the UI as pixel-perfect or visually accepted until that comparison is performed. See [the verification handoff](docs/ui-implementation.md).

## Build boundary

Only the explicit files in `scripts/build-static.mjs` enter `dist/`. The build deletes stale output first. Historical data, backend utilities, old feeds, TeX sources, and design references are not published. Retired URLs return the 404 page. See [DEPLOYMENT.md](DEPLOYMENT.md).

In the full repository, the old package manifests remain as `package.legacy.json` and `package-lock.legacy.json` for historical reference. They are not active configuration. The portable local-session snapshot omits those manifests, the historical data/backend files, and Git history. Use the original repository's pre-reset history to recover the former archive application as a whole.

The removed Signals generation and activation workflows cannot regenerate site pages through active CI. Already deployed external services are separate and have not been modified. The manual distribution-withdrawal workflow is retained.

Licensing: [LICENSE.md](LICENSE.md), [DATA_LICENSE.md](DATA_LICENSE.md), and [Inter's OFL](assets/fonts/OFL.txt).
