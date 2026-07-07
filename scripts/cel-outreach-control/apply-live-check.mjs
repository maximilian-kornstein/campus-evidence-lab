#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { evaluateLiveCheck } from "./live-check.mjs";
import { hashId, parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

if (!args["queue-id"]) {
  throw new Error("Missing required --queue-id");
}
if (!args.json) {
  throw new Error("Missing required --json");
}

const db = path.resolve(repoRoot, args.db);
const queueId = String(args["queue-id"]).trim();
const jsonPath = path.resolve(repoRoot, args.json);
const rawInput = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const input = Array.isArray(rawInput) ? { evidence: rawInput } : rawInput;
const checkedAt = new Date().toISOString();

const queueRows = queryJson(
  db,
  `
    SELECT
      id,
      gmail_draft_id,
      gmail_message_id,
      gmail_thread_id,
      idempotency_key,
      status
    FROM outreach_queue
    WHERE id = ${sqlString(queueId)}
    LIMIT 1;
  `,
);
const queue = queueRows[0];
if (!queue) {
  throw new Error(`Queue row not found: ${queueId}`);
}
const mutableStatuses = new Set(["planned", "draft_created", "ready_to_send"]);
if (!mutableStatuses.has(queue.status)) {
  throw new Error(`cannot apply live check to ${queueId} with status ${queue.status}`);
}

const evaluation = evaluateLiveCheck({
  ...input,
  target: {
    ...(input.target || {}),
    queueId,
    queueDraftMessageId:
      input.target?.queueDraftMessageId ||
      input.target?.queue_draft_message_id ||
      queue.gmail_message_id ||
      queue.gmail_draft_id ||
      "",
    gmailThreadId: queue.gmail_thread_id || "",
  },
});

const sql = ["BEGIN;"];
if (evaluation.safe) {
  sql.push(`
    UPDATE outreach_queue
    SET
      last_live_check_at = ${sqlString(checkedAt)},
      last_error = '',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};
  `);
} else {
  const attemptId = hashId("send_attempt", [
    queueId,
    checkedAt,
    "blocked",
    evaluation.reasons.join(","),
  ]);
  sql.push(`
    UPDATE outreach_queue
    SET
      status = 'blocked',
      last_live_check_at = ${sqlString(checkedAt)},
      last_error = ${sqlString(evaluation.summary)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};
  `);
  sql.push(`
    INSERT INTO send_attempts (
      id,
      queue_id,
      idempotency_key,
      attempted_at,
      result,
      reason,
      live_check_summary
    )
    VALUES (
      ${sqlString(attemptId)},
      ${sqlString(queueId)},
      ${sqlString(queue.idempotency_key || "")},
      ${sqlString(checkedAt)},
      'blocked',
      ${sqlString(evaluation.reasons.join(","))},
      ${sqlString(evaluation.summary)}
    );
  `);
}
sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(
  JSON.stringify(
    {
      db,
      queueId,
      jsonPath,
      safe: evaluation.safe,
      reasons: evaluation.reasons,
      summary: evaluation.summary,
      checkedAt,
    },
    null,
    2,
  ),
);
