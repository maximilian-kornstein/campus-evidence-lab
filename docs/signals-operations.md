# CEL Signals Operations

## Current readiness

The generated wire contains 1,345 review-passing Signals across 339 institutions. Its institution-level holdout leaves 260 institutions eligible for active distribution. The automated activation gate exceeds the required 30 Signals across 20 institutions, but external distribution remains deliberately inert until the one-time activation command runs.

Production defaults remain safe: `global_pause=true`, `activation_status=inactive`, and all channels are non-live. Credentials are never stored in the repository.

## Zero-cost rule

Every collector must declare `cost: free`. Provider failure, quota exhaustion, stale results, or uncertain matching reduces coverage. It never activates a paid fallback. Dossier context is derived only from certified ED workbook cells and retains the record IDs, workbook, sheet, cell, year, value, and calculation method.

## One-time deployment and activation

The recommended path is the **Signals activate** GitHub Actions workflow. Supply these repository secrets:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `SIGNALS_D1_DATABASE_ID`
- `SIGNALS_ADMIN_TOKEN` and `SIGNALS_WORKER_URL`
- `BLUESKY_IDENTIFIER` and a Bluesky app password
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_SENDER_EMAIL`
- `SIGNALS_VISITOR_SALT`

Run the workflow manually and enter `ACTIVATE`. It tests the repository, applies the D1 schema, deploys the Worker, installs secrets, synchronizes generated evidence, and calls the guarded activation endpoint. The endpoint refuses activation unless the review threshold, credentials, and safety controls pass.

For command-line operation, deploy first, then run:

```sh
npm run signals:sync -- --apply
npm run signals:activate -- --confirm-live
```

The ramp is automatic: five originals daily on days 1–3, ten on days 4–7, and twenty daily from week two, bounded by eligibility, cooldown, holdout, freshness, and safety gates. Scheduled Worker jobs also poll mentions, answer direct `Ask CEL` questions, queue at most three proactive replies daily, snapshot followers, and process partner outreach.

## Partner queue

Create approved `signals_partner` targets through the existing outreach control plane. Then run `npm run signals:partners`; the runtime sync command automatically includes the resulting `outreach/control/signals-partners.json`. Gmail sends no more than ten initial messages daily and one follow-up after eight days. A reply, decline, opt-out, existing Gmail conflict, subscription, embed, or webhook adoption cancels pending action.

## Monitoring and emergency behavior

Authenticated endpoints expose activation state, provider health, reply queues, follower snapshots, dossier evidence, and metrics. A credible complaint pauses its Signal immediately. Duplicate publication, incorrect institution matching, or systemic source failure activates the applicable channel or global stop. Contested Signals cannot be automatically republished.

Use `global_pause` for the emergency kill switch and per-channel controls for narrower shutdowns. Recovery is explicit; retries retain immutable idempotency keys.
