// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Campus Evidence Lab Snapshot Registry
/// @notice Minimal owner-controlled registry for publishing dataset snapshot hashes.
/// @dev This contract is intentionally small: it stores attestations only and has no token,
/// payment, ranking, moderation, or private-submission behavior.
contract SnapshotRegistry {
    error EmptyMetadataURI();
    error EmptySnapshotId();
    error NotOwner(address caller);
    error SnapshotAlreadyPublished(bytes32 snapshotKey);
    error ZeroOwner();
    error ZeroSnapshotHash();

    struct Snapshot {
        string snapshotId;
        bytes32 snapshotHash;
        string metadataURI;
        uint64 publishedAt;
        address publisher;
    }

    address public owner;
    uint256 public snapshotCount;
    bytes32 public latestSnapshotKey;

    mapping(bytes32 snapshotKey => Snapshot snapshot) private snapshots;
    bytes32[] private snapshotKeys;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SnapshotPublished(
        string snapshotId,
        bytes32 indexed snapshotKey,
        bytes32 indexed snapshotHash,
        string metadataURI,
        address indexed publisher,
        uint256 publishedAt
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroOwner();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function publishSnapshot(string calldata snapshotId, bytes32 snapshotHash, string calldata metadataURI)
        external
        onlyOwner
        returns (bytes32 snapshotKey)
    {
        if (bytes(snapshotId).length == 0) revert EmptySnapshotId();
        if (snapshotHash == bytes32(0)) revert ZeroSnapshotHash();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        snapshotKey = snapshotKeyFor(snapshotId);
        if (bytes(snapshots[snapshotKey].snapshotId).length != 0) {
            revert SnapshotAlreadyPublished(snapshotKey);
        }

        snapshots[snapshotKey] = Snapshot({
            snapshotId: snapshotId,
            snapshotHash: snapshotHash,
            metadataURI: metadataURI,
            publishedAt: uint64(block.timestamp),
            publisher: msg.sender
        });
        snapshotKeys.push(snapshotKey);
        snapshotCount = snapshotKeys.length;
        latestSnapshotKey = snapshotKey;

        emit SnapshotPublished(snapshotId, snapshotKey, snapshotHash, metadataURI, msg.sender, block.timestamp);
    }

    function snapshotExists(string calldata snapshotId) external view returns (bool) {
        return bytes(snapshots[snapshotKeyFor(snapshotId)].snapshotId).length != 0;
    }

    function getSnapshot(string calldata snapshotId)
        external
        view
        returns (
            string memory storedSnapshotId,
            bytes32 snapshotHash,
            string memory metadataURI,
            uint64 publishedAt,
            address publisher
        )
    {
        Snapshot storage snapshot = snapshots[snapshotKeyFor(snapshotId)];
        return
            (snapshot.snapshotId, snapshot.snapshotHash, snapshot.metadataURI, snapshot.publishedAt, snapshot.publisher);
    }

    function getSnapshotByKey(bytes32 snapshotKey)
        external
        view
        returns (
            string memory snapshotId,
            bytes32 snapshotHash,
            string memory metadataURI,
            uint64 publishedAt,
            address publisher
        )
    {
        Snapshot storage snapshot = snapshots[snapshotKey];
        return
            (snapshot.snapshotId, snapshot.snapshotHash, snapshot.metadataURI, snapshot.publishedAt, snapshot.publisher);
    }

    function getSnapshotKeyAt(uint256 index) external view returns (bytes32) {
        return snapshotKeys[index];
    }

    function snapshotKeyFor(string memory snapshotId) public pure returns (bytes32) {
        return keccak256(bytes(snapshotId));
    }
}
