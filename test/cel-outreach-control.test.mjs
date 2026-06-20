import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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
