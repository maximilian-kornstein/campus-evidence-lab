// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Campus Evidence Lab ProofGraph Registry
/// @notice Publishes graph commitments and preserves third-party attestations, challenges, responses, and supersession lineage.
/// @dev This is a commitment and challenge log, not an automated truth oracle, token, or adjudication system.
contract ProofGraphRegistry {
    error AlreadyExists(bytes32 key);
    error EmptyString();
    error GraphNotFound(bytes32 graphKey);
    error NotOwner(address caller);
    error NotRegisteredAttestor(address caller);
    error ZeroAddress();
    error ZeroHash();

    struct GraphCommitment {
        string graphId;
        bytes32 graphRoot;
        bytes32 snapshotHash;
        string metadataURI;
        address publisher;
        uint64 publishedAt;
        bytes32 supersedes;
    }

    struct Attestation {
        address attestor;
        bytes32 statementHash;
        string evidenceURI;
        uint64 createdAt;
    }

    struct Challenge {
        address challenger;
        bytes32 evidenceHash;
        string evidenceURI;
        uint64 createdAt;
        bytes32 responseHash;
        string responseURI;
        uint64 respondedAt;
    }

    address public owner;
    uint256 public graphCount;
    mapping(address => bool) public registeredAttestors;
    mapping(bytes32 => GraphCommitment) private graphs;
    mapping(bytes32 => Attestation[]) private attestations;
    mapping(bytes32 => Challenge[]) private challenges;

    event AttestorStatusChanged(address indexed attestor, bool registered);
    event GraphPublished(bytes32 indexed graphKey, bytes32 indexed graphRoot, bytes32 indexed snapshotHash, string graphId, string metadataURI, address publisher, bytes32 supersedes);
    event GraphAttested(bytes32 indexed graphKey, address indexed attestor, bytes32 indexed statementHash, string evidenceURI);
    event GraphChallenged(bytes32 indexed graphKey, uint256 indexed challengeIndex, address indexed challenger, bytes32 evidenceHash, string evidenceURI);
    event ChallengeResponded(bytes32 indexed graphKey, uint256 indexed challengeIndex, bytes32 responseHash, string responseURI);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setAttestor(address attestor, bool registered) external onlyOwner {
        if (attestor == address(0)) revert ZeroAddress();
        registeredAttestors[attestor] = registered;
        emit AttestorStatusChanged(attestor, registered);
    }

    function publishGraph(string calldata graphId, bytes32 graphRoot, bytes32 snapshotHash, string calldata metadataURI, bytes32 supersedes)
        external onlyOwner returns (bytes32 graphKey)
    {
        if (bytes(graphId).length == 0 || bytes(metadataURI).length == 0) revert EmptyString();
        if (graphRoot == bytes32(0) || snapshotHash == bytes32(0)) revert ZeroHash();
        graphKey = keyFor(graphId);
        if (graphs[graphKey].publishedAt != 0) revert AlreadyExists(graphKey);
        if (supersedes != bytes32(0) && graphs[supersedes].publishedAt == 0) revert GraphNotFound(supersedes);
        graphs[graphKey] = GraphCommitment(graphId, graphRoot, snapshotHash, metadataURI, msg.sender, uint64(block.timestamp), supersedes);
        graphCount += 1;
        emit GraphPublished(graphKey, graphRoot, snapshotHash, graphId, metadataURI, msg.sender, supersedes);
    }

    function attest(bytes32 graphKey, bytes32 statementHash, string calldata evidenceURI) external {
        if (!registeredAttestors[msg.sender]) revert NotRegisteredAttestor(msg.sender);
        _requireGraph(graphKey);
        if (statementHash == bytes32(0)) revert ZeroHash();
        if (bytes(evidenceURI).length == 0) revert EmptyString();
        attestations[graphKey].push(Attestation(msg.sender, statementHash, evidenceURI, uint64(block.timestamp)));
        emit GraphAttested(graphKey, msg.sender, statementHash, evidenceURI);
    }

    function challenge(bytes32 graphKey, bytes32 evidenceHash, string calldata evidenceURI) external returns (uint256 challengeIndex) {
        _requireGraph(graphKey);
        if (evidenceHash == bytes32(0)) revert ZeroHash();
        if (bytes(evidenceURI).length == 0) revert EmptyString();
        challengeIndex = challenges[graphKey].length;
        challenges[graphKey].push(Challenge(msg.sender, evidenceHash, evidenceURI, uint64(block.timestamp), bytes32(0), "", 0));
        emit GraphChallenged(graphKey, challengeIndex, msg.sender, evidenceHash, evidenceURI);
    }

    function respond(bytes32 graphKey, uint256 challengeIndex, bytes32 responseHash, string calldata responseURI) external onlyOwner {
        _requireGraph(graphKey);
        if (responseHash == bytes32(0)) revert ZeroHash();
        if (bytes(responseURI).length == 0) revert EmptyString();
        Challenge storage item = challenges[graphKey][challengeIndex];
        item.responseHash = responseHash;
        item.responseURI = responseURI;
        item.respondedAt = uint64(block.timestamp);
        emit ChallengeResponded(graphKey, challengeIndex, responseHash, responseURI);
    }

    function getGraph(bytes32 graphKey) external view returns (GraphCommitment memory) { return graphs[graphKey]; }
    function getAttestation(bytes32 graphKey, uint256 index) external view returns (Attestation memory) { return attestations[graphKey][index]; }
    function getChallenge(bytes32 graphKey, uint256 index) external view returns (Challenge memory) { return challenges[graphKey][index]; }
    function attestationCount(bytes32 graphKey) external view returns (uint256) { return attestations[graphKey].length; }
    function challengeCount(bytes32 graphKey) external view returns (uint256) { return challenges[graphKey].length; }
    function keyFor(string memory graphId) public pure returns (bytes32) { return keccak256(bytes(graphId)); }

    function _requireGraph(bytes32 graphKey) private view {
        if (graphs[graphKey].publishedAt == 0) revert GraphNotFound(graphKey);
    }
}
