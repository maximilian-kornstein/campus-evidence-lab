import { sha256 } from "./lib.mjs";

export const ED_CAMPUS_SAFETY_MANIFEST_ID = "manifest_ed_campus_safety_dataset";
export const ED_CAMPUS_SAFETY_SOURCE_FAMILY = "ed_campus_safety_dataset";
export const ED_CAMPUS_SAFETY_2025_ZIP_URL = "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip";
export const ED_CAMPUS_SAFETY_2024_ZIP_URL = "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2024EXCEL.zip";
export const ED_CAMPUS_SAFETY_2023_ZIP_URL = "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2023EXCEL.zip";
export const ED_CAMPUS_SAFETY_RECORD_LANE = "aggregate_safety_stat";
export const ED_CAMPUS_SAFETY_CATEGORY = "Official aggregate safety statistic";
export const ED_CAMPUS_SAFETY_COMMUNITY = "Campus community";

const VAWA_STATISTICS = {
  DOMEST: "Domestic violence",
  DATING: "Dating violence",
  STALK: "Stalking"
};

const SEX_OFFENSE_CRIME_STATISTICS = {
  RAPE: "Rape",
  FONDL: "Fondling",
  INCES: "Incest",
  STATR: "Statutory rape"
};

const NON_SEX_CLERY_CRIME_STATISTICS = {
  MURD: "Murder/non-negligent manslaughter",
  NEGL_M: "Negligent manslaughter",
  ROBBE: "Robbery",
  AGG_A: "Aggravated assault",
  BURGLA: "Burglary",
  VEHIC: "Motor vehicle theft",
  ARSON: "Arson"
};

const ARREST_STATISTICS = {
  WEAPON: "Weapons law arrests",
  DRUG: "Drug law arrests",
  LIQUOR: "Liquor law arrests"
};

const DISCIPLINE_STATISTICS = {
  WEAPON: "Weapons law disciplinary referrals",
  DRUG: "Drug law disciplinary referrals",
  LIQUOR: "Liquor law disciplinary referrals"
};

export const ED_CAMPUS_SAFETY_PROFILES = {
  ed_vawa_2025: {
    id: "ed_vawa_2025",
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    workbook_pattern: /vawa222324\.xls$/i,
    statistic_map: VAWA_STATISTICS,
    year_suffixes: ["22", "23", "24"],
    candidate_prefix: "cand_ed_vawa",
    statistic_label: "VAWA aggregate statistic",
    statistic_label_plural: "VAWA aggregate statistics",
    summary_subject: "VAWA",
    aggregate_stat_subtype: "vawa_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_sex_offense_crime_2025: {
    id: "ed_sex_offense_crime_2025",
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    workbook_pattern: /crime222324\.xls$/i,
    statistic_map: SEX_OFFENSE_CRIME_STATISTICS,
    year_suffixes: ["22", "23", "24"],
    candidate_prefix: "cand_ed_crime",
    statistic_label: "sex-offense aggregate statistic",
    statistic_label_plural: "sex-offense aggregate statistics",
    summary_subject: "Clery sex-offense",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_clery_crime_non_sex_2025: {
    id: "ed_clery_crime_non_sex_2025",
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    workbook_pattern: /crime222324\.xls$/i,
    statistic_map: NON_SEX_CLERY_CRIME_STATISTICS,
    year_suffixes: ["22", "23", "24"],
    candidate_prefix: "cand_ed_clery_crime",
    statistic_label: "reported crime aggregate statistic",
    statistic_label_plural: "reported crime aggregate statistics",
    summary_subject: "Clery non-sex crime",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_arrest_2025: {
    id: "ed_arrest_2025",
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    workbook_pattern: /arrest222324\.xls$/i,
    statistic_map: ARREST_STATISTICS,
    year_suffixes: ["22", "23", "24"],
    candidate_prefix: "cand_ed_arrest",
    statistic_label: "arrest aggregate statistic",
    statistic_label_plural: "arrest aggregate statistics",
    summary_subject: "Clery arrest",
    aggregate_stat_subtype: "arrest_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_discipline_2025: {
    id: "ed_discipline_2025",
    source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
    workbook_pattern: /discipline222324\.xls$/i,
    statistic_map: DISCIPLINE_STATISTICS,
    year_suffixes: ["22", "23", "24"],
    candidate_prefix: "cand_ed_discipline",
    statistic_label: "disciplinary-referral aggregate statistic",
    statistic_label_plural: "disciplinary-referral aggregate statistics",
    summary_subject: "Clery disciplinary-referral",
    aggregate_stat_subtype: "disciplinary_referral_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_vawa_2021: {
    id: "ed_vawa_2021",
    source_url: ED_CAMPUS_SAFETY_2024_ZIP_URL,
    workbook_pattern: /vawa212223\.xls$/i,
    statistic_map: VAWA_STATISTICS,
    year_suffixes: ["21"],
    candidate_prefix: "cand_ed_vawa",
    statistic_label: "VAWA aggregate statistic",
    statistic_label_plural: "VAWA aggregate statistics",
    summary_subject: "VAWA",
    aggregate_stat_subtype: "vawa_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_sex_offense_crime_2021: {
    id: "ed_sex_offense_crime_2021",
    source_url: ED_CAMPUS_SAFETY_2024_ZIP_URL,
    workbook_pattern: /crime212223\.xls$/i,
    statistic_map: SEX_OFFENSE_CRIME_STATISTICS,
    year_suffixes: ["21"],
    candidate_prefix: "cand_ed_crime",
    statistic_label: "sex-offense aggregate statistic",
    statistic_label_plural: "sex-offense aggregate statistics",
    summary_subject: "Clery sex-offense",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_clery_crime_non_sex_2021: {
    id: "ed_clery_crime_non_sex_2021",
    source_url: ED_CAMPUS_SAFETY_2024_ZIP_URL,
    workbook_pattern: /crime212223\.xls$/i,
    statistic_map: NON_SEX_CLERY_CRIME_STATISTICS,
    year_suffixes: ["21"],
    candidate_prefix: "cand_ed_clery_crime",
    statistic_label: "reported crime aggregate statistic",
    statistic_label_plural: "reported crime aggregate statistics",
    summary_subject: "Clery non-sex crime",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_arrest_2021: {
    id: "ed_arrest_2021",
    source_url: ED_CAMPUS_SAFETY_2024_ZIP_URL,
    workbook_pattern: /arrest212223\.xls$/i,
    statistic_map: ARREST_STATISTICS,
    year_suffixes: ["21"],
    candidate_prefix: "cand_ed_arrest",
    statistic_label: "arrest aggregate statistic",
    statistic_label_plural: "arrest aggregate statistics",
    summary_subject: "Clery arrest",
    aggregate_stat_subtype: "arrest_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_discipline_2021: {
    id: "ed_discipline_2021",
    source_url: ED_CAMPUS_SAFETY_2024_ZIP_URL,
    workbook_pattern: /discipline212223\.xls$/i,
    statistic_map: DISCIPLINE_STATISTICS,
    year_suffixes: ["21"],
    candidate_prefix: "cand_ed_discipline",
    statistic_label: "disciplinary-referral aggregate statistic",
    statistic_label_plural: "disciplinary-referral aggregate statistics",
    summary_subject: "Clery disciplinary-referral",
    aggregate_stat_subtype: "disciplinary_referral_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_vawa_2020: {
    id: "ed_vawa_2020",
    source_url: ED_CAMPUS_SAFETY_2023_ZIP_URL,
    workbook_pattern: /vawa202122\.xls$/i,
    statistic_map: VAWA_STATISTICS,
    year_suffixes: ["20"],
    candidate_prefix: "cand_ed_vawa",
    statistic_label: "VAWA aggregate statistic",
    statistic_label_plural: "VAWA aggregate statistics",
    summary_subject: "VAWA",
    aggregate_stat_subtype: "vawa_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_sex_offense_crime_2020: {
    id: "ed_sex_offense_crime_2020",
    source_url: ED_CAMPUS_SAFETY_2023_ZIP_URL,
    workbook_pattern: /crime202122\.xls$/i,
    statistic_map: SEX_OFFENSE_CRIME_STATISTICS,
    year_suffixes: ["20"],
    candidate_prefix: "cand_ed_crime",
    statistic_label: "sex-offense aggregate statistic",
    statistic_label_plural: "sex-offense aggregate statistics",
    summary_subject: "Clery sex-offense",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_clery_crime_non_sex_2020: {
    id: "ed_clery_crime_non_sex_2020",
    source_url: ED_CAMPUS_SAFETY_2023_ZIP_URL,
    workbook_pattern: /crime202122\.xls$/i,
    statistic_map: NON_SEX_CLERY_CRIME_STATISTICS,
    year_suffixes: ["20"],
    candidate_prefix: "cand_ed_clery_crime",
    statistic_label: "reported crime aggregate statistic",
    statistic_label_plural: "reported crime aggregate statistics",
    summary_subject: "Clery non-sex crime",
    aggregate_stat_subtype: "reported_crime_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_arrest_2020: {
    id: "ed_arrest_2020",
    source_url: ED_CAMPUS_SAFETY_2023_ZIP_URL,
    workbook_pattern: /arrest202122\.xls$/i,
    statistic_map: ARREST_STATISTICS,
    year_suffixes: ["20"],
    candidate_prefix: "cand_ed_arrest",
    statistic_label: "arrest aggregate statistic",
    statistic_label_plural: "arrest aggregate statistics",
    summary_subject: "Clery arrest",
    aggregate_stat_subtype: "arrest_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  },
  ed_discipline_2020: {
    id: "ed_discipline_2020",
    source_url: ED_CAMPUS_SAFETY_2023_ZIP_URL,
    workbook_pattern: /discipline202122\.xls$/i,
    statistic_map: DISCIPLINE_STATISTICS,
    year_suffixes: ["20"],
    candidate_prefix: "cand_ed_discipline",
    statistic_label: "disciplinary-referral aggregate statistic",
    statistic_label_plural: "disciplinary-referral aggregate statistics",
    summary_subject: "Clery disciplinary-referral",
    aggregate_stat_subtype: "disciplinary_referral_stat",
    category: ED_CAMPUS_SAFETY_CATEGORY,
    affected_communities: [ED_CAMPUS_SAFETY_COMMUNITY]
  }
};

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeIdentity(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function profileForId(profileId = "ed_vawa_2025") {
  const profile = ED_CAMPUS_SAFETY_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown ED Campus Safety aggregate profile: ${profileId}`);
  return profile;
}

function sourceIdentifiersForSchool(school) {
  return {
    ed_unitids: [...new Set([...(school?.source_identifiers?.ed_unitids ?? []), ...(school?.ed_unitids ?? [])].map(String).filter(Boolean))],
    ed_opeids: [...new Set([...(school?.source_identifiers?.ed_opeids ?? []), ...(school?.ed_opeids ?? [])].map(String).filter(Boolean))]
  };
}

function schoolWithIdentifiers(school, row) {
  const identifiers = sourceIdentifiersForSchool(school);
  if (row?.unitid) identifiers.ed_unitids.push(String(row.unitid));
  if (row?.opeid) identifiers.ed_opeids.push(String(row.opeid));
  return {
    ...school,
    source_identifiers: {
      ...(school.source_identifiers ?? {}),
      ed_unitids: [...new Set(identifiers.ed_unitids)].sort(),
      ed_opeids: [...new Set(identifiers.ed_opeids)].sort()
    }
  };
}

function identityKeyForRow(row) {
  return [normalizeIdentity(row.institution_name), normalizeIdentity(row.city), normalizeIdentity(row.state)].join("|");
}

function identityKeyForSchool(school) {
  return [normalizeIdentity(school.name), normalizeIdentity(school.city), normalizeIdentity(school.state)].join("|");
}

function schoolLookup(schools = []) {
  const lookup = {
    byId: new Map(),
    byUnitid: new Map(),
    byIdentity: new Map(),
    byName: new Map()
  };

  for (const school of schools) {
    addSchoolToLookup(lookup, school);
  }

  return lookup;
}

function addSchoolToLookup(lookup, school) {
  lookup.byId.set(school.id, school);
  for (const unitid of sourceIdentifiersForSchool(school).ed_unitids) lookup.byUnitid.set(String(unitid), school);
  lookup.byIdentity.set(identityKeyForSchool(school), school);

  const nameKey = normalizeIdentity(school.name);
  if (!lookup.byName.has(nameKey)) lookup.byName.set(nameKey, []);
  const nameMatches = lookup.byName.get(nameKey);
  const existingIndex = nameMatches.findIndex((item) => item.id === school.id);
  if (existingIndex >= 0) {
    nameMatches[existingIndex] = school;
  } else {
    nameMatches.push(school);
  }
}

function resolveSchoolForRow(row, schools = []) {
  return resolveSchoolForRowWithLookup(row, schoolLookup(schools));
}

function resolveSchoolForRowWithLookup(row, lookup) {
  if (row.unitid && lookup.byUnitid.has(String(row.unitid))) return lookup.byUnitid.get(String(row.unitid));
  const identityMatch = lookup.byIdentity.get(identityKeyForRow(row));
  if (identityMatch) return identityMatch;
  if (row.school_id && lookup.byId.has(row.school_id)) {
    const idMatch = lookup.byId.get(row.school_id);
    if (!normalizeIdentity(row.city) && !normalizeIdentity(row.state)) return idMatch;
    if (identityKeyForSchool(idMatch) === identityKeyForRow(row)) return idMatch;
  }
  if (normalizeIdentity(row.city) || normalizeIdentity(row.state)) return null;
  const nameMatches = lookup.byName.get(normalizeIdentity(row.institution_name)) ?? [];
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function scopeForWorkbook(workbookName) {
  const name = workbookName.toLowerCase();
  if (name.startsWith("oncampus")) return "on-campus";
  if (name.startsWith("noncampus")) return "noncampus";
  if (name.startsWith("publicproperty")) return "public-property";
  if (name.startsWith("residencehall")) return "residence-hall";
  if (name.startsWith("reported")) return "reported";
  return "unknown";
}

function pluralizeStatistic(count, profile) {
  return count === 1 ? profile.statistic_label : profile.statistic_label_plural;
}

function statisticPatternForProfile(profile) {
  const codes = Object.keys(profile.statistic_map).map((code) => code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const years = profile.year_suffixes.map((year) => year.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`^(${codes})(${years})$`);
}

export function columnLetter(index) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

export function edCampusSafetyAggregateRowsFromSheet({ profileId = "ed_vawa_2025", workbookName, sheetRows = [] } = {}) {
  const profile = profileForId(profileId);
  const headers = (sheetRows[0] ?? []).map((header) => normalizeSpace(header));
  const sourceRows = [];
  const scope = scopeForWorkbook(workbookName);
  const statisticPattern = statisticPatternForProfile(profile);

  for (const [rowIndex, row] of sheetRows.slice(1).entries()) {
    const rowNumber = rowIndex + 2;
    const institutionName = normalizeSpace(row[headers.indexOf("INSTNM")]);
    const city = normalizeSpace(row[headers.indexOf("City")]);
    const state = normalizeSpace(row[headers.indexOf("State")]);
    if (!institutionName || !city || !state) continue;

    for (const [columnIndex, header] of headers.entries()) {
      const match = header.match(statisticPattern);
      if (!match) continue;

      const count = Number(row[columnIndex] || 0);
      if (!Number.isFinite(count) || count <= 0) continue;

      const column = columnLetter(columnIndex);
      sourceRows.push({
        profile_id: profile.id,
        record_lane: ED_CAMPUS_SAFETY_RECORD_LANE,
        source_url: profile.source_url,
        workbook: workbookName,
        sheet: workbookName.replace(/\.[^.]+$/, ""),
        row_number: rowNumber,
        column,
        cell: `${column}${rowNumber}`,
        unitid: normalizeSpace(row[headers.indexOf("UNITID_P")]),
        opeid: normalizeSpace(row[headers.indexOf("OPEID")]),
        institution_name: institutionName,
        school_id: slugify(institutionName),
        branch: normalizeSpace(row[headers.indexOf("BRANCH")]),
        address: normalizeSpace(row[headers.indexOf("Address")]),
        city,
        state,
        zip: normalizeSpace(row[headers.indexOf("ZIP")]),
        scope,
        code: header,
        code_prefix: match[1],
        statistic: profile.statistic_map[match[1]],
        statistic_label: profile.statistic_label,
        statistic_label_plural: profile.statistic_label_plural,
        summary_subject: profile.summary_subject,
        aggregate_stat_subtype: profile.aggregate_stat_subtype,
        category: profile.category,
        affected_communities: [...profile.affected_communities],
        year: `20${match[2]}`,
        count
      });
    }
  }

  return sourceRows;
}

function sourceLocatorForRow(row) {
  return [
    `${row.workbook} > ${row.sheet}`,
    `row ${row.row_number}`,
    `column ${row.code}`,
    `cell ${row.cell}`,
    `institution=${row.institution_name}`,
    `scope=${row.scope}`,
    `year=${row.year}`,
    `statistic=${row.statistic}`
  ].join(" > ");
}

function candidateIdForRow(row) {
  const profile = profileForId(row.profile_id);
  const hash = sha256({
    workbook: row.workbook,
    unitid: row.unitid,
    school_id: row.school_id,
    year: row.year,
    code: row.code,
    scope: row.scope,
    cell: row.cell
  });
  return `${profile.candidate_prefix}_${hash.slice("sha256:".length, "sha256:".length + 18)}`;
}

function candidateForRow({ row, school, waveId }) {
  const profile = profileForId(row.profile_id);
  const countText = `${row.count} reported ${row.scope} ${pluralizeStatistic(row.count, profile)}`;
  const sourceLocator = sourceLocatorForRow(row);
  return {
    candidate_id: candidateIdForRow(row),
    wave_id: waveId,
    manifest_id: ED_CAMPUS_SAFETY_MANIFEST_ID,
    source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
    record_lane: ED_CAMPUS_SAFETY_RECORD_LANE,
    source_url: row.source_url,
    source_locator: sourceLocator,
    school_id: school.id,
    institution_name: school.name,
    date: `${row.year}-01-01`,
    date_precision: "year",
    category: row.category,
    affected_communities: row.affected_communities,
    summary: `ED Campus Safety data listed ${countText} for ${row.institution_name} in ${row.year}: ${row.statistic}.`,
    raw_source_hash: sha256({ row, source_locator: sourceLocator }),
    aggregate_stat_subtype: row.aggregate_stat_subtype,
    import_notes:
      `Imported from official ED Campus Safety and Security aggregate ${profile.summary_subject} data. ` +
      "This source row is an aggregate public statistic for source-backed institutional context."
  };
}

function mappingQuarantineRow(row) {
  return {
    candidate_id: candidateIdForRow(row),
    source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
    record_lane: ED_CAMPUS_SAFETY_RECORD_LANE,
    source_url: row.source_url,
    source_locator: sourceLocatorForRow(row),
    raw_hash: sha256({ row }),
    aggregate_stat_subtype: row.aggregate_stat_subtype,
    reason_codes: ["unknown_school"],
    failed_gates: ["unknown_school"],
    remediation_action: "Resolve institution identity to a known school record before publication.",
    row: {
      institution_name: row.institution_name,
      city: row.city,
      state: row.state,
      unitid: row.unitid,
      workbook: row.workbook,
      code: row.code,
      year: row.year,
      scope: row.scope
    }
  };
}

function uniqueSchoolId({ baseId, unitid, usedIds }) {
  if (!usedIds.has(baseId)) return baseId;
  const suffix = String(unitid || "").replace(/\D/g, "").slice(-9) || "duplicate";
  const withUnitid = `${baseId}_${suffix}`;
  if (!usedIds.has(withUnitid)) return withUnitid;
  let index = 2;
  while (usedIds.has(`${withUnitid}_${index}`)) index += 1;
  return `${withUnitid}_${index}`;
}

export function buildEdCampusSafetySchoolsFromSourceRows({ schools = [], sourceRows = [] } = {}) {
  const expanded = schools.map((school) => schoolWithIdentifiers(school, null));
  const usedIds = new Set(expanded.map((school) => school.id));
  const lookup = schoolLookup(expanded);
  let addedCount = 0;

  for (const row of sourceRows) {
    const existing = resolveSchoolForRowWithLookup(row, lookup);
    if (existing) {
      const index = expanded.findIndex((school) => school.id === existing.id);
      expanded[index] = schoolWithIdentifiers(existing, row);
      addSchoolToLookup(lookup, expanded[index]);
      continue;
    }

    const baseId = slugify(row.institution_name);
    const id = uniqueSchoolId({ baseId, unitid: row.unitid, usedIds });
    usedIds.add(id);
    expanded.push(
      schoolWithIdentifiers(
        {
          id,
          name: row.institution_name,
          city: row.city,
          state: row.state,
          country: "US"
        },
        row
      )
    );
    addSchoolToLookup(lookup, expanded.at(-1));
    addedCount += 1;
  }

  return {
    schools: expanded,
    added_count: addedCount
  };
}

export function buildEdCampusSafetyAggregateCandidates({
  waveId,
  sourceRows = [],
  schools = [],
  limit = Number.POSITIVE_INFINITY,
  offset = 0,
  usedCandidateIds = new Set()
} = {}) {
  const candidates = [];
  const mappingQuarantine = [];
  const lookup = schoolLookup(schools);
  let knownSchoolRows = 0;
  let skippedKnownRows = 0;

  for (const row of sourceRows) {
    const school = resolveSchoolForRowWithLookup(row, lookup);
    if (!school) {
      mappingQuarantine.push(mappingQuarantineRow(row));
      continue;
    }

    const candidateId = candidateIdForRow(row);
    if (usedCandidateIds.has(candidateId)) continue;
    knownSchoolRows += 1;
    if (skippedKnownRows < offset) {
      skippedKnownRows += 1;
      continue;
    }
    if (candidates.length >= limit) continue;

    candidates.push(candidateForRow({ row, school, waveId }));
  }

  return {
    candidates,
    mappingQuarantine,
    totals: {
      source_rows: sourceRows.length,
      known_school_rows: knownSchoolRows,
      mapping_quarantine: mappingQuarantine.length,
      exported: candidates.length
    }
  };
}
