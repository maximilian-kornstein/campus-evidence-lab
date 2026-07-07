import { isAllowedReviewTier } from "./review-tier-model-lib.mjs";
import { IMPORT_RECORD_LANES } from "./import-wave-lib.mjs";

export const IMPORT_LEGAL_RISK_CLASSES = [
  "low_official_structured",
  "medium_official_document",
  "medium_institutional_public_statement",
  "manual_only_open_web",
  "excluded_private_or_sensitive"
];

const IMPORT_LEGAL_RISK_SET = new Set(IMPORT_LEGAL_RISK_CLASSES);
const MANUAL_ONLY_RISK_CLASSES = new Set(["manual_only_open_web", "excluded_private_or_sensitive"]);
const IMPORT_RECORD_LANE_SET = new Set(IMPORT_RECORD_LANES);

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function linkedSources(record, sources) {
  const byId = sourceMap(sources);
  return (record.source_ids ?? []).map((sourceId) => byId.get(sourceId)).filter(Boolean);
}

function sourceTypes(record, sources) {
  const linkedTypes = linkedSources(record, sources).map((source) => source.source_type);
  return [...new Set(compact(linkedTypes.length ? linkedTypes : record.source_types ?? []))];
}

function searchableText(record, sources) {
  return [
    record.summary,
    record.description,
    record.legal_status,
    record.institutional_response,
    ...(record.tags ?? []),
    ...linkedSources(record, sources).flatMap((source) => [source.title, source.publisher, source.source_type, source.url])
  ]
    .join(" ")
    .toLowerCase();
}

export function sourceFamilyForRecord(record, sources = []) {
  const text = searchableText(record, sources);
  const types = sourceTypes(record, sources);

  if (types.includes("Annual security report")) return "annual_security_report";

  if (/ocrcas\.ed\.gov\/open-investigations|open-investigations table|pending cases currently under investigation/.test(text)) {
    return "ocr_open_investigation";
  }

  if (/ocrcas\.ed\.gov\/ocr-search|office for civil rights recent resolution search|ocr-letters-and-agreements|ocr resolution documents?/.test(text)) {
    return "ocr_resolution_document";
  }

  if (types.includes("Government dataset") || /ope\.ed\.gov\/campussafety|campus safety and security data analysis cutting tool|crime20\d{2}excel|hate-crime-statistics workbook/.test(text)) {
    return "ed_campus_safety_dataset";
  }

  if (types.includes("Government case summary") || types.includes("Government letter")) return "government_case_or_letter";

  if (types.includes("Government guidance")) return "government_guidance";

  if (types.includes("University statement") || /university statement|public statement|sjsualert|campus groups/.test(text)) {
    return "university_statement";
  }

  if (types.includes("Public safety notice")) return "campus_public_safety_notice";

  if (/ocr|office for civil rights|title vi|title ix|resolution agreement/.test(text) || types.includes("Government release")) {
    return "ocr_or_ed_release";
  }

  if (types.includes("News report") || types.includes("Journalism")) return "news_report";

  return "other_public_source";
}

function hasRequiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

export function validateImportManifests(manifests = []) {
  const errors = [];
  const ids = new Set();
  const families = new Set();

  for (const manifest of manifests) {
    const label = `import manifest ${manifest?.id ?? "unknown"}`;

    if (!hasRequiredString(manifest?.id)) errors.push(`${label} missing id`);
    if (manifest?.id && ids.has(manifest.id)) errors.push(`duplicate import manifest id ${manifest.id}`);
    if (manifest?.id) ids.add(manifest.id);

    if (!hasRequiredString(manifest?.source_family)) errors.push(`${label} missing source_family`);
    if (manifest?.source_family && families.has(manifest.source_family)) {
      errors.push(`duplicate import manifest source_family ${manifest.source_family}`);
    }
    if (manifest?.source_family) families.add(manifest.source_family);

    if (!IMPORT_LEGAL_RISK_SET.has(manifest?.legal_risk_class)) {
      errors.push(`${label} has invalid legal_risk_class ${manifest?.legal_risk_class}`);
    }

    if (!isAllowedReviewTier(manifest?.default_review_tier)) {
      errors.push(`${label} has invalid default_review_tier ${manifest?.default_review_tier}`);
    }

    if (manifest?.bulk_import_eligible && manifest.default_review_tier !== "imported_public_source") {
      errors.push(`${label} default_review_tier must be imported_public_source for bulk import eligibility`);
    }

    if (manifest?.default_record_lane !== undefined && !IMPORT_RECORD_LANE_SET.has(manifest.default_record_lane)) {
      errors.push(`${label} has invalid default_record_lane ${manifest.default_record_lane}`);
    }

    if (manifest?.bulk_import_eligible && !IMPORT_RECORD_LANE_SET.has(manifest?.default_record_lane)) {
      errors.push(`${label} must include a valid default_record_lane for bulk import eligibility`);
    }

    if (manifest?.bulk_import_eligible && MANUAL_ONLY_RISK_CLASSES.has(manifest?.legal_risk_class)) {
      errors.push(`${label} ${manifest.legal_risk_class} cannot be bulk_import_eligible`);
    }

    if (!hasNonEmptyArray(manifest?.source_urls)) errors.push(`${label} must include source_urls`);
    for (const url of manifest?.source_urls ?? []) {
      try {
        new URL(url);
      } catch {
        errors.push(`${label} has invalid source_url ${url}`);
      }
    }

    for (const field of ["acquisition_date", "importer_command", "duplicate_strategy", "sampling_plan"]) {
      if (!hasRequiredString(manifest?.[field])) errors.push(`${label} missing ${field}`);
    }

    if (!manifest?.field_map || typeof manifest.field_map !== "object" || Array.isArray(manifest.field_map)) {
      errors.push(`${label} must include field_map`);
    }

    for (const field of ["known_limits", "publishable_fields", "prohibited_fields", "exclusion_rules"]) {
      if (!hasNonEmptyArray(manifest?.[field])) errors.push(`${label} must include ${field}`);
    }
  }

  return errors;
}

export function validateImportManifestCoverage({ events = [], sources = [], manifests = [] }) {
  const errors = validateImportManifests(manifests);
  const manifestFamilies = new Set(manifests.map((manifest) => manifest.source_family));

  for (const event of events) {
    const family = sourceFamilyForRecord(event, sources);
    if (!manifestFamilies.has(family)) {
      errors.push(`Event ${event.id} missing import manifest for source family ${family}`);
    }
  }

  return errors;
}
