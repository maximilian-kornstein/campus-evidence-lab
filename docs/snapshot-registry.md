# Snapshot Registry

Campus Evidence Lab includes a minimal Solidity registry for optional public attestation of dataset snapshot hashes.

The registry is not required for the website to work. The canonical public archive remains the static site, JSON/CSV exports, snapshot manifest, release notes, and GitHub history.

## Purpose

The contract provides a small, auditable way to publish that a specific dataset snapshot existed with a specific hash.

It stores:

- `snapshotId`: the existing Campus Evidence Lab snapshot identifier, such as `snapshot_2026_06_03_4000_records`
- `snapshotHash`: the 32-byte dataset hash from `data/snapshot-manifest.json`, encoded as `0x...`
- `metadataURI`: a public URL for the snapshot manifest, release notes, or another immutable evidence page
- `publishedAt`: the block timestamp
- `publisher`: the account that published the attestation

It does not store private reports, source text, rankings, ratings, payments, tokens, or moderation decisions.

## Contract

Source: `contracts/SnapshotRegistry.sol`

Core calls:

- `publishSnapshot(snapshotId, snapshotHash, metadataURI)`: owner-only, one attestation per snapshot ID
- `getSnapshot(snapshotId)`: read the stored attestation
- `snapshotExists(snapshotId)`: check whether an attestation has been published
- `getSnapshotKeyAt(index)`: enumerate published snapshot keys
- `transferOwnership(newOwner)`: move publishing authority if governance changes

## Local Testing

Foundry is used for local Solidity tests.

```sh
npm run test:contracts
```

The test suite verifies:

- owner publication succeeds
- duplicate snapshot IDs are rejected
- non-owner publication is rejected
- empty snapshot IDs, zero hashes, and empty metadata URIs are rejected
- ownership transfer allows the new owner to publish
- zero owner construction is rejected

## Hash Encoding

The current manifest hash is published in text as:

```text
sha256:f496244d36c95437896fd7911ac302f4b30373a2719496bc19a44ef7ac1d8c79
```

For the contract, remove the `sha256:` prefix and encode the remaining digest as `bytes32`:

```text
0xf496244d36c95437896fd7911ac302f4b30373a2719496bc19a44ef7ac1d8c79
```

The `snapshotId` and `metadataURI` preserve the human-readable context.

## Deployment Policy

No mainnet deployment is included in this repository.

No deploy script, private key handling, RPC endpoint, gas configuration, or chain target is configured by default.

Deployment should require a separate explicit approval step covering:

- target chain
- owner address or multisig
- exact snapshot hash and metadata URI
- gas cost
- whether the deployment improves trust enough to justify chain dependency

For this project, a low-cost public chain or testnet should be evaluated before any mainnet deployment. The default status is local-only.
