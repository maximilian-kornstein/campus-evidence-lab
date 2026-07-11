import { createBlueskyPost, createBlueskySession, getBlueskyProfile, listNotifications, searchBluesky } from "./bluesky.mjs";
import { gmailAccessToken, gmailSearch, gmailThread, sendPartnerEmail, threadHasInboundReply } from "./gmail.mjs";

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...headers } });
const now = () => new Date().toISOString();
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function controls(env) {
  const rows = await env.SIGNALS_DB.prepare("SELECT key, value FROM controls").all();
  return Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
}

async function readiness(env) {
  const result = { cloudflare: true, bluesky: false, gmail: false };
  try {
    const session = await createBlueskySession(env);
    result.bluesky = Boolean(session?.accessJwt && session?.did);
  } catch (error) { result.bluesky_error = String(error.message || error).slice(0, 200); }
  try {
    const token = await gmailAccessToken(env);
    result.gmail = Boolean(token);
  } catch (error) { result.gmail_error = String(error.message || error).slice(0, 200); }
  const inventory = await env.SIGNALS_DB.prepare("SELECT COUNT(*) signals,COUNT(DISTINCT institution_id) institutions FROM signals WHERE status='approved'").first();
  return { ...result, inventory, controls: await controls(env) };
}

function authorized(request, env) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.SIGNALS_ADMIN_TOKEN && supplied === env.SIGNALS_ADMIN_TOKEN);
}

async function ingest(request, env) {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  const artifact = await request.json();
  let count = 0;
  for (const signal of artifact.signals ?? []) {
    await env.SIGNALS_DB.prepare(`INSERT INTO signals (id,status,signal_type,policy_version,institution_id,institution_name,canonical_url,distribution_group,payload,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET signal_type=excluded.signal_type,policy_version=excluded.policy_version,institution_name=excluded.institution_name,canonical_url=excluded.canonical_url,distribution_group=excluded.distribution_group,payload=excluded.payload,updated_at=excluded.updated_at`)
      .bind(signal.id, signal.status, signal.signal_type || "source_context", signal.policy_version, signal.institution.id, signal.institution.name, signal.canonical_url, signal.distribution_group, JSON.stringify(signal), signal.created_at, signal.updated_at).run();
    for (const source of signal.sources) {
      await env.SIGNALS_DB.prepare("INSERT INTO signal_sources (signal_id,source_id,target_url) VALUES (?,?,?) ON CONFLICT(signal_id,source_id) DO UPDATE SET target_url=excluded.target_url").bind(signal.id, source.id, source.url).run();
    }
    count += 1;
  }
  return json({ ok: true, ingested: count });
}

async function ingestAuxiliary(request, env, kind) {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  const body = await request.json();
  if (kind === "identity") {
    for (const row of body.aliases ?? []) await env.SIGNALS_DB.prepare("INSERT INTO institution_aliases (alias,institution_id,source,updated_at) VALUES (?,?,?,?) ON CONFLICT(alias) DO UPDATE SET institution_id=excluded.institution_id,source=excluded.source,updated_at=excluded.updated_at").bind(row.alias, row.school_id, row.source, now()).run();
    return json({ ok: true, ingested: (body.aliases ?? []).length });
  }
  if (kind === "dossiers") {
    for (const row of body.dossiers ?? []) await env.SIGNALS_DB.prepare("INSERT INTO signal_dossiers (id,institution_id,payload,calculation_hash,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,calculation_hash=excluded.calculation_hash,updated_at=excluded.updated_at").bind(row.id, row.institution.id, JSON.stringify(row), await hash(JSON.stringify(row.calculation_evidence)), body.generated_at || now()).run();
    return json({ ok: true, ingested: (body.dossiers ?? []).length });
  }
  if (kind === "reviews") {
    for (const row of body.decisions ?? []) {
      await env.SIGNALS_DB.prepare("INSERT INTO shadow_reviews (signal_id,passed,reason_codes,policy_version,reviewed_at) VALUES (?,?,?,?,?) ON CONFLICT(signal_id) DO UPDATE SET passed=excluded.passed,reason_codes=excluded.reason_codes,policy_version=excluded.policy_version,reviewed_at=excluded.reviewed_at").bind(row.signal_id, row.passed ? 1 : 0, JSON.stringify(row.reason_codes), body.policy_version, body.generated_at || now()).run();
      if (row.passed) await env.SIGNALS_DB.prepare("UPDATE signals SET status='approved',updated_at=? WHERE id=? AND status='shadow'").bind(now(), row.signal_id).run();
    }
    const approved = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count,COUNT(DISTINCT institution_id) institutions FROM signals WHERE status='approved'").first();
    await env.SIGNALS_DB.prepare("UPDATE controls SET value=?,updated_at=? WHERE key='approved_shadow_count'").bind(String(approved.count), now()).run();
    return json({ ok: true, approved: approved.count, institutions: approved.institutions });
  }
  if (kind === "partners") {
    let count = 0;
    for (const row of body.partners ?? []) {
      await env.SIGNALS_DB.prepare("INSERT INTO partner_outreach_queue (id,organization_id,contact_email,contact_name,organization_name,feed_url,sequence_no,due_at,status,idempotency_key) VALUES (?,?,?,?,?,?,1,?,'ready',?) ON CONFLICT(id) DO NOTHING").bind(row.id, row.organization_id, row.contact_email.toLowerCase(), row.contact_name || "", row.organization_name, row.feed_url, row.due_at || now(), `partner|${row.contact_email.toLowerCase()}|1`).run();
      count += 1;
    }
    return json({ ok: true, ingested: count });
  }
  if (kind === "triggers") {
    for (const provider of body.providers ?? []) await env.SIGNALS_DB.prepare("INSERT INTO provider_state (provider_id,status,consecutive_failures,last_success_at,last_error_at,detail) VALUES (?,?,?, ?,?,?) ON CONFLICT(provider_id) DO UPDATE SET status=excluded.status,consecutive_failures=excluded.consecutive_failures,last_success_at=excluded.last_success_at,last_error_at=excluded.last_error_at,detail=excluded.detail").bind(provider.source_id, provider.ok ? "ok" : "error", provider.ok ? 0 : 1, provider.ok ? body.generated_at : "", provider.ok ? "" : body.generated_at, provider.reason || "").run();
    for (const trigger of body.triggers ?? []) {
      const providerId = trigger.source_kind || "unknown";
      const contentHash = await hash(`${trigger.url}|${trigger.title}|${trigger.published_at}`);
      await env.SIGNALS_DB.prepare("INSERT INTO trigger_events (id,provider_id,institution_id,content_hash,payload,status,published_at,collected_at) VALUES (?,?,?,?,?,'collected',?,?) ON CONFLICT(content_hash) DO NOTHING").bind(trigger.id, providerId, trigger.institution_ids?.[0] || "", contentHash, JSON.stringify(trigger), trigger.published_at || "", body.generated_at || now()).run();
    }
    return json({ ok: true, providers: (body.providers ?? []).length, triggers: (body.triggers ?? []).length });
  }
  return json({ error: "unknown_ingest_kind" }, 400);
}

async function complaint(request, env) {
  const body = await request.json();
  if (!body.signal_id || !body.category) return json({ error: "signal_id_and_category_required" }, 400);
  const id = `cmp_${(await hash(`${body.signal_id}|${body.category}|${now()}`)).slice(0, 20)}`;
  await env.SIGNALS_DB.batch([
    env.SIGNALS_DB.prepare("INSERT INTO complaints (id,signal_id,category,summary,evidence_url,received_at) VALUES (?,?,?,?,?,?)").bind(id, body.signal_id, body.category, String(body.summary ?? "").slice(0, 2000), String(body.evidence_url ?? "").slice(0, 1000), now()),
    env.SIGNALS_DB.prepare("UPDATE signals SET status='paused', updated_at=? WHERE id=?").bind(now(), body.signal_id),
  ]);
  return json({ ok: true, complaint_id: id, signal_status: "paused" }, 202);
}

async function track(request, env) {
  const body = await request.json();
  if (!body.signal_id || !["signal_view", "source_open", "return_visit", "feed_subscribe", "embed_view", "api_use"].includes(body.event_type)) return json({ error: "invalid_tracking_event" }, 400);
  const visitor = request.headers.get("cf-connecting-ip") || request.headers.get("user-agent") || "anonymous";
  const visitorHash = (await hash(`${env.VISITOR_SALT || "cel"}|${visitor}`)).slice(0, 24);
  const id = `atr_${(await hash(`${body.signal_id}|${body.event_type}|${visitorHash}|${now()}`)).slice(0, 20)}`;
  await env.SIGNALS_DB.prepare("INSERT INTO attribution_events (id,signal_id,attribution_code,event_type,visitor_hash,referrer,occurred_at,metadata) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, body.signal_id, String(body.attribution_code ?? ""), body.event_type, visitorHash, String(body.referrer ?? "").slice(0, 1000), now(), JSON.stringify(body.metadata ?? {})).run();
  return json({ ok: true }, 202);
}

async function metrics(env) {
  const [signals, distributions, attribution, outcomes, complaints] = await Promise.all([
    env.SIGNALS_DB.prepare("SELECT status, COUNT(*) count FROM signals GROUP BY status").all(),
    env.SIGNALS_DB.prepare("SELECT result, COUNT(*) count FROM distribution_events GROUP BY result").all(),
    env.SIGNALS_DB.prepare("SELECT event_type, COUNT(*) count, COUNT(DISTINCT visitor_hash) unique_visitors FROM attribution_events GROUP BY event_type").all(),
    env.SIGNALS_DB.prepare("SELECT attribution, verified, COUNT(*) count FROM outcomes GROUP BY attribution, verified").all(),
    env.SIGNALS_DB.prepare("SELECT status, COUNT(*) count FROM complaints GROUP BY status").all(),
  ]);
  return json({ generated_at: now(), signals: signals.results, distribution: distributions.results, attribution: attribution.results, outcomes: outcomes.results, complaints: complaints.results });
}

async function redirectSource(signalId, sourceId, env) {
  const row = await env.SIGNALS_DB.prepare("SELECT target_url FROM signal_sources WHERE signal_id=? AND source_id=?").bind(signalId, sourceId).first();
  if (!row) return json({ error: "source_not_found" }, 404);
  const id = `atr_${(await hash(`${signalId}|${sourceId}|${now()}`)).slice(0, 20)}`;
  await env.SIGNALS_DB.prepare("INSERT INTO attribution_events (id,signal_id,event_type,occurred_at,metadata) VALUES (?,?,'source_open',?,?)").bind(id, signalId, now(), JSON.stringify({ source_id: sourceId })).run();
  return Response.redirect(row.target_url, 302);
}

async function postBluesky(text, env) {
  return createBlueskyPost({ session: await createBlueskySession(env), text });
}

function normalized(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }

async function resolveInstitution(text, env) {
  const haystack = ` ${normalized(text)} `;
  const rows = await env.SIGNALS_DB.prepare("SELECT alias,institution_id FROM institution_aliases").all();
  const matches = new Set(rows.results.filter((row) => row.alias.length >= 3 && haystack.includes(` ${row.alias} `)).map((row) => row.institution_id));
  return matches.size === 1 ? [...matches][0] : "";
}

async function signalForInstitution(institutionId, env) {
  return env.SIGNALS_DB.prepare("SELECT id,payload FROM signals WHERE institution_id=? AND status IN ('approved','published') ORDER BY CASE signal_type WHEN 'source_context' THEN 0 ELSE 1 END,created_at DESC LIMIT 1").bind(institutionId).first();
}

async function enqueueReply({ notification, actionType, institutionId, signal, env }) {
  const actorId = notification.author?.did || notification.author?.handle || "unknown";
  const parentUri = notification.uri;
  const parentCid = notification.cid;
  const root = notification.record?.reply?.root ?? { uri: parentUri, cid: parentCid };
  const threadId = root.uri;
  const existing = await env.SIGNALS_DB.prepare("SELECT opted_out,action_count FROM interactions WHERE platform='bluesky' AND thread_id=?").bind(threadId).first();
  if (existing?.opted_out || Number(existing?.action_count || 0) >= 2) return false;
  const key = `reply_${(await hash(`${actionType}|${threadId}|${notification.uri}`)).slice(0, 20)}`;
  const payload = JSON.parse(signal.payload);
  const copy = actionType === "ask_cel" ? `CEL found bounded public-record context for ${payload.institution.name}: ${payload.canonical_url}` : payload.distribution_copy.proactive_reply;
  await env.SIGNALS_DB.prepare("INSERT INTO reply_queue (id,signal_id,action_type,actor_id,thread_id,parent_uri,parent_cid,root_uri,root_cid,institution_id,copy,status,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'ready',?,?) ON CONFLICT(idempotency_key) DO NOTHING")
    .bind(`rpl_${crypto.randomUUID()}`, signal.id, actionType, actorId, threadId, parentUri, parentCid, root.uri, root.cid, institutionId, copy, key, now()).run();
  return true;
}

async function collectMentions(env) {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return { skipped: "missing_bluesky_secrets" };
  const session = await createBlueskySession(env);
  const state = await env.SIGNALS_DB.prepare("SELECT cursor FROM provider_state WHERE provider_id='bluesky_notifications'").first();
  const page = await listNotifications(session, state?.cursor || "");
  let queued = 0;
  for (const notification of page.notifications ?? []) {
    if (!['mention', 'reply'].includes(notification.reason)) continue;
    const content = notification.record?.text || "";
    if (!/\bask\s+cel\b/i.test(content) && !content.toLowerCase().includes(String(env.BLUESKY_IDENTIFIER).toLowerCase())) continue;
    const institutionId = await resolveInstitution(content, env);
    if (!institutionId) continue;
    const signal = await signalForInstitution(institutionId, env);
    if (signal && await enqueueReply({ notification, actionType: "ask_cel", institutionId, signal, env })) queued += 1;
  }
  await env.SIGNALS_DB.prepare("INSERT INTO provider_state (provider_id,cursor,status,consecutive_failures,last_success_at) VALUES ('bluesky_notifications',?,'ok',0,?) ON CONFLICT(provider_id) DO UPDATE SET cursor=excluded.cursor,status='ok',consecutive_failures=0,last_success_at=excluded.last_success_at").bind(page.cursor || state?.cursor || "", now()).run();
  return { queued };
}

async function collectProactiveCandidates(env) {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return { skipped: "missing_bluesky_secrets" };
  const session = await createBlueskySession(env);
  const queries = String(env.BLUESKY_SEARCH_QUERIES || "campus civil rights|Office for Civil Rights university").split("|").filter(Boolean);
  let queued = 0;
  for (const query of queries) {
    const page = await searchBluesky(session, query);
    for (const post of page.posts ?? []) {
      if (queued >= 3) break;
      const content = post.record?.text || "";
      if (!/\b(civil rights|title vi|title ix|hate crime|discrimination|office for civil rights)\b/i.test(content)) continue;
      const institutionId = await resolveInstitution(content, env);
      if (!institutionId) continue;
      const signal = await signalForInstitution(institutionId, env);
      if (!signal) continue;
      const notification = { uri: post.uri, cid: post.cid, author: post.author, record: post.record };
      if (await enqueueReply({ notification, actionType: "proactive_reply", institutionId, signal, env })) queued += 1;
    }
  }
  return { queued };
}

async function sendReplies(env) {
  const state = await controls(env);
  if (state.global_pause !== "false" || state.bluesky_status !== "live") return { skipped: "publishing_not_enabled" };
  const session = await createBlueskySession(env);
  const today = now().slice(0, 10);
  const proactiveSent = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count FROM reply_queue WHERE action_type='proactive_reply' AND status='sent' AND attempted_at LIKE ?").bind(`${today}%`).first();
  const rows = await env.SIGNALS_DB.prepare("SELECT * FROM reply_queue WHERE status='ready' ORDER BY CASE action_type WHEN 'ask_cel' THEN 0 ELSE 1 END,created_at LIMIT 30").all();
  let sent = 0;
  let proactive = Number(proactiveSent.count || 0);
  for (const row of rows.results) {
    if (row.action_type === "proactive_reply" && proactive >= 3) continue;
    const cooldown = await env.SIGNALS_DB.prepare("SELECT 1 found FROM reply_queue WHERE institution_id=? AND status='sent' AND action_type='proactive_reply' AND attempted_at > datetime('now','-7 days') LIMIT 1").bind(row.institution_id).first();
    if (row.action_type === "proactive_reply" && cooldown) continue;
    try {
      const posted = await createBlueskyPost({ session, text: row.copy, reply: row });
      await env.SIGNALS_DB.batch([
        env.SIGNALS_DB.prepare("UPDATE reply_queue SET status='sent',attempted_at=?,external_id=? WHERE id=?").bind(now(), posted.uri || "", row.id),
        env.SIGNALS_DB.prepare("INSERT INTO interactions (id,platform,thread_id,actor_id,institution_id,action_count,last_action_at) VALUES (?,'bluesky',?,?,?,1,?) ON CONFLICT(platform,thread_id) DO UPDATE SET action_count=action_count+1,last_action_at=excluded.last_action_at").bind(`int_${crypto.randomUUID()}`, row.thread_id, row.actor_id, row.institution_id, now()),
      ]);
      sent += 1;
      if (row.action_type === "proactive_reply") proactive += 1;
    } catch (error) { await env.SIGNALS_DB.prepare("UPDATE reply_queue SET status='error',attempted_at=?,error=? WHERE id=?").bind(now(), String(error.message), row.id).run(); }
  }
  return { sent, proactive_sent_today: proactive };
}

async function captureFollowers(env) {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return { skipped: "missing_bluesky_secrets" };
  const profile = await getBlueskyProfile(await createBlueskySession(env));
  await env.SIGNALS_DB.prepare("INSERT INTO follower_snapshots (captured_at,followers_count,follows_count,posts_count) VALUES (?,?,?,?)").bind(now(), profile.followersCount || 0, profile.followsCount || 0, profile.postsCount || 0).run();
  return { followers: profile.followersCount || 0 };
}

function rampCap(state) {
  if (!state.activated_at) return 0;
  const days = Math.floor((Date.now() - new Date(state.activated_at).valueOf()) / 86_400_000);
  if (days < 3) return 5;
  if (days < 7) return 10;
  return 20;
}

async function sendPartnerOutreach(env) {
  const state = await controls(env);
  if (state.partner_outreach_status !== "live") return { skipped: "partner_outreach_paused" };
  const token = await gmailAccessToken(env);
  const today = now().slice(0, 10);
  const sentToday = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count FROM partner_send_attempts WHERE result='sent' AND attempted_at LIKE ?").bind(`${today}%`).first();
  let remaining = Math.max(0, 10 - Number(sentToday.count || 0));
  const rows = await env.SIGNALS_DB.prepare("SELECT * FROM partner_outreach_queue WHERE status='ready' AND due_at<=? ORDER BY due_at LIMIT 10").bind(now()).all();
  let sent = 0;
  for (const row of rows.results) {
    if (remaining <= 0) break;
    let blockReason = "";
    try {
      if (row.sequence_no === 1) {
        const existing = await gmailSearch(token, `(to:${row.contact_email} OR from:${row.contact_email}) ("Campus Evidence Lab" OR "CEL Signals")`);
        if ((existing.messages ?? []).length) blockReason = "existing_gmail_relationship";
      } else if (row.gmail_thread_id) {
        const thread = await gmailThread(token, row.gmail_thread_id);
        if (threadHasInboundReply(thread, env.GMAIL_SENDER_EMAIL)) blockReason = "inbound_reply";
      }
      if (blockReason) {
        await env.SIGNALS_DB.batch([
          env.SIGNALS_DB.prepare("UPDATE partner_outreach_queue SET status='cancelled',error=? WHERE id=?").bind(blockReason, row.id),
          env.SIGNALS_DB.prepare("INSERT INTO partner_send_attempts (id,queue_id,attempted_at,result,reason) VALUES (?,?,?,'blocked',?)").bind(`pat_${crypto.randomUUID()}`, row.id, now(), blockReason),
        ]);
        continue;
      }
      const message = await sendPartnerEmail(token, env, row, row.sequence_no === 2);
      await env.SIGNALS_DB.batch([
        env.SIGNALS_DB.prepare("UPDATE partner_outreach_queue SET status='sent',gmail_thread_id=?,gmail_message_id=?,sent_at=? WHERE id=?").bind(message.threadId || row.gmail_thread_id || "", message.id || "", now(), row.id),
        env.SIGNALS_DB.prepare("INSERT INTO partner_send_attempts (id,queue_id,attempted_at,result,gmail_message_id) VALUES (?,?,?,'sent',?)").bind(`pat_${crypto.randomUUID()}`, row.id, now(), message.id || ""),
      ]);
      if (row.sequence_no === 1) {
        const due = new Date(Date.now() + 8 * 86_400_000).toISOString();
        await env.SIGNALS_DB.prepare("INSERT INTO partner_outreach_queue (id,organization_id,contact_email,contact_name,organization_name,feed_url,sequence_no,due_at,status,idempotency_key,gmail_thread_id) VALUES (?,?,?,?,?,?,2,?,'ready',?,?) ON CONFLICT(contact_email,sequence_no) DO NOTHING")
          .bind(`par_${crypto.randomUUID()}`, row.organization_id, row.contact_email, row.contact_name, row.organization_name, row.feed_url, due, `partner|${row.contact_email}|2`, message.threadId || "").run();
      }
      sent += 1;
      remaining -= 1;
    } catch (error) {
      await env.SIGNALS_DB.batch([
        env.SIGNALS_DB.prepare("UPDATE partner_outreach_queue SET status='error',error=? WHERE id=?").bind(String(error.message), row.id),
        env.SIGNALS_DB.prepare("INSERT INTO partner_send_attempts (id,queue_id,attempted_at,result,reason) VALUES (?,?,?,'error',?)").bind(`pat_${crypto.randomUUID()}`, row.id, now(), String(error.message)),
      ]);
    }
  }
  return { sent };
}

async function activate(env) {
  const approved = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count,COUNT(DISTINCT institution_id) institutions FROM signals WHERE status='approved'").first();
  const bad = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count FROM shadow_reviews WHERE passed=0").first();
  if (approved.count < 30 || approved.institutions < 20 || bad.count > 0) return { ok: false, error: "shadow_gate_not_met", approved };
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return { ok: false, error: "missing_bluesky_secrets" };
  for (const key of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_EMAIL"]) if (!env[key]) return { ok: false, error: `missing_${key.toLowerCase()}` };
  const activatedAt = now();
  await env.SIGNALS_DB.batch([
    env.SIGNALS_DB.prepare("UPDATE controls SET value='live',updated_at=? WHERE key='activation_status'").bind(activatedAt),
    env.SIGNALS_DB.prepare("UPDATE controls SET value=?,updated_at=? WHERE key='activated_at'").bind(activatedAt, activatedAt),
    env.SIGNALS_DB.prepare("UPDATE controls SET value='live',updated_at=? WHERE key='bluesky_status'").bind(activatedAt),
    env.SIGNALS_DB.prepare("UPDATE controls SET value='false',updated_at=? WHERE key='global_pause'").bind(activatedAt),
    env.SIGNALS_DB.prepare("UPDATE controls SET value='live',updated_at=? WHERE key='partner_outreach_status'").bind(activatedAt),
  ]);
  return { ok: true, activated_at: activatedAt, initial_daily_cap: 5 };
}

async function publishDue(env) {
  const state = await controls(env);
  if (state.global_pause !== "false" || state.bluesky_status !== "live" || state.activation_status !== "live" || Number(state.approved_shadow_count || 0) < 30) return { ok: true, skipped: "publishing_not_enabled" };
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) return { ok: true, skipped: "missing_bluesky_secrets" };
  const today = now().slice(0, 10);
  const sent = await env.SIGNALS_DB.prepare("SELECT COUNT(*) count FROM distribution_events WHERE channel='bluesky' AND result='sent' AND attempted_at LIKE ?").bind(`${today}%`).first();
  const cap = Math.min(25, rampCap(state));
  if (sent.count >= cap) return { ok: true, skipped: "daily_cap", cap };
  const signal = await env.SIGNALS_DB.prepare(`SELECT s.* FROM signals s WHERE s.status='approved' AND s.distribution_group='active_distribution'
    AND NOT EXISTS (SELECT 1 FROM distribution_events d WHERE d.signal_id=s.id AND d.channel='bluesky' AND d.result='sent')
    AND NOT EXISTS (SELECT 1 FROM distribution_events d WHERE d.institution_id=s.institution_id AND d.result='sent' AND d.attempted_at > datetime('now','-7 days') AND d.material_update=0)
    ORDER BY s.created_at LIMIT 1`).first();
  if (!signal) return { ok: true, skipped: "no_eligible_signal" };
  const payload = JSON.parse(signal.payload);
  const key = `send_${(await hash(`${signal.id}|bluesky|original`)).slice(0, 20)}`;
  const existing = await env.SIGNALS_DB.prepare("SELECT id FROM distribution_events WHERE idempotency_key=?").bind(key).first();
  if (existing) return { ok: true, skipped: "duplicate" };
  try {
    const posted = await postBluesky(payload.distribution_copy.bluesky_original, env);
    await env.SIGNALS_DB.batch([
      env.SIGNALS_DB.prepare("INSERT INTO distribution_events (id,signal_id,channel,idempotency_key,attribution_code,result,external_id,institution_id,attempted_at) VALUES (?,?,?,?,?,'sent',?,?,?)").bind(`dst_${crypto.randomUUID()}`, signal.id, "bluesky", key, key, posted.uri || "", signal.institution_id, now()),
      env.SIGNALS_DB.prepare("UPDATE signals SET status='published', updated_at=? WHERE id=?").bind(now(), signal.id),
    ]);
    return { ok: true, published: signal.id };
  } catch (error) {
    await env.SIGNALS_DB.prepare("INSERT INTO distribution_events (id,signal_id,channel,idempotency_key,attribution_code,result,institution_id,attempted_at,detail) VALUES (?,?,?,?,?,'error',?,?,?)").bind(`dst_${crypto.randomUUID()}`, signal.id, "bluesky", key, key, signal.institution_id, now(), String(error.message)).run();
    return { ok: false, error: String(error.message) };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" } });
    if (url.pathname === "/health" || url.pathname === "/api/health") return json({ ok: true, controls: await controls(env) });
    if (url.pathname === "/api/readiness" && request.method === "GET") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      return json(await readiness(env));
    }
    if (url.pathname === "/api/metrics") return metrics(env);
    if (url.pathname === "/api/signals/ingest" && request.method === "POST") return ingest(request, env);
    const ingestMatch = url.pathname.match(/^\/api\/ingest\/(identity|dossiers|reviews|partners|triggers)$/);
    if (ingestMatch && request.method === "POST") return ingestAuxiliary(request, env, ingestMatch[1]);
    if (url.pathname === "/api/activate" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      const result = await activate(env);
      return json(result, result.ok ? 200 : 409);
    }
    if (url.pathname === "/api/providers" && request.method === "GET") return json((await env.SIGNALS_DB.prepare("SELECT * FROM provider_state ORDER BY provider_id").all()).results);
    if (url.pathname === "/api/followers" && request.method === "GET") return json((await env.SIGNALS_DB.prepare("SELECT * FROM follower_snapshots ORDER BY captured_at DESC LIMIT 90").all()).results);
    if (url.pathname === "/api/replies" && request.method === "GET") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      return json((await env.SIGNALS_DB.prepare("SELECT * FROM reply_queue ORDER BY created_at DESC LIMIT 200").all()).results);
    }
    if (url.pathname === "/api/opt-out" && request.method === "POST") {
      const body = await request.json();
      if (!body.thread_id && !body.actor_id) return json({ error: "thread_id_or_actor_id_required" }, 400);
      if (body.thread_id) await env.SIGNALS_DB.prepare("UPDATE interactions SET opted_out=1,pending_action='' WHERE platform='bluesky' AND thread_id=?").bind(body.thread_id).run();
      if (body.actor_id) {
        await env.SIGNALS_DB.prepare("UPDATE interactions SET opted_out=1,pending_action='' WHERE platform='bluesky' AND actor_id=?").bind(body.actor_id).run();
        await env.SIGNALS_DB.prepare("UPDATE reply_queue SET status='cancelled' WHERE actor_id=? AND status='ready'").bind(body.actor_id).run();
      }
      return json({ ok: true });
    }
    if (url.pathname === "/api/complaints" && request.method === "POST") return complaint(request, env);
    if (url.pathname === "/api/track" && request.method === "POST") return track(request, env);
    const sourceMatch = url.pathname.match(/^\/r\/([^/]+)\/([^/]+)$/);
    if (sourceMatch) return redirectSource(sourceMatch[1], sourceMatch[2], env);
    if (url.pathname === "/api/control" && request.method === "PUT") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      const body = await request.json();
      if (!body.key || !["global_pause", "bluesky_status", "approved_shadow_count", "partner_outreach_status"].includes(body.key)) return json({ error: "invalid_control" }, 400);
      await env.SIGNALS_DB.prepare("INSERT INTO controls (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(body.key, String(body.value), now()).run();
      return json({ ok: true, controls: await controls(env) });
    }
    if (url.pathname.startsWith("/api/signals/") && request.method === "GET") {
      const id = url.pathname.split("/").pop();
      const signal = await env.SIGNALS_DB.prepare("SELECT payload,status,updated_at FROM signals WHERE id=?").bind(id).first();
      return signal ? json({ ...JSON.parse(signal.payload), status: signal.status, updated_at: signal.updated_at }) : json({ error: "not_found" }, 404);
    }
    const statusMatch = url.pathname.match(/^\/api\/signals\/([^/]+)\/status$/);
    if (statusMatch && request.method === "PUT") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      const body = await request.json();
      if (!["shadow", "approved", "paused", "withdrawn"].includes(body.status)) return json({ error: "invalid_status" }, 400);
      await env.SIGNALS_DB.prepare("UPDATE signals SET status=?,updated_at=? WHERE id=?").bind(body.status, now(), statusMatch[1]).run();
      return json({ ok: true, signal_id: statusMatch[1], status: body.status });
    }
    return json({ error: "not_found" }, 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      const results = {};
      for (const [name, task] of [["mentions", collectMentions], ["proactive", collectProactiveCandidates], ["replies", sendReplies], ["publish", publishDue], ["followers", captureFollowers], ["partners", sendPartnerOutreach]]) {
        try { results[name] = await task(env); } catch (error) { results[name] = { error: String(error.message) }; }
      }
      return results;
    })());
  },
};
