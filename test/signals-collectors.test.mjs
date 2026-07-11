import test from "node:test";
import assert from "node:assert/strict";
import { collectAll, collectHtmlLinks, parseSyndicationFeed } from "../scripts/signals/collectors.mjs";

test("parses RSS and Atom into normalized deduplicated triggers", () => {
  const rss = `<rss><channel><item><title>Campus update</title><link>https://news.test/a</link><pubDate>Wed, 01 Jul 2026 12:00:00 GMT</pubDate><description><![CDATA[<b>Evidence</b> update]]></description></item><item><title>Campus update</title><link>https://news.test/a</link></item></channel></rss>`;
  const rows = parseSyndicationFeed(rss, { kind: "newsroom", topics: ["civil-rights"] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].summary, "Evidence update");
  assert.equal(rows[0].source_kind, "newsroom");
});

test("extracts filtered public-web links without requiring a paid search provider", async () => {
  const html = `<a href="/news/one">University civil rights agreement announced</a><a href="/sports">Sports</a>`;
  const result = await collectHtmlLinks({ id: "web", url: "https://example.gov/news", include_pattern: "civil rights", cost: "free" }, async () => new Response(html));
  assert.equal(result.triggers.length, 1);
  assert.equal(result.triggers[0].url, "https://example.gov/news/one");
});

test("free collectors degrade provider failures without activating paid sources", async () => {
  const sources = [{ id: "ok", url: "https://ok.test", cost: "free" }, { id: "paid", url: "https://paid.test", cost: "paid" }, { id: "bad", url: "https://bad.test", cost: "free" }];
  const fetchImpl = async (url) => url.includes("ok") ? new Response(`<rss><item><title>One</title><link>https://news.test/one</link></item></rss>`) : new Response("", { status: 429 });
  const result = await collectAll(sources, fetchImpl);
  assert.equal(result.results.length, 2);
  assert.equal(result.triggers.length, 1);
  assert.equal(result.results.find((row) => row.source_id === "bad").reason, "http_429");
});
