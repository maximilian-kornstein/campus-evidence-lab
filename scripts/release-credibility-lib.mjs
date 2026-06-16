export const REQUIRED_REPLICATION_COMMANDS = ["npm ci", "npm run check", "npm run build"];

export const ALLOWED_CREDIBILITY_STATUSES = new Set([
  "review_requested",
  "review_in_progress",
  "review_completed",
  "collaboration_completed",
  "public_acknowledgment_approved"
]);

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

export function hasProhibitedCredibilityClaim(text) {
  return /endorsed by|approved by|validated by external|externally validated|safest schools|most dangerous schools|best schools|worst schools|school ranking|safety score|severity score|prevalence estimate/i.test(
    text ?? ""
  );
}

export function validateReleases(releases) {
  const errors = [];
  if (!releases.version) errors.push("releases missing version");
  if (!isDate(releases.updated_at)) errors.push("releases updated_at must use YYYY-MM-DD");
  if (!Array.isArray(releases.releases) || releases.releases.length === 0) errors.push("releases must include at least one release");

  for (const release of releases.releases ?? []) {
    for (const field of ["id", "name", "date", "snapshot_id", "snapshot_hash", "release_notes_url", "replication_url"]) {
      if (!release[field]) errors.push(`Release ${release.id ?? "unknown"} missing ${field}`);
    }
    if (!isDate(release.date)) errors.push(`Release ${release.id} date must use YYYY-MM-DD`);
    for (const field of ["event_count", "school_count", "source_count"]) {
      if (!Number.isInteger(release[field]) || release[field] < 0) errors.push(`Release ${release.id} ${field} must be a non-negative integer`);
    }
    for (const command of REQUIRED_REPLICATION_COMMANDS) {
      if (!release.verification_commands?.includes(command)) errors.push(`Release ${release.id} missing verification command ${command}`);
    }
    if (!Array.isArray(release.known_limits) || release.known_limits.length === 0) errors.push(`Release ${release.id} must include known_limits`);
    if (hasProhibitedCredibilityClaim(JSON.stringify(release))) errors.push(`Release ${release.id} includes prohibited credibility claim`);
  }

  return errors;
}

export function validateReleaseVerification(verification) {
  const errors = [];
  if (!verification.version) errors.push("release-verification missing version");
  if (!isDate(verification.generated_at)) errors.push("release-verification generated_at must use YYYY-MM-DD");
  if (!verification.snapshot_id) errors.push("release-verification missing snapshot_id");
  if (!verification.snapshot_hash) errors.push("release-verification missing snapshot_hash");
  if (!["passed", "failed"].includes(verification.status)) errors.push("release-verification status must be passed or failed");
  if (!Array.isArray(verification.commands) || verification.commands.length === 0) errors.push("release-verification must include commands");
  for (const command of REQUIRED_REPLICATION_COMMANDS.slice(1)) {
    if (!verification.commands?.some((entry) => entry.command === command)) errors.push(`release-verification missing command ${command}`);
  }
  if (!verification.tool_versions?.node) errors.push("release-verification missing node version");
  if (!verification.tool_versions?.npm) errors.push("release-verification missing npm version");
  if (hasProhibitedCredibilityClaim(verification.notes ?? "")) {
    errors.push("release-verification implies external validation or prohibited credibility claim");
  }
  return errors;
}

export function validateCredibilityStatus(status) {
  const errors = [];
  if (!status.version) errors.push("credibility-status missing version");
  if (!isDate(status.updated_at)) errors.push("credibility-status updated_at must use YYYY-MM-DD");
  if (!Array.isArray(status.entries)) errors.push("credibility-status entries must be an array");

  for (const entry of status.entries ?? []) {
    if (!entry.id) errors.push("credibility-status entry missing id");
    if (!ALLOWED_CREDIBILITY_STATUSES.has(entry.status)) errors.push(`Credibility entry ${entry.id} has invalid status ${entry.status}`);
    if (!entry.scope || entry.scope.length < 20) errors.push(`Credibility entry ${entry.id} scope is missing or too short`);
    if (entry.permission_to_display !== true && entry.status === "public_acknowledgment_approved") {
      errors.push(`Credibility entry ${entry.id} cannot be publicly acknowledged without display permission`);
    }
    if (hasProhibitedCredibilityClaim(`${entry.display_name ?? ""} ${entry.scope ?? ""} ${entry.public_note ?? ""}`)) {
      errors.push(`Credibility entry ${entry.id} includes prohibited credibility claim`);
    }
  }

  return errors;
}
