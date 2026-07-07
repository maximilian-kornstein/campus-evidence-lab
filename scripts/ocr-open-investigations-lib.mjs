import { sha256 } from "./lib.mjs";

export const OCR_OPEN_INVESTIGATION_MANIFEST_ID = "manifest_ocr_open_investigation";
export const OCR_OPEN_INVESTIGATION_SOURCE_FAMILY = "ocr_open_investigation";
export const OCR_OPEN_INVESTIGATION_BASE_URL = "https://ocrcas.ed.gov/open-investigations";

const OCR_QUERY_DEFAULTS = {
  field_ois_discrimination_statute: "All",
  field_ois_institution: "",
  field_ois_institution_type: "All",
  field_ois_state: "All",
  field_ois_type_of_discrimination: "All",
  field_open_investigation_date: "",
  field_open_investigation_date_1: "",
  field_open_investigation_date_2: "",
  field_open_investigation_date_3: ""
};

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeInstitutionName(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/[.,'’`]/g, "")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function dateFromOcrDate(value) {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function titleCaseInstitution(value) {
  const upperWords = new Set(["A", "M", "II", "III", "IV", "VI", "IX"]);
  return normalizeSpace(value)
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word === "&") return word;
      if (upperWords.has(word.toUpperCase())) return word.toUpperCase();
      return word
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    })
    .join(" ");
}

function schoolLookup(schools) {
  const byName = new Map();
  for (const school of schools ?? []) {
    byName.set(normalizeInstitutionName(school.name), school);
  }
  return byName;
}

function schoolForInstitution(institution, schools) {
  return schoolLookup(schools).get(normalizeInstitutionName(institution)) ?? null;
}

function communitiesForDiscriminationType(type) {
  const text = String(type ?? "").toLowerCase();
  if (text.includes("disability")) return ["Students with disabilities"];
  if (text.includes("title ix")) return ["Gender"];
  if (text.includes("title vi")) {
    const communities = ["Race", "National origin"];
    if (text.includes("religion")) communities.push("Religion");
    return communities;
  }
  if (text.includes("age")) return ["Age"];
  if (text.includes("boy scouts")) return ["Boy Scouts of America Equal Access Act"];
  return ["Race"];
}

function categoryForDiscriminationType(type) {
  const text = String(type ?? "").toLowerCase();
  if (text.includes("title ix")) return "Title IX compliance";
  if (text.includes("disability")) return "Disability access";
  if (text.includes("title vi")) return "OCR complaint";
  return "Discrimination allegation";
}

function candidateIdForRow(row) {
  const hash = sha256({
    state: row.state,
    institution: row.institution,
    institution_type: row.institution_type,
    discrimination_type: row.discrimination_type,
    open_investigation_date: row.open_investigation_date
  });
  return `cand_ocr_${hash.slice("sha256:".length, "sha256:".length + 18)}`;
}

function sourceLocatorForRow(row) {
  return compact([
    "OCR open investigations table row",
    `state=${row.state}`,
    `institution=${row.institution}`,
    `institution_type=${row.institution_type}`,
    `type=${row.discrimination_type}`,
    `open_date=${row.open_investigation_date}`
  ]).join("; ");
}

export function ocrOpenInvestigationPageUrl({ page = 0, itemsPerPage = 1000 } = {}) {
  const params = new URLSearchParams({ ...OCR_QUERY_DEFAULTS, items_per_page: String(itemsPerPage) });
  if (page > 0) params.set("page", String(page));
  return `${OCR_OPEN_INVESTIGATION_BASE_URL}?${params.toString()}`;
}

export function parseOcrDisplayCount(text) {
  const match = String(text ?? "").match(/Displaying\s+([\d,]+)\s+-\s+([\d,]+)\s+of\s+([\d,]+)\s+records/i);
  if (!match) return null;
  return {
    start: Number.parseInt(match[1].replace(/,/g, ""), 10),
    end: Number.parseInt(match[2].replace(/,/g, ""), 10),
    total: Number.parseInt(match[3].replace(/,/g, ""), 10)
  };
}

export function parseOcrOpenInvestigationRowsFromText(text) {
  const rows = [];
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/^[A-Z]{2}\t/.test(line)) continue;
    const columns = line.split("\t").map(normalizeSpace);
    if (columns.length < 5) continue;
    rows.push({
      state: columns[0],
      institution: columns[1],
      institution_type: columns[2],
      discrimination_type: columns[3],
      open_investigation_date: columns[4]
    });
  }

  return rows;
}

export function buildOcrOpenInvestigationCandidates({
  rows = [],
  schools = [],
  waveId,
  sourcePageUrl = OCR_OPEN_INVESTIGATION_BASE_URL,
  limit = Number.POSITIVE_INFINITY,
  offset = 0,
  usedCandidateIds = new Set(),
  requireKnownSchool = false
} = {}) {
  const candidates = [];
  const excluded = [];
  const mappingQuarantine = [];
  const selectedRows = rows.slice(offset);

  for (const row of selectedRows) {
    const normalizedRow = {
      state: normalizeSpace(row.state),
      institution: normalizeSpace(row.institution),
      institution_type: normalizeSpace(row.institution_type),
      discrimination_type: normalizeSpace(row.discrimination_type),
      open_investigation_date: normalizeSpace(row.open_investigation_date)
    };

    if (normalizedRow.institution_type !== "PSE") {
      excluded.push({
        row: normalizedRow,
        reason_code: "non_postsecondary_institution",
        remediation_action: "Keep elementary-secondary OCR rows out of university accountability import waves."
      });
      continue;
    }

    const candidateId = candidateIdForRow(normalizedRow);
    if (usedCandidateIds.has(candidateId)) continue;

    const school = schoolForInstitution(normalizedRow.institution, schools);
    const sourceDate = dateFromOcrDate(normalizedRow.open_investigation_date);
    const institutionLabel = school?.name ?? titleCaseInstitution(normalizedRow.institution);
    const locator = row.source_locator || sourceLocatorForRow(normalizedRow);
    const candidateSourceUrl = row.source_page_url || sourcePageUrl;
    const rowHash = sha256({ source_url: candidateSourceUrl, source_locator: locator, row: normalizedRow });

    if (!school && requireKnownSchool) {
      mappingQuarantine.push({
        candidate_id: candidateId,
        manifest_id: OCR_OPEN_INVESTIGATION_MANIFEST_ID,
        source_family: OCR_OPEN_INVESTIGATION_SOURCE_FAMILY,
        source_url: candidateSourceUrl,
        source_locator: locator,
        raw_hash: rowHash,
        reason_codes: ["unknown_school"],
        failed_gates: ["unknown_school"],
        failed_fields: [],
        remediation_action: "Resolve institution identity to a known postsecondary school before publication."
      });
      continue;
    }

    if (candidates.length >= limit) continue;

    candidates.push({
      candidate_id: candidateId,
      wave_id: waveId,
      manifest_id: OCR_OPEN_INVESTIGATION_MANIFEST_ID,
      source_family: OCR_OPEN_INVESTIGATION_SOURCE_FAMILY,
      source_url: candidateSourceUrl,
      source_locator: locator,
      school_id: school?.id ?? "",
      institution_name: school?.name ?? normalizedRow.institution,
      date: sourceDate,
      date_precision: "day",
      category: categoryForDiscriminationType(normalizedRow.discrimination_type),
      affected_communities: communitiesForDiscriminationType(normalizedRow.discrimination_type),
      summary:
        `The U.S. Department of Education Office for Civil Rights open-investigations table listed an open investigation ` +
        `for ${institutionLabel} concerning ${normalizedRow.discrimination_type}, opened on ${normalizedRow.open_investigation_date}.`,
      raw_source_hash: rowHash,
      import_notes:
        "Source row is from OCR's public open-investigations table. Inclusion means OCR initiated an investigation; it does not mean OCR made a decision or finding."
    });
  }

  return {
    candidates,
    excluded,
    mapping_quarantine: mappingQuarantine,
    counts: {
      rows: rows.length,
      candidates: candidates.length,
      excluded: excluded.length,
      mapping_quarantine: mappingQuarantine.length
    }
  };
}
