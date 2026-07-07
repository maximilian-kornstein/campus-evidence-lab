# CEL Accountability Infrastructure Pack Design

## Purpose

Campus Evidence Lab has crossed the scale milestone with 150,000 accepted import-wave QA candidates and 4,000 public event records. The next step is to make that scale useful, reproducible, and legible to serious evaluators without adding unsupported AI claims, rankings, safety scores, legal conclusions, or prevalence claims.

The CEL Accountability Infrastructure Pack turns the project into a public accountability system with four linked pieces:

- Accountability Signals: descriptive institution-level signals that explain source basis, response evidence, correction posture, and unresolved limits without scoring institutions.
- CEL Developer API: static, versioned JSON endpoints for researchers, civic technologists, DeSci users, and journalists.
- Tyler Demo Path: a short proof route for elite evaluators that shows the project's speed, restraint, source discipline, and reproducibility in about 90 seconds.
- Local Researcher Kit: zero-cost terminal tools and docs that let researchers query the public data locally and generate citation packets from repo artifacts.

Ask CEL and model training remain deferred. The stronger near-term claim is not that CEL trained a model; it is that CEL publishes citation-bound, reproducible accountability infrastructure over official-source QA records.

## Product Principles

- No scores, rankings, heat maps, league tables, institution grades, safety scores, severity scores, legal findings, or prevalence estimates.
- No claim that all accepted import-wave candidates are human-certified.
- No private or sensitive fields in public summaries, API responses, demo artifacts, or local kit outputs.
- Every public number must be traceable to a generated artifact, a dataset file, a source-family manifest, or a snapshot hash.
- Each surface must distinguish public event records from accepted import-wave QA candidates.
- The system should feel like public evidence infrastructure, not a SaaS dashboard, AI demo, marketing site, or advocacy scoreboard.
- The first implementation should stay static-first and build on the existing generation pipeline.

## Scope

This spec covers one integrated build with four deliverables.

### 1. Accountability Signals

Accountability Signals are institution-level descriptors generated from existing public artifacts. They are not risk scores or judgments. They help a visitor understand what kind of public-source support exists for an institution page.

Signals should include:

- `source_depth`: whether the institution has public event records, accepted import-wave QA candidates, multiple source families, source locators, or only limited public source basis.
- `official_source_coverage`: source-family mix from accepted import waves and public event records.
- `response_evidence`: whether the current snapshot includes direct institution response evidence, agency-described response evidence, limited public response notes, or no response evidence found in the current dataset.
- `correction_posture`: whether correction/right-of-reply paths are available and whether correction records exist in the current snapshot.
- `unresolved_limits`: visible limitations such as missing response evidence, no public event records, accepted candidates not human-certified, or source-family constraints.
- `recent_official_movement`: whether the institution has source packages or waves from recent official structured sources.

Signals must be descriptive. Allowed labels include:

- `source-backed event records present`
- `accepted official-source QA candidates present`
- `multiple official source families represented`
- `institution response evidence present`
- `current snapshot has no institution response evidence`
- `correction and right-of-reply path available`
- `known public-source limits remain`

Disallowed labels include:

- `high risk`
- `low risk`
- `dangerous`
- `safe`
- `noncompliant`
- `bad actor`
- `best`
- `worst`
- `score`
- `grade`
- `rating`

### 2. CEL Developer API

The Developer API is a generated static API under `/api/v1/`. It must be easy to inspect in a browser, curl, or local script. It should expose public-safe JSON only.

Required endpoints:

- `/api/v1/index.json`
  - API version, generated timestamp, snapshot ID, snapshot hash, endpoint list, and public-use limits.
- `/api/v1/snapshot.json`
  - Snapshot manifest summary, dataset hashes, event count, school count, source count, accepted import-wave candidate count, and institution count.
- `/api/v1/institutions/index.json`
  - Compact institution list with school ID, name, city, state, public event count, accepted candidate count, signal summary, and URL paths.
- `/api/v1/institutions/{school_id}.json`
  - Institution details: identity, counts by lane, source-family mix, accountability signals, public event IDs, source IDs, import-wave IDs, correction/right-of-reply links, known limits, and citation packet path.
- `/api/v1/source-families.json`
  - Source-family summaries across public event records and accepted import-wave candidates.
- `/api/v1/import-waves.json`
  - Import-wave summaries, accepted counts, quarantined/excluded counts when public-safe, source family, review tier, and QA status.
- `/api/v1/citation-packets/{school_id}.json`
  - Public-safe citation packet for an institution, including event URLs, source URLs, source locators where present, snapshot hash, and use limits.

API responses must include:

- `api_version`
- `generated_at`
- `snapshot_id`
- `public_use_limits`
- stable IDs and route paths

API responses must not include:

- raw quarantined rows when publication would create unnecessary risk;
- private fields;
- unbounded prose that could imply legal judgment;
- unsupported counts beyond current snapshot artifacts.

### 3. Tyler Demo Path

The Tyler Demo Path is a guided static route at `/proof/`, built for a serious evaluator with roughly 90 seconds.

The route should show:

- one clear headline: `Public accountability infrastructure, not a ranking.`
- current scope: 4,000 public event records and 150,000 accepted import-wave QA candidates;
- a selected institution Accountability Room example with real source-backed counts;
- accountability signals for that institution;
- one source locator or source packet example;
- one Developer API artifact link;
- one Local Researcher Kit command;
- correction/right-of-reply path;
- public-use limits.

The route should avoid:

- hype copy;
- founder biography;
- investor language;
- claims about impressing Tyler;
- claims that accepted QA candidates prove institutional misconduct;
- AI/model-training claims.

The page should communicate:

- speed: the infrastructure already exists and is deployed;
- judgment: claims are bounded and QA artifacts are visible;
- utility: a journalist, researcher, developer, or institution can use it;
- leverage: static site, versioned data, reproducible local workflow, no paid services required.

### 4. Local Researcher Kit

The Local Researcher Kit is a zero-cost terminal workflow. It should work from the repo without hosted model calls or paid API keys.

Required capabilities:

- `institution` query: find an institution by school ID or name and print counts, signals, source-family mix, and key routes.
- `citation-packet` query: generate or print an institution citation packet from local data.
- `api-check` query: verify local API artifacts against snapshot metadata.
- `snapshot` query: print dataset snapshot ID, hash, event count, accepted candidate count, and public-use limits.

The first implementation can be a Node CLI script with npm aliases. It does not need a package manager release.

Suggested commands:

```sh
npm run researcher:institution -- "Brown University"
npm run researcher:citation -- brown_university
npm run researcher:snapshot
npm run researcher:api-check
```

Terminal output must be plain text by default and support JSON output with `--json`:

```sh
npm run researcher:institution -- "Brown University" --json
```

The kit must reuse generated artifacts where possible instead of re-deriving conflicting values at runtime.

## Architecture

The pack should add a shared generation layer and then consume it from pages, API endpoints, and CLI commands.

### Generated Data Artifacts

Create or extend generated artifacts:

- `data/accountability-signals.json`
  - institution-level signal summaries keyed by school ID.
- `data/api/v1/*.json`
  - source files copied into `/api/v1/` pages or generated directly into the public tree.
- `data/citation-packets/{school_id}.json`
  - optional internal/generated public-safe packets if it is cleaner than building API citation packets directly.

The generation pipeline should keep institution-level summaries compact. Browser pages should not load 150,000 raw accepted candidate rows.

### Shared Libraries

Add focused libraries under `scripts/`:

- `accountability-signals-lib.mjs`
  - builds and validates signal summaries.
- `api-v1-lib.mjs`
  - builds and validates API endpoint payloads.
- `citation-packet-lib.mjs`
  - builds and validates public-safe institution citation packets.
- `researcher-kit.mjs`
  - terminal entrypoint that reads generated artifacts and prints outputs.

If existing files already contain matching helpers, prefer small extensions rather than duplicating logic.

### Page Generation

Update the static page generator to:

- include signal panels on institution pages;
- add a top-level `/proof/` page;
- copy or generate `/api/v1/` JSON endpoints into the static site output;
- link API and local researcher commands from the proof/demo page;
- expose citation packet links on institution pages.

### Public Copy

Use this boundary language consistently:

- `Accountability Signals describe source basis, response evidence, correction posture, and unresolved limits. They are not rankings, safety scores, severity scores, prevalence estimates, or legal findings.`
- `Accepted import-wave QA candidates are official-source rows that passed deterministic QA. They are not individual human certification of every row.`
- `Public event records remain separate from accepted import-wave QA candidates.`

## Data Flow

1. Existing source data and generated artifacts remain canonical:
   - `data/events.json`
   - `data/schools.json`
   - `data/sources.json`
   - `data/import-waves/*.json`
   - `data/institution-import-wave-summary.json`
   - `data/snapshot-manifest.json`
   - `data/corrections.json`
   - certification/review artifacts

2. `accountability-signals:data` generates `data/accountability-signals.json`.

3. `api:v1:data` generates API payloads from public-safe artifacts.

4. `pages:data` consumes signals and API/citation paths to update public pages.

5. `build-static` copies API JSON and researcher docs into `dist`.

6. `researcher-kit` reads the same generated artifacts locally.

## Testing And QA

Add tests before implementation:

- `test/accountability-signals.test.mjs`
  - verifies signal generation, no prohibited labels, response evidence boundaries, correction posture, and accepted-candidate/public-event separation.
- `test/api-v1.test.mjs`
  - verifies endpoint schemas, stable route paths, public-use limits, snapshot consistency, and private-field exclusion.
- `test/researcher-kit.test.mjs`
  - verifies institution lookup, citation packet output, snapshot output, JSON mode, and API artifact consistency.
- Extend `test/accountability-room.test.mjs`
  - verifies institution pages show signals without ranking/scoring language and the demo path exposes proof artifacts.
- Extend `test/verify-public.test.mjs`
  - verifies public `/api/v1/index.json`, `/api/v1/snapshot.json`, `/api/v1/institutions/index.json`, and proof/demo route.

Run targeted checks:

```sh
npm run test:import-wave
npm run test:accountability-signals
npm run test:api-v1
npm run test:researcher-kit
```

Run full checks before public deployment:

```sh
npm run build
npm run verify:public -- https://campusevidencelab.org
```

## Acceptance Criteria

The pack is complete when:

- `data/accountability-signals.json` exists and validates.
- Institution pages display descriptive accountability signals with public-use limits.
- `/api/v1/index.json`, `/api/v1/snapshot.json`, `/api/v1/institutions/index.json`, institution detail endpoints, source-family endpoint, import-wave endpoint, and citation-packet endpoints are generated and copied to `dist`.
- `/proof/` exists and guides a serious evaluator through the infrastructure in a restrained, source-bounded way.
- The Local Researcher Kit can query an institution, print a citation packet, print snapshot metadata, and validate local API artifacts without network or paid services.
- Tests cover signal generation, API payloads, CLI behavior, public copy boundaries, and generated route availability.
- Full build passes.
- Public verification passes after deployment.

## Risks And Mitigations

- Risk: Accountability Signals get perceived as rankings.
  - Mitigation: use descriptive labels only, prohibit ranking/scoring language in tests, and show limits next to every signal panel.

- Risk: API responses become too large.
  - Mitigation: generate compact indexes and per-institution detail files instead of one huge all-institution payload.

- Risk: Demo path feels like marketing.
  - Mitigation: make it a proof route through real artifacts: institution room, source locator, API JSON, local command, correction path.

- Risk: Local Researcher Kit duplicates logic and drifts from generated pages.
  - Mitigation: CLI reads generated API/signals/citation artifacts rather than recomputing every value.

- Risk: Public verification becomes too slow.
  - Mitigation: verify key API endpoints in public verifier and rely on local build QA for full route coverage unless the endpoint count stays small enough for complete public crawling.

## Deferred Work

- Ask CEL citation-bound assistant.
- Model training or local model packaging.
- Hosted search backend.
- Authenticated institution response portal.
- Paid API keys, rate limits, or hosted database.
- Dynamic frontend framework migration.
