import test from "node:test";
import assert from "node:assert/strict";
import { collectGdelt, collectSitemap } from "../scripts/signals/collectors.mjs";
import { threadHasInboundReply } from "../cloudflare/signals/gmail.mjs";

test("GDELT adapter normalizes free public-news results", async () => {
  const response = { articles: [{ title: "Example University civil rights review", url: "https://news.test/story", seendate: "20260701T120000Z", language: "English", domain: "news.test" }] };
  const result = await collectGdelt({ id: "gdelt", query: "university", cost: "free" }, async () => new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } }));
  assert.equal(result.ok, true);
  assert.equal(result.triggers.length, 1);
  assert.equal(result.triggers[0].source_kind, "public_news_index");
});

test("sitemap adapter applies source filters and dates", async () => {
  const xml = `<urlset><url><loc>https://example.edu/news/civil-rights-update</loc><lastmod>2026-07-01</lastmod></url><url><loc>https://example.edu/sports</loc></url></urlset>`;
  const result = await collectSitemap({ id: "map", url: "https://example.edu/sitemap.xml", include_pattern: "civil rights" }, async () => new Response(xml));
  assert.equal(result.triggers.length, 1);
  assert.equal(result.triggers[0].published_at, "2026-07-01");
});

test("Gmail follow-up guard detects inbound replies", () => {
  const thread = { messages: [{ payload: { headers: [{ name: "From", value: "Campus Evidence Lab <cel@example.org>" }] } }, { payload: { headers: [{ name: "From", value: "Editor <editor@news.org>" }] } }] };
  assert.equal(threadHasInboundReply(thread, "cel@example.org"), true);
  assert.equal(threadHasInboundReply({ messages: thread.messages.slice(0, 1) }, "cel@example.org"), false);
});
