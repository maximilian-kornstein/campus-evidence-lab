#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { parseArgs, queryJson, repoRoot, toCsv } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: "outreach/control/cel-outreach.sqlite",
  out: "outreach/control/reports",
});

const dbPath = path.isAbsolute(args.db) ? args.db : path.join(repoRoot, args.db);
const outDir = path.isAbsolute(args.out) ? args.out : path.join(repoRoot, args.out);
fs.mkdirSync(outDir, { recursive: true });

const writeReport = (fileName, headers, sql) => {
  const rows = queryJson(dbPath, sql);
  fs.writeFileSync(path.join(outDir, fileName), toCsv(rows, headers));
};

writeReport(
  "gmail-snapshots.csv",
  ["snapshot_at", "source", "item_count", "label_count", "imported_at", "source_path"],
  `
    SELECT snapshot_at, source, item_count, label_count, imported_at, source_path
    FROM gmail_snapshot_imports
    ORDER BY imported_at DESC, snapshot_at DESC;
  `,
);

writeReport(
  "gmail-state.csv",
  ["id", "item_type", "is_cel", "is_future_or_scheduled", "domain_key", "subject", "labels"],
  `
    SELECT
      id,
      item_type,
      is_cel,
      is_future_or_scheduled,
      domain_key,
      subject,
      labels
    FROM gmail_items
    ORDER BY is_future_or_scheduled DESC, item_type, domain_key, email_ts DESC, id;
  `,
);

writeReport(
  "duplicate-flags.csv",
  ["target_id", "flag_type", "severity", "matched_item_id", "details"],
  `
    SELECT
      target_id,
      flag_type,
      severity,
      evidence_item_id AS matched_item_id,
      evidence_summary AS details
    FROM duplicate_flags
    ORDER BY target_id, severity, flag_type, matched_item_id;
  `,
);

writeReport(
  "campaign-targets.csv",
  [
    "target_id",
    "campaign_name",
    "contact_name",
    "organization_name",
    "approval_status",
    "target_send_date",
    "intended_ask",
    "template_type",
  ],
  `
    SELECT
      target.id AS target_id,
      campaign.name AS campaign_name,
      COALESCE(contact.name, '') AS contact_name,
      COALESCE(org.name, '') AS organization_name,
      target.approval_status,
      campaign.target_send_date,
      target.intended_ask,
      target.template_type
    FROM campaign_targets target
    JOIN campaigns campaign ON campaign.id = target.campaign_id
    LEFT JOIN contacts contact ON contact.id = target.contact_id
    LEFT JOIN organizations org ON org.id = target.organization_id
    ORDER BY campaign.target_send_date, target.approval_status, organization_name, contact_name;
  `,
);

writeReport(
  "warm-relationships.csv",
  [
    "contact_name",
    "email",
    "organization_name",
    "relationship_status",
    "next_action",
    "next_action_date",
    "last_meaningful_contact",
    "permission",
    "block_level",
    "notes",
  ],
  `
    SELECT
      contact.name AS contact_name,
      contact.email,
      COALESCE(org.name, '') AS organization_name,
      event.event_type AS relationship_status,
      event.next_action,
      event.next_action_date,
      event.event_date AS last_meaningful_contact,
      event.permission,
      event.block_level,
      event.notes
    FROM relationship_events event
    LEFT JOIN contacts contact ON contact.id = event.contact_id
    LEFT JOIN organizations org ON org.id = event.organization_id
    WHERE
      event.event_type <> ''
      OR event.next_action <> ''
      OR event.next_action_date <> ''
      OR event.block_level <> ''
    ORDER BY
      CASE WHEN event.next_action_date = '' THEN 1 ELSE 0 END,
      event.next_action_date,
      organization_name,
      contact_name;
  `,
);

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
  [
    "attempt_id",
    "queue_id",
    "idempotency_key",
    "attempted_at",
    "result",
    "gmail_message_id",
    "reason",
    "live_check_summary",
  ],
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
  [
    "run_id",
    "run_type",
    "started_at",
    "finished_at",
    "result",
    "summary",
    "created_count",
    "sent_count",
    "blocked_count",
    "error_count",
  ],
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
    ORDER BY started_at DESC, run_type, id;
  `,
);

writeReport(
  "blocked-autonomous-sends.csv",
  [
    "queue_id",
    "campaign_name",
    "target_id",
    "lane",
    "send_date",
    "status",
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
      queue.status,
      queue.last_live_check_at,
      queue.last_error
    FROM outreach_queue queue
    LEFT JOIN campaigns campaign ON campaign.id = queue.campaign_id
    WHERE queue.status IN ('blocked', 'error')
    ORDER BY queue.send_date, queue.lane, queue.status, queue.id;
  `,
);

writeReport(
  "daily-capacity.csv",
  ["send_date", "lane", "queued_count", "sent_count", "ready_count", "blocked_count"],
  `
    SELECT
      send_date,
      lane,
      COUNT(*) AS queued_count,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      SUM(CASE WHEN status = 'ready_to_send' THEN 1 ELSE 0 END) AS ready_count,
      SUM(CASE WHEN status IN ('blocked', 'error') THEN 1 ELSE 0 END) AS blocked_count
    FROM outreach_queue
    GROUP BY send_date, lane
    ORDER BY send_date, lane;
  `,
);

writeReport(
  "followup-queue.csv",
  [
    "followup_id",
    "source_thread_id",
    "source_message_id",
    "original_sent_message_id",
    "sequence_no",
    "due_date",
    "send_window_start",
    "send_window_end",
    "timezone",
    "status",
    "gmail_draft_id",
    "gmail_message_id",
    "idempotency_key",
    "last_thread_check_at",
    "last_error",
  ],
  `
    SELECT
      id AS followup_id,
      source_thread_id,
      source_message_id,
      original_sent_message_id,
      sequence_no,
      due_date,
      send_window_start,
      send_window_end,
      timezone,
      status,
      gmail_draft_id,
      gmail_message_id,
      idempotency_key,
      last_thread_check_at,
      last_error
    FROM followup_queue
    ORDER BY due_date, status, source_thread_id, sequence_no, id;
  `,
);

console.log(`Exported outreach control reports to ${outDir}`);
