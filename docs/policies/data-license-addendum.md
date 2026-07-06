# Data License Addendum

## 1. Purpose and Relationship to DATA_LICENSE.md

This Data License Addendum supplements and clarifies the terms set out in DATA_LICENSE.md for all dataset files produced, maintained, or distributed by Campus Evidence Lab ("the project," "we," "us"). Where this addendum and DATA_LICENSE.md address the same subject matter, the more specific and more restrictive term controls. Where DATA_LICENSE.md is silent, this addendum governs. This addendum applies only to dataset files as defined below; it does not modify or restrict the license terms applicable to the project's software.

## 2. Scope of This Addendum

This addendum applies to all dataset files released by the project, including but not limited to event records, school records, source records, review logs, correction logs, release notes, snapshot manifests, and CSV/JSON exports. It does not apply to the project's software, which is addressed separately in Section 3.

## 3. Licensing of Dataset Files and Software

Dataset files are released under the Creative Commons Attribution 4.0 International license (CC BY 4.0), except where an underlying public source imposes stricter limits on reuse, redistribution, or attribution. Where a source's own terms are stricter than CC BY 4.0, the source's stricter terms apply to any record, field, or excerpt derived from that source, and a reuser must comply with both the source's terms and the applicable portions of CC BY 4.0 that are not superseded by those stricter terms.

The project's software, including but not limited to extraction tools, review tooling, site generation code, and export utilities, remains licensed under the MIT License. Nothing in this addendum alters the MIT License terms applicable to the software. Use of the software does not itself grant any additional rights to dataset files, and use of dataset files does not itself grant any rights to the software beyond those stated in the MIT License.

## 4. Attribution Requirements

Any reuse, redistribution, republication, or public display of dataset files, in whole or in part, must include clear attribution to Campus Evidence Lab as the source of the data. Attribution must:

- Identify Campus Evidence Lab by name as the origin of the reused data.
- Indicate that the data has been modified, filtered, transformed, or excerpted, if that is the case.
- Preserve, rather than strip, any source-level attribution already present in the underlying records, where the applicable source's terms require such preservation.

Attribution to Campus Evidence Lab does not satisfy any separate attribution obligation owed to an original public source; both must be honored where both apply.

## 5. Preservation of Record Metadata

Any reuse or redistribution of dataset files must preserve the following fields, where present in the original record, without alteration, deletion, or substitution:

- Record identifiers
- Source URLs
- Verification labels
- Confidence labels
- Review tier designations
- Snapshot references
- Access dates
- Dataset hash references

These fields exist to allow independent verification of a record's provenance and review status. Removing, obscuring, or altering them, or presenting a record's data without them, is not a permitted use under this addendum, regardless of the license terms otherwise applicable to the underlying data.

## 6. No Implication of Endorsement, Validation, or Assessment

Dataset files, and any subset, excerpt, transformation, or derivative of them, may not be used or presented in a manner that states or implies any of the following:

- Endorsement of, or partnership with, Campus Evidence Lab by any named school, institution, or individual, or endorsement of any reuser by Campus Evidence Lab.
- External validation, certification, or independent verification of a record beyond what its stated review tier reflects.
- A ranking, rating, or comparative ordering of schools or institutions.
- A school safety score or similar composite safety assessment.
- A prevalence estimate of campus civil-rights incidents.
- A severity score or similar composite harm assessment.
- A legal finding, determination of liability, or conclusion regarding the truth of any allegation.

A reuser who republishes dataset files must not add framing, titles, summaries, visualizations, or scores that create any of the above implications, even if the underlying record text is reproduced accurately and without modification.

## 7. Source-Level Rights and Third-Party Limits

Individual records within the dataset are drawn from public sources, and rights in the underlying source material may be held by third parties. Where a source imposes terms stricter than CC BY 4.0, including but not limited to restrictions on commercial use, restrictions on redistribution, or requirements for removal upon request, those stricter terms govern reuse of the record or field derived from that source. It is the reuser's responsibility to identify, through the preserved source URL and related metadata, whether a given record carries source-level restrictions, and to comply with those restrictions independently of this addendum.

Nothing in this addendum grants a reuser any rights in third-party source material beyond what the applicable source's own terms permit.

## 8. Transformation and Redistribution Expectations

A reuser may filter, reformat, combine, or otherwise transform dataset files, subject to the following expectations:

- Transformation must not remove or alter the metadata fields listed in Section 5.
- Transformation must not create or imply any of the assessments prohibited in Section 6.
- A transformed or redistributed dataset must retain a visible statement identifying Campus Evidence Lab as the origin of the underlying data and noting that the data has been transformed.
- A transformed or redistributed dataset must retain, or provide a working reference to, the applicable snapshot and release note under which the source data was published, so that a downstream user can trace the data back to its original review state.
- Where source-level restrictions under Section 7 apply, those restrictions travel with the data through any transformation or redistribution.

## 9. Correction Propagation

Dataset records are subject to ongoing correction through public correction requests, duplicate reports, source submissions, and school metadata corrections submitted via GitHub issue templates or the site's structured submit page. Because records may be corrected, updated, merged, or retracted after initial publication, a reuser who redistributes dataset files should:

- Cite the specific snapshot and release note under which the copy of the data was taken, so that downstream users can identify the data's currency.
- Provide a mechanism, or a reference to the project's own correction channels, by which downstream users can learn of corrections issued after the cited snapshot.
- Avoid presenting redistributed data as current or authoritative without checking it against the project's most recent snapshot and release notes.

A reuser is not relieved of these expectations by the passage of time; data that was accurate as of a given snapshot may be superseded by later corrections, and redistribution without a path back to current snapshots and release notes increases the risk of propagating outdated or corrected information.

## 10. Citation of Snapshots and Release Notes

All public reuse of dataset files must cite the snapshot manifest and corresponding release notes from which the data was taken. This citation must be sufficient to allow a reader to locate the specific snapshot version, including any applicable snapshot identifier and date, and to review the associated release notes describing the scope, known limitations, and any corrections reflected in that snapshot. Redistribution without an identifiable snapshot citation is not a permitted use under this addendum.

## 11. Responsible Use Limits

Dataset files may not be used:

- To identify, locate, contact, or harass any individual named or referenced in a record.
- To construct or supplement private testimony, private screenshots, direct messages, doxxing material, or other sensitive personal information not already present in the public-source record.
- To make or support an unsupported allegation beyond what the underlying public source and its stated review tier actually establish.
- In combination with other data sources for the purpose of re-identifying, profiling, or scoring individuals.
- In any manner inconsistent with the dataset's stated purpose as a public-source evidence archive rather than a legal, safety, or ranking tool, as described in Section 6.

Reusers are expected to independently review the review tier and confidence label attached to a record before relying on it, and to communicate the limits of lower-tier records, as described in the project's review model, to any downstream audience.

## 12. Disclaimer of Warranties

Dataset files are provided on an "as is" and "as available" basis, without warranty of any kind, express or implied, including without limitation any warranty of accuracy, completeness, currency, merchantability, fitness for a particular purpose, or non-infringement. The project does not warrant that any record is free of error, that any review tier reflects a final or exhaustive assessment, or that the dataset constitutes a complete census of campus civil-rights incidents. The dataset is not legal advice and does not constitute a legal finding. Use of the dataset, and any reliance on it, is at the reuser's own risk.