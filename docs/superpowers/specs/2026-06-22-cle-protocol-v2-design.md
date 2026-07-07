# CLE Protocol V2 Design

## Purpose

CLE Protocol V2 should make Campus Evidence Lab independently verifiable by developers, journalists, researchers, and future proof adapters. The core promise is local verification first: a user should be able to download public files, verify hashes, prove record inclusion in a snapshot, and understand responsible-use limits without any blockchain, hosted API, or private service.

Solidity is still important, but it should anchor artifacts produced by the local protocol. The contract must not become the verification engine, the data store, or the governance system.

## Existing Foundation

The repo already has a useful base:

- `scripts/lib.mjs` provides `canonicalize(value)`, `sha256(value)`, and `eventForHash(event)`.
- `scripts/hash-dataset.mjs` computes record hashes, artifact hashes, and `data/snapshot-manifest.json`.
- `data/snapshot-manifest.json` includes current totals and hash fields for the 4,000-record snapshot.
- `contracts/SnapshotRegistry.sol` stores snapshot ID, snapshot hash, metadata URI, publisher, and timestamp.
- `test/SnapshotRegistry.t.sol` covers owner publishing, duplicate rejection, invalid fields, ownership transfer, and zero owner rejection.

V2 should extend this base rather than creating a parallel hash or proof system.

## V2 Architecture

### 1. Canonical Evidence Data

Canonicalization must be explicit and reusable. V2 should extract protocol-specific canonicalization into `scripts/protocol/canonical-json.mjs` while preserving compatibility with the existing sorted-object behavior in `scripts/lib.mjs`.

Rules:

- Objects are serialized with lexicographically sorted keys.
- Arrays preserve order.
- Strings, numbers, booleans, and null remain JSON primitives.
- Unsupported JavaScript values such as `undefined`, functions, `BigInt`, `NaN`, and infinite numbers are rejected.
- Hash input is the UTF-8 bytes of `JSON.stringify(canonicalize(value))`.

The protocol version should name this as `sorted-json-v1`.

### 2. Deterministic Hashes

V2 should standardize hashes as objects or strings that include algorithm identity:

- String form remains `sha256:<hex>`.
- Hex must be lowercase.
- Verification should reject missing algorithm prefixes, non-hex payloads, and wrong lengths.

Required hash targets:

- Record hash: existing event record hash over `eventForHash(event)`.
- Snapshot manifest hash: canonical hash of `data/snapshot-manifest.json`.
- Snapshot proof hash: canonical hash of `data/protocol/snapshot-proof.json`.
- Merkle leaf hash: domain-separated hash for record inclusion.
- Merkle root: hash root over leaves.

### 3. Merkle Proofs

V2 should add a Merkle tree over record-level evidence. The initial tree should use event records only because events are the user-facing records that reporters and researchers cite.

Leaf format:

```json
{
  "domain": "cle-record-leaf-v1",
  "record_id": "evt_2026_0027",
  "record_hash": "sha256:..."
}
```

Tree rules:

- Leaves sorted by `record_id`.
- Each internal node hashes a canonical object with `domain`, `left`, and `right`.
- If a level has an odd number of nodes, duplicate the final node.
- Proof steps include `position` as `left` or `right` and a sibling hash.
- Verification recomputes the root from leaf to root.

This design is intentionally boring. It is easy to reproduce and easy to explain.

### 4. Snapshot Proof Artifact

Generate `data/protocol/snapshot-proof.json` as the developer-facing proof artifact:

```json
{
  "id": "cle_protocol_snapshot_proof_v1",
  "protocol_version": "0.1.0",
  "canonicalization": "sorted-json-v1",
  "hash_algorithm": "sha256",
  "snapshot_id": "snapshot_2026_06_03_4000_records",
  "created_at": "2026-06-03",
  "record_count": 4000,
  "manifest_hash": "sha256:...",
  "records_merkle_root": "sha256:...",
  "records_leaf_hash": "sha256:...",
  "source_files": {
    "events": "data/events.json",
    "manifest": "data/snapshot-manifest.json"
  },
  "known_limits": [
    "Public-source documentation is not incident prevalence.",
    "Record counts are not school rankings, safety scores, or severity scores.",
    "Absence from the dataset does not imply absence of incidents or institutional response."
  ]
}
```

The artifact should not duplicate the full tree. Proofs can be generated on demand by the CLI.

### 5. Signed Manifests

Signed releases should be designed now but implemented carefully. V2.0 should define the interface and support verification when signature files exist; V2.0 does not need to introduce private key management.

Planned files:

- `data/protocol/snapshot-proof.json`
- `data/protocol/snapshot-proof.sig` in a later release
- `data/protocol/signing-keys.json` in a later release

Verification behavior:

- If no signature file exists, report `signature_status: "not_present"` and do not fail local hash/Merkle verification.
- If a signature file exists, verify it against known public keys.
- A bad signature fails verification.

This keeps V2 useful immediately and avoids rushed key-management mistakes.

### 6. CLI Developer Utility

V2.0 should add a local CLI entrypoint at `scripts/cle.mjs`.

Commands:

```bash
node scripts/cle.mjs inspect manifest
node scripts/cle.mjs verify snapshot
node scripts/cle.mjs verify record evt_2026_0027
node scripts/cle.mjs prove record evt_2026_0027
node scripts/cle.mjs policy check data/protocol/snapshot-proof.json
```

Output should be concise JSON by default so developers can pipe it into scripts. Human-friendly text can come later.

Failure behavior:

- Unknown command exits nonzero and prints allowed commands.
- Missing record exits nonzero with `record_not_found`.
- Hash mismatch exits nonzero with expected and actual hash.
- Merkle mismatch exits nonzero with expected and actual root.
- Policy violation exits nonzero with clear responsible-use messages.

### 7. SDK Direction

Do not build SDK packages in V2.0. Design the modules so they are SDK-ready:

- `scripts/protocol/canonical-json.mjs`
- `scripts/protocol/hash.mjs`
- `scripts/protocol/merkle.mjs`
- `scripts/protocol/snapshot-proof.mjs`
- `scripts/protocol/verify.mjs`
- `scripts/protocol/policy.mjs`

These should use pure functions where possible and avoid filesystem access except in loader/CLI boundaries. This makes a TypeScript SDK and Python SDK natural V2.2 work.

### 8. Responsible-Use Policy Checks

V2.0 should include a small policy checker for generated proof artifacts and future developer outputs.

Initial prohibited claims:

- school ranking
- safety score
- severity score
- prevalence estimate
- legal finding by CLE
- externally validated or endorsed claims unless explicitly negated

Initial required limits:

- public-source documentation limit
- no prevalence/ranking/safety/severity limit
- absence-from-dataset limit

This makes developer utility credible: the protocol helps prevent misuse, not just hashing.

### 9. Solidity Proof Adapter Scope

V2.1 should upgrade the contract only after V2.0 proves local verification.

Recommended contract shape:

```solidity
struct SnapshotProof {
    string snapshotId;
    bytes32 manifestHash;
    bytes32 recordsMerkleRoot;
    bytes32 schemaHash;
    bytes32 methodologyHash;
    string metadataURI;
    uint64 publishedAt;
    address publisher;
}
```

Contract rules:

- Owner or designated publisher can publish.
- Snapshot ID cannot be reused.
- Zero hashes are rejected.
- Metadata URI cannot be empty.
- No token, payment, ranking, moderation, private submission, or governance behavior.
- Contract stores roots and pointers only.

V2.1 tests should cover successful publish, duplicate rejection, invalid hashes, ownership/publisher controls, and retrieval by snapshot ID/key.

## Data Flow

1. `scripts/hash-dataset.mjs` continues generating record hashes and `snapshot-manifest.json`.
2. V2.0 generator reads `data/events.json` and `data/snapshot-manifest.json`.
3. It verifies every record hash can be reproduced.
4. It builds sorted Merkle leaves over event records.
5. It writes `data/protocol/snapshot-proof.json`.
6. CLI verifies snapshot proof, record hash, and record inclusion.
7. V2.1 Solidity adapter publishes manifest hash and Merkle root from the proof artifact.

## Testing Strategy

Use tiny fixtures for exact proof behavior and real data for smoke coverage.

Required tests:

- Canonicalization sorts object keys and preserves array order.
- Canonicalization rejects unsupported values.
- SHA-256 output uses `sha256:<64 lowercase hex>`.
- Merkle root is stable for a known fixture.
- Inclusion proof verifies for a known fixture.
- Tampered record hash fails proof verification.
- Tampered proof root fails verification.
- Snapshot proof generation matches current `events.json` record count.
- CLI `verify snapshot` succeeds on current data.
- CLI `verify record evt_2026_0027` succeeds on current data.
- CLI missing record fails with `record_not_found`.
- Policy checker rejects ranking/safety/prevalence claims.

## Explicit Non-Goals For V2.0

- No hosted API.
- No browser extension.
- No production signing key management.
- No TypeScript or Python package publication.
- No contract deployment.
- No on-chain record data.
- No private evidence handling.
- No token or governance mechanics.

## Acceptance Criteria

V2.0 is ready when:

- A developer can run local commands to verify the current snapshot.
- A developer can prove a specific record belongs to the current snapshot.
- Tampering with record data or proof data causes a clear failure.
- The generated proof artifact is checked into `data/protocol/`.
- Docs explain how to verify without blockchain.
- Solidity V2.1 has a documented adapter scope but is not required for V2.0 verification.
