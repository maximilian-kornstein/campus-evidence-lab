# Campus Evidence Lab Public Codebook

## Purpose

This codebook defines how Campus Evidence Lab labels public-source records. It is a reviewer aid, not a ranking system, safety score, prevalence estimate, or legal finding.

## How to use this codebook

Use the definitions to check whether a record's category, community label, source type, confidence label, verification status, and date precision are supported by public source material. If a label cannot be reproduced from public sources, narrow it, lower confidence, mark it for review, or exclude the record.

## Event categories

Every event category is a documentation label. It should describe the public record, not the project's judgment about severity, motive, institutional fault, or legal liability.

- Athletic equity: source-backed athletics access, equity, or sex-equity compliance record.
- Criminal investigation: public investigation, charge, prosecution, or law-enforcement step.
- Disability access: disability access, accommodation, exclusion, or related compliance record.
- Harassment or threat: public-source harassment, threat, intimidation, or hostile-treatment record.
- Institutional response: public action, finding, statement, policy step, or agency/institution response.
- OCR complaint: OCR complaint, investigation, resolution, letter, or monitoring action.
- Other source-backed civil rights event: valid source-backed record that does not fit a narrower category.
- Pregnancy discrimination: pregnancy-related discrimination, accommodation, or Title IX obligation.
- Title IX compliance: Title IX process, access, sex discrimination, athletics, or related enforcement.
- Vandalism: property damage, defacement, graffiti, or similar conduct tied to the archive scope.

For each category: use only when the public source directly supports the label; do not use when the label would broaden the record; require source text or structured source fields; avoid converting category into severity.

## Affected-community labels

Affected-community labels identify the community named or directly described by public sources. They do not mean Campus Evidence Lab independently found motive, bias, harm, legal liability, or institutional fault.

Current labels include Arab, Asian, Black, Ethnicity, Gender, Gender identity, Indigenous, Israeli, Jewish, LGBTQ+, Latino, Muslim, National origin, Native, Palestinian, Pregnant students, Race, Religion, Sexual orientation, Students with disabilities, and Women.

Use narrower labels when public sources support them. Use broad labels such as Race, Religion, National origin, Ethnicity, or Gender only when a narrower label would be unsupported. Do not infer community from context, politics, names, location, or assumptions.

Current taxonomy limitation: the public dataset uses one affected-community field that mixes broad protected-category labels and narrower source-identified identities. Reviewers should treat the field as source-identification, not legal classification. The intended next refinement is a two-tier model: broad protected area plus narrower affected identity when supported by source text.

Sexual orientation and gender identity may overlap with sex-discrimination law, but reviewers should break them out as separate documentation labels when the public source supports that distinction. Use LGBTQ+ only when the source itself uses a broader grouped label or when a narrower sexual-orientation or gender-identity label would not be reproducible from the source.

Political belief, viewpoint, and ideology are not standalone affected-community labels in the MVP. Do not convert Zionist, anti-Zionist, Israel-policy, Palestinian-advocacy, or other ideological language into Jewish, Israeli, Palestinian, Muslim, Arab, national-origin, or religion labels unless public sources support that protected-community framing. Ambiguous cases should be routed for broad-label review with a visible limitation.

## Verification status

Verification describes the kind of public support behind a record. The current published dataset uses `Verified from public source`, meaning at least one public source supports the core record fields. Verification does not prove every allegation, legal conclusion, motive claim, or private fact.

## Confidence labels

- High: strong public source support, official documentation, structured public data, or multiple reliable sources.
- Medium: reliable public source support with some limitation, single-source dependence, or incomplete detail.
- Low: public source exists, but important details are limited, disputed, broad, or require more review.

Confidence describes source support only. It is not a severity score.

## Source types

Source types describe the public evidence basis: Annual security report, Government case summary, Government dataset, Government guidance, Government letter, Government release, Public safety notice, and University statement. Reviewers should check that the source type matches the publisher and document form.

## Date precision

- day: public source supports a specific calendar day.
- month: public source supports month-level timing but not a day.
- year: public source supports year-level timing but not month or day.

Do not add precision just because a precise date would be useful.

## Legal-status wording

Legal-status fields should track source wording. Use phrases such as complaint filed, investigation opened, finding stated by source, settlement announced, or no legal finding stated. Do not infer liability, intent, culpability, or final outcome unless the public source says so.

## Institutional-response wording

Institutional-response fields should show public response text when available. If only a date or procedural note is available, use a limited response note and avoid claiming the project evaluated the response.

## Exclusion rules

Exclude private testimony, private screenshots, direct messages, unverified social media-only claims, sensitive personal information, unsupported legal conclusions, and records without public source support.

If public sources later state that an allegation was false, unfounded, withdrawn, fabricated, or a hoax, update the record rather than preserving the allegation unqualified. Attach the corrective public source, attribute each source's posture, update confidence or verification if needed, and record the change in the changelog. If the corrected public record cannot be described neutrally from public sources, leave it unpublished.

## Common mistakes

- Treating counts as school rankings.
- Treating confidence as severity.
- Inferring motive from broad context.
- Using broad community labels when a narrower source-backed label exists.
- Treating a public allegation as a proven legal fact.
- Treating source-audit risk as proof that a record is false.
- Publishing private evidence or private identifying details.
