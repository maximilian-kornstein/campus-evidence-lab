# Campus Evidence Lab

Campus Evidence Lab is a static-first public evidence archive for campus civil rights records.

The current foundation includes:

- structured sample data
- data schemas
- methodology notes
- record and snapshot hashing
- archived snapshot manifests
- generated snapshot index
- validation scripts
- CSV export generation
- denormalized research exports with joined school, source, and event-reference fields
- public changelog generation
- generated release notes for the current dataset snapshot
- RSS feed generation for briefs
- generated event detail pages
- public source detail pages
- public quality and review workflow metrics
- correction and review-log data artifacts
- generated source-audit artifact for provenance review
- content-safety QA for attribution, privacy, and neutral language
- data-quality QA for cross-file consistency and release thresholds
- accessibility QA for document semantics, tables, links, and form labels
- GitHub issue templates for source submissions, corrections, duplicate reports, and school metadata corrections
- GitHub Actions data validation workflow
- static event sitemap
- Cloudflare Pages configuration
- public About and License pages
- severe minimalist dashboard, event database, school, brief, source, quality, methodology, submit, and data pages

Run locally:

```sh
npm run prepare:data
npm run check
npm run dev
```

Then open `http://localhost:5173`.

Build for deployment:

```sh
npm run build
```

The deployable output is `dist/`. See [DEPLOYMENT.md](DEPLOYMENT.md).

The current dataset is conservative and public-source only. It is meant to prove the workflow, interface, and review standards across a broader civil-rights schema before private submissions or broader automation are considered.

Review operations are documented in [docs/review-workflow.md](docs/review-workflow.md). Content safety rules are documented in [docs/content-safety.md](docs/content-safety.md). The current public review state is published in `data/review-log.json`; correction outcomes are published in `data/corrections.json`.

Contribution standards are documented in [docs/contributing.md](docs/contributing.md). The public intake page can generate structured source, correction, duplicate, and school metadata packets for GitHub issue review.
