# CEL Autonomous Outreach Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a queue-based autonomous CEL outreach system that can safely maintain 30 outbound emails per day, split into 20 usage-focused and 10 protocol-adjacent emails, with strict duplicate, warm-thread, live-Gmail, and idempotency gates.

**Architecture:** Extend the existing SQLite outreach control plane. Local Node scripts own durable state, duplicate decisions, queue state, dry-run send decisions, reports, and idempotency. Codex Gmail automations perform live Gmail reads, draft creation, labeling, and sends, then persist each result through the local state scripts.

**Tech Stack:** Node.js ESM scripts, SQLite via `sqlite3`, Gmail connector tools in Codex automations, existing `node:test` suite, CSV/JSON import/export files under `outreach/control`.

---

## Scope And Sequencing

This plan implements the approved spec in phases. Full autonomous sending is deliberately not enabled until dry-run and limited-send evidence is clean.

The first implementation milestone is a local, testable queue/control system. The Gmail connector remains outside local Node scripts; Codex automations will call Gmail tools and then call local scripts to persist results.

## File Structure

Create:

- `scripts/cel-outreach-control/import-target-pool.mjs`: imports candidate contacts into `target_pool`.
- `scripts/cel-outreach-control/fill-outreach-queue.mjs`: creates a campaign for the next eligible date, imports candidates into `campaign_targets`, runs preflight, and queues approved rows within 20/10 lane caps.
- `scripts/cel-outreach-control/live-check.mjs`: pure live-check evaluation helpers used by local scripts and tests.
- `scripts/cel-outreach-control/apply-live-check.mjs`: records live-check results and blocks queue rows when evidence is unsafe.
- `scripts/cel-outreach-control/record-draft-created.mjs`: attaches Gmail draft/message/thread ids to a queue row and moves it to `draft_created`.
- `scripts/cel-outreach-control/mark-queue-ready.mjs`: moves a draft-created queue row to `ready_to_send` only after a passing live check.
- `scripts/cel-outreach-control/record-send-attempt.mjs`: records `would_send`, `blocked`, `error`, or `sent` send attempts and updates queue/target state.
- `scripts/cel-outreach-control/automation-run.mjs`: creates and finishes rows in `automation_runs`.
- `outreach/control/imports/target-pool.example.csv`: documented candidate-source shape.
- `outreach/control/automation-runbook.md`: exact Codex automation operating procedure.
- `outreach/control/automation-prompts/fill-queue.md`: prompt for queue-filling cron automation.
- `outreach/control/automation-prompts/create-drafts.md`: prompt for draft-creation cron automation.
- `outreach/control/automation-prompts/send-due.md`: prompt for dry-run and real sender cron automation.
- `outreach/control/automation-prompts/followup-scan.md`: prompt for follow-up scanner.
- `outreach/control/automation-prompts/followup-send.md`: prompt for follow-up sender.

Modify:

- `outreach/control/schema.sql`: add `target_pool`, `outreach_queue`, `send_attempts`, `automation_runs`, and `followup_queue`.
- `scripts/cel-outreach-control/export-reports.mjs`: export queue, send-attempt, automation-run, blocked-send, daily-capacity, and follow-up reports.
- `scripts/cel-outreach-control/lib.mjs`: add CSV helpers needed by queue scripts only if repeated parsing/output code would otherwise be copied.
- `test/cel-outreach-control.test.mjs`: add tests for schema, target import, queue fill, live-check blocking, dry-run send idempotency, reports, and follow-up exclusions.
- `outreach/control/README.md`: document autonomous workflow commands and the rule that real sending starts only after dry-run and limited-send phases.
- `outreach/outreach-preflight-checklist.md`: add the autonomous queue and live-check gates.

Do not create a public UI in this implementation.

---

### Task 1: Add Autonomous Outreach Schema

**Files:**
- Modify: `outreach/control/schema.sql`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write the failing schema test**

In `test/cel-outreach-control.test.mjs`, update the `initializes outreach control database with required tables` assertion to include the new tables in sorted order:

```js
  assert.deepEqual(tables, [
    "automation_runs",
    "campaign_targets",
    "campaigns",
    "contacts",
    "duplicate_flags",
    "followup_queue",
    "gmail_items",
    "gmail_label_counts",
    "gmail_snapshot_imports",
    "organizations",
    "outreach_queue",
    "preflight_runs",
    "relationship_events",
    "send_attempts",
    "target_pool",
  ]);
```

Add this test after the table-list test:

```js
test("initializes autonomous outreach indexes and uniqueness guards", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");

  initDb(dbPath);

  const indexes = sqlite(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name;",
  )
    .split("\n")
    .filter(Boolean);

  assert(indexes.includes("idx_target_pool_lane"));
  assert(indexes.includes("idx_outreach_queue_send_date"));
  assert(indexes.includes("idx_outreach_queue_status"));
  assert(indexes.includes("idx_send_attempts_queue"));
  assert(indexes.includes("idx_automation_runs_type"));
  assert(indexes.includes("idx_followup_queue_status"));
  assert(indexes.includes("idx_followup_queue_due_date"));
  assert(indexes.includes("uniq_target_pool_email"));
  assert(indexes.includes("uniq_outreach_queue_idempotency"));
  assert(indexes.includes("uniq_send_attempt_success"));
  assert(indexes.includes("uniq_followup_thread_sequence"));
});
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because the new tables and indexes do not exist.

- [ ] **Step 3: Add schema tables and indexes**

Append this SQL to `outreach/control/schema.sql` after the existing `duplicate_flags` indexes:

```sql
CREATE TABLE IF NOT EXISTS target_pool (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  organization_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  lane TEXT NOT NULL CHECK (lane IN ('usage', 'protocol')),
  category TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  fit_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'imported', 'blocked', 'exhausted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_target_pool_email
ON target_pool(email)
WHERE email != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_target_pool_domain_contact
ON target_pool(domain, contact_name)
WHERE email = '' AND domain != '' AND contact_name != '';

CREATE INDEX IF NOT EXISTS idx_target_pool_lane ON target_pool(lane);
CREATE INDEX IF NOT EXISTS idx_target_pool_status ON target_pool(status);
CREATE INDEX IF NOT EXISTS idx_target_pool_domain ON target_pool(domain);

CREATE TABLE IF NOT EXISTS outreach_queue (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  lane TEXT NOT NULL CHECK (lane IN ('usage', 'protocol')),
  send_date TEXT NOT NULL DEFAULT '',
  send_window_start TEXT NOT NULL DEFAULT '',
  send_window_end TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'draft_created', 'ready_to_send', 'sent', 'blocked', 'error', 'cancelled')),
  gmail_draft_id TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  gmail_thread_id TEXT NOT NULL DEFAULT '',
  gmail_label TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  last_preflight_run_id TEXT NOT NULL DEFAULT '',
  last_live_check_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (target_id) REFERENCES campaign_targets(id),
  FOREIGN KEY (last_preflight_run_id) REFERENCES preflight_runs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_idempotency
ON outreach_queue(idempotency_key)
WHERE idempotency_key != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_gmail_draft
ON outreach_queue(gmail_draft_id)
WHERE gmail_draft_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_active_target
ON outreach_queue(target_id)
WHERE status IN ('planned', 'draft_created', 'ready_to_send');

CREATE INDEX IF NOT EXISTS idx_outreach_queue_campaign ON outreach_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_target ON outreach_queue(target_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_send_date ON outreach_queue(send_date);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_status ON outreach_queue(status);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_lane ON outreach_queue(lane);

CREATE TABLE IF NOT EXISTS send_attempts (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL CHECK (result IN ('sent', 'blocked', 'error', 'would_send')),
  gmail_message_id TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  live_check_summary TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (queue_id) REFERENCES outreach_queue(id)
);

CREATE INDEX IF NOT EXISTS idx_send_attempts_queue ON send_attempts(queue_id);
CREATE INDEX IF NOT EXISTS idx_send_attempts_result ON send_attempts(result);
CREATE INDEX IF NOT EXISTS idx_send_attempts_idempotency ON send_attempts(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_send_attempt_success
ON send_attempts(idempotency_key)
WHERE result = 'sent' AND idempotency_key != '';

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL CHECK (run_type IN ('fill_queue', 'create_drafts', 'send_due', 'followup_scan', 'followup_send')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok', 'partial', 'blocked', 'error')),
  summary TEXT NOT NULL DEFAULT '',
  created_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_type ON automation_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at);

CREATE TABLE IF NOT EXISTS followup_queue (
  id TEXT PRIMARY KEY,
  source_thread_id TEXT NOT NULL DEFAULT '',
  source_message_id TEXT NOT NULL DEFAULT '',
  original_sent_message_id TEXT NOT NULL DEFAULT '',
  contact_id TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  sequence_no INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL DEFAULT '',
  send_window_start TEXT NOT NULL DEFAULT '',
  send_window_end TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'draft_created', 'ready_to_send', 'sent', 'blocked', 'error', 'cancelled')),
  gmail_draft_id TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  last_thread_check_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_thread_sequence
ON followup_queue(source_thread_id, sequence_no)
WHERE source_thread_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_idempotency
ON followup_queue(idempotency_key)
WHERE idempotency_key != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_gmail_draft
ON followup_queue(gmail_draft_id)
WHERE gmail_draft_id != '';

CREATE INDEX IF NOT EXISTS idx_followup_queue_status ON followup_queue(status);
CREATE INDEX IF NOT EXISTS idx_followup_queue_due_date ON followup_queue(due_date);
CREATE INDEX IF NOT EXISTS idx_followup_queue_contact ON followup_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_queue_org ON followup_queue(organization_id);
```

- [ ] **Step 4: Run the schema tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for the new schema tests; existing tests may still pass because the new tables are additive.

- [ ] **Step 5: Commit**

```bash
git add outreach/control/schema.sql test/cel-outreach-control.test.mjs
git commit -m "Add autonomous outreach queue schema"
```

---

### Task 2: Import Candidate Target Pool

**Files:**
- Create: `scripts/cel-outreach-control/import-target-pool.mjs`
- Create: `outreach/control/imports/target-pool.example.csv`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing tests for candidate import**

Append these tests to `test/cel-outreach-control.test.mjs`:

```js
test("imports autonomous target pool candidates with lane and provenance", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes",
      "Usage Editor,usage@example.org,Example News,example.org,usage,student newsroom,manual list,https://example.org,Campus reporting fit",
      "Protocol Builder,protocol@example.net,Protocol Org,example.net,protocol,data provenance,manual list,https://example.net,Attestation protocol fit",
    ].join("\n"),
  );

  runNode([
    "scripts/cel-outreach-control/import-target-pool.mjs",
    "--db",
    dbPath,
    "--csv",
    csvPath,
  ]);

  const rows = sqlite(
    dbPath,
    "SELECT contact_name || '|' || email || '|' || organization_name || '|' || domain || '|' || lane || '|' || status FROM target_pool ORDER BY email;",
  ).split("\n");

  assert.deepEqual(rows, [
    "Usage Editor|usage@example.org|Example News|example.org|usage|candidate",
    "Protocol Builder|protocol@example.net|Protocol Org|example.net|protocol|candidate",
  ]);
});

test("rejects target pool rows without usage or protocol lane", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes",
      "Bad Lane,bad@example.org,Bad Org,bad.example,review,unknown,manual list,https://bad.example,Bad lane",
    ].join("\n"),
  );

  assert.throws(
    () =>
      runNode([
        "scripts/cel-outreach-control/import-target-pool.mjs",
        "--db",
        dbPath,
        "--csv",
        csvPath,
      ]),
    /Invalid lane/,
  );
});
```

- [ ] **Step 2: Run failing import tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because `import-target-pool.mjs` does not exist.

- [ ] **Step 3: Create candidate importer**

Create `scripts/cel-outreach-control/import-target-pool.mjs`:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import {
  hashId,
  normalizeDomain,
  normalizeEmail,
  parseArgs,
  parseCsv,
  repoRoot,
  runSql,
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  csv: path.join(repoRoot, "outreach/control/imports/target-pool.csv"),
});

const db = path.resolve(repoRoot, args.db);
const csvPath = path.resolve(repoRoot, args.csv);
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const sql = ["BEGIN;"];

for (const [index, row] of rows.entries()) {
  const email = normalizeEmail(row.email);
  const domain = normalizeDomain(row.domain) || normalizeDomain(email);
  const contactName = String(row.contact_name || row.contact || email || "").trim();
  const organizationName = String(row.organization || row.organization_name || domain || "").trim();
  const lane = String(row.lane || "").trim().toLowerCase();
  if (!["usage", "protocol"].includes(lane)) {
    throw new Error(`Invalid lane on row ${index + 2}: ${row.lane || ""}`);
  }
  if (!email && !domain) {
    throw new Error(`Target pool row ${index + 2} needs email or domain`);
  }
  const id = String(row.id || hashId("target_pool", [email, domain, contactName, organizationName])).trim();

  sql.push(`
    INSERT INTO target_pool (
      id,
      contact_name,
      email,
      organization_name,
      domain,
      lane,
      category,
      source,
      source_url,
      fit_notes,
      status,
      updated_at
    )
    VALUES (
      ${sqlString(id)},
      ${sqlString(contactName)},
      ${sqlString(email)},
      ${sqlString(organizationName)},
      ${sqlString(domain)},
      ${sqlString(lane)},
      ${sqlString(row.category || "")},
      ${sqlString(row.source || "")},
      ${sqlString(row.source_url || row.sourceUrl || "")},
      ${sqlString(row.fit_notes || row.fitNotes || "")},
      ${sqlString(row.status || "candidate")},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      contact_name = excluded.contact_name,
      email = excluded.email,
      organization_name = excluded.organization_name,
      domain = excluded.domain,
      lane = excluded.lane,
      category = excluded.category,
      source = excluded.source,
      source_url = excluded.source_url,
      fit_notes = excluded.fit_notes,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP;
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, csvPath, importedRows: rows.length }, null, 2));
```

- [ ] **Step 4: Add example candidate CSV**

Create `outreach/control/imports/target-pool.example.csv`:

```csv
contact_name,email,organization,domain,lane,category,source,source_url,fit_notes
Student newsroom editor,editor@example.edu,Example Student News,example.edu,usage,student newsroom,manual research,https://example.edu/newsroom,Covers campus accountability and student concerns
Public goods builder,hello@exampleprotocol.org,Example Protocol Lab,exampleprotocol.org,protocol,data provenance / attestation protocol builders,manual research,https://exampleprotocol.org,Relevant to provenance and public-interest protocol feedback
```

- [ ] **Step 5: Run import tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for target-pool import tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/cel-outreach-control/import-target-pool.mjs outreach/control/imports/target-pool.example.csv test/cel-outreach-control.test.mjs
git commit -m "Add target pool importer"
```

---

### Task 3: Fill Outreach Queue With 20/10 Lane Caps

**Files:**
- Create: `scripts/cel-outreach-control/fill-outreach-queue.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing tests for queue fill**

Append this test:

```js
test("fills autonomous outreach queue with 20 usage and 10 protocol cap", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  initDb(dbPath);

  const inserts = [];
  for (let i = 1; i <= 25; i += 1) {
    inserts.push(`('usage-${i}', 'Usage ${i}', 'usage${i}@example.org', 'Usage Org ${i}', 'usage${i}.org', 'usage', 'student newsroom', 'test', '', 'fit', 'candidate')`);
  }
  for (let i = 1; i <= 12; i += 1) {
    inserts.push(`('protocol-${i}', 'Protocol ${i}', 'protocol${i}@example.net', 'Protocol Org ${i}', 'protocol${i}.net', 'protocol', 'data provenance', 'test', '', 'fit', 'candidate')`);
  }
  sqlite(
    dbPath,
    `
      INSERT INTO target_pool (id, contact_name, email, organization_name, domain, lane, category, source, source_url, fit_notes, status)
      VALUES ${inserts.join(",")};
    `,
  );

  runNode([
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-06-24",
    "--send-window-start",
    "09:00",
    "--send-window-end",
    "10:30",
  ]);

  const counts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM outreach_queue WHERE send_date = '2026-06-24' GROUP BY lane ORDER BY lane;",
  ).split("\n");

  assert.deepEqual(counts, ["protocol|10", "usage|20"]);

  const targetStatuses = sqlite(
    dbPath,
    "SELECT status || '|' || count(*) FROM target_pool GROUP BY status ORDER BY status;",
  ).split("\n");

  assert.deepEqual(targetStatuses, ["candidate|7", "imported|30"]);
});

test("does not borrow across lanes when protocol candidates are underfilled", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  initDb(dbPath);

  const inserts = [];
  for (let i = 1; i <= 30; i += 1) {
    inserts.push(`('usage-${i}', 'Usage ${i}', 'usage${i}@example.org', 'Usage Org ${i}', 'usage${i}.org', 'usage', 'student newsroom', 'test', '', 'fit', 'candidate')`);
  }
  for (let i = 1; i <= 3; i += 1) {
    inserts.push(`('protocol-${i}', 'Protocol ${i}', 'protocol${i}@example.net', 'Protocol Org ${i}', 'protocol${i}.net', 'protocol', 'data provenance', 'test', '', 'fit', 'candidate')`);
  }
  sqlite(
    dbPath,
    `
      INSERT INTO target_pool (id, contact_name, email, organization_name, domain, lane, category, source, source_url, fit_notes, status)
      VALUES ${inserts.join(",")};
    `,
  );

  runNode([
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-06-25",
  ]);

  const counts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM outreach_queue WHERE send_date = '2026-06-25' GROUP BY lane ORDER BY lane;",
  ).split("\n");

  assert.deepEqual(counts, ["protocol|3", "usage|20"]);
});
```

- [ ] **Step 2: Run failing queue tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because `fill-outreach-queue.mjs` does not exist.

- [ ] **Step 3: Create queue filler script**

Create `scripts/cel-outreach-control/fill-outreach-queue.mjs`:

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  hashId,
  parseArgs,
  queryJson,
  repoRoot,
  runSql,
  slugify,
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  checklist: path.join(repoRoot, "outreach/outreach-preflight-checklist.md"),
  timezone: "America/New_York",
  "send-window-start": "09:00",
  "send-window-end": "10:30",
});

const db = path.resolve(repoRoot, args.db);
const checklistPath = path.resolve(repoRoot, args.checklist);
const sendDate = String(args["send-date"] || nextIsoDate()).trim();
const sendWindowStart = String(args["send-window-start"]).trim();
const sendWindowEnd = String(args["send-window-end"]).trim();
const timezone = String(args.timezone).trim();
const campaignId = String(args["campaign-id"] || `campaign_cel_autonomous_${sendDate.replaceAll("-", "_")}`).trim();
const campaignName = String(args["campaign-name"] || `CEL Autonomous Outreach ${sendDate}`).trim();
const campaignType = "autonomous_outreach";
const laneCaps = { usage: 20, protocol: 10 };

const activeCounts = Object.fromEntries(
  queryJson(
    db,
    `
      SELECT lane, count(*) AS count
      FROM outreach_queue
      WHERE send_date = ${sqlString(sendDate)}
        AND status IN ('planned', 'draft_created', 'ready_to_send', 'sent')
      GROUP BY lane;
    `,
  ).map((row) => [row.lane, Number(row.count)]),
);

const targetSql = ["BEGIN;"];

targetSql.push(`
  INSERT INTO campaigns (id, name, target_send_date, campaign_type, status, updated_at)
  VALUES (${sqlString(campaignId)}, ${sqlString(campaignName)}, ${sqlString(sendDate)}, ${sqlString(campaignType)}, 'planned', CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    target_send_date = excluded.target_send_date,
    campaign_type = excluded.campaign_type,
    updated_at = CURRENT_TIMESTAMP;
`);

const selected = [];

for (const lane of ["usage", "protocol"]) {
  const remaining = Math.max(0, laneCaps[lane] - Number(activeCounts[lane] || 0));
  if (!remaining) continue;

  const candidates = queryJson(
    db,
    `
      SELECT *
      FROM target_pool
      WHERE status = 'candidate'
        AND lane = ${sqlString(lane)}
      ORDER BY created_at, id
      LIMIT ${remaining};
    `,
  );

  for (const candidate of candidates) {
    const orgId = candidate.domain ? `org_${slugify(candidate.domain)}` : hashId("org", [candidate.organization_name]);
    const contactId = candidate.email ? `contact_${slugify(candidate.email)}` : hashId("contact", [candidate.contact_name, orgId]);
    const targetId = hashId("target", [campaignId, contactId, orgId]);
    targetSql.push(`
      INSERT INTO organizations (id, name, domain, updated_at)
      VALUES (${sqlString(orgId)}, ${sqlString(candidate.organization_name)}, ${sqlString(candidate.domain)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN organizations.name = '' THEN excluded.name ELSE organizations.name END,
        domain = CASE WHEN organizations.domain = '' THEN excluded.domain ELSE organizations.domain END,
        updated_at = CURRENT_TIMESTAMP;
    `);

    targetSql.push(`
      INSERT INTO contacts (id, name, email, organization_id, domain, category, updated_at)
      VALUES (${sqlString(contactId)}, ${sqlString(candidate.contact_name)}, ${sqlString(candidate.email)}, ${sqlString(orgId)}, ${sqlString(candidate.domain)}, ${sqlString(candidate.category)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN contacts.name = '' THEN excluded.name ELSE contacts.name END,
        email = CASE WHEN contacts.email = '' THEN excluded.email ELSE contacts.email END,
        organization_id = CASE WHEN contacts.organization_id = '' THEN excluded.organization_id ELSE contacts.organization_id END,
        domain = CASE WHEN contacts.domain = '' THEN excluded.domain ELSE contacts.domain END,
        category = CASE WHEN contacts.category = '' THEN excluded.category ELSE contacts.category END,
        updated_at = CURRENT_TIMESTAMP;
    `);

    targetSql.push(`
      INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, intended_ask, template_type, approval_status, draft_status, scheduled_date, updated_at)
      VALUES (${sqlString(targetId)}, ${sqlString(campaignId)}, ${sqlString(contactId)}, ${sqlString(orgId)}, ${sqlString(lane === "usage" ? "usage test" : "protocol design feedback")}, ${sqlString(lane)}, 'needs_preflight', 'not_drafted', ${sqlString(sendDate)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        campaign_id = excluded.campaign_id,
        contact_id = excluded.contact_id,
        organization_id = excluded.organization_id,
        intended_ask = excluded.intended_ask,
        template_type = excluded.template_type,
        approval_status = 'needs_preflight',
        preflight_run_id = '',
        scheduled_date = excluded.scheduled_date,
        updated_at = CURRENT_TIMESTAMP;
    `);

    selected.push({ poolId: candidate.id, targetId, lane, contactKey: candidate.email || candidate.domain });
  }
}

targetSql.push("COMMIT;");
runSql(db, targetSql.join("\n"));

execFileSync(
  process.execPath,
  [
    "scripts/cel-outreach-control/run-duplicate-guard.mjs",
    "--db",
    db,
    "--checklist",
    checklistPath,
  ],
  { cwd: repoRoot, stdio: "pipe" },
);

const queueSql = ["BEGIN;"];
const queued = [];

for (const item of selected) {
  const rows = queryJson(
    db,
    `
      SELECT approval_status, preflight_run_id
      FROM campaign_targets
      WHERE id = ${sqlString(item.targetId)}
        AND approval_status = 'approved_for_draft';
    `,
  );
  if (rows.length === 0) {
    queueSql.push(`
      UPDATE target_pool
      SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(item.poolId)};
    `);
    continue;
  }

  const queueId = hashId("queue", [campaignId, item.targetId, sendDate, item.lane]);
  const idempotencyKey = `cold:${sendDate}:${item.lane}:${item.contactKey}:${item.targetId}`;
  const gmailLabel = `CEL/Autonomous/${sendDate}`;
  const preflightRunId = rows[0].preflight_run_id || "";

  queueSql.push(`
    INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date, send_window_start, send_window_end, timezone, status, gmail_label, idempotency_key, last_preflight_run_id, updated_at)
    VALUES (${sqlString(queueId)}, ${sqlString(campaignId)}, ${sqlString(item.targetId)}, ${sqlString(item.lane)}, ${sqlString(sendDate)}, ${sqlString(sendWindowStart)}, ${sqlString(sendWindowEnd)}, ${sqlString(timezone)}, 'planned', ${sqlString(gmailLabel)}, ${sqlString(idempotencyKey)}, ${sqlString(preflightRunId)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      send_date = excluded.send_date,
      send_window_start = excluded.send_window_start,
      send_window_end = excluded.send_window_end,
      timezone = excluded.timezone,
      gmail_label = excluded.gmail_label,
      idempotency_key = excluded.idempotency_key,
      last_preflight_run_id = excluded.last_preflight_run_id,
      updated_at = CURRENT_TIMESTAMP;
  `);

  queueSql.push(`
    UPDATE target_pool
    SET status = 'imported', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(item.poolId)};
  `);

  queued.push({ queueId, targetId: item.targetId, lane: item.lane });
}

const runId = hashId("automation_run", ["fill_queue", sendDate, new Date().toISOString()]);
queueSql.push(`
  INSERT INTO automation_runs (id, run_type, finished_at, result, summary, created_count)
  VALUES (${sqlString(runId)}, 'fill_queue', CURRENT_TIMESTAMP, 'ok', ${sqlString(`Queued ${queued.length} target(s) for ${sendDate}.`)}, ${queued.length});
`);

queueSql.push("COMMIT;");
runSql(db, queueSql.join("\n"));

console.log(JSON.stringify({ db, sendDate, queued: queued.length, runId }, null, 2));

function nextIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run queue tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for queue-fill lane cap tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/cel-outreach-control/fill-outreach-queue.mjs test/cel-outreach-control.test.mjs
git commit -m "Add autonomous outreach queue filler"
```

---

### Task 4: Add Live Gmail Check Evaluation

**Files:**
- Create: `scripts/cel-outreach-control/live-check.mjs`
- Create: `scripts/cel-outreach-control/apply-live-check.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing tests for live-check blocking**

Append:

```js
test("live check blocks unsafe Gmail evidence", async () => {
  const { evaluateLiveCheck } = await import("../scripts/cel-outreach-control/live-check.mjs");
  const result = evaluateLiveCheck({
    target: {
      email: "meredith@example.org",
      domain: "example.org",
      organization: "Example Org",
      queueDraftMessageId: "draft-current",
    },
    evidence: [
      { type: "sent", message_id: "sent-1", subject: "Campus Evidence Lab", summary: "prior sent item" },
      { type: "draft", message_id: "draft-current", subject: "Current queued draft", summary: "current queue draft" },
      { type: "relationship", message_id: "rel-1", subject: "Packet sent", summary: "packet sent / engaged" },
    ],
  });

  assert.equal(result.safe, false);
  assert.deepEqual(
    result.reasons.map((reason) => reason.code).sort(),
    ["relationship_conflict", "sent_conflict"],
  );
});

test("live check allows only current queue draft when no other conflicts exist", async () => {
  const { evaluateLiveCheck } = await import("../scripts/cel-outreach-control/live-check.mjs");
  const result = evaluateLiveCheck({
    target: {
      email: "new@example.org",
      domain: "example.org",
      organization: "Example Org",
      queueDraftMessageId: "draft-current",
    },
    evidence: [
      { type: "draft", message_id: "draft-current", subject: "Current queued draft", summary: "current queue draft" },
    ],
  });

  assert.equal(result.safe, true);
  assert.deepEqual(result.reasons, []);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because `live-check.mjs` does not exist.

- [ ] **Step 3: Create pure live-check helper**

Create `scripts/cel-outreach-control/live-check.mjs`:

```js
const UNSAFE_RELATIONSHIP_PATTERN =
  /packet sent|feedback received|permission-limited|permission limited|call scheduled|routed internally|declined|redirect|keep warm|org review|required|hard block|warm/i;

export function evaluateLiveCheck(input) {
  const target = input?.target || {};
  const evidence = Array.isArray(input?.evidence) ? input.evidence : [];
  const queueDraftMessageId = String(target.queueDraftMessageId || "").trim();
  const reasons = [];

  for (const item of evidence) {
    const type = String(item.type || "").toLowerCase();
    const messageId = String(item.message_id || item.messageId || "").trim();
    const summary = [item.subject, item.summary, item.labels, item.snippet]
      .filter(Boolean)
      .join(" ");

    if (type === "sent") {
      reasons.push(reason("sent_conflict", item, "Prior CEL sent item found."));
    }

    if (type === "draft" && (!queueDraftMessageId || messageId !== queueDraftMessageId)) {
      reasons.push(reason("draft_conflict", item, "Existing CEL draft found outside the current queue row."));
    }

    if (type === "reply" || type === "inbound") {
      reasons.push(reason("reply_conflict", item, "Inbound reply or thread activity found."));
    }

    if (type === "starred") {
      reasons.push(reason("starred_conflict", item, "Starred thread found; manual relationship review required."));
    }

    if (type === "future" || type === "scheduled") {
      reasons.push(reason("future_conflict", item, "Future or scheduled CEL item found."));
    }

    if (type === "relationship" || UNSAFE_RELATIONSHIP_PATTERN.test(summary)) {
      reasons.push(reason("relationship_conflict", item, "Warm or blocked relationship evidence found."));
    }
  }

  return {
    safe: reasons.length === 0,
    reasons: dedupeReasons(reasons),
    summary: reasons.length === 0 ? "Live check passed." : `${dedupeReasons(reasons).length} live-check conflict(s).`,
  };
}

function reason(code, item, message) {
  return {
    code,
    message,
    message_id: String(item.message_id || item.messageId || ""),
    subject: String(item.subject || ""),
    summary: String(item.summary || item.snippet || ""),
  };
}

function dedupeReasons(reasons) {
  const seen = new Set();
  return reasons.filter((entry) => {
    const key = [entry.code, entry.message_id, entry.subject, entry.summary].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

- [ ] **Step 4: Create live-check apply script**

Create `scripts/cel-outreach-control/apply-live-check.mjs`:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { hashId, parseArgs, repoRoot, runSql, sqlString } from "./lib.mjs";
import { evaluateLiveCheck } from "./live-check.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = String(args["queue-id"] || "").trim();
const jsonPath = args.json ? path.resolve(repoRoot, args.json) : "";
if (!queueId) throw new Error("--queue-id is required");
if (!jsonPath) throw new Error("--json is required");

const input = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const result = evaluateLiveCheck(input);
const checkAt = String(input.checked_at || new Date().toISOString());
const reasonText = result.reasons.map((entry) => `${entry.code}: ${entry.subject || entry.summary || entry.message}`).join("; ");
const sql = ["BEGIN;"];

if (result.safe) {
  sql.push(`
    UPDATE outreach_queue
    SET last_live_check_at = ${sqlString(checkAt)}, last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};
  `);
} else {
  const attemptId = hashId("send_attempt", [queueId, "blocked", reasonText, checkAt]);
  sql.push(`
    UPDATE outreach_queue
    SET status = 'blocked', last_live_check_at = ${sqlString(checkAt)}, last_error = ${sqlString(reasonText)}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};
  `);
  sql.push(`
    INSERT INTO send_attempts (id, queue_id, idempotency_key, attempted_at, result, reason, live_check_summary)
    SELECT ${sqlString(attemptId)}, id, idempotency_key, ${sqlString(checkAt)}, 'blocked', ${sqlString(reasonText)}, ${sqlString(JSON.stringify(result))}
    FROM outreach_queue
    WHERE id = ${sqlString(queueId)};
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ queueId, safe: result.safe, reasons: result.reasons }, null, 2));
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for live-check tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/cel-outreach-control/live-check.mjs scripts/cel-outreach-control/apply-live-check.mjs test/cel-outreach-control.test.mjs
git commit -m "Add live Gmail check evaluation"
```

---

### Task 5: Add Draft And Send State Transition Scripts

**Files:**
- Create: `scripts/cel-outreach-control/record-draft-created.mjs`
- Create: `scripts/cel-outreach-control/mark-queue-ready.mjs`
- Create: `scripts/cel-outreach-control/record-send-attempt.mjs`
- Create: `scripts/cel-outreach-control/automation-run.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing tests for state transitions and idempotency**

Append:

```js
test("records draft creation and marks queue ready after live check", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-test', 'Test Campaign', '2026-06-24', 'autonomous_outreach');
      INSERT INTO campaign_targets (id, campaign_id, intended_ask, template_type, approval_status)
      VALUES ('target-test', 'campaign-test', 'usage test', 'usage', 'approved_for_draft');
      INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date, send_window_start, send_window_end, status, idempotency_key)
      VALUES ('queue-test', 'campaign-test', 'target-test', 'usage', '2026-06-24', '09:00', '10:30', 'planned', 'cold:2026-06-24:usage:test');
    `,
  );

  runNode([
    "scripts/cel-outreach-control/record-draft-created.mjs",
    "--db",
    dbPath,
    "--queue-id",
    "queue-test",
    "--gmail-draft-id",
    "draft-1",
    "--gmail-message-id",
    "message-1",
    "--gmail-thread-id",
    "thread-1",
  ]);

  runNode([
    "scripts/cel-outreach-control/mark-queue-ready.mjs",
    "--db",
    dbPath,
    "--queue-id",
    "queue-test",
    "--live-check-at",
    "2026-06-23T20:00:00-04:00",
  ]);

  const row = sqlite(
    dbPath,
    "SELECT status || '|' || gmail_draft_id || '|' || gmail_message_id || '|' || gmail_thread_id FROM outreach_queue WHERE id = 'queue-test';",
  );
  assert.equal(row, "ready_to_send|draft-1|message-1|thread-1");
});

test("record send attempt prevents duplicate successful sends", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-test', 'Test Campaign', '2026-06-24', 'autonomous_outreach');
      INSERT INTO campaign_targets (id, campaign_id, intended_ask, template_type, approval_status)
      VALUES ('target-test', 'campaign-test', 'usage test', 'usage', 'approved_for_draft');
      INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date, send_window_start, send_window_end, status, idempotency_key)
      VALUES ('queue-test', 'campaign-test', 'target-test', 'usage', '2026-06-24', '09:00', '10:30', 'ready_to_send', 'cold:2026-06-24:usage:test');
    `,
  );

  runNode([
    "scripts/cel-outreach-control/record-send-attempt.mjs",
    "--db",
    dbPath,
    "--queue-id",
    "queue-test",
    "--result",
    "sent",
    "--gmail-message-id",
    "sent-message-1",
    "--reason",
    "sent by dry-run promoted sender",
  ]);

  assert.throws(
    () =>
      runNode([
        "scripts/cel-outreach-control/record-send-attempt.mjs",
        "--db",
        dbPath,
        "--queue-id",
        "queue-test",
        "--result",
        "sent",
        "--gmail-message-id",
        "sent-message-2",
        "--reason",
        "duplicate send",
      ]),
    /already has a successful send attempt/,
  );
});
```

- [ ] **Step 2: Run failing transition tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because transition scripts do not exist.

- [ ] **Step 3: Create `record-draft-created.mjs`**

Create `scripts/cel-outreach-control/record-draft-created.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";

import { parseArgs, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = required("queue-id");
const gmailDraftId = required("gmail-draft-id");
const gmailMessageId = required("gmail-message-id");
const gmailThreadId = required("gmail-thread-id");

runSql(
  db,
  `
    UPDATE outreach_queue
    SET
      status = 'draft_created',
      gmail_draft_id = ${sqlString(gmailDraftId)},
      gmail_message_id = ${sqlString(gmailMessageId)},
      gmail_thread_id = ${sqlString(gmailThreadId)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)}
      AND status IN ('planned', 'draft_created');
  `,
);

console.log(JSON.stringify({ queueId, gmailDraftId, gmailMessageId, gmailThreadId }, null, 2));

function required(name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}
```

- [ ] **Step 4: Create `mark-queue-ready.mjs`**

Create `scripts/cel-outreach-control/mark-queue-ready.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";

import { parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = String(args["queue-id"] || "").trim();
const liveCheckAt = String(args["live-check-at"] || new Date().toISOString()).trim();
if (!queueId) throw new Error("--queue-id is required");

const rows = queryJson(db, `SELECT * FROM outreach_queue WHERE id = ${sqlString(queueId)};`);
const row = rows[0];
if (!row) throw new Error(`Queue row not found: ${queueId}`);
if (!row.gmail_draft_id || !row.gmail_message_id) {
  throw new Error(`Queue row ${queueId} cannot be ready without Gmail draft and message ids`);
}
if (row.status !== "draft_created") {
  throw new Error(`Queue row ${queueId} must be draft_created before ready_to_send; current status is ${row.status}`);
}

runSql(
  db,
  `
    UPDATE outreach_queue
    SET status = 'ready_to_send',
        last_live_check_at = ${sqlString(liveCheckAt)},
        last_error = '',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};
  `,
);

console.log(JSON.stringify({ queueId, status: "ready_to_send" }, null, 2));
```

- [ ] **Step 5: Create `record-send-attempt.mjs`**

Create `scripts/cel-outreach-control/record-send-attempt.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";

import { hashId, parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = required("queue-id");
const result = required("result");
if (!["sent", "blocked", "error", "would_send"].includes(result)) {
  throw new Error(`Invalid send attempt result: ${result}`);
}

const rows = queryJson(db, `SELECT * FROM outreach_queue WHERE id = ${sqlString(queueId)};`);
const queue = rows[0];
if (!queue) throw new Error(`Queue row not found: ${queueId}`);
if (!queue.idempotency_key) throw new Error(`Queue row ${queueId} has no idempotency key`);

const successRows = queryJson(
  db,
  `
    SELECT id FROM send_attempts
    WHERE idempotency_key = ${sqlString(queue.idempotency_key)}
      AND result = 'sent'
    LIMIT 1;
  `,
);
if (successRows.length > 0) {
  throw new Error(`Queue row ${queueId} already has a successful send attempt`);
}

const gmailMessageId = String(args["gmail-message-id"] || "").trim();
const reason = String(args.reason || "").trim();
const liveCheckSummary = String(args["live-check-summary"] || "").trim();
const attemptedAt = String(args["attempted-at"] || new Date().toISOString()).trim();
const attemptId = hashId("send_attempt", [queueId, result, gmailMessageId, reason, attemptedAt]);
const nextStatus = result === "sent" ? "sent" : result === "blocked" ? "blocked" : result === "error" ? "error" : queue.status;
const targetDraftStatus = result === "sent" ? "sent" : queue.status;

runSql(
  db,
  `
    BEGIN;
    INSERT INTO send_attempts (id, queue_id, idempotency_key, attempted_at, result, gmail_message_id, reason, live_check_summary)
    VALUES (${sqlString(attemptId)}, ${sqlString(queueId)}, ${sqlString(queue.idempotency_key)}, ${sqlString(attemptedAt)}, ${sqlString(result)}, ${sqlString(gmailMessageId)}, ${sqlString(reason)}, ${sqlString(liveCheckSummary)});

    UPDATE outreach_queue
    SET status = ${sqlString(nextStatus)},
        gmail_message_id = CASE WHEN ${sqlString(gmailMessageId)} != '' THEN ${sqlString(gmailMessageId)} ELSE gmail_message_id END,
        last_error = CASE WHEN ${sqlString(result)} IN ('blocked', 'error') THEN ${sqlString(reason)} ELSE '' END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};

    UPDATE campaign_targets
    SET draft_status = ${sqlString(targetDraftStatus)},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queue.target_id)}
      AND ${sqlString(result)} = 'sent';
    COMMIT;
  `,
);

console.log(JSON.stringify({ queueId, attemptId, result, gmailMessageId }, null, 2));

function required(name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}
```

- [ ] **Step 6: Create `automation-run.mjs`**

Create `scripts/cel-outreach-control/automation-run.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";

import { hashId, parseArgs, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  result: "ok",
  "created-count": "0",
  "sent-count": "0",
  "blocked-count": "0",
  "error-count": "0",
});

const db = path.resolve(repoRoot, args.db);
const runType = String(args["run-type"] || "").trim();
if (!["fill_queue", "create_drafts", "send_due", "followup_scan", "followup_send"].includes(runType)) {
  throw new Error(`Invalid --run-type: ${runType}`);
}
const startedAt = String(args["started-at"] || new Date().toISOString()).trim();
const finishedAt = String(args["finished-at"] || new Date().toISOString()).trim();
const result = String(args.result || "ok").trim();
const summary = String(args.summary || "").trim();
const runId = String(args.id || hashId("automation_run", [runType, startedAt, summary])).trim();

runSql(
  db,
  `
    INSERT INTO automation_runs (id, run_type, started_at, finished_at, result, summary, created_count, sent_count, blocked_count, error_count)
    VALUES (
      ${sqlString(runId)},
      ${sqlString(runType)},
      ${sqlString(startedAt)},
      ${sqlString(finishedAt)},
      ${sqlString(result)},
      ${sqlString(summary)},
      ${Number(args["created-count"]) || 0},
      ${Number(args["sent-count"]) || 0},
      ${Number(args["blocked-count"]) || 0},
      ${Number(args["error-count"]) || 0}
    )
    ON CONFLICT(id) DO UPDATE SET
      finished_at = excluded.finished_at,
      result = excluded.result,
      summary = excluded.summary,
      created_count = excluded.created_count,
      sent_count = excluded.sent_count,
      blocked_count = excluded.blocked_count,
      error_count = excluded.error_count;
  `,
);

console.log(JSON.stringify({ runId, runType, result }, null, 2));
```

- [ ] **Step 7: Run transition tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for transition and idempotency tests.

- [ ] **Step 8: Commit**

```bash
git add scripts/cel-outreach-control/record-draft-created.mjs scripts/cel-outreach-control/mark-queue-ready.mjs scripts/cel-outreach-control/record-send-attempt.mjs scripts/cel-outreach-control/automation-run.mjs test/cel-outreach-control.test.mjs
git commit -m "Add autonomous queue state transitions"
```

---

### Task 6: Export Autonomous Queue Reports

**Files:**
- Modify: `scripts/cel-outreach-control/export-reports.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing report test**

Append:

```js
test("exports autonomous outreach queue and send attempt reports", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const reportDir = path.join(tempDir, "reports");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-test', 'Test Campaign', '2026-06-24', 'autonomous_outreach');
      INSERT INTO campaign_targets (id, campaign_id, intended_ask, template_type, approval_status)
      VALUES ('target-test', 'campaign-test', 'usage test', 'usage', 'approved_for_draft');
      INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date, send_window_start, send_window_end, status, gmail_draft_id, gmail_message_id, idempotency_key, last_live_check_at)
      VALUES ('queue-test', 'campaign-test', 'target-test', 'usage', '2026-06-24', '09:00', '10:30', 'sent', 'draft-1', 'sent-message-1', 'cold:2026-06-24:usage:test', '2026-06-24T08:59:00-04:00');
      INSERT INTO send_attempts (id, queue_id, idempotency_key, result, gmail_message_id, reason, live_check_summary)
      VALUES ('attempt-test', 'queue-test', 'cold:2026-06-24:usage:test', 'sent', 'sent-message-1', 'sent', 'Live check passed.');
      INSERT INTO automation_runs (id, run_type, result, summary, created_count, sent_count)
      VALUES ('run-test', 'send_due', 'ok', 'sent one', 0, 1);
      INSERT INTO followup_queue (id, source_thread_id, sequence_no, due_date, status, idempotency_key)
      VALUES ('followup-test', 'thread-1', 1, '2026-06-30', 'candidate', 'followup:thread-1:1');
    `,
  );

  runNode([
    "scripts/cel-outreach-control/export-reports.mjs",
    "--db",
    dbPath,
    "--out",
    reportDir,
  ]);

  assert(fs.existsSync(path.join(reportDir, "outreach-queue.csv")));
  assert(fs.existsSync(path.join(reportDir, "send-attempts.csv")));
  assert(fs.existsSync(path.join(reportDir, "automation-runs.csv")));
  assert(fs.existsSync(path.join(reportDir, "blocked-autonomous-sends.csv")));
  assert(fs.existsSync(path.join(reportDir, "daily-capacity.csv")));
  assert(fs.existsSync(path.join(reportDir, "followup-queue.csv")));
  assert.match(fs.readFileSync(path.join(reportDir, "outreach-queue.csv"), "utf8"), /queue-test/);
  assert.match(fs.readFileSync(path.join(reportDir, "send-attempts.csv"), "utf8"), /attempt-test/);
});
```

- [ ] **Step 2: Run failing report test**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because new reports are not exported.

- [ ] **Step 3: Add report exports**

Append these `writeReport` calls before the final `console.log` in `scripts/cel-outreach-control/export-reports.mjs`:

```js
writeReport(
  "outreach-queue.csv",
  [
    "queue_id",
    "campaign_name",
    "target_id",
    "lane",
    "send_date",
    "send_window_start",
    "send_window_end",
    "timezone",
    "status",
    "gmail_draft_id",
    "gmail_message_id",
    "gmail_thread_id",
    "gmail_label",
    "idempotency_key",
    "last_live_check_at",
    "last_error",
  ],
  `
    SELECT
      queue.id AS queue_id,
      COALESCE(campaign.name, '') AS campaign_name,
      queue.target_id,
      queue.lane,
      queue.send_date,
      queue.send_window_start,
      queue.send_window_end,
      queue.timezone,
      queue.status,
      queue.gmail_draft_id,
      queue.gmail_message_id,
      queue.gmail_thread_id,
      queue.gmail_label,
      queue.idempotency_key,
      queue.last_live_check_at,
      queue.last_error
    FROM outreach_queue queue
    LEFT JOIN campaigns campaign ON campaign.id = queue.campaign_id
    ORDER BY queue.send_date, queue.lane, queue.status, queue.id;
  `,
);

writeReport(
  "send-attempts.csv",
  ["attempt_id", "queue_id", "idempotency_key", "attempted_at", "result", "gmail_message_id", "reason", "live_check_summary"],
  `
    SELECT
      id AS attempt_id,
      queue_id,
      idempotency_key,
      attempted_at,
      result,
      gmail_message_id,
      reason,
      live_check_summary
    FROM send_attempts
    ORDER BY attempted_at DESC, queue_id, id;
  `,
);

writeReport(
  "automation-runs.csv",
  ["run_id", "run_type", "started_at", "finished_at", "result", "summary", "created_count", "sent_count", "blocked_count", "error_count"],
  `
    SELECT
      id AS run_id,
      run_type,
      started_at,
      finished_at,
      result,
      summary,
      created_count,
      sent_count,
      blocked_count,
      error_count
    FROM automation_runs
    ORDER BY started_at DESC, id;
  `,
);

writeReport(
  "blocked-autonomous-sends.csv",
  ["queue_id", "lane", "send_date", "status", "last_error", "idempotency_key"],
  `
    SELECT
      id AS queue_id,
      lane,
      send_date,
      status,
      last_error,
      idempotency_key
    FROM outreach_queue
    WHERE status IN ('blocked', 'error')
    ORDER BY send_date DESC, lane, id;
  `,
);

writeReport(
  "daily-capacity.csv",
  ["send_date", "lane", "queued_count", "sent_count", "ready_count", "blocked_count"],
  `
    SELECT
      send_date,
      lane,
      count(*) AS queued_count,
      sum(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      sum(CASE WHEN status = 'ready_to_send' THEN 1 ELSE 0 END) AS ready_count,
      sum(CASE WHEN status IN ('blocked', 'error') THEN 1 ELSE 0 END) AS blocked_count
    FROM outreach_queue
    GROUP BY send_date, lane
    ORDER BY send_date DESC, lane;
  `,
);

writeReport(
  "followup-queue.csv",
  ["followup_id", "source_thread_id", "sequence_no", "due_date", "status", "gmail_draft_id", "gmail_message_id", "idempotency_key", "last_thread_check_at", "last_error"],
  `
    SELECT
      id AS followup_id,
      source_thread_id,
      sequence_no,
      due_date,
      status,
      gmail_draft_id,
      gmail_message_id,
      idempotency_key,
      last_thread_check_at,
      last_error
    FROM followup_queue
    ORDER BY due_date, source_thread_id, sequence_no;
  `,
);
```

- [ ] **Step 4: Run report tests**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for report tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/cel-outreach-control/export-reports.mjs test/cel-outreach-control.test.mjs
git commit -m "Export autonomous outreach reports"
```

---

### Task 7: Add Follow-Up Queue Eligibility Infrastructure

**Files:**
- Create: `scripts/cel-outreach-control/fill-followup-queue.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

- [ ] **Step 1: Write failing follow-up eligibility test**

Append:

```js
test("follow-up queue excludes replied and warm relationship threads", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO organizations (id, name, domain, relationship_status, block_level)
      VALUES
        ('org-safe-org', 'Safe Org', 'safe.org', 'unknown', ''),
        ('org-warm-org', 'Warm Org', 'warm.org', 'Packet sent / engaged', 'Hard block cold outreach');
      INSERT INTO contacts (id, name, email, organization_id, domain)
      VALUES
        ('contact-safe', 'Safe Person', 'safe@safe.org', 'org-safe-org', 'safe.org'),
        ('contact-replied', 'Replied Person', 'replied@safe.org', 'org-safe-org', 'safe.org'),
        ('contact-warm', 'Warm Person', 'warm@warm.org', 'org-warm-org', 'warm.org');
      INSERT INTO gmail_items (id, thread_id, item_type, subject, from_email, to_emails, labels, email_ts, snippet, is_cel, person_key, domain_key, organization_key)
      VALUES
        ('sent-safe', 'thread-safe', 'sent', 'Campus Evidence Lab', 'max@example.com', '["safe@safe.org"]', '["SENT"]', '2026-06-10T09:00:00-04:00', 'Campus Evidence Lab', 1, 'safe@safe.org', 'safe.org', 'safe.org'),
        ('sent-replied', 'thread-replied', 'sent', 'Campus Evidence Lab', 'max@example.com', '["replied@safe.org"]', '["SENT"]', '2026-06-10T09:00:00-04:00', 'Campus Evidence Lab', 1, 'replied@safe.org', 'safe.org', 'safe.org'),
        ('reply-replied', 'thread-replied', 'reply', 'Re: Campus Evidence Lab', 'replied@safe.org', '["max@example.com"]', '["INBOX"]', '2026-06-11T09:00:00-04:00', 'Thanks for reaching out', 1, 'replied@safe.org', 'safe.org', 'safe.org'),
        ('sent-warm', 'thread-warm', 'sent', 'Campus Evidence Lab', 'max@example.com', '["warm@warm.org"]', '["SENT"]', '2026-06-10T09:00:00-04:00', 'Campus Evidence Lab', 1, 'warm@warm.org', 'warm.org', 'warm.org');
    `,
  );

  runNode([
    "scripts/cel-outreach-control/fill-followup-queue.mjs",
    "--db",
    dbPath,
    "--now",
    "2026-06-18T09:00:00-04:00",
    "--min-age-days",
    "5",
  ]);

  const rows = sqlite(
    dbPath,
    "SELECT source_thread_id || '|' || status || '|' || idempotency_key FROM followup_queue ORDER BY source_thread_id;",
  ).split("\n");

  assert.deepEqual(rows, ["thread-safe|candidate|followup:thread-safe:1"]);
});
```

- [ ] **Step 2: Run failing follow-up test**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: FAIL because `fill-followup-queue.mjs` does not exist.

- [ ] **Step 3: Create follow-up queue filler**

Create `scripts/cel-outreach-control/fill-followup-queue.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";

import { hashId, parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  now: new Date().toISOString(),
  "min-age-days": "5",
  timezone: "America/New_York",
  "send-window-start": "09:00",
  "send-window-end": "10:30",
});

const db = path.resolve(repoRoot, args.db);
const now = new Date(args.now);
const minAgeMs = (Number(args["min-age-days"]) || 5) * 24 * 60 * 60 * 1000;
const dueDate = now.toISOString().slice(0, 10);
const candidates = queryJson(
  db,
  `
    SELECT
      sent.id AS sent_id,
      sent.thread_id,
      sent.email_ts,
      sent.to_emails,
      sent.person_key,
      sent.domain_key,
      contact.id AS contact_id,
      org.id AS organization_id,
      org.relationship_status,
      org.block_level
    FROM gmail_items sent
    LEFT JOIN contacts contact ON contact.email = sent.person_key
    LEFT JOIN organizations org ON org.domain = sent.domain_key
    WHERE sent.item_type = 'sent'
      AND sent.is_cel = 1
      AND sent.thread_id != ''
      AND NOT EXISTS (
        SELECT 1 FROM gmail_items reply
        WHERE reply.thread_id = sent.thread_id
          AND reply.item_type = 'reply'
          AND reply.email_ts > sent.email_ts
      )
      AND NOT EXISTS (
        SELECT 1 FROM followup_queue existing
        WHERE existing.source_thread_id = sent.thread_id
          AND existing.sequence_no = 1
      )
    ORDER BY sent.email_ts, sent.id;
  `,
);

const sql = ["BEGIN;"];
let created = 0;

for (const candidate of candidates) {
  const sentAt = new Date(candidate.email_ts);
  if (Number.isNaN(sentAt.getTime())) continue;
  if (now.getTime() - sentAt.getTime() < minAgeMs) continue;
  const relationshipText = `${candidate.relationship_status || ""} ${candidate.block_level || ""}`.toLowerCase();
  if (/packet sent|feedback received|permission|call scheduled|routed|declined|redirect|hard block|keep warm|org review/.test(relationshipText)) {
    continue;
  }

  const id = hashId("followup", [candidate.thread_id, "1"]);
  const idempotencyKey = `followup:${candidate.thread_id}:1`;
  sql.push(`
    INSERT INTO followup_queue (
      id,
      source_thread_id,
      source_message_id,
      original_sent_message_id,
      contact_id,
      organization_id,
      sequence_no,
      due_date,
      send_window_start,
      send_window_end,
      timezone,
      status,
      idempotency_key,
      updated_at
    )
    VALUES (
      ${sqlString(id)},
      ${sqlString(candidate.thread_id)},
      ${sqlString(candidate.sent_id)},
      ${sqlString(candidate.sent_id)},
      ${sqlString(candidate.contact_id || "")},
      ${sqlString(candidate.organization_id || "")},
      1,
      ${sqlString(dueDate)},
      ${sqlString(args["send-window-start"])},
      ${sqlString(args["send-window-end"])},
      ${sqlString(args.timezone)},
      'candidate',
      ${sqlString(idempotencyKey)},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      due_date = excluded.due_date,
      updated_at = CURRENT_TIMESTAMP;
  `);
  created += 1;
}

const runId = hashId("automation_run", ["followup_scan", args.now, created]);
sql.push(`
  INSERT INTO automation_runs (id, run_type, finished_at, result, summary, created_count)
  VALUES (${sqlString(runId)}, 'followup_scan', CURRENT_TIMESTAMP, 'ok', ${sqlString(`Created ${created} follow-up candidate(s).`)}, ${created});
`);
sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ created, runId }, null, 2));
```

- [ ] **Step 4: Run follow-up test**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS for follow-up queue eligibility test.

- [ ] **Step 5: Commit**

```bash
git add scripts/cel-outreach-control/fill-followup-queue.mjs test/cel-outreach-control.test.mjs
git commit -m "Add follow-up queue eligibility"
```

---

### Task 8: Add Automation Runbook And Prompts

**Files:**
- Create: `outreach/control/automation-runbook.md`
- Create: `outreach/control/automation-prompts/fill-queue.md`
- Create: `outreach/control/automation-prompts/create-drafts.md`
- Create: `outreach/control/automation-prompts/send-due.md`
- Create: `outreach/control/automation-prompts/followup-scan.md`
- Create: `outreach/control/automation-prompts/followup-send.md`
- Modify: `outreach/control/README.md`
- Modify: `outreach/outreach-preflight-checklist.md`

- [ ] **Step 1: Create automation runbook**

Create `outreach/control/automation-runbook.md`:

```markdown
# CEL Autonomous Outreach Automation Runbook

The SQLite control plane is authoritative. Gmail labels are visibility aids only.

## Required Gates

No autonomous send may occur unless:

1. `campaign_targets.approval_status = approved_for_draft`
2. `outreach_queue.status = ready_to_send`
3. `outreach_queue.idempotency_key` is non-empty
4. no `send_attempts` row exists with the same idempotency key and `result = sent`
5. local Gmail snapshot is less than 24 hours old
6. live Gmail checks find no conflict
7. the Gmail draft recipient and subject match the queue row
8. the email body does not contain the legacy GitHub Pages CEL URL
9. daily lane caps remain at or below 20 usage and 10 protocol

## Gmail Connector Boundary

Local Node scripts do not call Gmail. Codex automations must use Gmail tools for live reads, draft creation, draft labeling, and sending, then persist outcomes through local scripts.

## Rollout Stages

1. Queue infrastructure only.
2. Draft automation only.
3. Dry-run sender records `would_send` and `blocked`.
4. Limited real sender: 3 usage and 2 protocol in one day.
5. Full 30/day sender.
6. Follow-up automation.

## Operator Response To Blocks

Blocked rows are not replaced during the same send run. Review `outreach/control/reports/blocked-autonomous-sends.csv`, update relationship records if needed, and let the next fill-queue run decide capacity.
```

- [ ] **Step 2: Create fill-queue prompt**

Create `outreach/control/automation-prompts/fill-queue.md`:

```markdown
# CEL Outreach Fill Queue Automation Prompt

Run in `/Users/maximiliankornstein/Desktop/college ideas`.

1. Run `node scripts/cel-outreach-control/init-db.mjs`.
2. Run `node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv`.
3. Import the current target pool with `node scripts/cel-outreach-control/import-target-pool.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/control/imports/target-pool.csv` if that file exists.
4. Run `node scripts/cel-outreach-control/fill-outreach-queue.mjs --db outreach/control/cel-outreach.sqlite`.
5. Run `node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports`.
6. Report created, underfilled, and blocked counts.

Do not create Gmail drafts in this automation.
```

- [ ] **Step 3: Create create-drafts prompt**

Create `outreach/control/automation-prompts/create-drafts.md`:

```markdown
# CEL Outreach Draft Creator Automation Prompt

Run in `/Users/maximiliankornstein/Desktop/college ideas`.

For each `outreach_queue` row with `status = planned`:

1. Read the campaign target, contact, organization, lane, send date, and idempotency key from SQLite.
2. Use Gmail tools to search live Gmail for the exact email, person name, domain, organization, CEL labels, starred mail, drafts, sent mail, and relationship labels.
3. Save the live-check evidence to a temporary JSON file matching the shape expected by `scripts/cel-outreach-control/apply-live-check.mjs`.
4. Run `node scripts/cel-outreach-control/apply-live-check.mjs --db outreach/control/cel-outreach.sqlite --queue-id <queue-id> --json <json-file>`.
5. If the row is blocked, do not draft.
6. If safe, create one Gmail draft using the correct lane template and `https://campusevidencelab.org/` links.
7. Apply Gmail labels `CEL/Autonomous/Queued`, `CEL/Autonomous/<send-date>`, and either `CEL/Autonomous/Usage` or `CEL/Autonomous/Protocol`.
8. Run `node scripts/cel-outreach-control/record-draft-created.mjs --db outreach/control/cel-outreach.sqlite --queue-id <queue-id> --gmail-draft-id <draft-id> --gmail-message-id <message-id> --gmail-thread-id <thread-id>`.
9. Run a second live Gmail check including the newly-created draft.
10. If safe, run `node scripts/cel-outreach-control/mark-queue-ready.mjs --db outreach/control/cel-outreach.sqlite --queue-id <queue-id>`.

Do not send any draft in this automation.
```

- [ ] **Step 4: Create send-due prompt**

Create `outreach/control/automation-prompts/send-due.md`:

```markdown
# CEL Outreach Sender Automation Prompt

Run in `/Users/maximiliankornstein/Desktop/college ideas`.

Default mode is dry-run. Real sending requires an explicit automation configuration that says `REAL_SEND_ENABLED=true`.

For each `outreach_queue` row due today with `status = ready_to_send`:

1. Verify no successful `send_attempts` row exists for the idempotency key.
2. Read the current Gmail draft by draft id.
3. Confirm the draft recipient and subject match the queued target.
4. Confirm the body uses `https://campusevidencelab.org/` and does not contain the legacy GitHub Pages CEL URL.
5. Run live Gmail searches for exact email, person name, domain, organization, CEL labels, starred mail, drafts, sent mail, relationship labels, and thread replies.
6. Save live-check evidence to JSON and run `apply-live-check.mjs`.
7. If blocked, stop for that row.
8. If dry-run mode, run `record-send-attempt.mjs --result would_send` and do not send.
9. If real-send mode, send the Gmail draft, then immediately run `record-send-attempt.mjs --result sent --gmail-message-id <sent-message-id>`.
10. Run `export-reports.mjs`.

Never replace blocked rows in the same sender run.
```

- [ ] **Step 5: Create follow-up prompts**

Create `outreach/control/automation-prompts/followup-scan.md`:

```markdown
# CEL Follow-Up Scanner Automation Prompt

Run in `/Users/maximiliankornstein/Desktop/college ideas`.

1. Refresh/import Gmail state before scanning.
2. Run `node scripts/cel-outreach-control/fill-followup-queue.mjs --db outreach/control/cel-outreach.sqlite --min-age-days 5`.
3. Export reports.
4. Do not draft or send follow-ups in this scanner.
```

Create `outreach/control/automation-prompts/followup-send.md`:

```markdown
# CEL Follow-Up Sender Automation Prompt

Run in `/Users/maximiliankornstein/Desktop/college ideas`.

For each due `followup_queue` row:

1. Read the full Gmail thread.
2. Block if there is any inbound reply after the original sent message.
3. Block if the thread or organization is warm, packet-sent, call-scheduled, routed, declined, permission-limited, or org-review-required.
4. Block if a prior follow-up exists for the same `source_thread_id` and `sequence_no`.
5. Draft or send only the first follow-up sequence.
6. Use the follow-up idempotency key `followup:<thread_id>:<sequence_no>`.

Default mode is dry-run until cold outreach automation is stable.
```

- [ ] **Step 6: Update README and checklist**

Add this section to `outreach/control/README.md`:

```markdown
## Autonomous Queue Workflow

Autonomous outreach uses SQLite as the source of truth. Gmail labels mirror queue state but do not decide eligibility.

Daily flow:

1. Fill queue from `target_pool`.
2. Create drafts for safe planned rows.
3. Run dry-run sender.
4. Promote to limited real sends only after reports are clean.
5. Promote to 30/day only after limited sending is clean.

The sender must run final live Gmail checks and must write every `would_send`, `blocked`, `error`, or `sent` attempt to `send_attempts`.
```

Add this line under the hard-stop list in `outreach/outreach-preflight-checklist.md`:

```markdown
- an autonomous queue row or send attempt already exists for the same target, thread, domain, organization, or idempotency key
```

- [ ] **Step 7: Commit**

```bash
git add outreach/control/automation-runbook.md outreach/control/automation-prompts outreach/control/README.md outreach/outreach-preflight-checklist.md
git commit -m "Document autonomous outreach automation operations"
```

---

### Task 9: Full Verification And Dry-Run Readiness

**Files:**
- Modify: `test/cel-outreach-control.test.mjs` only if a prior task missed an assertion.

- [ ] **Step 1: Run complete test suite**

Run:

```bash
node --test test/cel-outreach-control.test.mjs
```

Expected: PASS with all existing and new tests.

- [ ] **Step 2: Run a local dry queue rehearsal**

Create a disposable database and target pool:

```bash
tmpdir="$(mktemp -d)"
db="$tmpdir/control.sqlite"
csv="$tmpdir/target-pool.csv"
node scripts/cel-outreach-control/init-db.mjs --db "$db"
cat > "$csv" <<'CSV'
contact_name,email,organization,domain,lane,category,source,source_url,fit_notes
Usage One,usage1@example.org,Usage Org 1,example.org,usage,student newsroom,test,https://example.org,Test usage fit
Protocol One,protocol1@example.net,Protocol Org 1,example.net,protocol,data provenance,test,https://example.net,Test protocol fit
CSV
node scripts/cel-outreach-control/import-target-pool.mjs --db "$db" --csv "$csv"
node scripts/cel-outreach-control/fill-outreach-queue.mjs --db "$db" --send-date 2026-06-24
node scripts/cel-outreach-control/export-reports.mjs --db "$db" --out "$tmpdir/reports"
sed -n '1,20p' "$tmpdir/reports/outreach-queue.csv"
```

Expected: one usage row and one protocol row appear in `outreach-queue.csv`.

- [ ] **Step 3: Run stale link sweep**

Run:

```bash
rg -n "maximilian-kornstein[.]github[.]io/campus-evidence-lab" outreach docs scripts test \
  --glob '!outreach/control/draft-domain-migration-2026-06-20.md' \
  --glob '!outreach/outreach-preflight-checklist.md' \
  --glob '!docs/superpowers/plans/2026-06-16-flagship-report-gold-v1.md'
```

Expected: no output.

- [ ] **Step 4: Confirm no real send automation is enabled yet**

Run:

```bash
find "$HOME/.codex/automations" -type f -name automation.toml -print 2>/dev/null | xargs rg -n "CEL Outreach Sender|REAL_SEND_ENABLED|send_due" || true
```

Expected: no active real-send automation unless it is intentionally created after dry-run review.

- [ ] **Step 5: Commit final verification adjustments if any**

If Step 1 or Step 2 required fixes:

```bash
git add test/cel-outreach-control.test.mjs scripts/cel-outreach-control outreach/control
git commit -m "Verify autonomous outreach dry-run readiness"
```

If no fixes were needed, do not create an empty commit.

---

## Post-Implementation Rollout

After the plan is implemented and all tests pass:

1. Create a paused or dry-run Codex cron automation for `CEL Outreach Fill Queue`.
2. Create a paused or dry-run Codex cron automation for `CEL Outreach Draft Creator`.
3. Create a dry-run-only Codex cron automation for `CEL Outreach Sender`.
4. Inspect `reports/outreach-queue.csv`, `reports/send-attempts.csv`, and `reports/blocked-autonomous-sends.csv`.
5. Only then enable limited real sending at 3 usage and 2 protocol emails for one day.
6. Inspect Gmail sent mail, queue reports, duplicate reports, and warm relationship reports.
7. Only then enable the full 30/day cadence.
8. Implement and enable follow-up sending after cold outreach automation is stable.

## Acceptance Checklist

- [ ] Schema contains `target_pool`, `outreach_queue`, `send_attempts`, `automation_runs`, and `followup_queue`.
- [ ] Candidate importer preserves lane, category, source, source URL, and fit notes.
- [ ] Queue filler respects 20 usage and 10 protocol caps.
- [ ] Queue filler leaves a day underfilled when one lane lacks candidates.
- [ ] Live-check evaluator blocks sent, draft, reply, starred, future, scheduled, and relationship evidence.
- [ ] Queue state scripts record Gmail draft ids and sent attempts.
- [ ] A duplicate successful send attempt is impossible for one idempotency key.
- [ ] Reports include queue, attempts, automation runs, blocked sends, capacity, and follow-ups.
- [ ] Follow-up queue excludes replied and warm threads.
- [ ] Runbook and automation prompts make Gmail connector responsibilities explicit.
- [ ] Full `node --test test/cel-outreach-control.test.mjs` passes.
- [ ] Dry-run rehearsal proves queue/report flow without touching real Gmail.
- [ ] No real-send automation is enabled before dry-run review.
