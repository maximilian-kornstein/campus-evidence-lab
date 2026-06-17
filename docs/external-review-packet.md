# External Review Packet

`data/external-review-packet.json` is the formal public evidence dossier for outside source-to-record review.

It includes only Gold v1 records whose internal certification gates currently pass. Blocked and not-certified Gold v1 records are excluded from the packet and remain visible in `data/gold-v1-certification-status.json` and `data/review-debt-ledger.json`.

The packet includes:

- selected certified Gold v1 record IDs
- source families and source IDs
- source locators stored on the event record
- per-record source checklists
- per-record replication steps
- challenge URLs
- challenge templates
- known limits and unresolved record counts
- whole-database batch-scaling guidance

This packet is not third-party review, outside validation, endorsement, school ranking, prevalence measurement, safety scoring, severity scoring, or a legal finding.

## Review Standard

For each packet record, reviewers should:

1. Open the event page and source page.
2. Confirm the source URL, title, publisher, and publication date.
3. Use the stored source locator before accepting any event field.
4. Compare source text or data cells to school, date precision, category, affected-community labels, response-depth label, legal/procedural status, and rationale fields.
5. File a source-backed challenge for any unsupported field.

## Scaling Beyond The Packet

The 17-record packet is a strict starting batch, not a claim that the full database is certified.

The rest of the database should be reviewed in source-family batches using `data/review-debt-ledger.json`, starting with:

- blocked records
- dataset locator debt
- ASR/page locator debt
- OCR aggregate item debt
- affected-label boundary debt
- rationale debt
- date precision debt
- category-fit debt
- response-depth debt
