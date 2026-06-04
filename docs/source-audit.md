# Source Audit

Campus Evidence Lab publishes a generated source audit at `data/source-audit.json`.

The audit maps every source to:

- external public URL
- internal source detail page
- publisher
- source type
- published date
- accessed date
- referenced event IDs
- referenced record count
- audit hash

## Deterministic Audit

Normal builds run metadata-only source auditing:

```sh
npm run audit:sources
```

This mode does not call external websites. It is deterministic and safe for CI.

## Live URL Check

Before public launch, run:

```sh
npm run audit:sources:live
```

Live mode attempts external URL checks and writes advisory HTTP status data into `data/source-audit.json`. Live results can be noisy because publishers may block automated requests, redirect visitors, rate-limit requests, or require JavaScript.

Do not treat a failed automated live check as proof that a source is invalid. Manually review failures before publication.
