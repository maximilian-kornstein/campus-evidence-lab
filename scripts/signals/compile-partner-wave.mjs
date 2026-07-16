import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir, writeJson } from "../lib.mjs";

const input = process.argv[2] || "outreach/control/imports/signals-partners-wave-001.csv";
const output = process.argv[3] || "outreach/control/signals-partners.json";
const lines = (await readFile(path.join(rootDir, input), "utf8")).trim().split(/\r?\n/);
const headers = lines.shift().split(",");
const expectedHeaders = ["priority", "organization_name", "contact_name", "email", "domain", "partner_kind", "source_url", "rationale", "feed_url"];
if (headers.join(",") !== expectedHeaders.join(",")) throw new Error(`Unexpected partner CSV headers: ${headers.join(",")}`);
const rows = lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value.trim()])));
const seenEmails = new Set();
const seenDomains = new Set();
const partners = rows.map((row) => {
  const email = row.email.toLowerCase();
  const domain = row.domain.toLowerCase();
  const priority = Number(row.priority);
  if (expectedHeaders.some((field) => !row[field])) throw new Error(`Partner row has a blank required field: ${row.organization_name || email}`);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(`Invalid partner email: ${row.email}`);
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) throw new Error(`Invalid partner priority: ${row.priority}`);
  if (!new URL(row.source_url).protocol.startsWith("https")) throw new Error(`Partner source must use HTTPS: ${row.source_url}`);
  const feedUrl = new URL(row.feed_url);
  if (feedUrl.protocol !== "https:" || feedUrl.hostname !== "campusevidencelab.org") throw new Error(`Partner feed must use the CEL public domain: ${row.feed_url}`);
  if (seenEmails.has(email) || seenDomains.has(domain)) throw new Error(`Duplicate partner identity: ${email} / ${domain}`);
  seenEmails.add(email);
  seenDomains.add(domain);
  return {
    id: `partner_${crypto.createHash("sha256").update(email).digest("hex").slice(0, 20)}`,
    organization_id: `org_${crypto.createHash("sha256").update(row.domain).digest("hex").slice(0, 16)}`,
    contact_email: email,
    contact_name: row.contact_name,
    organization_name: row.organization_name,
    partner_kind: row.partner_kind,
    priority,
    source_url: row.source_url,
    rationale: row.rationale,
    feed_url: row.feed_url,
  };
});
partners.sort((a, b) => a.priority - b.priority || a.organization_name.localeCompare(b.organization_name));
await writeJson(path.join(rootDir, output), { generated_at: new Date().toISOString(), source: input, partners });
console.log(`Compiled ${partners.length} unique Signals partner targets.`);
