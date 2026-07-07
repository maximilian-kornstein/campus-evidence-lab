import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { paths } from "./lib.mjs";

function increment(counts, key, amount = 1) {
  const normalizedKey = key || "unknown";
  counts[normalizedKey] = (counts[normalizedKey] ?? 0) + amount;
}

function sortedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sortedSchools(schools) {
  return Object.fromEntries(
    Object.entries(schools)
      .sort((a, b) => b[1].accepted_candidate_count - a[1].accepted_candidate_count || a[0].localeCompare(b[0]))
      .map(([schoolId, summary]) => [
        schoolId,
        {
          school_id: summary.school_id,
          accepted_candidate_count: summary.accepted_candidate_count,
          source_family_counts: sortedCounts(summary.source_family_counts),
          record_lane_counts: sortedCounts(summary.record_lane_counts),
          aggregate_stat_subtype_counts: sortedCounts(summary.aggregate_stat_subtype_counts),
          import_wave_ids: [...summary.import_wave_ids].sort(),
          latest_record_year: summary.latest_record_year
        }
      ])
  );
}

function requireCandidateField(candidate, field, waveId) {
  if (!candidate?.[field]) {
    throw new Error(`Accepted candidate ${candidate?.candidate_id ?? "unknown"} in ${waveId} missing ${field}`);
  }
}

export function buildInstitutionImportWaveSummary({ waves, candidatesByWaveId, generatedAt = new Date().toISOString() }) {
  const summary = {
    generated_at: generatedAt,
    accepted_candidate_count: 0,
    institution_count: 0,
    source_family_counts: {},
    record_lane_counts: {},
    aggregate_stat_subtype_counts: {},
    schools: {}
  };

  for (const wave of [...waves].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (wave.status !== "publishable") continue;
    const acceptedIds = new Set(wave.accepted_candidate_ids ?? []);
    const candidates = candidatesByWaveId.get(wave.id) ?? [];
    let acceptedInWave = 0;

    for (const candidate of candidates) {
      if (!acceptedIds.has(candidate.candidate_id)) continue;

      requireCandidateField(candidate, "candidate_id", wave.id);
      requireCandidateField(candidate, "school_id", wave.id);
      requireCandidateField(candidate, "source_family", wave.id);
      requireCandidateField(candidate, "record_lane", wave.id);

      const schoolId = candidate.school_id;
      const sourceFamily = candidate.source_family;
      const recordLane = candidate.record_lane;
      const aggregateSubtype = candidate.aggregate_stat_subtype || "not_applicable";
      const recordYear = /^\d{4}/.test(candidate.date ?? "") ? candidate.date.slice(0, 4) : "";

      summary.accepted_candidate_count += 1;
      acceptedInWave += 1;
      increment(summary.source_family_counts, sourceFamily);
      increment(summary.record_lane_counts, recordLane);
      increment(summary.aggregate_stat_subtype_counts, aggregateSubtype);

      const school = (summary.schools[schoolId] ??= {
        school_id: schoolId,
        accepted_candidate_count: 0,
        source_family_counts: {},
        record_lane_counts: {},
        aggregate_stat_subtype_counts: {},
        import_wave_ids: new Set(),
        latest_record_year: ""
      });

      school.accepted_candidate_count += 1;
      increment(school.source_family_counts, sourceFamily);
      increment(school.record_lane_counts, recordLane);
      increment(school.aggregate_stat_subtype_counts, aggregateSubtype);
      school.import_wave_ids.add(wave.id);
      if (recordYear && recordYear > school.latest_record_year) school.latest_record_year = recordYear;
    }

    if (acceptedInWave !== wave.accepted_count) {
      throw new Error(`Wave ${wave.id} accepted ${acceptedInWave} candidate rows, expected ${wave.accepted_count}`);
    }
  }

  summary.institution_count = Object.keys(summary.schools).length;
  summary.source_family_counts = sortedCounts(summary.source_family_counts);
  summary.record_lane_counts = sortedCounts(summary.record_lane_counts);
  summary.aggregate_stat_subtype_counts = sortedCounts(summary.aggregate_stat_subtype_counts);
  summary.schools = sortedSchools(summary.schools);

  return summary;
}

async function readJsonFilesFromDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => JSON.parse(await readFile(path.join(dir, entry.name), "utf8")))
  );
}

export async function loadInstitutionImportWaveSummary({ generatedAt = new Date().toISOString() } = {}) {
  const waves = await readJsonFilesFromDir(paths.importWavesDir);
  const candidatesByWaveId = new Map();

  for (const wave of waves) {
    const candidatePath = path.join(paths.importCandidatesDir, `${wave.id}.json`);
    const candidates = JSON.parse(await readFile(candidatePath, "utf8"));
    candidatesByWaveId.set(wave.id, candidates);
  }

  return buildInstitutionImportWaveSummary({ waves, candidatesByWaveId, generatedAt });
}
