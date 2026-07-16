import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
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

test("partner wave is source-traceable, unique, and bounded to CEL feeds", async () => {
  const csv = await readFile(new URL("../outreach/control/imports/signals-partners-wave-001.csv", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../outreach/control/signals-partners.json", import.meta.url), "utf8"));
  const rows = csv.trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
  assert.equal(rows.length, 45);
  assert.equal(manifest.partners.length, rows.length);
  assert.equal(new Set(manifest.partners.map((partner) => partner.contact_email)).size, rows.length);
  assert.equal(new Set(rows.map((row) => row[4].toLowerCase())).size, rows.length);
  for (const [index, partner] of manifest.partners.entries()) {
    assert.match(partner.contact_email, /^\S+@\S+\.\S+$/);
    assert.equal(partner.id, `partner_${crypto.createHash("sha256").update(partner.contact_email).digest("hex").slice(0, 20)}`);
    assert.ok(partner.priority >= 1 && partner.priority <= 3);
    assert.equal(new URL(partner.source_url).protocol, "https:");
    assert.equal(new URL(partner.feed_url).hostname, "campusevidencelab.org");
    assert.equal(rows[index].length, 9);
  }
});
