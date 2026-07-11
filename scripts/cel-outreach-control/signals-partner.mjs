export function signalsPartnerDraft({ contactName = "there", organizationName, feedUrl, partnerKind = "newsroom" }) {
  if (!organizationName || !feedUrl) throw new Error("organizationName and feedUrl are required");
  const subject = `A source-backed campus evidence feed for ${organizationName}`;
  const body = `Hi ${contactName || "there"},

Campus Evidence Lab is piloting CEL Signals, an automated public-interest wire that connects current campus developments to bounded, primary-source evidence. It does not rank schools or infer misconduct.

I selected this feed for ${organizationName}: ${feedUrl}

Would you be willing to try the feed or embed one Context Note and tell us whether it is useful for your ${partnerKind === "newsroom" ? "reporting" : "work"}? Every Signal includes sources, unknowns, and a correction route.

Best,
Campus Evidence Lab`;
  return { subject, body, template_type: "signals_partner", intended_ask: "Try one relevant CEL Signals feed or embed and report whether it is useful." };
}

export function canFollowUpSignalsPartner({ events = [], gmailItems = [] }) {
  const blockedEvents = new Set(["followed_up", "subscribed", "embedded", "webhook_enabled", "declined", "opted_out", "cancelled"]);
  if (events.some((event) => blockedEvents.has(event.event_type))) return { allowed: false, reason: "partner_state_blocks_followup" };
  if (gmailItems.some((item) => item.item_type === "reply" || item.labels?.includes("STARRED"))) return { allowed: false, reason: "reply_or_warm_thread" };
  return { allowed: true };
}
