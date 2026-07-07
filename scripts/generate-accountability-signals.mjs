import { buildAccountabilitySignals, validateAccountabilitySignals } from "./accountability-signals-lib.mjs";
import { paths, readJson, writeJson } from "./lib.mjs";

const [schools, events, sources, institutionImportWaveSummary, corrections, manifest] = await Promise.all([
  readJson(paths.schools),
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.institutionImportWaveSummary),
  readJson(paths.corrections),
  readJson(paths.manifest)
]);

const artifact = buildAccountabilitySignals({
  schools,
  events,
  sources,
  institutionImportWaveSummary,
  corrections,
  manifest
});

const errors = validateAccountabilitySignals({
  artifact,
  schools,
  events,
  institutionImportWaveSummary
});

if (errors.length) {
  throw new Error(`Accountability signals validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.accountabilitySignals, artifact);

console.log(`Generated accountability signals for ${artifact.institutions.length} institutions.`);
