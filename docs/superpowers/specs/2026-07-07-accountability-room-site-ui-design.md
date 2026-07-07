# Accountability Room And Site UI Design

## Purpose

Campus Evidence Lab has already crossed the promised scale milestone with 150,000 accepted import-wave QA candidates. The next product step is to make that achievement legible to serious human evaluators without turning the project into a cold database, a rankings product, or a visual demo.

The Accountability Room is the flagship experience for that shift. It should let a visitor open an institution and understand, in roughly 90 seconds:

- what the public record says;
- what the public record does not say;
- which source families support the view;
- how institution response and right-of-reply are handled;
- how many records are public event records with review-tier metadata versus accepted import-wave QA candidates;
- how to inspect the source packet and reproduce the data trail.

The UI style from the generated concept is approved as the direction: serious, square-edged, document-like, human-readable, and less cold than the current site. It must not use decorative gradients, soft rounded cards, fake icons, stock imagery, glowing UI, or any surface that reads as vibe-coded.

## Approved Decisions

- Primary evaluator: Tyler Cowen and other elite evaluators who are judging founder-grade speed, judgment, usefulness, and restraint.
- Primary user experience: Accountability Room, not a generic AI chat or metrics dashboard.
- Emotional frame: calm investigative briefing room.
- Visual direction: public evidence infrastructure, not nonprofit marketing and not SaaS dashboard decoration.
- Core page stance: source-bounded accountability, not rankings, safety scores, prevalence estimates, severity scores, legal findings, or implied human certification of every imported row.
- Implementation stance: build on the existing static site, generated school pages, import-wave artifacts, and QA scripts. Do not introduce a frontend framework for this pass.

## Scope

This spec covers two linked changes:

1. A new Accountability Room experience.
2. A site-wide UI refinement that carries the Accountability Room style across the homepage, school pages, import-wave pages, press/about/methodology framing, and shared components.

The first implementation should be narrow enough to ship safely:

- add a top-level Accountability Room entry page;
- redesign generated institution dossier pages into briefing-room pages;
- update the homepage and stale public copy for the 150,000 accepted QA candidate milestone;
- refine shared CSS tokens and components;
- add tests and QA for visual integrity, claim limits, stale counts, accessibility, and render stability.

## Non-Goals

- No rankings, scoreboards, league tables, heat maps, severity scores, or institution safety grades.
- No legal conclusions or claims that a row proves institutional wrongdoing.
- No claim that all 150,000 accepted import-wave QA candidates are individually human-certified.
- No AI chat, model training, API product, Atlas, or local researcher kit in this implementation. Those remain in the ambitious package backlog.
- No frontend framework migration.
- No decorative icon system.
- No dark-mode redesign.
- No broad restructuring of the data import pipeline unless a page requires a small summary artifact.

## Product Architecture

### Top-Level Accountability Room

Add `/accountability-room/` as the public entry point.

The page should answer:

- what the Accountability Room is;
- how to search or choose an institution;
- what counts are available in the current snapshot;
- how the system separates public event records from accepted import-wave QA candidates;
- where source packets, import waves, corrections, and right-of-reply live.

The page should include:

- a concise page title: `Accountability Room`;
- a primary search/open institution action, backed by existing static school links where possible;
- current scope counters:
  - 4,000 public event records;
  - 150,000 accepted import-wave QA candidates;
  - 5,470 generated institution pages;
  - source-family mix for accepted import waves;
- a clear limitation line: `No rankings. No safety scores. No legal findings.`;
- links to methodology, import waves, corrections/right-of-reply, downloads, and policies.

### Institution Briefing Pages

Generated school pages should become the main institution Accountability Room surface. The URL can remain `/schools/{school_id}/` to preserve existing links; the content and navigation should make clear that each school page is an Accountability Room.

The first viewport should show:

- institution name, city, and state;
- a bounded one-paragraph public-record brief;
- record counters separated by lane:
  - public event records with review-tier metadata in the current dataset;
  - accepted official-source QA candidates linked to the institution when that summary is available;
  - source families represented;
  - institution-response evidence count;
- primary actions:
  - open records;
  - build source packet;
  - request correction/right-of-reply;
  - inspect source basis.

The body should be organized as briefing sections:

1. `What the public record says`
   - timeline of public event records;
   - source-family mix;
   - public OCR/legal items where present;
   - official aggregate source rows where present.

2. `Institution response`
   - public institutional responses found in the dataset;
   - response-depth mix;
   - absence language that does not imply no response exists outside the current snapshot.

3. `Unresolved limits`
   - known source limitations;
   - review needs;
   - missing source locators or unresolved mapping remain excluded from public assertions;
   - explicit note that records are not prevalence, safety, severity, or legal findings.

4. `Source packet`
   - related source list;
   - citation packet action;
   - import-wave artifacts where applicable;
   - dataset snapshot hash.

5. `Correction / right of reply`
   - correction intake;
   - duplicate reports;
   - stronger source locators;
   - institutional response submissions.

### Homepage And Public Framing

The homepage must stop presenting the project as only a 4,000-record civil-rights event archive. It should present two layers:

- `4,000 public event records` for source-backed event pages and research packets.
- `150,000 accepted import-wave QA candidates` for official-source accountability rows that passed deterministic QA but are not individual human certification.

The homepage should route visitors to:

- Accountability Room;
- Events;
- Import Waves;
- Downloads;
- Methodology;
- Corrections/right-of-reply.

The homepage should preserve restraint. The 150,000 number is a proof of execution and infrastructure, not a scoreboard.

### Press, About, Methodology, And Footer

Update stale copy that says or implies:

- only 4,000 records exist;
- all public records are human-reviewed;
- human review is required before any row appears anywhere on the public site.

Replacement language should distinguish:

- public event records;
- accepted import-wave QA candidates;
- certification batches;
- human review and audit tiers;
- public-use limits.

The footer should no longer say `Human review required` without qualification. Prefer language like:

`Public-source records / Import-wave QA / Corrections and right-of-reply`

## Data Flow

The implementation should reuse existing data first:

- `data/events.json` for public event records.
- `data/schools.json` for institution identity.
- `data/sources.json` for related sources.
- `data/import-waves/*.json` for accepted import-wave counts and QA status.
- `data/import-candidates/*.json` when institution-level accepted-candidate summaries need to be computed.
- `data/import-quarantine/*.json` for exclusion and quarantine preservation.
- `data/snapshot-manifest.json` for hashes.

Generate a compact derived artifact for institution-level import-wave summaries rather than loading 150,000 candidate rows in browser JavaScript. The derived artifact should be generated during `npm run prepare:data` or `npm run pages:data` and should include only public-safe summary fields:

- school ID;
- accepted QA candidate count;
- source-family counts;
- record-lane counts;
- aggregate subtype counts;
- import-wave IDs represented;
- latest source package year;
- no raw private or sensitive fields.

The browser should stay static and lightweight. The page generator can do heavier summarization at build time.

## Visual System

### Tone

Calm investigative briefing room.

The site should feel like a serious public evidence file: readable, direct, organized, and built for repeated inspection. It should become warmer through clearer language, better hierarchy, and useful page anatomy, not through softness or decoration.

### Layout

- Use full-width page bands and unframed layouts, not card stacks.
- Use square panels and thin rules when information needs framing.
- Avoid nested cards.
- Keep first viewport as a briefing surface, not a marketing hero.
- Use left-aligned content.
- Use stable grid dimensions for metrics, action rows, tables, and dossier sections.
- Keep dense operational surfaces readable through spacing rhythm, not large decorative whitespace.

### Typography

- Keep the current plain typographic posture, but tune sizes for a document-like hierarchy.
- Avoid giant hero type inside operational pages.
- Use smaller, tighter headings inside panels and sidebars.
- Do not use viewport-width font scaling.
- Letter spacing stays at `0` except where existing uppercase labels already require a subtle system convention.

### Color

- Preserve light mode as canonical.
- Use tinted paper/neutral backgrounds only where they improve hierarchy.
- Avoid one-note palettes.
- Avoid dominant purple, blue-gradient, beige, espresso, or decorative accent palettes.
- Use black or near-black only as a functional text/border anchor; if tokens change, use a subtle warm/cool neutral system consistently.

### Borders And Shapes

- Border radius should remain `0` for major surfaces and controls unless a native browser control requires otherwise.
- Borders should be purposeful and aligned.
- No decorative drop shadows.
- No glassmorphism, glow, blur, or bokeh.

### Icons

The Accountability Room should not rely on decorative icons.

Icons may be used only when they are functional and familiar, such as search, download, external link, copy, or close. If used, they must:

- come from a consistent icon source;
- be optically aligned with text;
- include accessible labels or adjacent text;
- not appear as large decorative symbols above headings.

The default implementation should use text links and button labels before adding icons.

### Motion

Motion is not necessary for the first pass. If any interaction state animates, it should be limited to opacity or transform, respect reduced-motion preferences, and serve a clear state change.

## Copy Rules

Use direct, source-bounded language.

Allowed phrases:

- `accepted import-wave QA candidates`;
- `official-source aggregate rows`;
- `public event records`;
- `source-backed records`;
- `current snapshot`;
- `public-source documentation`;
- `right-of-reply and correction intake`.

Avoid or block phrases when they overstate:

- `ranking`;
- `safety score`;
- `severity score`;
- `prevalence`;
- `legal finding`;
- `proved`;
- `certified` unless tied to a specific certification artifact;
- `human-reviewed` for import-wave candidates unless true for the row or page.

For empty or missing data:

- say `No public institutional response is recorded in the current dataset`;
- do not say `The institution did not respond`;
- say `No public legal or OCR item is recorded in the current dataset`;
- do not imply no legal or OCR matter exists elsewhere.

## Error And Edge States

The static site should handle:

- institutions with zero public event records but accepted import-wave summaries;
- institutions with event records but no import-wave summary;
- institutions with no response evidence;
- institutions with long names;
- institutions with duplicate-like names resolved by stable IDs;
- missing websites;
- no related sources;
- long source titles;
- mobile viewports where tables need horizontal scrolling.

Every empty state should preserve the claim limits and give a useful next action: open import waves, request correction, inspect methodology, or download data.

## QA And Acceptance Criteria

### Content QA

Add or update QA checks to ensure:

- homepage mentions 150,000 accepted import-wave QA candidates;
- homepage still distinguishes 4,000 public event records;
- Accountability Room pages include the limitation line `No rankings. No safety scores. No legal findings.`;
- school pages do not imply all import-wave rows are individually human-certified;
- stale `947 schools` language is removed or replaced;
- footer language is qualified;
- prohibited phrases are not introduced in public claim text.

### Data QA

Checks should verify:

- accepted import-wave summary counts match source artifacts;
- institution-level summary totals, if generated, sum to the expected accepted candidate total or document deliberate exclusions;
- no accepted summary row lacks school identity;
- source-family and record-lane labels use the existing manifest vocabulary;
- generated pages keep snapshot hash visibility.

### Accessibility QA

Checks should verify:

- keyboard focus remains visible;
- links and buttons have clear text;
- search controls have labels;
- tables have headers;
- section hierarchy is valid;
- color contrast remains AA;
- mobile pages have no horizontal overflow except deliberate table wrappers.

### Visual QA

The render QA should add checks for:

- no overlapping text in first viewport at desktop and mobile widths;
- no button text overflow;
- no nested card-like panel structure in the Accountability Room first viewport;
- no CSS gradients used for hero or primary page backgrounds;
- no border-radius above the existing strict threshold for major components;
- no decorative icon grid;
- stable alignment of the briefing metrics and action row.

Manual visual review should cover:

- homepage;
- Accountability Room index;
- a high-record institution page;
- a zero-event institution page with import-wave summary;
- an import-wave detail page;
- about/methodology/press pages.

## Implementation Phases

### Phase 1: Spec And Plan

Write this spec, self-review it, commit it, and then write a detailed implementation plan before code changes.

### Phase 2: Data Summary And Tests

Add tests for the expected public copy, stale-count removal, institution summary behavior, and prohibited claim language. If needed, add a compact generated institution import-wave summary artifact.

### Phase 3: Accountability Room Pages

Create the `/accountability-room/` entry page and redesign school page generation around the briefing-room anatomy.

### Phase 4: Site-Wide Visual System

Refine shared CSS, homepage, footer, press/about/methodology, import-wave pages, and common action components so the site feels coherent with the Accountability Room.

### Phase 5: Full Verification

Run focused tests, full data validation, content QA, accessibility QA, render QA, dataset hash check, and build. Do not deploy or push public site changes until verification passes.

## Required Verification Commands

At minimum, before declaring implementation complete:

```bash
npm run test:import-wave
npm run validate:data
npm run qa:content
npm run qa:data-quality
node scripts/hash-dataset.mjs --check
npm run qa:site
npm run qa:accessibility
npm run qa:render
npm run build
```

If visual tests are added with a browser runner, include desktop and mobile screenshots for:

- `/`;
- `/accountability-room/`;
- `/schools/brown_university/`;
- one zero-event generated school page;
- `/import-waves/`;
- one import-wave detail page.

## Success Criteria

The work succeeds when:

- a serious evaluator can understand the project’s scale, limits, and source basis in under 90 seconds;
- the Accountability Room feels like the product center of Campus Evidence Lab;
- school pages read as institution accountability briefings, not raw database outputs;
- the site visibly reflects the 150,000 accepted QA candidate milestone without overstating it;
- the UI is calmer, warmer, and more human-friendly without becoming soft, decorative, or unserious;
- QA catches stale counts, overclaiming, alignment problems, icon misuse, and visual patterns that read as vibe-coded.
