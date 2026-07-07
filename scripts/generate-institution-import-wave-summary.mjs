import { paths, writeJson } from "./lib.mjs";
import { loadInstitutionImportWaveSummary } from "./institution-import-wave-summary-lib.mjs";

const summary = await loadInstitutionImportWaveSummary();
await writeJson(paths.institutionImportWaveSummary, summary);

console.log(
  `Wrote ${summary.accepted_candidate_count.toLocaleString("en-US")} accepted import-wave candidates for ${summary.institution_count.toLocaleString("en-US")} institutions.`
);
