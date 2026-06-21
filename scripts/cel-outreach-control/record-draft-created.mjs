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

const updated = Number(
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

      SELECT changes();
    `,
  ).trim(),
);

if (updated !== 1) {
  throw new Error(`No planned or draft_created outreach_queue row updated for ${queueId}`);
}

console.log(
  JSON.stringify(
    {
      queueId,
      status: "draft_created",
      gmailDraftId,
      gmailMessageId,
      gmailThreadId,
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
