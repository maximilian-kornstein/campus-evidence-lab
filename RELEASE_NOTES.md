# Release Notes

Generated for `snapshot_2026_06_03_4000_records`.

## Snapshot

- Created: `2026-06-03`
- Schema version: `0.1.0`
- Full snapshot hash: `sha256:9e8e82ea0c6339d51ae9d40ef004c0dd1a4a24c30c43a20fc0255ef64d75efe4`
- Previous snapshot hash: `sha256:fba8f7ae7a7150a57e27a9018081a8d6fa37891cb5eb69d8e773fe396ea0ed8f`
- Archived snapshot: `/data/snapshots/snapshot_2026_06_03_4000_records.json`

## Dataset Counts

- Events: 4000
- Schools: 947
- Sources: 25
- Briefs: 34
- Corrections: 0
- Review queues: 5
- Review samples: 7
- Review ledger entries: 0
- Methodology examples: 6
- Workflows: 8
- Evidence-depth queues: 6
- Gold record candidates: 100
- Reviewer challenge records: 25
- Evidence capsules: 4000
- Source provenance queues: 5

## Dataset Hashes

- Events: `sha256:e4ba2fe92ae24a720b5fd49f4696d01500286f4488741e347801d622e5133cfc`
- Schools: `sha256:4b5b7b8c7a74806bfc0b95bc78606c4b8ab3a87a7c18328dbcb47f4cfa40cb88`
- Sources: `sha256:c14c568ecf70361926fb6014fca817c4171fbe1c9aa36cb007f10d1f68167115`
- Briefs: `sha256:1022e218cec4189c1efe78beb92fce13db932d61c1c9886da204e61452b11459`
- Corrections: `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
- Review log: `sha256:bae294cd5953041e2d6602123b1024fc2290d7958c7fde3db6a4bf7d5616e48d`
- Review samples: `sha256:ca743a05ba72813d5c7ad3891d4dd4ca0a92686676affa4ede7c42c202c9c37b`
- Review ledger: `sha256:a49363c2db32fb8ff6891f4ed627ba8474e98a9ba12952a6aec67b8cda6f4dc4`
- Methodology examples: `sha256:c906ed1cfa729480bd4a6b313b602f1f9f394ce5d0f5c82007b3bbca3e466eb8`
- Workflows: `sha256:a00927c9daa38f6dda1ad6dd44b152e270700aa39a21972b4bd0b7de69b24c26`
- Robustness metrics: `sha256:0de337b4a07f5e3e539a17f638f52549de872639c6730529fdd85432e6f414ba`
- Evidence-depth queues: `sha256:00f9c078f0ba9ad0f1f6e63109142be6f77bda3e99a165ccbd7160397cad3857`
- Gold record set: `sha256:aa32c384327b215fb6a97844f95bab72a7ad275ea22dd70f01e376516a27b2d7`
- Reviewer challenge pack: `sha256:df8cab496473899c58603ca0c9c4435571d3687a792bd407c32fe5896f3199f5`
- Evidence capsules: `sha256:b07d2b14ba54b1640fff192882184f660aa29f9b989f90383060a2b500522808`
- Source provenance queues: `sha256:35625bf0694ce986e820ec41c05d175f1f767c3bb5e594764f552924a0d5eb6a`

## Evidence Depth & Robustness

- Robustness dashboard: `/robustness/`
- Robustness metrics: `/data/robustness-metrics.json`
- Evidence-depth queues: `/data/evidence-depth-queues.json`
- Gold record candidates: `/data/gold-record-set.json`
- Reviewer challenge pack: `/data/reviewer-challenge-pack.json`
- Evidence capsules: `/data/evidence-capsules.json`
- Source provenance queues: `/data/source-provenance-queues.json`
- These artifacts describe current dataset composition and review priorities; they must not be used as comparative campus judgments, frequency measures, risk ratings, or approval claims.

## Public Briefs

- 2026-06-16: [Signature Finding: Documentation Over Counts](/briefs/brief_2026_06_16_signature_finding_documentation_over_counts/) (0 new, 0 updated)
- 2026-06-16: [Where Campus Evidence Lab Can Be Wrong](/briefs/brief_2026_06_16_methodology_stress_test/) (0 new, 0 updated)
- 2026-06-13: [Findings Memo 002: What Public Institutional Responses Can and Cannot Show](/briefs/brief_2026_06_13_findings_memo_002_public_institutional_responses/) (0 new, 0 updated)
- 2026-06-11: [Findings Memo 001: What The Archive Makes Visible](/briefs/brief_2026_06_11_findings_memo_001_archive_visibility/) (0 new, 0 updated)
- 2026-06-05: [Reviewer Network As The Next Proof Layer](/briefs/brief_2026_06_05_reviewer_network_next_step/) (0 new, 0 updated)

## Changelog

- Public changelog entries: 4103
- Changelog artifact: `/data/changelog.json`

## Source Audit

- Audit mode: `metadata`
- Audited sources: 25
- Referenced events: 4000
- Audit hash: `sha256:38fc5d7677b42d437f02a9b1c685fbe2e3b62b461bd7433dfecea8bc435b3038`
- Audit artifact: `/data/source-audit.json`
- Live audit artifact: `/data/source-audit-live.json`
- Live checked sources: 25
- Live audit hash: `sha256:b6f951d124a5223540c5a5d9f01b338967eec42cfe010111ca12131ff7521de3`

## Replication

- Replication packet: `/replicate/`
- Releases artifact: `/data/releases.json`
- Release verification: `/data/release-verification.json`
- Required commands: `npm ci`, `npm run check`, `npm run build`

## Credibility Boundary

- Credibility status: `/data/credibility-status.json`
- Public acknowledgments require documented scope and display permission.
- Local verification does not imply outside validation, endorsement, completeness, frequency measurement, or legal truth.

## Research Exports

- `/data/events-research.json` and `/data/events-research.csv` join event records with school and source fields.
- `/data/schools-research.json` and `/data/schools-research.csv` add derived event counts, dates, communities, categories, and event IDs.
- `/data/sources-research.json` and `/data/sources-research.csv` add related event IDs, counts, and schools.

## Prior Snapshot

Previous archived snapshot: `snapshot_2026_06_03_750_records` with full hash `sha256:de1d34bda3dd63ba79b42dc661c28e4b9047168858a5d0a6a6555d23ac95d9b5`.

## Verification

This release is generated by `npm run release-notes:data` and verified by `npm run build`.
