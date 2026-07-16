function canonicalJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function digest(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function merkleRoot(leaves) {
  if (!leaves.length) return digest([]);
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) next.push(await digest({ left: level[index], right: level[index + 1] ?? level[index] }));
    level = next;
  }
  return level[0];
}

async function verifyGraph(graph) {
  const errors = [];
  for (const node of graph.nodes) {
    const { hash, ...payload } = node;
    if (await digest(payload) !== hash) errors.push(`Node changed: ${node.id}`);
  }
  for (const edge of graph.edges) {
    const { hash, ...payload } = edge;
    if (await digest(payload) !== hash) errors.push(`Edge changed: ${edge.id}`);
  }
  const graphRoot = await merkleRoot([...graph.nodes.map((node) => node.hash), ...graph.edges.map((edge) => edge.hash)]);
  if (graphRoot !== graph.graph_root) errors.push("Graph root does not match");
  const leaf = await digest({ record_id: graph.record_id, graph_root: graph.graph_root });
  if (leaf !== graph.registry.leaf_hash) errors.push("Registry leaf does not match");
  let proofRoot = leaf;
  for (const step of graph.registry.proof) {
    proofRoot = step.position === "left"
      ? await digest({ left: step.hash, right: proofRoot })
      : await digest({ left: proofRoot, right: step.hash });
  }
  if (proofRoot !== graph.registry.root) errors.push("Registry inclusion proof failed");
  return { valid: errors.length === 0, errors, graphRoot };
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const result = document.querySelector("#proofgraph-result");
const input = document.querySelector("#proofgraph-record");

function nodeDetail(node) {
  if (node.type === "source" && node.data.url) return `<a href="${escapeHtml(node.data.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.data.publisher)} · open source</a>`;
  if (node.type === "bounded_claim") return escapeHtml(Array.isArray(node.data.value) ? node.data.value.join(", ") : node.data.value);
  if (node.type === "institutional_response") return escapeHtml(node.data.text);
  if (node.type === "claim_boundary") return `<ul>${(node.data.limitations ?? []).map((limit) => `<li>${escapeHtml(limit)}</li>`).join("")}</ul>`;
  if (node.type === "certification") return `${escapeHtml(node.data.certification_status)} · ${escapeHtml(node.data.certification_basis ?? "No basis recorded")}`;
  return escapeHtml(node.data.school_name ?? node.id);
}

async function loadRecord(recordId) {
  result.innerHTML = `<p class="proofgraph-loading">Loading and recomputing hashes…</p>`;
  try {
    const response = await fetch(`graphs/${encodeURIComponent(recordId)}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404 ? "No ProofGraph exists for that record ID." : `Graph request failed (${response.status}).`);
    const graph = await response.json();
    const verification = await verifyGraph(graph);
    result.innerHTML = `
      <header class="proofgraph-result__header">
        <div><p class="page-kicker">${verification.valid ? "Cryptographically consistent" : "Verification failed"}</p><h2>${escapeHtml(graph.record_id)}</h2></div>
        <span class="proofgraph-badge ${verification.valid ? "proofgraph-badge--valid" : "proofgraph-badge--invalid"}">${verification.valid ? "Verified" : "Changed"}</span>
      </header>
      ${verification.errors.length ? `<ul class="proofgraph-errors">${verification.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : ""}
      <dl class="proofgraph-hashes"><div><dt>Graph root</dt><dd class="mono">${escapeHtml(graph.graph_root)}</dd></div><div><dt>Registry inclusion</dt><dd>Leaf ${graph.registry.leaf_index + 1} of ${graph.registry.leaf_count}; ${graph.registry.proof.length} proof steps</dd></div></dl>
      <div class="proofgraph-layout">
        <div><h3>Nodes</h3><div class="proofgraph-nodes">${graph.nodes.map((node) => `<article class="proofgraph-node proofgraph-node--${escapeHtml(node.type)}"><p>${escapeHtml(node.type.replaceAll("_", " "))}</p><h4>${escapeHtml(node.label)}</h4><div>${nodeDetail(node)}</div><code>${escapeHtml(node.hash.slice(0, 23))}…</code></article>`).join("")}</div></div>
        <aside><h3>Relationships</h3><ol class="proofgraph-edges">${graph.edges.map((edge) => `<li><strong>${escapeHtml(edge.type)}</strong><span>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</span></li>`).join("")}</ol><p><a href="graphs/${encodeURIComponent(recordId)}.json">Download this graph</a> · <a href="../events/${encodeURIComponent(recordId)}/">Open record</a></p></aside>
      </div>`;
  } catch (error) {
    result.innerHTML = `<p class="proofgraph-error"><strong>Could not verify.</strong> ${escapeHtml(error.message)}</p>`;
  }
}

document.querySelector("#proofgraph-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const recordId = input.value.trim();
  const url = new URL(location.href);
  url.searchParams.set("record", recordId);
  history.replaceState({}, "", url);
  loadRecord(recordId);
});

const initialRecord = new URL(location.href).searchParams.get("record");
if (initialRecord) {
  input.value = initialRecord;
  loadRecord(initialRecord);
}
