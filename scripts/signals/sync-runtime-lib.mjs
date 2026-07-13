export const MAX_D1_STATEMENTS_PER_REQUEST = 45;

export const SYNC_ARTIFACT_SPECS = [
  {
    route: "/api/signals/ingest",
    file: "data/signals.json",
    collection: "signals",
    maxRows: 20,
    rowCost: (row) => 1 + (row.sources?.length ?? 0),
  },
  {
    route: "/api/ingest/identity",
    file: "data/institution-identity-index.json",
    collection: "aliases",
    maxRows: 40,
  },
  {
    route: "/api/ingest/dossiers",
    file: "data/signal-dossiers.json",
    collection: "dossiers",
    maxRows: 40,
  },
  {
    route: "/api/ingest/reviews",
    file: "data/signal-shadow-review.json",
    collection: "decisions",
    maxRows: 20,
    rowCost: (row) => 1 + (row.passed ? 1 : 0),
    fixedCost: () => 2,
  },
  {
    route: "/api/ingest/triggers",
    file: "data/signal-triggers.json",
    collection: "triggers",
    maxRows: 35,
    firstBatchCost: (artifact) => artifact.providers?.length ?? 0,
    prepareBody: (body, batchIndex) => {
      if (batchIndex > 0) body.providers = [];
    },
  },
];

function statementCost(spec, row) {
  return spec.rowCost ? spec.rowCost(row) : 1;
}

export function partitionArtifact(spec, artifact, statementBudget = MAX_D1_STATEMENTS_PER_REQUEST) {
  const rows = artifact[spec.collection] ?? [];
  const batches = [];
  let offset = 0;

  do {
    const batchIndex = batches.length;
    const fixedCost = (spec.fixedCost?.(artifact, batchIndex) ?? 0) + (batchIndex === 0 ? spec.firstBatchCost?.(artifact) ?? 0 : 0);
    let estimatedStatements = fixedCost;
    const batchRows = [];

    while (offset < rows.length && batchRows.length < spec.maxRows) {
      const cost = statementCost(spec, rows[offset]);
      if (cost > statementBudget - fixedCost) throw new Error(`${spec.route} row exceeds the D1 statement budget`);
      if (batchRows.length && estimatedStatements + cost > statementBudget) break;
      batchRows.push(rows[offset]);
      estimatedStatements += cost;
      offset += 1;
    }

    const body = { ...artifact, [spec.collection]: batchRows };
    spec.prepareBody?.(body, batchIndex);
    batches.push({ body, estimatedStatements });
  } while (offset < rows.length);

  return batches;
}

export async function fetchWithRetry(url, options, {
  fetchImpl = fetch,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  attempts = 5,
} = {}) {
  let response;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetchImpl(url, options);
    if (response.ok || ![401, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) return response;
    await response.text();
    await sleep(Math.min(16_000, 1_000 * (2 ** (attempt - 1))));
  }
  return response;
}
