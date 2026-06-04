# Deployment

Campus Evidence Lab is a static site. The deployable artifact is `dist/`.

## Local Build

```sh
npm run build
```

The build runs:

- data validation
- content-safety QA
- data-quality QA
- record-hash integrity check
- CSV generation
- source audit generation
- robots generation
- release notes generation
- event, school, and brief page generation
- sitemap generation
- site QA against the source tree
- accessibility QA against the source tree
- render QA against the source tree
- static copy into `dist/`
- site QA against `dist/`
- accessibility QA against `dist/`
- render QA against `dist/`

## GitHub Pages

GitHub Pages deployment is configured in `.github/workflows/pages.yml`.

After the repository is pushed to GitHub:

1. Open repository Settings -> Pages.
2. Set source to GitHub Actions.
3. Run the `Deploy GitHub Pages` workflow or push to `main`.

The workflow runs `npm ci`, `npm run build`, uploads `dist/`, and deploys the verified static artifact.
The workflow sets `SITE_URL` to the GitHub Pages project URL so `sitemap.xml`, `rss.xml`, and `robots.txt` point to the first public deployment.

If `origin` is not configured yet, create the public GitHub repository first, then publish with:

```sh
npm run publish:github -- <repository-url>
```

If `origin` already points to the intended repository, use:

```sh
npm run publish:github
```

## Cloudflare Pages

This project is configured for Cloudflare Pages.

```sh
npx wrangler login
npm run launch:preflight
npm run deploy:cloudflare
```

`launch:preflight` reports missing launch prerequisites, including a missing GitHub remote and a missing or failed live source audit. Wrangler login is only required for direct Cloudflare CLI deployment.

Before public launch, run the advisory live source audit once from a networked local environment:

```sh
npm run audit:sources:live
npm run audit:sources:live:check
```

This writes `data/source-audit-live.json`, which is included in `dist/` as a public proof artifact. CI keeps the deterministic metadata audit in `data/source-audit.json` and does not call external publishers.

The deploy command runs `npm run build` first, then deploys `dist/`:

```sh
npx wrangler pages deploy dist --project-name campus-evidence-lab
```

Set `SITE_URL` when deploying to a non-default public URL:

```sh
SITE_URL=https://<public-site-url> npm run build
```

After deployment, verify the public artifact:

```sh
npm run verify:public -- <public-site-url>
```

## GitHub Integration

Use these settings for a Cloudflare Pages Git integration:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`

## GitHub Actions

The repository workflow runs the same release gate as deployment:

```sh
npm ci
npm run build
```

Use `npm ci` in CI so the locked `jsdom` render-QA dependency is installed exactly from `package-lock.json`.

## Deployment Gate

Do not deploy if `npm run build` fails. The QA gate checks:

- minimum `100` event records
- generated event pages
- generated school pages
- generated brief pages
- generated source pages
- sitemap coverage
- required data downloads
- source audit coverage
- manifest totals
- HTTPS source URLs
- internal static links
- accessibility and HTML semantics
- dynamic rendering for dashboard, events, schools, briefs, sources, quality, downloads, and submit
- content safety checks for attribution, privacy, and neutral language
- data quality checks for derived fields, dates, brief coverage, and community coverage
