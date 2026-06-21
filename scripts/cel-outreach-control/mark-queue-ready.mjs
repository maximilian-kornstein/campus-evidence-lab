#!/usr/bin/env node
import path from "node:path";

import { parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = required("queue-id");
const liveCheckAt = String(args["live-check-at"] || new Date().toISOString()).trim();

const rows = queryJson(
  db,
  `
    SELECT id, status, gmail_draft_id, gmail_message_id
    FROM outreach_queue
    WHERE id = ${sqlString(queueId)}
    LIMIT 1;
  `,
);
const row = rows[0];
if (!row) {
  throw new Error(`Queue row not found: ${queueId}`);
}
if (row.status !== "draft_created") {
  throw new Error(
    `Queue row ${queueId} must be draft_created before ready_to_send; current status is ${row.status}`,
  );
}
if (!String(row.gmail_draft_id || "").trim() || !String(row.gmail_message_id || "").trim()) {
  throw new Error(`Queue row ${queueId} cannot be ready without Gmail draft and message ids`);
}

const updated = Number(
  runSql(
    db,
    `
      UPDATE outreach_queue
      SET
        status = 'ready_to_send',
        last_live_check_at = ${sqlString(liveCheckAt)},
        last_error = '',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(queueId)}
        AND status = 'draft_created'
        AND gmail_draft_id != ''
        AND gmail_message_id != '';

      SELECT changes();
    `,
  ).trim(),
);

if (updated !== 1) {
  throw new Error(`No draft_created outreach_queue row marked ready for ${queueId}`);
}

console.log(
  JSON.stringify(
    {
      queueId,
      status: "ready_to_send",
      liveCheckAt,
    },
    null,
    2,
  ),
);

function required(name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`Missing required --${name}`);
  return value;
}
