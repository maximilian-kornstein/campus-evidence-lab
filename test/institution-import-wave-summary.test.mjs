import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";
import { buildInstitutionImportWaveSummary, loadInstitutionImportWaveSummary } from "../scripts/institution-import-wave-summary-lib.mjs";

test("builds public-safe institution summaries for accepted import-wave candidates", async () => {
  const summary = await loadInstitutionImportWaveSummary();

  assert.equal(summary.accepted_candidate_count, 150000);
  assert.equal(summary.source_family_counts.ed_campus_safety_dataset, 148690);
  assert.equal(summary.source_family_counts.ocr_open_investigation, 1310);
  assert.equal(summary.record_lane_counts.aggregate_safety_stat, 148690);
  assert.equal(summary.record_lane_counts.civil_rights_case, 1310);
  assert.ok(summary.institution_count > 5000);

  const brown = summary.schools.brown_university;
  assert.equal(brown.school_id, "brown_university");
  assert.ok(brown.accepted_candidate_count > 0);
  assert.deepEqual(Object.keys(brown).sort(), [
    "accepted_candidate_count",
    "aggregate_stat_subtype_counts",
    "import_wave_ids",
    "latest_record_year",
    "record_lane_counts",
    "school_id",
    "source_family_counts"
  ]);
  assert.ok(!JSON.stringify(brown).includes("source_locator"));
  assert.ok(!JSON.stringify(brown).includes("raw_source_hash"));
});

test("summary totals match committed import-wave reports", async () => {
  const summary = await loadInstitutionImportWaveSummary();
  const waveFiles = (await readdir(path.join(rootDir, "data", "import-waves"))).filter((name) => name.endsWith(".json"));
  let accepted = 0;

  for (const file of waveFiles) {
    const wave = JSON.parse(await readFile(path.join(rootDir, "data", "import-waves", file), "utf8"));
    accepted += wave.accepted_count;
  }

  assert.equal(summary.accepted_candidate_count, accepted);
});

test("summary builder rejects accepted candidates without school identity", () => {
  const waves = [
    {
      id: "wave-001",
      status: "publishable",
      source_family: "ed_campus_safety_dataset",
      record_lane: "aggregate_safety_stat",
      accepted_candidate_ids: ["cand-001"],
      accepted_count: 1
    }
  ];
  const candidatesByWaveId = new Map([
    [
      "wave-001",
      [
        {
          candidate_id: "cand-001",
          source_family: "ed_campus_safety_dataset",
          record_lane: "aggregate_safety_stat",
          date: "2024-01-01"
        }
      ]
    ]
  ]);

  assert.throws(
    () => buildInstitutionImportWaveSummary({ waves, candidatesByWaveId, generatedAt: "2026-07-07T00:00:00.000Z" }),
    /missing school_id/
  );
});
