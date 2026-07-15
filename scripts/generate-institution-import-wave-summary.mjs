import { paths, readJson, writeJson } from "./lib.mjs";
import { loadInstitutionImportWaveSummary } from "./institution-import-wave-summary-lib.mjs";
import { preserveArtifactTimestamp } from "./artifact-stability.mjs";

const summary = await loadInstitutionImportWaveSummary();
const previous = await readJson(paths.institutionImportWaveSummary).catch(() => undefined);
summary.generated_at = preserveArtifactTimestamp(summary, previous, summary.generated_at);
await writeJson(paths.institutionImportWaveSummary, summary);

console.log(
  `Wrote ${summary.accepted_candidate_count.toLocaleString("en-US")} accepted import-wave candidates for ${summary.institution_count.toLocaleString("en-US")} institutions.`
);
