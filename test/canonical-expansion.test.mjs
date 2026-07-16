import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_EXPANSION_MAX_PER_SCHOOL,
  aggregateCount,
  candidateEligibility,
  candidateToCanonicalEvent,
  canonicalEventId,
  parseAggregateLocator,
  selectCanonicalCandidates,
  validateCanonicalExpansion
} from "../scripts/canonical-expansion-lib.mjs";

const candidate = (overrides = {}) => ({
  candidate_id: "cand_ed_arrest_1234567890abcdef12",
  manifest_id: "manifest_ed_campus_safety_dataset",
  source_family: "ed_campus_safety_dataset",
  record_lane: "aggregate_safety_stat",
  source_url: "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip",
  source_locator: "Noncampusarrest222324.xls > Noncampusarrest222324 > row 2 > column WEAPON24 > cell T2 > institution=Example University > scope=noncampus > year=2024 > statistic=Weapons law arrests",
  school_id: "example_university",
  institution_name: "Example University",
  date: "2024-01-01",
  date_precision: "year",
  category: "Official aggregate safety statistic",
  affected_communities: ["Campus community"],
  summary: "ED Campus Safety data listed 2 reported noncampus arrest aggregate statistics for Example University in 2024: Weapons law arrests.",
  raw_source_hash: `sha256:${"a".repeat(64)}`,
  aggregate_stat_subtype: "arrest_stat",
  import_notes: "Imported from official ED Campus Safety and Security aggregate data.",
  ...overrides
});

test("aggregate locators and positive values parse exactly", () => {
  const parsed = parseAggregateLocator(candidate().source_locator);
  assert.deepEqual(parsed, { workbook: "Noncampusarrest222324.xls", sheet: "Noncampusarrest222324", row: 2, column: "WEAPON24", cell: "T2", institution: "Example University", scope: "noncampus", year: "2024", statistic: "Weapons law arrests" });
  assert.equal(aggregateCount(candidate()), 2);
  assert.equal(parseAggregateLocator(candidate({ source_locator: candidate().source_locator.replace("T2", "T3") }).source_locator), null);
});

test("eligibility rejects boundary, source, identity, and count failures", () => {
  const schools = new Set(["example_university"]);
  assert.equal(candidateEligibility(candidate(), schools).eligible, true);
  assert.ok(candidateEligibility(candidate({ source_url: "https://example.com/not-official.zip" }), schools).reasons.includes("wrong_source_release"));
  assert.ok(candidateEligibility(candidate({ institution_name: "Other University" }), schools).reasons.includes("institution_locator_mismatch"));
  assert.ok(candidateEligibility(candidate({ summary: candidate().summary.replace("2 reported", "0 reported") }), schools).reasons.includes("invalid_positive_count"));
  assert.ok(candidateEligibility(candidate({ summary: `${candidate().summary} This proves prevalence.` }), schools).reasons.includes("prohibited_claim_language"));
});

test("selection is deterministic and enforces the per-school cap", () => {
  const schools = [{ id: "example_university" }, { id: "second_university" }];
  const rows = Array.from({ length: 8 }, (_, index) => candidate({
    candidate_id: `cand_ed_arrest_${String(index).padStart(18, "0")}`,
    school_id: index < 5 ? "example_university" : "second_university",
    institution_name: index < 5 ? "Example University" : "Second University",
    source_locator: candidate().source_locator
      .replace("Example University", index < 5 ? "Example University" : "Second University")
      .replace("T2", `${String.fromCharCode(84 + index)}2`)
  }));
  const first = selectCanonicalCandidates({ candidates: rows, schools, limit: 4 }).selected.map((row) => row.candidate.candidate_id);
  const second = selectCanonicalCandidates({ candidates: [...rows].reverse(), schools, limit: 4 }).selected.map((row) => row.candidate.candidate_id);
  assert.deepEqual(first, second);
  const selectedRows = selectCanonicalCandidates({ candidates: rows, schools, limit: 4 }).selected;
  const counts = new Map();
  for (const row of selectedRows) counts.set(row.candidate.school_id, (counts.get(row.candidate.school_id) ?? 0) + 1);
  assert.ok([...counts.values()].every((count) => count <= CANONICAL_EXPANSION_MAX_PER_SCHOOL));
});

test("promoted records preserve exact calculations and bounded claims", () => {
  const decision = { candidate: candidate(), ...candidateEligibility(candidate(), new Set(["example_university"])) };
  const event = candidateToCanonicalEvent({ row: decision, index: 0, school: { city: "Example City", state: "NY" } });
  assert.equal(event.id, canonicalEventId(0));
  assert.equal(event.aggregate_calculation.value, 2);
  assert.equal(event.review_tier, "source_family_checked");
  assert.match(event.description, /not an incident, allegation, adjudication, or finding/);
  const fabricated = Array.from({ length: 6000 }, (_, index) => ({ ...event, id: canonicalEventId(index), candidate_id: `candidate_${index}`, school_id: `school_${Math.floor(index / 2)}`, source_locators: [{ ...event.source_locators[0], locator: `${event.source_locators[0].locator}#${index}` }] }));
  assert.deepEqual(validateCanonicalExpansion(fabricated), []);
});
