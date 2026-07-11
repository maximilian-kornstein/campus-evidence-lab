export async function createBlueskySession(env) {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) throw new Error("missing_bluesky_secrets");
  const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: env.BLUESKY_IDENTIFIER, password: env.BLUESKY_APP_PASSWORD }) });
  if (!response.ok) throw new Error(`bluesky_session_${response.status}`);
  return response.json();
}

function urlFacet(text) {
  const match = text.match(/https:\/\/\S+/);
  if (!match) return [];
  const start = new TextEncoder().encode(text.slice(0, match.index)).length;
  const end = start + new TextEncoder().encode(match[0]).length;
  return [{ index: { byteStart: start, byteEnd: end }, features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }] }];
}

export async function createBlueskyPost({ session, text, reply }) {
  const record = { $type: "app.bsky.feed.post", text: text.slice(0, 300), facets: urlFacet(text.slice(0, 300)), createdAt: new Date().toISOString() };
  if (reply) record.reply = { root: { uri: reply.root_uri, cid: reply.root_cid }, parent: { uri: reply.parent_uri, cid: reply.parent_cid } };
  const response = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: { authorization: `Bearer ${session.accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }) });
  if (!response.ok) { const retry = response.headers.get("retry-after"); throw new Error(`bluesky_post_${response.status}${retry ? `_retry_${retry}` : ""}`); }
  return response.json();
}

export async function listNotifications(session, cursor = "") {
  const url = new URL("https://bsky.social/xrpc/app.bsky.notification.listNotifications");
  url.searchParams.set("limit", "50");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { headers: { authorization: `Bearer ${session.accessJwt}` } });
  if (!response.ok) throw new Error(`bluesky_notifications_${response.status}`);
  return response.json();
}

export async function searchBluesky(session, query, cursor = "") {
  const url = new URL("https://bsky.social/xrpc/app.bsky.feed.searchPosts");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "50");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { headers: { authorization: `Bearer ${session.accessJwt}` } });
  if (!response.ok) throw new Error(`bluesky_search_${response.status}`);
  return response.json();
}

export async function getBlueskyProfile(session) {
  const url = new URL("https://bsky.social/xrpc/app.bsky.actor.getProfile");
  url.searchParams.set("actor", session.did);
  const response = await fetch(url, { headers: { authorization: `Bearer ${session.accessJwt}` } });
  if (!response.ok) throw new Error(`bluesky_profile_${response.status}`);
  return response.json();
}
