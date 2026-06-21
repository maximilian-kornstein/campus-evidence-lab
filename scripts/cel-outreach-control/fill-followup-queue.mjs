#!/usr/bin/env node
import path from "node:path";

import {
  hashId,
  normalizeDomain,
  normalizeEmail,
  parseArgs,
  queryJson,
  repoRoot,
  runSql,
  sqlString,
} from "./lib.mjs";

const dayMs = 24 * 60 * 60 * 1000;
const warmOrBlockedPattern =
  /packet sent|feedback received|permission[- ]limited|call scheduled|routed|declined|redirect|hard block|keep warm|org review|review required|no cold|do not contact|private only|engaged|relationship/i;

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  now: new Date().toISOString(),
  "min-age-days": "7",
  timezone: "America/New_York",
  "send-window-start": "09:00",
  "send-window-end": "10:30",
});

const db = path.resolve(repoRoot, args.db);
const nowText = requiredArg("now");
const now = parseDate(nowText, "--now");
const minAgeDays = Number(args["min-age-days"]);
if (!Number.isFinite(minAgeDays) || minAgeDays < 0) {
  throw new Error("--min-age-days must be a non-negative number");
}
const timezone = requiredArg("timezone");
const sendWindowStart = requiredArg("send-window-start");
const sendWindowEnd = requiredArg("send-window-end");

const candidates = sentCelThreads()
  .filter((item) => isOldEnough(item))
  .filter((item) => !hasLaterInboundActivity(item))
  .filter((item) => !hasWarmOrBlockedThreadSignal(item))
  .map((item) => ({
    ...item,
    contact: findContact(item),
    organization: findOrganization(item),
  }))
  .filter((item) => !hasWarmOrBlockedRelationship(item))
  .filter((item) => !hasExistingSequenceOne(item));

const sql = ["BEGIN;"];
for (const item of candidates) {
  const dueDate = formatDateInTimezone(
    new Date(
      parseDate(item.original.email_ts, `email_ts for ${item.original.id}`).getTime() +
        minAgeDays * dayMs,
    ),
    timezone,
  );
  const idempotencyKey = `followup:${item.thread_id}:1`;
  const followupId = hashId("followup", [item.thread_id, "1"]);
  sql.push(`
    INSERT OR IGNORE INTO followup_queue (
      id,
      source_thread_id,
      source_message_id,
      original_sent_message_id,
      contact_id,
      organization_id,
      sequence_no,
      due_date,
      send_window_start,
      send_window_end,
      timezone,
      status,
      idempotency_key,
      last_thread_check_at,
      updated_at
    )
    VALUES (
      ${sqlString(followupId)},
      ${sqlString(item.thread_id)},
      ${sqlString(item.id)},
      ${sqlString(item.original.id)},
      ${item.contact?.id ? sqlString(item.contact.id) : "NULL"},
      ${item.organization?.id ? sqlString(item.organization.id) : "NULL"},
      1,
      ${sqlString(dueDate)},
      ${sqlString(sendWindowStart)},
      ${sqlString(sendWindowEnd)},
      ${sqlString(timezone)},
      'candidate',
      ${sqlString(idempotencyKey)},
      ${sqlString(nowText)},
      CURRENT_TIMESTAMP
    );
  `);
}

const runId = hashId("automation_run", ["followup_scan", nowText, candidates.length]);
sql.push(`
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
    'followup_scan',
    ${sqlString(nowText)},
    ${sqlString(nowText)},
    'ok',
    ${sqlString(`Created ${candidates.length} follow-up candidate(s).`)},
    ${candidates.length},
    0,
    0,
    0
  )
  ON CONFLICT(id) DO UPDATE SET
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    result = excluded.result,
    summary = excluded.summary,
    created_count = excluded.created_count,
    sent_count = excluded.sent_count,
    blocked_count = excluded.blocked_count,
    error_count = excluded.error_count;
`);
sql.push("COMMIT;");

runSql(db, sql.join("\n"));

console.log(
  JSON.stringify(
    {
      db,
      now: nowText,
      minAgeDays,
      created: candidates.length,
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

function sentCelThreads() {
  const rows = queryJson(
    db,
    `
      SELECT *
      FROM gmail_items
      WHERE item_type = 'sent'
        AND is_cel = 1
        AND thread_id != ''
      ORDER BY thread_id, email_ts ASC, id ASC;
    `,
  );
  const byThread = new Map();
  for (const row of rows) {
    const existing = byThread.get(row.thread_id);
    if (!existing) {
      byThread.set(row.thread_id, { ...row, original: row });
      continue;
    }
    if (compareGmailItems(row, existing) > 0) {
      byThread.set(row.thread_id, { ...row, original: existing.original });
    }
  }
  return [...byThread.values()];
}

function isOldEnough(item) {
  const sentAt = parseDate(item.original.email_ts, `email_ts for ${item.original.id}`);
  return now.getTime() - sentAt.getTime() >= minAgeDays * dayMs;
}

function hasLaterInboundActivity(item) {
  const sentAt = parseDate(item.original.email_ts, `email_ts for ${item.original.id}`);
  const threadItems = queryJson(
    db,
    `
      SELECT id, item_type, labels, from_email, to_emails, email_ts
      FROM gmail_items
      WHERE thread_id = ${sqlString(item.thread_id)}
        AND id != ${sqlString(item.original.id)};
    `,
  );
  return threadItems.some((threadItem) => {
    const itemAt = maybeDate(threadItem.email_ts);
    return itemAt && itemAt.getTime() > sentAt.getTime() && isInboundActivity(threadItem);
  });
}

function compareGmailItems(left, right) {
  const leftTime = maybeDate(left.email_ts)?.getTime() ?? 0;
  const rightTime = maybeDate(right.email_ts)?.getTime() ?? 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function isInboundActivity(item) {
  const labels = parseJsonArray(item.labels).map((label) => label.toLowerCase());
  if (labels.includes("inbox")) return true;
  if (["reply", "inbound"].includes(String(item.item_type || "").toLowerCase())) return true;
  const fromEmail = normalizeEmail(item.from_email);
  const toEmails = parseJsonArray(item.to_emails).map(normalizeEmail);
  return Boolean(fromEmail && fromEmail !== "maxkornstein04@gmail.com" && toEmails.includes("maxkornstein04@gmail.com"));
}

function hasWarmOrBlockedThreadSignal(item) {
  const rows = queryJson(
    db,
    `
      SELECT subject, labels, snippet, body_excerpt
      FROM gmail_items
      WHERE thread_id = ${sqlString(item.thread_id)};
    `,
  );
  return rows.some((row) =>
    warmOrBlockedPattern.test(
      [row.subject, row.labels, row.snippet, row.body_excerpt].filter(Boolean).join(" "),
    ),
  );
}

function findContact(item) {
  const emails = recipientEmails(item);
  if (item.person_key) emails.unshift(normalizeEmail(item.person_key));
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  if (uniqueEmails.length === 0) return null;
  const rows = queryJson(
    db,
    `
      SELECT id, relationship_status
      FROM contacts
      WHERE email IN (${uniqueEmails.map(sqlString).join(", ")})
      ORDER BY email, id
      LIMIT 1;
    `,
  );
  return rows[0] || null;
}

function findOrganization(item) {
  const domains = [
    normalizeDomain(item.organization_key),
    normalizeDomain(item.domain_key),
    ...recipientEmails(item).map((email) => normalizeDomain(email)),
  ].filter(Boolean);
  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length === 0) return null;
  const rows = queryJson(
    db,
    `
      SELECT id, relationship_status, block_level
      FROM organizations
      WHERE domain IN (${uniqueDomains.map(sqlString).join(", ")})
      ORDER BY domain, id
      LIMIT 1;
    `,
  );
  return rows[0] || null;
}

function hasWarmOrBlockedRelationship(item) {
  const relationshipTexts = [
    item.contact?.relationship_status,
    item.organization?.relationship_status,
    item.organization?.block_level,
  ];
  if (relationshipTexts.some((text) => warmOrBlockedPattern.test(String(text || "")))) {
    return true;
  }
  const eventRows = queryJson(
    db,
    `
      SELECT event_type, block_level, permission, next_action, notes
      FROM relationship_events
      WHERE (${item.contact?.id ? `contact_id = ${sqlString(item.contact.id)}` : "0"})
        OR (${item.organization?.id ? `organization_id = ${sqlString(item.organization.id)}` : "0"});
    `,
  );
  return eventRows.some((row) =>
    warmOrBlockedPattern.test(
      [row.event_type, row.block_level, row.permission, row.next_action, row.notes]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

function hasExistingSequenceOne(item) {
  const rows = queryJson(
    db,
    `
      SELECT id
      FROM followup_queue
      WHERE source_thread_id = ${sqlString(item.thread_id)}
        AND sequence_no = 1
      LIMIT 1;
    `,
  );
  return rows.length > 0;
}

function recipientEmails(item) {
  return parseJsonArray(item.to_emails).map(normalizeEmail).filter(Boolean);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseDate(value, label) {
  const parsed = maybeDate(value);
  if (!parsed) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function maybeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
