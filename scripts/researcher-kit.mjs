import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./lib.mjs";

const [, , command, ...rawArgs] = process.argv;

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function relativeRoute(route) {
  return String(route ?? "").replace(/^\/+/, "");
}

async function readApiJson(...parts) {
  return JSON.parse(await readFile(path.join(paths.apiV1Dir, ...parts), "utf8"));
}

async function resolveInstitution(query) {
  const index = await readApiJson("institutions", "index.json");
  const normalizedQuery = normalize(query);
  const candidates = index.institutions ?? [];
  const match =
    candidates.find((institution) => institution.school_id === query) ??
    candidates.find((institution) => normalize(institution.name) === normalizedQuery) ??
    candidates.find((institution) => normalize(institution.school_id) === normalizedQuery) ??
    candidates.find((institution) => normalize(institution.name).includes(normalizedQuery));

  if (!match) {
    throw new Error(`No institution matched "${query}". Try a school_id from data/api/v1/institutions/index.json.`);
  }

  return readApiJson("institutions", `${match.school_id}.json`);
}

function hasJsonFlag(args) {
  return args.includes("--json");
}

function positionalArgs(args) {
  return args.filter((arg) => arg !== "--json");
}

async function institutionCommand(args) {
  const query = positionalArgs(args).join(" ").trim();
  if (!query) throw new Error("Usage: researcher-kit institution <school_id_or_name> [--json]");

  const institution = await resolveInstitution(query);
  if (hasJsonFlag(args)) {
    process.stdout.write(`${JSON.stringify(institution, null, 2)}\n`);
    return;
  }

  const sourceFamilies = Object.entries(institution.source_family_counts ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([family, count]) => `${family} (${formatNumber(count)})`)
    .join(", ");
  const signals = (institution.accountability_signals ?? [])
    .slice(0, 6)
    .map((signal) => `- ${signal.label}${Number.isFinite(signal.count) ? `: ${formatNumber(signal.count)}` : ""}`)
    .join("\n");

  process.stdout.write(`\
${institution.name} (${institution.school_id})
Location: ${[institution.city, institution.state].filter(Boolean).join(", ") || "Not listed"}
Public event records: ${formatNumber(institution.public_event_count)}
Accepted QA candidates: ${formatNumber(institution.accepted_candidate_count)}
Source families: ${sourceFamilies || "None listed"}
Signals:
${signals || "- No generated signals in the current API payload"}
API: ${relativeRoute(institution.routes?.api ?? `/api/v1/institutions/${institution.school_id}.json`)}
Citation packet: ${relativeRoute(institution.routes?.citation_packet ?? `/api/v1/citation-packets/${institution.school_id}.json`)}
School page: ${relativeRoute(institution.routes?.school ?? `/schools/${institution.school_id}/`)}
Use limit: descriptive public-source infrastructure, not a comparative score, prevalence estimate, or legal finding.
`);
}

async function citationCommand(args) {
  const query = positionalArgs(args).join(" ").trim();
  if (!query) throw new Error("Usage: researcher-kit citation <school_id_or_name> [--json]");

  const institution = await resolveInstitution(query);
  const packet = await readApiJson("citation-packets", `${institution.school_id}.json`);
  if (hasJsonFlag(args)) {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    return;
  }

  const eventRows = (packet.events ?? [])
    .slice(0, 8)
    .map((event) => `- ${event.id} / ${event.date} / ${event.category} / ${relativeRoute(event.route)}`)
    .join("\n");
  const sourceRows = (packet.sources ?? [])
    .slice(0, 8)
    .map((source) => `- ${source.id}: ${source.title} (${source.publisher})`)
    .join("\n");

  process.stdout.write(`\
${packet.name} Citation Packet
School ID: ${packet.school_id}
Events: ${formatNumber(packet.events?.length ?? 0)}
Sources: ${formatNumber(packet.sources?.length ?? 0)}
Citation packet: api/v1/citation-packets/${packet.school_id}.json
Institution API: ${relativeRoute(packet.routes?.institution_api ?? `/api/v1/institutions/${packet.school_id}.json`)}
Event sample:
${eventRows || "- No event rows in this citation packet"}
Source sample:
${sourceRows || "- No source rows in this citation packet"}
`);
}

async function apiCheckCommand() {
  const [index, snapshot, institutionsIndex] = await Promise.all([
    readApiJson("index.json"),
    readApiJson("snapshot.json"),
    readApiJson("institutions", "index.json")
  ]);
  const institutionFiles = (await readdir(path.join(paths.apiV1Dir, "institutions"))).filter((file) => file.endsWith(".json") && file !== "index.json");
  const citationFiles = (await readdir(path.join(paths.apiV1Dir, "citation-packets"))).filter((file) => file.endsWith(".json"));

  const errors = [];
  if (index.api_version !== "v1") errors.push("index.json api_version must be v1");
  if (snapshot.api_version !== index.api_version) errors.push("snapshot api_version mismatch");
  if (institutionsIndex.api_version !== index.api_version) errors.push("institutions index api_version mismatch");
  if (snapshot.snapshot_id !== index.snapshot_id) errors.push("snapshot_id mismatch between index and snapshot");
  if (institutionsIndex.snapshot_id !== index.snapshot_id) errors.push("snapshot_id mismatch between index and institutions index");
  if (institutionFiles.length !== institutionsIndex.institutions.length) errors.push("institution endpoint count does not match institutions index");
  if (citationFiles.length !== institutionsIndex.institutions.length) errors.push("citation packet count does not match institutions index");

  if (errors.length) {
    throw new Error(`API integrity check failed:\n- ${errors.join("\n- ")}`);
  }

  process.stdout.write(`\
API integrity check passed
Snapshot: ${index.snapshot_id}
Institution endpoints: ${formatNumber(institutionFiles.length)}
Citation packets: ${formatNumber(citationFiles.length)}
Public endpoints: ${(index.endpoints ?? []).join(", ")}
`);
}

async function main() {
  if (command === "institution") {
    await institutionCommand(rawArgs);
    return;
  }
  if (command === "citation") {
    await citationCommand(rawArgs);
    return;
  }
  if (command === "api-check") {
    await apiCheckCommand();
    return;
  }

  throw new Error("Usage: researcher-kit <institution|citation|api-check> ...");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
