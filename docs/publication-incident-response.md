# Publication Incident Response

Publication incidents are material problems in public records, source locators, dossiers, import waves, downloads, or public claim language. The response should be fast, public where appropriate, and proportionate to the issue.

## Severity Levels

| Severity | Definition | Response |
| --- | --- | --- |
| 1 | Private or sensitive information, serious source mismatch, or claim that could materially mislead readers. | Temporarily remove or redact, investigate, publish correction note, and block related wave reuse until repaired. |
| 2 | Incorrect institution, category, date, source locator, or review tier that affects interpretation. | Correct or remove affected record, update changelog, regenerate hashes and pages. |
| 3 | Non-material copy, formatting, broken link, or documentation issue. | Correct in next release and document when public interpretation could be affected. |

## Response Steps

1. Preserve the report, record IDs, source IDs, wave ID, and page URLs.
2. Decide whether temporary removal or redaction is needed.
3. Identify the failed gate or missing review control.
4. Correct, redact, quarantine, or remove affected material.
5. Regenerate data, hashes, pages, and static output.
6. Add a public correction or changelog entry when a public record changed.
7. Update the relevant standard, test, or import gate if the issue exposed a repeatable failure mode.

## Temporary Removal

Temporary removal is appropriate when public display may create avoidable legal, privacy, or institutional-fairness risk before the source basis is repaired.

## Re-Release Criteria

Material incidents can be re-released only after the affected record has a valid public source basis, source locator, correct review tier, updated changelog, and passing validation.

## Communication

Public communication should state what changed, which public source supports the corrected record, and what limits still apply. It should not speculate about intent, liability, or facts beyond the public source.
