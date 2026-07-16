import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { rootDir } from "../scripts/lib.mjs";

test("partner kit is copy-ready and bounded", async () => {
  const [manifestText, html, script] = await Promise.all([
    readFile(path.join(rootDir, "partner-kit/manifest.json"), "utf8"),
    readFile(path.join(rootDir, "partner-kit/index.html"), "utf8"),
    readFile(path.join(rootDir, "assets/cel-signals-embed.js"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.feeds.length, 2);
  assert.equal(manifest.integration_assets.length, 3);
  assert.match(html, /data-cel-signals/);
  assert.match(html, /not evidence of adoption/);
  assert.match(script, /data\.items/);
  assert.match(script, /Math\.min\(10/);
});
