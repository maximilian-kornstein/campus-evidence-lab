# Kornstein Lab deployment

The current implementation is shared on the **`rebrand/kornstein-ui-reset` handoff branch pending review**. It has not been merged into `main` or deployed. Subsequent visual implementation work stays local until reviewed.

## Build

```sh
npm ci
npm run check
```

Use Node.js 22 or later. Publish only `dist/`, never the repository root. The build clears stale output and copies an explicit list of pages, artwork, fonts, reader code, PDFs, PDF renders, and security headers. Legacy archive/data generators are not part of the active build.

Optional `SITE_URL` generates a sitemap containing the seven public content routes. Reader and 404 pages are noindex. Use the real deployment base URL, not an invented Kornstein hostname.

PDF outputs are committed: deployment does not require TeX. To regenerate them locally, use `node scripts/build-papers.mjs` with `pdflatex` and `pdftocairo` installed, then run the normal checks.

## Existing hosting

The existing GitHub Pages workflow deploys `dist/` when changes reach `main` or the workflow is manually dispatched. Its existing domain is retained. No DNS or hosting ownership change is implied by this rebrand.

Cloudflare's existing `wrangler.toml` also points to `dist/`. The `_headers` rules apply there; GitHub Pages does not support that file's header directives.

Retired routes return the custom 404 page. They do not redirect to a successful generic page. The site uses root-relative URLs and is intended for the existing root-domain deployment; a project-subpath host would require a base-path adaptation.

## Acceptance

Browser screenshots at the reference desktop size and mobile sizes must be compared before marking visual acceptance complete. That verification is currently blocked by unavailable browser tools, as recorded in [docs/ui-implementation.md](docs/ui-implementation.md).

Existing externally deployed Signals workers are separate services. These source and build changes do not shut them down or change their schedules.
