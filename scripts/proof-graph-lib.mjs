import { createHash } from "node:crypto";

export const PROOF_GRAPH_SCHEMA_VERSION = "1.0.0";

export function canonicalJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function merkleRoot(leaves) {
  if (!leaves.length) return digest([]);
  let level = leaves.map((leaf) => typeof leaf === "string" ? leaf : digest(leaf));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(digest({ left, right }));
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves, targetIndex) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= leaves.length) throw new Error("Invalid Merkle proof index");
  const proof = [];
  let index = targetIndex;
  let level = leaves.map((leaf) => typeof leaf === "string" ? leaf : digest(leaf));
  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? Math.min(index + 1, level.length - 1) : index - 1;
    proof.push({ position: index % 2 === 0 ? "right" : "left", hash: level[siblingIndex] });
    const next = [];
    for (let cursor = 0; cursor < level.length; cursor += 2) {
      next.push(digest({ left: level[cursor], right: level[cursor + 1] ?? level[cursor] }));
    }
    index = Math.floor(index / 2);
    level = next;
  }
  return proof;
}

export function verifyMerkleProof(leaf, proof, expectedRoot) {
  let current = typeof leaf === "string" ? leaf : digest(leaf);
  for (const step of proof) {
    current = step.position === "left"
      ? digest({ left: step.hash, right: current })
      : digest({ left: current, right: step.hash });
  }
  return current === expectedRoot;
}

function hashedNode(node) {
  const payload = { ...node };
  return { ...payload, hash: digest(payload) };
}

function hashedEdge(edge) {
  const payload = { ...edge };
  return { ...payload, hash: digest(payload) };
}

function supportSources(event, field) {
  const normalized = field.toLowerCase();
  const support = (event.field_support ?? []).find((row) => String(row.field).toLowerCase() === normalized);
  return support?.source_ids?.length ? support.source_ids : event.source_ids ?? [];
}

export function buildEvidenceGraph({ event, school, sources, certification, snapshot, generatedAt }) {
  const nodes = [];
  const edges = [];
  const recordNodeId = `record:${event.id}`;
  nodes.push(hashedNode({
    id: recordNodeId,
    type: "record",
    label: school?.name ?? event.school_id,
    data: {
      event_id: event.id,
      school_id: event.school_id,
      school_name: school?.name ?? event.school_id,
      date: event.date,
      date_precision: event.date_precision,
      location: event.location,
      record_hash: event.record_hash,
      updated_at: event.updated_at,
    },
  }));

  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  for (const sourceId of [...new Set(event.source_ids ?? [])].sort()) {
    const source = sourceMap.get(sourceId);
    nodes.push(hashedNode({
      id: `source:${sourceId}`,
      type: "source",
      label: source?.title ?? sourceId,
      data: source ? {
        source_id: source.id,
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        source_type: source.source_type,
        published_date: source.published_date,
        accessed_date: source.accessed_date,
      } : { source_id: sourceId, unavailable_in_catalog: true },
    }));
  }

  const claims = [
    ["summary", "Record summary", event.summary, event.source_ids ?? []],
    ["description", "Record description", event.description, event.source_ids ?? []],
    ["category", "Category", event.category, supportSources(event, "Category")],
    ["affected_communities", "Affected communities", event.affected_communities ?? [], supportSources(event, "Affected communities")],
  ];
  for (const [field, label, value, sourceIds] of claims) {
    const claimId = `claim:${event.id}:${field}`;
    nodes.push(hashedNode({ id: claimId, type: "bounded_claim", label, data: { field, value } }));
    edges.push(hashedEdge({ id: `edge:${claimId}:describes`, type: "describes", from: claimId, to: recordNodeId }));
    for (const sourceId of [...new Set(sourceIds)].sort()) {
      edges.push(hashedEdge({ id: `edge:source:${sourceId}:supports:${field}`, type: "supports", from: `source:${sourceId}`, to: claimId }));
    }
  }

  if (event.institutional_response) {
    const responseId = `response:${event.id}`;
    nodes.push(hashedNode({
      id: responseId,
      type: "institutional_response",
      label: "Recorded institutional response",
      data: { text: event.institutional_response, response_date: event.response_date, response_depth: event.response_depth, legal_status: event.legal_status },
    }));
    edges.push(hashedEdge({ id: `edge:${responseId}:qualifies`, type: "qualifies", from: responseId, to: recordNodeId }));
    for (const sourceId of [...new Set(supportSources(event, "Institutional response"))].sort()) {
      edges.push(hashedEdge({ id: `edge:source:${sourceId}:supports:response`, type: "supports", from: `source:${sourceId}`, to: responseId }));
    }
  }

  const limitId = `limits:${event.id}`;
  nodes.push(hashedNode({
    id: limitId,
    type: "claim_boundary",
    label: "Claim boundaries",
    data: { limitations: event.limitations ?? [], confidence_rationale: event.confidence_rationale ?? null },
  }));
  for (const [field] of claims) {
    edges.push(hashedEdge({ id: `edge:${limitId}:bounds:${field}`, type: "bounds", from: limitId, to: `claim:${event.id}:${field}` }));
  }

  const certificationId = `certification:${event.id}`;
  nodes.push(hashedNode({
    id: certificationId,
    type: "certification",
    label: certification?.certification_status ?? "not listed",
    data: certification ? {
      certification_status: certification.certification_status,
      certification_basis: certification.certification_basis,
      open_gates: certification.open_gates,
      gates: certification.gates,
      review_debt_status: certification.review_debt_status,
    } : { certification_status: "not listed" },
  }));
  edges.push(hashedEdge({ id: `edge:${certificationId}:attests`, type: "attests", from: certificationId, to: recordNodeId }));

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  const graphRoot = merkleRoot([...nodes.map((node) => node.hash), ...edges.map((edge) => edge.hash)]);
  return {
    schema_version: PROOF_GRAPH_SCHEMA_VERSION,
    graph_id: `proofgraph:${event.id}`,
    record_id: event.id,
    snapshot_id: snapshot.snapshot_id,
    snapshot_hash: snapshot.hashes.full_snapshot,
    generated_at: generatedAt,
    nodes,
    edges,
    graph_root: graphRoot,
  };
}

export function verifyEvidenceGraph(graph) {
  const errors = [];
  for (const node of graph.nodes ?? []) {
    const { hash, ...payload } = node;
    if (digest(payload) !== hash) errors.push(`node_hash:${node.id}`);
  }
  for (const edge of graph.edges ?? []) {
    const { hash, ...payload } = edge;
    if (digest(payload) !== hash) errors.push(`edge_hash:${edge.id}`);
  }
  const root = merkleRoot([...(graph.nodes ?? []).map((node) => node.hash), ...(graph.edges ?? []).map((edge) => edge.hash)]);
  if (root !== graph.graph_root) errors.push("graph_root");
  if (graph.registry) {
    const leaf = digest({ record_id: graph.record_id, graph_root: graph.graph_root });
    if (leaf !== graph.registry.leaf_hash) errors.push("registry_leaf");
    if (!verifyMerkleProof(leaf, graph.registry.proof ?? [], graph.registry.root)) errors.push("registry_proof");
  }
  return { valid: errors.length === 0, errors, calculated_graph_root: root };
}
