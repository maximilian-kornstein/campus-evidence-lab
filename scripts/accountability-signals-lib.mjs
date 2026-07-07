export const SIGNAL_PUBLIC_USE_LIMITS = [
  "Accountability Signals describe source basis, response evidence, correction posture, and unresolved limits.",
  "They are not rankings, safety scores, severity scores, prevalence estimates, or legal findings.",
  "Accepted import-wave QA candidates are not individual human certification of every row."
];

const PROHIBITED_SIGNAL_PATTERN =
  /\b(high risk|low risk|dangerous|safe|noncompliant|bad actor|best|worst|score|grade|rating|safety score|severity score|prevalence|legal finding)s?\b/gi;

export function hasProhibitedSignalLanguage(value) {
  const text = String(value ?? "");
  PROHIBITED_SIGNAL_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_SIGNAL_PATTERN)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 140), match.index ?? 0).toLowerCase();
    const sameClause = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
    if (/\b(?:not|no|without|never|must not|is not|are not|do not|does not|they are not)\b/.test(sameClause)) continue;
    return true;
  }
  return false;
}

function countValues(values) {
  const counts = {};
  for (const value of values) {
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function summaryRows(institutionImportWaveSummary = {}) {
  if (Array.isArray(institutionImportWaveSummary.institutions)) return institutionImportWaveSummary.institutions;
  if (institutionImportWaveSummary.schools && typeof institutionImportWaveSummary.schools === "object") {
    return Object.values(institutionImportWaveSummary.schools);
  }
  return [];
}

function eventSourceFamilies(events, sourcesById) {
  const families = [];
  for (const event of events) {
    for (const sourceId of event.source_ids ?? []) {
      const source = sourcesById.get(sourceId);
      families.push(source?.source_family ?? source?.source_type ?? source?.publisher ?? "unknown_public_source");
    }
  }
  return countValues(families);
}

function responseEvidence(events) {
  const depths = countValues(events.map((event) => event.response_depth ?? "missing_response_depth"));
  const hasDirect = Object.keys(depths).some((depth) => /^direct_institution/.test(depth));
  const hasAgency = depths.agency_described_institutional_action > 0;
  const hasLimited = depths.limited_public_response_note > 0;

  if (hasDirect) {
    return {
      status: "direct_institution_response_evidence_present",
      label: "institution response evidence present",
      response_depth_counts: depths
    };
  }
  if (hasAgency) {
    return {
      status: "agency_described_response_evidence_present",
      label: "agency-described institution response evidence present",
      response_depth_counts: depths
    };
  }
  if (hasLimited) {
    return {
      status: "limited_public_response_notes_present",
      label: "limited public response notes present",
      response_depth_counts: depths
    };
  }
  return {
    status: "no_response_evidence_in_current_snapshot",
    label: "current snapshot has no institution response evidence",
    response_depth_counts: depths
  };
}

function correctionEvidence(events, corrections = []) {
  const eventIds = new Set(events.map((event) => event.id));
  const matched = corrections.filter((correction) => eventIds.has(correction.event_id));
  return {
    status: matched.length ? "correction_records_present" : "correction_path_available",
    label: matched.length ? "correction records present in current snapshot" : "correction and right-of-reply path available",
    correction_count: matched.length
  };
}

function signal(id, label, detail, count = null) {
  return { id, label, detail, ...(count === null ? {} : { count }) };
}

function limitsFor({ publicEventCount, acceptedCandidateCount, response, sourceFamilyCounts }) {
  const limits = [...SIGNAL_PUBLIC_USE_LIMITS];
  if (!publicEventCount) limits.push("The current snapshot has no public event records for this institution.");
  if (!acceptedCandidateCount) limits.push("The current snapshot has no accepted import-wave QA candidates for this institution.");
  if (response.status === "no_response_evidence_in_current_snapshot") {
    limits.push("No institution response evidence appears in the current snapshot; this does not claim no response exists outside the dataset.");
  }
  if (Object.keys(sourceFamilyCounts).length === 0) {
    limits.push("No source-family mix is available for this institution in the current snapshot.");
  }
  return limits;
}

export function buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections = [], manifest = {} }) {
  const eventsBySchool = new Map();
  for (const event of events ?? []) {
    if (!eventsBySchool.has(event.school_id)) eventsBySchool.set(event.school_id, []);
    eventsBySchool.get(event.school_id).push(event);
  }

  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
  const summariesBySchool = new Map(summaryRows(institutionImportWaveSummary).map((row) => [row.school_id, row]));

  const institutions = (schools ?? [])
    .map((school) => {
      const schoolEvents = eventsBySchool.get(school.id) ?? [];
      const summary = summariesBySchool.get(school.id) ?? {};
      const publicEventCount = schoolEvents.length;
      const acceptedCandidateCount = summary.accepted_candidate_count ?? 0;
      const importSourceFamilyCounts = summary.source_family_counts ?? {};
      const publicEventSourceFamilyCounts = eventSourceFamilies(schoolEvents, sourcesById);
      const sourceFamilyCounts = { ...publicEventSourceFamilyCounts };
      for (const [family, count] of Object.entries(importSourceFamilyCounts)) {
        sourceFamilyCounts[family] = (sourceFamilyCounts[family] ?? 0) + count;
      }
      const response = responseEvidence(schoolEvents);
      const correction = correctionEvidence(schoolEvents, corrections);
      const signals = [];

      if (publicEventCount) {
        signals.push(signal("source_backed_event_records", "source-backed event records present", "Public event records exist for this institution.", publicEventCount));
      }
      if (acceptedCandidateCount) {
        signals.push(
          signal(
            "accepted_official_source_qa_candidates",
            "accepted official-source QA candidates present",
            "Official-source rows passed deterministic import-wave QA for this institution.",
            acceptedCandidateCount
          )
        );
      }
      if (Object.keys(sourceFamilyCounts).length > 1) {
        signals.push(signal("multiple_official_source_families", "multiple official source families represented", "More than one public source family is represented."));
      }
      signals.push(signal(response.status, response.label, "Response evidence is limited to what appears in the current public snapshot."));
      signals.push(signal(correction.status, correction.label, "Correction and right-of-reply paths remain available for public-source updates.", correction.correction_count));

      if (!signals.length || (!publicEventCount && !acceptedCandidateCount)) {
        signals.push(signal("limited_current_snapshot", "known public-source limits remain", "The current snapshot has limited institution-specific public-source coverage."));
      }

      const unresolvedLimits = limitsFor({
        publicEventCount,
        acceptedCandidateCount,
        response,
        sourceFamilyCounts
      });

      return {
        school_id: school.id,
        name: school.name,
        city: school.city ?? null,
        state: school.state ?? null,
        public_event_count: publicEventCount,
        accepted_candidate_count: acceptedCandidateCount,
        source_family_counts: sourceFamilyCounts,
        record_lane_counts: summary.record_lane_counts ?? {},
        aggregate_stat_subtype_counts: summary.aggregate_stat_subtype_counts ?? {},
        import_wave_ids: summary.import_wave_ids ?? [],
        latest_record_year: summary.latest_record_year ?? summary.latest_source_year ?? null,
        response_evidence: response,
        correction_posture: correction,
        signals,
        unresolved_limits: unresolvedLimits,
        public_use_limits: SIGNAL_PUBLIC_USE_LIMITS,
        routes: {
          school: `/schools/${encodeURIComponent(school.id)}/`,
          api: `/api/v1/institutions/${encodeURIComponent(school.id)}.json`,
          citation_packet: `/api/v1/citation-packets/${encodeURIComponent(school.id)}.json`,
          correction: `/submit/`
        }
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.school_id.localeCompare(b.school_id));

  return {
    id: "accountability_signals_v1",
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? new Date().toISOString(),
    public_use_limits: SIGNAL_PUBLIC_USE_LIMITS,
    totals: {
      institutions: institutions.length,
      public_event_records: (events ?? []).length,
      accepted_import_wave_qa_candidates: institutionImportWaveSummary?.accepted_candidate_count ?? summaryRows(institutionImportWaveSummary).reduce((sum, row) => sum + (row.accepted_candidate_count ?? 0), 0)
    },
    institutions
  };
}

export function validateAccountabilitySignals({ artifact, schools, events, institutionImportWaveSummary }) {
  const errors = [];
  const schoolIds = new Set((schools ?? []).map((school) => school.id));
  const seen = new Set();
  const eventsBySchool = countValues((events ?? []).map((event) => event.school_id));
  const summariesBySchool = new Map(summaryRows(institutionImportWaveSummary).map((row) => [row.school_id, row]));

  if (artifact.id !== "accountability_signals_v1") errors.push("accountability signals id must be accountability_signals_v1");
  if (!artifact.snapshot_id) errors.push("accountability signals missing snapshot_id");
  if (!Array.isArray(artifact.public_use_limits) || artifact.public_use_limits.length === 0) errors.push("accountability signals missing public_use_limits");
  if ((artifact.institutions ?? []).length !== schoolIds.size) errors.push("accountability signals must include one row per school");

  for (const institution of artifact.institutions ?? []) {
    if (!schoolIds.has(institution.school_id)) errors.push(`unknown signal school_id: ${institution.school_id}`);
    if (seen.has(institution.school_id)) errors.push(`duplicate signal school_id: ${institution.school_id}`);
    seen.add(institution.school_id);

    if (institution.public_event_count !== (eventsBySchool[institution.school_id] ?? 0)) {
      errors.push(`${institution.school_id} public event count does not match events`);
    }
    if (institution.accepted_candidate_count !== (summariesBySchool.get(institution.school_id)?.accepted_candidate_count ?? 0)) {
      errors.push(`${institution.school_id} accepted candidate count does not match institution import-wave summary`);
    }

    const scan = JSON.stringify([institution.signals, institution.unresolved_limits, institution.public_use_limits]);
    if (hasProhibitedSignalLanguage(scan)) errors.push(`${institution.school_id} contains prohibited signal language`);
  }

  return errors;
}
