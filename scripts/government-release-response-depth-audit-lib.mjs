const GOVERNMENT_RELEASE_TYPES = new Set(["Government release", "Government guidance"]);
const GOVERNMENT_RELEASE_FAMILIES = new Set(["government_release", "ocr_or_ed_release", "government_case_or_letter", "government_guidance"]);

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function linkedSources(event, sourcesById) {
  return (event.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)).filter(Boolean);
}

function hasGovernmentReleaseSource(event, sourcesById) {
  const sourceTypes = new Set([...(event.source_types ?? []), ...linkedSources(event, sourcesById).map((source) => source.source_type)]);
  return [...sourceTypes].some((sourceType) => GOVERNMENT_RELEASE_TYPES.has(sourceType));
}

function isGovernmentReleaseLike(event, sourcesById) {
  return GOVERNMENT_RELEASE_FAMILIES.has(event.source_family) || hasGovernmentReleaseSource(event, sourcesById);
}

function responseTextLimitsInstitutionalResponse(event) {
  const text = String(event.institutional_response ?? "").toLowerCase();
  return (
    /\bdoes not (?:summarize|evaluate)\b/.test(text) ||
    /\bdoes not independently evaluate\b/.test(text) ||
    /\bbeyond the public government action\b/.test(text) ||
    /\bpublic federal finding and accreditor notification\b/.test(text) ||
    /\bpublic ocr letter action\b/.test(text)
  );
}

function issueForEvent(event, sourcesById) {
  if (!isGovernmentReleaseLike(event, sourcesById)) return null;
  if (!String(event.institutional_response ?? "").trim()) return null;

  if (event.response_depth === "direct_institutional_response" && responseTextLimitsInstitutionalResponse(event)) {
    return {
      issue_id: "government_release_direct_response_overstatement_risk",
      recommended_response_depth: "limited_public_response_note",
      rationale:
        "The linked source family is government-release-like, while the stored response text says the record does not summarize a direct institutional response beyond public government action."
    };
  }

  if (!event.response_depth) {
    return {
      issue_id: "government_release_missing_response_depth",
      recommended_response_depth: "limited_public_response_note",
      rationale:
        "The record has stored response text from a government-release-like source family but no explicit response-depth classification."
    };
  }

  return null;
}

export function buildGovernmentReleaseResponseDepthAudit({ events = [], sources = [] }) {
  const sourcesById = sourceMap(sources);
  const records = events
    .filter((event) => isGovernmentReleaseLike(event, sourcesById))
    .map((event) => {
      const issue = issueForEvent(event, sourcesById);
      return {
        event_id: event.id,
        school_id: event.school_id,
        source_ids: event.source_ids ?? [],
        source_types: [...new Set([...(event.source_types ?? []), ...linkedSources(event, sourcesById).map((source) => source.source_type)])].sort(),
        current_response_depth: event.response_depth ?? null,
        issue_id: issue?.issue_id ?? null,
        recommended_response_depth: issue?.recommended_response_depth ?? event.response_depth ?? null,
        rationale:
          issue?.rationale ??
          "No deterministic government-release response-depth issue was found by this audit. Certification still requires source-to-record review.",
        required_action: issue
          ? "Do not certify this record until response-depth classification is repaired or source support for the current label is documented."
          : "No response-depth action required by this deterministic audit."
      };
    })
    .sort((a, b) => {
      if (Boolean(b.issue_id) !== Boolean(a.issue_id)) return Number(Boolean(b.issue_id)) - Number(Boolean(a.issue_id));
      return a.event_id.localeCompare(b.event_id);
    });

  const flaggedRecords = records.filter((record) => record.issue_id);

  return {
    id: "government_release_response_depth_audit_v1",
    generated_at: "2026-06-17",
    status: "pre_certification_response_depth_repair_queue",
    method:
      "Deterministic audit of government-release-like records. It flags response-depth labels that may overstate direct institutional-response support before any source-family certification wave.",
    public_claim_limit:
      "This audit is not certification, external review, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.",
    records_reviewed: records.length,
    flagged_records: flaggedRecords.length,
    issue_counts: countValues(flaggedRecords.map((record) => record.issue_id)),
    records
  };
}
