import test from "node:test";
import assert from "node:assert/strict";
import { canFollowUpSignalsPartner, signalsPartnerDraft } from "../scripts/cel-outreach-control/signals-partner.mjs";

test("partner draft makes one concrete source-bounded syndication ask", () => {
  const draft = signalsPartnerDraft({ contactName: "Editor", organizationName: "Campus News", feedUrl: "https://cel.test/signals/feeds/school.xml" });
  assert.match(draft.subject, /Campus News/);
  assert.match(draft.body, /does not rank schools or infer misconduct/);
  assert.equal(draft.template_type, "signals_partner");
});
test("partner follow-up cancels after reply, conversion, decline, or opt-out", () => {
  assert.equal(canFollowUpSignalsPartner({ events: [] }).allowed, true);
  assert.equal(canFollowUpSignalsPartner({ events: [{ event_type: "subscribed" }] }).allowed, false);
  assert.equal(canFollowUpSignalsPartner({ gmailItems: [{ item_type: "reply", labels: [] }] }).allowed, false);
});
