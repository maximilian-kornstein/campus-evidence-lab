const REASON_ORDER = [
  "prior_sent_cel_item",
  "existing_draft_conflict",
  "inbound_reply_activity",
  "starred_or_manual_review_thread",
  "future_or_scheduled_item",
  "warm_or_blocked_relationship",
];

const TYPE_REASON_MAP = new Map([
  ["prior_sent_cel_item", "prior_sent_cel_item"],
  ["sent_cel_item", "prior_sent_cel_item"],
  ["sent_cel", "prior_sent_cel_item"],
  ["exact_email_sent", "prior_sent_cel_item"],
  ["existing_draft_conflict", "existing_draft_conflict"],
  ["existing_draft", "existing_draft_conflict"],
  ["exact_email_existing_draft", "existing_draft_conflict"],
  ["inbound_reply_activity", "inbound_reply_activity"],
  ["inbound_activity", "inbound_reply_activity"],
  ["inbound_reply", "inbound_reply_activity"],
  ["reply", "inbound_reply_activity"],
  ["starred_or_manual_review_thread", "starred_or_manual_review_thread"],
  ["starred_thread", "starred_or_manual_review_thread"],
  ["manual_review_thread", "starred_or_manual_review_thread"],
  ["manual_review", "starred_or_manual_review_thread"],
  ["future_or_scheduled_item", "future_or_scheduled_item"],
  ["future_scheduled_item", "future_or_scheduled_item"],
  ["scheduled_item", "future_or_scheduled_item"],
  ["future_item", "future_or_scheduled_item"],
  ["warm_or_blocked_relationship", "warm_or_blocked_relationship"],
  ["warm_relationship", "warm_or_blocked_relationship"],
  ["blocked_relationship", "warm_or_blocked_relationship"],
  ["warm_org_conflict", "warm_or_blocked_relationship"],
]);

export function evaluateLiveCheck(input = {}) {
  const target = input.target || {};
  const evidence = normalizeEvidence(input);
  const queueDraftMessageId = String(
    target.queueDraftMessageId ||
      target.queue_draft_message_id ||
      target.gmailMessageId ||
      target.gmail_message_id ||
      target.gmailDraftMessageId ||
      target.gmail_draft_message_id ||
      "",
  ).trim();
  const reasonSet = new Set();
  let allowedEvidenceCount = 0;

  for (const item of evidence) {
    const reason = reasonForEvidence(item);
    if (!reason) {
      allowedEvidenceCount += 1;
      continue;
    }

    if (reason === "existing_draft_conflict" && matchesCurrentQueueDraft(item, queueDraftMessageId)) {
      allowedEvidenceCount += 1;
      continue;
    }

    reasonSet.add(reason);
  }

  const reasons = REASON_ORDER.filter((reason) => reasonSet.has(reason));
  const safe = reasons.length === 0;
  return {
    safe,
    reasons,
    summary: safe
      ? `Live check passed with ${allowedEvidenceCount} allowed evidence item(s).`
      : `Live check blocked queue: ${reasons.join(", ")}.`,
  };
}

function normalizeEvidence(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.evidence)) return input.evidence;
  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.messages)) return input.messages;
  if (Array.isArray(input.emails)) return input.emails;
  return [];
}

function reasonForEvidence(item = {}) {
  const explicitType = normalizeType(item.type || item.evidenceType || item.evidence_type || item.flagType || item.flag_type);
  if (TYPE_REASON_MAP.has(explicitType)) return TYPE_REASON_MAP.get(explicitType);

  const itemType = normalizeType(item.itemType || item.item_type);
  const labels = normalizeLabels(item.labels);
  const lowerLabels = labels.map((label) => label.toLowerCase());
  const isCel = truthy(item.isCel ?? item.is_cel) || hasCelSignal(item, lowerLabels);

  if (itemType === "sent" && isCel) return "prior_sent_cel_item";
  if (itemType === "draft" && isCel) return "existing_draft_conflict";
  if (itemType === "reply" || itemType === "inbound" || lowerLabels.includes("inbox")) {
    return "inbound_reply_activity";
  }
  if (truthy(item.starred) || truthy(item.manualReview) || truthy(item.manual_review)) {
    return "starred_or_manual_review_thread";
  }
  if (lowerLabels.includes("starred") || lowerLabels.some((label) => /manual.*review/.test(label))) {
    return "starred_or_manual_review_thread";
  }
  if (truthy(item.isFutureOrScheduled ?? item.is_future_or_scheduled) || lowerLabels.some(hasFutureLabelSignal)) {
    return "future_or_scheduled_item";
  }
  if (isWarmOrBlockedRelationship(item.relationshipStatus || item.relationship_status, item.blockLevel || item.block_level)) {
    return "warm_or_blocked_relationship";
  }

  return "";
}

function matchesCurrentQueueDraft(item, queueDraftMessageId) {
  if (!queueDraftMessageId) return false;
  return messageIdsFor(item).some((id) => id === queueDraftMessageId);
}

function messageIdsFor(item = {}) {
  return [
    item.messageId,
    item.message_id,
    item.gmailMessageId,
    item.gmail_message_id,
    item.draftMessageId,
    item.draft_message_id,
    item.id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLabels(value) {
  if (Array.isArray(value)) return value.map((label) => String(label).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeLabels(parsed);
    } catch {
      return trimmed.split(",").map((label) => label.trim()).filter(Boolean);
    }
    return [];
  }
  return [];
}

function truthy(value) {
  return value === true || value === 1 || String(value || "").toLowerCase() === "true";
}

function hasCelSignal(item, lowerLabels) {
  const text = [
    item.subject,
    item.snippet,
    item.summary,
    item.bodyExcerpt,
    item.body_excerpt,
    lowerLabels.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    lowerLabels.some((label) => label.startsWith("cel")) ||
    text.includes("campus evidence lab") ||
    text.includes("campus civil-rights") ||
    text.includes("public-source archive")
  );
}

function hasFutureLabelSignal(label) {
  return /ready to schedule|scheduled|future|followup\/drafts|follow-up|reminder|cel\/outreach\/\d{4}-\d{2}-\d{2}/i.test(
    label,
  );
}

function isWarmOrBlockedRelationship(status, blockLevel) {
  const combined = `${status || ""} ${blockLevel || ""}`.toLowerCase();
  return /packet sent|feedback received|call scheduled|routed internally|declined|redirect|warm|blocked|hard block|no cold|do not contact|permission-limited/.test(
    combined,
  );
}
