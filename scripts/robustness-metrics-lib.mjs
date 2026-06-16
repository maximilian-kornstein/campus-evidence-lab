const BROAD_COMMUNITY_LABELS = new Set(["Race", "Religion", "National origin", "Ethnicity", "Gender"]);
const HIGH_STAKES_CATEGORIES = new Set([
  "OCR complaint",
  "Title IX compliance",
  "Pregnancy discrimination",
  "Disability access",
  "Athletic equity",
  "Lawsuit or legal filing",
  "Criminal investigation"
]);

const PROHIBITED_CLAIM_PATTERN =
  /safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|safety score|severity score|school ranking|prevalence estimate|estimates prevalence|frequency measurement/i;

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'");
}

function percent(count, total) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function snapshotDate(manifest) {
  return manifest.created_at ?? "2026-06-03";
}

function countValues(values, total) {
  const counts = new Map();
  for (const value of compact(values)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const entries = [...counts.entries()]
    .map(([value, count]) => ({ value, count, percent: percent(count, total) }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

  return {
    values: entries,
    top_value: entries[0] ?? null
  };
}

function arrayCountValues(events, field) {
  const values = events.flatMap((event) => event[field] ?? []);
  return countValues(values, events.length);
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function sourceTypesForEvent(event, sourcesById = new Map()) {
  const linkedTypes = (event.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)?.source_type).filter(Boolean);
  return unique(linkedTypes.length ? linkedTypes : event.source_types ?? []);
}

function sourceCountForEvent(event) {
  return unique(event.source_ids ?? []).length;
}

function isLimitedResponseNote(value) {
  const response = normalize(value);
  if (!response) return false;
  if (response.startsWith("the record summarizes ")) return true;
  if (response.startsWith("the record currently summarizes ")) return true;
  if (response.includes("does not independently evaluate investigative, disciplinary, or institutional response outcomes")) return true;
  if (response.includes("does not independently evaluate the institution's completed response")) return true;
  if (response.includes("does not evaluate the university's completed response")) return true;
  if (response.includes("does not evaluate harvard's response")) return true;
  return false;
}

function isAgencyDescribedAction(value) {
  const response = normalize(value);
  if (!response) return false;
  if (/^(ocr|the office for civil rights|the department of education|department of education|justice department|the justice department|a federal agency|the agency|the court|court|prosecutors?)\b/.test(response)) {
    return /\b(announced|said|entered|resolved|resolution agreement|agreement|finding|case|investigation|compliance obligation)\b/.test(response);
  }
  return /\b(according to ocr|according to the department of education|ocr announced|federal officials announced)\b/.test(response);
}

export function classifyResponseDepth(record) {
  const response = String(record.institutional_response ?? "").trim();
  if (!response) {
    return {
      code: "no_public_response_found",
      label: "No public response found",
      review_priority: "high",
      description: "The record has no stored public response text and should be checked before reuse."
    };
  }

  if (isLimitedResponseNote(response)) {
    return {
      code: "limited_public_response_note",
      label: "Limited public response note",
      review_priority: "high",
      description: "The record includes a bounded note rather than a substantive public institutional response."
    };
  }

  if (isAgencyDescribedAction(response)) {
    return {
      code: "agency_described_institutional_action",
      label: "Agency-described institutional action",
      review_priority: "medium",
      description: "The response text describes institutional action through a public agency or legal source."
    };
  }

  return {
    code: "direct_institutional_response",
    label: "Direct institutional response",
    review_priority: "lower",
    description: "The response text is stored as a direct public institutional statement or commitment."
  };
}

function reasonCodesForEvent(event, sourcesById) {
  const sourceTypes = sourceTypesForEvent(event, sourcesById);
  const communities = event.affected_communities ?? [];
  const responseDepth = classifyResponseDepth(event);
  const reasons = [];

  if (sourceCountForEvent(event) <= 1) reasons.push("single_source");
  if (sourceTypes.length > 0 && sourceTypes.every((type) => type === "Government dataset")) {
    reasons.push("government_dataset_only");
  }
  if (event.date_precision === "year") reasons.push("year_precision");
  if (event.confidence !== "High") reasons.push("medium_or_low_confidence");
  if (["limited_public_response_note", "no_public_response_found"].includes(responseDepth.code)) {
    reasons.push("response_depth_followup");
  }
  if (communities.some((community) => BROAD_COMMUNITY_LABELS.has(community))) {
    reasons.push("broad_community_label");
  }
  if (HIGH_STAKES_CATEGORIES.has(event.category)) reasons.push("high_stakes_category");
  if (!event.classification_rationale || !event.community_rationale || !event.confidence_rationale) {
    reasons.push("missing_explicit_rationale");
  }

  return reasons;
}

function reviewUrl(eventId) {
  return `/research-workspace/?record=${encodeURIComponent(eventId)}`;
}

function eventPriorityScore(event, sourcesById) {
  const reasons = reasonCodesForEvent(event, sourcesById);
  const responseDepth = classifyResponseDepth(event);
  let score = reasons.length;
  if (HIGH_STAKES_CATEGORIES.has(event.category)) score += 4;
  if (event.confidence === "High") score += 2;
  if (sourceCountForEvent(event) > 1) score += 2;
  if (event.date_precision === "day") score += 2;
  if (responseDepth.code === "direct_institutional_response") score += 2;
  if (responseDepth.code === "agency_described_institutional_action") score += 1;
  return score;
}

function queueRecord(event, sourcesById) {
  const responseDepth = classifyResponseDepth(event);
  return {
    event_id: event.id,
    school_id: event.school_id,
    category: event.category,
    confidence: event.confidence,
    date_precision: event.date_precision,
    source_count: sourceCountForEvent(event),
    source_types: sourceTypesForEvent(event, sourcesById),
    response_depth: responseDepth.code,
    reason_codes: reasonCodesForEvent(event, sourcesById),
    workspace_url: reviewUrl(event.id),
    packet_url: `${reviewUrl(event.id)}&packet=audit`
  };
}

function stableQueue(events, sourcesById, predicate, limit) {
  return events
    .filter((event) => predicate(event))
    .map((event) => ({ event, score: eventPriorityScore(event, sourcesById) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, limit)
    .map(({ event }) => queueRecord(event, sourcesById));
}

function responseDepthCounts(events) {
  const total = events.length;
  const counts = countValues(
    events.map((event) => classifyResponseDepth(event).code),
    total
  );
  return Object.fromEntries(counts.values.map((entry) => [entry.value, entry]));
}

export function buildRobustnessMetrics({ events, sources = [], manifest = {} }) {
  const sourcesById = sourceMap(sources);
  const totalEvents = events.length;
  const sourceTypes = events.flatMap((event) => sourceTypesForEvent(event, sourcesById));

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    purpose:
      "Dataset composition metrics for review prioritization. These metrics must not be used as comparative campus judgments, frequency measures, risk ratings, or approval claims.",
    totals: {
      events: totalEvents,
      sources: sources.length,
      single_source_events: events.filter((event) => sourceCountForEvent(event) <= 1).length,
      multi_source_events: events.filter((event) => sourceCountForEvent(event) > 1).length,
      records_with_explicit_rationales: events.filter(
        (event) => event.classification_rationale && event.community_rationale && event.confidence_rationale
      ).length
    },
    source_type_concentration: countValues(sourceTypes, totalEvents),
    confidence: Object.fromEntries(countValues(events.map((event) => event.confidence), totalEvents).values.map((entry) => [entry.value, entry])),
    date_precision: Object.fromEntries(countValues(events.map((event) => event.date_precision), totalEvents).values.map((entry) => [entry.value, entry])),
    community_concentration: arrayCountValues(events, "affected_communities"),
    category_concentration: countValues(events.map((event) => event.category), totalEvents),
    response_depth: responseDepthCounts(events),
    review_gaps: {
      single_source_government_dataset: events.filter((event) =>
        sourceTypesForEvent(event, sourcesById).every((type) => type === "Government dataset")
      ).length,
      year_precision: events.filter((event) => event.date_precision === "year").length,
      medium_or_low_confidence: events.filter((event) => event.confidence !== "High").length,
      limited_or_missing_response: events.filter((event) =>
        ["limited_public_response_note", "no_public_response_found"].includes(classifyResponseDepth(event).code)
      ).length,
      missing_explicit_rationales: events.filter(
        (event) => !event.classification_rationale || !event.community_rationale || !event.confidence_rationale
      ).length
    },
    known_limits: [
      "The current dataset is heavily shaped by source availability and import history.",
      "Composition metrics describe the records held by Campus Evidence Lab, not campus frequency or comparative risk.",
      "Year-level date precision and single-source records should be treated as follow-up priorities before public reuse.",
      "Response-depth labels describe stored public response text, not the adequacy of an institution's response."
    ]
  };
}

export function buildEvidenceDepthQueues({ events, sources = [], manifest = {}, limit = 25 }) {
  const sourcesById = sourceMap(sources);
  const queues = [
    {
      id: "single-source-government-dataset",
      label: "Single-source government dataset records",
      description: "Records that should receive source-text follow-up before being used as examples.",
      records: stableQueue(
        events,
        sourcesById,
        (event) => sourceCountForEvent(event) <= 1 && sourceTypesForEvent(event, sourcesById).every((type) => type === "Government dataset"),
        limit
      )
    },
    {
      id: "year-precision-followup",
      label: "Year-precision date follow-up",
      description: "Records where the date is currently represented at year precision.",
      records: stableQueue(events, sourcesById, (event) => event.date_precision === "year", limit)
    },
    {
      id: "response-depth-followup",
      label: "Response-depth follow-up",
      description: "Records with limited response notes or no stored public response text.",
      records: stableQueue(
        events,
        sourcesById,
        (event) => ["limited_public_response_note", "no_public_response_found"].includes(classifyResponseDepth(event).code),
        limit
      )
    },
    {
      id: "broad-community-label-followup",
      label: "Broad community-label follow-up",
      description: "Records using broad community labels that may deserve narrower source-text review.",
      records: stableQueue(
        events,
        sourcesById,
        (event) => (event.affected_communities ?? []).some((community) => BROAD_COMMUNITY_LABELS.has(community)),
        limit
      )
    },
    {
      id: "high-stakes-rationale-followup",
      label: "High-stakes rationale follow-up",
      description: "Records in legal, OCR, Title IX, disability, pregnancy, or athletic-equity categories.",
      records: stableQueue(events, sourcesById, (event) => HIGH_STAKES_CATEGORIES.has(event.category), limit)
    },
    {
      id: "medium-confidence-priority",
      label: "Medium/low confidence priority",
      description: "Records that should not be used as examples without checking the underlying source trail.",
      records: stableQueue(events, sourcesById, (event) => event.confidence !== "High", limit)
    }
  ];

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    method:
      "Deterministic priority queues generated from current local event/source metadata. Queue membership is a review-priority signal, not a claim about severity or prevalence.",
    queues
  };
}

export function selectGoldRecordCandidates({ events, sources = [], manifest = {}, limit = 100 }) {
  const sourcesById = sourceMap(sources);
  const records = [...events]
    .map((event) => ({ event, score: eventPriorityScore(event, sourcesById) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, limit)
    .map(({ event, score }) => ({
      event_id: event.id,
      school_id: event.school_id,
      status: "candidate_enriched_from_existing_metadata",
      review_score: score,
      response_depth: classifyResponseDepth(event).code,
      reason_codes: reasonCodesForEvent(event, sourcesById),
      workspace_url: reviewUrl(event.id),
      required_before_gold_status: [
        "Check linked public source text directly.",
        "Confirm classification, affected-community label, response-depth label, and limitations.",
        "Record any correction request or source gap in the public review ledger."
      ]
    }));

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    review_standard: "existing_metadata_evidence_depth_review",
    public_claim_limit:
      "Candidate status means the record was prioritized and enriched from existing local metadata; it does not mean outside validation or complete manual source re-review.",
    records
  };
}

export function buildReviewerChallengePack({ queues, limit = 25 }) {
  const seen = new Set();
  const records = [];
  for (const queue of queues.queues ?? []) {
    for (const record of queue.records ?? []) {
      if (seen.has(record.event_id)) continue;
      seen.add(record.event_id);
      records.push({
        event_id: record.event_id,
        school_id: record.school_id,
        source_count: record.source_count,
        source_types: record.source_types,
        response_depth: record.response_depth,
        challenge_reason_codes: unique([queue.id, ...record.reason_codes]),
        workspace_url: record.workspace_url,
        reviewer_prompt:
          "Try to identify what would make this record easier to verify, narrower, or more responsibly described."
      });
      if (records.length >= limit) break;
    }
    if (records.length >= limit) break;
  }

  return {
    snapshot_id: queues.snapshot_id ?? "unversioned",
    generated_at: queues.generated_at ?? "2026-06-03",
    method:
      "A deterministic challenge pack drawn from evidence-depth queues for reviewers who want to stress-test difficult or ambiguous records.",
    records
  };
}

export function containsProhibitedRobustnessClaim(value) {
  return PROHIBITED_CLAIM_PATTERN.test(String(value ?? ""));
}

export function selectEnrichmentBatch({ events, sources = [], manifest = {}, limit = 100 }) {
  const sourcesById = sourceMap(sources);
  const selected = [...events]
    .map((event) => ({ event, score: eventPriorityScore(event, sourcesById) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, limit)
    .map(({ event, score }) => ({
      event_id: event.id,
      school_id: event.school_id,
      review_score: score,
      review_status: "enriched_from_existing_metadata",
      enrichment: enrichmentFieldsForRecord(event, sources)
    }));

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    review_standard: "existing_metadata_evidence_depth_enrichment",
    public_claim_limit:
      "This batch adds explicit audit fields from existing local metadata only. It does not represent outside validation or complete source-text re-review.",
    records: selected
  };
}

export function enrichmentFieldsForRecord(event, sources = []) {
  const sourcesById = sourceMap(sources);
  const linkedSources = (event.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)).filter(Boolean);
  const sourceTypes = sourceTypesForEvent(event, sourcesById);
  const responseDepth = classifyResponseDepth(event);

  return {
    response_depth: responseDepth.code,
    classification_rationale:
      event.classification_rationale ||
      `Category "${event.category}" is retained as a documentation label from linked public source metadata; Campus Evidence Lab does not treat it as an independent legal finding.`,
    community_rationale:
      event.community_rationale ||
      `Affected community label${(event.affected_communities ?? []).length === 1 ? "" : "s"} (${unique(
        event.affected_communities ?? []
      ).join(", ")}) reflect public-source metadata and require source-text review before narrower claims.`,
    confidence_rationale:
      event.confidence_rationale ||
      `${event.confidence} confidence reflects ${event.verification_status.toLowerCase()} with ${sourceCountForEvent(
        event
      )} linked public source${sourceCountForEvent(event) === 1 ? "" : "s"} (${sourceTypes.join(", ") || "source type not recorded"}); it is not a severity or truth score.`,
    limitations: event.limitations ?? [
      "This enriched audit text was generated from existing local metadata and does not represent outside validation.",
      "Use the linked public source material before quoting this record as an example.",
      "The record must not be used as a comparative campus judgment, risk rating, severity rating, or frequency measure."
    ],
    field_support: event.field_support ?? [
      {
        field: "Category",
        source_ids: event.source_ids ?? [],
        rationale: `The category is supported by linked source metadata${linkedSources.length ? ` including ${linkedSources[0].title}` : ""}.`
      },
      {
        field: "Affected communities",
        source_ids: event.source_ids ?? [],
        rationale: "Affected-community labels are retained from public-source metadata and should be checked against source text before reuse."
      },
      {
        field: "Confidence",
        source_ids: event.source_ids ?? [],
        rationale: "Confidence is based on verification status and source support rather than severity, prevalence, or legal truth."
      },
      {
        field: "Institutional response",
        source_ids: event.source_ids ?? [],
        rationale: `Response-depth classification is "${responseDepth.code}" based on the stored public response text.`
      }
    ]
  };
}
