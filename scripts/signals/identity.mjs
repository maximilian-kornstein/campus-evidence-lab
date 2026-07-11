function normalized(value) {
  return String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function domain(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function acronym(name) {
  const skip = new Set(["of", "the", "and", "at", "in"]);
  return normalized(name).split(" ").filter((part) => !skip.has(part)).map((part) => part[0]).join("");
}

export function buildIdentityIndex(schools, overrides = {}) {
  const candidates = [];
  for (const school of schools) {
    const aliases = new Set([normalized(school.name)]);
    const withoutCampus = normalized(school.name).replace(/\b(main campus|branch campus|campus)\b/g, "").replace(/\s+/g, " ").trim();
    if (withoutCampus.length >= 6) aliases.add(withoutCampus);
    for (const alias of overrides[school.id] ?? []) aliases.add(normalized(alias));
    const short = acronym(school.name);
    if (short.length >= 3 && short.length <= 8) aliases.add(short);
    for (const alias of aliases) if (alias) candidates.push({ alias, school_id: school.id, source: alias === normalized(school.name) ? "canonical_name" : "derived_or_verified_alias" });
    const schoolDomain = domain(school.website);
    if (schoolDomain) candidates.push({ alias: schoolDomain, school_id: school.id, source: "verified_domain" });
  }
  const byAlias = new Map();
  for (const row of candidates) byAlias.set(row.alias, [...(byAlias.get(row.alias) ?? []), row]);
  const aliases = [];
  const ambiguous = [];
  for (const [alias, rows] of byAlias) {
    const schoolIds = [...new Set(rows.map((row) => row.school_id))];
    if (schoolIds.length === 1) aliases.push({ alias, school_id: schoolIds[0], source: rows[0].source });
    else ambiguous.push({ alias, school_ids: schoolIds });
  }
  return { aliases, ambiguous };
}

export function resolveInstitutions(trigger, schools, index) {
  if (trigger.institution_ids?.length) {
    const known = new Set(schools.map((school) => school.id));
    return trigger.institution_ids.filter((id) => known.has(id)).map((school_id) => ({ school_id, confidence: "exact_id", matched_alias: school_id }));
  }
  const haystack = ` ${normalized(`${trigger.title ?? ""} ${trigger.summary ?? ""} ${trigger.url ?? ""}`)} `;
  let hostname = "";
  try { hostname = domain(trigger.url); } catch {}
  const matches = [];
  for (const row of index.aliases) {
    const isDomain = row.source === "verified_domain" && (hostname === row.alias || hostname.endsWith(`.${row.alias}`));
    const isText = row.source !== "verified_domain" && row.alias.length >= 3 && haystack.includes(` ${row.alias} `);
    if (isDomain || isText) matches.push({ school_id: row.school_id, confidence: row.source, matched_alias: row.alias });
  }
  const distinct = new Map();
  for (const match of matches) distinct.set(match.school_id, match);
  return distinct.size === 1 ? [...distinct.values()] : [];
}

export { normalized as normalizeInstitutionText };
