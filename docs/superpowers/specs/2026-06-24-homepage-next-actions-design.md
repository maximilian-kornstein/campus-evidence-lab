# Homepage Next-Actions UI Design

## Goal

Make the Campus Evidence Lab homepage answer one question immediately: what should a visitor do next?

The current site already communicates seriousness, caution, and scope. This pass should preserve that credibility while reducing decision friction for journalists, researchers, contributors, reviewers, and developers.

## Approved Baseline

Use the current dirty homepage direction as the baseline, not a restart:

- `index.html` already adds hero actions for searching records, building a reporting packet, downloading data, and reviewing methodology.
- `assets/app.js` already adds a dashboard command center, `Start Here` audience paths, and clearer action groupings.
- `assets/styles.css` already adds primary button, hero action, command action, and audience-path styling.
- `scripts/qa-render.mjs` and `scripts/qa-site.mjs` already contain early guardrails for the new copy.

Implementation should polish, test, and commit that direction instead of discarding it.

## Primary User Jobs

The homepage should route visitors into five concrete jobs:

1. Search public-source records.
2. Build a reporting or research packet.
3. Download the smallest useful data artifact.
4. Review methodology and responsible-use limits.
5. Inspect the CLE Protocol verification layer.

The first viewport should favor the first four jobs because they are the highest-frequency actions for normal visitors. Protocol remains visible, but it should not displace the primary public-use paths.

## Information Architecture

### First Viewport

The first viewport should contain:

- Brand and plain-language category: Campus Evidence Lab / public-source civil-rights evidence infrastructure.
- One direct headline: `Campus Evidence Lab`.
- One explanatory paragraph that names the core actions.
- Four action buttons:
  - `Search Records`
  - `Build Reporting Packet`
  - `Download Data`
  - `Review Methodology`

Only `Search Records` should be primary. The others should read as secondary peer options.

### Dashboard Command Center

Below the hero, show compact operational status and immediate commands:

- Public-source records.
- Schools with records.
- Source collections.
- Export availability.
- Current snapshot hash.

Then show four command actions mirroring the hero actions with slightly richer descriptions.

This section should be utilitarian, not decorative. It should make the site feel like a working evidence tool.

### Start Here By Audience

Add a tight audience selector:

- Journalists: search a school, select records, build packet, cite limits.
- Researchers: download snapshot-bound data, read methodology, cite manifest hash.
- Contributors: submit public sources, corrections, duplicate reports, or metadata fixes.
- Reviewers: audit samples, challenge source support, separate acknowledgment from endorsement.

This section should not become a marketing persona grid. It should be a routing aid.

### Secondary Entry Points

Keep broader paths below the primary routing:

- Audience Entry Points.
- Research Entry Points.
- Dataset Status.
- Documentation Signals.
- Recent Records.
- Trend charts.

Trend charts should be renamed and framed as `Current Documentation Patterns`, with explicit limits: not prevalence, safety, or legal conclusions.

## Research Workspace Copy

The existing `researchPacket()` changes should be retained and refined:

- Rename ambiguous `Citation Packet` language to `Reporting Packet`.
- Include a methodology note in generated Markdown.
- Preserve snapshot ID, snapshot hash, selected record count, source URLs, and limitations.
- Add the AI/downstream-analysis limitation already started:
  - AI-generated summaries or downstream analysis should not be treated as reviewed unless human-review metadata is present.

This is part of homepage clarity because `Build Reporting Packet` is a first-screen action. The destination experience needs matching language.

## Protocol Placement

The CLE Protocol should be present in:

- Primary navigation.
- Audience/entry point section.
- Downloads page.

It should be described as the evidence-integrity layer: canonical hashes, signed manifests, Merkle proofs, local verification, responsible-use checks, and optional chain adapters.

It should not make the homepage feel like a blockchain product. Normal visitors should still understand the site as a public evidence archive first.

## Visual Direction

Tone: disciplined civic command center.

The UI should be clear, restrained, and operational:

- Dense but readable.
- Minimal decoration.
- Strong hierarchy.
- Left-aligned text.
- Stable button sizes.
- No nested cards.
- No marketing hero illustration.
- No one-note purple/blue gradient styling.

Use the existing site visual system. Polish spacing, borders, action hierarchy, and responsive behavior rather than introducing a new design language.

## Accessibility And Responsiveness

The homepage must remain usable at mobile and desktop widths:

- Hero actions wrap cleanly.
- Command actions collapse from four columns to two and then one.
- Audience paths remain readable without text overflow.
- Buttons and links have visible focus states.
- Dynamic dashboard content must not create layout overlap.

## QA Requirements

Implementation must update or add checks for:

- Hero action labels in `index.html`.
- `Start Here` and audience routing copy in rendered dashboard output.
- `CLE Protocol` link visibility from homepage and downloads.
- `Reporting Packet` copy in research workspace.
- Responsible-use copy around chart patterns.
- No missing files in static build output.

Required verification commands:

```bash
npm run qa:site
npm run qa:accessibility
npm run qa:render
node scripts/build-static.mjs
SITE_ROOT=dist npm run qa:site
SITE_ROOT=dist npm run qa:accessibility
SITE_ROOT=dist npm run qa:render
```

If tests around review samples are affected by ordering changes, update focused tests in `test/review-samples.test.mjs` rather than loosening QA.

## Non-Goals

- No full visual rebrand.
- No new frontend framework.
- No protocol implementation work.
- No public deployment.
- No broad refactor of generated school pages.
- No redesign of every page.
- No removal of existing responsible-use cautions.

## Success Criteria

The pass is complete when:

- A new visitor can identify the next action within the first viewport.
- The homepage routes major audiences without forcing them to understand the whole archive.
- The reporting packet path has matching copy and generated output.
- Protocol is visible as a verification layer without dominating normal use.
- Source and `dist` QA pass.
- Only intentional homepage/UI/QA files are staged and committed.
