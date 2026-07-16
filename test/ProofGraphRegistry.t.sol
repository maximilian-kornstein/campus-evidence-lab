// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProofGraphRegistry} from "../contracts/ProofGraphRegistry.sol";

contract ProofGraphActor {
    function attest(ProofGraphRegistry registry, bytes32 key, bytes32 statementHash, string calldata uri) external { registry.attest(key, statementHash, uri); }
    function challenge(ProofGraphRegistry registry, bytes32 key, bytes32 evidenceHash, string calldata uri) external returns (uint256) { return registry.challenge(key, evidenceHash, uri); }
}

contract ProofGraphRegistryTest {
    bytes32 private constant ROOT = keccak256("root");
    bytes32 private constant SNAPSHOT = keccak256("snapshot");

    function publish(ProofGraphRegistry registry, string memory id, bytes32 supersedes) private returns (bytes32) {
        return registry.publishGraph(id, ROOT, SNAPSHOT, "https://campusevidencelab.org/proof-graph/", supersedes);
    }

    function testPublishAndSupersede() public {
        ProofGraphRegistry registry = new ProofGraphRegistry(address(this));
        bytes32 first = publish(registry, "proofgraph:evt_1:v1", bytes32(0));
        bytes32 second = publish(registry, "proofgraph:evt_1:v2", first);
        ProofGraphRegistry.GraphCommitment memory stored = registry.getGraph(second);
        require(stored.graphRoot == ROOT && stored.snapshotHash == SNAPSHOT, "commitment mismatch");
        require(stored.supersedes == first, "lineage missing");
        require(registry.graphCount() == 2, "count mismatch");
    }

    function testDuplicateAndInvalidGraphRejected() public {
        ProofGraphRegistry registry = new ProofGraphRegistry(address(this));
        publish(registry, "proofgraph:evt_1", bytes32(0));
        try registry.publishGraph("proofgraph:evt_1", ROOT, SNAPSHOT, "uri", bytes32(0)) returns (bytes32) { revert("duplicate accepted"); } catch {}
        try registry.publishGraph("", ROOT, SNAPSHOT, "uri", bytes32(0)) returns (bytes32) { revert("empty id accepted"); } catch {}
        try registry.publishGraph("proofgraph:evt_2", bytes32(0), SNAPSHOT, "uri", bytes32(0)) returns (bytes32) { revert("zero root accepted"); } catch {}
        try registry.publishGraph("proofgraph:evt_2", ROOT, SNAPSHOT, "uri", keccak256("missing")) returns (bytes32) { revert("missing lineage accepted"); } catch {}
    }

    function testRegisteredAttestationAndPermissionlessChallenge() public {
        ProofGraphRegistry registry = new ProofGraphRegistry(address(this));
        ProofGraphActor actor = new ProofGraphActor();
        bytes32 key = publish(registry, "proofgraph:evt_1", bytes32(0));
        registry.setAttestor(address(actor), true);
        actor.attest(registry, key, keccak256("checked"), "ipfs://attestation");
        require(registry.attestationCount(key) == 1, "attestation missing");
        uint256 challengeIndex = actor.challenge(registry, key, keccak256("counterevidence"), "ipfs://challenge");
        require(challengeIndex == 0 && registry.challengeCount(key) == 1, "challenge missing");
        registry.respond(key, 0, keccak256("response"), "ipfs://response");
        ProofGraphRegistry.Challenge memory item = registry.getChallenge(key, 0);
        require(item.responseHash == keccak256("response") && item.respondedAt > 0, "response missing");
    }

    function testUnregisteredAttestorRejected() public {
        ProofGraphRegistry registry = new ProofGraphRegistry(address(this));
        ProofGraphActor actor = new ProofGraphActor();
        bytes32 key = publish(registry, "proofgraph:evt_1", bytes32(0));
        try actor.attest(registry, key, keccak256("checked"), "ipfs://attestation") { revert("unregistered attestor accepted"); } catch {}
    }
}
