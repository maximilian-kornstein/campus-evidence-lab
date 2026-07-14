import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCertifiedDossiers, institutionHoldout } from "../scripts/signals/dossiers.mjs";
import { buildIdentityIndex, resolveInstitutions } from "../scripts/signals/identity.mjs";
import { runShadowReview } from "../scripts/signals/shadow-review.mjs";
import { rampCap } from "../cloudflare/signals/worker.mjs";
import { TECHNICAL_PROVENANCE } from "../scripts/signals/social-copy.mjs";

const signalArtifact = JSON.parse(await readFile(new URL("../data/signals.json", import.meta.url)));
const reviewArtifact = JSON.parse(await readFile(new URL("../data/signal-shadow-review.json", import.meta.url)));

test("generated inventory sustains aggressive volume with institution-level holdout", () => {
  assert.ok(signalArtifact.signals.length >= 1000);
  assert.ok(signalArtifact.totals.represented_institutions >= 250);
  assert.ok(signalArtifact.totals.active_distribution_institutions >= 200);
  assert.ok(Math.floor(signalArtifact.totals.active_distribution_institutions / 7) >= 25);
  const groups = new Map();
  for (const signal of signalArtifact.signals) {
    const set = groups.get(signal.institution.id) ?? new Set(); set.add(signal.distribution_group); groups.set(signal.institution.id, set);
    assert.ok(signal.distribution_copy.bluesky_original.length <= 300);
    assert.equal(TECHNICAL_PROVENANCE.test(signal.distribution_copy.bluesky_original), false);
    assert.equal(signal.distribution_copy.bluesky_original.includes("…"), false);
    assert.ok(signal.distribution_copy.bluesky_original.endsWith(signal.canonical_url));
    assert.equal(signal.distribution_policy_version, "cel-social-content-v2");
  }
  assert.equal([...groups.values()].some((set) => set.size > 1), false);
});
test("every generated dataset calculation is reproducible from distinct certified cells", () => {
  for (const signal of signalArtifact.signals.filter((row) => row.signal_type === "dataset_context")) {
    const cells = signal.calculation.evidence.map((row) => `${row.workbook}|${row.sheet}|${row.cell}`);
    assert.equal(new Set(cells).size, cells.length);
    assert.equal(signal.calculation.evidence.reduce((sum, row) => sum + row.value, 0), signal.calculation.reported_statistic_total);
    assert.equal(signal.calculation.evidence.every((row) => row.event_id && row.record_hash && row.year), true);
  }
});

test("automated shadow gate approves at least 30 signals across 20 institutions", () => {
  assert.equal(reviewArtifact.gate_ready, true);
  assert.ok(reviewArtifact.passing_signals >= 30);
  assert.ok(reviewArtifact.passing_institutions >= 20);
  assert.equal(reviewArtifact.decisions.some((row) => !row.passed), false);
});

test("activation ramp adds two originals at every stage", () => {
  const activatedAt = "2026-07-01T12:00:00.000Z";
  const state = { activated_at: activatedAt };
  const atDay = (day) => Date.parse(activatedAt) + day * 86_400_000;
  assert.equal(rampCap(state, atDay(0)), 7);
  assert.equal(rampCap(state, atDay(2)), 7);
  assert.equal(rampCap(state, atDay(3)), 12);
  assert.equal(rampCap(state, atDay(6)), 12);
  assert.equal(rampCap(state, atDay(7)), 22);
  assert.ok(rampCap(state, atDay(30)) <= 25);
});

test("identity resolver accepts unique aliases and rejects ambiguous aliases", () => {
  const schools = [{ id: "north", name: "North University" }, { id: "national", name: "National University" }, { id: "mit", name: "Massachusetts Institute of Technology" }];
  const index = buildIdentityIndex(schools, { mit: ["MIT"], north: ["NU"], national: ["NU"] });
  assert.ok(index.ambiguous.some((row) => row.alias === "nu"));
  assert.deepEqual(resolveInstitutions({ title: "MIT publishes report", url: "https://news.test" }, schools, index).map((row) => row.school_id), ["mit"]);
  assert.deepEqual(resolveInstitutions({ title: "NU publishes report", url: "https://news.test" }, schools, index), []);
});

test("dossier builder emits four bounded angles from certified cell evidence", () => {
  const school = { id: "example", name: "Example University", state: "NY" };
  const source = { id: "src", title: "ED workbook", url: "https://ed.test/data.xlsx", publisher: "ED", source_type: "Government dataset" };
  const events = [0,1,2,3].map((index) => ({ id: `evt_${index}`, school_id: "example", date: `2024-01-01`, category: index % 2 ? "Vandalism" : "Harassment or threat", affected_communities: [index % 2 ? "Religion" : "Race"], source_ids: ["src"], tags: [index < 2 ? "on-campus" : "public-property"], record_hash: `sha256:${index}` }));
  const certificationRows = events.map((event, index) => ({ event_id: event.id, certification_status: "certified", source_family: "ed_campus_safety_dataset", open_gates: [], source_locator: { workbook: "book.xlsx", sheet: "sheet1", cell: `A${index + 1}`, column: "TEST", cell_value: String(index + 1) }, gates: { source: { status: "pass" } } }));
  const result = buildCertifiedDossiers({ events, schools: [school], sources: [source], certificationRows, generatedAt: "2026-01-01T00:00:00Z", siteUrl: "https://cel.test" });
  assert.equal(result.signals.length, 4);
  assert.equal(result.dossiers[0].reported_statistic_total, 10);
  assert.equal(new Set(result.signals.map((row) => row.dossier_angle)).size, 4);
  assert.equal(result.signals.every((row) => row.distribution_group === institutionHoldout("example")), true);
  assert.equal(result.signals.every((row) => row.semantic_facts.length > 0), true);
  assert.match(result.signals[0].distribution_copy.bluesky_original, /Federal 2024 data, Example University:/);
  assert.match(result.signals[0].distribution_copy.bluesky_original, /statistic/);
  assert.equal(TECHNICAL_PROVENANCE.test(result.signals[0].distribution_copy.bluesky_original), false);
  assert.equal(runShadowReview(result.signals, { minimumSignals: 4, minimumInstitutions: 1 }).gate_ready, true);
});

test("Kansas State social copy leads with supported record content", () => {
  const signal = signalArtifact.signals.find((row) => row.signal_type === "dataset_context" && row.institution.name === "Kansas State University" && row.dossier_angle === "latest_year");
  assert.ok(signal);
  assert.match(signal.distribution_copy.bluesky_original, /^Federal 2024 data, Kansas State University:/);
  assert.match(signal.distribution_copy.bluesky_original, /3 on-campus vandalism statistics labeled LGBTQ\+/);
  assert.match(signal.distribution_copy.bluesky_original, /1 on-campus harassment\/threat statistic labeled Race/);
  assert.match(signal.distribution_copy.bluesky_original, /3 residence-hall vandalism statistics labeled LGBTQ\+/);
});
