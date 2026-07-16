import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCOPE_TAGS = new Set(["on-campus", "residence-hall", "public-property", "noncampus"]);
const DATASET_SOURCE_IDS = new Set([
  "src_ed_campus_safety_2024_hate_crime_data_files",
  "src_ed_campus_safety_2025_hate_crime_data_files"
]);

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function slugifyInstitution(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function columnTagToHeader(tag) {
  return String(tag ?? "").toUpperCase().replace(/-/g, "_");
}

export function codeTagForEvent(event) {
  return (event.tags ?? []).find((tag) => /^.+?-(rac|rel|sex|gen|gid|dis|et|nat)\d{2}$/i.test(tag)) ?? null;
}

export function scopeTagForEvent(event) {
  return (event.tags ?? []).find((tag) => SCOPE_TAGS.has(tag)) ?? null;
}

export function edWorkbookNameForEvent(event) {
  return String(event.description ?? "").match(/\b([A-Za-z]+hate\d{6}\.xlsx)\b/)?.[1] ?? null;
}

export function eventDatasetCount(event) {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`;
  if (/\bone reported\b/i.test(text)) return 1;
  const match = text.match(/\b(\d+)\s+reported\b/i);
  return match ? Number(match[1]) : null;
}

export function sourceYearForEvent(event) {
  return String(event.date ?? "").slice(0, 4);
}

function locationForEvent(event) {
  const match = String(event.location ?? "").match(/^(.+),\s*([A-Z]{2})$/);
  return match ? { city: match[1].trim().toLowerCase(), state: match[2].trim().toUpperCase() } : null;
}

export function isEdDatasetEvent(event) {
  return (event.source_ids ?? []).some((sourceId) => DATASET_SOURCE_IDS.has(sourceId));
}

function xml(filePath, entry) {
  return execFileSync("unzip", ["-p", filePath, entry], {
    encoding: "utf8",
    maxBuffer: 260 * 1024 * 1024
  });
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function sharedStrings(filePath) {
  const content = xml(filePath, "xl/sharedStrings.xml");
  return [...content.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decodeXml(match[1]));
}

function columnIndex(column) {
  let index = 0;
  for (const character of column) index = index * 26 + character.charCodeAt(0) - 64;
  return index - 1;
}

function cellColumn(cellRef) {
  return String(cellRef ?? "").match(/^([A-Z]+)/)?.[1] ?? "";
}

function normalizeValue(value) {
  const stringValue = String(value ?? "").trim();
  if (/^-?\d+(?:\.0+)?$/.test(stringValue)) return String(Number(stringValue));
  return stringValue;
}

export function parseXlsxWorkbook(filePath, workbookName = path.basename(filePath)) {
  const strings = sharedStrings(filePath);
  const sheet = xml(filePath, "xl/worksheets/sheet1.xml");
  const parsedRows = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const row = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const cellRef = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      if (!cellRef) continue;
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const value = type === "s" ? strings[Number(raw)] : decodeXml(raw);
      row[cellColumn(cellRef)] = { value: normalizeValue(value), column: cellColumn(cellRef), cell: cellRef };
    }
    parsedRows.push({ row: rowNumber, columns: row });
  }

  const headerRow = parsedRows[0];
  const headers = Object.values(headerRow?.columns ?? {}).map((cell) => ({
    value: cell.value,
    column: cell.column,
    cell: cell.cell
  }));

  const rows = parsedRows.slice(1).map((row) => {
    const cells = {};
    for (const header of headers) {
      const cell = row.columns[header.column];
      cells[header.value] = {
        value: cell?.value ?? "",
        column: header.column,
        cell: cell?.cell ?? `${header.column}${row.row}`
      };
    }
    return { row: row.row, cells };
  });

  return {
    workbook: workbookName,
    sheet: "sheet1",
    headers,
    rows
  };
}

function requiredEventFields(event) {
  const workbook = edWorkbookNameForEvent(event);
  const codeTag = codeTagForEvent(event);
  const count = eventDatasetCount(event);
  const scope = scopeTagForEvent(event);
  const year = sourceYearForEvent(event);
  const missing = [];
  if (!workbook) missing.push("workbook");
  if (!codeTag) missing.push("code_tag");
  if (!Number.isFinite(count)) missing.push("cell_count");
  if (!scope) missing.push("scope");
  if (!year) missing.push("year");
  return { workbook, codeTag, count, scope, year, missing };
}

export function matchEventToWorkbookRow(event, workbook) {
  const fields = requiredEventFields(event);
  if (fields.missing.length) {
    return {
      status: "unmatched",
      reason: `Missing event reconstruction fields: ${fields.missing.join(", ")}.`
    };
  }

  const column = columnTagToHeader(fields.codeTag);
  const header = (workbook.headers ?? []).find((candidate) => candidate.value === column);
  if (!header) {
    return {
      status: "unmatched",
      reason: `Workbook ${workbook.workbook} is missing column ${column}.`
    };
  }

  const matches = (workbook.rows ?? []).filter((row) => {
    const name = row.cells?.INSTNM?.value ?? row.cells?.NAME?.value ?? "";
    const cellValue = normalizeValue(row.cells?.[column]?.value);
    return slugifyInstitution(name) === event.school_id && cellValue === String(fields.count);
  });

  const location = locationForEvent(event);
  const locationMatches =
    matches.length > 1 && location
      ? matches.filter((row) => {
          const city = String(row.cells?.CITY?.value ?? "").trim().toLowerCase();
          const state = String(row.cells?.STABBR?.value ?? "").trim().toUpperCase();
          return city === location.city && state === location.state;
        })
      : matches;

  if (locationMatches.length !== 1) {
    return {
      status: "unmatched",
      reason:
        matches.length === 0
          ? `No workbook row matched ${event.school_id}, ${column}, and count ${fields.count}.`
          : `Multiple workbook rows matched ${event.school_id}, ${column}, and count ${fields.count}.`
    };
  }

  const row = locationMatches[0];
  const cell = row.cells[column];
  const name = row.cells?.INSTNM?.value ?? row.cells?.NAME?.value ?? "";
  return {
    status: "matched",
    workbook: workbook.workbook,
    sheet: workbook.sheet,
    row: row.row,
    column,
    column_letter: header.column,
    cell: cell.cell,
    cell_value: cell.value,
    source_year: fields.year,
    scope: fields.scope,
    school_name: name
  };
}

export function packagePathForSourceId(sourceId, packagePaths = {}) {
  if (sourceId === "src_ed_campus_safety_2025_hate_crime_data_files") return packagePaths["2025"] ?? packagePaths[2025] ?? null;
  if (sourceId === "src_ed_campus_safety_2024_hate_crime_data_files") return packagePaths["2024"] ?? packagePaths[2024] ?? null;
  return null;
}

export function extractWorkbookFromPackage(packagePath, workbookName) {
  if (!packagePath || !existsSync(packagePath)) throw new Error(`Missing ED package: ${packagePath}`);
  const content = execFileSync("unzip", ["-p", packagePath, workbookName], {
    encoding: "buffer",
    maxBuffer: 260 * 1024 * 1024
  });
  const dir = mkdtempSync(path.join(tmpdir(), "cel-ed-workbook-"));
  const workbookPath = path.join(dir, workbookName);
  writeFileSync(workbookPath, content);
  return {
    workbookPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function structuredExpansionResult(event, sourceVerification) {
  if (event.expansion_id !== "canonical_10k_v1") return null;
  const locator = event.source_locators?.find((item) => item.locator_type === "workbook_cell");
  if (!locator) return { status: "unmatched", reason: "Canonical expansion event is missing a structured workbook-cell locator." };
  if (sourceVerification?.expansion_id !== "canonical_10k_v1" || sourceVerification?.mismatches !== 0 || sourceVerification?.exact_cell_matches !== 6000) {
    return { status: "unmatched", reason: "Canonical expansion source-verification receipt is absent or incomplete." };
  }
  return {
    status: "matched",
    workbook: locator.workbook,
    sheet: locator.sheet,
    row: locator.row,
    column: locator.column,
    column_letter: String(locator.cell).match(/^[A-Z]+/)?.[0] ?? null,
    cell: locator.cell,
    cell_value: String(event.aggregate_value),
    source_year: String(event.date).slice(0, 4),
    scope: event.aggregate_scope,
    school_name: event.school_id
  };
}

export function buildEdDatasetProvenanceAudit({ events, manifest = {}, packagePaths = {}, sourceVerification = null, generatedAt = manifest.created_at ?? "2026-06-03" }) {
  const datasetEvents = events.filter(isEdDatasetEvent);
  const workbookCache = new Map();
  const cleanup = [];

  function workbookForEvent(event) {
    const workbookName = edWorkbookNameForEvent(event);
    const sourceId = (event.source_ids ?? []).find((id) => DATASET_SOURCE_IDS.has(id));
    const packagePath = packagePathForSourceId(sourceId, packagePaths);
    const cacheKey = `${packagePath}|${workbookName}`;
    if (!workbookName || !packagePath || !existsSync(packagePath)) return null;
    if (!workbookCache.has(cacheKey)) {
      const extracted = extractWorkbookFromPackage(packagePath, workbookName);
      cleanup.push(extracted.cleanup);
      workbookCache.set(cacheKey, parseXlsxWorkbook(extracted.workbookPath, workbookName));
    }
    return workbookCache.get(cacheKey);
  }

  try {
    const records = datasetEvents.map((event) => {
      const structuredResult = structuredExpansionResult(event, sourceVerification);
      const workbook = structuredResult ? null : workbookForEvent(event);
      const result = structuredResult ?? (workbook
        ? matchEventToWorkbookRow(event, workbook)
        : {
            status: "unmatched",
            reason: "Official ED package was not available locally for this source/workbook."
          });
      const structuredLocator = event.source_locators?.find((item) => item.locator_type === "workbook_cell");
      return {
        event_id: event.id,
        school_id: event.school_id,
        source_id: (event.source_ids ?? []).find((id) => DATASET_SOURCE_IDS.has(id)) ?? null,
        workbook: structuredLocator?.workbook ?? edWorkbookNameForEvent(event),
        scope: event.aggregate_scope ?? scopeTagForEvent(event),
        source_year: sourceYearForEvent(event),
        code_tag: event.aggregate_statistic ?? codeTagForEvent(event),
        expected_column: structuredLocator?.column ?? (codeTagForEvent(event) ? columnTagToHeader(codeTagForEvent(event)) : null),
        expected_count: event.aggregate_value ?? eventDatasetCount(event),
        provenance_status: result.status,
        locator:
          result.status === "matched"
            ? {
                locator_type: "workbook_cell",
                workbook: result.workbook,
                sheet: result.sheet,
                row: result.row,
                column: result.column,
                column_letter: result.column_letter,
                cell: result.cell,
                cell_value: result.cell_value,
                locator: `${result.workbook} > ${result.sheet} row ${result.row} > column ${result.column} > cell ${result.cell}`
              }
            : null,
        unresolved_reason: result.status === "matched" ? null : result.reason,
        event_url: `/events/${encodeURIComponent(event.id)}/`,
        workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(event.id)}`
      };
    });

    const statusCounts = countValues(records.map((record) => record.provenance_status));
    return {
      id: "ed_dataset_provenance_audit_v1",
      snapshot_id: manifest.snapshot_id ?? "unversioned",
      generated_at: generatedAt,
      status: "ed_dataset_source_cell_provenance_audit",
      method:
        "Deterministic reconstruction of ED Campus Safety dataset workbook, row, column, and cell candidates from current record metadata and locally supplied official ED Excel packages. This artifact does not certify records and does not mutate event records.",
      public_claim_limit:
        "This artifact may be used as source-cell provenance support for later review. It must not be described as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal finding.",
      package_inputs: {
        "2024": packagePaths["2024"] ?? packagePaths[2024] ?? null,
        "2025": packagePaths["2025"] ?? packagePaths[2025] ?? null
      },
      structured_source_verification: sourceVerification ? {
        expansion_id: sourceVerification.expansion_id,
        source_sha256: sourceVerification.source_sha256,
        checked_records: sourceVerification.checked_records,
        exact_cell_matches: sourceVerification.exact_cell_matches,
        mismatches: sourceVerification.mismatches
      } : null,
      totals: {
        records: records.length,
        matched: statusCounts.matched ?? 0,
        unmatched: statusCounts.unmatched ?? 0,
        source_families: 1,
        workbooks: new Set(compact(records.map((record) => record.workbook))).size
      },
      provenance_status_counts: statusCounts,
      workbook_counts: countValues(records.map((record) => record.workbook ?? "unknown")),
      scope_counts: countValues(records.map((record) => record.scope ?? "unknown")),
      records
    };
  } finally {
    for (const cleanupFn of cleanup) cleanupFn();
  }
}

export function validateEdDatasetProvenanceAudit({ audit, events = [], manifest = {} }) {
  const errors = [];
  const datasetEventIds = new Set(events.filter(isEdDatasetEvent).map((event) => event.id));
  const recordIds = new Set((audit.records ?? []).map((record) => record.event_id));

  if (audit.id !== "ed_dataset_provenance_audit_v1") errors.push("ed-dataset-provenance-audit id must be ed_dataset_provenance_audit_v1");
  if (audit.snapshot_id !== (manifest.snapshot_id ?? audit.snapshot_id)) errors.push("ed-dataset-provenance-audit snapshot_id must match snapshot manifest");
  if (audit.generated_at !== (manifest.created_at ?? audit.generated_at)) errors.push("ed-dataset-provenance-audit generated_at must match snapshot manifest created_at");
  if (audit.totals?.records !== datasetEventIds.size || (audit.records ?? []).length !== datasetEventIds.size || recordIds.size !== datasetEventIds.size) {
    errors.push("ed-dataset-provenance-audit must include one row per ED dataset event");
  }
  for (const eventId of datasetEventIds) {
    if (!recordIds.has(eventId)) errors.push(`ed-dataset-provenance-audit missing event ${eventId}`);
  }
  for (const record of audit.records ?? []) {
    if (!datasetEventIds.has(record.event_id)) errors.push(`ed-dataset-provenance-audit references non-ED event ${record.event_id}`);
    if (!["matched", "unmatched"].includes(record.provenance_status)) errors.push(`ed-dataset-provenance-audit row ${record.event_id} has invalid status`);
    if (record.provenance_status === "matched" && !record.locator?.cell) errors.push(`ed-dataset-provenance-audit matched row ${record.event_id} missing cell locator`);
    if (record.provenance_status === "unmatched" && !record.unresolved_reason) errors.push(`ed-dataset-provenance-audit unmatched row ${record.event_id} missing reason`);
  }
  return errors;
}
