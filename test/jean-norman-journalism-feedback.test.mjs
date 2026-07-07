import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("journalist guide spells out OCR and flags source-mix/time-window limits", async () => {
  const guide = await readText("../journalist-guide/index.html");

  for (const expected of [
    "Office for Civil Rights (OCR)",
    "Department of Education",
    "current snapshot",
    "source mix",
    "time window",
    "administration priorities",
    "could change over time",
    "not a complete longitudinal record"
  ]) {
    assert.ok(guide.includes(expected), `Missing journalist-guide safeguard: ${expected}`);
  }
});

test("methodology records Department of Education source concentration as a limitation", async () => {
  const methodology = await readText("../docs/methodology.md");

  for (const expected of [
    "Department of Education",
    "Office for Civil Rights (OCR)",
    "source mix",
    "time window",
    "administration priorities",
    "snapshot",
    "not a complete longitudinal record"
  ]) {
    assert.ok(methodology.includes(expected), `Missing methodology limitation: ${expected}`);
  }
});

test("reviewer notes preserve Jean Norman feedback without implying peer review", async () => {
  const notes = await readText("../outreach/reviewer-outreach-notes.md");

  for (const expected of [
    "## Jean Norman Journalism Feedback",
    "Jean Norman",
    "journalist perspective",
    "not peer review",
    "Department of Education",
    "Office for Civil Rights (OCR)",
    "source-mix and time-window limitations"
  ]) {
    assert.ok(notes.includes(expected), `Missing Jean feedback note: ${expected}`);
  }
});
