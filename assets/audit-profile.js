function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function sentenceJoin(items) {
  return unique(items).join(", ");
}

function sourceTitleMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source.title]));
}

function normalizedSources(record, sources) {
  const linked = sources ?? [];
  const sourceIds = linked.length ? linked.map((source) => source.id) : record.source_ids ?? [];
  const sourceTypes = linked.length ? linked.map((source) => source.source_type) : record.source_types ?? [];
  return {
    sourceIds: unique(sourceIds),
    sourceTypes: unique(sourceTypes)
  };
}

function defaultLimitations() {
  return [
    "This record is not a school ranking, safety score, severity score, or prevalence estimate.",
    "The record reflects public-source documentation available to Campus Evidence Lab, not a complete account of private reports or lived experience.",
    "Confidence describes source support, not legal truth, institutional intent, or moral severity."
  ];
}

function defaultFieldSupport(record, sourceIds) {
  const rows = [
    ["School", record.school_id],
    ["Date", record.date],
    ["Location", record.location],
    ["Category", record.category],
    ["Affected communities", record.affected_communities?.length],
    ["Description", record.description],
    ["Institutional response", record.institutional_response],
    ["Legal status", record.legal_status]
  ];

  return rows
    .filter(([, value]) => Boolean(value))
    .map(([field]) => ({
      field,
      sourceIds,
      rationale: `${field} is recorded from the linked public source material and should be checked against the source text before reuse.`
    }));
}

function explicitFieldSupport(record, sources) {
  if (!Array.isArray(record.field_support) || record.field_support.length === 0) return null;
  const titles = sourceTitleMap(sources);
  return record.field_support.map((row) => ({
    field: row.field,
    sourceIds: row.source_ids ?? [],
    sourceTitles: (row.source_ids ?? []).map((id) => titles.get(id)).filter(Boolean),
    rationale: row.rationale
  }));
}

function withSourceTitles(rows, sources) {
  const titles = sourceTitleMap(sources);
  return rows.map((row) => ({
    ...row,
    sourceTitles: row.sourceIds.map((id) => titles.get(id)).filter(Boolean)
  }));
}

export function buildAuditProfile(record, sources = []) {
  const { sourceIds, sourceTypes } = normalizedSources(record, sources);
  const sourceCount = sourceIds.length;
  const sourceBasis = `${sourceCount} linked public source${sourceCount === 1 ? "" : "s"}: ${sentenceJoin(sourceTypes) || "source type not recorded"}.`;

  const classificationRationale =
    record.classification_rationale ||
    `Category "${record.category}" is a documentation label based on the linked public source material; it is not an independent legal finding by Campus Evidence Lab.`;

  const communityRationale =
    record.community_rationale ||
    `Affected community label${record.affected_communities?.length === 1 ? "" : "s"} (${sentenceJoin(record.affected_communities ?? [])}) reflect the communities named or described in public source material, not an independent finding of motive.`;

  const confidenceRationale =
    record.confidence_rationale ||
    `${record.confidence} confidence reflects ${record.verification_status.toLowerCase()} and source support, not severity.`;

  const fieldSupport = explicitFieldSupport(record, sources) ?? withSourceTitles(defaultFieldSupport(record, sourceIds), sources);

  return {
    sourceBasis,
    classificationRationale,
    communityRationale,
    confidenceRationale,
    fieldSupport,
    limitations: Array.isArray(record.limitations) && record.limitations.length ? record.limitations : defaultLimitations()
  };
}

export function auditProfileForExport(record, sources = []) {
  const profile = buildAuditProfile(record, sources);
  return {
    source_basis: profile.sourceBasis,
    classification_rationale: profile.classificationRationale,
    community_rationale: profile.communityRationale,
    confidence_rationale: profile.confidenceRationale,
    field_support: profile.fieldSupport.map((row) => ({
      field: row.field,
      source_ids: row.sourceIds,
      source_titles: row.sourceTitles,
      rationale: row.rationale
    })),
    limitations: profile.limitations
  };
}
