import fs from "node:fs";
import path from "node:path";
import {
  hashId,
  normalizeDomain,
  normalizeEmail,
  parseArgs,
  parseCsv,
  repoRoot,
  runSql,
  slugify,
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  csv: path.join(repoRoot, "outreach/relationship-ledger.csv"),
});

const db = path.resolve(repoRoot, args.db);
const csvPath = path.resolve(repoRoot, args.csv);
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

const sql = ["BEGIN;"];

for (const row of rows) {
  const email = normalizeEmail(row.email);
  const domain = normalizeDomain(row.domain) || domainFrom(row.organization, email);
  const orgName = row.organization?.trim() || domain || "Unknown organization";
  const orgId = domain ? `org_${slugify(domain)}` : hashId("org", [orgName]);
  const contactName = row.contact_name?.trim() || email || orgName;
  const contactId = email ? `contact_${slugify(email)}` : hashId("contact", [contactName, orgId]);
  const eventId = hashId("event", [contactId, orgId, row.status, row.last_meaningful_contact]);

  sql.push(`
    INSERT INTO organizations (id, name, domain, relationship_status, block_level, notes, updated_at)
    VALUES (${sqlString(orgId)}, ${sqlString(orgName)}, ${sqlString(domain)}, ${sqlString(row.status)}, ${sqlString(row.block_level)}, ${sqlString(row.notes)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      domain = excluded.domain,
      relationship_status = excluded.relationship_status,
      block_level = excluded.block_level,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP;
  `);

  sql.push(`
    INSERT INTO contacts (id, name, email, organization_id, domain, status, relationship_status, updated_at)
    VALUES (${sqlString(contactId)}, ${sqlString(contactName)}, ${sqlString(email)}, ${sqlString(orgId)}, ${sqlString(domain)}, ${sqlString(row.status)}, ${sqlString(row.status)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      organization_id = excluded.organization_id,
      domain = excluded.domain,
      status = excluded.status,
      relationship_status = excluded.relationship_status,
      updated_at = CURRENT_TIMESTAMP;
  `);

  sql.push(`
    INSERT INTO relationship_events (id, contact_id, organization_id, event_type, event_date, permission, block_level, next_action, next_action_date, notes)
    VALUES (${sqlString(eventId)}, ${sqlString(contactId)}, ${sqlString(orgId)}, ${sqlString(row.status)}, ${sqlString(row.last_meaningful_contact)}, ${sqlString(row.permission)}, ${sqlString(row.block_level)}, ${sqlString(row.next_action)}, ${sqlString(row.next_action_date)}, ${sqlString(row.notes)})
    ON CONFLICT(id) DO UPDATE SET
      event_type = excluded.event_type,
      event_date = excluded.event_date,
      permission = excluded.permission,
      block_level = excluded.block_level,
      next_action = excluded.next_action,
      next_action_date = excluded.next_action_date,
      notes = excluded.notes;
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, csvPath, importedRows: rows.length }, null, 2));

function domainFrom(organization, email) {
  return normalizeDomain(email) || normalizeDomain(organization);
}
