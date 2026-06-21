#!/usr/bin/env node
import path from "node:path";

import { hashId, parseArgs, repoRoot, runSql, sqlString } from "./lib.mjs";

const validRunTypes = new Set(["fill_queue", "create_drafts", "send_due", "followup_scan", "followup_send"]);
const validResults = new Set(["ok", "partial", "blocked", "error"]);

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  result: "ok",
  "created-count": "0",
  "sent-count": "0",
  "blocked-count": "0",
  "error-count": "0",
});

const db = path.resolve(repoRoot, args.db);
const runType = required("run-type");
if (!validRunTypes.has(runType)) {
  throw new Error(`Invalid --run-type: ${runType}`);
}
const result = String(args.result || "ok").trim();
if (!validResults.has(result)) {
  throw new Error(`Invalid --result: ${result}`);
}

const startedAt = String(args["started-at"] || new Date().toISOString()).trim();
const finishedAt = String(args["finished-at"] || new Date().toISOString()).trim();
const summary = String(args.summary || "").trim();
const runId = String(args.id || hashId("automation_run", [runType, startedAt])).trim();
const createdCount = countArg("created-count");
const sentCount = countArg("sent-count");
const blockedCount = countArg("blocked-count");
const errorCount = countArg("error-count");

runSql(
  db,
  `
    INSERT INTO automation_runs (
      id,
      run_type,
      started_at,
      finished_at,
      result,
      summary,
      created_count,
      sent_count,
      blocked_count,
      error_count
    )
    VALUES (
      ${sqlString(runId)},
      ${sqlString(runType)},
      ${sqlString(startedAt)},
      ${sqlString(finishedAt)},
      ${sqlString(result)},
      ${sqlString(summary)},
      ${createdCount},
      ${sentCount},
      ${blockedCount},
      ${errorCount}
    )
    ON CONFLICT(id) DO UPDATE SET
      run_type = excluded.run_type,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      result = excluded.result,
      summary = excluded.summary,
      created_count = excluded.created_count,
      sent_count = excluded.sent_count,
      blocked_count = excluded.blocked_count,
      error_count = excluded.error_count;
  `,
);

console.log(
  JSON.stringify(
    {
      runId,
      runType,
      result,
      createdCount,
      sentCount,
      blockedCount,
      errorCount,
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

function countArg(name) {
  const value = Number(args[name]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return value;
}
