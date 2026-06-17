import { classifyResponseDepth } from "./robustness-metrics-lib.mjs";

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

const PROHIBITED_AUDIT_PATTERN =
  /\b(?:safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|externally validated|external audit|external validation|safety score|safety scoring|severity score|severity scoring|school ranking|prevalence estimate|estimates prevalence|frequency measurement|frequency measure|legal truth)\b/gi;

const GENERIC_RATIONALE_PATTERN =
  /retained as a documentation label|reflect public-source metadata|does not represent outside validation|source support and verification status/i;

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function liveAuditMap(liveAudit = {}) {
  return new Map((liveAudit.entries ?? []).map((entry) => [entry.source_id, entry]));
}

function linkedSources(record, sourcesById) {
  return (record.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)).filter(Boolean);
}

function sourceTypes(record, sourcesById) {
  const linkedTypes = linkedSources(record, sourcesById).map((source) => source.source_type);
  return unique(linkedTypes.length ? linkedTypes : record.source_types ?? []);
}

function sourceCount(record) {
  return unique(record.source_ids ?? []).length;
}

function locatorsForSource(record, sourceId) {
  return (record.source_locators ?? []).filter((locator) => locator?.source_id === sourceId);
}

function hasLocatorType(record, sourceIds, locatorTypes) {
  return sourceIds.every((sourceId) => {
    const locators = locatorsForSource(record, sourceId);
    return locators.some((locator) => locatorTypes.includes(locator.locator_type) && String(locator.locator ?? "").trim().length >= 20);
  });
}

function hasDatasetCellLocator(record, sources) {
  const datasetSourceIds = sources.filter((source) => source.source_type === "Government dataset").map((source) => source.id);
  if (!datasetSourceIds.length) return false;
  return datasetSourceIds.every((sourceId) =>
    locatorsForSource(record, sourceId).some(
      (locator) =>
        locator.locator_type === "workbook_cell" &&
        locator.workbook &&
        locator.sheet &&
        Number.isInteger(locator.row) &&
        locator.row > 0 &&
        locator.column &&
        locator.cell &&
        String(locator.locator ?? "").trim().length >= 20
    )
  );
}

function hasAggregateItemLocator(record, sources) {
  const aggregateSourceIds = sources
    .filter((source) => /what'?s new|mixed/i.test(`${source.title} ${source.published_date}`))
    .map((source) => source.id);
  if (!aggregateSourceIds.length) return false;
  return aggregateSourceIds.every((sourceId) =>
    locatorsForSource(record, sourceId).some(
      (locator) =>
        locator.locator_type === "aggregate_item" &&
        locator.item_date &&
        locator.item_label &&
        String(locator.locator ?? "").trim().length >= 20
    )
  );
}

function aggregateLocatorMatchesRecordDate(record, sources) {
  return hasAggregateItemLocator(record, sources) &&
    linkedSources(record, sourceMap(sources)).every((source) => {
      if (!/what'?s new|mixed/i.test(`${source.title} ${source.published_date}`)) return true;
      return locatorsForSource(record, source.id).some((locator) => locator.locator_type === "aggregate_item" && locator.item_date === record.date);
    });
}

function hasPageTableLocator(record, sources) {
  const pageTableSourceIds = sources
    .filter((source) => ["Annual security report", "Public safety notice"].includes(source.source_type))
    .map((source) => source.id);
  if (!pageTableSourceIds.length) return false;
  return pageTableSourceIds.every((sourceId) =>
    locatorsForSource(record, sourceId).some(
      (locator) =>
        ["page_table", "document_section", "source_item"].includes(locator.locator_type) &&
        (locator.page || locator.table || locator.section || locator.item_label) &&
        String(locator.locator ?? "").trim().length >= 20
    )
  );
}

function hasSourceLocator(record) {
  return (record.source_locators ?? []).some((locator) => String(locator?.locator ?? "").trim().length >= 20);
}

function isSpecificRationale(value) {
  const rationale = String(value ?? "").trim();
  return rationale.length >= 40 && !GENERIC_RATIONALE_PATTERN.test(rationale);
}

function keepsBoundaryOpen(value) {
  return /\b(?:remain(?:s)? unresolved|remain(?:s)? uncertified|does not by itself certify|does not enumerate|pending .*review|requires .*review|cannot certify)\b/i.test(
    String(value ?? "")
  );
}

function hasSourceSupportedYearPrecision(record) {
  if (record.date_precision !== "year") return false;
  return hasSourceLocator(record) && isSpecificRationale(record.confidence_rationale);
}

function hasSourceSupportedBroadLabels(record) {
  return isSpecificRationale(record.community_rationale) && !keepsBoundaryOpen(record.community_rationale);
}

function hasExplicitLimitedResponseDepth(record) {
  return record.response_depth === "limited_public_response_note" && String(record.institutional_response ?? "").trim().length > 0;
}

function textFor(record) {
  return [record.summary, record.description, record.legal_status, record.institutional_response, ...(record.tags ?? [])]
    .join(" ")
    .toLowerCase();
}

function addIssue(issues, issue) {
  issues.push({
    id: issue.id,
    severity: issue.severity,
    field: issue.field,
    title: issue.title,
    detail: issue.detail,
    next_step: issue.next_step
  });
}

function normalizedUrl(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function sourceLocatorIssues(record, sourcesById, liveBySourceId) {
  const issues = [];
  const sources = linkedSources(record, sourcesById);
  const types = sourceTypes(record, sourcesById);

  if (!sources.length) {
    addIssue(issues, {
      id: "missing_linked_source",
      severity: "blocker",
      field: "sources",
      title: "Missing linked public source",
      detail: "The record does not resolve to a linked source in the local source index.",
      next_step: "Do not include this record in external review packets until the source reference is repaired."
    });
    return issues;
  }

  for (const source of sources) {
    if (!source.url) {
      addIssue(issues, {
        id: "missing_source_url",
        severity: "blocker",
        field: "sources",
        title: "Missing source URL",
        detail: `Source ${source.id} does not store a usable public URL.`,
        next_step: "Add or replace the public URL before presenting the record as source-reviewable."
      });
    }

    const live = liveBySourceId.get(source.id);
    if (live?.launch_check_status === "live_checked" && live.live_status && live.live_status !== "ok") {
      addIssue(issues, {
        id: "live_source_check_not_ok",
        severity: "blocker",
        field: "sources",
        title: "Live source check did not pass",
        detail: `Source ${source.id} live check status is ${live.live_status}.`,
        next_step: "Repair, replace, or archive the source URL before reuse."
      });
    }

    if (live?.final_url && source.url && normalizedUrl(live.final_url) !== normalizedUrl(source.url)) {
      addIssue(issues, {
        id: "source_redirect_locator_risk",
        severity: "blocker",
        field: "sources",
        title: "Source redirects away from the cited locator",
        detail: `Source ${source.id} resolves to ${live.final_url}, which differs from the stored citation URL.`,
        next_step: "Confirm whether the final page still contains the cited item; otherwise replace the locator or downgrade the record before outside review."
      });
    }
  }

  if (types.every((type) => type === "Government dataset") && !hasDatasetCellLocator(record, sources)) {
    addIssue(issues, {
      id: "dataset_cell_locator_needed",
      severity: "high",
      field: "sources",
      title: "Dataset cell locator needs review",
      detail: "The record is based on a public dataset file; reviewers still need workbook, row, or cell-level provenance before quotation.",
      next_step: "Add workbook/table/cell locator notes or keep this record in a dataset-locator challenge queue."
    });
  }

  if ((types.includes("Annual security report") || types.includes("Public safety notice")) && !hasPageTableLocator(record, sources)) {
    addIssue(issues, {
      id: "page_table_locator_needed",
      severity: "medium",
      field: "sources",
      title: "Page or table locator should be stronger",
      detail: "The source type is reviewable, but the current packet should identify the page, table, or item location more precisely.",
      next_step: "Add page/table/item locator notes before using the record as a public example."
    });
  }

  if (sources.some((source) => /what'?s new|mixed/i.test(`${source.title} ${source.published_date}`)) && !hasAggregateItemLocator(record, sources)) {
    addIssue(issues, {
      id: "aggregated_source_item_locator_needed",
      severity: "high",
      field: "sources",
      title: "Aggregated source needs item-level locator",
      detail: "The linked source appears to be an aggregate page with multiple items or mixed dates.",
      next_step: "Confirm the exact item, date, and source text before using day-level record details externally."
    });
  }

  return issues;
}

function classificationIssues(record, sourcesById) {
  const issues = [];
  const text = textFor(record);
  const types = sourceTypes(record, sourcesById);

  if (record.category === "Harassment or threat" && /aggravated assault|simple assault|robbery|burglary|motor vehicle theft|arson/.test(text)) {
    addIssue(issues, {
      id: "category_may_be_too_generic_for_offense",
      severity: "high",
      field: "category",
      title: "Category may be too generic for the source offense",
      detail: "The record category is broad while the source-language summary appears to name a more specific Clery offense.",
      next_step: "Review whether the category should remain broad, be narrowed, or carry an explicit source-offense note."
    });
  }

  if (record.category === "OCR complaint" && types.includes("Government guidance")) {
    addIssue(issues, {
      id: "guidance_source_category_fit_review",
      severity: "high",
      field: "category",
      title: "Guidance-source category fit needs review",
      detail: "The record is categorized as an OCR complaint while the source type is government guidance.",
      next_step: "Check whether the source directly documents the specific OCR matter or whether the record needs a stronger primary locator."
    });
  }

  if (HIGH_STAKES_CATEGORIES.has(record.category) && (!record.classification_rationale || !record.confidence_rationale)) {
    addIssue(issues, {
      id: "high_stakes_record_needs_explicit_rationale",
      severity: "high",
      field: "rationale",
      title: "High-stakes record needs explicit rationale",
      detail: "Legal, OCR, accessibility, athletic-equity, and criminal-investigation categories need unusually clear classification and confidence rationale.",
      next_step: "Add source-bounded rationale before treating the record as ready for external review."
    });
  }

  return issues;
}

function labelIssues(record) {
  const issues = [];
  const communities = record.affected_communities ?? [];

  if (communities.some((community) => BROAD_COMMUNITY_LABELS.has(community)) && !hasSourceSupportedBroadLabels(record)) {
    addIssue(issues, {
      id: "broad_affected_community_label",
      severity: "medium",
      field: "affected_communities",
      title: "Affected-community label is broad",
      detail: "The affected-community label may be accurate as source metadata, but it is broad enough to deserve source-text boundary review.",
      next_step: "Confirm whether the source supports this exact label or whether a narrower label/note is needed."
    });
  }

  if (((communities.length > 2 && record.category === "OCR complaint") || communities.length > 4) && !hasSourceSupportedBroadLabels(record)) {
    addIssue(issues, {
      id: "multi_community_label_boundary_review",
      severity: "medium",
      field: "affected_communities",
      title: "Multi-community label boundary needs review",
      detail: "The record uses multiple affected-community labels; reviewers should confirm each label is source-supported at the same level.",
      next_step: "Check source wording for each listed community and remove or qualify labels that are only contextual."
    });
  }

  return issues;
}

function dateIssues(record, sourcesById) {
  const issues = [];
  const sources = linkedSources(record, sourcesById);

  if (record.date_precision === "year" && !hasSourceSupportedYearPrecision(record)) {
    addIssue(issues, {
      id: "year_precision_public_use_limit",
      severity: "medium",
      field: "date",
      title: "Year-level date precision",
      detail: "The stored date should be read as a year-level locator, not as an exact incident date.",
      next_step: "Keep the year precision visible or add a narrower source-supported date only after direct source review."
    });
  }

  if (record.date_precision === "day" && sources.some((source) => /mixed/i.test(String(source.published_date))) && !aggregateLocatorMatchesRecordDate(record, sources)) {
    addIssue(issues, {
      id: "day_precision_from_mixed_date_source",
      severity: "high",
      field: "date",
      title: "Day precision from mixed-date source needs review",
      detail: "A day-level record date is linked to a source whose metadata contains mixed publication dates.",
      next_step: "Verify the exact item date in the public source before relying on day-level precision."
    });
  }

  return issues;
}

function responseIssues(record) {
  const issues = [];
  const responseDepth = classifyResponseDepth(record);

  if (responseDepth.code === "no_public_response_found") {
    addIssue(issues, {
      id: "no_public_response_stored",
      severity: "medium",
      field: "institutional_response",
      title: "No public response stored",
      detail: "The record has no stored public response text in current metadata.",
      next_step: "Search for a direct or agency-described public response, or keep the no-response-found label explicit."
    });
  }

  if (responseDepth.code === "limited_public_response_note" && !hasExplicitLimitedResponseDepth(record)) {
    addIssue(issues, {
      id: "thin_response_note",
      severity: "medium",
      field: "institutional_response",
      title: "Response text is a bounded note",
      detail: "The response field explains the source limitation rather than describing a direct institutional response.",
      next_step: "Keep the limited-response label visible or replace it only with source-supported public response text."
    });
  }

  return issues;
}

function rationaleIssues(record) {
  const issues = [];
  const missing = ["classification_rationale", "community_rationale", "confidence_rationale"].filter((field) => !record[field]);
  if (missing.length > 0) {
    addIssue(issues, {
      id: "missing_explicit_rationales",
      severity: "high",
      field: "rationale",
      title: "Missing explicit rationale fields",
      detail: `Missing rationale fields: ${missing.join(", ")}.`,
      next_step: "Add source-bounded rationale fields before treating the record as externally review-ready."
    });
  }

  const generic = ["classification_rationale", "community_rationale", "confidence_rationale"].filter((field) => GENERIC_RATIONALE_PATTERN.test(record[field] ?? ""));
  if (generic.length > 0) {
    addIssue(issues, {
      id: "generic_or_generated_rationale",
      severity: "medium",
      field: "rationale",
      title: "Rationale appears generic",
      detail: `Rationale fields may be generated from metadata rather than source-specific reasoning: ${generic.join(", ")}.`,
      next_step: "Replace generic rationale with source-specific wording during hand review."
    });
  }

  return issues;
}

function severityRank(severity) {
  return { blocker: 4, high: 3, medium: 2, low: 1 }[severity] ?? 0;
}

function statusForIssues(issues) {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked_before_external_packet";
  if (issues.some((issue) => issue.severity === "high")) return "needs_internal_review";
  if (issues.some((issue) => issue.severity === "medium")) return "usable_with_review_notes";
  return "lower_priority_for_review";
}

function reviewScore(issues) {
  return issues.reduce((sum, issue) => sum + severityRank(issue.severity), 0);
}

export function auditRecordQuality(record, { sources = [], liveAudit = {} } = {}) {
  const sourcesById = Array.isArray(sources) ? sourceMap(sources) : sources;
  const liveBySourceId = liveAudit instanceof Map ? liveAudit : liveAuditMap(liveAudit);
  const issues = [
    ...sourceLocatorIssues(record, sourcesById, liveBySourceId),
    ...classificationIssues(record, sourcesById),
    ...labelIssues(record),
    ...dateIssues(record, sourcesById),
    ...responseIssues(record),
    ...rationaleIssues(record)
  ];

  return {
    event_id: record.id,
    school_id: record.school_id,
    category: record.category,
    confidence: record.confidence,
    date_precision: record.date_precision,
    source_count: sourceCount(record),
    source_types: sourceTypes(record, sourcesById),
    response_depth: classifyResponseDepth(record).code,
    audit_status: statusForIssues(issues),
    review_score: reviewScore(issues),
    issue_ids: unique(issues.map((issue) => issue.id)),
    highest_severity: issues.map((issue) => issue.severity).sort((a, b) => severityRank(b) - severityRank(a))[0] ?? "none",
    issue_count: issues.length,
    issues,
    workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(record.id)}`,
    event_url: `/events/${encodeURIComponent(record.id)}/`
  };
}

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function slimRecord(record) {
  return {
    event_id: record.event_id,
    school_id: record.school_id,
    category: record.category,
    confidence: record.confidence,
    date_precision: record.date_precision,
    source_count: record.source_count,
    source_types: record.source_types,
    response_depth: record.response_depth,
    audit_status: record.audit_status,
    review_score: record.review_score,
    highest_severity: record.highest_severity,
    issue_count: record.issue_count,
    issue_ids: record.issue_ids,
    workspace_url: record.workspace_url,
    event_url: record.event_url
  };
}

function expandedGoldRecord(record, goldPacketByEventId) {
  const packet = goldPacketByEventId.get(record.event_id);
  return {
    ...record,
    gold_packet_status: packet?.status ?? null,
    gold_selection_reason: packet?.selection_reason ?? null,
    challenge_url: packet?.challenge_url ?? `/challenge/?record=${encodeURIComponent(record.event_id)}`,
    reviewer_prompt:
      "Review this record for source locator specificity, category fit, affected-community label boundaries, response-depth accuracy, date precision, and rationale specificity."
  };
}

export function buildRecordQualityAudit({ events, sources = [], liveAudit = {}, goldRecordV1 = {}, manifest = {}, priorityLimit = 100 }) {
  const goldPacketByEventId = new Map((goldRecordV1.records ?? []).map((record) => [record.event_id, record]));
  const records = events.map((event) => auditRecordQuality(event, { sources, liveAudit }));
  const priorityRecords = [...records]
    .sort((a, b) => b.review_score - a.review_score || a.event_id.localeCompare(b.event_id))
    .slice(0, priorityLimit)
    .map(slimRecord);
  const goldRecords = records
    .filter((record) => goldPacketByEventId.has(record.event_id))
    .sort((a, b) => (goldPacketByEventId.get(a.event_id)?.review_score ?? 0) - (goldPacketByEventId.get(b.event_id)?.review_score ?? 0))
    .map((record) => expandedGoldRecord(record, goldPacketByEventId));

  return {
    id: "record_quality_audit_v1",
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? "2026-06-03",
    method:
      "Deterministic metadata and source-locator audit for every record, with expanded pre-review notes for Gold v1 records. It identifies review risks and public-use limits; it is not direct source re-review, outside validation, endorsement, ranking, prevalence measurement, or legal adjudication.",
    public_claim_limit:
      "This audit is an internal pre-review triage artifact. It must not be described as third-party review, external validation, institutional quality judgment, safety scoring, severity scoring, frequency measurement, or legal finding.",
    totals: {
      records: records.length,
      gold_v1_records: goldRecords.length,
      priority_records: priorityRecords.length,
      blocked_before_external_packet: records.filter((record) => record.audit_status === "blocked_before_external_packet").length,
      needs_internal_review: records.filter((record) => record.audit_status === "needs_internal_review").length,
      usable_with_review_notes: records.filter((record) => record.audit_status === "usable_with_review_notes").length,
      lower_priority_for_review: records.filter((record) => record.audit_status === "lower_priority_for_review").length
    },
    status_counts: countValues(records.map((record) => record.audit_status)),
    highest_severity_counts: countValues(records.map((record) => record.highest_severity)),
    issue_counts: countValues(records.flatMap((record) => record.issue_ids)),
    priority_records: priorityRecords,
    gold_v1_pre_review: goldRecords,
    records: records.map(slimRecord)
  };
}

function sourceEventIdsFromAudit(audit, sourceId, sources = []) {
  const source = sources.find((candidate) => candidate.id === sourceId);
  if (!source) return [];
  const matchingType = source.source_type;
  return (audit.records ?? [])
    .filter((record) => (record.source_types ?? []).includes(matchingType))
    .map((record) => record.event_id);
}

function sourceLinkReview({ audit, sources = [], liveAudit = {} }) {
  const liveEntries = liveAudit.entries ?? [];
  const hardBrokenSources = [];
  const locatorRiskSources = [];
  const brokenRecordIds = [];
  const sourcesById = sourceMap(sources);

  for (const entry of liveEntries) {
    if (entry.launch_check_status === "live_checked" && entry.live_status && entry.live_status !== "ok") {
      hardBrokenSources.push({
        source_id: entry.source_id,
        live_status: entry.live_status,
        http_status: entry.http_status ?? null,
        final_url: entry.final_url ?? null,
        referenced_record_count: entry.referenced_record_count ?? null
      });
      brokenRecordIds.push(...(entry.referenced_event_ids ?? sourceEventIdsFromAudit(audit, entry.source_id, sources)));
    }

    const citedUrl = entry.external_url ?? sourcesById.get(entry.source_id)?.url ?? null;
    if (entry.final_url && citedUrl && normalizedUrl(entry.final_url) !== normalizedUrl(citedUrl)) {
      locatorRiskSources.push({
        source_id: entry.source_id,
        live_status: entry.live_status ?? null,
        http_status: entry.http_status ?? null,
        cited_url: citedUrl,
        final_url: entry.final_url,
        referenced_record_count: entry.referenced_record_count ?? null
      });
    }
  }

  const recordsAffectedByLocatorRisk = unique(
    (audit.records ?? [])
      .filter((record) => (record.issue_ids ?? []).includes("source_redirect_locator_risk"))
      .map((record) => record.event_id)
  );
  const recordsAffectedByBrokenSources = unique(brokenRecordIds);

  return {
    sources_checked_live: liveEntries.filter((entry) => entry.launch_check_status === "live_checked").length,
    hard_broken_sources: hardBrokenSources,
    locator_risk_sources: locatorRiskSources,
    records_affected_by_broken_sources: recordsAffectedByBrokenSources,
    records_affected_by_locator_risk: recordsAffectedByLocatorRisk
  };
}

function queueFromRecords(id, label, description, records, limit) {
  return {
    id,
    label,
    description,
    records: records
      .slice()
      .sort((a, b) => b.review_score - a.review_score || a.event_id.localeCompare(b.event_id))
      .slice(0, limit)
      .map((record) => ({
        event_id: record.event_id,
        school_id: record.school_id,
        audit_status: record.audit_status,
        review_score: record.review_score,
        highest_severity: record.highest_severity,
        issue_ids: record.issue_ids,
        workspace_url: record.workspace_url,
        event_url: record.event_url,
        challenge_url: record.challenge_url ?? `/challenge/?record=${encodeURIComponent(record.event_id)}`
      }))
  };
}

function recordsWithIssue(audit, issueId) {
  return (audit.records ?? []).filter((record) => (record.issue_ids ?? []).includes(issueId));
}

export function buildRecordQualityReviewerPacket({ audit, sources = [], liveAudit = {}, manifest = {}, limit = 25 }) {
  const sourceReview = sourceLinkReview({ audit, sources, liveAudit });
  const goldRecords = audit.gold_v1_pre_review ?? [];
  const allRecords = audit.records ?? [];

  return {
    id: "record_quality_reviewer_packet_v1",
    snapshot_id: manifest.snapshot_id ?? audit.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? audit.generated_at ?? "2026-06-03",
    status: "internal_pre_review_packet",
    method:
      "Reviewer packet generated from the record-quality audit and fresh live source-audit results. It prioritizes records for source locator, label, date, response-depth, rationale, and category-fit review without claiming outside validation, ranking, scoring, frequency measurement, or legal adjudication.",
    public_claim_limit:
      "This reviewer packet is a triage aid. It is not third-party review, outside validation, endorsement, ranking, safety scoring, severity scoring, frequency measurement, or a legal finding.",
    review_scope: {
      records_checked: audit.totals?.records ?? allRecords.length,
      gold_v1_records_checked: audit.totals?.gold_v1_records ?? goldRecords.length,
      priority_records_checked: audit.totals?.priority_records ?? (audit.priority_records ?? []).length,
      source_urls_checked_live: sourceReview.sources_checked_live
    },
    audit_summary: {
      status_counts: audit.status_counts ?? {},
      highest_severity_counts: audit.highest_severity_counts ?? {},
      top_issue_counts: Object.fromEntries(Object.entries(audit.issue_counts ?? {}).slice(0, 12))
    },
    source_link_review: sourceReview,
    priority_queues: {
      blocker_records: queueFromRecords(
        "blocker_records",
        "Records blocked before external packet use",
        "Records with source or locator issues that should be repaired before being routed for outside review.",
        allRecords.filter((record) => record.audit_status === "blocked_before_external_packet"),
        limit
      ),
      gold_v1_records: queueFromRecords(
        "gold_v1_records",
        "Gold v1 pre-review records",
        "Gold v1 packets with expanded internal issue notes for reviewer challenge.",
        goldRecords,
        limit
      ),
      dataset_locator_records: queueFromRecords(
        "dataset_locator_records",
        "Dataset locator records",
        "Dataset-backed records that need workbook, table, row, or cell locator review before quotation.",
        recordsWithIssue(audit, "dataset_cell_locator_needed"),
        limit
      ),
      broad_label_records: queueFromRecords(
        "broad_label_records",
        "Broad affected-label records",
        "Records whose affected-community labels should be checked against source wording before narrower public use.",
        recordsWithIssue(audit, "broad_affected_community_label"),
        limit
      ),
      rationale_records: queueFromRecords(
        "rationale_records",
        "Rationale review records",
        "Records with missing or generic rationale fields that need source-specific classification, community, or confidence reasoning.",
        [...recordsWithIssue(audit, "missing_explicit_rationales"), ...recordsWithIssue(audit, "generic_or_generated_rationale")],
        limit
      ),
      date_precision_records: queueFromRecords(
        "date_precision_records",
        "Date precision records",
        "Records where year-level dates or mixed-date sources require clearer date limits.",
        [...recordsWithIssue(audit, "year_precision_public_use_limit"), ...recordsWithIssue(audit, "day_precision_from_mixed_date_source")],
        limit
      ),
      category_fit_records: queueFromRecords(
        "category_fit_records",
        "Category-fit records",
        "Records where category language may be broader than the source offense or source type supports.",
        [...recordsWithIssue(audit, "category_may_be_too_generic_for_offense"), ...recordsWithIssue(audit, "guidance_source_category_fit_review")],
        limit
      ),
      response_depth_records: queueFromRecords(
        "response_depth_records",
        "Response-depth records",
        "Records whose response field is thin, bounded, or missing and should not be read as a substantive institutional response.",
        [...recordsWithIssue(audit, "thin_response_note"), ...recordsWithIssue(audit, "no_public_response_stored")],
        limit
      )
    },
    reviewer_checklist: [
      "Open the linked source before accepting any record wording.",
      "Check whether the stored source URL lands on the exact cited item, not only the publisher site.",
      "For dataset records, confirm workbook, table, row, or cell basis before quotation.",
      "Check whether category language is a neutral documentation label and not a severity or legal conclusion.",
      "Check each affected-community label against the source wording and remove or qualify labels that are only contextual.",
      "Check whether date precision is exact day, month, or year-level only.",
      "Check whether response-depth language distinguishes direct institutional response, agency-described action, limited public note, and no public response found.",
      "Replace generic rationale with source-specific rationale only when the public source supports it.",
      "Submit corrections with record ID, disputed field, source URL, and exact proposed wording."
    ],
    next_internal_actions: [
      "Repair blocker source locators before sending those records to outside reviewers.",
      "Use Gold v1 pre-review rows as the first bounded outside reviewer packet.",
      "Prioritize dataset locator review and explicit rationale review before adding more records.",
      "Keep all review language framed as source-support review, not campus comparison."
    ]
  };
}

function gate(status, detail, required_action) {
  return { status, detail, required_action };
}

function gateStatus(record, failIssues, reviewIssues, passDetail, failAction, reviewAction = failAction) {
  const issueIds = new Set(record.issue_ids ?? []);
  if (failIssues.some((issue) => issueIds.has(issue))) {
    return gate("fail", failIssues.filter((issue) => issueIds.has(issue)).join(", "), failAction);
  }
  if (reviewIssues.some((issue) => issueIds.has(issue))) {
    return gate("needs_review", reviewIssues.filter((issue) => issueIds.has(issue)).join(", "), reviewAction);
  }
  return gate("pass", passDetail, "No action required by deterministic audit.");
}

function certificationStatus(gates) {
  const values = Object.values(gates).map((gateValue) => gateValue.status);
  if (gates.source_locator?.status === "fail") return "blocked";
  if (values.includes("needs_review")) return "not_certified";
  if (values.includes("fail")) return "not_certified";
  return "certified";
}

function certificationRecord(packet, auditRecord) {
  const gates = {
    source_locator: gateStatus(
      auditRecord,
      ["missing_linked_source", "missing_source_url", "live_source_check_not_ok", "source_redirect_locator_risk"],
      ["page_table_locator_needed", "aggregated_source_item_locator_needed"],
      "Linked source locator has no deterministic blocker.",
      "Repair or replace the source locator before external packet use.",
      "Add page, table, item, or document-section locator detail before certification."
    ),
    dataset_cell_or_item_locator: gateStatus(
      auditRecord,
      ["dataset_cell_locator_needed", "aggregated_source_item_locator_needed"],
      ["page_table_locator_needed"],
      "No dataset-cell or aggregate-item locator issue detected.",
      "Add workbook, sheet, table, row, column, cell, or aggregate-item locator detail before certification.",
      "Add page/table locator detail before certification."
    ),
    date_precision: gateStatus(
      auditRecord,
      ["day_precision_from_mixed_date_source"],
      ["year_precision_public_use_limit"],
      "Date precision has no deterministic audit issue.",
      "Verify exact item date or reduce precision before certification.",
      "Confirm year-level precision remains visible and source-supported before certification."
    ),
    category_fit: gateStatus(
      auditRecord,
      ["category_may_be_too_generic_for_offense", "guidance_source_category_fit_review"],
      [],
      "Category fit has no deterministic audit issue.",
      "Review source wording and either narrow the category, add source-offense context, or keep the record uncertified."
    ),
    affected_label_boundary: gateStatus(
      auditRecord,
      [],
      ["broad_affected_community_label", "multi_community_label_boundary_review"],
      "Affected-community labels have no deterministic boundary issue.",
      "Confirm each affected-community label against source wording before certification."
    ),
    response_depth: gateStatus(
      auditRecord,
      [],
      ["thin_response_note", "no_public_response_stored"],
      "Response-depth label has no deterministic audit issue.",
      "Confirm response-depth label and avoid treating limited notes as direct institutional response."
    ),
    rationale_specificity: gateStatus(
      auditRecord,
      ["missing_explicit_rationales"],
      ["generic_or_generated_rationale"],
      "Rationale fields have no deterministic audit issue.",
      "Add classification, affected-community, and confidence rationales before certification.",
      "Replace generic rationale with source-specific rationale before certification."
    )
  };

  return {
    event_id: packet.event_id,
    school_name: packet.school_name ?? null,
    category: packet.category ?? auditRecord.category,
    confidence: packet.confidence ?? auditRecord.confidence,
    certification_status: certificationStatus(gates),
    audit_status: auditRecord.audit_status,
    issue_ids: auditRecord.issue_ids ?? [],
    gates,
    workspace_url: auditRecord.workspace_url,
    event_url: auditRecord.event_url,
    challenge_url: packet.challenge_url ?? `/challenge/?record=${encodeURIComponent(packet.event_id)}`
  };
}

export function buildGoldV1CertificationStatus({ audit, goldRecordV1 = {}, manifest = {} }) {
  const auditByEventId = new Map((audit.gold_v1_pre_review ?? audit.records ?? []).map((record) => [record.event_id, record]));
  const records = (goldRecordV1.records ?? []).map((packet) => {
    const auditRecord = auditByEventId.get(packet.event_id);
    if (!auditRecord) {
      return {
        event_id: packet.event_id,
        school_name: packet.school_name ?? null,
        category: packet.category ?? null,
        confidence: packet.confidence ?? null,
        certification_status: "blocked",
        audit_status: "missing_audit_record",
        issue_ids: ["missing_gold_audit_row"],
        gates: {
          source_locator: gate("fail", "missing_gold_audit_row", "Regenerate record-quality audit before certification.")
        },
        workspace_url: packet.workspace_url ?? `/research-workspace/?record_ids=${encodeURIComponent(packet.event_id)}`,
        event_url: packet.event_url ?? `/events/${encodeURIComponent(packet.event_id)}/`,
        challenge_url: packet.challenge_url ?? `/challenge/?record=${encodeURIComponent(packet.event_id)}`
      };
    }
    return certificationRecord(packet, auditRecord);
  });

  return {
    id: "gold_v1_certification_status",
    snapshot_id: manifest.snapshot_id ?? audit.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? audit.generated_at ?? "2026-06-03",
    status: "internal_certification_gate_status",
    method:
      "Strict certification-gate status generated from Gold v1 packets and record-quality audit issues. Certified means no deterministic gate failures or review-needed signals remain; it is not outside validation, endorsement, ranking, scoring, frequency measurement, or legal adjudication.",
    public_claim_limit:
      "Gold v1 certification status is internal source-to-record readiness triage. It must not be described as third-party review, external validation, institutional quality judgment, safety scoring, severity scoring, frequency measurement, or legal finding.",
    certification_gates: [
      "source_locator",
      "dataset_cell_or_item_locator",
      "date_precision",
      "category_fit",
      "affected_label_boundary",
      "response_depth",
      "rationale_specificity"
    ],
    totals: {
      records: records.length,
      certified: records.filter((record) => record.certification_status === "certified").length,
      not_certified: records.filter((record) => record.certification_status === "not_certified").length,
      blocked: records.filter((record) => record.certification_status === "blocked").length
    },
    records
  };
}

export function hasProhibitedRecordAuditClaim(value) {
  const text = String(value ?? "");
  PROHIBITED_AUDIT_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_AUDIT_PATTERN)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 220), match.index ?? 0).toLowerCase();
    const sameClause = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
    if (/\b(?:not|no|nor|without|cannot|never|must not|is not|are not|does not|do not)\b/.test(sameClause)) continue;
    return true;
  }
  return false;
}

export function validateRecordQualityAudit({ audit, events = [], goldRecordV1 = {}, manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const goldIds = new Set((goldRecordV1.records ?? []).map((record) => record.event_id));

  if (audit.id !== "record_quality_audit_v1") errors.push("record-quality-audit id must be record_quality_audit_v1");
  if (audit.snapshot_id !== (manifest.snapshot_id ?? audit.snapshot_id)) errors.push("record-quality-audit snapshot_id must match snapshot manifest");
  if (audit.generated_at !== (manifest.created_at ?? audit.generated_at)) errors.push("record-quality-audit generated_at must match snapshot manifest created_at");
  if (audit.totals?.records !== events.length) errors.push("record-quality-audit totals.records must match event count");
  if (!Array.isArray(audit.records) || audit.records.length !== events.length) errors.push("record-quality-audit must include one compact row per event");
  if (!Array.isArray(audit.priority_records) || audit.priority_records.length === 0 || audit.priority_records.length > 100) {
    errors.push("record-quality-audit priority_records must include 1-100 rows");
  }
  if (!Array.isArray(audit.gold_v1_pre_review) || audit.gold_v1_pre_review.length !== goldIds.size) {
    errors.push("record-quality-audit gold_v1_pre_review must match gold v1 packet count");
  }

  for (const row of [...(audit.records ?? []), ...(audit.priority_records ?? [])]) {
    if (!eventIds.has(row.event_id)) errors.push(`record-quality-audit references unknown event ${row.event_id}`);
    if (!row.audit_status || !row.workspace_url || !row.event_url) errors.push(`record-quality-audit row ${row.event_id} missing status or URLs`);
    if (!Array.isArray(row.issue_ids)) errors.push(`record-quality-audit row ${row.event_id} missing issue_ids array`);
  }

  for (const row of audit.gold_v1_pre_review ?? []) {
    if (!goldIds.has(row.event_id)) errors.push(`record-quality-audit gold row ${row.event_id} is not in gold v1`);
    if (!Array.isArray(row.issues)) {
      errors.push(`record-quality-audit gold row ${row.event_id} missing expanded issues array`);
    } else if ((row.issue_ids?.length ?? 0) > 0 && row.issues.length === 0) {
      errors.push(`record-quality-audit gold row ${row.event_id} missing expanded issues`);
    }
    if (!row.reviewer_prompt || !row.challenge_url) errors.push(`record-quality-audit gold row ${row.event_id} missing reviewer prompt or challenge URL`);
  }

  if (hasProhibitedRecordAuditClaim(JSON.stringify(audit))) {
    errors.push("record-quality-audit includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }

  return errors;
}

export function validateRecordQualityReviewerPacket({ packet, audit, events = [], manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  if (packet.id !== "record_quality_reviewer_packet_v1") errors.push("record-quality-reviewer-packet id must be record_quality_reviewer_packet_v1");
  if (packet.snapshot_id !== (manifest.snapshot_id ?? packet.snapshot_id)) {
    errors.push("record-quality-reviewer-packet snapshot_id must match snapshot manifest");
  }
  if (packet.generated_at !== (manifest.created_at ?? packet.generated_at)) {
    errors.push("record-quality-reviewer-packet generated_at must match snapshot manifest created_at");
  }
  if (packet.review_scope?.records_checked !== audit.totals?.records) {
    errors.push("record-quality-reviewer-packet review_scope.records_checked must match record-quality-audit totals.records");
  }
  if (!packet.source_link_review || typeof packet.source_link_review.sources_checked_live !== "number") {
    errors.push("record-quality-reviewer-packet missing source_link_review");
  }
  if (!packet.priority_queues || Object.keys(packet.priority_queues).length < 8) {
    errors.push("record-quality-reviewer-packet must include the required priority queues");
  }
  for (const queue of Object.values(packet.priority_queues ?? {})) {
    if (!queue.id || !queue.label || !queue.description) errors.push("record-quality-reviewer-packet queue missing id, label, or description");
    if (!Array.isArray(queue.records)) errors.push(`record-quality-reviewer-packet queue ${queue.id ?? "unknown"} missing records`);
    for (const record of queue.records ?? []) {
      if (!eventIds.has(record.event_id)) errors.push(`record-quality-reviewer-packet references unknown event ${record.event_id}`);
      if (!record.workspace_url || !record.event_url || !record.challenge_url) {
        errors.push(`record-quality-reviewer-packet record ${record.event_id} missing review URLs`);
      }
    }
  }
  if (!Array.isArray(packet.reviewer_checklist) || packet.reviewer_checklist.length < 6) {
    errors.push("record-quality-reviewer-packet reviewer_checklist must include at least six checks");
  }
  if (hasProhibitedRecordAuditClaim(JSON.stringify(packet))) {
    errors.push("record-quality-reviewer-packet includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }
  return errors;
}

export function validateGoldV1CertificationStatus({ status, goldRecordV1 = {}, events = [], manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const goldIds = new Set((goldRecordV1.records ?? []).map((record) => record.event_id));
  if (status.id !== "gold_v1_certification_status") errors.push("gold-v1-certification-status id must be gold_v1_certification_status");
  if (status.snapshot_id !== (manifest.snapshot_id ?? status.snapshot_id)) {
    errors.push("gold-v1-certification-status snapshot_id must match snapshot manifest");
  }
  if (status.generated_at !== (manifest.created_at ?? status.generated_at)) {
    errors.push("gold-v1-certification-status generated_at must match snapshot manifest created_at");
  }
  if (!Array.isArray(status.records) || status.records.length !== goldIds.size) {
    errors.push("gold-v1-certification-status records must match gold v1 record count");
  }
  for (const record of status.records ?? []) {
    if (!eventIds.has(record.event_id)) errors.push(`gold-v1-certification-status references unknown event ${record.event_id}`);
    if (!goldIds.has(record.event_id)) errors.push(`gold-v1-certification-status includes non-gold record ${record.event_id}`);
    if (!["certified", "not_certified", "blocked"].includes(record.certification_status)) {
      errors.push(`gold-v1-certification-status ${record.event_id} has invalid certification_status`);
    }
    if (!record.gates || Object.keys(record.gates).length === 0) {
      errors.push(`gold-v1-certification-status ${record.event_id} missing gates`);
    }
    for (const [gateId, gateValue] of Object.entries(record.gates ?? {})) {
      if (!["pass", "needs_review", "fail"].includes(gateValue.status)) {
        errors.push(`gold-v1-certification-status ${record.event_id} gate ${gateId} has invalid status`);
      }
      if (!gateValue.detail || !gateValue.required_action) {
        errors.push(`gold-v1-certification-status ${record.event_id} gate ${gateId} missing detail or required_action`);
      }
    }
  }
  if (hasProhibitedRecordAuditClaim(JSON.stringify(status))) {
    errors.push("gold-v1-certification-status includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }
  return errors;
}
