#!/usr/bin/env node
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
  csv: path.join(repoRoot, "outreach/control/imports/campaign-targets.csv"),
});

const db = path.resolve(repoRoot, args.db);
const csvPath = path.resolve(repoRoot, args.csv);
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

const sql = ["BEGIN;"];

for (const row of rows) {
  const campaignId = String(row.campaign_id || hashId("campaign", [row.campaign_name, row.target_send_date])).trim();
  const campaignName = String(row.campaign_name || campaignId).trim();
  const campaignType = String(row.campaign_type || "").trim();
  const targetSendDate = String(row.target_send_date || "").trim();
  const email = normalizeEmail(row.email);
  const domain = normalizeDomain(row.domain) || domainFrom(row.organization, email);
  const orgName = String(row.organization || domain || "Unknown organization").trim();
  const orgId = domain ? `org_${slugify(domain)}` : hashId("org", [orgName]);
  const contactName = String(row.contact_name || email || orgName).trim();
  const contactId = email ? `contact_${slugify(email)}` : hashId("contact", [contactName, orgId]);
  const targetId = String(row.target_id || hashId("target", [campaignId, contactId, orgId])).trim();

  sql.push(`
    INSERT INTO campaigns (id, name, target_send_date, campaign_type, updated_at)
    VALUES (${sqlString(campaignId)}, ${sqlString(campaignName)}, ${sqlString(targetSendDate)}, ${sqlString(campaignType)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      target_send_date = excluded.target_send_date,
      campaign_type = excluded.campaign_type,
      updated_at = CURRENT_TIMESTAMP;
  `);

  sql.push(`
    INSERT INTO organizations (id, name, domain, updated_at)
    VALUES (${sqlString(orgId)}, ${sqlString(orgName)}, ${sqlString(domain)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = CASE WHEN organizations.name = '' OR organizations.name = 'Unknown organization' THEN excluded.name ELSE organizations.name END,
      domain = CASE WHEN organizations.domain = '' THEN excluded.domain ELSE organizations.domain END,
      updated_at = CURRENT_TIMESTAMP;
  `);

  sql.push(`
    INSERT INTO contacts (id, name, email, organization_id, domain, updated_at)
    VALUES (${sqlString(contactId)}, ${sqlString(contactName)}, ${sqlString(email)}, ${sqlString(orgId)}, ${sqlString(domain)}, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = CASE WHEN contacts.name = '' THEN excluded.name ELSE contacts.name END,
      email = CASE WHEN contacts.email = '' THEN excluded.email ELSE contacts.email END,
      organization_id = CASE WHEN contacts.organization_id = '' THEN excluded.organization_id ELSE contacts.organization_id END,
      domain = CASE WHEN contacts.domain = '' THEN excluded.domain ELSE contacts.domain END,
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
      updated_at
    )
    VALUES (
      ${sqlString(targetId)},
      ${sqlString(campaignId)},
      ${sqlString(contactId)},
      ${sqlString(orgId)},
      ${sqlString(row.intended_ask || "")},
      ${sqlString(row.template_type || "")},
      'needs_preflight',
      ${sqlString(row.draft_status || "not_drafted")},
      ${sqlString(row.scheduled_date || "")},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      campaign_id = excluded.campaign_id,
      contact_id = excluded.contact_id,
      organization_id = excluded.organization_id,
      intended_ask = excluded.intended_ask,
      template_type = excluded.template_type,
      approval_status = 'needs_preflight',
      draft_status = excluded.draft_status,
      scheduled_date = excluded.scheduled_date,
      preflight_run_id = '',
      updated_at = CURRENT_TIMESTAMP;
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, csvPath, importedRows: rows.length }, null, 2));

function domainFrom(organization, email) {
  return normalizeDomain(email) || normalizeDomain(organization);
}
