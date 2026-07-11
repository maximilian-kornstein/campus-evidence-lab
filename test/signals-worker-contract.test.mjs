import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("D1 contract includes durable memory, safety controls, outcomes, and idempotency", async () => {
  const schema = await readFile(new URL("../cloudflare/signals/schema.sql", import.meta.url), "utf8");
  for (const table of ["controls", "signals", "signal_sources", "distribution_events", "interactions", "complaints", "attribution_events", "outcomes", "partner_subscriptions", "institution_aliases", "signal_dossiers", "trigger_events", "provider_state", "shadow_reviews", "reply_queue", "follower_snapshots", "partner_outreach_queue", "partner_send_attempts"]) assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(schema, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(schema, /global_pause', 'true'/);
  assert.match(schema, /bluesky_status', 'shadow'/);
});

test("worker exposes guarded ingest, complaint pause, attribution, source redirect, metrics, and shadow-gated publishing", async () => {
  const worker = await readFile(new URL("../cloudflare/signals/worker.mjs", import.meta.url), "utf8");
  for (const route of ["/api/signals/ingest", "/api/complaints", "/api/track", "/api/metrics", "/api/control", "/api/activate", "/api/providers", "/api/followers", "/api/replies", "/api/opt-out"]) assert.ok(worker.includes(route));
  assert.match(worker, /\/status/);
  assert.match(worker, /approved_shadow_count/);
  assert.match(worker, /global_pause/);
  assert.match(worker, /daily_cap/);
  assert.match(worker, /institution_id=s\.institution_id/);
  assert.match(worker, /BLUESKY_APP_PASSWORD/);
  assert.match(worker, /partner_outreach_status/);
  assert.match(worker, /proactive_reply/);
});
