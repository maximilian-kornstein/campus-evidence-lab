import { access } from "node:fs/promises";
import path from "node:path";
import { assertDate, paths, readJson, rootDir, sha256, eventForHash } from "./lib.mjs";

const allowedCommunities = new Set([
  "Jewish",
  "Asian",
  "Black",
  "Native",
  "Indigenous",
  "Latino",
  "Muslim",
  "Israeli",
  "Sikh",
  "Hindu",
  "LGBTQ+",
  "Disability",
  "Students with disabilities",
  "Women",
  "Pregnant students",
  "Palestinian",
  "Arab"
]);

const allowedCategories = new Set([
  "Harassment or threat",
  "Vandalism",
  "Discrimination allegation",
  "Protest-related incident",
  "Institutional response",
  "Public statement",
  "Policy change",
  "Public safety notice",
  "OCR complaint",
  "Lawsuit or legal filing",
  "Criminal investigation",
  "Community response",
  "Title IX compliance",
  "Pregnancy discrimination",
  "Disability access",
  "Athletic equity",
  "Other source-backed civil rights event"
]);

const allowedVerification = new Set([
  "Pending review",
  "Verified from public source",
  "Verified from multiple public sources",
  "Public allegation",
  "Institutional statement only",
  "Updated after correction",
  "Archived / no longer included"
]);

const allowedConfidence = new Set(["High", "Medium", "Low"]);
const allowedDatePrecision = new Set(["day", "month", "year"]);

const allowedCorrectionStatus = new Set(["pending", "accepted", "rejected", "needs_more_evidence"]);
const requiredReviewQueues = new Set([
  "source-submissions",
  "correction-requests",
  "duplicate-reports",
  "school-metadata-corrections"
]);

const [events, schools, sources, briefs, corrections, reviewLog] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.corrections),
  readJson(paths.reviewLog)
]);

const errors = [];

function uniqueBy(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item[key]) errors.push(`${label} missing ${key}`);
    if (seen.has(item[key])) errors.push(`Duplicate ${label} ${key}: ${item[key]}`);
    seen.add(item[key]);
  }
}

uniqueBy(events, "id", "event");
uniqueBy(schools, "id", "school");
uniqueBy(sources, "id", "source");
uniqueBy(briefs, "id", "brief");
uniqueBy(corrections, "id", "correction");
uniqueBy(sources, "url", "source");

const schoolIds = new Set(schools.map((school) => school.id));
const sourceIds = new Set(sources.map((source) => source.id));
const eventIds = new Set(events.map((event) => event.id));

for (const school of schools) {
  for (const field of ["name", "city", "state", "country"]) {
    if (!school[field]) errors.push(`School ${school.id} missing ${field}`);
  }
  if (school.website) {
    try {
      new URL(school.website);
    } catch {
      errors.push(`School ${school.id} has invalid website`);
    }
  }
}

for (const source of sources) {
  for (const field of ["title", "url", "publisher", "source_type", "published_date", "accessed_date"]) {
    if (!source[field]) errors.push(`Source ${source.id} missing ${field}`);
  }
  try {
    new URL(source.url);
  } catch {
    errors.push(`Source ${source.id} has invalid URL`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) {
    assertDate(source.published_date, `Source ${source.id} published_date`, errors);
  }
  assertDate(source.accessed_date, `Source ${source.id} accessed_date`, errors);
}

for (const event of events) {
  if (!/^evt_\d{4}_\d{4}$/.test(event.id)) errors.push(`Event ${event.id} has invalid ID format`);
  if (!schoolIds.has(event.school_id)) errors.push(`Event ${event.id} references unknown school ${event.school_id}`);
  assertDate(event.date, `Event ${event.id} date`, errors);
  assertDate(event.created_at, `Event ${event.id} created_at`, errors);
  assertDate(event.updated_at, `Event ${event.id} updated_at`, errors);
  if (!allowedDatePrecision.has(event.date_precision)) errors.push(`Event ${event.id} has invalid date_precision`);
  if (!allowedCategories.has(event.category)) errors.push(`Event ${event.id} has invalid category ${event.category}`);
  if (!allowedVerification.has(event.verification_status)) errors.push(`Event ${event.id} has invalid verification_status`);
  if (!allowedConfidence.has(event.confidence)) errors.push(`Event ${event.id} has invalid confidence`);
  if (!Array.isArray(event.affected_communities) || event.affected_communities.length === 0) {
    errors.push(`Event ${event.id} must include affected_communities`);
  } else {
    for (const community of event.affected_communities) {
      if (!allowedCommunities.has(community)) errors.push(`Event ${event.id} has unsupported community ${community}`);
    }
  }
  if (!Array.isArray(event.source_ids) || event.source_ids.length === 0) {
    errors.push(`Event ${event.id} must include at least one source_id`);
  } else {
    for (const sourceId of event.source_ids) {
      if (!sourceIds.has(sourceId)) errors.push(`Event ${event.id} references unknown source ${sourceId}`);
    }
  }
  for (const field of ["summary", "description", "institutional_response", "legal_status"]) {
    if (!event[field] || event[field].length < 20) errors.push(`Event ${event.id} ${field} is too short`);
  }
  if (!Array.isArray(event.changelog) || event.changelog.length === 0) {
    errors.push(`Event ${event.id} must include changelog`);
  } else {
    for (const [index, entry] of event.changelog.entries()) {
      assertDate(entry.date, `Event ${event.id} changelog[${index}].date`, errors);
      if (!entry.note) errors.push(`Event ${event.id} changelog[${index}] missing note`);
    }
  }
  if (!event.record_hash) {
    errors.push(`Event ${event.id} missing record_hash. Run npm run hash:data`);
  } else if (event.record_hash !== sha256(eventForHash(event))) {
    errors.push(`Event ${event.id} record_hash is stale. Run npm run hash:data`);
  }
}

for (const brief of briefs) {
  assertDate(brief.week_start, `Brief ${brief.id} week_start`, errors);
  assertDate(brief.week_end, `Brief ${brief.id} week_end`, errors);
  assertDate(brief.published_date, `Brief ${brief.id} published_date`, errors);
  for (const eventId of [...brief.new_event_ids, ...brief.updated_event_ids]) {
    if (!eventIds.has(eventId)) errors.push(`Brief ${brief.id} references unknown event ${eventId}`);
  }
}

for (const correction of corrections) {
  if (!/^corr_\d{4}_\d{4}$/.test(correction.id)) errors.push(`Correction ${correction.id} has invalid ID format`);
  if (!eventIds.has(correction.record_id)) errors.push(`Correction ${correction.id} references unknown event ${correction.record_id}`);
  if (!allowedCorrectionStatus.has(correction.status)) errors.push(`Correction ${correction.id} has invalid status ${correction.status}`);
  assertDate(correction.requested_at, `Correction ${correction.id} requested_at`, errors);
  if (correction.resolved_at !== null && correction.resolved_at !== undefined) {
    assertDate(correction.resolved_at, `Correction ${correction.id} resolved_at`, errors);
  }
  for (const field of ["field", "requested_change", "public_rationale"]) {
    if (!correction[field]) errors.push(`Correction ${correction.id} missing ${field}`);
  }
  if (!Array.isArray(correction.public_source_urls) || correction.public_source_urls.length === 0) {
    errors.push(`Correction ${correction.id} must include public_source_urls`);
  } else {
    for (const url of correction.public_source_urls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") errors.push(`Correction ${correction.id} source URL must use HTTPS`);
      } catch {
        errors.push(`Correction ${correction.id} has invalid public source URL`);
      }
    }
  }
  for (const eventId of correction.applied_event_ids ?? []) {
    if (!eventIds.has(eventId)) errors.push(`Correction ${correction.id} references unknown applied event ${eventId}`);
  }
}

assertDate(reviewLog.updated_at, "review-log updated_at", errors);
if (!Array.isArray(reviewLog.queues) || reviewLog.queues.length < requiredReviewQueues.size) {
  errors.push("review-log must include all required public intake queues");
}

const queueNames = new Set((reviewLog.queues ?? []).map((queue) => queue.name));
for (const queueName of requiredReviewQueues) {
  if (!queueNames.has(queueName)) {
    errors.push(`review-log missing required queue ${queueName}`);
  }
}

for (const queue of reviewLog.queues ?? []) {
  for (const field of ["name", "status", "public_entrypoint"]) {
    if (!queue[field]) errors.push(`review-log queue missing ${field}`);
  }
  if (!["open", "paused", "closed"].includes(queue.status)) {
    errors.push(`review-log queue ${queue.name} has invalid status ${queue.status}`);
  }
  if (!Array.isArray(queue.accepted_evidence) || queue.accepted_evidence.length === 0) {
    errors.push(`review-log queue ${queue.name} must include accepted_evidence`);
  }
  if (!Array.isArray(queue.excluded_evidence) || queue.excluded_evidence.length === 0) {
    errors.push(`review-log queue ${queue.name} must include excluded_evidence`);
  }
  try {
    await access(path.join(rootDir, queue.public_entrypoint));
  } catch {
    errors.push(`review-log queue ${queue.name} references missing entrypoint ${queue.public_entrypoint}`);
  }
}

const actualCorrectionCounts = {
  pending: corrections.filter((correction) => correction.status === "pending").length,
  accepted: corrections.filter((correction) => correction.status === "accepted").length,
  rejected: corrections.filter((correction) => correction.status === "rejected").length,
  needs_more_evidence: corrections.filter((correction) => correction.status === "needs_more_evidence").length
};

for (const [status, count] of Object.entries(actualCorrectionCounts)) {
  if (reviewLog.decision_counts?.[status] !== count) {
    errors.push(`review-log decision_counts.${status} is ${reviewLog.decision_counts?.[status]}, expected ${count}`);
  }
}

if (!reviewLog.service_standard?.publication_rule || !reviewLog.service_standard?.correction_rule) {
  errors.push("review-log must include publication and correction rules");
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${events.length} events, ${schools.length} schools, ${sources.length} sources, ${corrections.length} corrections.`);
