const PROHIBITED = /\b(safest|most dangerous|worst campus|best campus|safety score|severity score|prevalence estimate|proved discrimination|guilty|liable|cover[- ]?up)\b/i;
const SENSITIVE = /\b(victim's full name|home address|personal phone|private message|direct message)\b/i;

export function reviewSignal(signal) {
  const reasons = [];
  if (!signal.id || !signal.institution?.id || signal.trigger?.institution_ids?.length !== 1 || signal.trigger.institution_ids[0] !== signal.institution.id) reasons.push("institution_identity_not_exact");
  if (!signal.bounded_claims?.length || signal.bounded_claims.some((claim) => !claim.text || !claim.supporting_record_ids?.length || !claim.supporting_source_ids?.length)) reasons.push("unsupported_claim");
  if (!signal.sources?.length || signal.sources.some((source) => !/^https?:\/\//.test(source.url ?? ""))) reasons.push("invalid_source");
  if (!signal.canonical_url || !signal.correction_url) reasons.push("missing_public_routes");
  if (!signal.distribution_copy?.bluesky_original || signal.distribution_copy.bluesky_original.length > 300 || !signal.distribution_copy.bluesky_original.includes(signal.canonical_url)) reasons.push("invalid_social_copy");
  const allText = JSON.stringify([signal.bounded_claims, signal.unknowns, signal.distribution_copy]);
  if (PROHIBITED.test(allText)) reasons.push("prohibited_claim");
  if (SENSITIVE.test(allText)) reasons.push("sensitive_identity_risk");
  if (signal.signal_type === "dataset_context") {
    const evidence = signal.calculation?.evidence ?? [];
    const cells = new Set(evidence.map((row) => `${row.workbook}|${row.sheet}|${row.cell}`));
    const total = evidence.reduce((sum, row) => sum + Number(row.value), 0);
    if (!evidence.length || cells.size !== evidence.length) reasons.push("non_distinct_calculation_cells");
    if (!Number.isFinite(total) || total !== signal.calculation?.reported_statistic_total) reasons.push("calculation_not_reproducible");
    if (evidence.some((row) => !row.event_id || !row.record_hash || !row.workbook || !row.cell || !row.year)) reasons.push("incomplete_calculation_evidence");
  }
  return { signal_id: signal.id, institution_id: signal.institution?.id ?? "", passed: reasons.length === 0, reason_codes: reasons };
}

export function runShadowReview(signals, { minimumSignals = 30, minimumInstitutions = 20 } = {}) {
  const decisions = signals.map(reviewSignal);
  const passing = decisions.filter((row) => row.passed);
  const institutions = new Set(passing.map((row) => row.institution_id));
  const duplicateCopy = new Set();
  const copySeen = new Set();
  for (const signal of signals) {
    const copy = signal.distribution_copy?.bluesky_original ?? "";
    if (copySeen.has(copy)) duplicateCopy.add(signal.id);
    copySeen.add(copy);
  }
  for (const decision of decisions) {
    if (duplicateCopy.has(decision.signal_id)) {
      decision.passed = false;
      decision.reason_codes.push("duplicate_distribution_copy");
    }
  }
  const finalPassing = decisions.filter((row) => row.passed);
  const finalInstitutions = new Set(finalPassing.map((row) => row.institution_id));
  const gateReady = finalPassing.length >= minimumSignals && finalInstitutions.size >= minimumInstitutions;
  return { gate_ready: gateReady, minimum_signals: minimumSignals, minimum_institutions: minimumInstitutions, passing_signals: finalPassing.length, passing_institutions: finalInstitutions.size, decisions };
}
