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

## Cloudflare Pages

This project is configured for Cloudflare Pages.

```sh
npx wrangler login
npm run launch:preflight
npm run deploy:cloudflare
```

`launch:preflight` reports missing launch prerequisites, including a missing GitHub remote or unauthenticated Wrangler session. It is expected to fail until the repository remote is configured and Wrangler login has completed.

The deploy command runs `npm run build` first, then deploys `dist/`:

```sh
npx wrangler pages deploy dist --project-name campus-evidence-lab
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
