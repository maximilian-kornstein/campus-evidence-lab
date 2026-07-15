import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";
import { compileSignal, evaluateEvidenceEligibility, SIGNAL_POLICY_VERSION } from "./signals/core.mjs";
import { buildCertifiedDossiers, institutionHoldout } from "./signals/dossiers.mjs";
import { buildIdentityIndex } from "./signals/identity.mjs";
import { runShadowReview } from "./signals/shadow-review.mjs";
import { preserveArtifactTimestamp, preserveStableRows, semanticallyEqual } from "./artifact-stability.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/$/, "");
const signalsApiUrl = (process.env.SIGNALS_API_URL || "https://signals-api.campusevidencelab.org").replace(/\/$/, "");
const [events, schools, sources, certification, audit, sourceAudit, manifest] = await Promise.all([
  readJson(paths.events), readJson(paths.schools), readJson(paths.sources), readJson(paths.certificationLedger), readJson(paths.recordQualityAudit),
  readJson(paths.sourceAudit).catch(() => ({ entries: [] })), readJson(paths.manifest),
]);
const schoolById = new Map(schools.map((row) => [row.id, row]));
const certificationById = new Map(certification.records.map((row) => [row.event_id, row]));
const auditRows = audit.records ?? audit.priority_records ?? [];
const auditById = new Map(auditRows.map((row) => [row.event_id, row]));
const triggerArtifact = await readJson(path.join(rootDir, "data", "signal-triggers.json")).catch(() => ({ triggers: [] }));
const generatedAt = triggerArtifact.generated_at || `${manifest.generated_at || manifest.snapshot_date || "2026-06-03"}T12:00:00.000Z`;
const aliasOverrides = await readJson(path.join(rootDir, "config", "institution-aliases.json"));
const identityIndex = buildIdentityIndex(schools, aliasOverrides);
const signalPath = path.join(rootDir, "data", "signals.json");
const eligibilityPath = path.join(rootDir, "data", "signal-eligibility.json");
const dossierPath = path.join(rootDir, "data", "signal-dossiers.json");
const reviewPath = path.join(rootDir, "data", "signal-shadow-review.json");
const identityPath = path.join(rootDir, "data", "institution-identity-index.json");
const [previousSignals, previousEligibility, previousDossiers, previousReview, previousIdentity] = await Promise.all([
  readJson(signalPath).catch(() => undefined),
  readJson(eligibilityPath).catch(() => undefined),
  readJson(dossierPath).catch(() => undefined),
  readJson(reviewPath).catch(() => undefined),
  readJson(identityPath).catch(() => undefined),
]);

const decisions = preserveStableRows(events.map((event) => evaluateEvidenceEligibility({
  event,
  certification: certificationById.get(event.id),
  audit: auditById.get(event.id),
  sources,
  sourceAudit: sourceAudit.entries ?? sourceAudit,
})), previousEligibility?.decisions, (row) => row.event_id);

const signals = [];
const eligibleDecisions = decisions.filter((row) => row.eligible);
const eligibleEvents = eligibleDecisions.map((decision) => events.find((row) => row.id === decision.event_id));

function appendSignal(trigger, event, decision) {
  const school = schoolById.get(event.school_id);
  const compiled = compileSignal({ trigger, event, school, sources, eligibility: decision, siteUrl: baseUrl });
  if (compiled.accepted && !signals.some((row) => row.id === compiled.signal.id)) {
    compiled.signal.created_at = generatedAt;
    compiled.signal.updated_at = generatedAt;
    compiled.signal.distribution_group = institutionHoldout(compiled.signal.institution.id);
    signals.push(compiled.signal);
  }
}

for (const trigger of triggerArtifact.triggers ?? []) {
  for (const institutionId of trigger.institution_ids ?? []) {
    const candidates = eligibleEvents.filter((event) => event.school_id === institutionId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1);
    for (const event of candidates) appendSignal(trigger, event, eligibleDecisions.find((row) => row.event_id === event.id));
  }
}

for (const decision of eligibleDecisions) {
  const event = events.find((row) => row.id === decision.event_id);
  const school = schoolById.get(event.school_id);
  const evergreenTrigger = {
    id: `evidence-${event.id}`,
    title: `New public evidence context for ${school.name}`,
    url: `${baseUrl}/events/${event.id}/`,
    published_at: event.updated_at,
    detected_at: generatedAt,
    institution_ids: [event.school_id],
    topics: event.tags ?? [],
    source_kind: "cel_evidence_update",
    summary: event.summary,
  };
  appendSignal(evergreenTrigger, event, decision);
}

const datasetResult = buildCertifiedDossiers({ events, schools, sources, certificationRows: certification.records, siteUrl: baseUrl, generatedAt });
signals.push(...datasetResult.signals);

const shadowReview = runShadowReview(signals);
const passingSignalIds = new Set(shadowReview.decisions.filter((row) => row.passed).map((row) => row.signal_id));
if (shadowReview.gate_ready) {
  for (const signal of signals) if (passingSignalIds.has(signal.id)) signal.status = "approved";
}

const stableSignals = signals.map((signal) => {
  const previous = previousSignals?.signals?.find((row) => row.id === signal.id);
  if (semanticallyEqual(signal, previous)) return previous;
  if (previous?.created_at) signal.created_at = previous.created_at;
  signal.updated_at = generatedAt;
  return signal;
});

const artifact = {
  id: "cel_signals_v1",
  policy_version: SIGNAL_POLICY_VERSION,
  snapshot_id: manifest.snapshot_id,
  generated_at: generatedAt,
  mode: shadowReview.gate_ready ? "ready_for_activation" : "shadow",
  totals: { evaluated_records: decisions.length, eligible_source_records: decisions.filter((row) => row.eligible).length, dataset_dossiers: datasetResult.dossiers.length, shadow_signals: signals.length, represented_institutions: new Set(signals.map((row) => row.institution.id)).size, active_distribution_institutions: new Set(signals.filter((row) => row.distribution_group === "active_distribution").map((row) => row.institution.id)).size },
  signals: stableSignals,
};
artifact.generated_at = preserveArtifactTimestamp(artifact, previousSignals, generatedAt);
const dossierArtifact = { policy_version: SIGNAL_POLICY_VERSION, generated_at: generatedAt, dossiers: datasetResult.dossiers };
dossierArtifact.generated_at = preserveArtifactTimestamp(dossierArtifact, previousDossiers, generatedAt);
const reviewArtifact = { policy_version: SIGNAL_POLICY_VERSION, generated_at: generatedAt, ...shadowReview };
reviewArtifact.generated_at = preserveArtifactTimestamp(reviewArtifact, previousReview, generatedAt);
const eligibilityArtifact = { policy_version: SIGNAL_POLICY_VERSION, generated_at: generatedAt, decisions };
eligibilityArtifact.generated_at = preserveArtifactTimestamp(eligibilityArtifact, previousEligibility, generatedAt);
const identityArtifact = { generated_at: generatedAt, alias_count: identityIndex.aliases.length, ambiguous_count: identityIndex.ambiguous.length, ...identityIndex };
identityArtifact.generated_at = preserveArtifactTimestamp(identityArtifact, previousIdentity, generatedAt);
await writeJson(signalPath, artifact);
await writeJson(dossierPath, dossierArtifact);
await writeJson(reviewPath, reviewArtifact);
await writeJson(eligibilityPath, eligibilityArtifact);
await writeJson(identityPath, identityArtifact);

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function date(value) { return new Date(value || artifact.generated_at).toUTCString(); }
function feed(items, title, description, link) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(title)}</title><link>${link}</link><description>${esc(description)}</description><lastBuildDate>${date(artifact.generated_at)}</lastBuildDate>${items.map((signal) => `<item><title>${esc(signal.institution.name)} public-record context</title><link>${signal.canonical_url}</link><guid isPermaLink="true">${signal.canonical_url}</guid><pubDate>${date(signal.created_at)}</pubDate><description>${esc(signal.bounded_claims.map((row) => row.text).join(" "))}</description></item>`).join("")}</channel></rss>\n`;
}

const feedsDir = path.join(rootDir, "signals", "feeds");
await mkdir(feedsDir, { recursive: true });
await writeFile(path.join(feedsDir, "all.xml"), feed(stableSignals, "CEL Signals", "Source-traceable campus civil-rights context.", `${baseUrl}/signals/`));
await writeJson(path.join(feedsDir, "all.json"), { version: "https://jsonfeed.org/version/1.1", title: "CEL Signals", home_page_url: `${baseUrl}/signals/`, feed_url: `${baseUrl}/signals/feeds/all.json`, items: stableSignals.map((signal) => ({ id: signal.id, url: signal.canonical_url, title: `${signal.institution.name} public-record context`, content_text: signal.bounded_claims.map((row) => row.text).join(" "), date_published: signal.created_at, tags: signal.trigger.topics })) });

for (const signal of stableSignals) {
  const dir = path.join(rootDir, "signals", signal.id);
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "index.json"), signal);
  const calculationHtml = signal.calculation ? `<section class="section"><div class="section-header"><h2 class="section-title">Reproducible calculation</h2><p class="section-note">${signal.calculation.certified_cell_count} distinct certified workbook cells</p></div><div class="table-scroll"><table><thead><tr><th>Record</th><th>Workbook</th><th>Cell</th><th>Year</th><th>Value</th></tr></thead><tbody>${signal.calculation.evidence.map((row) => `<tr><td><a href="../../events/${esc(row.event_id)}/">${esc(row.event_id)}</a></td><td>${esc(row.workbook)}</td><td>${esc(row.cell)}</td><td>${esc(row.year)}</td><td>${esc(row.value)}</td></tr>`).join("")}</tbody></table></div></section>` : "";
  await writeFile(path.join(dir, "index.html"), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="cel-signals-api" content="${esc(signalsApiUrl)}"><title>${esc(signal.institution.name)} Signal / Campus Evidence Lab</title><link rel="stylesheet" href="../../assets/styles.css"></head><body class="signals-body" data-signal-id="${esc(signal.id)}"><header class="site-header"><div class="site-header__inner"><a class="brand" href="../../"><span class="brand__name">Campus Evidence Lab</span><span class="brand__tag">Accountability wire</span></a><nav class="nav" aria-label="Primary navigation"><a href="../">Signals</a><a href="../../events/">Records</a><a href="../../methodology/">Methodology</a><a href="../../submit/">Correct</a></nav></div></header><main class="main signal-story"><p class="page-kicker">CEL Signal · ${signal.status === "approved" ? "Automated review passed" : "Shadow publication"}</p><h1 class="page-title page-title--small">${esc(signal.institution.name)}</h1><p class="signal-trigger">Why now: <a href="${esc(signal.trigger.url)}">${esc(signal.trigger.title)}</a></p><section class="signal-brief"><h2>What the public record documents</h2>${signal.bounded_claims.map((claim) => `<p>${esc(claim.text)}</p>`).join("")}<h2>What remains unknown</h2>${signal.unknowns.map((row) => `<p>${esc(row)}</p>`).join("")}</section>${calculationHtml}<section class="section"><h2 class="section-title">Primary sources</h2><ol class="signal-sources">${signal.sources.map((source) => `<li><a href="${esc(source.url)}" data-source-id="${esc(source.id)}" target="_blank" rel="noreferrer">${esc(source.title)}</a><span>${esc(source.publisher)} · ${esc(source.source_type)}</span></li>`).join("")}</ol></section><aside class="signal-limit"><strong>Claim boundary</strong><p>${esc(signal.claim_limit)}</p></aside><div class="hero-actions"><a class="button-link button-link--primary" href="${esc(signal.correction_url)}">Submit correction or counterevidence</a><a class="button-link" href="index.json">Signal JSON</a></div></main><footer class="site-footer">Automated context · Sources first · Corrections propagate</footer><script type="module" src="../../assets/signal-detail.js"></script></body></html>\n`);
}

console.log(`Generated ${signals.length} Signals from ${decisions.length} evaluated records; mode=${artifact.mode}.`);
