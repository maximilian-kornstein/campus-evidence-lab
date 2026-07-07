import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("homepage makes postsecondary scope source mix and limits visible", async () => {
  const homepage = await readText("../index.html");

  for (const expected of [
    "U.S. postsecondary campus civil-rights public records",
    "not a census",
    "not a ranking",
    "not a safety score",
    "not a prevalence estimate",
    "ED campus safety data",
    "Office for Civil Rights",
    "Annual security reports",
    "public-source availability",
    "under-reporting",
    "researcher-start/"
  ]) {
    assert.ok(homepage.includes(expected), `Missing homepage RAND safeguard: ${expected}`);
  }
});

test("researcher start page gives RAND-forwardable use cases and steps", async () => {
  const page = await readText("../researcher-start/index.html");

  for (const expected of [
    "Researcher Start",
    "Use cases",
    "Source-mix audit",
    "Institutional-response scan",
    "One-school public-record review",
    "Five-minute trial",
    "Start with one question",
    "Open the linked source page",
    "What would make this easier to use?",
    "Review is not endorsement"
  ]) {
    assert.ok(page.includes(expected), `Missing researcher-start content: ${expected}`);
  }
});

test("authorship is visible on about trust and license surfaces", async () => {
  const about = await readText("../about/index.html");
  const trust = await readText("../trust/index.html");
  const license = await readText("../license/index.html");

  for (const [label, content] of [
    ["about", about],
    ["trust", trust],
    ["license", license]
  ]) {
    assert.ok(content.includes("Maximilian Kornstein"), `Missing author name on ${label}`);
    assert.ok(content.includes("high school student"), `Missing student authorship on ${label}`);
    assert.ok(content.includes("github.com/maximilian-kornstein/campus-evidence-lab"), `Missing GitHub provenance on ${label}`);
  }
});

test("RAND thread is captured as warm and blocked from cold outreach", async () => {
  const ledger = await readText("../outreach/relationship-ledger.csv");
  const notes = await readText("../outreach/reviewer-outreach-notes.md");

  for (const expected of [
    "Julia Kaufman,jkaufman@rand.org,RAND Education,rand.org",
    "Heather Schwartz,hschwart@rand.org,RAND Education,rand.org",
    "RAND Education team,eei@rand.org,RAND Education,rand.org",
    "Hard block cold outreach; org review required",
    "## RAND Education Feedback",
    "proof that Campus Evidence Lab is Maximilian Kornstein's project",
    "postsecondary scope",
    "source universe",
    "under-reporting"
  ]) {
    assert.ok(`${ledger}\n${notes}`.includes(expected), `Missing RAND relationship note: ${expected}`);
  }
});
