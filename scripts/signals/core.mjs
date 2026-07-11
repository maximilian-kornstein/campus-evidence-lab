import { createHash } from "node:crypto";

export const SIGNAL_POLICY_VERSION = "cel-signals-v1";
export const SHADOW_SIGNAL_MINIMUM = 30;
export const DAILY_ORIGINAL_MIN = 15;
export const DAILY_ORIGINAL_MAX = 25;
export const DAILY_PROACTIVE_REPLY_MAX = 3;
export const INSTITUTION_COOLDOWN_DAYS = 7;
export const DISTRIBUTION_HOLDOUT_PERCENT = 20;

const PROHIBITED_CLAIMS = /\b(safest|most dangerous|worst campus|best campus|safety score|severity score|prevalence|proved discrimination|guilty|liable|cover[- ]?up)\b/i;
const PRIVATE_SOURCE = /(?:instagram|facebook|tiktok|x\.com|twitter\.com|reddit\.com|discord|private message|direct message)/i;

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hash(prefix, parts) {
  const digest = createHash("sha256").update(parts.map(text).join("|")).digest("hex").slice(0, 20);
  return `${prefix}_${digest}`;
}

export function normalizeTrigger(input) {
  const title = text(input.title);
  const url = text(input.url);
  const publishedAt = text(input.published_at || input.publishedAt);
  const institutionIds = [...new Set((input.institution_ids ?? input.institutionIds ?? []).map(text).filter(Boolean))].sort();
  const topics = [...new Set((input.topics ?? []).map((value) => text(value).toLowerCase()).filter(Boolean))].sort();
  const sourceKind = text(input.source_kind || input.sourceKind || "public_web").toLowerCase();
  const normalizedUrl = url.replace(/#.*$/, "").replace(/\/$/, "");
  return {
    id: input.id || hash("trg", [normalizedUrl, title, publishedAt]),
    title,
    url: normalizedUrl,
    published_at: publishedAt,
    detected_at: text(input.detected_at || input.detectedAt || new Date().toISOString()),
    institution_ids: institutionIds,
    topics,
    source_kind: sourceKind,
    summary: text(input.summary),
  };
}

export function dedupeTriggers(triggers) {
  const seen = new Set();
  return triggers.map(normalizeTrigger).filter((trigger) => {
    const key = `${trigger.url.toLowerCase()}|${trigger.title.toLowerCase()}|${trigger.institution_ids.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchInstitutions(trigger, schools) {
  const normalized = normalizeTrigger(trigger);
  if (normalized.institution_ids.length) {
    const known = new Set(schools.map((school) => school.id));
    return normalized.institution_ids.filter((id) => known.has(id)).map((id) => ({ school_id: id, confidence: "exact_id" }));
  }
  const haystack = `${normalized.title} ${normalized.summary}`.toLowerCase();
  return schools
    .filter((school) => text(school.name).length >= 5 && haystack.includes(text(school.name).toLowerCase()))
    .map((school) => ({ school_id: school.id, confidence: "exact_name" }));
}

export function evaluateEvidenceEligibility({ event, certification, audit, sources = [], sourceAudit = [] }) {
  const reasons = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const liveById = new Map(sourceAudit.map((row) => [row.source_id, row]));
  const eventSources = (event?.source_ids ?? []).map((id) => sourceById.get(id)).filter(Boolean);

  if (!event?.id || !event?.school_id) reasons.push("missing_record_identity");
  if (certification?.certification_status !== "certified") reasons.push("not_certified");
  if ((certification?.open_gates ?? []).length) reasons.push("open_certification_gates");
  if (audit?.highest_severity && audit.highest_severity !== "none") reasons.push("record_quality_issue");
  if (audit?.issue_count > 0) reasons.push("record_quality_issue");
  if (!eventSources.length || eventSources.length !== (event?.source_ids ?? []).length) reasons.push("missing_source_metadata");
  if (eventSources.some((source) => PRIVATE_SOURCE.test(`${source.url} ${source.source_type}`))) reasons.push("social_only_or_private_source");
  if (eventSources.some((source) => !/^https?:\/\//.test(source.url ?? ""))) reasons.push("invalid_source_url");
  if (eventSources.some((source) => liveById.has(source.id) && liveById.get(source.id).status && liveById.get(source.id).status !== "ok")) reasons.push("source_not_live");
  if (!event?.classification_rationale || !event?.community_rationale || !event?.confidence_rationale) reasons.push("missing_explicit_rationale");
  if (!Array.isArray(event?.field_support) || event.field_support.length < 3) reasons.push("insufficient_field_support");
  if (!event?.response_depth) reasons.push("missing_response_classification");
  if (PROHIBITED_CLAIMS.test(`${event?.summary} ${event?.description} ${event?.institutional_response}`)) reasons.push("prohibited_claim_language");

  const uniqueReasons = [...new Set(reasons)];
  return {
    eligible: uniqueReasons.length === 0,
    reason_codes: uniqueReasons,
    event_id: event?.id ?? "",
    evidence_version: event?.record_hash ?? "",
    policy_version: SIGNAL_POLICY_VERSION,
    evaluated_at: new Date().toISOString(),
  };
}

function boundedLead(event, school) {
  const action = event.legal_status || event.category || "public documentation";
  return `${school.name} has a public record that warrants context: ${action}.`;
}

function blueskyCopy(school, context, canonicalUrl) {
  const prefix = `Public-record context: ${school.name}. `;
  const suffix = ` Sources, response status, limits, and correction route: ${canonicalUrl}`;
  const available = Math.max(0, 300 - prefix.length - suffix.length);
  const clipped = context.length <= available ? context : `${context.slice(0, Math.max(0, available - 1)).trimEnd()}…`;
  return `${prefix}${clipped}${suffix}`;
}

export function compileSignal({ trigger, event, school, sources, eligibility, siteUrl = "https://campusevidencelab.org" }) {
  if (!eligibility?.eligible) return { accepted: false, reason_codes: eligibility?.reason_codes ?? ["missing_eligibility_decision"] };
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!normalizedTrigger.institution_ids.includes(event.school_id)) return { accepted: false, reason_codes: ["trigger_institution_mismatch"] };

  const signalId = hash("sig", [normalizedTrigger.id, event.id, SIGNAL_POLICY_VERSION]);
  const canonicalUrl = `${siteUrl.replace(/\/$/, "")}/signals/${signalId}/`;
  const sourceRows = (event.source_ids ?? []).map((id) => sources.find((source) => source.id === id)).filter(Boolean);
  const lead = boundedLead(event, school);
  const context = text(event.summary);
  const unknown = event.institutional_response
    ? "CEL reports only the public response located in the cited record; it does not independently evaluate the underlying conduct."
    : "CEL has not located a substantive public institutional response in this record. That does not establish that no response occurred.";
  const socialCopy = blueskyCopy(school, context, canonicalUrl);
  if (PROHIBITED_CLAIMS.test(socialCopy)) return { accepted: false, reason_codes: ["prohibited_generated_claim"] };

  const supportingIds = sourceRows.map((source) => source.id);
  return {
    accepted: true,
    signal: {
      id: signalId,
      status: "shadow",
      policy_version: SIGNAL_POLICY_VERSION,
      trigger: normalizedTrigger,
      institution: { id: school.id, name: school.name, city: school.city ?? "", state: school.state ?? "" },
      record_ids: [event.id],
      bounded_claims: [
        { text: lead, supporting_record_ids: [event.id], supporting_source_ids: supportingIds },
        { text: context, supporting_record_ids: [event.id], supporting_source_ids: supportingIds },
      ],
      unknowns: [unknown],
      sources: sourceRows.map((source) => ({ id: source.id, title: source.title, url: source.url, publisher: source.publisher, source_type: source.source_type })),
      institutional_response: event.institutional_response
        ? { status: event.response_depth, text: text(event.institutional_response), date: event.response_date ?? "" }
        : { status: event.response_depth || "not_located", text: "", date: "" },
      claim_limit: "Public-source documentation is not a finding of misconduct, prevalence measure, school ranking, safety score, or legal conclusion by CEL.",
      correction_url: `${siteUrl.replace(/\/$/, "")}/submit/?record_id=${encodeURIComponent(event.id)}`,
      canonical_url: canonicalUrl,
      distribution_copy: { bluesky_original: socialCopy, proactive_reply: `Relevant public-record context from CEL: ${canonicalUrl}` },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      correction_status: "none",
    },
  };
}

export function holdoutAssignment(signalId) {
  const bucket = Number.parseInt(createHash("sha256").update(signalId).digest("hex").slice(0, 8), 16) % 100;
  return bucket < DISTRIBUTION_HOLDOUT_PERCENT ? "passive_holdout" : "active_distribution";
}

export function canDistribute({ signal, channel, now = new Date(), history = [], controls = {} }) {
  const reasons = [];
  if (controls.global_pause) reasons.push("global_pause");
  if (controls[channel] === "paused") reasons.push("channel_paused");
  if (signal.status === "paused" || signal.status === "withdrawn") reasons.push("signal_not_publishable");
  if (channel === "bluesky" && signal.status !== "approved") reasons.push("shadow_or_unapproved_signal");
  if (channel === "bluesky" && (controls.approved_shadow_count ?? 0) < SHADOW_SIGNAL_MINIMUM) reasons.push("shadow_minimum_not_met");
  const day = now.toISOString().slice(0, 10);
  const sentToday = history.filter((row) => row.channel === channel && row.result === "sent" && row.attempted_at?.startsWith(day));
  if (channel === "bluesky" && sentToday.length >= DAILY_ORIGINAL_MAX) reasons.push("daily_original_cap");
  const cooldownMs = INSTITUTION_COOLDOWN_DAYS * 86_400_000;
  if (history.some((row) => row.institution_id === signal.institution.id && row.result === "sent" && now - new Date(row.attempted_at) < cooldownMs && !row.material_update)) reasons.push("institution_cooldown");
  return { allowed: reasons.length === 0, reason_codes: [...new Set(reasons)] };
}

export function idempotencyKey(signalId, channel, action = "original") {
  return hash("send", [signalId, channel, action]);
}

export function classifyOutcome(input) {
  const attribution = ["direct", "contributed", "plausible", "unknown"].includes(input.attribution) ? input.attribution : "unknown";
  const verified = Boolean(input.evidence_url && ["direct", "contributed"].includes(attribution));
  return { ...input, attribution, verified, publicly_claimable: verified };
}

export function evidenceOpenRate({ attributableVisitors, visitorsOpeningSource }) {
  if (!attributableVisitors) return 0;
  return visitorsOpeningSource / attributableVisitors;
}

export function applyComplaint(signal, complaint) {
  return {
    ...signal,
    status: "paused",
    correction_status: "contested",
    paused_at: complaint.received_at || new Date().toISOString(),
    pause_reason: text(complaint.category || "credible_complaint"),
    updated_at: new Date().toISOString(),
  };
}
