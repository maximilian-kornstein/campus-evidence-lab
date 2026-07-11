import { createHash } from "node:crypto";
import { SIGNAL_POLICY_VERSION } from "./core.mjs";

const LIMIT = "These are reported public-documentation statistics from certified Department of Education workbook cells, not a prevalence estimate, incident census, school ranking, safety score, or finding by CEL.";

function id(prefix, parts) {
  return `${prefix}_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20)}`;
}

function count(locator) {
  const value = Number(locator?.cell_value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function geography(event) {
  const tags = event.tags ?? [];
  if (tags.includes("on-campus")) return "on-campus";
  if (tags.includes("noncampus")) return "noncampus";
  if (tags.includes("public-property")) return "public-property";
  if (tags.includes("residence-hall")) return "residence-hall";
  return "other reported geography";
}

function summarize(rows, selector) {
  const totals = new Map();
  for (const row of rows) {
    for (const key of selector(row)) totals.set(key, (totals.get(key) ?? 0) + row.value);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function list(entries, max = 4) {
  return entries.slice(0, max).map(([label, value]) => `${label} (${value})`).join(", ");
}

function copy(schoolName, body, url) {
  const prefix = `ED data context: ${schoolName}. `;
  const suffix = ` Certified cells, limits, and corrections: ${url}`;
  const room = Math.max(0, 300 - prefix.length - suffix.length);
  const clipped = body.length <= room ? body : `${body.slice(0, Math.max(0, room - 1)).trim()}…`;
  return `${prefix}${clipped}${suffix}`;
}

export function institutionHoldout(schoolId, percent = 20) {
  const bucket = Number.parseInt(createHash("sha256").update(`institution|${schoolId}`).digest("hex").slice(0, 8), 16) % 100;
  return bucket < percent ? "passive_holdout" : "active_distribution";
}

export function buildCertifiedDossiers({ events, schools, sources, certificationRows, siteUrl = "https://campusevidencelab.org", generatedAt = new Date().toISOString(), minimumCells = 4 }) {
  const eventById = new Map(events.map((row) => [row.id, row]));
  const schoolById = new Map(schools.map((row) => [row.id, row]));
  const sourceById = new Map(sources.map((row) => [row.id, row]));
  const grouped = new Map();

  for (const certification of certificationRows) {
    if (certification.certification_status !== "certified" || certification.source_family !== "ed_campus_safety_dataset") continue;
    if ((certification.open_gates ?? []).length || !certification.source_locator?.cell) continue;
    if (Object.values(certification.gates ?? {}).some((gate) => gate.status !== "pass")) continue;
    const event = eventById.get(certification.event_id);
    const value = count(certification.source_locator);
    if (!event || value === null) continue;
    const key = `${certification.source_locator.workbook}|${certification.source_locator.sheet}|${certification.source_locator.cell}`;
    const bucket = grouped.get(event.school_id) ?? new Map();
    bucket.set(key, { event, certification, value, locator_key: key });
    grouped.set(event.school_id, bucket);
  }

  const signals = [];
  const dossiers = [];
  for (const [schoolId, cellMap] of grouped) {
    const rows = [...cellMap.values()];
    if (rows.length < minimumCells) continue;
    const school = schoolById.get(schoolId);
    if (!school) continue;
    const years = summarize(rows, (row) => [row.event.date.slice(0, 4)]);
    const latestYear = years.map(([year]) => year).sort().at(-1);
    const latestRows = rows.filter((row) => row.event.date.startsWith(latestYear));
    const categories = summarize(rows, (row) => [row.event.category]);
    const communities = summarize(rows, (row) => row.event.affected_communities ?? []);
    const geographies = summarize(rows, (row) => [geography(row.event)]);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const sourceIds = [...new Set(rows.flatMap((row) => row.event.source_ids ?? []))];
    const sourceRows = sourceIds.map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
    const evidence = rows.map((row) => ({ event_id: row.event.id, record_hash: row.event.record_hash, workbook: row.certification.source_locator.workbook, sheet: row.certification.source_locator.sheet, cell: row.certification.source_locator.cell, column: row.certification.source_locator.column, year: row.event.date.slice(0, 4), value: row.value }));
    const angles = [
      { type: "latest_year", title: `${latestYear} certified-cell context`, body: `Certified ED workbook cells document ${latestRows.reduce((sum, row) => sum + row.value, 0)} reported statistic${latestRows.reduce((sum, row) => sum + row.value, 0) === 1 ? "" : "s"} across ${latestRows.length} distinct cell${latestRows.length === 1 ? "" : "s"} for ${latestYear}.` },
      { type: "category_composition", title: "Source-supported category context", body: `Across ${rows.length} certified ED cells, the documented category totals are ${list(categories)}.` },
      { type: "community_labels", title: "Source-supported community-label context", body: `Across ${rows.length} certified ED cells, the source-supported affected-community totals are ${list(communities)}.` },
      { type: "geography", title: "Documented geography context", body: `Across ${rows.length} certified ED cells, the reported geography totals are ${list(geographies)}.` },
    ];
    const dossierId = id("dos", [schoolId, ...evidence.map((row) => `${row.workbook}:${row.cell}:${row.value}`).sort()]);
    dossiers.push({ id: dossierId, institution: { id: school.id, name: school.name, city: school.city ?? "", state: school.state ?? "" }, certified_cell_count: rows.length, reported_statistic_total: total, years: years.map(([year]) => year).sort(), calculation_evidence: evidence, source_ids: sourceIds });

    for (const angle of angles) {
      const signalId = id("sig", [dossierId, angle.type, SIGNAL_POLICY_VERSION]);
      const canonicalUrl = `${siteUrl.replace(/\/$/, "")}/signals/${signalId}/`;
      const claim = `${school.name}: ${angle.body}`;
      signals.push({
        id: signalId,
        signal_type: "dataset_context",
        dossier_id: dossierId,
        dossier_angle: angle.type,
        status: "shadow",
        policy_version: SIGNAL_POLICY_VERSION,
        trigger: { id: id("trg", [dossierId, angle.type]), title: angle.title, url: `${siteUrl.replace(/\/$/, "")}/schools/${schoolId}/`, published_at: generatedAt.slice(0, 10), detected_at: generatedAt, institution_ids: [schoolId], topics: ["ed-campus-safety-data", "public-documentation"], source_kind: "certified_dataset_context", summary: angle.body },
        institution: { id: school.id, name: school.name, city: school.city ?? "", state: school.state ?? "" },
        record_ids: rows.map((row) => row.event.id),
        bounded_claims: [{ text: claim, supporting_record_ids: rows.map((row) => row.event.id), supporting_source_ids: sourceIds }],
        unknowns: ["These workbook cells do not establish the underlying number of incidents, experiences, reports to other offices, or institutional response outcomes."],
        sources: sourceRows.map((source) => ({ id: source.id, title: source.title, url: source.url, publisher: source.publisher, source_type: source.source_type })),
        institutional_response: { status: "not_applicable_to_dataset_context", text: "This Signal summarizes certified government workbook cells and does not characterize institutional response.", date: "" },
        calculation: { operation: "sum_distinct_certified_cells", reported_statistic_total: total, certified_cell_count: rows.length, evidence },
        claim_limit: LIMIT,
        correction_url: `${siteUrl.replace(/\/$/, "")}/submit/?school_id=${encodeURIComponent(schoolId)}&signal_id=${encodeURIComponent(signalId)}`,
        canonical_url: canonicalUrl,
        distribution_copy: { bluesky_original: copy(school.name, angle.body, canonicalUrl), proactive_reply: `Relevant certified public-data context for ${school.name}: ${canonicalUrl}` },
        distribution_group: institutionHoldout(schoolId),
        created_at: generatedAt,
        updated_at: generatedAt,
        correction_status: "none",
      });
    }
  }
  return { signals, dossiers };
}
