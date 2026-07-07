import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("methodology source document includes FIRE feedback standards", async () => {
  const methodology = await readText("../docs/methodology.md");

  for (const expected of [
    "documentation infrastructure, not a verdict system",
    "## Minimum Record Fields",
    "## Source Hierarchy",
    "## Deduplication Logic",
    "## Reviewer Standard",
    "## No Ranking System",
    "Confidence describes source support, not severity"
  ]) {
    assert.ok(methodology.includes(expected), `Missing methodology standard: ${expected}`);
  }

  assert.match(
    methodology,
    /Records should not be duplicated because the same public matter appears in multiple sources\./
  );
  assert.match(methodology, /records should not be used as rankings, severity scores, prevalence measures/i);
});

test("minimum record fields are enforced by event schema", async () => {
  const schema = await readJson("../schema/event.schema.json");

  for (const field of [
    "school_id",
    "date",
    "date_precision",
    "location",
    "category",
    "affected_communities",
    "summary",
    "description",
    "source_ids",
    "source_types",
    "verification_status",
    "confidence",
    "updated_at",
    "record_hash"
  ]) {
    assert.ok(schema.required.includes(field), `Event schema should require ${field}`);
  }
});

test("review workflow includes reviewer checklist and responsible-use safeguards", async () => {
  const workflow = await readText("../docs/review-workflow.md");

  for (const expected of [
    "## Reviewer Standard Checklist",
    "source availability",
    "source type",
    "date precision",
    "school identity",
    "category choice",
    "affected community label",
    "legal-status wording",
    "privacy risk",
    "duplicate risk",
    "neutral language",
    "confidence describes source support instead of severity",
    "documentation signal, not a prevalence, ranking, safety, hostility, or legal-liability signal"
  ]) {
    assert.ok(workflow.includes(expected), `Missing review workflow safeguard: ${expected}`);
  }
});

test("research guide makes documentation-not-prevalence use unavoidable", async () => {
  const researchGuide = await readText("../research-guide/index.html");

  for (const expected of [
    "Use the archive without overstating it",
    "Read Counts As Documentation",
    "Compare Carefully",
    "Responsible Output Checklist",
    "public-source documentation, not a census",
    "Do not rank schools by safety, hate, moral standing, or lived experience"
  ]) {
    assert.ok(researchGuide.includes(expected), `Missing research guide safeguard: ${expected}`);
  }
});

test("internal feedback note acknowledges implementation without implying endorsement", async () => {
  const notes = await readText("../outreach/reviewer-outreach-notes.md");

  for (const expected of [
    "## FIRE Methodology Feedback",
    "Claire Ottenstein",
    "Robert Shibley",
    "private implementation feedback",
    "not an endorsement",
    "minimum record fields",
    "source hierarchy",
    "deduplication",
    "reviewer checklist",
    "documentation-not-prevalence"
  ]) {
    assert.ok(notes.includes(expected), `Missing internal feedback note: ${expected}`);
  }
});
