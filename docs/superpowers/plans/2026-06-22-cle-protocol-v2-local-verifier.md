# CLE Protocol V2 Local Verifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CLE Protocol V2.0 local developer verification: canonical hashing, Merkle inclusion proofs, snapshot proof generation, CLI commands, policy checks, and docs, while leaving Solidity as the V2.1 proof-adapter phase.

**Architecture:** Add pure protocol modules under `scripts/protocol/`, a local CLI at `scripts/cle.mjs`, a generated proof artifact at `data/protocol/snapshot-proof.json`, and focused `node:test` coverage. Keep existing `scripts/hash-dataset.mjs` and `data/snapshot-manifest.json` authoritative for current snapshot hashes; V2.0 derives proof artifacts from those files and verifies them locally.

**Tech Stack:** Node.js ESM, built-in `node:crypto`, built-in `node:test`, existing JSON data files, existing Solidity contract as later adapter context only.

---

## Scope

Implement V2.0 only. Do not modify `contracts/SnapshotRegistry.sol` in this plan. Do not introduce production signing keys, SDK package publishing, hosted APIs, browser extensions, private evidence, tokens, or on-chain data. The Solidity V2.1 adapter should be documented and planned after local verification is working.

## File Structure

Create:

- `scripts/protocol/canonical-json.mjs`: canonicalization and serialization rules for `sorted-json-v1`.
- `scripts/protocol/hash.mjs`: `sha256:` helpers, hash parsing, and hash validation.
- `scripts/protocol/merkle.mjs`: deterministic Merkle tree, proof generation, and proof verification.
- `scripts/protocol/snapshot-proof.mjs`: loads current data, verifies record hashes, builds snapshot proof artifact.
- `scripts/protocol/signature.mjs`: optional signed-manifest verification interface with `not_present` support.
- `scripts/protocol/verify.mjs`: pure verification helpers used by CLI and tests.
- `scripts/protocol/policy.mjs`: responsible-use policy checks.
- `scripts/generate-protocol-proof.mjs`: writes `data/protocol/snapshot-proof.json`.
- `scripts/cle.mjs`: developer CLI.
- `schema/snapshot-proof.schema.json`: JSON schema for the proof artifact.
- `docs/cle-protocol-v2.md`: developer verification guide.
- `test/cle-protocol-v2.test.mjs`: fixture and current-data tests.

Modify:

- `scripts/lib.mjs`: optionally re-export protocol hashing helpers only if needed for compatibility.
- `package.json`: add `protocol:proof` and `test:protocol` scripts.
- `downloads/index.html` and `assets/app.js`: add proof artifact and docs links after generation.
- `scripts/build-static.mjs`: include `data/protocol/` automatically through existing `data` copy; include docs/schema through existing paths.

---

### Task 1: Protocol Hashing Contract

**Files:**
- Create: `test/cle-protocol-v2.test.mjs`
- Create: `scripts/protocol/canonical-json.mjs`
- Create: `scripts/protocol/hash.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for canonical JSON and hash formatting**

Create `test/cle-protocol-v2.test.mjs` with:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { canonicalize, canonicalJson } from "../scripts/protocol/canonical-json.mjs";
import { sha256, assertSha256 } from "../scripts/protocol/hash.mjs";

test("canonicalJson sorts object keys and preserves array order", () => {
  const value = { b: 2, a: { d: 4, c: 3 }, rows: [{ z: 1, y: 2 }, "x"] };
  assert.equal(canonicalJson(value), '{"a":{"c":3,"d":4},"b":2,"rows":[{"y":2,"z":1},"x"]}');
  assert.deepEqual(canonicalize(value), { a: { c: 3, d: 4 }, b: 2, rows: [{ y: 2, z: 1 }, "x"] });
});

test("canonicalJson rejects unsupported values", () => {
  assert.throws(() => canonicalJson({ bad: undefined }), /unsupported/i);
  assert.throws(() => canonicalJson({ bad: Number.NaN }), /unsupported/i);
  assert.throws(() => canonicalJson({ bad: Infinity }), /unsupported/i);
  assert.throws(() => canonicalJson({ bad: 1n }), /unsupported/i);
});

test("sha256 returns algorithm-prefixed lowercase hashes", () => {
  const digest = sha256({ b: 2, a: 1 });
  assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(assertSha256(digest), digest);
  assert.throws(() => assertSha256("abc"), /sha256/i);
  assert.throws(() => assertSha256(`sha256:${"z".repeat(64)}`), /hex/i);
});
```

- [ ] **Step 2: Add npm script and run failing test**

Add to `package.json`:

```json
"test:protocol": "node --test test/cle-protocol-v2.test.mjs",
```

Run:

```bash
npm run test:protocol
```

Expected: FAIL because protocol modules do not exist.

- [ ] **Step 3: Implement canonical JSON**

Create `scripts/protocol/canonical-json.mjs`:

```js
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function canonicalize(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Unsupported number in canonical JSON");
    return value;
  }

  if (["string", "boolean"].includes(typeof value)) return value;

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const child = value[key];
        if (child === undefined || typeof child === "function" || typeof child === "bigint") {
          throw new TypeError(`Unsupported value for key ${key} in canonical JSON`);
        }
        acc[key] = canonicalize(child);
        return acc;
      }, {});
  }

  throw new TypeError("Unsupported value in canonical JSON");
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}
```

- [ ] **Step 4: Implement hash helpers**

Create `scripts/protocol/hash.mjs`:

```js
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.mjs";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function sha256(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function assertSha256(value, label = "hash") {
  if (typeof value !== "string" || !value.startsWith("sha256:")) {
    throw new Error(`${label} must start with sha256:`);
  }
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must contain 64 lowercase hex characters`);
  }
  return value;
}

export function sha256Hex(value) {
  return assertSha256(value).slice("sha256:".length);
}
```

- [ ] **Step 5: Run passing test**

Run:

```bash
npm run test:protocol
```

Expected: PASS for the first three tests.

---

### Task 2: Merkle Tree And Proofs

**Files:**
- Modify: `test/cle-protocol-v2.test.mjs`
- Create: `scripts/protocol/merkle.mjs`

- [ ] **Step 1: Add failing Merkle tests**

Append to `test/cle-protocol-v2.test.mjs`:

```js
import { buildMerkleTree, proofForLeaf, verifyMerkleProof } from "../scripts/protocol/merkle.mjs";

const fixtureLeaves = [
  { record_id: "evt_a", record_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { record_id: "evt_b", record_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { record_id: "evt_c", record_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" }
];

test("Merkle tree root and proofs are deterministic", () => {
  const tree = buildMerkleTree(fixtureLeaves);
  const treeAgain = buildMerkleTree([...fixtureLeaves].reverse());
  assert.equal(tree.root, treeAgain.root);
  assert.match(tree.root, /^sha256:[a-f0-9]{64}$/);

  const proof = proofForLeaf(tree, "evt_b");
  assert.equal(verifyMerkleProof({ leaf: tree.leaves[1], proof, root: tree.root }), true);
});

test("Merkle proof rejects tampered leaves and roots", () => {
  const tree = buildMerkleTree(fixtureLeaves);
  const proof = proofForLeaf(tree, "evt_b");
  assert.equal(
    verifyMerkleProof({
      leaf: { ...tree.leaves[1], record_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" },
      proof,
      root: tree.root
    }),
    false
  );
  assert.equal(
    verifyMerkleProof({
      leaf: tree.leaves[1],
      proof,
      root: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    }),
    false
  );
});
```

- [ ] **Step 2: Run failing Merkle tests**

Run:

```bash
npm run test:protocol
```

Expected: FAIL because `scripts/protocol/merkle.mjs` does not exist.

- [ ] **Step 3: Implement Merkle helpers**

Create `scripts/protocol/merkle.mjs`:

```js
import { assertSha256, sha256 } from "./hash.mjs";

function leafForRecord(row) {
  return {
    domain: "cle-record-leaf-v1",
    record_id: row.record_id,
    record_hash: assertSha256(row.record_hash, `${row.record_id} record_hash`)
  };
}

function nodeHash(left, right) {
  return sha256({ domain: "cle-merkle-node-v1", left: assertSha256(left, "left"), right: assertSha256(right, "right") });
}

export function buildMerkleTree(records) {
  const leaves = [...records]
    .map(leafForRecord)
    .sort((a, b) => a.record_id.localeCompare(b.record_id))
    .map((leaf) => ({ ...leaf, leaf_hash: sha256(leaf) }));

  if (!leaves.length) throw new Error("Merkle tree requires at least one leaf");

  const levels = [leaves.map((leaf) => leaf.leaf_hash)];
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1);
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      const left = current[index];
      const right = current[index + 1] ?? left;
      next.push(nodeHash(left, right));
    }
    levels.push(next);
  }

  return { leaves, levels, root: levels.at(-1)[0] };
}

export function proofForLeaf(tree, recordId) {
  let index = tree.leaves.findIndex((leaf) => leaf.record_id === recordId);
  if (index === -1) throw new Error(`record_not_found:${recordId}`);

  const proof = [];
  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex += 1) {
    const level = tree.levels[levelIndex];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const sibling = level[siblingIndex] ?? level[index];
    proof.push({ position: isRight ? "left" : "right", hash: sibling });
    index = Math.floor(index / 2);
  }
  return proof;
}

export function verifyMerkleProof({ leaf, proof, root }) {
  try {
    let current = sha256(leafForRecord(leaf));
    for (const step of proof) {
      assertSha256(step.hash, "proof step hash");
      if (step.position === "left") current = nodeHash(step.hash, current);
      else if (step.position === "right") current = nodeHash(current, step.hash);
      else throw new Error(`Invalid proof position ${step.position}`);
    }
    return current === assertSha256(root, "root");
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run passing Merkle tests**

Run:

```bash
npm run test:protocol
```

Expected: PASS for hashing and Merkle tests.

---

### Task 3: Snapshot Proof Generation

**Files:**
- Modify: `test/cle-protocol-v2.test.mjs`
- Create: `scripts/protocol/snapshot-proof.mjs`
- Create: `scripts/generate-protocol-proof.mjs`
- Create: `schema/snapshot-proof.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add failing snapshot proof tests**

Append:

```js
import { readFile } from "node:fs/promises";
import { buildSnapshotProof } from "../scripts/protocol/snapshot-proof.mjs";

test("snapshot proof matches current dataset shape", async () => {
  const events = JSON.parse(await readFile(new URL("../data/events.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../data/snapshot-manifest.json", import.meta.url), "utf8"));
  const proof = buildSnapshotProof({ events, manifest });

  assert.equal(proof.id, "cle_protocol_snapshot_proof_v1");
  assert.equal(proof.snapshot_id, manifest.snapshot_id);
  assert.equal(proof.record_count, events.length);
  assert.equal(proof.protocol_version, "0.1.0");
  assert.equal(proof.canonicalization, "sorted-json-v1");
  assert.equal(proof.hash_algorithm, "sha256");
  assert.match(proof.manifest_hash, /^sha256:[a-f0-9]{64}$/);
  assert.match(proof.records_merkle_root, /^sha256:[a-f0-9]{64}$/);
  assert.ok(proof.known_limits.some((limit) => /prevalence/i.test(limit)));
});
```

- [ ] **Step 2: Add scripts**

Add to `package.json`:

```json
"protocol:proof": "node scripts/generate-protocol-proof.mjs",
```

- [ ] **Step 3: Implement snapshot proof builder**

Create `scripts/protocol/snapshot-proof.mjs`:

```js
import { eventForHash } from "../lib.mjs";
import { sha256 } from "./hash.mjs";
import { buildMerkleTree } from "./merkle.mjs";

export function eventRecordRows(events) {
  return events.map((event) => ({
    record_id: event.id,
    record_hash: event.record_hash || sha256(eventForHash(event))
  }));
}

export function verifyEventHashes(events) {
  const mismatches = [];
  for (const event of events) {
    const expected = sha256(eventForHash(event));
    if (event.record_hash !== expected) {
      mismatches.push({ record_id: event.id, expected, actual: event.record_hash || "" });
    }
  }
  return mismatches;
}

export function buildSnapshotProof({ events, manifest }) {
  const mismatches = verifyEventHashes(events);
  if (mismatches.length) {
    const first = mismatches[0];
    throw new Error(`record_hash_mismatch:${first.record_id}:${first.expected}:${first.actual}`);
  }

  const tree = buildMerkleTree(eventRecordRows(events));
  return {
    id: "cle_protocol_snapshot_proof_v1",
    protocol_version: "0.1.0",
    canonicalization: "sorted-json-v1",
    hash_algorithm: "sha256",
    snapshot_id: manifest.snapshot_id,
    created_at: manifest.created_at,
    record_count: events.length,
    manifest_hash: sha256(manifest),
    records_merkle_root: tree.root,
    records_leaf_hash: sha256({ domain: "cle-record-leaves-v1", leaves: tree.leaves.map((leaf) => leaf.leaf_hash) }),
    source_files: {
      events: "data/events.json",
      manifest: "data/snapshot-manifest.json"
    },
    known_limits: [
      "Public-source documentation is not incident prevalence.",
      "Record counts are not school rankings, safety scores, or severity scores.",
      "Absence from the dataset does not imply absence of incidents or institutional response."
    ]
  };
}
```

- [ ] **Step 4: Implement proof generator**

Create `scripts/generate-protocol-proof.mjs`:

```js
import path from "node:path";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";
import { buildSnapshotProof } from "./protocol/snapshot-proof.mjs";

const events = await readJson(paths.events);
const manifest = await readJson(paths.manifest);
const proof = buildSnapshotProof({ events, manifest });
const proofPath = path.join(rootDir, "data", "protocol", "snapshot-proof.json");

await writeJson(proofPath, proof);
console.log(`Wrote ${path.relative(rootDir, proofPath)}: ${proof.records_merkle_root}`);
```

- [ ] **Step 5: Add proof schema**

Create `schema/snapshot-proof.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CLE Protocol Snapshot Proof",
  "type": "object",
  "required": ["id", "protocol_version", "canonicalization", "hash_algorithm", "snapshot_id", "created_at", "record_count", "manifest_hash", "records_merkle_root", "records_leaf_hash", "source_files", "known_limits"],
  "properties": {
    "id": { "const": "cle_protocol_snapshot_proof_v1" },
    "protocol_version": { "type": "string" },
    "canonicalization": { "const": "sorted-json-v1" },
    "hash_algorithm": { "const": "sha256" },
    "snapshot_id": { "type": "string" },
    "created_at": { "type": "string" },
    "record_count": { "type": "integer", "minimum": 1 },
    "manifest_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "records_merkle_root": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "records_leaf_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "source_files": {
      "type": "object",
      "required": ["events", "manifest"],
      "properties": {
        "events": { "type": "string" },
        "manifest": { "type": "string" }
      },
      "additionalProperties": false
    },
    "known_limits": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 3
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 6: Run tests and generate artifact**

Run:

```bash
npm run test:protocol
npm run protocol:proof
```

Expected: tests PASS and `data/protocol/snapshot-proof.json` is written.

---

### Task 4: Verification Helpers

**Files:**
- Modify: `test/cle-protocol-v2.test.mjs`
- Create: `scripts/protocol/signature.mjs`
- Create: `scripts/protocol/verify.mjs`

- [ ] **Step 1: Add verification tests**

Append:

```js
import { generateKeyPairSync, sign } from "node:crypto";
import { verifySnapshotProof, verifyRecordInSnapshot } from "../scripts/protocol/verify.mjs";
import { verifyOptionalSignature } from "../scripts/protocol/signature.mjs";

test("verifies snapshot proof and individual record inclusion", async () => {
  const events = JSON.parse(await readFile(new URL("../data/events.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../data/snapshot-manifest.json", import.meta.url), "utf8"));
  const proof = buildSnapshotProof({ events, manifest });

  const snapshot = verifySnapshotProof({ events, manifest, proof });
  assert.deepEqual(snapshot.errors, []);
  assert.equal(snapshot.signature_status, "not_present");
  assert.equal(verifyRecordInSnapshot({ events, recordId: "evt_2026_0027", expectedRoot: proof.records_merkle_root }).ok, true);
  assert.equal(verifyRecordInSnapshot({ events, recordId: "missing", expectedRoot: proof.records_merkle_root }).code, "record_not_found");
});

test("optional signature verification reports absent signatures", () => {
  const result = verifyOptionalSignature({ payload: { sample: true } });
  assert.equal(result.ok, true);
  assert.equal(result.signature_status, "not_present");
  assert.deepEqual(result.errors, []);
});

test("optional signature verification accepts valid Ed25519 signatures and rejects tampering", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const payload = { snapshot_id: "fixture", records_merkle_root: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
  const signatureEnvelope = {
    algorithm: "ed25519",
    key_id: "fixture-key",
    signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64")
  };
  const publicKeys = [
    { key_id: "fixture-key", public_key_pem: publicKey.export({ type: "spki", format: "pem" }) }
  ];

  assert.equal(verifyOptionalSignature({ payload, signatureEnvelope, publicKeys }).signature_status, "verified");
  const tampered = verifyOptionalSignature({ payload: { ...payload, snapshot_id: "tampered" }, signatureEnvelope, publicKeys });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.signature_status, "invalid");
});
```

- [ ] **Step 2: Implement signature verification interface**

Create `scripts/protocol/signature.mjs`:

```js
import { verify } from "node:crypto";
import { canonicalJson } from "./canonical-json.mjs";

function publicKeyFor(publicKeys, keyId) {
  return publicKeys.find((key) => key.key_id === keyId);
}

export function verifyOptionalSignature({ payload, signatureEnvelope = null, publicKeys = [] } = {}) {
  if (!signatureEnvelope) {
    return { ok: true, signature_status: "not_present", errors: [] };
  }

  const errors = [];
  if (signatureEnvelope.algorithm !== "ed25519") errors.push("unsupported_signature_algorithm");
  if (!signatureEnvelope.key_id) errors.push("missing_signature_key_id");
  if (!signatureEnvelope.signature) errors.push("missing_signature_value");

  const key = publicKeyFor(publicKeys, signatureEnvelope.key_id);
  if (!key) errors.push(`unknown_signature_key:${signatureEnvelope.key_id || ""}`);

  if (errors.length) {
    return { ok: false, signature_status: "invalid", errors };
  }

  try {
    const ok = verify(
      null,
      Buffer.from(canonicalJson(payload)),
      key.public_key_pem,
      Buffer.from(signatureEnvelope.signature, "base64")
    );
    return { ok, signature_status: ok ? "verified" : "invalid", errors: ok ? [] : ["bad_signature"] };
  } catch (error) {
    return { ok: false, signature_status: "invalid", errors: [`signature_verify_error:${error.message}`] };
  }
}
```

- [ ] **Step 3: Implement verification helpers**

Create `scripts/protocol/verify.mjs`:

```js
import { buildMerkleTree, proofForLeaf, verifyMerkleProof } from "./merkle.mjs";
import { verifyOptionalSignature } from "./signature.mjs";
import { buildSnapshotProof, eventRecordRows } from "./snapshot-proof.mjs";

export function verifySnapshotProof({ events, manifest, proof, signatureEnvelope = null, publicKeys = [] }) {
  const errors = [];
  let rebuilt;
  try {
    rebuilt = buildSnapshotProof({ events, manifest });
  } catch (error) {
    return { ok: false, errors: [error.message], signature_status: "not_checked" };
  }

  for (const field of ["snapshot_id", "record_count", "manifest_hash", "records_merkle_root", "records_leaf_hash"]) {
    if (rebuilt[field] !== proof[field]) {
      errors.push(`${field}_mismatch expected=${rebuilt[field]} actual=${proof[field]}`);
    }
  }

  const signature = verifyOptionalSignature({ payload: proof, signatureEnvelope, publicKeys });
  return {
    ok: errors.length === 0 && signature.ok,
    errors: [...errors, ...signature.errors],
    signature_status: signature.signature_status,
    rebuilt
  };
}

export function verifyRecordInSnapshot({ events, recordId, expectedRoot }) {
  const tree = buildMerkleTree(eventRecordRows(events));
  const leaf = tree.leaves.find((item) => item.record_id === recordId);
  if (!leaf) return { ok: false, code: "record_not_found", record_id: recordId };
  const proof = proofForLeaf(tree, recordId);
  const ok = verifyMerkleProof({ leaf, proof, root: expectedRoot });
  return { ok, code: ok ? "ok" : "merkle_root_mismatch", record_id: recordId, root: tree.root, proof };
}
```

- [ ] **Step 4: Run verification tests**

Run:

```bash
npm run test:protocol
```

Expected: PASS for hashing, Merkle, snapshot proof, and verification helper tests.

---

### Task 5: Responsible-Use Policy

**Files:**
- Modify: `test/cle-protocol-v2.test.mjs`
- Create: `scripts/protocol/policy.mjs`

- [ ] **Step 1: Add policy tests**

Append:

```js
import { checkPolicy } from "../scripts/protocol/policy.mjs";

test("policy checker requires limits and rejects unsupported claims", () => {
  const valid = checkPolicy({
    known_limits: [
      "Public-source documentation is not incident prevalence.",
      "Record counts are not school rankings, safety scores, or severity scores.",
      "Absence from the dataset does not imply absence of incidents or institutional response."
    ]
  });
  assert.equal(valid.ok, true);

  const invalid = checkPolicy({
    known_limits: ["This dataset identifies the safest school."]
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /safest|safety/i.test(error)));
});
```

- [ ] **Step 2: Implement policy checker**

Create `scripts/protocol/policy.mjs`:

```js
const prohibited = /\b(safest|most dangerous|school rankings?|safety scores?|severity scores?|prevalence estimates?|legal findings?|endorsed by|externally validated)\b/i;

const requiredPatterns = [
  /public-source documentation/i,
  /not .*prevalence|no .*prevalence/i,
  /not .*rankings?|no .*rankings?/i,
  /absence .*dataset/i
];

export function checkPolicy(value) {
  const text = JSON.stringify(value ?? {});
  const errors = [];
  const match = text.match(prohibited);
  if (match) errors.push(`prohibited_claim:${match[0]}`);

  for (const pattern of requiredPatterns) {
    if (!pattern.test(text)) errors.push(`missing_required_limit:${pattern.source}`);
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 3: Run policy tests**

Run:

```bash
npm run test:protocol
```

Expected: PASS for hashing, Merkle, snapshot proof, verification, and policy tests.

---

### Task 6: Developer CLI

**Files:**
- Create: `scripts/cle.mjs`

- [ ] **Step 1: Implement CLI**

Create `scripts/cle.mjs`:

```js
#!/usr/bin/env node
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";
import { buildSnapshotProof } from "./protocol/snapshot-proof.mjs";
import { verifyRecordInSnapshot, verifySnapshotProof } from "./protocol/verify.mjs";
import { checkPolicy } from "./protocol/policy.mjs";

async function loadCurrent() {
  const [events, manifest] = await Promise.all([readJson(paths.events), readJson(paths.manifest)]);
  const proof = buildSnapshotProof({ events, manifest });
  return { events, manifest, proof };
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

const [domain, action, arg] = process.argv.slice(2);

try {
  if (domain === "inspect" && action === "manifest") {
    const { manifest, proof } = await loadCurrent();
    print({ ok: true, snapshot_id: manifest.snapshot_id, manifest_hash: proof.manifest_hash, records_merkle_root: proof.records_merkle_root });
  } else if (domain === "verify" && action === "snapshot") {
    const current = await loadCurrent();
    const result = verifySnapshotProof(current);
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else if (domain === "verify" && action === "record") {
    const { events, proof } = await loadCurrent();
    const result = verifyRecordInSnapshot({ events, recordId: arg, expectedRoot: proof.records_merkle_root });
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else if (domain === "prove" && action === "record") {
    const { events, proof } = await loadCurrent();
    const result = verifyRecordInSnapshot({ events, recordId: arg, expectedRoot: proof.records_merkle_root });
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else if (domain === "policy" && action === "check") {
    const target = arg ? await readJson(path.resolve(rootDir, arg)) : (await loadCurrent()).proof;
    const result = checkPolicy(target);
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else {
    print({ ok: false, code: "unknown_command", allowed: ["inspect manifest", "verify snapshot", "verify record <id>", "prove record <id>", "policy check [file]"] });
    process.exitCode = 1;
  }
} catch (error) {
  print({ ok: false, code: "error", message: error.message });
  process.exitCode = 1;
}
```

- [ ] **Step 2: Run CLI smoke checks**

Run:

```bash
npm run test:protocol
node scripts/cle.mjs inspect manifest
node scripts/cle.mjs verify snapshot
node scripts/cle.mjs verify record evt_2026_0027
node scripts/cle.mjs prove record evt_2026_0027
node scripts/cle.mjs policy check data/protocol/snapshot-proof.json
```

Expected: tests PASS and all CLI commands emit JSON with `"ok": true`.

---

### Task 7: Downloads, Docs, And QA

**Files:**
- Create: `docs/cle-protocol-v2.md`
- Modify: `downloads/index.html`
- Modify: `assets/app.js`
- Modify: `scripts/qa-site.mjs`

- [ ] **Step 1: Create developer docs**

Create `docs/cle-protocol-v2.md`:

````md
# CLE Protocol V2

CLE Protocol V2 lets a developer verify Campus Evidence Lab public evidence artifacts locally.

## Commands

```bash
node scripts/cle.mjs inspect manifest
node scripts/cle.mjs verify snapshot
node scripts/cle.mjs verify record evt_2026_0027
node scripts/cle.mjs prove record evt_2026_0027
node scripts/cle.mjs policy check data/protocol/snapshot-proof.json
```

## What This Proves

- The current event records match their published record hashes.
- The snapshot manifest hashes match local files.
- A selected record is included in the current snapshot Merkle root.
- The proof artifact includes responsible-use limits.

## What This Does Not Prove

- It does not measure incident prevalence.
- It does not rank schools.
- It does not create safety, severity, or legal scores.
- It does not put private or sensitive evidence on-chain.

## Solidity Adapter

The existing `SnapshotRegistry.sol` is a prototype proof adapter. Solidity V2 should anchor manifest hashes and Merkle roots after local verification works.
````

- [ ] **Step 2: Add download links**

In `renderDownloads()` after `CLE Protocol Page`, add:

```js
${downloadRow("CLE Protocol V2 Proof", sitePath("/data/protocol/snapshot-proof.json"), "Local verifier proof artifact with manifest hash and records Merkle root")}
${downloadRow("CLE Protocol V2 Guide", sitePath("/docs/cle-protocol-v2.md"), "Developer commands for local snapshot and record verification")}
${downloadRow("Snapshot Proof Schema", sitePath("/schema/snapshot-proof.schema.json"), "Machine-readable proof artifact contract")}
```

Also add static fallback links in `downloads/index.html`.

- [ ] **Step 3: Update site QA**

In `scripts/qa-site.mjs`, add required copy checks for:

```js
"CLE Protocol V2 Proof",
"CLE Protocol V2 Guide",
"Snapshot Proof Schema"
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm run protocol:proof
npm run test:protocol
npm run qa:site
npm run qa:accessibility
npm run qa:render
```

Expected: all PASS.

---

### Task 8: Final Build Check

**Files:**
- No new source files unless checks reveal scoped issues.

- [ ] **Step 1: Build static output**

Run:

```bash
node scripts/build-static.mjs
```

Expected: `dist/data/protocol/snapshot-proof.json`, `dist/docs/cle-protocol-v2.md`, and `dist/schema/snapshot-proof.schema.json` exist.

- [ ] **Step 2: Run dist QA**

Run:

```bash
SITE_ROOT=dist npm run qa:site
SITE_ROOT=dist npm run qa:accessibility
SITE_ROOT=dist npm run qa:render
```

Expected: all PASS.

---

## V2.1 Solidity Adapter Scope

After this plan passes, write a separate Solidity V2.1 plan that extends the registry to store:

- `snapshotId`
- `manifestHash`
- `recordsMerkleRoot`
- `schemaHash`
- `methodologyHash`
- `metadataURI`
- `publishedAt`
- `publisher`

The contract must continue to reject zero hashes, duplicate snapshot IDs, empty metadata URIs, zero owners, non-owner publishing, and any token/payment/private-data behavior.

## Self-Review

- Spec coverage: Covers canonical hashing, Merkle proofs, proof artifact, local verification, CLI developer utility, policy checks, docs, and Solidity adapter boundary.
- Red-flag scan: No deferred implementation details inside V2.0 tasks.
- Scope check: V2.0 is a complete local verification milestone. V2.1 Solidity is explicitly separate so local developer utility remains the foundation.
