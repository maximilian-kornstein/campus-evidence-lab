import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateLiveCheck } from "../scripts/cel-outreach-control/live-check.mjs";
import { runSql } from "../scripts/cel-outreach-control/lib.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const runNode = (args, options = {}) =>
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

const sqlite = (dbPath, sql) =>
  execFileSync("sqlite3", [dbPath, sql], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "cel-outreach-control-"));

const initDb = (dbPath) => runNode(["scripts/cel-outreach-control/init-db.mjs", "--db", dbPath]);

test("initializes outreach control database with required tables", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");

  initDb(dbPath);

  const tables = sqlite(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
  )
    .split("\n")
    .filter(Boolean);

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
});

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

test("allows autonomous queue rows to omit optional preflight foreign keys", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");

  initDb(dbPath);

  const row = sqlite(
    dbPath,
    `
      PRAGMA foreign_keys = ON;
      INSERT INTO organizations (id, name, domain)
      VALUES ('org-basic', 'Example Org', 'example.org');
      INSERT INTO contacts (id, name, email, organization_id, domain)
      VALUES ('contact-basic', 'Example Person', 'person@example.org', 'org-basic', 'example.org');
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-basic', 'Basic Campaign', '2026-07-01', 'usage');
      INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, intended_ask, template_type)
      VALUES ('target-basic', 'campaign-basic', 'contact-basic', 'org-basic', 'usage permission', 'journalist');
      INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date)
      VALUES ('queue-basic', 'campaign-basic', 'target-basic', 'usage', '2026-07-01');
      INSERT INTO followup_queue (id, source_thread_id, sequence_no, due_date)
      VALUES ('followup-basic', 'thread-basic', 1, '2026-07-08');
      SELECT
        (SELECT preflight_run_id IS NULL FROM campaign_targets WHERE id = 'target-basic') || '|' ||
        (SELECT last_preflight_run_id IS NULL FROM outreach_queue WHERE id = 'queue-basic') || '|' ||
        (SELECT contact_id IS NULL FROM followup_queue WHERE id = 'followup-basic') || '|' ||
        (SELECT organization_id IS NULL FROM followup_queue WHERE id = 'followup-basic');
    `,
  );

  assert.equal(row, "1|1|1|1");
});

test("operational sql helper enforces foreign keys", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");

  initDb(dbPath);

  assert.throws(
    () =>
      runSql(
        dbPath,
        `
          INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id)
          VALUES ('target-invalid-fk', 'campaign-missing', 'contact-missing', 'org-missing');
        `,
      ),
    /FOREIGN KEY constraint failed/,
  );
});

test("imports relationship ledger into organizations contacts and events", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "relationship-ledger.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,status,last_meaningful_contact,next_action,next_action_date,permission,block_level,notes",
      'Meredith Kolodner,kolodner@hechingerreport.org,The Hechinger Report,hechingerreport.org,Packet sent / engaged,2026-06-17,Wait for response,2026-07-08,Unknown,Hard block individual cold outreach; org review required,"Asked about Maximilian and requested a packet."',
      'Masha Zemtsov,mzemtsov@adl.org,ADL,adl.org,Feedback received / permission-limited,2026-06-17,Keep warm,2026-08-01,Private only,Hard block cold outreach,"Use feedback without naming her or ADL."',
    ].join("\n"),
  );

  runNode([
    "scripts/cel-outreach-control/import-relationships.mjs",
    "--db",
    dbPath,
    "--csv",
    csvPath,
  ]);

  const orgRows = sqlite(
    dbPath,
    "SELECT name || '|' || domain || '|' || relationship_status || '|' || block_level FROM organizations ORDER BY domain;",
  ).split("\n");
  assert.deepEqual(orgRows, [
    "ADL|adl.org|Feedback received / permission-limited|Hard block cold outreach",
    "The Hechinger Report|hechingerreport.org|Packet sent / engaged|Hard block individual cold outreach; org review required",
  ]);

  const contactRows = sqlite(
    dbPath,
    "SELECT name || '|' || email || '|' || domain || '|' || relationship_status FROM contacts ORDER BY email;",
  ).split("\n");
  assert.deepEqual(contactRows, [
    "Meredith Kolodner|kolodner@hechingerreport.org|hechingerreport.org|Packet sent / engaged",
    "Masha Zemtsov|mzemtsov@adl.org|adl.org|Feedback received / permission-limited",
  ]);

  const eventRows = sqlite(
    dbPath,
    "SELECT event_type || '|' || event_date || '|' || permission || '|' || next_action_date FROM relationship_events ORDER BY event_type;",
  ).split("\n");
  assert.deepEqual(eventRows, [
    "Feedback received / permission-limited|2026-06-17|Private only|2026-08-01",
    "Packet sent / engaged|2026-06-17|Unknown|2026-07-08",
  ]);
});

test("imports Gmail state with CEL and future scheduled detection", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const jsonPath = path.join(tempDir, "gmail-state.json");
  initDb(dbPath);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        emails: [
          {
            id: "draft-1",
            thread_id: "thread-1",
            from_: "Maximilian Kornstein maxkornstein04@gmail.com",
            to: ["kolodner@hechingerreport.org"],
            subject: "Campus Evidence Lab packet",
            snippet: "Future scheduled-looking CEL outreach",
            labels: ["DRAFT", "CEL/Ready to Schedule/2026-07-01"],
            email_ts: "2026-06-18T10:00:00-04:00",
          },
          {
            id: "sent-1",
            thread_id: "thread-2",
            from_: "Maximilian Kornstein maxkornstein04@gmail.com",
            to: ["mzemtsov@adl.org"],
            subject: "Re: New Contact Form Submission - Press Inquiry",
            snippet: "Thank you for the Campus Evidence Lab feedback",
            labels: ["SENT", "CEL/Relationship/Keep Warm"],
            email_ts: "2026-06-17T20:58:51-04:00",
          },
          {
            id: "reply-1",
            thread_id: "thread-3",
            from_: "Naomi Y. naomi@amchainitiative.org",
            to: ["maxkornstein04@gmail.com"],
            subject: "Re: Campus Evidence Lab questions",
            snippet: "I can meet July 9",
            labels: ["INBOX", "STARRED"],
            email_ts: "2026-06-15T16:00:00-04:00",
          },
        ],
      },
      null,
      2,
    ),
  );

  runNode([
    "scripts/cel-outreach-control/import-gmail-state.mjs",
    "--db",
    dbPath,
    "--json",
    jsonPath,
  ]);

  const rows = sqlite(
    dbPath,
    "SELECT id || '|' || item_type || '|' || is_cel || '|' || is_future_or_scheduled || '|' || domain_key FROM gmail_items ORDER BY id;",
  ).split("\n");

  assert.deepEqual(rows, [
    "draft-1|draft|1|1|hechingerreport.org",
    "reply-1|reply|1|0|amchainitiative.org",
    "sent-1|sent|1|0|adl.org",
  ]);
});

test("imports Gmail label ids through a label map", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const jsonPath = path.join(tempDir, "gmail-state.json");
  initDb(dbPath);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      label_map: {
        Label_9: "CEL/Outreach/2026-06-25",
      },
      emails: [
        {
          id: "scheduled-1",
          thread_id: "thread-1",
          from_: "Maximilian Kornstein maxkornstein04@gmail.com",
          to: ["media@acslaw.org"],
          subject: "Routing request: Campus Evidence Lab",
          snippet: "I built Campus Evidence Lab",
          labels: ["Label_9"],
          email_ts: "2026-06-25T08:37:00-04:00",
        },
      ],
    }),
  );

  runNode([
    "scripts/cel-outreach-control/import-gmail-state.mjs",
    "--db",
    dbPath,
    "--json",
    jsonPath,
  ]);

  const row = sqlite(
    dbPath,
    "SELECT labels || '|' || is_cel || '|' || is_future_or_scheduled FROM gmail_items WHERE id = 'scheduled-1';",
  );
  assert.equal(row, '["CEL/Outreach/2026-06-25"]|1|1');
});

test("records Gmail snapshot metadata and label coverage", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const jsonPath = path.join(tempDir, "gmail-state.json");
  initDb(dbPath);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      snapshot_at: "2026-06-18T10:00:00-04:00",
      source: "test snapshot",
      label_snapshot: {
        "CEL/Outreach/2026-06-24": 5,
        "CEL/Relationship/Keep Warm": 18,
      },
      emails: [
        {
          id: "sent-1",
          thread_id: "thread-1",
          from_: "Maximilian Kornstein maxkornstein04@gmail.com",
          to: ["mollie.simon@propublica.org"],
          subject: "Reporting resource for campus accountability coverage",
          snippet: "Campus Evidence Lab",
          labels: ["SENT"],
          email_ts: "2026-06-18T09:13:00-04:00",
        },
      ],
    }),
  );

  runNode([
    "scripts/cel-outreach-control/import-gmail-state.mjs",
    "--db",
    dbPath,
    "--json",
    jsonPath,
  ]);

  const snapshot = sqlite(
    dbPath,
    "SELECT snapshot_at || '|' || source || '|' || item_count || '|' || label_count FROM gmail_snapshot_imports;",
  );
  assert.equal(snapshot, "2026-06-18T10:00:00-04:00|test snapshot|1|2");

  const labels = sqlite(
    dbPath,
    "SELECT label_name || '|' || message_count FROM gmail_label_counts ORDER BY label_name;",
  ).split("\n");
  assert.deepEqual(labels, [
    "CEL/Outreach/2026-06-24|5",
    "CEL/Relationship/Keep Warm|18",
  ]);
});

test("imports campaign targets from csv for duplicate preflight", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const ledgerPath = path.join(tempDir, "relationship-ledger.csv");
  const targetsPath = path.join(tempDir, "campaign-targets.csv");
  initDb(dbPath);
  fs.writeFileSync(
    ledgerPath,
    [
      "contact_name,email,organization,domain,status,last_meaningful_contact,next_action,next_action_date,permission,block_level,notes",
      "Meredith Kolodner,kolodner@hechingerreport.org,The Hechinger Report,hechingerreport.org,Packet sent / engaged,2026-06-17,Wait,2026-07-08,Unknown,Hard block individual cold outreach; org review required,Packet sent",
    ].join("\n"),
  );
  runNode(["scripts/cel-outreach-control/import-relationships.mjs", "--db", dbPath, "--csv", ledgerPath]);
  fs.writeFileSync(
    targetsPath,
    [
      "campaign_id,campaign_name,target_send_date,campaign_type,contact_name,email,organization,domain,intended_ask,template_type",
      "campaign-july-usage,July usage outreach,2026-07-01,usage,Meredith Kolodner,kolodner@hechingerreport.org,The Hechinger Report,hechingerreport.org,usage permission,journalist",
      "campaign-july-usage,July usage outreach,2026-07-01,usage,New Person,new@example.org,Example Org,example.org,usage permission,organization",
    ].join("\n"),
  );

  runNode([
    "scripts/cel-outreach-control/import-campaign-targets.mjs",
    "--db",
    dbPath,
    "--csv",
    targetsPath,
  ]);
  runNode([
    "scripts/cel-outreach-control/import-campaign-targets.mjs",
    "--db",
    dbPath,
    "--csv",
    targetsPath,
  ]);

  const targets = sqlite(
    dbPath,
    `
      SELECT
        target.campaign_id || '|' ||
        contact.email || '|' ||
        org.domain || '|' ||
        target.approval_status
      FROM campaign_targets target
      JOIN contacts contact ON contact.id = target.contact_id
      JOIN organizations org ON org.id = target.organization_id
      ORDER BY contact.email;
    `,
  ).split("\n");
  assert.deepEqual(targets, [
    "campaign-july-usage|kolodner@hechingerreport.org|hechingerreport.org|needs_preflight",
    "campaign-july-usage|new@example.org|example.org|needs_preflight",
  ]);

  const preflightIds = sqlite(
    dbPath,
    "SELECT preflight_run_id IS NULL FROM campaign_targets ORDER BY id;",
  ).split("\n");
  assert.deepEqual(preflightIds, ["1", "1"]);
});

test("runs duplicate guard with checklist-backed preflight evidence", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const ledgerPath = path.join(tempDir, "relationship-ledger.csv");
  const gmailPath = path.join(tempDir, "gmail-state.json");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  initDb(dbPath);
  fs.writeFileSync(
    checklistPath,
    "# Outreach Preflight Checklist\n\nRun CEL label, SENT, DRAFT, and scheduled/future checks before drafting.\n",
  );
  fs.writeFileSync(
    ledgerPath,
    [
      "contact_name,email,organization,domain,status,last_meaningful_contact,next_action,next_action_date,permission,block_level,notes",
      "Meredith Kolodner,kolodner@hechingerreport.org,The Hechinger Report,hechingerreport.org,Packet sent / engaged,2026-06-17,Wait,2026-07-08,Unknown,Hard block individual cold outreach; org review required,Packet sent",
      "Masha Zemtsov,mzemtsov@adl.org,ADL,adl.org,Feedback received / permission-limited,2026-06-17,Keep warm,2026-08-01,Private only,Hard block cold outreach,Feedback received",
    ].join("\n"),
  );
  runNode(["scripts/cel-outreach-control/import-relationships.mjs", "--db", dbPath, "--csv", ledgerPath]);
  fs.writeFileSync(
    gmailPath,
    JSON.stringify({
      emails: [
        {
          id: "draft-hechinger",
          thread_id: "thread-h",
          from_: "Max maxkornstein04@gmail.com",
          to: ["kolodner@hechingerreport.org"],
          subject: "Campus Evidence Lab packet",
          labels: ["DRAFT", "CEL/Ready to Schedule/2026-07-01"],
          snippet: "Campus Evidence Lab scheduled-looking draft",
        },
        {
          id: "sent-adl",
          thread_id: "thread-a",
          from_: "Max maxkornstein04@gmail.com",
          to: ["mzemtsov@adl.org"],
          subject: "Re: New Contact Form Submission",
          labels: ["SENT", "CEL/Relationship/Keep Warm"],
          snippet: "Campus Evidence Lab feedback",
        },
      ],
    }),
  );
  runNode(["scripts/cel-outreach-control/import-gmail-state.mjs", "--db", dbPath, "--json", gmailPath]);
  sqlite(
    dbPath,
    `
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-test', 'Test usage outreach', '2026-07-01', 'usage');
      INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, intended_ask, template_type)
      VALUES
        ('target-hechinger', 'campaign-test', 'contact_kolodner-hechingerreport-org', 'org_hechingerreport-org', 'usage test', 'journalist'),
        ('target-adl', 'campaign-test', 'contact_mzemtsov-adl-org', 'org_adl-org', 'usage test', 'organization');
    `,
  );

  runNode([
    "scripts/cel-outreach-control/run-duplicate-guard.mjs",
    "--db",
    dbPath,
    "--checklist",
    checklistPath,
  ]);

  const flags = sqlite(
    dbPath,
    "SELECT target_id || '|' || flag_type || '|' || severity FROM duplicate_flags ORDER BY target_id, flag_type;",
  ).split("\n");
  assert.deepEqual(flags, [
    "target-adl|exact_email_sent|hard_block",
    "target-adl|warm_org_conflict|hard_block",
    "target-hechinger|exact_email_existing_draft|hard_block",
    "target-hechinger|future_or_scheduled_conflict|hard_block",
    "target-hechinger|warm_org_conflict|hard_block",
  ]);

  const preflightRows = sqlite(
    dbPath,
    "SELECT target_id || '|' || length(checklist_sha256) || '|' || result FROM preflight_runs ORDER BY target_id;",
  ).split("\n");
  assert.deepEqual(preflightRows, [
    "target-adl|64|blocked",
    "target-hechinger|64|blocked",
  ]);

  const statuses = sqlite(
    dbPath,
    "SELECT id || '|' || approval_status FROM campaign_targets ORDER BY id;",
  ).split("\n");
  assert.deepEqual(statuses, ["target-adl|blocked", "target-hechinger|blocked"]);
});

test("blocks duplicate guard when Gmail snapshot is stale", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const ledgerPath = path.join(tempDir, "relationship-ledger.csv");
  const gmailPath = path.join(tempDir, "gmail-state.json");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  const targetsPath = path.join(tempDir, "campaign-targets.csv");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  fs.writeFileSync(
    ledgerPath,
    [
      "contact_name,email,organization,domain,status,last_meaningful_contact,next_action,next_action_date,permission,block_level,notes",
      "New Person,new@example.org,Example Org,example.org,unknown,,,,,,",
    ].join("\n"),
  );
  runNode(["scripts/cel-outreach-control/import-relationships.mjs", "--db", dbPath, "--csv", ledgerPath]);
  fs.writeFileSync(
    gmailPath,
    JSON.stringify({
      snapshot_at: "2026-06-16T09:00:00-04:00",
      source: "stale test snapshot",
      emails: [],
    }),
  );
  runNode(["scripts/cel-outreach-control/import-gmail-state.mjs", "--db", dbPath, "--json", gmailPath]);
  fs.writeFileSync(
    targetsPath,
    [
      "campaign_id,campaign_name,target_send_date,campaign_type,contact_name,email,organization,domain,intended_ask,template_type",
      "campaign-test,Test usage outreach,2026-06-18,usage,New Person,new@example.org,Example Org,example.org,usage test,organization",
    ].join("\n"),
  );
  runNode(["scripts/cel-outreach-control/import-campaign-targets.mjs", "--db", dbPath, "--csv", targetsPath]);

  runNode([
    "scripts/cel-outreach-control/run-duplicate-guard.mjs",
    "--db",
    dbPath,
    "--checklist",
    checklistPath,
    "--now",
    "2026-06-18T10:00:00-04:00",
    "--max-snapshot-age-hours",
    "24",
  ]);

  const flag = sqlite(
    dbPath,
    "SELECT flag_type || '|' || severity || '|' || evidence_item_id FROM duplicate_flags;",
  );
  assert.equal(flag, "gmail_snapshot_stale|hard_block|gmail_snapshot");

  const status = sqlite(dbPath, "SELECT approval_status FROM campaign_targets;");
  assert.equal(status, "blocked");
});

test("exports tracker reports for current state and duplicate decisions", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const ledgerPath = path.join(tempDir, "relationship-ledger.csv");
  const gmailPath = path.join(tempDir, "gmail-state.json");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  const reportDir = path.join(tempDir, "reports");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  fs.writeFileSync(
    ledgerPath,
    [
      "contact_name,email,organization,domain,status,last_meaningful_contact,next_action,next_action_date,permission,block_level,notes",
      "Meredith Kolodner,kolodner@hechingerreport.org,The Hechinger Report,hechingerreport.org,Packet sent / engaged,2026-06-17,Wait,2026-07-08,Unknown,Hard block individual cold outreach; org review required,Packet sent",
      "Naomi Younger,naomi@amchainitiative.org,AMCHA Initiative,amchainitiative.org,Call scheduled,2026-06-16,Call,2026-07-09,Unknown,Hard block cold outreach until after call,Call July 9 at 5pm",
    ].join("\n"),
  );
  runNode(["scripts/cel-outreach-control/import-relationships.mjs", "--db", dbPath, "--csv", ledgerPath]);
  fs.writeFileSync(
    gmailPath,
    JSON.stringify({
      emails: [
        {
          id: "draft-hechinger",
          thread_id: "thread-h",
          from_: "Max maxkornstein04@gmail.com",
          to: ["kolodner@hechingerreport.org"],
          subject: "Campus Evidence Lab packet",
          labels: ["DRAFT", "CEL/Ready to Schedule/2026-07-01"],
          snippet: "Campus Evidence Lab scheduled-looking draft",
        },
      ],
    }),
  );
  runNode(["scripts/cel-outreach-control/import-gmail-state.mjs", "--db", dbPath, "--json", gmailPath]);
  sqlite(
    dbPath,
    `
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-test', 'Test usage outreach', '2026-07-01', 'usage');
      INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, intended_ask, template_type)
      VALUES
        ('target-hechinger', 'campaign-test', 'contact_kolodner-hechingerreport-org', 'org_hechingerreport-org', 'usage test', 'journalist');
    `,
  );
  runNode([
    "scripts/cel-outreach-control/run-duplicate-guard.mjs",
    "--db",
    dbPath,
    "--checklist",
    checklistPath,
  ]);

  runNode(["scripts/cel-outreach-control/export-reports.mjs", "--db", dbPath, "--out", reportDir]);

  const expectedFiles = fs.readdirSync(reportDir).sort();
  assert.deepEqual(expectedFiles, [
    "campaign-targets.csv",
    "duplicate-flags.csv",
    "gmail-snapshots.csv",
    "gmail-state.csv",
    "warm-relationships.csv",
  ]);

  const gmailState = fs.readFileSync(path.join(reportDir, "gmail-state.csv"), "utf8");
  assert.match(gmailState, /id,item_type,is_cel,is_future_or_scheduled,domain_key,subject,labels/);
  assert.match(gmailState, /draft-hechinger,draft,1,1,hechingerreport\.org/);

  const gmailSnapshots = fs.readFileSync(path.join(reportDir, "gmail-snapshots.csv"), "utf8");
  assert.match(gmailSnapshots, /snapshot_at,source,item_count,label_count/);

  const duplicateFlags = fs.readFileSync(path.join(reportDir, "duplicate-flags.csv"), "utf8");
  assert.match(duplicateFlags, /target-hechinger,future_or_scheduled_conflict,hard_block/);
  assert.match(duplicateFlags, /target-hechinger,warm_org_conflict,hard_block/);

  const campaignTargets = fs.readFileSync(path.join(reportDir, "campaign-targets.csv"), "utf8");
  assert.match(campaignTargets, /target-hechinger,Test usage outreach,Meredith Kolodner,The Hechinger Report,blocked/);

  const warmRelationships = fs.readFileSync(path.join(reportDir, "warm-relationships.csv"), "utf8");
  assert.match(warmRelationships, /Naomi Younger,naomi@amchainitiative\.org,AMCHA Initiative,Call scheduled,Call,2026-07-09/);
});

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
    "SELECT contact_name || '|' || email || '|' || organization_name || '|' || domain || '|' || lane || '|' || category || '|' || source || '|' || source_url || '|' || fit_notes || '|' || status FROM target_pool ORDER BY email;",
  ).split("\n");

  assert.deepEqual(rows, [
    "Protocol Builder|protocol@example.net|Protocol Org|example.net|protocol|data provenance|manual list|https://example.net|Attestation protocol fit|candidate",
    "Usage Editor|usage@example.org|Example News|example.org|usage|student newsroom|manual list|https://example.org|Campus reporting fit|candidate",
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

test("imports and updates autonomous target pool status from csv", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes,status",
      "Blocked Candidate,blocked@example.org,Blocked Org,blocked.example,usage,student newsroom,manual list,https://blocked.example,Not eligible,blocked",
    ].join("\n"),
  );

  runNode([
    "scripts/cel-outreach-control/import-target-pool.mjs",
    "--db",
    dbPath,
    "--csv",
    csvPath,
  ]);

  assert.equal(sqlite(dbPath, "SELECT status FROM target_pool WHERE email = 'blocked@example.org';"), "blocked");

  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes,status",
      "Blocked Candidate,blocked@example.org,Blocked Org,blocked.example,usage,student newsroom,manual list,https://blocked.example,Now imported,imported",
    ].join("\n"),
  );

  runNode([
    "scripts/cel-outreach-control/import-target-pool.mjs",
    "--db",
    dbPath,
    "--csv",
    csvPath,
  ]);

  assert.equal(sqlite(dbPath, "SELECT status FROM target_pool WHERE email = 'blocked@example.org';"), "imported");
});

test("rejects target pool rows with invalid status", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes,status",
      "Bad Status,bad-status@example.org,Bad Status Org,bad-status.example,usage,unknown,manual list,https://bad-status.example,Bad status,queued",
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
    /Invalid status/,
  );
});

test("preserves existing target pool status when re-import omits status", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes,status",
      "Blocked Preserve,blocked-preserve@example.org,Blocked Preserve Org,blocked-preserve.example,usage,student newsroom,manual list,https://blocked-preserve.example,Blocked status,blocked",
      "Imported Preserve,imported-preserve@example.org,Imported Preserve Org,imported-preserve.example,usage,student newsroom,manual list,https://imported-preserve.example,Imported status,imported",
      "Exhausted Preserve,exhausted-preserve@example.org,Exhausted Preserve Org,exhausted-preserve.example,protocol,data provenance,manual list,https://exhausted-preserve.example,Exhausted status,exhausted",
    ].join("\n"),
  );
  runNode([
    "scripts/cel-outreach-control/import-target-pool.mjs",
    "--db",
    dbPath,
    "--csv",
    csvPath,
  ]);

  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization,domain,lane,category,source,source_url,fit_notes",
      "Blocked Preserve,blocked-preserve@example.org,Blocked Preserve Org,blocked-preserve.example,usage,student newsroom,refresh list,https://blocked-preserve.example,Still blocked",
      "Imported Preserve,imported-preserve@example.org,Imported Preserve Org,imported-preserve.example,usage,student newsroom,refresh list,https://imported-preserve.example,Still imported",
      "Exhausted Preserve,exhausted-preserve@example.org,Exhausted Preserve Org,exhausted-preserve.example,protocol,data provenance,refresh list,https://exhausted-preserve.example,Still exhausted",
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
    "SELECT email || '|' || status || '|' || source FROM target_pool ORDER BY email;",
  ).split("\n");

  assert.deepEqual(rows, [
    "blocked-preserve@example.org|blocked|refresh list",
    "exhausted-preserve@example.org|exhausted|refresh list",
    "imported-preserve@example.org|imported|refresh list",
  ]);
});

test("updates existing target pool row by email natural key", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO target_pool (id, contact_name, email, organization_name, domain, lane, category, source, source_url, fit_notes, status)
      VALUES ('manual-email-row', 'Old Email Contact', 'natural@example.org', 'Old Org', 'old.example', 'usage', 'old category', 'old source', 'https://old.example', 'old notes', 'blocked');
    `,
  );
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization_name,domain,lane,category,sourceUrl,fitNotes,status",
      "Natural Email,natural@example.org,Natural Org,natural.example,protocol,data provenance,https://natural.example,Updated by email,imported",
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
    "SELECT id || '|' || contact_name || '|' || organization_name || '|' || domain || '|' || lane || '|' || source_url || '|' || fit_notes || '|' || status FROM target_pool;",
  ).split("\n");

  assert.deepEqual(rows, [
    "manual-email-row|Natural Email|Natural Org|natural.example|protocol|https://natural.example|Updated by email|imported",
  ]);
});

test("updates existing no-email target pool row by domain and contact natural key", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const csvPath = path.join(tempDir, "target-pool.csv");
  initDb(dbPath);
  sqlite(
    dbPath,
    `
      INSERT INTO target_pool (id, contact_name, email, organization_name, domain, lane, category, source, source_url, fit_notes, status)
      VALUES ('manual-domain-contact-row', 'Domain Contact', '', 'Old Domain Org', 'domain-contact.example', 'usage', 'old category', 'old source', 'https://old-domain.example', 'old notes', 'exhausted');
    `,
  );
  fs.writeFileSync(
    csvPath,
    [
      "contact_name,email,organization_name,domain,lane,category,source,source_url,fit_notes,status",
      "Domain Contact,,New Domain Org,domain-contact.example,protocol,data provenance,manual refresh,https://domain-contact.example,Updated by domain contact,blocked",
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
    "SELECT id || '|' || contact_name || '|' || email || '|' || organization_name || '|' || domain || '|' || lane || '|' || source || '|' || status FROM target_pool;",
  ).split("\n");

  assert.deepEqual(rows, [
    "manual-domain-contact-row|Domain Contact||New Domain Org|domain-contact.example|protocol|manual refresh|blocked",
  ]);
});

test("fills autonomous outreach queue with default usage and protocol caps", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  seedTargetPool(dbPath, { usage: 25, protocol: 15 });

  runNode([
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-07-02",
    "--send-window-start",
    "09:00",
    "--send-window-end",
    "11:00",
    "--timezone",
    "America/New_York",
    "--checklist",
    checklistPath,
  ]);

  const queueCounts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM outreach_queue GROUP BY lane ORDER BY lane;",
  ).split("\n");
  assert.deepEqual(queueCounts, ["protocol|10", "usage|20"]);

  const poolCounts = sqlite(
    dbPath,
    "SELECT lane || '|' || status || '|' || count(*) FROM target_pool GROUP BY lane, status ORDER BY lane, status;",
  ).split("\n");
  assert.deepEqual(poolCounts, [
    "protocol|candidate|5",
    "protocol|imported|10",
    "usage|candidate|5",
    "usage|imported|20",
  ]);

  const campaigns = sqlite(
    dbPath,
    "SELECT campaign_type || '|' || target_send_date || '|' || count(*) FROM campaigns GROUP BY campaign_type, target_send_date;",
  );
  assert.equal(campaigns, "autonomous_outreach|2026-07-02|1");
});

test("does not let underfilled protocol lane borrow extra usage capacity", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  seedTargetPool(dbPath, { usage: 30, protocol: 3 });

  runNode([
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-07-03",
    "--send-window-start",
    "09:00",
    "--send-window-end",
    "11:00",
    "--timezone",
    "America/New_York",
    "--checklist",
    checklistPath,
  ]);

  const queueCounts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM outreach_queue GROUP BY lane ORDER BY lane;",
  ).split("\n");
  assert.deepEqual(queueCounts, ["protocol|3", "usage|20"]);

  const usagePoolCounts = sqlite(
    dbPath,
    "SELECT status || '|' || count(*) FROM target_pool WHERE lane = 'usage' GROUP BY status ORDER BY status;",
  ).split("\n");
  assert.deepEqual(usagePoolCounts, ["candidate|10", "imported|20"]);
});

test("fill queue is idempotent and existing active rows count against lane caps", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  seedTargetPool(dbPath, { usage: 25, protocol: 12 });
  seedExistingQueueRows(dbPath, {
    sendDate: "2026-07-04",
    usage: 4,
    protocol: 3,
  });

  const args = [
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-07-04",
    "--send-window-start",
    "09:00",
    "--send-window-end",
    "11:00",
    "--timezone",
    "America/New_York",
    "--checklist",
    checklistPath,
  ];
  runNode(args);
  runNode(args);

  const queueCounts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM outreach_queue WHERE send_date = '2026-07-04' GROUP BY lane ORDER BY lane;",
  ).split("\n");
  assert.deepEqual(queueCounts, ["protocol|10", "usage|20"]);

  const importedCounts = sqlite(
    dbPath,
    "SELECT lane || '|' || count(*) FROM target_pool WHERE status = 'imported' GROUP BY lane ORDER BY lane;",
  ).split("\n");
  assert.deepEqual(importedCounts, ["protocol|7", "usage|16"]);

  const runCount = sqlite(dbPath, "SELECT count(*) FROM automation_runs WHERE run_type = 'fill_queue';");
  assert.equal(runCount, "2");
});

test("fill queue blocks selected candidates rejected by duplicate preflight", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const checklistPath = path.join(tempDir, "outreach-preflight-checklist.md");
  initDb(dbPath);
  fs.writeFileSync(checklistPath, "# Outreach Preflight Checklist\n");
  seedTargetPool(dbPath, { usage: 2, protocol: 1 });
  sqlite(
    dbPath,
    `
      INSERT INTO gmail_items (id, item_type, to_emails, labels, is_cel)
      VALUES ('sent-usage-001', 'sent', '["usage001@example.org"]', '["SENT"]', 1);
    `,
  );

  runNode([
    "scripts/cel-outreach-control/fill-outreach-queue.mjs",
    "--db",
    dbPath,
    "--send-date",
    "2026-07-05",
    "--send-window-start",
    "09:00",
    "--send-window-end",
    "11:00",
    "--timezone",
    "America/New_York",
    "--checklist",
    checklistPath,
  ]);

  const poolStatuses = sqlite(
    dbPath,
    "SELECT email || '|' || status FROM target_pool ORDER BY email;",
  ).split("\n");
  assert.deepEqual(poolStatuses, [
    "protocol001@example.org|imported",
    "usage001@example.org|blocked",
    "usage002@example.org|imported",
  ]);

  const queueRows = sqlite(
    dbPath,
    `
      SELECT
        queue.lane || '|' ||
        contact.email || '|' ||
        queue.send_window_start || '|' ||
        queue.send_window_end || '|' ||
        queue.timezone || '|' ||
        queue.status || '|' ||
        queue.gmail_label || '|' ||
        (queue.idempotency_key != '') || '|' ||
        (queue.last_preflight_run_id != '')
      FROM outreach_queue queue
      JOIN campaign_targets target ON target.id = queue.target_id
      JOIN contacts contact ON contact.id = target.contact_id
      ORDER BY contact.email;
    `,
  ).split("\n");
  assert.deepEqual(queueRows, [
    "protocol|protocol001@example.org|09:00|11:00|America/New_York|planned|CEL/Outreach/2026-07-05|1|1",
    "usage|usage002@example.org|09:00|11:00|America/New_York|planned|CEL/Outreach/2026-07-05|1|1",
  ]);

  const gmailRows = sqlite(dbPath, "SELECT count(*) FROM gmail_items;");
  assert.equal(gmailRows, "1");
});

test("live check blocks unsafe Gmail and relationship evidence with deduplicated reasons", () => {
  const result = evaluateLiveCheck({
    target: {
      queueId: "queue-live-unsafe",
      queueDraftMessageId: "draft-current-message",
    },
    evidence: [
      {
        type: "prior_sent_cel_item",
        messageId: "sent-existing",
        summary: "CEL outreach was already sent to this contact.",
      },
      {
        type: "prior_sent_cel_item",
        messageId: "sent-existing-duplicate",
        summary: "Duplicate signal for the same block reason.",
      },
      {
        type: "existing_draft",
        messageId: "draft-other-message",
        summary: "A different CEL draft already exists.",
      },
      {
        type: "inbound_reply_activity",
        threadId: "thread-reply",
        summary: "Recipient replied in the relevant thread.",
      },
      {
        type: "starred_thread",
        threadId: "thread-starred",
        summary: "Thread is starred for manual review.",
      },
      {
        type: "future_scheduled_item",
        messageId: "scheduled-future",
        summary: "Future-looking scheduled CEL item exists.",
      },
      {
        type: "warm_relationship",
        summary: "Relationship ledger marks the organization warm.",
      },
      {
        type: "blocked_relationship",
        summary: "Relationship ledger blocks cold outreach.",
      },
    ],
  });

  assert.equal(result.safe, false);
  assert.deepEqual(result.reasons, [
    "prior_sent_cel_item",
    "existing_draft_conflict",
    "inbound_reply_activity",
    "starred_or_manual_review_thread",
    "future_or_scheduled_item",
    "warm_or_blocked_relationship",
  ]);
  assert.match(result.summary, /prior_sent_cel_item/);
  assert.match(result.summary, /warm_or_blocked_relationship/);
});

test("live check allows the current queue draft message id", () => {
  const result = evaluateLiveCheck({
    target: {
      queueId: "queue-live-safe",
      queueDraftMessageId: "draft-current-message",
    },
    evidence: [
      {
        type: "existing_draft",
        messageId: "draft-current-message",
        summary: "The only draft is the draft associated with this queue row.",
      },
    ],
  });

  assert.deepEqual(result, {
    safe: true,
    reasons: [],
    summary: "Live check passed with 1 allowed evidence item(s).",
  });
});

test("live check treats raw Gmail sent type as prior sent CEL evidence", () => {
  const result = evaluateLiveCheck({
    target: {
      queueId: "queue-raw-sent",
      queueDraftMessageId: "draft-current-message",
    },
    evidence: [
      {
        type: "sent",
        isCel: true,
      },
    ],
  });

  assert.equal(result.safe, false);
  assert.deepEqual(result.reasons, ["prior_sent_cel_item"]);
});

test("live check treats raw Gmail draft type as a draft conflict", () => {
  const result = evaluateLiveCheck({
    target: {
      queueId: "queue-raw-draft-conflict",
      queueDraftMessageId: "draft-current-message",
    },
    evidence: [
      {
        type: "draft",
        messageId: "other",
        isCel: true,
      },
    ],
  });

  assert.equal(result.safe, false);
  assert.deepEqual(result.reasons, ["existing_draft_conflict"]);
});

test("live check keeps raw Gmail current queue draft safe", () => {
  const result = evaluateLiveCheck({
    target: {
      queueId: "queue-raw-draft-current",
      queueDraftMessageId: "draft-current-message",
    },
    evidence: [
      {
        type: "draft",
        messageId: "draft-current-message",
      },
    ],
  });

  assert.equal(result.safe, true);
  assert.deepEqual(result.reasons, []);
});

test("apply live check leaves safe queue status unchanged and clears last error", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const jsonPath = path.join(tempDir, "live-check-safe.json");
  initDb(dbPath);
  seedLiveCheckQueue(dbPath, {
    queueId: "queue-live-safe",
    status: "ready_to_send",
    gmailMessageId: "draft-current-message",
    idempotencyKey: "queue-live-safe-key",
    lastError: "previous transient error",
  });
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      evidence: [
        {
          type: "existing_draft",
          messageId: "draft-current-message",
          summary: "Current queue draft still exists.",
        },
      ],
    }),
  );

  runNode([
    "scripts/cel-outreach-control/apply-live-check.mjs",
    "--db",
    dbPath,
    "--queue-id",
    "queue-live-safe",
    "--json",
    jsonPath,
  ]);

  const queueRow = sqlite(
    dbPath,
    "SELECT status || '|' || (last_live_check_at != '') || '|' || last_error FROM outreach_queue WHERE id = 'queue-live-safe';",
  );
  assert.equal(queueRow, "ready_to_send|1|");

  const attempts = sqlite(dbPath, "SELECT count(*) FROM send_attempts WHERE queue_id = 'queue-live-safe';");
  assert.equal(attempts, "0");
});

test("apply live check blocks unsafe queue and records blocked send attempt", () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, "control.sqlite");
  const jsonPath = path.join(tempDir, "live-check-unsafe.json");
  initDb(dbPath);
  seedLiveCheckQueue(dbPath, {
    queueId: "queue-live-unsafe",
    status: "ready_to_send",
    gmailMessageId: "draft-current-message",
    idempotencyKey: "queue-live-unsafe-key",
  });
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      evidence: [
        {
          type: "prior_sent_cel_item",
          messageId: "sent-existing",
          summary: "Existing sent CEL outreach item.",
        },
        {
          type: "existing_draft",
          messageId: "draft-other-message",
          summary: "Different draft exists.",
        },
      ],
    }),
  );

  runNode([
    "scripts/cel-outreach-control/apply-live-check.mjs",
    "--db",
    dbPath,
    "--queue-id",
    "queue-live-unsafe",
    "--json",
    jsonPath,
  ]);

  const queueRow = sqlite(
    dbPath,
    "SELECT status || '|' || (last_live_check_at != '') || '|' || last_error FROM outreach_queue WHERE id = 'queue-live-unsafe';",
  );
  assert.match(queueRow, /^blocked\|1\|Live check blocked queue: prior_sent_cel_item, existing_draft_conflict/);

  const attemptRow = sqlite(
    dbPath,
    `
      SELECT
        queue_id || '|' ||
        idempotency_key || '|' ||
        result || '|' ||
        reason || '|' ||
        live_check_summary
      FROM send_attempts
      WHERE queue_id = 'queue-live-unsafe';
    `,
  );
  assert.match(
    attemptRow,
    /^queue-live-unsafe\|queue-live-unsafe-key\|blocked\|prior_sent_cel_item,existing_draft_conflict\|Live check blocked queue: prior_sent_cel_item, existing_draft_conflict/,
  );
});

function seedTargetPool(dbPath, { usage = 0, protocol = 0 }) {
  const values = [];
  for (const lane of ["usage", "protocol"]) {
    const count = lane === "usage" ? usage : protocol;
    for (let index = 1; index <= count; index += 1) {
      const number = String(index).padStart(3, "0");
      values.push(`(
        'target-pool-${lane}-${number}',
        '${lane} Contact ${number}',
        '${lane}${number}@example.org',
        '${lane} Org ${number}',
        '${lane}-${number}.example.org',
        '${lane}',
        'test category',
        'test source',
        'https://${lane}-${number}.example.org',
        '${lane} fit ${number}',
        'candidate'
      )`);
    }
  }

  if (values.length === 0) return;
  sqlite(
    dbPath,
    `
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
        status
      )
      VALUES ${values.join(",")};
    `,
  );
}

function seedExistingQueueRows(dbPath, { sendDate, usage = 0, protocol = 0 }) {
  const statements = [];
  const statuses = ["planned", "draft_created", "ready_to_send", "sent"];
  for (const lane of ["usage", "protocol"]) {
    const count = lane === "usage" ? usage : protocol;
    for (let index = 1; index <= count; index += 1) {
      const number = String(index).padStart(3, "0");
      const orgId = `org-existing-${lane}-${number}`;
      const contactId = `contact-existing-${lane}-${number}`;
      const campaignId = `campaign-existing-${lane}-${number}`;
      const targetId = `target-existing-${lane}-${number}`;
      const queueId = `queue-existing-${lane}-${number}`;
      const status = statuses[(index - 1) % statuses.length];
      statements.push(`
        INSERT INTO organizations (id, name, domain)
        VALUES ('${orgId}', 'Existing ${lane} Org ${number}', 'existing-${lane}-${number}.example.org');
        INSERT INTO contacts (id, name, email, organization_id, domain)
        VALUES ('${contactId}', 'Existing ${lane} Contact ${number}', 'existing-${lane}-${number}@example.org', '${orgId}', 'existing-${lane}-${number}.example.org');
        INSERT INTO campaigns (id, name, target_send_date, campaign_type)
        VALUES ('${campaignId}', 'Existing ${lane} Campaign ${number}', '${sendDate}', 'autonomous_outreach');
        INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, approval_status)
        VALUES ('${targetId}', '${campaignId}', '${contactId}', '${orgId}', 'approved_for_draft');
        INSERT INTO outreach_queue (id, campaign_id, target_id, lane, send_date, status, idempotency_key)
        VALUES ('${queueId}', '${campaignId}', '${targetId}', '${lane}', '${sendDate}', '${status}', '${queueId}-idempotency');
      `);
    }
  }

  if (statements.length === 0) return;
  sqlite(dbPath, statements.join("\n"));
}

function seedLiveCheckQueue(
  dbPath,
  {
    queueId,
    status = "ready_to_send",
    gmailMessageId = "",
    idempotencyKey = "",
    lastError = "",
  },
) {
  sqlite(
    dbPath,
    `
      INSERT INTO organizations (id, name, domain)
      VALUES ('org-${queueId}', 'Live Check Org', 'live-check.example.org');
      INSERT INTO contacts (id, name, email, organization_id, domain)
      VALUES ('contact-${queueId}', 'Live Check Contact', '${queueId}@example.org', 'org-${queueId}', 'live-check.example.org');
      INSERT INTO campaigns (id, name, target_send_date, campaign_type)
      VALUES ('campaign-${queueId}', 'Live Check Campaign', '2026-07-06', 'autonomous_outreach');
      INSERT INTO campaign_targets (id, campaign_id, contact_id, organization_id, approval_status)
      VALUES ('target-${queueId}', 'campaign-${queueId}', 'contact-${queueId}', 'org-${queueId}', 'approved_for_draft');
      INSERT INTO outreach_queue (
        id,
        campaign_id,
        target_id,
        lane,
        send_date,
        status,
        gmail_message_id,
        idempotency_key,
        last_error
      )
      VALUES (
        '${queueId}',
        'campaign-${queueId}',
        'target-${queueId}',
        'usage',
        '2026-07-06',
        '${status}',
        '${gmailMessageId}',
        '${idempotencyKey}',
        '${lastError}'
      );
    `,
  );
}
