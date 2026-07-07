import { sha256 } from "./lib.mjs";

export const OCR_RESOLUTION_MANIFEST_ID = "manifest_ocr_resolution_document";
export const OCR_RESOLUTION_SOURCE_FAMILY = "ocr_resolution_document";
export const OCR_RESOLUTION_BASE_URL = "https://ocrcas.ed.gov/ocr-search";

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isoDateFromOcrDate(value) {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function linkForType(links, type) {
  return links.find((link) => normalizeSpace(link.text).toLowerCase() === type)?.href ?? "";
}

export function ocrResolutionSearchPageUrl({ page = 0 } = {}) {
  const pageParam = page > 0 ? `&page=${page}` : "";
  return `${OCR_RESOLUTION_BASE_URL}?f%5B0%5D=it%3APost%20Secondary${pageParam}`;
}

export function parseOcrResolutionRows(rows = []) {
  const parsed = [];

  for (const row of rows) {
    const text = normalizeSpace(row?.text);
    const match = text.match(/^(.+?)\s+\(([A-Z]{2}|AS|GU|MP|PR|VI|DC|XX)\)\s+\((\d+)\)\s+(\d{2}\/\d{2}\/\d{4})\b/);
    if (!match) continue;

    const links = Array.isArray(row?.links) ? row.links : [];
    parsed.push({
      institution: normalizeSpace(match[1]),
      state: match[2],
      ocr_reference: match[3],
      resolved_date: match[4],
      letter_url: linkForType(links, "letter"),
      agreement_url: linkForType(links, "agreement"),
      modified_agreement_url: linkForType(links, "modified")
    });
  }

  return parsed;
}

function sourceUrlsForRow(row) {
  return [row.letter_url, row.agreement_url, row.modified_agreement_url].filter(Boolean);
}

function sourceLocatorForRow(row) {
  const documents = [
    row.letter_url ? "letter" : "",
    row.agreement_url ? "agreement" : "",
    row.modified_agreement_url ? "modified_agreement" : ""
  ].filter(Boolean);
  return [
    "OCR recent resolution search result",
    `institution=${row.institution}`,
    `state=${row.state}`,
    `ocr_reference=${row.ocr_reference}`,
    `resolved_date=${row.resolved_date}`,
    `documents=${documents.join(",") || "none"}`
  ].join("; ");
}

export function buildOcrResolutionCandidate({ row, school, waveId } = {}) {
  const normalizedRow = {
    institution: normalizeSpace(row?.institution),
    state: normalizeSpace(row?.state),
    ocr_reference: normalizeSpace(row?.ocr_reference),
    resolved_date: normalizeSpace(row?.resolved_date),
    letter_url: normalizeSpace(row?.letter_url),
    agreement_url: normalizeSpace(row?.agreement_url),
    modified_agreement_url: normalizeSpace(row?.modified_agreement_url)
  };
  const sourceUrls = sourceUrlsForRow(normalizedRow);
  const sourceLocator = sourceLocatorForRow(normalizedRow);

  return {
    candidate_id: `cand_ocr_resolution_${normalizedRow.ocr_reference}`,
    wave_id: waveId,
    manifest_id: OCR_RESOLUTION_MANIFEST_ID,
    source_family: OCR_RESOLUTION_SOURCE_FAMILY,
    source_url: sourceUrls[0] ?? OCR_RESOLUTION_BASE_URL,
    source_locator: sourceLocator,
    school_id: school?.id ?? "",
    institution_name: school?.name ?? normalizedRow.institution,
    date: isoDateFromOcrDate(normalizedRow.resolved_date),
    date_precision: "day",
    category: "OCR complaint",
    affected_communities: ["Civil rights"],
    summary:
      `OCR resolution documents are listed for ${school?.name ?? normalizedRow.institution} ` +
      `under OCR reference ${normalizedRow.ocr_reference}, resolved ${normalizedRow.resolved_date}.`,
    raw_source_hash: sha256({ row: normalizedRow, source_locator: sourceLocator }),
    import_notes:
      "Imported from OCR Recent Resolution Search for postsecondary institutions. " +
      "The record means OCR posted resolution documents; it is not a Campus Evidence Lab legal finding, ranking, prevalence estimate, safety score, or severity score."
  };
}
