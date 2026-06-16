const PUBLIC_CLAIM_LIMIT =
  "This artifact is for public evidence infrastructure review. It is not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.";

const GOLD_RECORD_CLAIM_LIMIT =
  "This gold v1 review packet is not outside validation, not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.";

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
      url: source?.url ?? null
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

function reviewQuestions(event) {
  return [
    "Does the linked public source support the current category language?",
    "Do the affected-community labels match the public source text at the right level of specificity?",
    "Does the confidence rationale describe source support without implying severity, prevalence, or legal truth?",
    "Is the stored institutional response text current, public, and bounded to what the source says?",
    `Does the ${event.date_precision ?? "stored"} date precision match what the source supports?`
  ];
}

function isNegated(text, matchIndex) {
  const prefix = text.slice(Math.max(0, matchIndex - 240), matchIndex).toLowerCase();
  const boundary = Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf("\n"));
  const clause = prefix.slice(boundary + 1);
  const negationMatches = [...clause.matchAll(/\b(?:not|nor|without|never|cannot)\b/g)];
  const lastNegation = negationMatches.at(-1);
  if (!lastNegation) return false;

  const scoped = clause.slice(lastNegation.index);
  return !/\b(?:but|however|although|though|except|yet)\b/.test(scoped);
}

export function containsProhibitedFlagshipClaim(value) {
  const text = String(value ?? "");
  for (const pattern of PROHIBITED_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(globalPattern)) {
      if (!isNegated(text, match.index ?? 0)) return true;
    }
  }
  return false;
}

export function buildFlagshipReport({ events, schools = [], sources = [], robustnessMetrics, challengeQueues = {}, manifest = {} }) {
  const topSourceType = robustnessMetrics?.source_type_concentration?.top_value ?? {};

  return {
    id: "flagship_public_evidence_infrastructure_v1",
    snapshot_id: snapshotId(manifest, robustnessMetrics?.snapshot_id),
    generated_at: generatedAt(manifest),
    thesis:
      "Campus Evidence Lab is evidence infrastructure for public-source review: it makes record basis, review gaps, correction paths, and challenge queues inspectable without turning documentation into institutional judgment.",
    public_claim_limit: PUBLIC_CLAIM_LIMIT,
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

export function buildGoldRecordV1({ events, schools = [], sources = [], challengeQueues = {}, manifest = {}, limit = 25 }) {
  const schoolsById = schoolMap(schools);
  const sourcesById = sourceMap(sources);
  const packetsByEventId = challengePacketMap(challengeQueues);
  const records = events.slice(0, limit).map((event) => {
    const school = schoolsById.get(event.school_id);
    const packet = packetsByEventId.get(event.id);

    return {
      id: `gold_v1_${event.id}`,
      event_id: event.id,
      school_id: event.school_id,
      school_name: school?.name ?? event.school_id,
      state: school?.state ?? null,
      status: "gold_v1_review_packet",
      category: event.category,
      affected_communities: event.affected_communities ?? [],
      confidence: event.confidence,
      date: event.date,
      date_precision: event.date_precision,
      event_url: eventUrl(event.id),
      workspace_url: packet?.workspace_url ?? workspaceUrl(event.id),
      correction_url: packet?.submission_packet_url ?? correctionUrl(event.id),
      challenge_url: packet ? packetChallengeUrl(event, packet) : null,
      source_basis: sourceSummaries(event, sourcesById),
      rationale_packet: {
        classification_rationale: event.classification_rationale || missingRationale("Classification rationale"),
        community_rationale: event.community_rationale || missingRationale("Community rationale"),
        confidence_rationale: event.confidence_rationale || missingRationale("Confidence rationale"),
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
    selection_note:
      "Records are selected in deterministic dataset order for review packets; order is not a ranking, not a safety score, not a severity score, not a prevalence estimate, not a legal finding, not an endorsement, and not external validation.",
    records
  };
}
