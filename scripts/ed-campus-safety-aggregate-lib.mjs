import { sha256 } from "./lib.mjs";

export const ED_CAMPUS_SAFETY_MANIFEST_ID = "manifest_ed_campus_safety_dataset";
export const ED_CAMPUS_SAFETY_SOURCE_FAMILY = "ed_campus_safety_dataset";
export const ED_CAMPUS_SAFETY_2025_ZIP_URL = "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip";

const VAWA_STATISTICS = {
  DOMEST: "Domestic violence",
  DATING: "Dating violence",
  STALK: "Stalking"
};

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function schoolLookup(schools = []) {
  return new Map(schools.map((school) => [school.id, school]));
}

function scopeForWorkbook(workbookName) {
  const name = workbookName.toLowerCase();
  if (name.startsWith("oncampus")) return "on-campus";
  if (name.startsWith("noncampus")) return "noncampus";
  if (name.startsWith("publicproperty")) return "public-property";
  if (name.startsWith("residencehall")) return "residence-hall";
  if (name.startsWith("reported")) return "reported";
  return "unknown";
}

function pluralizeStatistic(count) {
  return count === 1 ? "VAWA aggregate statistic" : "VAWA aggregate statistics";
}

export function columnLetter(index) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

export function edCampusSafetyAggregateRowsFromSheet({ workbookName, sheetRows = [] } = {}) {
  const headers = (sheetRows[0] ?? []).map((header) => normalizeSpace(header));
  const sourceRows = [];
  const scope = scopeForWorkbook(workbookName);

  for (const [rowIndex, row] of sheetRows.slice(1).entries()) {
    const rowNumber = rowIndex + 2;
    const institutionName = normalizeSpace(row[headers.indexOf("INSTNM")]);
    const city = normalizeSpace(row[headers.indexOf("City")]);
    const state = normalizeSpace(row[headers.indexOf("State")]);
    if (!institutionName || !city || !state) continue;

    for (const [columnIndex, header] of headers.entries()) {
      const match = header.match(/^(DOMEST|DATING|STALK)(\d{2})$/);
      if (!match) continue;

      const count = Number(row[columnIndex] || 0);
      if (!Number.isFinite(count) || count <= 0) continue;

      const column = columnLetter(columnIndex);
      sourceRows.push({
        workbook: workbookName,
        sheet: workbookName.replace(/\.[^.]+$/, ""),
        row_number: rowNumber,
        column,
        cell: `${column}${rowNumber}`,
        unitid: normalizeSpace(row[headers.indexOf("UNITID_P")]),
        institution_name: institutionName,
        school_id: slugify(institutionName),
        branch: normalizeSpace(row[headers.indexOf("BRANCH")]),
        address: normalizeSpace(row[headers.indexOf("Address")]),
        city,
        state,
        zip: normalizeSpace(row[headers.indexOf("ZIP")]),
        scope,
        code: header,
        statistic: VAWA_STATISTICS[match[1]],
        year: `20${match[2]}`,
        count
      });
    }
  }

  return sourceRows;
}

function sourceLocatorForRow(row) {
  return [
    `${row.workbook} > ${row.sheet}`,
    `row ${row.row_number}`,
    `column ${row.code}`,
    `cell ${row.cell}`,
    `institution=${row.institution_name}`,
    `scope=${row.scope}`,
    `year=${row.year}`,
    `statistic=${row.statistic}`
  ].join(" > ");
}

function candidateIdForRow(row) {
  const hash = sha256({
    workbook: row.workbook,
    unitid: row.unitid,
    school_id: row.school_id,
    year: row.year,
    code: row.code,
    scope: row.scope,
    cell: row.cell
  });
  return `cand_ed_vawa_${hash.slice("sha256:".length, "sha256:".length + 18)}`;
}

function candidateForRow({ row, school, waveId }) {
  const countText = `${row.count} reported ${row.scope} ${pluralizeStatistic(row.count)}`;
  const sourceLocator = sourceLocatorForRow(row);
  return {
    candidate_id: candidateIdForRow(row),
    wave_id: waveId,
    manifest_id: ED_CAMPUS_SAFETY_MANIFEST_ID,
    source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    source_locator: sourceLocator,
    school_id: school.id,
    institution_name: school.name,
    date: `${row.year}-01-01`,
    date_precision: "year",
    category: "Other source-backed civil rights event",
    affected_communities: ["Gender"],
    summary: `ED Campus Safety data listed ${countText} for ${row.institution_name} in ${row.year}: ${row.statistic}.`,
    raw_source_hash: sha256({ row, source_locator: sourceLocator }),
    import_notes:
      "Imported from official ED Campus Safety and Security aggregate VAWA data. " +
      "This source row is an aggregate public statistic and does not create a legal finding, school ranking, prevalence estimate, safety score, or severity score."
  };
}

function mappingQuarantineRow(row) {
  return {
    candidate_id: candidateIdForRow(row),
    source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    source_locator: sourceLocatorForRow(row),
    raw_hash: sha256({ row }),
    reason_codes: ["unknown_school"],
    failed_gates: ["unknown_school"],
    remediation_action: "Resolve institution identity to a known school record before publication.",
    row: {
      institution_name: row.institution_name,
      city: row.city,
      state: row.state,
      unitid: row.unitid,
      workbook: row.workbook,
      code: row.code,
      year: row.year,
      scope: row.scope
    }
  };
}

export function buildEdCampusSafetyAggregateCandidates({
  waveId,
  sourceRows = [],
  schools = [],
  limit = Number.POSITIVE_INFINITY,
  offset = 0,
  usedCandidateIds = new Set()
} = {}) {
  const schoolsById = schoolLookup(schools);
  const candidates = [];
  const mappingQuarantine = [];
  let acceptedSeen = 0;

  for (const row of sourceRows) {
    const school = schoolsById.get(row.school_id);
    if (!school) {
      mappingQuarantine.push(mappingQuarantineRow(row));
      continue;
    }

    const candidateId = candidateIdForRow(row);
    if (usedCandidateIds.has(candidateId)) continue;
    if (acceptedSeen < offset) {
      acceptedSeen += 1;
      continue;
    }
    if (candidates.length >= limit) continue;

    candidates.push(candidateForRow({ row, school, waveId }));
    acceptedSeen += 1;
  }

  return {
    candidates,
    mappingQuarantine,
    totals: {
      source_rows: sourceRows.length,
      known_school_rows: acceptedSeen + candidates.length,
      mapping_quarantine: mappingQuarantine.length,
      exported: candidates.length
    }
  };
}
