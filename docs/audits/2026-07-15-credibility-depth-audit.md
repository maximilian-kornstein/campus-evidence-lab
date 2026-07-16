# CEL Credibility and Feature-Depth Audit

Date: 2026-07-15

## Bottom line

Campus Evidence Lab is not a fake project. It has a real public archive, reproducible data artifacts, unusually explicit claim boundaries, and a live autonomous distribution system. Its central credibility risk is **layer confusion**: generated infrastructure, deterministic certification, live operation, completed human review, outside adoption, and downstream impact can look more equivalent than they are.

The strongest remedy is to make maturity itself inspectable. CEL should never ask a reviewer to infer whether a feature is live, local-only, externally used, or merely ready for review.

## Material findings

### 1. The archive is real, but its apparent breadth exceeds its evidentiary diversity

- The canonical archive contains 4,000 event records.
- 3,845 records (96.1%) come from the ED Campus Safety dataset family.
- The public source catalog contains 25 source entries.
- 3,895 records have year-level date precision rather than event-level dates.

This is useful as structured public-data infrastructure, but it is not a broad census of campus civil-rights events and should not be framed as one.

### 2. Deterministic certification is valuable, but it is not completed review

- The certification ledger marks 3,810 records certified.
- The record-quality audit separately marks 3,908 records as needing internal review.
- Cell-level provenance is strongest for the ED dataset: 3,802 rows match workbook provenance.

These figures are not contradictory once the layers are defined: certification checks deterministic support and provenance gates; review debt measures unresolved human-review depth. The public product did not previously make that distinction prominent enough.

### 3. External feedback exists; validation, adoption, and impact remain separate claims

- Six documented project-specific feedback contributions informed methodology, source framing, claim boundaries, researcher onboarding, and newsroom usefulness.
- Contributor identities and private correspondence remain unpublished without explicit permission.
- These contributions are not endorsements, formal peer review, organizational partnerships, or independent validation of CEL records.

The public product should report the feedback that materially changed it while continuing to separate integration readiness from adoption and downstream impact.

### 4. CEL Signals is a genuine operational feature

- The repository contains 1,345 approved shadow candidates across 339 institutions.
- The holdout leaves 260 active-distribution institutions.
- Bluesky publication, RSS/JSON output, durable state, withdrawal, cooldown, opt-out, and idempotency controls are implemented.
- The July 14 resource-limit failure was repaired; the subsequent ten scheduled runs through July 15 succeeded.

Signals is the clearest transition from archive to utility. Its next proof threshold is qualified audience conversion and verified downstream use, not additional candidate count.

### 5. Scheduled automation manufactured repository activity

Ten consecutive commits were titled `chore: refresh CEL Signals shadow artifacts`. A single run changed 1,353 files and 13,427 lines in each direction, almost entirely because `generated_at`, `detected_at`, `evaluated_at`, `created_at`, and `updated_at` were rewritten.

That activity was operationally expensive and reputationally harmful: commit volume appeared to represent evidence change when it represented clock change.

### 6. The Solidity feature is accurately bounded but strategically thin

`SnapshotRegistry.sol` is a minimal owner-controlled local snapshot-hash registry. The repository does not claim a deployed address or public network. The code is legitimate, but it does not yet create decentralization, third-party verification, or adoption. Treating it as a headline feature would weaken CEL; treating it as an optional proof adapter is accurate.

### 7. Product proof surfaces were stale

The public milestone and release-verification artifacts stop in June and omit the live Signals system. A stale proof surface can make a working product appear abandoned or selectively documented.

### 8. The workbook toolchain used a vulnerable dependency

The npm-published `xlsx` 0.18.5 package carried high-severity prototype-pollution and regular-expression denial-of-service advisories. The dependency is used only by offline workbook import tooling, which limits exposure, but retaining a known vulnerable parser weakens the reproducibility and contributor-security story.

## Remediation implemented in this branch

1. **Semantic idempotency for Signals artifacts.** Unchanged rows preserve their original audit timestamps. Canonical artifacts and feeds remain byte-identical when only the run clock changes.
2. **Telemetry separation.** Provider health and collected triggers remain in the Actions artifact and runtime synchronization but are no longer committed as canonical evidence on every scheduled run.
3. **Regression tests.** Tests now prove that clock-only changes are ignored and material claim changes advance timestamps.
4. **Public Capability Ledger.** A new machine-readable and human-readable ledger distinguishes production-live, published-static, verification-ready, configured-but-not-adopted, and local-only capabilities.
5. **Anti-theater rules.** The ledger reports documented feedback, integration readiness, and verification surfaces positively while keeping endorsement, adoption, public-chain deployment, and impact outside the claim unless independently evidenced.
6. **Evidence-bound metrics.** Capability counts are tested against canonical artifacts so prominent numbers cannot drift into marketing copy.
7. **Dependency remediation.** The workbook parser now uses SheetJS 0.20.3 from the maintained distribution; `npm audit` reports zero known vulnerabilities and the workbook import/provenance tests pass.

## Remaining priorities

1. Obtain permission to publish the scope and response for a completed outside review.
2. Produce one verified use outcome: citation, reporting reuse, correction, institutional response, feed subscription, or embed.
3. Refresh milestones and release verification automatically from merged releases and successful production checks.
4. Reduce source-family concentration with a small number of deeply reviewed, institution-specific primary-source collections rather than another bulk row import.
5. Publish live Signals conversion and outcome metrics without collapsing them into a vanity score.
