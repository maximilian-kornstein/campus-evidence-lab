# Draft Domain Migration - 2026-06-20

## Initial Finding

Gmail search on 2026-06-20:

```text
in:drafts "maximilian-kornstein.github.io/campus-evidence-lab" -in:trash
```

returned 168 draft message ids across two pages.

Gmail search:

```text
in:drafts "campusevidencelab.org" -in:trash
```

returned 0 draft message ids.

## Completed Migration

Gmail draft migration completed on 2026-06-20. A final Gmail search returned:

```text
in:drafts "maximilian-kornstein.github.io/campus-evidence-lab" -in:trash
```

0 draft message ids.

A final Gmail search returned:

```text
in:drafts "campusevidencelab.org" -in:trash
```

168 draft message ids across two pages.

No drafts were sent. Draft recipients, subjects, and existing outreach wording were preserved except for replacing the old project URL prefix with the new `https://campusevidencelab.org/` domain and equivalent subpaths.

During in-place Gmail draft updates, the newly-created Gmail draft messages did not retain every prior custom CEL scheduling label. To keep the migrated drafts visible to CEL-labeled searches and duplicate checks, the label `CEL/Outreach/Domain Migrated 2026-06-20` was created and applied to all 168 migrated drafts. Gmail label verification showed 168 messages / 168 threads under that label.

## Required Migration

Every future draft should replace:

```text
https://maximilian-kornstein.github.io/campus-evidence-lab/
```

with:

```text
https://campusevidencelab.org/
```

and equivalent subpaths:

```text
https://maximilian-kornstein.github.io/campus-evidence-lab/research-guide/
https://maximilian-kornstein.github.io/campus-evidence-lab/press/
https://maximilian-kornstein.github.io/campus-evidence-lab/journalist-guide/
https://maximilian-kornstein.github.io/campus-evidence-lab/reviewer-brief/
```

to:

```text
https://campusevidencelab.org/research-guide/
https://campusevidencelab.org/press/
https://campusevidencelab.org/journalist-guide/
https://campusevidencelab.org/reviewer-brief/
```

## Safe Update Rule

Do not partially update a large draft batch by hand unless the batch is small enough to verify. The Gmail tool requires `draft_id` plus the complete revised body for each draft. A safe automated workflow should:

1. search for old-domain draft message ids;
2. map each message id to its Gmail `draft_id` through paginated draft listing;
3. read each draft body;
4. replace only the known URL prefixes;
5. update the draft in place;
6. rerun the old-domain and new-domain searches;
7. export a before/after migration report.
