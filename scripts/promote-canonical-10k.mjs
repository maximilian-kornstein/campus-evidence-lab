import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  CANONICAL_EXPANSION_BASE_SIZE,
  CANONICAL_EXPANSION_BATCH_SIZE,
  CANONICAL_EXPANSION_DATE,
  CANONICAL_EXPANSION_ID,
  CANONICAL_EXPANSION_SIZE,
  candidateToCanonicalEvent,
  canonicalExpansionDigest,
  selectCanonicalCandidates,
  validateCanonicalExpansion
} from "./canonical-expansion-lib.mjs";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";

const candidateFiles = (await readdir(paths.importCandidatesDir)).filter((name) => name.endsWith(".json")).sort();
const candidateArrays = await Promise.all(candidateFiles.map((name) => readJson(path.join(paths.importCandidatesDir, name))));
const candidates = candidateArrays.flat();
const [existingEvents, schools, existingBriefs] = await Promise.all([readJson(paths.events), readJson(paths.schools), readJson(paths.briefs)]);
const baseEvents = existingEvents.filter((event) => event.expansion_id !== CANONICAL_EXPANSION_ID);
if (baseEvents.length !== CANONICAL_EXPANSION_BASE_SIZE) throw new Error(`Expected ${CANONICAL_EXPANSION_BASE_SIZE} base events; found ${baseEvents.length}`);

const { selected, rejected, eligible_count: eligibleCount } = selectCanonicalCandidates({ candidates, schools });
const schoolMap = new Map(schools.map((school) => [school.id, school]));
const expansionEvents = selected.map((row, index) => candidateToCanonicalEvent({ row, index, school: schoolMap.get(row.candidate.school_id) }));
const expansionErrors = validateCanonicalExpansion(expansionEvents);
if (expansionErrors.length) throw new Error(`Canonical expansion failed:\n- ${expansionErrors.join("\n- ")}`);

const allEvents = [...baseEvents, ...expansionEvents];
const batchDir = path.join(rootDir, "data", "canonical-expansion-batches");
await rm(batchDir, { recursive: true, force: true });
await writeJson(paths.events, allEvents);
const expansionBriefId = "brief_2026_07_16_canonical_10k_expansion";
const baseBriefs = existingBriefs.filter((brief) => brief.id !== expansionBriefId);
await writeJson(paths.briefs, [...baseBriefs, {
  id: expansionBriefId,
  title: "Canonical Expansion: 10,000 Public Records",
  week_start: "2026-07-13",
  week_end: "2026-07-19",
  published_date: CANONICAL_EXPANSION_DATE,
  summary: "Campus Evidence Lab expanded from 4,000 to 10,000 canonical public records by promoting 6,000 official Department of Education aggregate statistics with exact workbook-cell provenance and conservative claim boundaries.",
  brief_type: "Dataset release",
  analysis_points: [
    "The expansion adds official aggregate statistical records and does not recast them as incidents, cases, allegations, prevalence estimates, trends, rankings, or findings about institutional conduct.",
    "Each promoted record retains its accepted candidate identity, official release URL, workbook, sheet, row, semantic column, exact cell, institution, year, scope, statistic, and positive numeric value.",
    "The expansion uses the source-family checked review tier; it does not auto-upgrade the new records into internal certification or outside review."
  ],
  responsible_uses: [
    "Use the records as source-traceable institution-level context and open the cited workbook locator before relying on the numeric value.",
    "Keep aggregate statistical records separate from incident narratives, case files, rankings, prevalence claims, and comparative judgments.",
    "Use the public correction route and verification receipt to challenge any identity, locator, or transcription mismatch."
  ],
  research_questions: [
    "Does the official workbook cell reproduce the institution, year, scope, statistic, and value shown in the canonical record?",
    "How can these aggregate records support reporting without implying incident prevalence or comparative campus safety?",
    "Which records should advance from source-family checked status into a bounded internal or outside review process?"
  ],
  methods_note: "The deterministic selection ranks eligible Crime2025 candidate IDs by SHA-256, caps selection at two records per institution, and takes the first 6,000. Exact source-cell verification is a transcription and provenance check, not a truth, safety, prevalence, endorsement, or legal claim.",
  new_event_ids: expansionEvents.map((event) => event.id),
  updated_event_ids: [],
  correction_ids: [],
  snapshot_hash: ""
}]);

const batches = [];
for (let offset = 0; offset < expansionEvents.length; offset += CANONICAL_EXPANSION_BATCH_SIZE) {
  const records = expansionEvents.slice(offset, offset + CANONICAL_EXPANSION_BATCH_SIZE);
  const batchId = `${CANONICAL_EXPANSION_ID}_batch_${String(batches.length + 1).padStart(3, "0")}`;
  const artifact = {
    batch_id: batchId,
    expansion_id: CANONICAL_EXPANSION_ID,
    generated_at: CANONICAL_EXPANSION_DATE,
    selection_method: "SHA-256 rank of candidate_id; maximum two records per institution; first 6,000 eligible Crime2025 official-source candidates.",
    review_tier: "source_family_checked",
    claim_boundary: "Batch membership verifies deterministic promotion and structured provenance; it does not confer individual human certification, external review, or a safety/prevalence interpretation.",
    record_count: records.length,
    record_ids: records.map((event) => event.id),
    candidate_ids: records.map((event) => event.candidate_id)
  };
  await writeJson(path.join(batchDir, `${batchId}.json`), artifact);
  batches.push({ batch_id: batchId, path: `data/canonical-expansion-batches/${batchId}.json`, record_count: records.length, first_record_id: records[0].id, last_record_id: records.at(-1).id });
}

const distinctSchools = new Set(expansionEvents.map((event) => event.school_id));
const manifest = {
  expansion_id: CANONICAL_EXPANSION_ID,
  generated_at: CANONICAL_EXPANSION_DATE,
  source_release: "Crime2025EXCEL.zip",
  source_url: selected[0].candidate.source_url,
  source_verification_status: "pending_direct_workbook_verification",
  selection: {
    eligible_candidate_count: eligibleCount,
    rejected_candidate_count: rejected.length,
    selected_record_count: expansionEvents.length,
    distinct_institution_count: distinctSchools.size,
    maximum_records_per_institution: 2,
    deterministic_digest: canonicalExpansionDigest(expansionEvents)
  },
  totals: { before: baseEvents.length, added: CANONICAL_EXPANSION_SIZE, after: allEvents.length },
  review_tier: "source_family_checked",
  claim_boundary: "These are official aggregate statistical records with exact locators. They are not incident records, prevalence estimates, rankings, findings of wrongdoing, individual human certifications, or external reviews.",
  batches
};
await writeJson(path.join(rootDir, "data", "canonical-expansion-10k.json"), manifest);
console.log(JSON.stringify(manifest, null, 2));
