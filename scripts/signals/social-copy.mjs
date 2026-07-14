export const DISTRIBUTION_POLICY_VERSION = "cel-social-content-v2";
export const TECHNICAL_PROVENANCE = /\b(?:cell|cells|row|rows|workbook|workbooks|locator|locators|calculation|calculations)\b/i;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const result = clean(value).replace(/[…]+$/u, "");
  if (!result) return "";
  return /[.!?]$/.test(result) ? result : `${result}.`;
}

export function contentFirstCopy({ lead, clauses = [], canonicalUrl, suffix = "Details/limits:" }) {
  const ending = ` ${suffix} ${canonicalUrl}`;
  const selected = [];
  for (const clause of clauses.map(sentence).filter(Boolean)) {
    const candidate = `${clean(lead)} ${[...selected, clause].join(" ")}${ending}`;
    if (candidate.length <= 300) selected.push(clause);
  }
  if (!selected.length) throw new Error("social_copy_has_no_complete_supported_clause");
  const result = `${clean(lead)} ${selected.join(" ")}${ending}`;
  if (result.length > 300 || TECHNICAL_PROVENANCE.test(result) || result.includes("…")) throw new Error("invalid_content_first_social_copy");
  return result;
}

export function safeSourceClauses(summary) {
  const value = clean(summary);
  const matches = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return matches.map(sentence).filter(Boolean);
}

export function semanticFactClause(fact) {
  const count = Number(fact.value);
  const category = clean(fact.category).toLowerCase().replace("harassment or threat", "harassment/threat");
  const community = (fact.affected_communities ?? []).map(clean).filter(Boolean).join(" and ");
  const geography = clean(fact.geography).replace("noncampus", "non-campus");
  const location = geography && geography !== "other reported geography" ? `${geography} ` : "";
  const label = category || "reported";
  const characterized = community ? ` labeled ${community}` : "";
  return `${count} ${location}${label} statistic${count === 1 ? "" : "s"}${characterized}`;
}

export function datasetSocialCopy({ schoolName, year, facts, canonicalUrl }) {
  const ordered = [...facts].sort((a, b) => Number(b.value) - Number(a.value) || semanticFactClause(a).localeCompare(semanticFactClause(b)));
  return contentFirstCopy({
    lead: `Federal ${year} data, ${schoolName}:`,
    clauses: ordered.map(semanticFactClause),
    canonicalUrl,
  });
}
