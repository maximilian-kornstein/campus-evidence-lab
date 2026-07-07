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

console.log(`Exported outreach control reports to ${outDir}`);
