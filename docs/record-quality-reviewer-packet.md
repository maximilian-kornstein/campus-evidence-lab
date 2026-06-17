# Record Quality Reviewer Packet

`data/record-quality-reviewer-packet.json` is the starting packet for reviewers whose job is to find faults.

It summarizes:

- every-record quality triage from `data/record-quality-audit.json`
- fresh live source-link check results from `data/source-audit-live.json`
- hard broken source links, if any
- source locator risks where a URL resolves somewhere different from the cited page
- Gold v1 records with internal pre-review issue notes
- bounded queues for dataset locator, broad label, rationale, date precision, category-fit, and response-depth review

The packet is intentionally strict. A record can be public and still need internal review before it is a strong outside-review example.

Recommended review order:

1. Open `source_link_review`.
2. Repair any `hard_broken_sources`.
3. Inspect `locator_risk_sources`; a source can return HTTP 200 and still be too vague if it redirects to a general page.
4. Review `priority_queues.blocker_records`.
5. Review `priority_queues.gold_v1_records`.
6. Work through dataset locator, rationale, broad-label, date-precision, category-fit, and response-depth queues.
7. Submit corrections with the event ID, disputed field, public source URL, and exact proposed wording.

Use limits:

- This packet is internal pre-review triage.
- It is not third-party review.
- It is not outside validation.
- It is not endorsement.
- It is not ranking, safety scoring, severity scoring, frequency measurement, or a legal finding.

The right interpretation is simple: these are the records and fields most worth challenging first.
