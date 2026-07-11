import path from "node:path";
import { parseArgs, queryJson } from "../cel-outreach-control/lib.mjs";
import { rootDir, writeJson } from "../lib.mjs";

const args = parseArgs(process.argv.slice(2), { db: path.join(rootDir, "outreach", "control", "cel-outreach.sqlite"), output: path.join(rootDir, "outreach", "control", "signals-partners.json") });
const rows = queryJson(args.db, `SELECT ct.id,c.id contact_id,c.name contact_name,c.email,o.id organization_id,o.name organization_name
  FROM campaign_targets ct JOIN contacts c ON c.id=ct.contact_id JOIN organizations o ON o.id=ct.organization_id
  WHERE ct.approval_status='approved_for_draft' AND ct.template_type='signals_partner' AND c.email!=''
  AND NOT EXISTS (SELECT 1 FROM signals_partner_events e WHERE e.campaign_target_id=ct.id AND e.event_type IN ('invited','followed_up','subscribed','embedded','webhook_enabled','declined','opted_out','cancelled'))`);
const partners = rows.map((row) => ({ id: `partner_${row.id}`, organization_id: row.organization_id, contact_email: row.email, contact_name: row.contact_name, organization_name: row.organization_name, feed_url: "https://campusevidencelab.org/signals/feeds/all.xml" }));
await writeJson(args.output, { generated_at: new Date().toISOString(), partners });
console.log(`Exported ${partners.length} duplicate-cleared Signals partner target(s).`);
