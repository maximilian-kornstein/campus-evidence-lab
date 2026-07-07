import { hasProhibitedReviewTierClaim } from "./review-tier-model-lib.mjs";

const VALID_DATE_PRECISIONS = new Set(["day", "month", "year"]);
const DEFAULT_PROHIBITED_FIELDS = [
  "student_name",
  "private_email",
  "private_phone",
  "private_address",
  "person_name",
  "complainant_name",
  "respondent_name",
  "victim_name",
  "accused_name",
  "direct_message",
  "private_screenshot"
];

const REQUIRED_CANDIDATE_FIELDS = ["manifest_id", "source_family", "date", "category", "affected_communities", "summary", "raw_source_hash", "import_notes"];

export const IMPORT_WAVE_REASON_CODES = [
  "missing_candidate_id",
  "missing_manifest",
  "bulk_import_not_allowed",
  "source_family_mismatch",
  "invalid_record_lane",
  "missing_source_url",
  "invalid_source_url",
  "missing_source_locator",
  "unknown_school",
  "invalid_date_precision",
  "missing_required_field",
  "duplicate_candidate",
  "duplicate_existing_record",
  "prohibited_private_field",
  "prohibited_public_claim"
];

export const IMPORT_RECORD_LANES = [
  "aggregate_safety_stat",
  "civil_rights_case",
  "institution_context_metric",
  "financial_oversight_metric"
];

const IMPORT_RECORD_LANE_SET = new Set(IMPORT_RECORD_LANES);

const SOURCE_FAMILY_DEFAULT_RECORD_LANES = {
  ed_campus_safety_dataset: "aggregate_safety_stat",
  annual_security_report: "aggregate_safety_stat",
  ocr_open_investigation: "civil_rights_case",
  ocr_resolution_document: "civil_rights_case",
  ocr_or_ed_release: "civil_rights_case",
  government_case_or_letter: "civil_rights_case",
  university_statement: "civil_rights_case",
  campus_public_safety_notice: "civil_rights_case",
  government_guidance: "institution_context_metric"
};

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeLocator(value) {
  if (typeof value === "string") return normalize(value);
  if (value && typeof value === "object") return normalize(value.locator ?? JSON.stringify(value));
  return "";
}

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function countValues(items) {
  const counts = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sourceLocatorText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.locator ?? JSON.stringify(value);
  return "";
}

function recordLaneForCandidate(candidate, manifest) {
  return (
    candidate?.record_lane ||
    candidate?.row_lane ||
    manifest?.default_record_lane ||
    SOURCE_FAMILY_DEFAULT_RECORD_LANES[manifest?.source_family] ||
    SOURCE_FAMILY_DEFAULT_RECORD_LANES[candidate?.source_family] ||
    ""
  );
}

export function candidateDuplicateKey(candidate) {
  return compact([
    normalize(recordLaneForCandidate(candidate, null)),
    normalize(candidate?.source_family),
    normalize(candidate?.school_id ?? candidate?.institution_name),
    normalize(candidate?.date),
    normalize(candidate?.date_precision),
    normalize(candidate?.category),
    Array.isArray(candidate?.affected_communities) ? candidate.affected_communities.map(normalize).sort().join(",") : normalize(candidate?.affected_communities),
    normalizeLocator(candidate?.source_locator)
  ]).join("|");
}

function existingEventDuplicateKey(event) {
  const sourceLocator = Array.isArray(event?.source_locators) && event.source_locators.length ? event.source_locators.map((locator) => locator.locator).join(" | ") : event?.summary;
  return compact([
    normalize(event?.source_family ?? event?.source_types?.join(",")),
    normalize(event?.school_id),
    normalize(event?.date),
    normalize(event?.date_precision),
    normalize(event?.category),
    Array.isArray(event?.affected_communities) ? event.affected_communities.map(normalize).sort().join(",") : normalize(event?.affected_communities),
    normalizeLocator(sourceLocator)
  ]).join("|");
}

function flattenObjectEntries(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, entryValue]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entryValue && typeof entryValue === "object" && !Array.isArray(entryValue)) {
      return [[nextKey, entryValue], ...flattenObjectEntries(entryValue, nextKey)];
    }
    return [[nextKey, entryValue]];
  });
}

function hasProhibitedPrivateField(candidate, manifest) {
  const prohibited = new Set([...(manifest?.prohibited_fields ?? []), ...DEFAULT_PROHIBITED_FIELDS].map(normalize));
  for (const [key, value] of flattenObjectEntries(candidate)) {
    const keyParts = normalize(key).split(".");
    const keyMatch = keyParts.some((part) => prohibited.has(part) || [...prohibited].some((prohibitedField) => prohibitedField.includes(part) || part.includes(prohibitedField)));
    if (keyMatch && value !== null && value !== undefined && String(value).trim() !== "") return true;
  }
  return false;
}

function publicText(candidate) {
  return [candidate?.summary, candidate?.description, candidate?.import_notes, candidate?.public_claim, candidate?.institutional_response, candidate?.legal_status].join(" ");
}

function resolveSchoolId(candidate, schools) {
  const byId = new Set(schools.map((school) => school.id));
  if (candidate?.school_id && byId.has(candidate.school_id)) return candidate.school_id;
  if (candidate?.school_id) return "";
  const requestedName = normalize(candidate?.institution_name);
  if (!requestedName) return "";
  return schools.find((school) => normalize(school.name) === requestedName)?.id ?? "";
}

function missingRequiredFields(candidate) {
  return REQUIRED_CANDIDATE_FIELDS.filter((field) => {
    const value = candidate?.[field];
    if (field === "affected_communities") return !Array.isArray(value) || value.length === 0;
    return !requiredString(value);
  });
}

function remediationFor(reasonCodes) {
  if (reasonCodes.includes("bulk_import_not_allowed")) return "Keep this source family in manual or semi-automated review until bulk eligibility is upgraded.";
  if (reasonCodes.includes("invalid_record_lane")) return "Assign one of the approved record lanes before publication.";
  if (reasonCodes.includes("missing_source_locator")) return "Add a row, cell, page, table, item, or document-section locator before publication.";
  if (reasonCodes.includes("unknown_school")) return "Resolve institution identity to a known school record before publication.";
  if (reasonCodes.includes("prohibited_private_field")) return "Remove private or sensitive fields before any public artifact is generated.";
  if (reasonCodes.includes("prohibited_public_claim")) return "Rewrite public text to remove ranking, scoring, prevalence, certification, or legal-finding overclaims.";
  if (reasonCodes.includes("duplicate_candidate") || reasonCodes.includes("duplicate_existing_record")) return "Merge with the existing candidate or record under the deterministic duplicate strategy.";
  return "Repair the failed import-wave gate and rerun QA.";
}

function normalizeAcceptedCandidate(candidate, manifest, resolvedSchoolId) {
  return {
    candidate_id: candidate.candidate_id,
    manifest_id: manifest.id,
    source_family: candidate.source_family,
    record_lane: recordLaneForCandidate(candidate, manifest),
    source_url: candidate.source_url,
    source_locator: candidate.source_locator,
    school_id: resolvedSchoolId,
    institution_name: candidate.institution_name ?? "",
    date: candidate.date,
    date_precision: candidate.date_precision,
    category: candidate.category,
    affected_communities: candidate.affected_communities,
    summary: candidate.summary,
    raw_source_hash: candidate.raw_source_hash,
    import_notes: candidate.import_notes,
    review_tier: manifest.default_review_tier,
    duplicate_key: candidateDuplicateKey({ ...candidate, school_id: resolvedSchoolId })
  };
}

function quarantineRow({ candidate, reasonCodes, failedFields = [] }) {
  return {
    candidate_id: candidate?.candidate_id ?? "",
    manifest_id: candidate?.manifest_id ?? "",
    source_family: candidate?.source_family ?? "",
    record_lane: recordLaneForCandidate(candidate, null),
    source_url: candidate?.source_url ?? "",
    source_locator: sourceLocatorText(candidate?.source_locator),
    raw_hash: candidate?.raw_source_hash ?? "",
    reason_codes: [...reasonCodes].sort(),
    failed_gates: [...reasonCodes].sort(),
    failed_fields: failedFields.sort(),
    remediation_action: remediationFor([...reasonCodes])
  };
}

function primaryManifestForWave(candidates, manifestsById) {
  const candidateManifest = candidates.map((candidate) => manifestsById.get(candidate.manifest_id)).find(Boolean);
  return candidateManifest ?? null;
}

function waveSourceFamily(candidates, manifest) {
  const families = [...new Set(candidates.map((candidate) => candidate.source_family).filter(Boolean))];
  return families.length === 1 ? families[0] : manifest?.source_family ?? "mixed";
}

function waveRecordLane(candidates, manifest) {
  const lanes = [...new Set(candidates.map((candidate) => recordLaneForCandidate(candidate, manifest)).filter(Boolean))];
  if (lanes.length === 1) return lanes[0];
  return recordLaneForCandidate({}, manifest) || "mixed";
}

function summarizeManifest(manifest) {
  if (!manifest) return null;
  return {
    id: manifest.id,
    source_family: manifest.source_family,
    legal_risk_class: manifest.legal_risk_class,
    bulk_import_eligible: Boolean(manifest.bulk_import_eligible),
    default_review_tier: manifest.default_review_tier,
    default_record_lane: recordLaneForCandidate({}, manifest),
    importer_command: manifest.importer_command
  };
}

export function validateImportWaveCandidates({
  waveId,
  candidates = [],
  manifests = [],
  schools = [],
  existingEvents = [],
  command = "",
  generatedAt = new Date().toISOString().slice(0, 10),
  datasetHashBefore = "",
  datasetHashAfter = "",
  excludedCount = 0,
  exclusionArtifact = ""
} = {}) {
  const manifestsById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const existingKeys = new Set(existingEvents.map(existingEventDuplicateKey).filter(Boolean));
  const seenCandidateKeys = new Set();
  const accepted = [];
  const quarantine = [];
  const allReasonCodes = [];
  let duplicateCount = 0;

  for (const candidate of candidates) {
    const reasonCodes = new Set();
    const failedFields = new Set();
    const manifest = manifestsById.get(candidate?.manifest_id);

    if (!requiredString(candidate?.candidate_id)) reasonCodes.add("missing_candidate_id");
    if (!manifest) reasonCodes.add("missing_manifest");
    if (manifest && !manifest.bulk_import_eligible) reasonCodes.add("bulk_import_not_allowed");
    if (manifest && candidate?.source_family !== manifest.source_family) reasonCodes.add("source_family_mismatch");
    const recordLane = recordLaneForCandidate(candidate, manifest);
    if (manifest && !IMPORT_RECORD_LANE_SET.has(recordLane)) reasonCodes.add("invalid_record_lane");

    if (!requiredString(candidate?.source_url)) {
      reasonCodes.add("missing_source_url");
    } else if (!validUrl(candidate.source_url)) {
      reasonCodes.add("invalid_source_url");
    }

    if (!requiredString(sourceLocatorText(candidate?.source_locator))) reasonCodes.add("missing_source_locator");

    const resolvedSchoolId = resolveSchoolId(candidate, schools);
    if (!resolvedSchoolId) reasonCodes.add("unknown_school");

    if (!VALID_DATE_PRECISIONS.has(candidate?.date_precision)) reasonCodes.add("invalid_date_precision");

    const missingFields = missingRequiredFields(candidate);
    if (missingFields.length) {
      reasonCodes.add("missing_required_field");
      for (const field of missingFields) failedFields.add(field);
    }

    const duplicateKey = candidateDuplicateKey({ ...candidate, school_id: resolvedSchoolId || candidate?.school_id });
    if (duplicateKey && seenCandidateKeys.has(duplicateKey)) {
      reasonCodes.add("duplicate_candidate");
      duplicateCount += 1;
    } else if (duplicateKey) {
      seenCandidateKeys.add(duplicateKey);
    }
    if (duplicateKey && existingKeys.has(duplicateKey)) reasonCodes.add("duplicate_existing_record");

    if (hasProhibitedPrivateField(candidate, manifest)) reasonCodes.add("prohibited_private_field");
    if (hasProhibitedReviewTierClaim(publicText(candidate))) reasonCodes.add("prohibited_public_claim");

    if (reasonCodes.size) {
      const sortedReasons = [...reasonCodes].sort();
      allReasonCodes.push(...sortedReasons);
      quarantine.push(quarantineRow({ candidate, reasonCodes: sortedReasons, failedFields: [...failedFields] }));
      continue;
    }

    accepted.push(normalizeAcceptedCandidate(candidate, manifest, resolvedSchoolId));
  }

  const manifest = primaryManifestForWave(candidates, manifestsById);
  const sourceFamily = waveSourceFamily(candidates, manifest);
  const publishable = candidates.length > 0 && accepted.length === candidates.length && quarantine.length === 0;
  const qaGateCounts = {
    accepted: accepted.length,
    ...countValues(allReasonCodes)
  };

  const wave = {
    id: waveId,
    source_family: sourceFamily,
    record_lane: waveRecordLane(candidates, manifest),
    manifest_id: manifest?.id ?? candidates[0]?.manifest_id ?? "",
    generated_at: generatedAt,
    command,
    publishable,
    status: publishable ? "publishable" : "blocked",
    attempted_count: candidates.length,
    accepted_count: accepted.length,
    duplicate_count: duplicateCount,
    excluded_count: Number.isInteger(excludedCount) && excludedCount > 0 ? excludedCount : 0,
    quarantined_count: quarantine.length,
    qa_gate_counts: qaGateCounts,
    sample_record_ids: accepted.slice(0, 25).map((row) => row.candidate_id),
    accepted_candidate_ids: accepted.map((row) => row.candidate_id),
    source_manifest: summarizeManifest(manifest),
    quarantine_artifact: `data/import-quarantine/${waveId}.json`,
    dataset_hash_before: datasetHashBefore,
    dataset_hash_after: datasetHashAfter,
    public_claim_limit:
      "Import-wave acceptance means deterministic publication gates passed for imported public-source records. It is not individual human certification, external validation, ranking, prevalence measurement, safety scoring, severity scoring, or a legal finding."
  };
  if (wave.excluded_count > 0 || exclusionArtifact) wave.exclusion_artifact = exclusionArtifact;

  return {
    publishable,
    accepted,
    quarantine,
    wave
  };
}

export function runImportWave(options = {}) {
  const result = validateImportWaveCandidates(options);
  return {
    wave: result.wave,
    accepted: result.accepted,
    quarantine: {
      id: result.wave.id,
      wave_id: result.wave.id,
      source_family: result.wave.source_family,
      generated_at: result.wave.generated_at,
      rows: result.quarantine,
      reason_counts: countValues(result.quarantine.flatMap((row) => row.reason_codes)),
      public_claim_limit: "Quarantine rows identify blocked import candidates. A quarantined row is not a public event record."
    }
  };
}

function hasRequiredArtifactString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateImportWaveArtifacts({ wave, accepted = [], quarantine } = {}) {
  const errors = [];
  if (!wave || typeof wave !== "object") return ["import-wave artifact missing wave report"];
  if (!quarantine || typeof quarantine !== "object") errors.push(`import-wave ${wave.id ?? "unknown"} missing quarantine artifact`);

  for (const field of ["id", "source_family", "manifest_id", "generated_at", "status", "quarantine_artifact", "public_claim_limit"]) {
    if (!hasRequiredArtifactString(wave[field])) errors.push(`import-wave ${wave.id ?? "unknown"} missing ${field}`);
  }

  for (const field of ["attempted_count", "accepted_count", "duplicate_count", "excluded_count", "quarantined_count"]) {
    if (!Number.isInteger(wave[field]) || wave[field] < 0) errors.push(`import-wave ${wave.id ?? "unknown"} has invalid ${field}`);
  }

  if (wave.status && !["publishable", "blocked"].includes(wave.status)) errors.push(`import-wave ${wave.id} has invalid status ${wave.status}`);
  if (wave.record_lane !== undefined && wave.record_lane !== "mixed" && !IMPORT_RECORD_LANE_SET.has(wave.record_lane)) {
    errors.push(`import-wave ${wave.id ?? "unknown"} has invalid record_lane ${wave.record_lane}`);
  }
  if (typeof wave.publishable !== "boolean") errors.push(`import-wave ${wave.id ?? "unknown"} missing publishable boolean`);
  if (!wave.source_manifest?.id) errors.push(`import-wave ${wave.id ?? "unknown"} missing source_manifest`);
  if (!wave.qa_gate_counts || typeof wave.qa_gate_counts !== "object") errors.push(`import-wave ${wave.id ?? "unknown"} missing qa_gate_counts`);
  if (!Array.isArray(wave.sample_record_ids)) errors.push(`import-wave ${wave.id ?? "unknown"} sample_record_ids must be an array`);
  if (!Array.isArray(wave.accepted_candidate_ids)) errors.push(`import-wave ${wave.id ?? "unknown"} accepted_candidate_ids must be an array`);
  if (!hasRequiredArtifactString(wave.command)) errors.push(`import-wave ${wave.id ?? "unknown"} missing command`);
  if (!hasRequiredArtifactString(wave.dataset_hash_before)) errors.push(`import-wave ${wave.id ?? "unknown"} missing dataset_hash_before`);
  if (!hasRequiredArtifactString(wave.dataset_hash_after)) errors.push(`import-wave ${wave.id ?? "unknown"} missing dataset_hash_after`);
  if (wave.excluded_count > 0 && !hasRequiredArtifactString(wave.exclusion_artifact)) {
    errors.push(`import-wave ${wave.id ?? "unknown"} missing exclusion_artifact for excluded rows`);
  }
  if (wave.exclusion_artifact !== undefined && !hasRequiredArtifactString(wave.exclusion_artifact)) {
    errors.push(`import-wave ${wave.id ?? "unknown"} has invalid exclusion_artifact`);
  }

  const rows = quarantine?.rows ?? [];
  if (!Array.isArray(rows)) {
    errors.push(`import-wave ${wave.id ?? "unknown"} quarantine rows must be an array`);
  } else {
    for (const row of rows) {
      if (!Array.isArray(row.reason_codes) || row.reason_codes.length === 0) {
        errors.push(`import-wave ${wave.id} quarantine row ${row.candidate_id || "unknown"} missing reason_codes`);
      }
      if (!Array.isArray(row.failed_gates) || row.failed_gates.length === 0) {
        errors.push(`import-wave ${wave.id} quarantine row ${row.candidate_id || "unknown"} missing failed_gates`);
      }
      if (!hasRequiredArtifactString(row.remediation_action)) {
        errors.push(`import-wave ${wave.id} quarantine row ${row.candidate_id || "unknown"} missing remediation_action`);
      }
      for (const code of row.reason_codes ?? []) {
        if (!IMPORT_WAVE_REASON_CODES.includes(code)) errors.push(`import-wave ${wave.id} quarantine row ${row.candidate_id || "unknown"} has invalid reason code ${code}`);
      }
    }
  }

  if (wave.quarantined_count !== rows.length) {
    errors.push(`import-wave ${wave.id} quarantined_count is ${wave.quarantined_count}, expected ${rows.length}`);
  }
  if (wave.accepted_count !== (wave.accepted_candidate_ids ?? []).length) {
    errors.push(`import-wave ${wave.id} accepted_count is ${wave.accepted_count}, expected ${(wave.accepted_candidate_ids ?? []).length}`);
  }
  if (accepted.length && accepted.some((row) => row.review_tier !== "imported_public_source")) {
    errors.push(`import-wave ${wave.id} accepted bulk rows must use imported_public_source review tier`);
  }
  if (accepted.length && accepted.some((row) => row.record_lane !== undefined && !IMPORT_RECORD_LANE_SET.has(row.record_lane))) {
    errors.push(`import-wave ${wave.id} accepted rows include invalid record_lane`);
  }
  if (wave.publishable && rows.length) errors.push(`import-wave ${wave.id} cannot be publishable with quarantined rows`);

  return errors;
}
