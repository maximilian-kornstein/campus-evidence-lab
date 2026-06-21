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
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  csv: path.join(repoRoot, "outreach/control/imports/target-pool.csv"),
});

const db = path.resolve(repoRoot, args.db);
const csvPath = path.resolve(repoRoot, args.csv);
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

const sql = ["BEGIN;"];
const validStatuses = new Set(["candidate", "imported", "blocked", "exhausted"]);

for (const [index, row] of rows.entries()) {
  const email = normalizeEmail(row.email);
  const domain = normalizeDomain(row.domain) || normalizeDomain(email);
  const lane = String(row.lane || "").trim().toLowerCase();
  const rawStatus = String(row.status ?? "").trim();
  const statusProvided = rawStatus !== "";
  const status = statusProvided ? rawStatus.toLowerCase() : "candidate";

  if (!["usage", "protocol"].includes(lane)) {
    throw new Error(`Invalid lane for target pool row ${index + 2}: ${lane || "(blank)"}`);
  }

  if (!validStatuses.has(status)) {
    throw new Error(`Invalid status for target pool row ${index + 2}: ${status || "(blank)"}`);
  }

  if (!email && !domain) {
    throw new Error(`Target pool row ${index + 2} requires email or domain`);
  }

  const contactName = String(row.contact_name || email || domain).trim();
  const organizationName = String(row.organization || row.organization_name || domain || "Unknown organization").trim();
  const sourceUrl = String(row.source_url || row.sourceUrl || "").trim();
  const fitNotes = String(row.fit_notes || row.fitNotes || "").trim();
  const targetPoolId = hashId("target_pool", [email || domain, email ? "" : contactName]);
  const statusUpdate = statusProvided ? "excluded.status" : "target_pool.status";
  const updateAssignments = `
      contact_name = excluded.contact_name,
      email = excluded.email,
      organization_name = excluded.organization_name,
      domain = excluded.domain,
      lane = excluded.lane,
      category = excluded.category,
      source = excluded.source,
      source_url = excluded.source_url,
      fit_notes = excluded.fit_notes,
      status = ${statusUpdate},
      updated_at = CURRENT_TIMESTAMP`;

  sql.push(`
    INSERT INTO target_pool (
      id,
      contact_name,
      email,
      organization_name,
      domain,
      lane,
      category,
      source,
      source_url,
      fit_notes,
      status,
      updated_at
    )
    VALUES (
      ${sqlString(targetPoolId)},
      ${sqlString(contactName)},
      ${sqlString(email)},
      ${sqlString(organizationName)},
      ${sqlString(domain)},
      ${sqlString(lane)},
      ${sqlString(row.category || "")},
      ${sqlString(row.source || "")},
      ${sqlString(sourceUrl)},
      ${sqlString(fitNotes)},
      ${sqlString(status)},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      ${updateAssignments}
    ON CONFLICT(email) WHERE email != '' DO UPDATE SET
      ${updateAssignments}
    ON CONFLICT(domain, contact_name) WHERE email = '' AND domain != '' AND contact_name != '' DO UPDATE SET
      ${updateAssignments};
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, csvPath, importedRows: rows.length }, null, 2));
