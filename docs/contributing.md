# Contribution Guide

Campus Evidence Lab accepts public-source contributions only. Do not submit private testimony, private screenshots, direct messages, names of private individuals, sensitive personal information, or unsupported allegations.

The public contributor guide is published at `/guide/`; this file is the repository checklist for contributors working directly with issues, pull requests, and local data validation.

## Ways to Contribute

- Submit a public source for review.
- Request a source-backed correction to an existing event record.
- Report a possible duplicate event record.
- Suggest a source-backed school metadata correction.
- Review the public methodology, source hierarchy, deduplication logic, and research guide for overclaiming risk.

## GitHub Workflow

The MVP is designed to use GitHub issues and pull requests as the public collaboration layer.

Use the repository issue templates:

- `.github/ISSUE_TEMPLATE/source-submission.yml`
- `.github/ISSUE_TEMPLATE/correction-request.yml`
- `.github/ISSUE_TEMPLATE/duplicate-report.yml`
- `.github/ISSUE_TEMPLATE/school-metadata-correction.yml`
- `.github/ISSUE_TEMPLATE/reviewer-checklist.yml`

If the public repository is not yet connected to the deployed site, use `/submit/` to generate a structured packet and include that packet in the relevant GitHub issue once the repository is public.

## Review Standard

Submitted material does not become a public record until a reviewer confirms that it:

- uses public source material
- fits the methodology
- avoids private or sensitive evidence
- uses neutral and attributed language
- includes enough source detail to verify school, date, category, affected community, and confidence

Accepted changes regenerate record hashes, dataset hashes, CSV exports, source audit metadata, snapshot manifests, the snapshot index, and the public changelog.

## Reviewer Entry Points

Reviewer work should stay narrow and documented:

- methodology review: inclusion, exclusion, confidence, verification, deduplication, and no-ranking rules
- source audit: URL availability, publisher identity, publication date, source type, and source-to-record fit
- classification audit: category and affected-community labels against the source text
- research audit: one narrow question tested against the public research guide, with any failure cases reported

Acknowledgments or partner notes should appear only after documented review or collaboration is complete.

The public trust packet is published at `/trust/`. Outreach language is drafted in `docs/outreach-email.md`; reply handling lives in `docs/reviewer-response-playbook.md`; acknowledgment standards are defined in `docs/partner-acknowledgment-policy.md`.

## Pull Request Checklist

Before proposing a data change:

- add or update source records in `data/sources.json`
- add or update event records in `data/events.json`
- update correction records when applicable
- run `npm run prepare:data`
- run `npm run check`
- include the public source URL and a neutral explanation of the change

Do not bypass human review, publish AI-generated facts without source support, or use confidence labels as severity labels.
