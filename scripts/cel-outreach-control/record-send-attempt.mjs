#!/usr/bin/env node
import path from "node:path";

import { hashId, parseArgs, queryJson, repoRoot, runSql, sqlString } from "./lib.mjs";

const validResults = new Set(["sent", "blocked", "error", "would_send"]);

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
});

const db = path.resolve(repoRoot, args.db);
const queueId = required("queue-id");
const result = required("result");
if (!validResults.has(result)) {
  throw new Error(`Invalid --result: ${result}`);
}

const queueRows = queryJson(
  db,
  `
    SELECT id, target_id, status, idempotency_key
    FROM outreach_queue
    WHERE id = ${sqlString(queueId)}
    LIMIT 1;
  `,
);
const queue = queueRows[0];
if (!queue) {
  throw new Error(`Queue row not found: ${queueId}`);
}
if (!String(queue.idempotency_key || "").trim()) {
  throw new Error(`Queue row ${queueId} has no idempotency key`);
}

const successfulAttempts = queryJson(
  db,
  `
    SELECT id
    FROM send_attempts
    WHERE idempotency_key = ${sqlString(queue.idempotency_key)}
      AND result = 'sent'
    LIMIT 1;
  `,
);
if (result === "sent" && successfulAttempts.length > 0) {
  throw new Error(
    `Queue row ${queueId} already has a successful send attempt for idempotency key ${queue.idempotency_key}`,
  );
}
if (queue.status !== "ready_to_send") {
  throw new Error(
    `Queue row ${queueId} must be ready_to_send before recording send attempts; current status is ${queue.status}`,
  );
}

const gmailMessageId = String(args["gmail-message-id"] || "").trim();
const reason = String(args.reason || "").trim();
const liveCheckSummary = String(args["live-check-summary"] || "").trim();
const attemptedAt = String(args["attempted-at"] || new Date().toISOString()).trim();
const attemptId = hashId("send_attempt", [
  queueId,
  queue.idempotency_key,
  result,
  gmailMessageId,
  reason,
  liveCheckSummary,
  attemptedAt,
]);

const queueStatusSql =
  result === "would_send" ? "status" : result === "sent" ? "'sent'" : sqlString(result);
const lastErrorSql =
  result === "would_send" ? "last_error" : result === "sent" ? "''" : sqlString(reason || liveCheckSummary);

runSql(
  db,
  `
    BEGIN;

    INSERT INTO send_attempts (
      id,
      queue_id,
      idempotency_key,
      attempted_at,
      result,
      gmail_message_id,
      reason,
      live_check_summary
    )
    VALUES (
      ${sqlString(attemptId)},
      ${sqlString(queueId)},
      ${sqlString(queue.idempotency_key)},
      ${sqlString(attemptedAt)},
      ${sqlString(result)},
      ${sqlString(gmailMessageId)},
      ${sqlString(reason)},
      ${sqlString(liveCheckSummary)}
    );

    UPDATE outreach_queue
    SET
      status = ${queueStatusSql},
      gmail_message_id = CASE
        WHEN ${sqlString(gmailMessageId)} != '' THEN ${sqlString(gmailMessageId)}
        ELSE gmail_message_id
      END,
      last_error = ${lastErrorSql},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queueId)};

    UPDATE campaign_targets
    SET
      draft_status = 'sent',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(queue.target_id)}
      AND ${sqlString(result)} = 'sent';

    COMMIT;
  `,
);

console.log(
  JSON.stringify(
    {
      queueId,
      attemptId,
      result,
      gmailMessageId,
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
