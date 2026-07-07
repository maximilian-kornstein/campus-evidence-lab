import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";

test("accountability room index exposes scale, limits, and institution entry", async () => {
  const html = await readFile(path.join(rootDir, "accountability-room", "index.html"), "utf8");

  assert.match(html, /Accountability Room/);
  assert.match(html, /150,000 accepted import-wave QA candidates/);
  assert.match(html, /4,000 public event records/);
  assert.match(html, /5,470 generated institution pages/);
  assert.match(html, /No rankings\. No safety scores\. No legal findings\./);
  assert.match(html, /Open an Institution/);
  assert.match(html, /ED Campus Safety/);
  assert.match(html, /OCR Open Investigation/);
});

test("institution pages read as accountability room briefings without certification overclaiming", async () => {
  const html = await readFile(path.join(rootDir, "schools", "brown_university", "index.html"), "utf8");

  assert.match(html, /Brown University Accountability Room/);
  assert.match(html, /What the public record says/);
  assert.match(html, /Institution response/);
  assert.match(html, /Unresolved limits/);
  assert.match(html, /Source packet/);
  assert.match(html, /Correction \/ right of reply/);
  assert.match(html, /accepted official-source QA candidates/);
  assert.match(html, /No rankings\. No safety scores\. No legal findings\./);
  assert.doesNotMatch(html, /all import-wave rows are individually human-certified/i);
});

test("homepage reflects current scale without stale institution counts", async () => {
  const html = await readFile(path.join(rootDir, "index.html"), "utf8");

  assert.match(html, /150,000 accepted import-wave QA candidates/);
  assert.match(html, /4,000 public event records/);
  assert.match(html, /Accountability Room/);
  assert.doesNotMatch(html, /947 schools/);
  assert.doesNotMatch(html, /Human review required/);
});

test("accountability room CSS avoids decorative generated-UI patterns", async () => {
  const css = await readFile(path.join(rootDir, "assets", "styles.css"), "utf8");
  const accountabilityCss = css
    .split("\n")
    .filter((line) => /accountability|briefing|limit-line|room/.test(line))
    .join("\n");

  assert.doesNotMatch(accountabilityCss, /linear-gradient|radial-gradient|box-shadow|filter:\s*blur/i);

  const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map((match) => Number(match[1]));
  assert.ok(radii.every((radius) => radius <= 8), `Expected border radii <= 8px, saw ${radii.join(", ")}`);
});
