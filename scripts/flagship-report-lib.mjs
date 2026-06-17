import { sha256 } from "./lib.mjs";

const PUBLIC_CLAIM_LIMIT =
  "This artifact is for public evidence infrastructure review. It is not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.";

const GOLD_RECORD_CLAIM_LIMIT =
  "This gold v1 review packet is not outside validation, not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.";

const SELECTION_VERSION = "gold_v1_review_priority_2026_06_16";

const SELECTION_CRITERIA = [
  "Packet-backed challenge availability is prioritized so existing public challenge work is easy to inspect.",
  "Records with confidence, date precision, response-depth, or rationale review needs are prioritized as review packets.",
  "Source-type diversity is included so review packets are not limited to a single import or source family.",
  "Category and state diversity are used as deterministic tie-breakers for review coverage, not as comparative claims.",
  "Source count is included to expose both single-source review needs and multi-source rationale review."
];

const REQUIRED_FINDING_IDS = [
  "documentation_over_counts",
  "source_concentration_requires_review",
  "precision_is_a_review_dimension",
  "response_depth_prevents_false_clarity",
  "adversarial_review_is_infrastructure"
];

const PROHIBITED_PATTERNS = [
  /\bsafest\s+(?:school|campus|college|university)\b/i,
  /\bmost\s+dangerous\s+(?:school|campus|college|university)\b/i,
  /\b(?:school|campus|college|university)\s+ranking\b/i,
  /\branking\s+of\s+(?:schools|campuses|colleges|universities)\b/i,
  /\bbest\s+(?:campus|school|college|university)\b/i,
  /\bworst\s+(?:campus|school|college|university)\b/i,
  /\bexternally\s+validated\b/i,
  /\bvalidated\s+by\s+reviewers?\b/i,
  /\breviewer-validated\b/i,
  /\bindependently\s+audited\b/i,
  /\bexternal\s+audit\b/i,
  /\boutside\s+validated\b/i,
  /\boutside\s+validation\b/i,
  /\bapproved\s+by\b/i,
  /\bendorsed\s+by\b/i,
  /\bcertified\s+gold\s+standard\b/i,
  /\bgold\s+standard\b/i,
  /\bprevalence\s+estimate\b/i,
  /\bestimates?\s+prevalence\b/i,
  /\bincidence\s+rate\b/i,
  /\bfrequency\s+measurement\b/i,
  /\bfrequency\s+measure\b/i,
  /\brepresentative\s+sample\b/i,
  /\bcomprehensive\s+measurement\b/i,
  /\bcampus\s+safety\s+score\b/i,
  /\bsafety\s+score\b/i,
  /\bincident\s+severity\s+score\b/i,
  /\bseverity\s+score\b/i,
  /\blegal\s+finding\b/i
];

function snapshotId(manifest, fallback = "unversioned") {
  return manifest?.snapshot_id ?? fallback;
}

function generatedAt(manifest) {
  return manifest?.created_at ?? manifest?.generated_at ?? "2026-06-03";
}

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function schoolMap(schools) {
  return new Map((schools ?? []).map((school) => [school.id, school]));
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function challengePacketMap(challengeQueues) {
  return new Map((challengeQueues?.packets ?? []).map((packet) => [packet.event_id, packet]));
}

function evidenceLink(label, url, note) {
  return { label, url, note };
}

function challengeUrlForFinding(id) {
  return `/challenge/?finding=${encodeURIComponent(id)}`;
}

function eventUrl(eventId) {
  return `/events/${encodeURIComponent(eventId)}/`;
}

function schoolUrl(schoolId) {
  return `/schools/${encodeURIComponent(schoolId)}/`;
}

function sourceUrl(sourceId) {
  return `/sources/${encodeURIComponent(sourceId)}/`;
}

function workspaceUrl(eventId) {
  return `/research-workspace/?record_ids=${encodeURIComponent(eventId)}`;
}

function correctionUrl(eventId) {
  return `/submit/?type=correction&record_id=${encodeURIComponent(eventId)}`;
}

function packetChallengeUrl(event, packet) {
  return packet?.packet_url ?? `/challenge/?packet=${encodeURIComponent(event.id)}`;
}

function sourceSummaries(event, sourcesById) {
  return compact(event.source_ids).map((sourceId) => {
    const source = sourcesById.get(sourceId);
    return {
      id: sourceId,
      title: source?.title ?? sourceId,
      source_type: source?.source_type ?? null,
      source_url: sourceUrl(sourceId),
      external_url: source?.url ?? null
    };
  });
}

function missingRationale(fieldLabel) {
  return `${fieldLabel} is not explicitly captured in current metadata and is queued for review before reuse.`;
}

function responseNote(event) {
  const response = String(event.institutional_response ?? "").trim();
  if (response) {
    return `Stored institutional response text: ${response}`;
  }
  return "No public institutional response text is stored in current metadata; this is a review gap, not a claim about whether a response exists.";
}

function sanitizeConfidenceRationale(value, event) {
  const rationale = String(value ?? "").trim();
  if (!rationale) return missingRationale("Confidence rationale");
  if (/truth[- ]score/i.test(rationale)) {
    return `${event.confidence ?? "Stored"} confidence describes source support only; it is not a severity score, not a judgment about institutional conduct, not a prevalence estimate, and not independent factual adjudication.`;
  }
  return rationale;
}

function reviewQuestions(event) {
  return [
    "Does the linked public source support the current category language?",
    "Do the affected-community labels match the public source text at the right level of specificity?",
    "Does the confidence rationale describe source support without implying severity, prevalence, or legal truth?",
    "Is the stored institutional response text current, public, and bounded to what the source says?",
    `Does the ${event.date_precision ?? "stored"} date precision match what the source supports?`
  ];
}

function isNegated(text, matchIndex, matchText) {
  const prefixStart = Math.max(0, matchIndex - 240);
  const prefix = text.slice(prefixStart, matchIndex).toLowerCase();
  const boundary = Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf("\n"));
  const clause = prefix.slice(boundary + 1);
  const negationMatches = [...clause.matchAll(/\b(?:not|nor|without|never|cannot)\b/g)];
  const lastNegation = negationMatches.at(-1);
  if (!lastNegation) return false;

  const clauseStart = prefixStart + boundary + 1;
  const negationStart = clauseStart + lastNegation.index;
  const scopedThroughMatch = text
    .slice(negationStart, matchIndex + matchText.length)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return (
    /^not\s+(?:(?:a|an)\s+)?(?:independent\s+)?(?:ranking|safety scoring|safety score|severity score|prevalence estimate|legal finding|endorsement|external audit|external validation|outside validation)(?:(?:\s*,\s*|\s*,?\s+or\s+|\s*,?\s+and\s+)(?:(?:a|an)\s+)?(?:independent\s+)?(?:ranking|safety scoring|safety score|severity score|prevalence estimate|legal finding|endorsement|external audit|external validation|outside validation))*$/i.test(
      scopedThroughMatch
    ) ||
    /^not\s+treat\s+.{1,120}\s+as\s+(?:(?:a|an)\s+)?(?:independent\s+)?legal\s+finding$/i.test(scopedThroughMatch)
  );
}

function sourceTypesForEvent(event, sourcesById) {
  const linkedTypes = compact(event.source_ids).map((sourceId) => sourcesById.get(sourceId)?.source_type).filter(Boolean);
  return linkedTypes.length ? [...new Set(linkedTypes)] : [...new Set(compact(event.source_types))];
}

function primarySourceType(candidate) {
  return candidate.sourceTypes[0] ?? "Unspecified source type";
}

function responseNeedsReview(event) {
  const response = String(event.institutional_response ?? "").trim().toLowerCase();
  return (
    !response ||
    response.startsWith("the record summarizes ") ||
    response.includes("does not independently evaluate investigative, disciplinary, or institutional response outcomes")
  );
}

function reviewGapReasons(event, sourcesById, packet) {
  const reasons = [];
  const sourceCount = compact(event.source_ids).length;
  const sourceTypes = sourceTypesForEvent(event, sourcesById);
  if (packet) reasons.push("challenge packet available");
  if (event.date_precision === "year") reasons.push("year-level date precision");
  if (event.confidence !== "High") reasons.push("medium or low confidence");
  if (responseNeedsReview(event)) reasons.push("limited or missing stored response text");
  if (!event.classification_rationale || !event.community_rationale || !event.confidence_rationale) {
    reasons.push("missing explicit rationale metadata");
  }
  if (sourceCount <= 1) reasons.push("single-source record");
  if (sourceTypes.length > 1) reasons.push("multi-source type review");
  if (sourceTypes.includes("Government dataset")) reasons.push("government dataset source basis");
  return reasons;
}

function reviewScore(event, sourcesById, packet) {
  const sourceTypes = sourceTypesForEvent(event, sourcesById);
  let score = 0;
  if (packet) score += 1000;
  if (event.date_precision === "year") score += 80;
  if (event.confidence !== "High") score += 60;
  if (responseNeedsReview(event)) score += 60;
  if (!event.classification_rationale || !event.community_rationale || !event.confidence_rationale) score += 50;
  if (sourceTypes.includes("Government dataset")) score += 30;
  if (compact(event.source_ids).length > 1) score += 160;
  score += Math.min(sourceTypes.length, 3) * 12;
  score += Math.min(compact(event.source_ids).length, 5) * 8;
  if (event.classification_rationale && event.community_rationale && event.confidence_rationale) score += 100;
  if (event.date_precision === "day") score += 10;
  if (event.confidence === "High") score += 8;
  return score;
}

function selectedEvents(events, sourcesById, packetsByEventId, limit) {
  const candidates = events
    .map((event, index) => ({
      event,
      index,
      score: reviewScore(event, sourcesById, packetsByEventId.get(event.id)),
      sourceTypes: sourceTypesForEvent(event, sourcesById)
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.sourceTypes.length - a.sourceTypes.length ||
        String(a.event.category ?? "").localeCompare(String(b.event.category ?? "")) ||
        String(a.event.school_id ?? "").localeCompare(String(b.event.school_id ?? "")) ||
        a.index - b.index
    );

  const availableCategories = new Set(candidates.map((candidate) => candidate.event.category).filter(Boolean));
  const availableSourceTypes = new Set(candidates.map(primarySourceType).filter(Boolean));
  const categoryCap = Math.max(1, Math.ceil(limit / Math.max(1, Math.min(availableCategories.size, 5))));
  const sourceTypeCap = Math.max(1, Math.ceil(limit / Math.max(1, Math.min(availableSourceTypes.size, 5))));
  const schoolCap = Math.max(1, Math.ceil(limit / Math.max(1, Math.min(new Set(candidates.map((candidate) => candidate.event.school_id)).size, 12))));

  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = {};
  const sourceTypeCounts = {};
  const schoolCounts = {};

  function canAdd(candidate, caps) {
    if (selectedIds.has(candidate.event.id)) return false;
    const category = candidate.event.category ?? "Unspecified category";
    const sourceType = primarySourceType(candidate);
    const schoolId = candidate.event.school_id ?? "Unspecified school";
    return (
      (categoryCounts[category] ?? 0) < caps.category &&
      (sourceTypeCounts[sourceType] ?? 0) < caps.sourceType &&
      (schoolCounts[schoolId] ?? 0) < caps.school
    );
  }

  function add(candidate) {
    selected.push(candidate);
    selectedIds.add(candidate.event.id);
    const category = candidate.event.category ?? "Unspecified category";
    const sourceType = primarySourceType(candidate);
    const schoolId = candidate.event.school_id ?? "Unspecified school";
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;
    schoolCounts[schoolId] = (schoolCounts[schoolId] ?? 0) + 1;
  }

  for (const caps of [
    { category: categoryCap, sourceType: sourceTypeCap, school: schoolCap },
    { category: categoryCap * 2, sourceType: sourceTypeCap * 2, school: schoolCap * 2 },
    { category: limit, sourceType: limit, school: limit }
  ]) {
    for (const candidate of candidates) {
      if (selected.length >= limit) return selected;
      if (canAdd(candidate, caps)) add(candidate);
    }
  }

  return selected;
}

function selectedExistingGoldEvents(existingGoldRecordV1, events, sourcesById, packetsByEventId, limit) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const selectedIds = [];
  const seenIds = new Set();

  for (const record of existingGoldRecordV1?.records ?? []) {
    const eventId = record?.event_id;
    if (!eventId || seenIds.has(eventId)) continue;
    seenIds.add(eventId);
    selectedIds.push(eventId);
    if (selectedIds.length >= limit) break;
  }

  return selectedIds
    .map((eventId) => eventById.get(eventId))
    .filter(Boolean)
    .map((event) => ({
      event,
      score: reviewScore(event, sourcesById, packetsByEventId.get(event.id)),
      sourceTypes: sourceTypesForEvent(event, sourcesById)
    }));
}

function countBy(items, getValue) {
  const counts = {};
  for (const item of items) {
    for (const value of compact([getValue(item)].flat())) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

function coverageSummary(records) {
  return {
    total_records: records.length,
    categories: countBy(records, (record) => record.category),
    source_types: countBy(records, (record) => record.source_basis.map((source) => source.source_type)),
    confidence: countBy(records, (record) => record.confidence),
    date_precision: countBy(records, (record) => record.date_precision),
    challenge_linked: {
      true: records.filter((record) => record.challenge_url.startsWith("/challenge/?packet=")).length,
      false: records.filter((record) => !record.challenge_url.startsWith("/challenge/?packet=")).length
    },
    states: countBy(records, (record) => record.state)
  };
}

function sameCounts(actual, expected) {
  return JSON.stringify(actual ?? {}) === JSON.stringify(expected ?? {});
}

function assertLocalUrl(value, label, errors) {
  if (!value || !String(value).startsWith("/")) {
    errors.push(`${label} must be a local public URL`);
  }
}

function assertClaimBoundary(value, label, errors) {
  const text = String(value ?? "");
  for (const token of ["ranking", "safety", "severity", "prevalence", "legal", "endorsement", "external"]) {
    if (!new RegExp(`not .*${token}`, "i").test(text)) {
      errors.push(`${label} must explicitly say it is not ${token}-based`);
    }
  }
  if (containsProhibitedFlagshipClaim(text)) {
    errors.push(`${label} contains prohibited flagship overclaim language`);
  }
}

export function containsProhibitedFlagshipClaim(value) {
  const text = String(value ?? "");
  for (const pattern of PROHIBITED_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(globalPattern)) {
      if (!isNegated(text, match.index ?? 0, match[0])) return true;
    }
  }
  return false;
}

export function buildFlagshipReport({ events, schools = [], sources = [], robustnessMetrics, challengeQueues = {}, manifest = {} }) {
  const topSourceType = robustnessMetrics?.source_type_concentration?.top_value ?? {};

  return {
    id: "flagship_public_evidence_infrastructure_v1",
    title: "The Public Evidence Infrastructure Gap",
    snapshot_id: snapshotId(manifest, robustnessMetrics?.snapshot_id),
    snapshot_hash: manifest?.hashes?.full_snapshot ?? null,
    generated_at: generatedAt(manifest),
    thesis:
      "Campus Evidence Lab is evidence infrastructure for public-source review: it makes record basis, review gaps, correction paths, and challenge queues inspectable without turning documentation into institutional judgment.",
    public_claim_limit: PUBLIC_CLAIM_LIMIT,
    recommended_next_reviews: [
      "Review year-level date precision records before quoting event timing.",
      "Review limited or missing stored institutional response text before making response descriptions.",
      "Review source concentration and single-source records before public reuse.",
      "Route packet-backed records through the challenge workflow before treating metadata as settled."
    ],
    audience_paths: [
      {
        audience: "Researchers",
        path: "/research-workspace/",
        use: "Inspect record metadata, source basis, and review queues."
      },
      {
        audience: "Reviewers",
        path: "/challenge/",
        use: "Submit public counterevidence or correction packets."
      },
      {
        audience: "Readers",
        path: "/methodology/",
        use: "Understand public-source boundaries and claim limits."
      }
    ],
    inputs: {
      events: events.length,
      schools: schools.length,
      sources: sources.length,
      challenge_packets: challengeQueues?.packets?.length ?? 0
    },
    findings: [
      {
        id: "documentation_over_counts",
        title: "Documentation over counts",
        summary:
          "The useful public claim is that records are inspectable with linked data and manifest context; the event count is dataset scope, not a measure of campus conditions.",
        metric: { label: "current event records", value: events.length },
        evidence_links: [
          evidenceLink("Events dataset", "/data/events.json", "Current public event records used by the artifact."),
          evidenceLink("Snapshot manifest", "/data/snapshot-manifest.json", "Snapshot identifier, totals, and hashes for review context.")
        ],
        challenge_url: challengeUrlForFinding("documentation_over_counts"),
        use_limit: PUBLIC_CLAIM_LIMIT
      },
      {
        id: "source_concentration_requires_review",
        title: "Source concentration requires review",
        summary:
          "The largest source-type bucket is a review-planning signal because source mix shapes what is documented in the current records.",
        metric: {
          label: "top source type in current records",
          value: topSourceType.value ?? null,
          count: topSourceType.count ?? 0,
          percent: topSourceType.percent ?? null
        },
        evidence_links: [
          evidenceLink("Robustness metrics", "/data/robustness-metrics.json", "Composition metrics for the current dataset."),
          evidenceLink("Evidence capsules", "/data/evidence-capsules.json", "Record-level evidence summaries used for review.")
        ],
        challenge_url: challengeUrlForFinding("source_concentration_requires_review"),
        use_limit: PUBLIC_CLAIM_LIMIT
      },
      {
        id: "precision_is_a_review_dimension",
        title: "Precision is a review dimension",
        summary:
          "Year-level date precision is exposed as a review queue dimension so public reuse can distinguish exact dates from broader source-supported timing.",
        metric: { label: "records with year-level date precision", value: robustnessMetrics?.review_gaps?.year_precision ?? 0 },
        evidence_links: [
          evidenceLink("Evidence-depth queues", "/data/evidence-depth-queues.json", "Queues that route date precision gaps to review.")
        ],
        challenge_url: challengeUrlForFinding("precision_is_a_review_dimension"),
        use_limit: PUBLIC_CLAIM_LIMIT
      },
      {
        id: "response_depth_prevents_false_clarity",
        title: "Response depth prevents false clarity",
        summary:
          "Limited or missing stored response text is shown as a metadata review gap so absence or brevity is not converted into a conclusion about institutional action.",
        metric: {
          label: "records with limited or missing stored response text",
          value: robustnessMetrics?.review_gaps?.limited_or_missing_response ?? 0
        },
        evidence_links: [
          evidenceLink("Robustness metrics", "/data/robustness-metrics.json", "Response-depth review-gap counts for current records.")
        ],
        challenge_url: challengeUrlForFinding("response_depth_prevents_false_clarity"),
        use_limit: PUBLIC_CLAIM_LIMIT
      },
      {
        id: "adversarial_review_is_infrastructure",
        title: "Adversarial review is infrastructure",
        summary:
          "Challenge packets turn record weaknesses into inspectable correction workflows instead of treating the dataset as settled.",
        metric: { label: "current challenge packets", value: challengeQueues?.packets?.length ?? 0 },
        evidence_links: [
          evidenceLink("Challenge queues", "/data/challenge-queues.json", "Current packets available for public challenge workflow."),
          evidenceLink("Challenge ledger", "/data/challenge-ledger.json", "Ledger structure for recording challenge outcomes.")
        ],
        challenge_url: challengeUrlForFinding("adversarial_review_is_infrastructure"),
        use_limit: PUBLIC_CLAIM_LIMIT
      }
    ]
  };
}

export function buildGoldRecordV1({ events, schools = [], sources = [], challengeQueues = {}, existingGoldRecordV1 = null, manifest = {}, limit = 25 }) {
  const schoolsById = schoolMap(schools);
  const sourcesById = sourceMap(sources);
  const packetsByEventId = challengePacketMap(challengeQueues);
  const selectedGoldEvents = existingGoldRecordV1?.records?.length
    ? selectedExistingGoldEvents(existingGoldRecordV1, events, sourcesById, packetsByEventId, limit)
    : selectedEvents(events, sourcesById, packetsByEventId, limit);
  const records = selectedGoldEvents.map(({ event, score }) => {
    const school = schoolsById.get(event.school_id);
    const packet = packetsByEventId.get(event.id);
    const selectionReasons = reviewGapReasons(event, sourcesById, packet);

    return {
      id: `gold_v1_${event.id}`,
      event_id: event.id,
      school_id: event.school_id,
      school_name: school?.name ?? event.school_id,
      state: school?.state ?? null,
      status: "gold_v1_review_packet",
      review_score: score,
      selection_reason: selectionReasons.join("; ") || "deterministic review coverage sample",
      category: event.category,
      affected_communities: event.affected_communities ?? [],
      confidence: event.confidence,
      date: event.date,
      date_precision: event.date_precision,
      event_url: eventUrl(event.id),
      school_url: schoolUrl(event.school_id),
      workspace_url: packet?.workspace_url ?? workspaceUrl(event.id),
      correction_url: packet?.submission_packet_url ?? correctionUrl(event.id),
      challenge_url: packet ? packetChallengeUrl(event, packet) : `/challenge/?record=${encodeURIComponent(event.id)}`,
      source_basis: sourceSummaries(event, sourcesById),
      rationale_packet: {
        classification_rationale: event.classification_rationale || missingRationale("Classification rationale"),
        community_rationale: event.community_rationale || missingRationale("Community rationale"),
        confidence_rationale: sanitizeConfidenceRationale(event.confidence_rationale, event),
        response_note: responseNote(event)
      },
      review_questions: reviewQuestions(event),
      public_claim_limit: GOLD_RECORD_CLAIM_LIMIT
    };
  });

  return {
    id: "gold_record_v1_review_packets",
    snapshot_id: snapshotId(manifest),
    generated_at: generatedAt(manifest),
    status: "review_packets",
    public_claim_limit: GOLD_RECORD_CLAIM_LIMIT,
    selection_version: SELECTION_VERSION,
    selection_criteria: SELECTION_CRITERIA,
    coverage_summary: coverageSummary(records),
    selection_note:
      "Records are selected by deterministic review-priority criteria for packet creation; order is not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.",
    records
  };
}

export function validateFlagshipArtifacts({ report, gold, events = [], schools = [], sources = [], challengeQueues = {}, robustnessMetrics = {}, manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const schoolIds = new Set(schools.map((school) => school.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const sourcesById = sourceMap(sources);
  const packetEventIds = new Set((challengeQueues.packets ?? []).map((packet) => packet.event_id));
  const expectedSnapshotId = snapshotId(manifest, robustnessMetrics?.snapshot_id);

  if (containsProhibitedFlagshipClaim(JSON.stringify(report))) errors.push("flagship-report contains prohibited ranking, safety, prevalence, endorsement, or external-validation language");
  if (containsProhibitedFlagshipClaim(JSON.stringify(gold))) errors.push("gold-record-v1 contains prohibited ranking, safety, prevalence, endorsement, or external-validation language");

  if (report.id !== "flagship_public_evidence_infrastructure_v1") errors.push("flagship-report id must be flagship_public_evidence_infrastructure_v1");
  if (!report.title) errors.push("flagship-report missing title");
  if (report.snapshot_id !== expectedSnapshotId) errors.push("flagship-report snapshot_id must match snapshot manifest");
  if ((manifest?.hashes?.full_snapshot ?? null) !== null && report.snapshot_hash !== manifest.hashes.full_snapshot) {
    errors.push("flagship-report snapshot_hash must match snapshot manifest full_snapshot");
  }
  if (manifest?.hashes?.flagship_report !== undefined && manifest.hashes.flagship_report !== sha256(report)) errors.push("snapshot manifest hashes.flagship_report is stale");
  if (manifest?.created_at && report.generated_at !== manifest.created_at) errors.push("flagship-report generated_at must match snapshot manifest created_at");
  if (report.inputs?.events !== events.length) errors.push("flagship-report inputs.events must match event count");
  if (report.inputs?.schools !== schools.length) errors.push("flagship-report inputs.schools must match school count");
  if (report.inputs?.sources !== sources.length) errors.push("flagship-report inputs.sources must match source count");
  if (report.inputs?.challenge_packets !== (challengeQueues.packets ?? []).length) errors.push("flagship-report inputs.challenge_packets must match challenge packet count");
  assertClaimBoundary(report.public_claim_limit, "flagship-report public_claim_limit", errors);

  const findingIds = (report.findings ?? []).map((finding) => finding.id);
  if (JSON.stringify(findingIds) !== JSON.stringify(REQUIRED_FINDING_IDS)) {
    errors.push("flagship-report findings must use the required deterministic finding IDs");
  }
  for (const finding of report.findings ?? []) {
    for (const field of ["id", "title", "summary", "metric", "challenge_url", "use_limit"]) {
      if (!finding[field]) errors.push(`flagship-report finding ${finding.id ?? "unknown"} missing ${field}`);
    }
    assertLocalUrl(finding.challenge_url, `flagship-report finding ${finding.id} challenge_url`, errors);
    assertClaimBoundary(finding.use_limit, `flagship-report finding ${finding.id} use_limit`, errors);
    if (!Array.isArray(finding.evidence_links) || finding.evidence_links.length === 0) {
      errors.push(`flagship-report finding ${finding.id} missing evidence_links`);
    }
    for (const [index, link] of (finding.evidence_links ?? []).entries()) {
      if (!link.label || !link.note) errors.push(`flagship-report finding ${finding.id} evidence_links[${index}] missing label or note`);
      assertLocalUrl(link.url, `flagship-report finding ${finding.id} evidence_links[${index}].url`, errors);
    }
  }

  const sourceFinding = (report.findings ?? []).find((finding) => finding.id === "source_concentration_requires_review");
  if (sourceFinding) {
    const topSourceType = robustnessMetrics?.source_type_concentration?.top_value ?? {};
    if (sourceFinding.metric?.value !== (topSourceType.value ?? null)) errors.push("flagship-report source concentration finding metric.value is stale");
    if (sourceFinding.metric?.count !== (topSourceType.count ?? 0)) errors.push("flagship-report source concentration finding metric.count is stale");
  }

  if (gold.id !== "gold_record_v1_review_packets") errors.push("gold-record-v1 id must be gold_record_v1_review_packets");
  if (gold.snapshot_id !== expectedSnapshotId) errors.push("gold-record-v1 snapshot_id must match snapshot manifest");
  if (manifest?.hashes?.gold_record_v1 !== undefined && manifest.hashes.gold_record_v1 !== sha256(gold)) errors.push("snapshot manifest hashes.gold_record_v1 is stale");
  if (manifest?.created_at && gold.generated_at !== manifest.created_at) errors.push("gold-record-v1 generated_at must match snapshot manifest created_at");
  if (gold.status !== "review_packets") errors.push("gold-record-v1 status must be review_packets");
  if (gold.selection_version !== SELECTION_VERSION) errors.push(`gold-record-v1 selection_version must be ${SELECTION_VERSION}`);
  assertClaimBoundary(gold.public_claim_limit, "gold-record-v1 public_claim_limit", errors);
  if (!Array.isArray(gold.selection_criteria) || gold.selection_criteria.length !== SELECTION_CRITERIA.length) {
    errors.push("gold-record-v1 selection_criteria must include the deterministic criteria");
  }
  if (!Array.isArray(gold.records) || gold.records.length === 0 || gold.records.length > 25) {
    errors.push("gold-record-v1 must include 1-25 records");
  }

  const goldRecordIds = new Set();
  for (const record of gold.records ?? []) {
    if (goldRecordIds.has(record.event_id)) errors.push(`gold-record-v1 duplicate event ${record.event_id}`);
    goldRecordIds.add(record.event_id);
    if (!eventIds.has(record.event_id)) errors.push(`gold-record-v1 references unknown event ${record.event_id}`);
    if (!schoolIds.has(record.school_id)) errors.push(`gold-record-v1 ${record.event_id} references unknown school ${record.school_id}`);
    if (record.id !== `gold_v1_${record.event_id}`) errors.push(`gold-record-v1 ${record.event_id} has invalid id`);
    if (record.status !== "gold_v1_review_packet") errors.push(`gold-record-v1 ${record.event_id} has unsupported status ${record.status}`);
    if (!Number.isFinite(record.review_score)) errors.push(`gold-record-v1 ${record.event_id} missing numeric review_score`);
    if (!record.selection_reason) errors.push(`gold-record-v1 ${record.event_id} missing selection_reason`);
    if (record.event_url !== eventUrl(record.event_id)) errors.push(`gold-record-v1 ${record.event_id} event_url must match public event route`);
    if (record.school_url !== schoolUrl(record.school_id)) errors.push(`gold-record-v1 ${record.event_id} school_url must match public school route`);
    if (!record.workspace_url?.includes(`record_ids=${encodeURIComponent(record.event_id)}`)) errors.push(`gold-record-v1 ${record.event_id} workspace_url must select record_ids`);
    if (!record.correction_url?.includes(`record_id=${encodeURIComponent(record.event_id)}`)) errors.push(`gold-record-v1 ${record.event_id} correction_url must prefill record_id`);
    const expectedChallengeUrl = packetEventIds.has(record.event_id) ? `/challenge/?packet=${encodeURIComponent(record.event_id)}` : `/challenge/?record=${encodeURIComponent(record.event_id)}`;
    if (record.challenge_url !== expectedChallengeUrl) errors.push(`gold-record-v1 ${record.event_id} challenge_url must match packet or record challenge route`);
    if (!Array.isArray(record.source_basis) || record.source_basis.length === 0) {
      errors.push(`gold-record-v1 ${record.event_id} missing source_basis`);
    }
    for (const source of record.source_basis ?? []) {
      const canonical = sourcesById.get(source.id);
      if (!sourceIds.has(source.id)) errors.push(`gold-record-v1 ${record.event_id} references unknown source ${source.id}`);
      if (source.source_url !== sourceUrl(source.id)) errors.push(`gold-record-v1 ${record.event_id} source ${source.id} source_url must match source route`);
      if (canonical && source.external_url !== canonical.url) errors.push(`gold-record-v1 ${record.event_id} source ${source.id} external_url must match source URL`);
      if (!source.title || !source.source_type) errors.push(`gold-record-v1 ${record.event_id} source ${source.id} missing title or source_type`);
    }
    for (const field of ["classification_rationale", "community_rationale", "confidence_rationale", "response_note"]) {
      if (!record.rationale_packet?.[field]) errors.push(`gold-record-v1 ${record.event_id} rationale_packet missing ${field}`);
    }
    if (/truth[- ]score/i.test(JSON.stringify(record.rationale_packet ?? {}))) errors.push(`gold-record-v1 ${record.event_id} rationale_packet must not use truth-score language`);
    if (!Array.isArray(record.review_questions) || record.review_questions.length < 4) errors.push(`gold-record-v1 ${record.event_id} must include review_questions`);
    assertClaimBoundary(record.public_claim_limit, `gold-record-v1 ${record.event_id} public_claim_limit`, errors);
  }

  const expectedCoverage = coverageSummary(gold.records ?? []);
  for (const key of ["categories", "source_types", "confidence", "date_precision", "states", "challenge_linked"]) {
    if (!sameCounts(gold.coverage_summary?.[key], expectedCoverage[key])) {
      errors.push(`gold-record-v1 coverage_summary.${key} is stale`);
    }
  }
  if (gold.coverage_summary?.total_records !== (gold.records ?? []).length) {
    errors.push("gold-record-v1 coverage_summary.total_records is stale");
  }
  if (manifest?.totals?.flagship_findings !== undefined && manifest.totals.flagship_findings !== (report.findings ?? []).length) {
    errors.push("snapshot manifest totals.flagship_findings is stale");
  }
  if (manifest?.totals?.gold_record_v1_packets !== undefined && manifest.totals.gold_record_v1_packets !== (gold.records ?? []).length) {
    errors.push("snapshot manifest totals.gold_record_v1_packets is stale");
  }

  const availableCategories = new Set(events.map((event) => event.category).filter(Boolean));
  const availableSourceTypes = new Set(events.flatMap((event) => sourceTypesForEvent(event, sourcesById)));
  if ((gold.records ?? []).length >= 10 && availableCategories.size >= 3 && Object.keys(gold.coverage_summary?.categories ?? {}).length < 3) {
    errors.push("gold-record-v1 must include at least three categories when the dataset supports it");
  }
  if ((gold.records ?? []).length >= 10 && availableSourceTypes.size >= 3 && Object.keys(gold.coverage_summary?.source_types ?? {}).length < 3) {
    errors.push("gold-record-v1 must include at least three source types when the dataset supports it");
  }

  return errors;
}
