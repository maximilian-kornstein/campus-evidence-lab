import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflows = JSON.parse(await readFile(new URL("../data/workflows.json", import.meta.url), "utf8"));

const REQUIRED_IDS = [
  "one-school",
  "one-public-record",
  "legal-ocr-trail",
  "institutional-response-trail",
  "source-audit-follow-up",
  "methodology-review-sample",
  "narrow-research-packet",
  "correction-or-duplicate-report"
];

test("workflows include required task entry points", () => {
  const ids = workflows.workflows.map((workflow) => workflow.id);
  for (const id of REQUIRED_IDS) {
    assert.ok(ids.includes(id), `Missing workflow ${id}`);
  }
});

test("each workflow has complete task metadata", () => {
  for (const workflow of workflows.workflows) {
    assert.match(workflow.id, /^[a-z0-9-]+$/);
    assert.ok(workflow.title.length >= 8, `${workflow.id} title too short`);
    assert.ok(workflow.audience.length >= 6, `${workflow.id} audience too short`);
    assert.ok(workflow.start_url.startsWith("/"), `${workflow.id} start_url must be site-relative`);
    assert.ok(workflow.packet_url.startsWith("/") || workflow.packet_url.startsWith("https://"), `${workflow.id} packet_url must be a URL`);
    assert.ok(Array.isArray(workflow.steps) && workflow.steps.length >= 3, `${workflow.id} needs at least 3 steps`);
    assert.ok(Array.isArray(workflow.supported_claims) && workflow.supported_claims.length >= 1, `${workflow.id} needs supported claims`);
    assert.ok(Array.isArray(workflow.requires_followup) && workflow.requires_followup.length >= 1, `${workflow.id} needs follow-up limits`);
    assert.ok(Array.isArray(workflow.guardrail_links) && workflow.guardrail_links.length >= 2, `${workflow.id} needs guardrail links`);
  }
});

test("workflow guardrails include methodology or codebook and coverage limits", () => {
  for (const workflow of workflows.workflows) {
    const hrefs = workflow.guardrail_links.map((link) => link.href);
    assert.ok(hrefs.some((href) => href === "/methodology/" || href === "/codebook/"), `${workflow.id} missing methodology/codebook guardrail`);
    assert.ok(hrefs.includes("/coverage/"), `${workflow.id} missing coverage guardrail`);
  }
});

test("workflow language avoids ranking, prevalence, safety-score, and endorsement claims", () => {
  const text = JSON.stringify(workflows).toLowerCase();
  assert.equal(/safest|most dangerous|worst school|best school|endorsed by|approved by/.test(text), false);
  assert.equal(/prevalence estimate|safety score|severity score|school ranking/.test(text), false);
});
