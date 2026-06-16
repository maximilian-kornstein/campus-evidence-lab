const PROHIBITED_CHALLENGE_PATTERN =
  /externally audited|external audit|externally validated|outside validated|validated by|approved by|endorsed by|safest|most dangerous|best school|worst school|school ranking|safety score|severity score|prevalence estimate|frequency measure/gi;

const STANDARD_DEFINITIONS = [
  {
    id: "category_challenge",
    label: "Category challenge",
    applies_when: "The assigned event category may be broader or different from what the linked public source supports.",
    acceptable_counterevidence: [
      "A public source showing the event belongs in a narrower or different Campus Evidence Lab category.",
      "A public source showing the current category relies on language not present in the source basis."
    ],
    insufficient_counterevidence: [
      "A disagreement with the category without a public source.",
      "A preference for different terminology that does not change the source-supported meaning."
    ],
    possible_outcomes: ["category_changed", "category_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["category", "classification_rationale", "limitations"],
    no_overclaiming_warning: "A category challenge is about source fit, not incident severity or institutional quality."
  },
  {
    id: "affected_community_challenge",
    label: "Affected-community challenge",
    applies_when: "Affected-community labels may be broader than the public source supports.",
    acceptable_counterevidence: [
      "A public source identifying a narrower affected community.",
      "A public source showing that a listed community is not supported by the record basis."
    ],
    insufficient_counterevidence: [
      "A claim that the event affected a different group without public support.",
      "A general objection to group labels without evidence tied to the record."
    ],
    possible_outcomes: ["community_label_changed", "community_label_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["affected_communities", "community_rationale", "limitations"],
    no_overclaiming_warning: "Affected-community labels describe source-backed record metadata, not prevalence or campus climate."
  },
  {
    id: "confidence_challenge",
    label: "Confidence challenge",
    applies_when: "The confidence label may not match the current source basis or rationale.",
    acceptable_counterevidence: [
      "A public source adding independent support for the same record.",
      "A public source or source limitation showing current confidence should be lower."
    ],
    insufficient_counterevidence: [
      "A severity argument.",
      "An assertion that a record is important without source-basis evidence."
    ],
    possible_outcomes: ["confidence_raised", "confidence_lowered", "confidence_rationale_updated", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["confidence", "confidence_rationale", "field_support", "limitations"],
    no_overclaiming_warning: "Confidence describes source support, not truth, severity, or legal findings."
  },
  {
    id: "date_precision_challenge",
    label: "Date-precision challenge",
    applies_when: "The date precision may be more exact or less exact than the public source supports.",
    acceptable_counterevidence: [
      "A public source identifying the exact day, month, or only year supported by the record.",
      "A public source showing the current date refers to publication, resolution, or reporting period rather than event timing."
    ],
    insufficient_counterevidence: [
      "A date guess from secondary discussion.",
      "A date from a non-public source that cannot be reviewed."
    ],
    possible_outcomes: ["date_changed", "date_precision_narrowed", "date_precision_broadened", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["date", "date_precision", "description", "limitations"],
    no_overclaiming_warning: "Date precision is a source-support field, not a claim that the underlying event occurred on a more exact date than sources allow."
  },
  {
    id: "institutional_response_challenge",
    label: "Institutional-response challenge",
    applies_when: "The institutional response text or response-depth label may be incomplete, generic, or overstated.",
    acceptable_counterevidence: [
      "A direct public institutional statement or archived page.",
      "A public agency document describing institutional action.",
      "A public source showing no public institutional response was found after reasonable search."
    ],
    insufficient_counterevidence: [
      "Private correspondence.",
      "A general belief that the institution must have responded."
    ],
    possible_outcomes: ["response_text_updated", "response_depth_changed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["institutional_response", "response_depth", "response_date", "limitations"],
    no_overclaiming_warning: "Response depth describes public documentation, not whether an institution acted appropriately."
  },
  {
    id: "legal_status_challenge",
    label: "Legal-status challenge",
    applies_when: "Legal, OCR, procedural, or administrative status may be outdated, imprecise, or too broad.",
    acceptable_counterevidence: [
      "A public docket, OCR page, agency release, court filing, or institutional document updating status.",
      "A public source showing that the current status text should be narrower."
    ],
    insufficient_counterevidence: [
      "A legal conclusion without a public source.",
      "A news summary that does not update the procedural status."
    ],
    possible_outcomes: ["legal_status_updated", "legal_status_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["legal_status", "description", "limitations"],
    no_overclaiming_warning: "Legal-status text is procedural metadata, not a legal finding by Campus Evidence Lab."
  },
  {
    id: "source_sufficiency_challenge",
    label: "Source-sufficiency challenge",
    applies_when: "The record may need another source, a better locator, or narrower language.",
    acceptable_counterevidence: [
      "A better public URL, archived copy, source page, data file locator, or source excerpt pointer.",
      "A public source showing current language should be narrowed."
    ],
    insufficient_counterevidence: [
      "A broken-link report without an alternate public locator.",
      "A source that does not refer to the same record."
    ],
    possible_outcomes: ["source_added", "source_locator_updated", "language_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["source_ids", "description", "field_support", "limitations"],
    no_overclaiming_warning: "Source sufficiency is about reviewability of the record, not whether the underlying event is more or less serious."
  },
  {
    id: "inclusion_challenge",
    label: "Inclusion challenge",
    applies_when: "The record may not satisfy the public-source inclusion rule or may be outside current scope.",
    acceptable_counterevidence: [
      "A public source showing the record is outside the current civil-rights or public-source scope.",
      "A public correction showing the source basis does not support inclusion."
    ],
    insufficient_counterevidence: [
      "A request to remove an uncomfortable record without source-basis evidence.",
      "A disagreement with public reporting alone."
    ],
    possible_outcomes: ["record_removed", "record_archived", "record_limited", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["verification_status", "limitations", "changelog"],
    no_overclaiming_warning: "Inclusion means the record fits current source and scope rules; it is not a finding of legal truth."
  }
];

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function eventMap(events) {
  return new Map((events ?? []).map((event) => [event.id, event]));
}

function schoolMap(schools) {
  return new Map((schools ?? []).map((school) => [school.id, school]));
}

function standardsMap(standards) {
  return new Map((standards.standards ?? []).map((standard) => [standard.id, standard]));
}

function isNegatedClaim(text, matchIndex) {
  const prefix = text.slice(Math.max(0, matchIndex - 200), matchIndex).toLowerCase();
  const sameSentencePrefix = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
  const negationMatch = /\b(?:not|nor|without|cannot|never)\b/g;
  const matches = [...sameSentencePrefix.matchAll(negationMatch)];
  const lastNegation = matches.at(-1);
  if (!lastNegation) return false;

  const scopedPrefix = sameSentencePrefix.slice(lastNegation.index);
  if (/\b(?:but|however|though|although|except|yet)\b/.test(scopedPrefix)) return false;
  return /^(?:not|nor|without|cannot|never)\s+(?:(?:a|an|the|any)\s+)?(?:(?:ranking|score|safety|severity|prevalence|estimate|endorsement|external|audit|validation|validated|legal|finding|truth|claim|measurement|measure|school|best|worst|safest|most|dangerous|submissions)[,\s]*(?:or|and)?\s*){0,20}$/.test(scopedPrefix.trimStart());
}

function reasonCodesForCapsule(capsule) {
  const codes = [];
  if ((capsule.source_basis?.source_count ?? 0) <= 1) codes.push("single_source");
  if (capsule.review_needs?.includes("dataset_cell_locator_review")) codes.push("dataset_cell_locator");
  if (capsule.review_needs?.includes("date_precision_review") || capsule.date_precision === "year") codes.push("date_precision");
  if (capsule.review_needs?.includes("response_depth_review")) codes.push("response_depth");
  if (capsule.review_needs?.includes("explicit_rationale_review")) codes.push("explicit_rationale");
  if (capsule.locator_quality?.code === "metadata_only") codes.push("source_locator");
  if (/ocr|lawsuit|legal|criminal|investigation|title ix|title vi/i.test(`${capsule.category} ${capsule.source_basis?.source_types?.join(" ")}`)) {
    codes.push("legal_or_procedural_language");
  }
  return unique(codes);
}

export function hasProhibitedChallengeClaim(value) {
  const text = String(value ?? "");
  PROHIBITED_CHALLENGE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_CHALLENGE_PATTERN)) {
    if (!isNegatedClaim(text, match.index ?? 0)) return true;
  }
  return false;
}

export function buildChallengeStandards({ snapshot_id = "unversioned", generated_at = "2026-06-03" } = {}) {
  return {
    snapshot_id,
    generated_at,
    method:
      "Challenge standards define what public counterevidence can change a Campus Evidence Lab record. They are correction standards, not external audit, endorsement, ranking, severity scoring, safety scoring, or prevalence measurement.",
    standards: STANDARD_DEFINITIONS
  };
}

export function challengeTypesForCapsule(capsule) {
  const types = [];
  const needs = new Set(capsule.review_needs ?? []);
  if (needs.has("date_precision_review") || capsule.date_precision === "year") types.push("date_precision_challenge");
  if (needs.has("response_depth_review")) types.push("institutional_response_challenge");
  if (needs.has("explicit_rationale_review")) types.push("confidence_challenge");
  if (needs.has("dataset_cell_locator_review") || needs.has("source_url_review") || (capsule.source_basis?.source_count ?? 0) <= 1) {
    types.push("source_sufficiency_challenge");
  }
  if (/ocr|lawsuit|legal|criminal|investigation|title ix|title vi/i.test(`${capsule.category} ${capsule.source_basis?.source_types?.join(" ")}`)) {
    types.push("legal_status_challenge");
  }
  if (/other source-backed|public statement|institutional response/i.test(capsule.category ?? "")) {
    types.push("category_challenge");
  }
  return unique(types).filter((type) => STANDARD_DEFINITIONS.some((standard) => standard.id === type));
}

function challengePriority(capsule) {
  const reasonCodes = reasonCodesForCapsule(capsule);
  return reasonCodes.length * 10 + ((capsule.source_basis?.source_count ?? 0) <= 1 ? 5 : 0) + (capsule.date_precision === "year" ? 2 : 0);
}

function queueRecord(capsule, eventsById, schoolsById) {
  const event = eventsById.get(capsule.event_id);
  const school = schoolsById.get(capsule.school_id);
  return {
    event_id: capsule.event_id,
    school_id: capsule.school_id,
    school_name: school?.name ?? capsule.school_id,
    category: capsule.category,
    affected_communities: event?.affected_communities ?? [],
    confidence: capsule.confidence,
    date_precision: capsule.date_precision,
    challenge_types: challengeTypesForCapsule(capsule),
    reason_codes: reasonCodesForCapsule(capsule),
    source_count: capsule.source_basis?.source_count ?? 0,
    import_family: capsule.import_family?.id,
    locator_quality: capsule.locator_quality?.code,
    packet_url: `/challenge/?packet=${encodeURIComponent(capsule.event_id)}`,
    event_url: capsule.event_url,
    workspace_url: capsule.workspace_url
  };
}

function stableQueue(records, predicate, limit, eventsById, schoolsById) {
  return records
    .filter(predicate)
    .sort((a, b) => challengePriority(b) - challengePriority(a) || a.school_id.localeCompare(b.school_id) || a.event_id.localeCompare(b.event_id))
    .slice(0, limit)
    .map((capsule) => queueRecord(capsule, eventsById, schoolsById));
}

function packetForCapsule(capsule, eventsById, schoolsById, standardsById) {
  const event = eventsById.get(capsule.event_id);
  const school = schoolsById.get(capsule.school_id);
  const challengeTypes = challengeTypesForCapsule(capsule);
  const standards = challengeTypes.map((type) => standardsById.get(type)).filter(Boolean);
  return {
    id: `challenge_${capsule.event_id}`,
    event_id: capsule.event_id,
    school_id: capsule.school_id,
    school_name: school?.name ?? capsule.school_id,
    category: capsule.category,
    affected_communities: event?.affected_communities ?? [],
    confidence: capsule.confidence,
    date_precision: capsule.date_precision,
    source_ids: capsule.source_basis?.source_ids ?? [],
    source_types: capsule.source_basis?.source_types ?? [],
    challenge_types: challengeTypes,
    reason_codes: reasonCodesForCapsule(capsule),
    review_questions: standards.map((standard) => `${standard.label}: does the linked public source basis satisfy this standard for ${capsule.event_id}?`),
    acceptable_counterevidence: unique(standards.flatMap((standard) => standard.acceptable_counterevidence)),
    possible_outcomes: unique(standards.flatMap((standard) => standard.possible_outcomes)),
    evidence_capsule_url: `/data/evidence-capsules.json#${encodeURIComponent(capsule.event_id)}`,
    event_url: capsule.event_url,
    workspace_url: capsule.workspace_url,
    submission_packet_url: `/submit/?type=correction&record=${encodeURIComponent(capsule.event_id)}`,
    public_claim_limit:
      "This challenge packet identifies review questions for source-supported correction work. It is not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit."
  };
}

export function buildChallengePackets({ capsules, events = [], schools = [], standards, limit = 75 }) {
  const eventsById = eventMap(events);
  const schoolsById = schoolMap(schools);
  const standardsById = standardsMap(standards);
  return (capsules.records ?? [])
    .filter((capsule) => challengeTypesForCapsule(capsule).length > 0)
    .sort((a, b) => challengePriority(b) - challengePriority(a) || a.school_id.localeCompare(b.school_id) || a.event_id.localeCompare(b.event_id))
    .slice(0, limit)
    .map((capsule) => packetForCapsule(capsule, eventsById, schoolsById, standardsById));
}

export function buildChallengeQueues({ capsules, events = [], schools = [], standards, limit = 25, packetLimit = 75 }) {
  const records = capsules.records ?? [];
  const eventsById = eventMap(events);
  const schoolsById = schoolMap(schools);
  const queues = [
    {
      id: "single_source_high_priority",
      label: "Single-source high-priority review",
      description: "Single-source records where additional public support or narrower language would improve reviewability.",
      records: stableQueue(records, (capsule) => (capsule.source_basis?.source_count ?? 0) <= 1, limit, eventsById, schoolsById)
    },
    {
      id: "broad_label_challenges",
      label: "Broad-label challenges",
      description: "Records with broad category or affected-community labels that deserve label-boundary review.",
      records: stableQueue(records, (capsule) => /other source-backed|religion|race|national origin|ethnicity/i.test(JSON.stringify(capsule)), limit, eventsById, schoolsById)
    },
    {
      id: "response_depth_challenges",
      label: "Institutional-response challenges",
      description: "Records where public response text or response-depth classification should be checked against public sources.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("response_depth_review"), limit, eventsById, schoolsById)
    },
    {
      id: "confidence_rationale_challenges",
      label: "Confidence-rationale challenges",
      description: "Records where confidence labels need explicit source-support rationale.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("explicit_rationale_review"), limit, eventsById, schoolsById)
    },
    {
      id: "dataset_locator_challenges",
      label: "Dataset locator challenges",
      description: "Dataset-derived records where workbook, row, or cell-level provenance should be made clearer.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("dataset_cell_locator_review"), limit, eventsById, schoolsById)
    },
    {
      id: "legal_status_challenges",
      label: "Legal-status challenges",
      description: "Records with legal, OCR, procedural, or investigative language that should be checked for precision.",
      records: stableQueue(records, (capsule) => challengeTypesForCapsule(capsule).includes("legal_status_challenge"), limit, eventsById, schoolsById)
    },
    {
      id: "gold_record_candidates",
      label: "Gold record candidates",
      description: "Records worth upgrading into fully argued examples with alternate interpretations and change criteria.",
      records: stableQueue(records, (capsule) => challengeTypesForCapsule(capsule).length >= 3, limit, eventsById, schoolsById)
    }
  ];

  return {
    snapshot_id: capsules.snapshot_id,
    generated_at: capsules.generated_at,
    method:
      "Challenge queues are deterministic review-workflow queues generated from evidence capsules. Queue order is for review operations only and is not a ranking, severity score, safety score, prevalence estimate, legal finding, endorsement, or external audit.",
    queue_count: queues.length,
    packet_count: Math.min(packetLimit, records.length),
    queues,
    packets: buildChallengePackets({ capsules, events, schools, standards, limit: packetLimit })
  };
}

export function buildChallengeLedger({ challengeQueues, corrections = [] }) {
  const correctionIds = new Set((corrections ?? []).map((correction) => correction.id));
  const entries = (challengeQueues.packets ?? []).slice(0, 25).map((packet) => ({
    id: `ledger_${packet.id}`,
    challenge_id: packet.id,
    event_id: packet.event_id,
    challenge_type: packet.challenge_types[0],
    status: "open_for_review",
    submitted_evidence_summary: "Seeded from deterministic challenge packet generation; no external submission is represented.",
    decision_summary: "Open for public-source review under the published challenge standards.",
    resulting_correction_ids: [],
    resulting_event_ids: [packet.event_id],
    updated_at: challengeQueues.generated_at,
    public_limitations:
      "Ledger seed entries identify open review questions. They do not represent external submissions, findings, endorsement, or validation."
  }));

  return {
    snapshot_id: challengeQueues.snapshot_id,
    updated_at: challengeQueues.generated_at,
    method:
      "The challenge ledger records adversarial review packet status and outcomes. Initial entries are seeded open packets, not external submissions or external audit.",
    statuses: ["draft_packet", "open_for_review", "under_review", "accepted", "partially_accepted", "rejected", "needs_more_evidence", "closed_no_change"],
    entries: entries.map((entry) => ({
      ...entry,
      resulting_correction_ids: entry.resulting_correction_ids.filter((id) => correctionIds.has(id))
    }))
  };
}

export function validateChallengeArtifacts({ standards, queues, ledger, events = [], sources = [], corrections = [] }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const correctionIds = new Set(corrections.map((correction) => correction.id));
  const standardIds = new Set((standards.standards ?? []).map((standard) => standard.id));
  const statusIds = new Set(ledger.statuses ?? []);

  for (const artifact of [standards, queues, ledger]) {
    if (hasProhibitedChallengeClaim(JSON.stringify(artifact))) {
      errors.push("Challenge artifact contains prohibited credibility, ranking, safety, severity, or prevalence language.");
    }
  }

  for (const standard of standards.standards ?? []) {
    if (!standard.id || !standardIds.has(standard.id)) errors.push(`Challenge standard ${standard.id} is not registered.`);
    for (const field of ["label", "applies_when", "no_overclaiming_warning"]) {
      if (!standard[field]) errors.push(`Challenge standard ${standard.id} missing ${field}`);
    }
    for (const field of ["acceptable_counterevidence", "insufficient_counterevidence", "possible_outcomes", "fields_that_may_change"]) {
      if (!Array.isArray(standard[field]) || standard[field].length === 0) errors.push(`Challenge standard ${standard.id} missing ${field}`);
    }
  }

  for (const queue of queues.queues ?? []) {
    if (/worst|best|most dangerous|safest|ranking|score/i.test(`${queue.id} ${queue.label}`)) {
      errors.push(`Challenge queue ${queue.id} uses score-like or ranking language.`);
    }
    for (const record of queue.records ?? []) {
      if (!eventIds.has(record.event_id)) errors.push(`Challenge queue ${queue.id} references unknown event ${record.event_id}`);
      for (const type of record.challenge_types ?? []) {
        if (!standardIds.has(type)) errors.push(`Challenge queue ${queue.id} uses unknown challenge type ${type}`);
      }
    }
  }

  for (const packet of queues.packets ?? []) {
    if (!eventIds.has(packet.event_id)) errors.push(`Challenge packet ${packet.id} references unknown event ${packet.event_id}`);
    for (const sourceId of packet.source_ids ?? []) {
      if (!sourceIds.has(sourceId)) errors.push(`Challenge packet ${packet.id} references unknown source ${sourceId}`);
    }
    for (const type of packet.challenge_types ?? []) {
      if (!standardIds.has(type)) errors.push(`Challenge packet ${packet.id} uses unknown challenge type ${type}`);
    }
    if (!packet.public_claim_limit) errors.push(`Challenge packet ${packet.id} missing public_claim_limit`);
  }

  for (const entry of ledger.entries ?? []) {
    if (!eventIds.has(entry.event_id)) errors.push(`Challenge ledger entry ${entry.id} references unknown event ${entry.event_id}`);
    if (!standardIds.has(entry.challenge_type)) errors.push(`Challenge ledger entry ${entry.id} uses unknown challenge type ${entry.challenge_type}`);
    if (!statusIds.has(entry.status)) errors.push(`Challenge ledger entry ${entry.id} uses unsupported status ${entry.status}`);
    if ((entry.status === "accepted" || entry.status === "rejected" || entry.status === "partially_accepted" || entry.status === "closed_no_change") && !entry.decision_summary) {
      errors.push(`Challenge ledger entry ${entry.id} needs a decision summary`);
    }
    for (const correctionId of entry.resulting_correction_ids ?? []) {
      if (!correctionIds.has(correctionId)) errors.push(`Challenge ledger entry ${entry.id} references unknown correction ${correctionId}`);
    }
  }

  return errors;
}
