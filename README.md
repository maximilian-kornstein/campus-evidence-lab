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
- public launch preflight checks and launch checklist
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
- reviewer checklist issue template for documented methodology, source, classification, research-guide, and data-export review
- public trust packet, acknowledgment status page, outreach draft, and partner acknowledgment policy
- GitHub Actions data validation workflow
- GitHub Pages deployment workflow
- static event sitemap
- Cloudflare Pages configuration
- public About and License pages
- severe minimalist dashboard, event database, school, brief, source, quality, methodology, impact, contributor guide, research guide, submit, and data pages
- static-first usability surfaces for filtered exports, shareable searches, school dossiers, research citation packets, and reviewer queues
- minimal Solidity snapshot registry for optional public dataset-hash attestations
- analysis briefs for responsible use, source availability limits, ED data limits, and reviewer-network readiness

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

Run the local Solidity registry tests:

```sh
npm run test:contracts
```

The registry is documented in [docs/snapshot-registry.md](docs/snapshot-registry.md). No mainnet deployment is included or authorized by default.

Before public launch, run:

```sh
npm run launch:preflight
```

For the public proof package, refresh the advisory live URL audit:

```sh
npm run audit:sources:live
npm run audit:sources:live:check
```

To publish to a new public GitHub repository after creating it:

```sh
npm run publish:github -- <repository-url>
```

After the site is live:

```sh
npm run verify:public -- <public-site-url>
```

See [PUBLIC_LAUNCH.md](PUBLIC_LAUNCH.md) for the GitHub and Cloudflare launch checklist.

The current dataset is conservative and public-source only. It is meant to prove the workflow, interface, and review standards across a broader civil-rights schema before private submissions or broader automation are considered.

Review operations are documented in [docs/review-workflow.md](docs/review-workflow.md). Content safety rules are documented in [docs/content-safety.md](docs/content-safety.md). Responsible public use is published at `/research-guide/`. The trust packet is published at `/trust/`; public acknowledgment status is published at `/acknowledgments/`. The current public review state is published in `data/review-log.json`; correction outcomes are published in `data/corrections.json`.

Contribution standards are documented in [docs/contributing.md](docs/contributing.md). The public intake page can generate structured source, correction, duplicate, and school metadata packets for GitHub issue review.
