const PROHIBITED_EVIDENCE_PATTERN =
  /externally validated|outside validated|validated by|approved by|endorsed by|safest|most dangerous|best school|worst school|school ranking|safety score|severity score|prevalence estimate|frequency measure/i;

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function linkedSources(record, sources) {
  const byId = sourceMap(sources);
  return (record.source_ids ?? []).map((sourceId) => byId.get(sourceId)).filter(Boolean);
}

function sourceTypes(record, sources) {
  const linked = linkedSources(record, sources).map((source) => source.source_type);
  return unique(linked.length ? linked : record.source_types ?? []);
}

function textFor(record, sources) {
  return [
    record.summary,
    record.description,
    record.legal_status,
    record.institutional_response,
    ...(record.tags ?? []),
    ...linkedSources(record, sources).flatMap((source) => [source.title, source.publisher, source.source_type])
  ]
    .join(" ")
    .toLowerCase();
}

function snapshotDate(manifest) {
  return manifest.created_at ?? "2026-06-03";
}

function sourceSummary(source) {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    source_type: source.source_type,
    published_date: source.published_date,
    url: source.url
  };
}

export function classifyImportFamily(record, sources = []) {
  const text = textFor(record, sources);
  const types = sourceTypes(record, sources);

  if (types.includes("Government dataset") || /ed-campus-safety-data|campus safety|clery|hate-crime-statistics|workbook|xlsx/.test(text)) {
    return {
      id: "ed_campus_safety_dataset",
      label: "Education campus-safety dataset",
      description: "Record appears to come from Department of Education campus-safety or Clery hate-crime data-file metadata."
    };
  }

  if (/ocr|title vi|title ix|resolution agreement|office for civil rights/.test(text) || types.includes("Government release")) {
    return {
      id: "ocr_government_release",
      label: "OCR or government release",
      description: "Record appears to come from a public OCR, Department of Education, or government release."
    };
  }

  if (types.includes("University statement") || /university statement|public statement|sjsualert|campus groups/.test(text)) {
    return {
      id: "institutional_public_statement",
      label: "Institutional public statement",
      description: "Record appears to come from a university or institutional public statement."
    };
  }

  if (types.includes("Annual security report")) {
    return {
      id: "annual_security_report",
      label: "Annual security report",
      description: "Record appears to come from an annual security or fire-safety report."
    };
  }

  return {
    id: "other_public_source",
    label: "Other public source",
    description: "Record appears to come from another public source type recorded in source metadata."
  };
}

export function evidenceLocatorQuality(record, sources = []) {
  const family = classifyImportFamily(record, sources);
  const linked = linkedSources(record, sources);
  const hasUrl = linked.every((source) => Boolean(source.url));

  if (family.id === "ed_campus_safety_dataset") {
    const workbookMentioned = /xlsx|workbook|oncampus|noncampus|residence|public-property|data file/i.test(record.description ?? "");
    return {
      code: "dataset_file",
      label: "Dataset file locator",
      review_priority: "high",
      description: workbookMentioned
        ? "The source trail identifies a public dataset file or workbook family, but reviewers should still check the specific cell basis before reuse."
        : "The source trail identifies a public dataset source, but the workbook or cell basis needs review."
    };
  }

  if (hasUrl && linked.length > 0) {
    return {
      code: "source_page",
      label: "Source page locator",
      review_priority: linked.length > 1 ? "lower" : "medium",
      description: "The record links to at least one public source page or document."
    };
  }

  return {
    code: "metadata_only",
    label: "Metadata-only locator",
    review_priority: "high",
    description: "The record has source metadata but lacks a usable public source URL in the current source index."
  };
}

function supportNoteFor(field, record, sources) {
  const family = classifyImportFamily(record, sources);
  if (field === "date" && record.date_precision === "year") {
    return "Date is represented at year precision from current metadata and should not be treated as an exact event date.";
  }
  if (field === "institutional_response" && family.id === "ed_campus_safety_dataset") {
    return "Response text is a bounded dataset-note field, not a substantive institutional response.";
  }
  if (field === "confidence") {
    return "Confidence describes current source support and verification status, not severity or legal truth.";
  }
  return "Field is supported by the linked public source metadata and should be checked against the source text before reuse.";
}

export function fieldEvidenceRows(record, sources = []) {
  const sourceIds = record.source_ids ?? [];
  return [
    ["school", record.school_id],
    ["date", record.date],
    ["category", record.category],
    ["affected_communities", record.affected_communities?.length],
    ["description", record.description],
    ["institutional_response", record.institutional_response],
    ["legal_status", record.legal_status],
    ["confidence", record.confidence]
  ]
    .filter(([, value]) => Boolean(value))
    .map(([field]) => ({
      field,
      source_ids: sourceIds,
      support_level: sourceIds.length > 1 ? "linked_public_sources" : "linked_public_source",
      support_note: supportNoteFor(field, record, sources)
    }));
}

function reviewNeeds(record, sources) {
  const family = classifyImportFamily(record, sources);
  const locator = evidenceLocatorQuality(record, sources);
  const needs = [];
  if (family.id === "ed_campus_safety_dataset") needs.push("dataset_cell_locator_review");
  if ((record.source_ids ?? []).length <= 1) needs.push("single_source_review");
  if (record.date_precision === "year") needs.push("date_precision_review");
  if (locator.code === "metadata_only") needs.push("source_url_review");
  if (/does not independently evaluate|does not evaluate|record summarizes/i.test(record.institutional_response ?? "")) {
    needs.push("response_depth_review");
  }
  if (!record.classification_rationale || !record.community_rationale || !record.confidence_rationale) {
    needs.push("explicit_rationale_review");
  }
  return unique(needs);
}

export function recordEvidenceCapsule(record, sources = []) {
  const linked = linkedSources(record, sources);
  const family = classifyImportFamily(record, sources);
  const locator = evidenceLocatorQuality(record, sources);
  const needs = reviewNeeds(record, sources);

  return {
    event_id: record.id,
    school_id: record.school_id,
    category: record.category,
    confidence: record.confidence,
    date_precision: record.date_precision,
    import_family: family,
    locator_quality: locator,
    source_basis: {
      source_count: linked.length,
      source_ids: record.source_ids ?? [],
      source_types: sourceTypes(record, sources),
      primary_source: linked[0] ? sourceSummary(linked[0]) : null
    },
    field_evidence: fieldEvidenceRows(record, sources),
    review_needs: needs,
    workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(record.id)}`,
    event_url: `/events/${encodeURIComponent(record.id)}/`,
    public_claim_limit:
      "This capsule summarizes current metadata support and review needs. It does not represent direct source re-review, outside validation, comparative campus judgment, or legal truth."
  };
}

export function buildEvidenceCapsules({ events, sources = [], manifest = {} }) {
  const records = events.map((record) => recordEvidenceCapsule(record, sources));
  const importFamilyCounts = {};
  const locatorQualityCounts = {};
  const reviewNeedCounts = {};

  for (const capsule of records) {
    importFamilyCounts[capsule.import_family.id] = (importFamilyCounts[capsule.import_family.id] ?? 0) + 1;
    locatorQualityCounts[capsule.locator_quality.code] = (locatorQualityCounts[capsule.locator_quality.code] ?? 0) + 1;
    for (const need of capsule.review_needs) {
      reviewNeedCounts[need] = (reviewNeedCounts[need] ?? 0) + 1;
    }
  }

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    method:
      "Evidence capsules are generated from current local event and source metadata. They identify source-to-field support and review needs without claiming direct source re-review.",
    totals: {
      records: records.length,
      records_with_single_source: records.filter((record) => record.source_basis.source_count <= 1).length,
      records_with_dataset_file_locator: records.filter((record) => record.locator_quality.code === "dataset_file").length,
      records_with_source_page_locator: records.filter((record) => record.locator_quality.code === "source_page").length
    },
    import_family_counts: importFamilyCounts,
    locator_quality_counts: locatorQualityCounts,
    review_need_counts: reviewNeedCounts,
    records
  };
}

function queueRecord(capsule) {
  return {
    event_id: capsule.event_id,
    school_id: capsule.school_id,
    category: capsule.category,
    confidence: capsule.confidence,
    date_precision: capsule.date_precision,
    import_family: capsule.import_family.id,
    locator_quality: capsule.locator_quality.code,
    source_count: capsule.source_basis.source_count,
    review_needs: capsule.review_needs,
    workspace_url: capsule.workspace_url,
    event_url: capsule.event_url
  };
}

function stableQueue(records, predicate, limit) {
  return records
    .filter(predicate)
    .sort(
      (a, b) =>
        b.review_needs.length - a.review_needs.length ||
        a.import_family.id.localeCompare(b.import_family.id) ||
        a.event_id.localeCompare(b.event_id)
    )
    .slice(0, limit)
    .map(queueRecord);
}

export function buildSourceProvenanceQueues({ capsules, limit = 25 }) {
  const records = capsules.records ?? [];
  const queues = [
    {
      id: "dataset-cell-locator-review",
      label: "Dataset cell locator review",
      description: "Records from dataset-file imports where a reviewer should confirm workbook, row, or cell basis before reuse.",
      records: stableQueue(records, (record) => record.review_needs.includes("dataset_cell_locator_review"), limit)
    },
    {
      id: "source-url-review",
      label: "Source URL review",
      description: "Records whose current source metadata needs a stronger public URL locator.",
      records: stableQueue(records, (record) => record.review_needs.includes("source_url_review"), limit)
    },
    {
      id: "single-source-review",
      label: "Single-source review",
      description: "Records supported by one linked public source in the current metadata.",
      records: stableQueue(records, (record) => record.review_needs.includes("single_source_review"), limit)
    },
    {
      id: "response-depth-review",
      label: "Response-depth review",
      description: "Records whose response field is a bounded source note rather than a substantive direct institutional response.",
      records: stableQueue(records, (record) => record.review_needs.includes("response_depth_review"), limit)
    },
    {
      id: "explicit-rationale-review",
      label: "Explicit rationale review",
      description: "Records that still need explicit classification, community, or confidence rationales.",
      records: stableQueue(records, (record) => record.review_needs.includes("explicit_rationale_review"), limit)
    }
  ];

  return {
    snapshot_id: capsules.snapshot_id,
    generated_at: capsules.generated_at,
    method:
      "Source provenance queues are deterministic review-priority lists generated from evidence capsules. Queue membership is not a claim about severity, frequency, or institutional quality.",
    queues
  };
}

export function hasProhibitedEvidenceClaim(value) {
  return PROHIBITED_EVIDENCE_PATTERN.test(String(value ?? ""));
}
