export const API_VERSION = "v1";

export const API_PUBLIC_USE_LIMITS = [
  "CEL API data is public-source infrastructure, not rankings, safety scores, severity scores, prevalence estimates, or legal findings.",
  "Accepted import-wave QA candidates are official-source rows that passed deterministic QA; they are not individual human certification.",
  "Public event records remain separate from accepted import-wave QA candidates."
];

const PRIVATE_FIELD_PATTERN = /(^|[_\W])(private|email|phone|raw_quarantine|raw_private|sensitive)([_\W]|$)/i;

export function hasPrivateApiField(key) {
  return PRIVATE_FIELD_PATTERN.test(String(key ?? ""));
}

function sourceFamilyCountsFromEvents(events, sourcesById) {
  const counts = {};
  for (const event of events) {
    for (const sourceId of event.source_ids ?? []) {
      const source = sourcesById.get(sourceId);
      const family = source?.source_family ?? source?.source_type ?? source?.publisher ?? "unknown_public_source";
      counts[family] = (counts[family] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compactInstitution(row) {
  return {
    school_id: row.school_id,
    name: row.name,
    city: row.city,
    state: row.state,
    public_event_count: row.public_event_count,
    accepted_candidate_count: row.accepted_candidate_count,
    signal_labels: (row.signals ?? []).map((signal) => signal.label),
    routes: row.routes
  };
}

function eventSummary(event) {
  return {
    id: event.id,
    date: event.date,
    category: event.category,
    record_hash: event.record_hash,
    source_ids: event.source_ids ?? [],
    route: `/events/${encodeURIComponent(event.id)}/`
  };
}

function sourceSummary(source) {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    source_type: source.source_type,
    route: `/sources/${encodeURIComponent(source.id)}/`
  };
}

function importWaveSummary(wave) {
  return {
    id: wave.id,
    source_family: wave.source_family,
    record_lane: wave.record_lane ?? wave.source_manifest?.default_record_lane ?? null,
    aggregate_stat_subtype: wave.aggregate_stat_subtype ?? null,
    manifest_id: wave.manifest_id ?? wave.source_manifest?.id ?? null,
    generated_at: wave.generated_at ?? null,
    publishable: wave.publishable ?? wave.status === "publishable",
    status: wave.status,
    attempted_count: wave.attempted_count ?? 0,
    accepted_count: wave.accepted_count ?? 0,
    duplicate_count: wave.duplicate_count ?? 0,
    excluded_count: wave.excluded_count ?? 0,
    quarantined_count: wave.quarantined_count ?? 0,
    default_review_tier: wave.source_manifest?.default_review_tier ?? "imported_public_source",
    public_claim_limit: wave.public_claim_limit ?? null,
    route: `/import-waves/${encodeURIComponent(wave.id)}/`
  };
}

function sortedEntries(counts = {}) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildSourceFamilies({ events, sources, importWaves, accountabilitySignals }) {
  const sourceFamilies = {};
  for (const source of sources ?? []) {
    const family = source.source_family ?? source.source_type ?? source.publisher ?? "unknown_public_source";
    sourceFamilies[family] ??= { source_family: family, public_event_source_references: 0, accepted_candidate_count: 0, import_wave_count: 0 };
  }
  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
  for (const event of events ?? []) {
    for (const sourceId of event.source_ids ?? []) {
      const source = sourcesById.get(sourceId);
      const family = source?.source_family ?? source?.source_type ?? source?.publisher ?? "unknown_public_source";
      sourceFamilies[family] ??= { source_family: family, public_event_source_references: 0, accepted_candidate_count: 0, import_wave_count: 0 };
      sourceFamilies[family].public_event_source_references += 1;
    }
  }
  for (const [family, count] of sortedEntries(accountabilitySignals?.totals?.source_family_counts ?? {})) {
    sourceFamilies[family] ??= { source_family: family, public_event_source_references: 0, accepted_candidate_count: 0, import_wave_count: 0 };
    sourceFamilies[family].accepted_candidate_count += count;
  }
  for (const wave of importWaves ?? []) {
    const family = wave.source_family ?? "unknown_source_family";
    sourceFamilies[family] ??= { source_family: family, public_event_source_references: 0, accepted_candidate_count: 0, import_wave_count: 0 };
    sourceFamilies[family].accepted_candidate_count += wave.accepted_count ?? 0;
    sourceFamilies[family].import_wave_count += 1;
  }
  return {
    api_version: API_VERSION,
    public_use_limits: API_PUBLIC_USE_LIMITS,
    source_families: Object.values(sourceFamilies).sort((a, b) => b.accepted_candidate_count - a.accepted_candidate_count || a.source_family.localeCompare(b.source_family))
  };
}

function mapBySchool(events) {
  const bySchool = new Map();
  for (const event of events ?? []) {
    if (!bySchool.has(event.school_id)) bySchool.set(event.school_id, []);
    bySchool.get(event.school_id).push(event);
  }
  return bySchool;
}

export function buildApiV1Payloads({ manifest, schools, events, sources, importWaves, accountabilitySignals }) {
  const signalsBySchool = new Map((accountabilitySignals.institutions ?? []).map((row) => [row.school_id, row]));
  const eventsBySchool = mapBySchool(events);
  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  const waveSummaries = (importWaves ?? []).map(importWaveSummary).sort((a, b) => a.id.localeCompare(b.id));
  const institutionDetails = new Map();
  const citationPackets = new Map();

  const index = {
    api_version: API_VERSION,
    generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
    snapshot_id: manifest.snapshot_id,
    snapshot_hashes: manifest.hashes ?? {},
    public_use_limits: API_PUBLIC_USE_LIMITS,
    endpoints: [
      "/api/v1/index.json",
      "/api/v1/snapshot.json",
      "/api/v1/institutions/index.json",
      "/api/v1/source-families.json",
      "/api/v1/import-waves.json",
      "/api/v1/institutions/{school_id}.json",
      "/api/v1/citation-packets/{school_id}.json"
    ]
  };

  const snapshot = {
    api_version: API_VERSION,
    generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
    snapshot_id: manifest.snapshot_id,
    schema_version: manifest.schema_version,
    totals: {
      ...(manifest.totals ?? {}),
      accepted_import_wave_qa_candidates: accountabilitySignals.totals?.accepted_import_wave_qa_candidates ?? 0,
      accountability_signal_institutions: accountabilitySignals.totals?.institutions ?? 0
    },
    hashes: manifest.hashes ?? {},
    public_use_limits: API_PUBLIC_USE_LIMITS
  };

  for (const school of schools ?? []) {
    const signalRow = signalsBySchool.get(school.id);
    const schoolEvents = eventsBySchool.get(school.id) ?? [];
    const sourceIds = [...new Set(schoolEvents.flatMap((event) => event.source_ids ?? []))].sort();
    const detail = {
      api_version: API_VERSION,
      generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
      snapshot_id: manifest.snapshot_id,
      school_id: school.id,
      name: school.name,
      city: school.city ?? null,
      state: school.state ?? null,
      public_event_count: signalRow?.public_event_count ?? schoolEvents.length,
      accepted_candidate_count: signalRow?.accepted_candidate_count ?? 0,
      source_family_counts: signalRow?.source_family_counts ?? sourceFamilyCountsFromEvents(schoolEvents, sourceById),
      record_lane_counts: signalRow?.record_lane_counts ?? {},
      import_wave_ids: signalRow?.import_wave_ids ?? [],
      accountability_signals: signalRow?.signals ?? [],
      response_evidence: signalRow?.response_evidence ?? null,
      correction_posture: signalRow?.correction_posture ?? null,
      unresolved_limits: signalRow?.unresolved_limits ?? [],
      public_use_limits: signalRow?.public_use_limits ?? API_PUBLIC_USE_LIMITS,
      event_ids: schoolEvents.map((event) => event.id).sort(),
      source_ids: sourceIds,
      routes: {
        school: `/schools/${encodeURIComponent(school.id)}/`,
        accountability_room: `/schools/${encodeURIComponent(school.id)}/`,
        api: `/api/v1/institutions/${encodeURIComponent(school.id)}.json`,
        citation_packet: `/api/v1/citation-packets/${encodeURIComponent(school.id)}.json`,
        correction: "/submit/"
      }
    };
    institutionDetails.set(school.id, detail);

    citationPackets.set(school.id, {
      api_version: API_VERSION,
      generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
      snapshot_id: manifest.snapshot_id,
      school_id: school.id,
      name: school.name,
      public_use_limits: API_PUBLIC_USE_LIMITS,
      events: schoolEvents.map(eventSummary).sort((a, b) => a.id.localeCompare(b.id)),
      sources: sourceIds.map((sourceId) => sourceById.get(sourceId)).filter(Boolean).map(sourceSummary),
      source_locators: schoolEvents
        .filter((event) => event.source_locator)
        .map((event) => ({ event_id: event.id, source_locator: event.source_locator })),
      routes: {
        institution_api: `/api/v1/institutions/${encodeURIComponent(school.id)}.json`,
        school: `/schools/${encodeURIComponent(school.id)}/`,
        correction: "/submit/"
      }
    });
  }

  const institutionsIndex = {
    api_version: API_VERSION,
    generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
    snapshot_id: manifest.snapshot_id,
    public_use_limits: API_PUBLIC_USE_LIMITS,
    institutions: (accountabilitySignals.institutions ?? []).map(compactInstitution)
  };

  return {
    index,
    snapshot,
    institutionsIndex,
    sourceFamilies: {
      ...buildSourceFamilies({ events, sources, importWaves, accountabilitySignals }),
      generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
      snapshot_id: manifest.snapshot_id
    },
    importWaves: {
      api_version: API_VERSION,
      generated_at: accountabilitySignals.generated_at ?? manifest.created_at,
      snapshot_id: manifest.snapshot_id,
      public_use_limits: API_PUBLIC_USE_LIMITS,
      import_waves: waveSummaries
    },
    institutionDetails,
    citationPackets
  };
}

function walkForPrivateFields(value, path = []) {
  const errors = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => errors.push(...walkForPrivateFields(item, [...path, String(index)])));
    return errors;
  }
  if (!value || typeof value !== "object") return errors;
  const entries = value instanceof Map ? value.entries() : Object.entries(value);
  for (const [key, nested] of entries) {
    if (hasPrivateApiField(key)) errors.push(`private API field found at ${[...path, key].join(".")}`);
    errors.push(...walkForPrivateFields(nested, [...path, key]));
  }
  return errors;
}

export function validateApiV1Payloads(payloads) {
  const errors = [];
  for (const [name, payload] of Object.entries(payloads ?? {})) {
    if (payload instanceof Map) {
      for (const [id, detail] of payload.entries()) {
        if (detail.api_version !== API_VERSION) errors.push(`${name}.${id} api_version must be ${API_VERSION}`);
        if (!Array.isArray(detail.public_use_limits) || detail.public_use_limits.length === 0) errors.push(`${name}.${id} missing public_use_limits`);
      }
      continue;
    }
    if (payload?.api_version !== API_VERSION) errors.push(`${name} api_version must be ${API_VERSION}`);
    if (!Array.isArray(payload?.public_use_limits) || payload.public_use_limits.length === 0) errors.push(`${name} missing public_use_limits`);
  }
  errors.push(...walkForPrivateFields(payloads));
  return errors;
}
