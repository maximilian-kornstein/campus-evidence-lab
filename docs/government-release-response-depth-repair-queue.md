# Government Release Response-Depth Repair Queue

Generated: 2026-06-17

This queue turns the government-release response-depth audit into exact proposed edits for records that should not be certified until response-depth language is repaired.

## What This Queue Catches

The queue covers government-release-like records where the stored response text says the record does not summarize or evaluate a direct institutional response, but the row either:

- uses `direct_institutional_response`, or
- has stored response text with no `response_depth` value.

For those rows, the queue proposes `limited_public_response_note` and a replacement or addition for the `Institutional response` field-support rationale.

## Current Queue

- Proposed repairs: 9
- Blocked repairs: 0
- Direct-response overstatement risk: 6
- Missing response-depth classification: 3

Affected records:

- `evt_2025_0001`
- `evt_2025_0002`
- `evt_2025_0003`
- `evt_2025_0004`
- `evt_2025_0005`
- `evt_2025_0006`
- `evt_2025_0007`
- `evt_2025_0008`
- `evt_2025_0009`

## What This Is Not

This queue is not certification. It is not outside approval. It does not say the underlying records are fully source-to-record certified.

It is a bounded internal work order that says: before any government-release source-family certification, these response-depth fields should be repaired or explicitly blocked with a source-specific reason.

## Why Core Data Was Not Mutated In This Wave

`data/events.json` changes require regenerated hashes, certification ledgers, public pages, and static QA. The current worktree already contains many unrelated modified generated files and documents, so applying core event edits here would risk mixing unrelated changes into the repair commit.

The safer sequence is:

1. Generate this repair queue.
2. Review the proposed operations.
3. Apply the queue in a clean source-to-record repair wave.
4. Regenerate hashes, ledgers, pages, and release artifacts.
5. Run full validation, content QA, data-quality QA, accessibility/render QA, and build verification.

## Regeneration

Run:

```bash
npm run government-release-response-depth:audit
npm run government-release-response-depth:repair-queue
```

The generated artifact is:

```text
data/government-release-response-depth-repair-queue.json
```

## Application Rule

Do not apply a queued repair if a linked public source is later found to document a direct institutional response. In that case, update the row with source-specific support instead of applying the limited-note repair.
