const PROHIBITED_EXTERNAL_REVIEW_PATTERN =
  /\b(?:safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|externally validated|external audit|external validation|safety score|safety scoring|severity score|severity scoring|school ranking|prevalence estimate|estimates prevalence|frequency measurement|frequency measure|legal truth)\b/gi;

const CHALLENGE_TEMPLATES = [
  {
    id: "source_locator_challenge",
    label: "Source Locator Challenge",
    prompt: "Does the linked source URL and locator land on the exact source item, table, page, workbook cell, or document section supporting the record?",
    required_evidence: ["record ID", "source URL reviewed", "current locator", "specific missing or stronger locator", "proposed correction"]
  },
  {
    id: "category_challenge",
    label: "Category Challenge",
    prompt: "Does the source wording support the stored category without implying a stronger legal or severity conclusion?",
    required_evidence: ["record ID", "source passage or table field", "current category", "proposed category or limit note"]
  },
  {
    id: "affected_label_challenge",
    label: "Affected-Community Label Challenge",
    prompt: "Does the source support each affected-community label at the stored level of specificity?",
    required_evidence: ["record ID", "source wording", "current label", "label to remove, narrow, or qualify"]
  },
  {
    id: "date_precision_challenge",
    label: "Date Precision Challenge",
    prompt: "Does the source support the stored day, month, or year precision?",
    required_evidence: ["record ID", "source date field or item date", "current date precision", "proposed precision"]
  },
  {
    id: "response_depth_challenge",
    label: "Response-Depth Challenge",
    prompt: "Does the response field distinguish direct institutional response, agency-described action, limited note, and no public response found?",
    required_evidence: ["record ID", "source response text", "current response-depth label", "proposed label or wording"]
  },
  {
    id: "rationale_specificity_challenge",
    label: "Rationale Specificity Challenge",
    prompt: "Are classification, community, and confidence rationales specific to the linked public source?",
    required_evidence: ["record ID", "rationale field", "source support", "proposed source-bounded rationale"]
  },
  {
    id: "inclusion_challenge",
    label: "Inclusion Challenge",
    prompt: "Does the record satisfy the project inclusion rule for public-source campus civil-rights documentation?",
    required_evidence: ["record ID", "public source reviewed", "inclusion concern", "proposed keep/remove/qualify outcome"]
  },
  {
    id: "counterevidence_challenge",
    label: "Counterevidence Challenge",
    prompt: "Does another public source materially contradict, narrow, update, or clarify the current record?",
    required_evidence: ["record ID", "counterevidence URL", "conflicting field", "proposed correction or note"]
  }
];

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function mapById(items, key = "id") {
  return new Map((items ?? []).map((item) => [item[key], item]));
}

function sourceTypeFamily(sourceTypes = []) {
  if (sourceTypes.includes("Government dataset")) return "dataset_cell";
  if (sourceTypes.includes("Annual security report")) return "annual_security_report";
  if (sourceTypes.includes("Public safety notice")) return "public_safety_notice";
  if (sourceTypes.some((type) => /Government release|Government guidance|Government letter/i.test(type))) return "government_release_or_guidance";
  if (sourceTypes.includes("University statement")) return "university_statement";
  if (sourceTypes.includes("News report")) return "news_report";
  return "public_source";
}

function sourceChecklist(record, linkedSources) {
  const family = sourceTypeFamily(linkedSources.map((source) => source.source_type));
  const base = [
    "Open the event page and record ID before inspecting sources.",
    "Open each linked public source in a separate tab.",
    "Confirm the source publisher, title, publication date, and URL match the source index.",
    "Use the stored source locator before accepting any record field.",
    "Compare school, date precision, category, affected-community labels, response-depth label, legal/procedural status, and confidence rationale against the source.",
    "Record any correction as a source-backed challenge, not as an endorsement or broad campus judgment."
  ];

  if (family === "dataset_cell") {
    return [
      ...base,
      "For dataset records, verify workbook, sheet, row, column, and cell locator before quoting the record.",
      "Treat year-level data as reporting-year data unless the source provides an exact incident date."
    ];
  }
  if (family === "annual_security_report") {
    return [...base, "For ASR records, verify the page, table, statistic label, reporting year, and offense/bias-characterization field."];
  }
  if (family === "government_release_or_guidance") {
    return [...base, "For OCR or government release records, verify the exact item title/date and distinguish agency-described action from direct institutional response."];
  }
  return base;
}

function replicationSteps(record, linkedSources) {
  const family = sourceTypeFamily(linkedSources.map((source) => source.source_type));
  const locatorSummary = (record.source_locators ?? [])
    .map((locator) => `${locator.source_id}: ${locator.locator_type} / ${locator.locator}`)
    .join("; ");
  const steps = [
    `Open /events/${record.id}/ and the source index entries: ${linkedSources.map((source) => source.id).join(", ")}.`,
    `Confirm the event record hash in data/events.json after running npm run hash:data.`,
    `Open the stored source locator: ${locatorSummary || "no locator stored; do not treat this as a certified external packet row"}.`,
    "Compare the source locator to the stored school, date, category, affected-community labels, response-depth label, legal/procedural status, and rationale fields.",
    "Open data/gold-v1-certification-status.json and confirm every gate for this record is pass/certified.",
    "If any field is unsupported, file a challenge or correction with source URL, field name, current value, and proposed source-bounded value."
  ];

  if (family === "dataset_cell") {
    steps.splice(3, 0, "For workbook evidence, verify workbook name, sheet, row, column, and cell before relying on the record.");
  }
  if (family === "annual_security_report") {
    steps.splice(3, 0, "For ASR evidence, verify the cited page/table/section and the exact row/column or statistic label.");
  }
  if (family === "government_release_or_guidance") {
    steps.splice(3, 0, "For OCR/government release evidence, verify the item date, item title, and whether the source describes an agency action or direct institutional response.");
  }
  return steps;
}

function challengeUrlFor(eventId, challengeQueues = {}) {
  const packet = (challengeQueues.packets ?? []).find((candidate) => candidate.event_id === eventId);
  return packet?.challenge_url ?? `/challenge/?record=${encodeURIComponent(eventId)}`;
}

function packetRecord({ event, sourcesById, goldRow, debtRow, challengeQueues }) {
  const linkedSources = (event.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)).filter(Boolean);
  return {
    event_id: event.id,
    school_id: event.school_id,
    date: event.date,
    date_precision: event.date_precision,
    category: event.category,
    affected_communities: event.affected_communities ?? [],
    confidence: event.confidence,
    source_ids: event.source_ids ?? [],
    source_types: linkedSources.map((source) => source.source_type),
    source_family: debtRow?.source_family ?? sourceTypeFamily(linkedSources.map((source) => source.source_type)),
    gold_v1_certification_status: goldRow.certification_status,
    debt_status: debtRow?.debt_status ?? "lower_priority_review_debt",
    response_depth: event.response_depth ?? null,
    source_locators: event.source_locators ?? [],
    source_checklist: sourceChecklist(event, linkedSources),
    replication_steps: replicationSteps(event, linkedSources),
    challenge_url: challengeUrlFor(event.id, challengeQueues),
    workspace_url: goldRow.workspace_url ?? `/research-workspace/?record_ids=${encodeURIComponent(event.id)}`,
    event_url: goldRow.event_url ?? `/events/${encodeURIComponent(event.id)}/`
  };
}

export function buildExternalReviewPacket({
  events,
  sources = [],
  goldStatus,
  reviewDebtLedger,
  challengeQueues = {},
  manifest = {},
  limit = 25
}) {
  const eventsById = mapById(events);
  const sourcesById = mapById(sources);
  const debtByEventId = mapById(reviewDebtLedger.records ?? [], "event_id");
  const certifiedRows = (goldStatus.records ?? [])
    .filter((record) => record.certification_status === "certified")
    .filter((record) => eventsById.has(record.event_id))
    .sort((a, b) => a.event_id.localeCompare(b.event_id))
    .slice(0, Math.min(Math.max(limit, 1), 25));
  const records = certifiedRows.map((goldRow) =>
    packetRecord({
      event: eventsById.get(goldRow.event_id),
      sourcesById,
      goldRow,
      debtRow: debtByEventId.get(goldRow.event_id),
      challengeQueues
    })
  );

  return {
    id: "external_review_packet_v1",
    snapshot_id: manifest.snapshot_id ?? goldStatus.snapshot_id ?? reviewDebtLedger.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? goldStatus.generated_at ?? reviewDebtLedger.generated_at ?? "2026-06-03",
    status: "public_external_review_packet",
    method:
      "Formal public evidence dossier generated only from Gold v1 records whose internal certification gates currently pass. It packages source-to-record review steps, challenge templates, known limits, and batch-scaling guidance; it is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.",
    public_claim_limit:
      "This packet may be used for source-to-record review. It must not be described as third-party review, external validation, institutional quality judgment, school ranking, safety scoring, severity scoring, prevalence measurement, endorsement, or legal finding.",
    selection_standard: {
      source: "data/gold-v1-certification-status.json",
      rule: "Include only records with certification_status=certified; exclude blocked and not_certified records.",
      max_records: 25,
      selected_records: records.length
    },
    totals: {
      records: records.length,
      certified_gold_v1_available: (goldStatus.records ?? []).filter((record) => record.certification_status === "certified").length,
      excluded_not_certified_gold_v1: (goldStatus.records ?? []).filter((record) => record.certification_status === "not_certified").length,
      excluded_blocked_gold_v1: (goldStatus.records ?? []).filter((record) => record.certification_status === "blocked").length
    },
    review_batches: [
      {
        id: "gold_v1_external_review_batch_001",
        label: "Gold v1 External Review Batch 001",
        batch_size: records.length,
        record_ids: records.map((record) => record.event_id),
        review_standard: "Each record must be rechecked from public source locator to database fields before any reviewer conclusion is accepted.",
        workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(records.map((record) => record.event_id).join(","))}`
      },
      {
        id: "review_debt_batching_rule",
        label: "Whole-database Batch Rule",
        batch_size: 25,
        record_ids: [],
        review_standard:
          "Scale the remaining review debt in source-family batches from data/review-debt-ledger.json. Do not call a batch certified until every record in that batch clears the same source locator, date, category, affected-label, response-depth, and rationale gates."
      }
    ],
    challenge_templates: CHALLENGE_TEMPLATES,
    known_limits: {
      unresolved_records: {
        blocked: reviewDebtLedger.totals?.blocked ?? 0,
        high_review_debt: reviewDebtLedger.totals?.high_review_debt ?? 0,
        medium_review_debt: reviewDebtLedger.totals?.medium_review_debt ?? 0,
        not_certified_gold_v1: (goldStatus.records ?? []).filter((record) => record.certification_status === "not_certified").length,
        blocked_gold_v1: (goldStatus.records ?? []).filter((record) => record.certification_status === "blocked").length
      },
      source_family_counts: reviewDebtLedger.source_family_counts ?? {},
      top_issue_counts: Object.fromEntries(Object.entries(reviewDebtLedger.issue_counts ?? {}).slice(0, 12)),
      note:
        "Known limits are review queues and unresolved source-to-record checks, not findings that records are false, severe, representative, complete, or externally reviewed."
    },
    records
  };
}

export function hasProhibitedExternalReviewClaim(value) {
  const text = String(value ?? "");
  PROHIBITED_EXTERNAL_REVIEW_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_EXTERNAL_REVIEW_PATTERN)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 220), match.index ?? 0).toLowerCase();
    const sameClause = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
    if (/\b(?:not|no|nor|without|cannot|never|must not|is not|are not|does not|do not)\b/.test(sameClause)) continue;
    return true;
  }
  return false;
}

export function validateExternalReviewPacket({ packet, events = [], sources = [], goldStatus = {}, reviewDebtLedger = {}, manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const certifiedGoldIds = new Set((goldStatus.records ?? []).filter((record) => record.certification_status === "certified").map((record) => record.event_id));
  const debtIds = new Set((reviewDebtLedger.records ?? []).map((record) => record.event_id));

  if (packet.id !== "external_review_packet_v1") errors.push("external-review-packet id must be external_review_packet_v1");
  if (packet.snapshot_id !== (manifest.snapshot_id ?? packet.snapshot_id)) errors.push("external-review-packet snapshot_id must match snapshot manifest");
  if (packet.generated_at !== (manifest.created_at ?? packet.generated_at)) errors.push("external-review-packet generated_at must match snapshot manifest created_at");
  if (!Array.isArray(packet.records) || packet.records.length < 1 || packet.records.length > 25) {
    errors.push("external-review-packet records must include 1-25 records");
  }
  if (!Array.isArray(packet.challenge_templates) || packet.challenge_templates.length < 8) {
    errors.push("external-review-packet must include at least eight challenge templates");
  }
  if (!Array.isArray(packet.review_batches) || packet.review_batches.length < 2) {
    errors.push("external-review-packet must include external review and whole-database batching guidance");
  }

  for (const record of packet.records ?? []) {
    if (!eventIds.has(record.event_id)) errors.push(`external-review-packet references unknown event ${record.event_id}`);
    if (!certifiedGoldIds.has(record.event_id) || record.gold_v1_certification_status !== "certified") {
      errors.push(`external-review-packet ${record.event_id} must be a certified Gold v1 record`);
    }
    if (!debtIds.has(record.event_id)) errors.push(`external-review-packet ${record.event_id} missing review-debt row`);
    for (const sourceId of record.source_ids ?? []) {
      if (!sourceIds.has(sourceId)) errors.push(`external-review-packet ${record.event_id} references unknown source ${sourceId}`);
    }
    if (!Array.isArray(record.source_checklist) || record.source_checklist.length < 6) {
      errors.push(`external-review-packet ${record.event_id} missing source checklist`);
    }
    if (!Array.isArray(record.replication_steps) || !record.replication_steps.some((step) => /locator/i.test(step))) {
      errors.push(`external-review-packet ${record.event_id} missing locator replication steps`);
    }
    if (!record.challenge_url || !record.workspace_url || !record.event_url) {
      errors.push(`external-review-packet ${record.event_id} missing review URLs`);
    }
  }

  if (hasProhibitedExternalReviewClaim(JSON.stringify(packet))) {
    errors.push("external-review-packet includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }

  return errors;
}
