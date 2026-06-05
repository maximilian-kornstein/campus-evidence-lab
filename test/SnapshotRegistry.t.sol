// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SnapshotRegistry} from "../contracts/SnapshotRegistry.sol";

contract SnapshotRegistryActor {
    function publish(
        SnapshotRegistry registry,
        string calldata snapshotId,
        bytes32 snapshotHash,
        string calldata metadataURI
    ) external returns (bytes32) {
        return registry.publishSnapshot(snapshotId, snapshotHash, metadataURI);
    }
}

contract SnapshotRegistryTest {
    string private constant SNAPSHOT_ID = "snapshot_2026_06_03_4000_records";
    string private constant METADATA_URI = "https://campusevidencelab.org/data/snapshot-manifest.json";
    bytes32 private constant SNAPSHOT_HASH = 0xf496244d36c95437896fd7911ac302f4b30373a2719496bc19a44ef7ac1d8c79;

    function testOwnerCanPublishSnapshot() public {
        SnapshotRegistry registry = new SnapshotRegistry(address(this));

        bytes32 snapshotKey = registry.publishSnapshot(SNAPSHOT_ID, SNAPSHOT_HASH, METADATA_URI);

        require(snapshotKey == registry.snapshotKeyFor(SNAPSHOT_ID), "unexpected snapshot key");
        require(registry.latestSnapshotKey() == snapshotKey, "latest key not updated");
        require(registry.snapshotCount() == 1, "snapshot count not updated");
        require(registry.getSnapshotKeyAt(0) == snapshotKey, "snapshot key not indexed");
        require(registry.snapshotExists(SNAPSHOT_ID), "snapshot should exist");

        (
            string memory storedSnapshotId,
            bytes32 storedSnapshotHash,
            string memory storedMetadataURI,
            uint64 publishedAt,
            address publisher
        ) = registry.getSnapshot(SNAPSHOT_ID);

        require(keccak256(bytes(storedSnapshotId)) == keccak256(bytes(SNAPSHOT_ID)), "snapshot id mismatch");
        require(storedSnapshotHash == SNAPSHOT_HASH, "snapshot hash mismatch");
        require(keccak256(bytes(storedMetadataURI)) == keccak256(bytes(METADATA_URI)), "metadata uri mismatch");
        require(publishedAt > 0, "published timestamp missing");
        require(publisher == address(this), "publisher mismatch");
    }

    function testDuplicateSnapshotIdIsRejected() public {
        SnapshotRegistry registry = new SnapshotRegistry(address(this));
        registry.publishSnapshot(SNAPSHOT_ID, SNAPSHOT_HASH, METADATA_URI);

        try registry.publishSnapshot(SNAPSHOT_ID, SNAPSHOT_HASH, METADATA_URI) returns (bytes32) {
            revert("duplicate snapshot id accepted");
        } catch {}
    }

    function testOnlyOwnerCanPublishSnapshot() public {
        SnapshotRegistry registry = new SnapshotRegistry(address(this));
        SnapshotRegistryActor actor = new SnapshotRegistryActor();

        try actor.publish(registry, SNAPSHOT_ID, SNAPSHOT_HASH, METADATA_URI) returns (bytes32) {
            revert("non-owner published snapshot");
        } catch {}
    }

    function testRejectsInvalidSnapshotFields() public {
        SnapshotRegistry registry = new SnapshotRegistry(address(this));

        try registry.publishSnapshot("", SNAPSHOT_HASH, METADATA_URI) returns (bytes32) {
            revert("empty snapshot id accepted");
        } catch {}

        try registry.publishSnapshot(SNAPSHOT_ID, bytes32(0), METADATA_URI) returns (bytes32) {
            revert("zero snapshot hash accepted");
        } catch {}

        try registry.publishSnapshot(SNAPSHOT_ID, SNAPSHOT_HASH, "") returns (bytes32) {
            revert("empty metadata uri accepted");
        } catch {}
    }

    function testOwnershipCanMoveToNewPublisher() public {
        SnapshotRegistry registry = new SnapshotRegistry(address(this));
        SnapshotRegistryActor actor = new SnapshotRegistryActor();
        registry.transferOwnership(address(actor));

        bytes32 snapshotKey = actor.publish(registry, SNAPSHOT_ID, SNAPSHOT_HASH, METADATA_URI);
        (,,,, address publisher) = registry.getSnapshot(SNAPSHOT_ID);

        require(registry.owner() == address(actor), "owner not transferred");
        require(snapshotKey == registry.latestSnapshotKey(), "new owner publish failed");
        require(publisher == address(actor), "new publisher not stored");
    }

    function testZeroOwnerIsRejected() public {
        try new SnapshotRegistry(address(0)) returns (SnapshotRegistry) {
            revert("zero owner accepted");
        } catch {}
    }
}
