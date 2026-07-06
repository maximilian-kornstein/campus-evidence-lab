import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";

test("school pages expose institution accountability dossier quality controls", async () => {
  const html = await readFile(path.join(rootDir, "schools", "brown_university", "index.html"), "utf8");

  assert.match(html, /Institution Accountability Dossier/);
  assert.match(html, /Review Tier Mix/);
  assert.match(html, /Source Family Mix/);
  assert.match(html, /Response Depth Mix/);
  assert.match(html, /Right-of-reply/);
  assert.match(html, /not individually human-certified/);
});
