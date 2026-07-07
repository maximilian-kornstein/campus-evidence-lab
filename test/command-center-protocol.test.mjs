import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("homepage exposes command-center entry points and proof-layer framing", async () => {
  const [indexHtml, appJs] = await Promise.all([text("index.html"), text("assets/app.js")]);
  const combined = `${indexHtml}\n${appJs}`;

  for (const expected of [
    "Search Records",
    "Build Reporting Packet",
    "Download Data",
    "Review Methodology",
    "4,000",
    "947",
    "25",
    "CSV/JSON",
    "snapshot"
  ]) {
    assert.match(combined, new RegExp(expected.replace("/", "\\/"), "i"), `Missing homepage signal: ${expected}`);
  }

  assert.match(combined, /Journalist/i);
  assert.match(combined, /Researcher/i);
  assert.match(combined, /Contributor/i);
  assert.match(combined, /Reviewer/i);
  assert.match(indexHtml, /protocol\//i);
});

test("research packet language is reporting-ready and bounded", async () => {
  const appJs = await text("assets/app.js");

  for (const expected of [
    "Reporting Packet",
    "Methodology note",
    "Limitations",
    "Snapshot hash",
    "Source URLs",
    "citation"
  ]) {
    assert.match(appJs, new RegExp(expected, "i"), `Missing packet signal: ${expected}`);
  }

  assert.match(appJs, /This packet cites public-source documentation, not incident prevalence\./);
  assert.match(appJs, /Record counts are not school rankings, safety scores, or severity scores\./);
  assert.match(appJs, /AI-generated summaries or downstream analysis should not be treated as reviewed/i);
});

test("protocol page makes local verification primary and blockchain optional", async () => {
  const protocolHtml = await text("protocol/index.html");

  for (const expected of [
    "CLE Protocol",
    "civil-rights evidence integrity",
    "Canonical Evidence Data",
    "Deterministic Hashes",
    "Signed Releases",
    "Merkle Proofs",
    "Local Verifier",
    "Proof Adapters",
    "Developer Utility",
    "Evidence Packets",
    "Responsible-Use Layer",
    "SnapshotRegistry.sol"
  ]) {
    assert.match(protocolHtml, new RegExp(expected, "i"), `Missing protocol copy: ${expected}`);
  }

  assert.match(protocolHtml, /blockchain is optional/i);
  assert.match(protocolHtml, /Do not put sensitive incident data on-chain/i);
  assert.match(protocolHtml, /no token/i);
});

test("static build includes protocol and contract source directories", async () => {
  const buildStatic = await text("scripts/build-static.mjs");
  assert.match(buildStatic, /"protocol"/);
  assert.match(buildStatic, /"contracts"/);
});
