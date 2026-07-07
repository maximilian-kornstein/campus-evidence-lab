import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  hashId,
  parseArgs,
  queryJson,
  repoRoot,
  runSql,
  sqlString,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), {
  db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite"),
  checklist: path.join(repoRoot, "outreach/outreach-preflight-checklist.md"),
});

const db = path.resolve(repoRoot, args.db);
const checklistPath = path.resolve(repoRoot, args.checklist);
const checklistBody = fs.readFileSync(checklistPath, "utf8");
const checklistSha = crypto.createHash("sha256").update(checklistBody).digest("hex");
const maxSnapshotAgeHours = Number(args["max-snapshot-age-hours"] || 0);
const now = args.now ? new Date(args.now) : new Date();

const targets = queryJson(
  db,
  `
    SELECT
      ct.id,
      ct.campaign_id,
      ct.contact_id,
      ct.organization_id,
      c.email,
      c.domain AS contact_domain,
      c.name AS contact_name,
      o.domain AS org_domain,
      o.name AS org_name,
      o.relationship_status AS org_relationship_status,
      o.block_level AS org_block_level
    FROM campaign_targets ct
    LEFT JOIN contacts c ON c.id = ct.contact_id
    LEFT JOIN organizations o ON o.id = ct.organization_id
    ORDER BY ct.id;
  `,
);

const sql = ["BEGIN;", "DELETE FROM duplicate_flags;"];
const snapshotFlags = buildSnapshotFlags();

for (const target of targets) {
  const flags = snapshotFlags.map((flag) => ({ ...flag }));
  const email = target.email || "";
  const domain = target.contact_domain || target.org_domain || "";

  const sentItems = email
    ? queryJson(
        db,
        `
          SELECT id, subject, email_ts FROM gmail_items
          WHERE is_cel = 1
            AND item_type = 'sent'
            AND to_emails LIKE ${sqlString(`%${email}%`)}
          ORDER BY email_ts DESC, id;
        `,
      )
    : [];

  for (const item of sentItems) {
    flags.push({
      flagType: "exact_email_sent",
      severity: "hard_block",
      evidenceItemId: item.id,
      evidenceSummary: `CEL sent mail already exists for ${email}: ${item.subject || item.id}`,
    });
  }

  const draftItems = email
    ? queryJson(
        db,
        `
          SELECT id, subject, email_ts FROM gmail_items
          WHERE is_cel = 1
            AND item_type = 'draft'
            AND to_emails LIKE ${sqlString(`%${email}%`)}
          ORDER BY email_ts DESC, id;
        `,
      )
    : [];

  for (const item of draftItems) {
    flags.push({
      flagType: "exact_email_existing_draft",
      severity: "hard_block",
      evidenceItemId: item.id,
      evidenceSummary: `CEL draft already exists for ${email}: ${item.subject || item.id}`,
    });
  }

  const futureItems = queryJson(
    db,
    `
      SELECT id, subject, email_ts FROM gmail_items
      WHERE is_cel = 1
        AND is_future_or_scheduled = 1
        AND (
          to_emails LIKE ${sqlString(email ? `%${email}%` : "__no_email__")}
          OR domain_key = ${sqlString(domain)}
          OR organization_key = ${sqlString(domain)}
        )
      ORDER BY email_ts DESC, id;
    `,
  );

  for (const item of futureItems) {
    flags.push({
      flagType: "future_or_scheduled_conflict",
      severity: "hard_block",
      evidenceItemId: item.id,
      evidenceSummary: `Scheduled/future-looking CEL item conflicts with ${email || domain}: ${item.subject || item.id}`,
    });
  }

  if (isWarmOrBlocked(target.org_relationship_status, target.org_block_level)) {
    flags.push({
      flagType: "warm_org_conflict",
      severity: "hard_block",
      evidenceItemId: target.organization_id,
      evidenceSummary: `${target.org_name || target.organization_id} is ${target.org_relationship_status || "relationship-tracked"} (${target.org_block_level || "review required"})`,
    });
  }

  for (const flag of flags) {
    const flagId = hashId("flag", [
      target.id,
      flag.flagType,
      flag.evidenceItemId,
      flag.evidenceSummary,
    ]);
    sql.push(`
      INSERT INTO duplicate_flags (id, target_id, contact_id, organization_id, flag_type, severity, evidence_item_id, evidence_summary)
      VALUES (${sqlString(flagId)}, ${sqlString(target.id)}, ${sqlString(target.contact_id)}, ${sqlString(target.organization_id)}, ${sqlString(flag.flagType)}, ${sqlString(flag.severity)}, ${sqlString(flag.evidenceItemId)}, ${sqlString(flag.evidenceSummary)})
      ON CONFLICT(id) DO UPDATE SET
        severity = excluded.severity,
        evidence_summary = excluded.evidence_summary,
        created_at = CURRENT_TIMESTAMP;
    `);
  }

  const result = flags.some((flag) => flag.severity === "hard_block")
    ? "blocked"
    : flags.length > 0
      ? "needs_manual_review"
      : "approved";
  const preflightId = hashId("preflight", [target.id, checklistSha]);
  sql.push(`
    INSERT INTO preflight_runs (id, campaign_id, target_id, checklist_path, checklist_sha256, result, notes)
    VALUES (${sqlString(preflightId)}, ${sqlString(target.campaign_id)}, ${sqlString(target.id)}, ${sqlString(checklistPath)}, ${sqlString(checklistSha)}, ${sqlString(result)}, ${sqlString(`Duplicate guard found ${flags.length} flag(s).`)})
    ON CONFLICT(id) DO UPDATE SET
      checklist_path = excluded.checklist_path,
      checklist_sha256 = excluded.checklist_sha256,
      ran_at = CURRENT_TIMESTAMP,
      result = excluded.result,
      notes = excluded.notes;
  `);
  sql.push(`
    UPDATE campaign_targets
    SET
      approval_status = ${sqlString(result === "approved" ? "approved_for_draft" : result)},
      preflight_run_id = ${sqlString(preflightId)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(target.id)};
  `);
}

sql.push("COMMIT;");
runSql(db, sql.join("\n"));

console.log(JSON.stringify({ db, checklistPath, targets: targets.length }, null, 2));

function isWarmOrBlocked(status, blockLevel) {
  const combined = `${status || ""} ${blockLevel || ""}`.toLowerCase();
  return /packet sent|feedback received|call scheduled|routed internally|declined|redirect|hard block|no cold|do not contact|permission-limited/.test(
    combined,
  );
}

function buildSnapshotFlags() {
  if (!maxSnapshotAgeHours) return [];

  const snapshots = queryJson(
    db,
    `
      SELECT id, snapshot_at, source, item_count, label_count, imported_at
      FROM gmail_snapshot_imports
      ORDER BY imported_at DESC, snapshot_at DESC
      LIMIT 1;
    `,
  );
  const latest = snapshots[0];
  if (!latest?.snapshot_at) {
    return [
      {
        flagType: "gmail_snapshot_missing",
        severity: "hard_block",
        evidenceItemId: "gmail_snapshot",
        evidenceSummary: "No Gmail snapshot metadata is available; refresh and import Gmail state before drafting.",
      },
    ];
  }

  const snapshotDate = new Date(latest.snapshot_at);
  if (Number.isNaN(snapshotDate.getTime()) || Number.isNaN(now.getTime())) {
    return [
      {
        flagType: "gmail_snapshot_invalid",
        severity: "hard_block",
        evidenceItemId: "gmail_snapshot",
        evidenceSummary: `Gmail snapshot timestamp is invalid: ${latest.snapshot_at}`,
      },
    ];
  }

  const ageHours = (now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60);
  if (ageHours > maxSnapshotAgeHours) {
    return [
      {
        flagType: "gmail_snapshot_stale",
        severity: "hard_block",
        evidenceItemId: "gmail_snapshot",
        evidenceSummary: `Gmail snapshot is ${ageHours.toFixed(1)} hours old; refresh before drafting. Latest snapshot: ${latest.snapshot_at}`,
      },
    ];
  }

  return [];
}
