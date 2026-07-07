import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";

test("school pages expose institution accountability room quality controls", async () => {
  const html = await readFile(path.join(rootDir, "schools", "brown_university", "index.html"), "utf8");

  assert.match(html, /Brown University Accountability Room/);
  assert.match(html, /What the public record says/);
  assert.match(html, /Institution response/);
  assert.match(html, /Unresolved limits/);
  assert.match(html, /Source packet/);
  assert.match(html, /Correction \/ right of reply/);
  assert.match(html, /Review Tier Mix/);
  assert.match(html, /Source Family Mix/);
  assert.match(html, /Response Depth Mix/);
  assert.match(html, /Correction \/ right-of-reply intake/);
  assert.match(html, /accepted official-source QA candidates/);
  assert.match(html, /not individually human-certified/);
  assert.match(html, /No rankings\. No safety scores\. No legal findings\./);
});
