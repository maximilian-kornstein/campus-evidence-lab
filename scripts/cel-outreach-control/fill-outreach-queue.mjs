#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

import {
  hashId,
  normalizeDomain,
  normalizeEmail,
  parseArgs,
  queryJson,
  repoRoot,
  runSql,
  slugify,
  sqlString,
} from "./lib.mjs";

const activeQueueStatuses = ["planned", "draft_created", "ready_to_send", "sent"];
const lanes = ["usage", "protocol"];

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  checklist: path.join(repoRoot, "outreach/outreach-preflight-checklist.md"),
  timezone: "America/New_York",
  "usage-cap": "20",
  "protocol-cap": "10",
});

const db = path.resolve(repoRoot, args.db);
const checklistPath = path.resolve(repoRoot, args.checklist);
const sendDate = requiredArg("send-date");
const sendWindowStart = requiredArg("send-window-start");
const sendWindowEnd = requiredArg("send-window-end");
const timezone = String(args.timezone || "America/New_York").trim();
const caps = {
  usage: Number(args["usage-cap"] ?? 20),
  protocol: Number(args["protocol-cap"] ?? 10),
};

for (const lane of lanes) {
  if (!Number.isInteger(caps[lane]) || caps[lane] < 0) {
    throw new Error(`Invalid ${lane} cap: ${args[`${lane}-cap`]}`);
  }
}

const campaignName = String(
  args["campaign-name"] || `CEL autonomous outreach ${sendDate}`,
).trim();
const campaignId = String(
  args["campaign-id"] || hashId("campaign", [campaignName, sendDate, "autonomous_outreach"]),
).trim();

const existingCounts = existingActiveCounts();
const selected = [];

for (const lane of lanes) {
  const remaining = Math.max(0, caps[lane] - (existingCounts[lane] || 0));
  if (remaining === 0) continue;
  selected.push(...selectCandidates(lane, remaining));
}

const selectedByPoolId = new Map();
for (const row of selected) {
  const hydrated = hydrateTarget(row);
  selectedByPoolId.set(row.id, hydrated);
}

const runId = `run_${crypto.randomUUID()}`;

insertAutomationRun(runId, "partial", "Queue filler started.");

upsertSelectedTargets([...selectedByPoolId.values()]);

if (selected.length > 0) {
  runDuplicateGuard();
  queueApprovedTargets([...selectedByPoolId.values()]);
}

const finalCounts = summarizeRun();
finishAutomationRun(runId, finalCounts);

console.log(
  JSON.stringify(
    {
      db,
      sendDate,
      campaignId,
      selected: selected.length,
      queued: finalCounts.queued,
      blocked: finalCounts.blocked,
    },
    null,
    2,
  ),
);

function requiredArg(name) {
  const value = String(args[name] || "").trim();
  if (!value) throw new Error(`Missing required --${name}`);
  return value;
}

function existingActiveCounts() {
  const statuses = activeQueueStatuses.map(sqlString).join(", ");
  const rows = queryJson(
    db,
    `
      SELECT lane, count(*) AS count
      FROM outreach_queue
      WHERE send_date = ${sqlString(sendDate)}
        AND status IN (${statuses})
      GROUP BY lane;
    `,
  );
  return Object.fromEntries(rows.map((row) => [row.lane, Number(row.count)]));
}

function selectCandidates(lane, limit) {
  return queryJson(
    db,
    `
      SELECT *
      FROM target_pool
      WHERE lane = ${sqlString(lane)}
        AND status = 'candidate'
      ORDER BY
        lower(email),
        lower(domain),
        lower(contact_name),
        id
      LIMIT ${Number(limit)};
    `,
  );
}

function hydrateTarget(row) {
  const email = normalizeEmail(row.email);
  const domain = normalizeDomain(row.domain) || normalizeDomain(email);
  const orgName = String(row.organization_name || domain || "Unknown organization").trim();
  const orgId = domain ? `org_${slugify(domain)}` : hashId("org", [orgName]);
  const contactName = String(row.contact_name || email || orgName).trim();
  const contactId = email ? `contact_${slugify(email)}` : hashId("contact", [contactName, orgId]);
  const targetId = hashId("target", [campaignId, contactId, orgId]);
  const queueId = hashId("queue", [sendDate, row.lane, campaignId, targetId]);
  const idempotencyKey = hashId("idempotency", ["outreach_queue", sendDate, row.lane, targetId]);

  return {
    ...row,
    email,
    domain,
    orgName,
    orgId,
    contactName,
    contactId,
    targetId,
    queueId,
    idempotencyKey,
  };
}

function upsertSelectedTargets(targets) {
  const sql = ["BEGIN;"];
  sql.push(`
    INSERT INTO campaigns (id, name, target_send_date, campaign_type, updated_at)
    VALUES (${sqlString(campaignId)}, ${sqlString(campaignName)}, ${sqlString(sendDate)}, 'autonomous_outreach', CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      target_send_date = excluded.target_send_date,
      campaign_type = excluded.campaign_type,
      updated_at = CURRENT_TIMESTAMP;
  `);

  for (const target of targets) {
    sql.push(`
      INSERT INTO organizations (id, name, domain, updated_at)
      VALUES (${sqlString(target.orgId)}, ${sqlString(target.orgName)}, ${sqlString(target.domain)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN organizations.name = '' OR organizations.name = 'Unknown organization' THEN excluded.name ELSE organizations.name END,
        domain = CASE WHEN organizations.domain = '' THEN excluded.domain ELSE organizations.domain END,
        updated_at = CURRENT_TIMESTAMP;
    `);

    sql.push(`
      INSERT INTO contacts (id, name, email, organization_id, domain, category, updated_at)
      VALUES (${sqlString(target.contactId)}, ${sqlString(target.contactName)}, ${sqlString(target.email)}, ${sqlString(target.orgId)}, ${sqlString(target.domain)}, ${sqlString(target.category)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN contacts.name = '' THEN excluded.name ELSE contacts.name END,
        email = CASE WHEN contacts.email = '' THEN excluded.email ELSE contacts.email END,
        organization_id = CASE WHEN contacts.organization_id = '' THEN excluded.organization_id ELSE contacts.organization_id END,
        domain = CASE WHEN contacts.domain = '' THEN excluded.domain ELSE contacts.domain END,
        category = CASE WHEN contacts.category = '' THEN excluded.category ELSE contacts.category END,
        updated_at = CURRENT_TIMESTAMP;
    `);

    sql.push(`
      INSERT INTO campaign_targets (
        id,
        campaign_id,
        contact_id,
        organization_id,
        intended_ask,
        template_type,
        approval_status,
        draft_status,
        scheduled_date,
        preflight_run_id,
        updated_at
      )
      VALUES (
        ${sqlString(target.targetId)},
        ${sqlString(campaignId)},
        ${sqlString(target.contactId)},
        ${sqlString(target.orgId)},
        ${sqlString(intendedAsk(target))},
        ${sqlString(templateType(target))},
        'needs_preflight',
        'not_drafted',
        ${sqlString(sendDate)},
        NULL,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        campaign_id = excluded.campaign_id,
        contact_id = excluded.contact_id,
        organization_id = excluded.organization_id,
        intended_ask = excluded.intended_ask,
        template_type = excluded.template_type,
        approval_status = CASE
          WHEN campaign_targets.approval_status = 'approved_for_draft' THEN campaign_targets.approval_status
          ELSE 'needs_preflight'
        END,
        draft_status = excluded.draft_status,
        scheduled_date = excluded.scheduled_date,
        preflight_run_id = CASE
          WHEN campaign_targets.approval_status = 'approved_for_draft' THEN campaign_targets.preflight_run_id
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP;
    `);
  }

  sql.push("COMMIT;");
  runSql(db, sql.join("\n"));
}

function runDuplicateGuard() {
  execFileSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/cel-outreach-control/run-duplicate-guard.mjs"),
      "--db",
      db,
      "--checklist",
      checklistPath,
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    },
  );
}

function queueApprovedTargets(targets) {
  const targetIds = targets.map((target) => target.targetId);
  const statuses = activeQueueStatuses.map(sqlString).join(", ");
  const rows = queryJson(
    db,
    `
      SELECT
        target.id,
        target.approval_status,
        target.preflight_run_id,
        queue.id AS existing_queue_id
      FROM campaign_targets target
      LEFT JOIN outreach_queue queue
        ON queue.target_id = target.id
       AND queue.status IN (${statuses})
      WHERE target.id IN (${targetIds.map(sqlString).join(", ")});
    `,
  );
  const rowsByTargetId = new Map(rows.map((row) => [row.id, row]));
  const sql = ["BEGIN;"];

  for (const target of targets) {
    const row = rowsByTargetId.get(target.targetId);
    if (row?.approval_status === "approved_for_draft" && row.existing_queue_id) {
      sql.push(`
        UPDATE target_pool
        SET status = 'imported', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(target.id)};
      `);
    } else if (row?.approval_status === "approved_for_draft") {
      sql.push(`
        INSERT INTO outreach_queue (
          id,
          campaign_id,
          target_id,
          lane,
          send_date,
          send_window_start,
          send_window_end,
          timezone,
          status,
          gmail_label,
          idempotency_key,
          last_preflight_run_id,
          updated_at
        )
        VALUES (
          ${sqlString(target.queueId)},
          ${sqlString(campaignId)},
          ${sqlString(target.targetId)},
          ${sqlString(target.lane)},
          ${sqlString(sendDate)},
          ${sqlString(sendWindowStart)},
          ${sqlString(sendWindowEnd)},
          ${sqlString(timezone)},
          'planned',
          ${sqlString(`CEL/Outreach/${sendDate}`)},
          ${sqlString(target.idempotencyKey)},
          ${sqlString(row.preflight_run_id)},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          campaign_id = excluded.campaign_id,
          target_id = excluded.target_id,
          lane = excluded.lane,
          send_date = excluded.send_date,
          send_window_start = excluded.send_window_start,
          send_window_end = excluded.send_window_end,
          timezone = excluded.timezone,
          gmail_label = excluded.gmail_label,
          idempotency_key = excluded.idempotency_key,
          last_preflight_run_id = excluded.last_preflight_run_id,
          updated_at = CURRENT_TIMESTAMP;
      `);
      sql.push(`
        UPDATE target_pool
        SET status = 'imported', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(target.id)};
      `);
    } else {
      sql.push(`
        UPDATE target_pool
        SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(target.id)};
      `);
    }
  }

  sql.push("COMMIT;");
  runSql(db, sql.join("\n"));
}

function insertAutomationRun(id, result, summary) {
  runSql(
    db,
    `
      INSERT INTO automation_runs (id, run_type, result, summary)
      VALUES (${sqlString(id)}, 'fill_queue', ${sqlString(result)}, ${sqlString(summary)});
    `,
  );
}

function finishAutomationRun(id, counts) {
  const result = counts.error > 0 ? "error" : "ok";
  const summary = `Selected ${selected.length}; queued ${counts.queued}; blocked ${counts.blocked}.`;
  runSql(
    db,
    `
      UPDATE automation_runs
      SET
        finished_at = CURRENT_TIMESTAMP,
        result = ${sqlString(result)},
        summary = ${sqlString(summary)},
        created_count = ${Number(counts.queued)},
        blocked_count = ${Number(counts.blocked)},
        error_count = ${Number(counts.error)}
      WHERE id = ${sqlString(id)};
    `,
  );
}

function summarizeRun() {
  if (selected.length === 0) return { queued: 0, blocked: 0, error: 0 };
  const selectedPoolIds = selected.map((row) => row.id);
  const rows = queryJson(
    db,
    `
      SELECT status, count(*) AS count
      FROM target_pool
      WHERE id IN (${selectedPoolIds.map(sqlString).join(", ")})
      GROUP BY status;
    `,
  );
  const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  return {
    queued: counts.imported || 0,
    blocked: counts.blocked || 0,
    error: 0,
  };
}

function intendedAsk(target) {
  if (target.lane === "protocol") {
    return `protocol outreach: ${target.fit_notes || target.category || target.source || target.domain}`;
  }
  return `usage outreach: ${target.fit_notes || target.category || target.source || target.domain}`;
}

function templateType(target) {
  return target.lane === "protocol" ? "protocol" : "usage";
}
