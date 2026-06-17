function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function eventMap(events) {
  return new Map((events ?? []).map((event) => [event.id, event]));
}

function institutionalResponseSupport(event, sourceIds) {
  return {
    field: "Institutional response",
    source_ids: sourceIds,
    rationale:
      "Response-depth repair queue classifies this as limited_public_response_note because the linked government-release-like source supports a public response note but does not document a direct institutional response."
  };
}

function responseDepthOperation(event, proposedResponseDepth) {
  return {
    op: event.response_depth ? "replace" : "add",
    path: "/response_depth",
    current_value: event.response_depth ?? null,
    value: proposedResponseDepth
  };
}

function fieldSupportOperation(event, supportValue) {
  const hasInstitutionalResponseSupport = (event.field_support ?? []).some((entry) => entry.field === "Institutional response");
  return {
    op: hasInstitutionalResponseSupport ? "replace" : "add",
    path: "/field_support/Institutional response",
    current_value: hasInstitutionalResponseSupport
      ? (event.field_support ?? []).find((entry) => entry.field === "Institutional response")
      : null,
    value: supportValue
  };
}

function repairRecord({ auditRecord, event }) {
  if (!event) {
    return {
      event_id: auditRecord.event_id,
      issue_id: auditRecord.issue_id,
      status: "blocked_missing_event_row",
      current_response_depth: null,
      proposed_response_depth: auditRecord.recommended_response_depth ?? null,
      rationale: "The audit flagged this event, but the event row was not found in data/events.json.",
      operations: []
    };
  }

  const proposedResponseDepth = auditRecord.recommended_response_depth ?? "limited_public_response_note";
  const supportValue = institutionalResponseSupport(event, auditRecord.source_ids?.length ? auditRecord.source_ids : event.source_ids ?? []);

  return {
    event_id: event.id,
    school_id: event.school_id,
    issue_id: auditRecord.issue_id,
    status: "proposed_repair",
    current_response_depth: event.response_depth ?? null,
    proposed_response_depth: proposedResponseDepth,
    institutional_response: event.institutional_response ?? "",
    rationale:
      auditRecord.rationale ??
      "The government-release response-depth audit flagged this row for response-depth repair before source-family certification.",
    operations: [responseDepthOperation(event, proposedResponseDepth), fieldSupportOperation(event, supportValue)]
  };
}

export function buildGovernmentReleaseResponseDepthRepairQueue({ events = [], audit = {} }) {
  const eventsById = eventMap(events);
  const records = (audit.records ?? [])
    .filter((record) => record.issue_id)
    .map((auditRecord) => repairRecord({ auditRecord, event: eventsById.get(auditRecord.event_id) }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return a.event_id.localeCompare(b.event_id);
    });

  const proposed = records.filter((record) => record.status === "proposed_repair");
  const blocked = records.filter((record) => record.status !== "proposed_repair");

  return {
    id: "government_release_response_depth_repair_queue_v1",
    generated_at: "2026-06-17",
    status: "pre_application_repair_queue",
    method:
      "Deterministic repair queue generated from the government-release response-depth audit. It proposes exact response-depth and field-support edits for flagged rows before any certification decision.",
    public_claim_limit:
      "This queue is not certification or outside approval; it is a bounded internal work order for source-to-record repair.",
    application_rule:
      "Apply only in a clean source-to-record repair wave, then regenerate hashes, generated public pages, certification ledgers, and validation artifacts.",
    proposed_repairs: proposed.length,
    blocked_repairs: blocked.length,
    issue_counts: countValues(proposed.map((record) => record.issue_id)),
    records
  };
}
