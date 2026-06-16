import { paths, readJson } from "./lib.mjs";

const [events, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources)
]);

const errors = [];

const attributionPattern =
  /\b(according to|reported|stated|announced|lists|source|ocr|department|justice department|resolution agreement|complaint|letter|public case summary)\b/i;
const privateContactPattern =
  /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i;
const privateEvidencePattern =
  /\b(private screenshot|private screenshots|direct message|direct messages|dm\b|dms\b|private testimony|anonymous tip|unverified social media)\b/i;
const inflammatoryPattern =
  /\b(monster|evil|scum|traitor|terrorist sympathizer|hate group member|racist administrator|antisemite)\b/i;
const legalJudgmentPattern =
  /\b(guilty|liable|criminally responsible|proved that|proves that)\b/i;
const violationPattern = /\b(violated|violation|violations)\b/i;
const officialFindingPattern =
  /\b(ocr|department|federal|title vi|title ix|finding|found|determined|stated|agreement|resolution|civil-rights violations)\b/i;
const prohibitedClaims = [
  "externally audited",
  "external audit confirmed",
  "school ranking",
  "safety score",
  "severity score",
  "prevalence estimate"
];
const noOverclaimingContextPattern =
  /\b(not|no|does not|do not|should not|must not|cannot|without|never|excluded|avoid|claims? not made)\b/i;
const disallowedSourceHosts = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "reddit.com"
];

function textForEvent(event) {
  return [
    event.summary,
    event.description,
    event.institutional_response,
    event.legal_status,
    ...(event.tags ?? [])
  ].join(" ");
}

function sentencesForText(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|[\n\r]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasAllowedNoOverclaimingContext(sentence) {
  return noOverclaimingContextPattern.test(sentence);
}

for (const event of events) {
  const eventText = textForEvent(event);

  for (const field of ["summary", "description", "institutional_response", "legal_status"]) {
    if (privateContactPattern.test(event[field] ?? "")) {
      errors.push(`Event ${event.id} ${field} appears to include private contact information`);
    }
    if (privateEvidencePattern.test(event[field] ?? "")) {
      errors.push(`Event ${event.id} ${field} references private or unverified evidence`);
    }
    if (inflammatoryPattern.test(event[field] ?? "")) {
      errors.push(`Event ${event.id} ${field} uses inflammatory characterization`);
    }
    if (legalJudgmentPattern.test(event[field] ?? "")) {
      errors.push(`Event ${event.id} ${field} uses legal judgment language that should be attributed or avoided`);
    }
    for (const sentence of sentencesForText(event[field])) {
      const sentenceLower = sentence.toLowerCase();
      for (const claim of prohibitedClaims) {
        if (sentenceLower.includes(claim) && !hasAllowedNoOverclaimingContext(sentence)) {
          errors.push(`Event ${event.id} ${field} uses prohibited affirmative claim "${claim}": ${sentence}`);
        }
      }
    }
  }

  if (!attributionPattern.test(event.description)) {
    errors.push(`Event ${event.id} description lacks explicit public-source attribution`);
  }

  if (event.verification_status === "Public allegation" && !/\b(alleged|alleges|complaint|lawsuit|report)\b/i.test(eventText)) {
    errors.push(`Event ${event.id} is a public allegation but lacks allegation framing`);
  }

  if (violationPattern.test(event.summary) && !officialFindingPattern.test(`${event.summary} ${event.legal_status}`)) {
    errors.push(`Event ${event.id} summary uses violation language without official finding context`);
  }

  if (!/does not.*(?:evaluate|summarize)|summarizes|according to|public case summary|source announces|said|stated|describes|announced|agreement/i.test(event.institutional_response)) {
    errors.push(`Event ${event.id} institutional_response lacks neutral attribution or evaluation limit`);
  }
}

for (const source of sources) {
  const url = new URL(source.url);
  const hostname = url.hostname.replace(/^www\./, "");
  if (disallowedSourceHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    errors.push(`Source ${source.id} uses social-media host ${hostname}; social-only sources are excluded from MVP publication`);
  }
}

if (errors.length) {
  console.error(`Content QA failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Content QA passed: ${events.length} event records screened for attribution, privacy, and neutral language.`);
