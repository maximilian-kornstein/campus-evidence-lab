import fs from "node:fs";
import path from "node:path";
import {
  domainFromEmail,
  normalizeDomain,
  normalizeEmail,
  hashId,
  parseArgs,
  repoRoot,
  runSql,
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  json: path.join(repoRoot, "outreach/control/imports/current-cel-gmail-state.example.json"),
});

const db = path.resolve(repoRoot, args.db);
const jsonPath = path.resolve(repoRoot, args.json);
const input = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const items = Array.isArray(input) ? input : input.emails || input.messages || input.items || [];
const labelMap = normalizeLabelMap(input.label_map || input.labelMap || input.labels || {});
const labelSnapshot = normalizeLabelSnapshot(input.label_snapshot || input.labelSnapshot || {});
const snapshotAt = String(input.snapshot_at || input.snapshotAt || "").trim();
const source = String(input.source || "").trim();
const importId = hashId("gmail_snapshot", [jsonPath, snapshotAt, source, items.length]);

const sql = ["BEGIN;"];

sql.push(`
  INSERT INTO gmail_snapshot_imports (id, source_path, snapshot_at, source, item_count, label_count, imported_at)
  VALUES (${sqlString(importId)}, ${sqlString(jsonPath)}, ${sqlString(snapshotAt)}, ${sqlString(source)}, ${items.length}, ${Object.keys(labelSnapshot).length}, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET
    source_path = excluded.source_path,
    snapshot_at = excluded.snapshot_at,
    source = excluded.source,
    item_count = excluded.item_count,
    label_count = excluded.label_count,
    imported_at = CURRENT_TIMESTAMP;
`);

sql.push(`DELETE FROM gmail_label_counts WHERE import_id = ${sqlString(importId)};`);

for (const [labelName, messageCount] of Object.entries(labelSnapshot)) {
  const labelId = hashId("gmail_label", [importId, labelName]);
  sql.push(`
    INSERT INTO gmail_label_counts (id, import_id, label_name, message_count, imported_at)
    VALUES (${sqlString(labelId)}, ${sqlString(importId)}, ${sqlString(labelName)}, ${Number(messageCount) || 0}, CURRENT_TIMESTAMP);
  `);
}

for (const item of items) {
  const labels = normalizeLabels(item.labels, labelMap);
  const fromEmail = normalizeEmail(item.from_ || item.from || "");
  const toEmails = normalizeToEmails(item.to || item.to_emails || []);
  const itemType = inferItemType(labels, fromEmail, toEmails);
  const text = [
    item.subject,
    item.snippet,
    item.body,
    item.body_excerpt,
    labels.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const isCel = hasCelSignal(text, labels);
  const isFutureOrScheduled = hasFutureSignal(text, labels);
  const domainKey = inferDomainKey(itemType, fromEmail, toEmails, item.domain_key);
  const personKey = inferPersonKey(item, fromEmail, toEmails);
  const organizationKey = normalizeDomain(item.organization_key || domainKey);
  const id = item.id || item.message_id;
  if (!id) {
    throw new Error(`Gmail item is missing id/message_id: ${JSON.stringify(item)}`);
  }

  sql.push(`
    INSERT INTO gmail_items (
      id,
      thread_id,
      item_type,
      subject,
      from_email,
      to_emails,
      labels,
      email_ts,
      snippet,
      body_excerpt,
      is_cel,
      is_future_or_scheduled,
      person_key,
      domain_key,
      organization_key,
      imported_at
    )
    VALUES (
      ${sqlString(id)},
      ${sqlString(item.thread_id || "")},
      ${sqlString(itemType)},
      ${sqlString(item.subject || "")},
      ${sqlString(fromEmail)},
      ${sqlString(JSON.stringify(toEmails))},
      ${sqlString(JSON.stringify(labels))},
      ${sqlString(item.email_ts || item.date || "")},
      ${sqlString(item.snippet || "")},
      ${sqlString(String(item.body_excerpt || item.body || "").slice(0, 500))},
      ${isCel ? 1 : 0},
      ${isFutureOrScheduled ? 1 : 0},
      ${sqlString(personKey)},
      ${sqlString(domainKey)},
      ${sqlString(organizationKey)},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      thread_id = excluded.thread_id,
      item_type = excluded.item_type,
      subject = excluded.subject,
      from_email = excluded.from_email,
      to_emails = excluded.to_emails,
      labels = excluded.labels,
      email_ts = excluded.email_ts,
      snippet = excluded.snippet,
      body_excerpt = excluded.body_excerpt,
      is_cel = excluded.is_cel,
      is_future_or_scheduled = excluded.is_future_or_scheduled,
      person_key = excluded.person_key,
      domain_key = excluded.domain_key,
      organization_key = excluded.organization_key,
      imported_at = CURRENT_TIMESTAMP;
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, jsonPath, importedRows: items.length, importId }, null, 2));

function normalizeLabelMap(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((label) => label && label.id && label.name)
        .map((label) => [String(label.id), String(label.name)]),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([id, name]) => [String(id), String(name)]),
    );
  }
  return {};
}

function normalizeLabelSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([labelName, messageCount]) => [String(labelName).trim(), Number(messageCount) || 0])
      .filter(([labelName]) => labelName),
  );
}

function normalizeLabels(labels, map = {}) {
  if (!Array.isArray(labels)) return [];
  return labels.map((label) => String(map[label] || label).trim()).filter(Boolean);
}

function normalizeToEmails(value) {
  const raw = Array.isArray(value) ? value : [value];
  return raw.map((entry) => normalizeEmail(entry)).filter(Boolean);
}

function inferItemType(labels, fromEmail, toEmails) {
  if (labels.includes("DRAFT")) return "draft";
  if (labels.includes("SENT")) return "sent";
  if (labels.includes("INBOX") || (fromEmail && !toEmails.includes("maxkornstein04@gmail.com"))) {
    return "reply";
  }
  return "message";
}

function hasCelSignal(text, labels) {
  const normalized = text.toLowerCase();
  return (
    labels.some((label) => label.toLowerCase().startsWith("cel")) ||
    normalized.includes("campus evidence lab") ||
    normalized.includes("campus civil-rights") ||
    normalized.includes("public-source archive")
  );
}

function hasFutureSignal(text, labels) {
  const normalized = text.toLowerCase();
  return (
    labels.some((label) => /ready to schedule|scheduled|future|followup\/drafts|follow-up|reminder|cel\/outreach\/\d{4}-\d{2}-\d{2}/i.test(label)) ||
    /manual .*reminder|future scheduled|scheduled-looking|ready to schedule/i.test(normalized)
  );
}

function inferDomainKey(itemType, fromEmail, toEmails, explicitDomain) {
  const explicit = normalizeDomain(explicitDomain);
  if (explicit) return explicit;
  if (itemType === "reply") return domainFromEmail(fromEmail);
  return domainFromEmail(toEmails[0] || fromEmail);
}

function inferPersonKey(item, fromEmail, toEmails) {
  if (item.person_key) return String(item.person_key).toLowerCase().trim();
  if (item.contact_name) return String(item.contact_name).toLowerCase().trim();
  if (itemTypeFromItem(item) === "reply") return fromEmail;
  return toEmails[0] || fromEmail;
}

function itemTypeFromItem(item) {
  const labels = normalizeLabels(item.labels, labelMap);
  return inferItemType(labels, normalizeEmail(item.from_ || item.from || ""), normalizeToEmails(item.to || item.to_emails || []));
}
