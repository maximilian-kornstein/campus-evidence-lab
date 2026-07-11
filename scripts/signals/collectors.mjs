import { dedupeTriggers, normalizeTrigger } from "./core.mjs";

function decode(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tags(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decode(match[1]);
  }
  return "";
}

export function parseSyndicationFeed(xml, source = {}) {
  const blocks = [...String(xml).matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => match[1]);
  return dedupeTriggers(blocks.map((block) => {
    const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || tags(block, ["link"]);
    return normalizeTrigger({
      title: tags(block, ["title"]),
      url: href,
      published_at: tags(block, ["pubDate", "published", "updated"]),
      summary: tags(block, ["description", "summary", "content"]),
      source_kind: source.kind || "syndication_feed",
      topics: source.topics || [],
    });
  }).filter((trigger) => trigger.title && trigger.url));
}

export async function collectFeed(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, { headers: { "user-agent": "CampusEvidenceLab-Signals/1.0 (+https://campusevidencelab.org/signals/)" } });
  if (!response.ok) return { ok: false, source_id: source.id, reason: `http_${response.status}`, triggers: [] };
  return { ok: true, source_id: source.id, triggers: parseSyndicationFeed(await response.text(), source) };
}

export async function collectAll(sources, fetchImpl = fetch) {
  const enabled = sources.filter((source) => source.enabled !== false && source.cost === "free");
  const settled = await Promise.allSettled(enabled.map((source) => source.adapter === "bluesky_search" ? collectBlueskySearch(source, fetchImpl) : source.adapter === "html_links" ? collectHtmlLinks(source, fetchImpl) : source.adapter === "gdelt" ? collectGdelt(source, fetchImpl) : source.adapter === "sitemap" ? collectSitemap(source, fetchImpl) : collectFeed(source, fetchImpl)));
  const results = settled.map((result, index) => result.status === "fulfilled" ? result.value : ({ ok: false, source_id: enabled[index]?.id ?? "unknown", reason: "provider_error", triggers: [] }));
  return { results, triggers: dedupeTriggers(results.flatMap((result) => result.triggers)) };
}

export async function collectGdelt(source, fetchImpl = fetch) {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", source.query);
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("maxrecords", String(Math.min(Number(source.limit || 100), 250)));
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("sort", "datedesc");
  const response = await fetchImpl(endpoint, { headers: { "user-agent": "CampusEvidenceLab-Signals/1.0" } });
  if (!response.ok) return { ok: false, source_id: source.id, reason: `http_${response.status}`, triggers: [] };
  const body = await response.json();
  const triggers = (body.articles ?? []).filter((article) => !article.language || article.language === "English").map((article) => normalizeTrigger({ title: article.title, url: article.url, published_at: article.seendate, summary: article.socialimage ? `News item indexed by GDELT from ${article.domain}.` : "", source_kind: "public_news_index", topics: source.topics ?? [] }));
  return { ok: true, source_id: source.id, triggers: dedupeTriggers(triggers) };
}

export async function collectSitemap(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, { headers: { "user-agent": "CampusEvidenceLab-Signals/1.0" } });
  if (!response.ok) return { ok: false, source_id: source.id, reason: `http_${response.status}`, triggers: [] };
  const xml = await response.text();
  const triggers = [...xml.matchAll(/<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?(?:<lastmod>([\s\S]*?)<\/lastmod>)?[\s\S]*?<\/url>/gi)].map((match) => normalizeTrigger({ title: decode(new URL(decode(match[1])).pathname.replace(/[-_/]+/g, " ")), url: decode(match[1]), published_at: decode(match[2]), source_kind: source.kind || "sitemap", topics: source.topics ?? [] })).filter((row) => !source.include_pattern || new RegExp(source.include_pattern, "i").test(`${row.title} ${row.url}`));
  return { ok: true, source_id: source.id, triggers: dedupeTriggers(triggers).slice(0, Number(source.limit || 200)) };
}

export async function collectHtmlLinks(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, { headers: { "user-agent": "CampusEvidenceLab-Signals/1.0 (+https://campusevidencelab.org/signals/)" } });
  if (!response.ok) return { ok: false, source_id: source.id, reason: `http_${response.status}`, triggers: [] };
  const html = await response.text();
  const base = new URL(source.url);
  const triggers = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decode(match[2]);
    if (title.length < 18 || (source.url_pattern && !new RegExp(source.url_pattern, "i").test(match[1])) || (source.include_pattern && !new RegExp(source.include_pattern, "i").test(`${match[1]} ${title}`))) continue;
    triggers.push(normalizeTrigger({ title, url: new URL(match[1], base).toString(), source_kind: source.kind || "public_web", topics: source.topics || [] }));
  }
  return { ok: true, source_id: source.id, triggers: dedupeTriggers(triggers).slice(0, Number(source.limit || 100)) };
}

export async function collectBlueskySearch(source, fetchImpl = fetch) {
  const endpoint = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts");
  endpoint.searchParams.set("q", source.query);
  endpoint.searchParams.set("limit", String(Math.min(Number(source.limit || 25), 100)));
  const response = await fetchImpl(endpoint, { headers: { "user-agent": "CampusEvidenceLab-Signals/1.0" } });
  if (!response.ok) return { ok: false, source_id: source.id, reason: `http_${response.status}`, triggers: [] };
  const body = await response.json();
  const triggers = (body.posts ?? []).map((post) => normalizeTrigger({ title: String(post.record?.text ?? "").slice(0, 180), summary: post.record?.text, url: `https://bsky.app/profile/${post.author?.handle}/post/${post.uri?.split("/").pop()}`, published_at: post.record?.createdAt, source_kind: "bluesky_search", topics: source.topics ?? [] })).filter((row) => row.title && row.url);
  return { ok: true, source_id: source.id, triggers: dedupeTriggers(triggers) };
}
