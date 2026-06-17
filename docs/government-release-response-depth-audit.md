# Government-Release Response-Depth Audit

Artifact: `data/government-release-response-depth-audit.json`

Command: `npm run government-release-response-depth:audit`

This audit identifies government-release-like records whose response-depth classification should be repaired or explicitly source-supported before any further non-ED certification wave.

This is a pre-certification repair queue. It is not certification, external review, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

## Current Results

- 97 government-release-like records reviewed
- 9 records flagged
- 6 records flagged for `government_release_direct_response_overstatement_risk`
- 3 records flagged for `government_release_missing_response_depth`

## Flagged Records

The current flagged records are:

- `evt_2025_0001`
- `evt_2025_0002`
- `evt_2025_0003`
- `evt_2025_0004`
- `evt_2025_0005`
- `evt_2025_0006`
- `evt_2025_0007`
- `evt_2025_0008`
- `evt_2025_0009`

## Repair Rule

Do not certify these records until one of the following is true:

- the response-depth classification is changed to the source-supported value;
- a source locator is added that supports the current response-depth classification;
- the record is kept not certified with an exact reason.

For the currently flagged government-release rows, the audit recommends `limited_public_response_note` unless a direct institutional response source is added.

## Why This Matters

Government releases often describe agency action, OCR announcements, letters, investigations, or federal findings. Those sources can support an event record, but they do not automatically support a direct institutional-response label. Keeping this distinction visible reduces overclaim risk before source-family certification expands beyond ED dataset records.
