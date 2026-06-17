# Known Limits And Unresolved Records

Campus Evidence Lab publishes unresolved review debt so reviewers can see what remains weak instead of assuming every record has been manually certified.

Primary artifacts:

- `data/review-debt-ledger.json`
- `data/gold-v1-certification-status.json`
- `data/external-review-packet.json`
- `/known-limits/`
- `/review-debt/`

## Current Limit Categories

- blocked records
- high review-debt records
- medium review-debt records
- not-certified Gold v1 records
- blocked Gold v1 records
- records requiring dataset cell locators
- records requiring ASR page/table locators
- records requiring OCR aggregate item locators
- records with broad affected-label boundaries
- records with missing or generic rationale fields
- records with date precision limits
- records with thin or missing public institutional response text

These categories are review priorities. They are not findings that records are false, severe, representative, complete, externally reviewed, or legally proven.

## Batch Review Rule

Review should scale in bounded batches. A batch should not be called certified unless every record in the batch clears:

- source locator
- dataset cell or item locator
- date precision
- category fit
- affected-label boundary
- response depth
- rationale specificity

The safest next whole-database path is to start with source-family batches:

1. blocked source locator records
2. ED dataset workbook/cell locator records
3. ASR page/table locator records
4. OCR aggregate item records
5. broad affected-label records
6. generic rationale records
7. response-depth review records
