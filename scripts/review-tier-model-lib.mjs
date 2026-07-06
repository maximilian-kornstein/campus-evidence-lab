export const REVIEW_TIERS = [
  "imported_public_source",
  "source_family_checked",
  "internally_certified",
  "externally_reviewed"
];

export const REVIEW_TIER_DETAILS = {
  imported_public_source: {
    label: "Imported public source",
    limitation:
      "This record was imported from a public source and passed baseline publication gates. Source-family checks or human source-to-record certification may still be incomplete."
  },
  source_family_checked: {
    label: "Source-family checked",
    limitation:
      "This record passed source-family mapping and deterministic quality checks. It should not be described as individually human-certified or externally reviewed."
  },
  internally_certified: {
    label: "Internally certified",
    limitation:
      "This record cleared Campus Evidence Lab internal source-to-record gates under a named certification standard. It is not outside validation, endorsement, or a legal finding."
  },
  externally_reviewed: {
    label: "Externally reviewed",
    limitation:
      "This record or packet was reviewed by an outside reviewer under a named scope. The review does not create endorsement, ranking, safety scoring, or legal truth."
  }
};

const REVIEW_TIER_SET = new Set(REVIEW_TIERS);

const PROHIBITED_REVIEW_TIER_CLAIM_PATTERN =
  /\b(?:all|every)\s+(?:public\s+)?records?\s+(?:are|is|have been)\s+(?:human[- ]reviewed|manually reviewed|internally certified|externally reviewed|verified|certified)\b|externally validated|outside validated|validated by|approved by|endorsed by|safest|most dangerous|best school|worst school|school ranking|safety score|severity score|prevalence estimate|frequency measure|proves? (?:the )?.*(?:violated|liable|liability)|(?:is|constitutes|represents)\s+(?:a\s+)?legal finding/i;

const NEGATED_LIMITATION_PATTERN =
  /\b(?:must not|should not|do not|does not|cannot|may not)\b[^.?!;]{0,220}\b(?:comparative campus judgment|risk rating|severity rating|severity score|frequency measure|prevalence estimate|school ranking|safety score|external validation|endorsement|legal finding|legal liability)\b/gi;

const LOWER_TIER_UPGRADE_PATTERN = /\b(?:internally certified|externally reviewed|manually reviewed|human[- ]reviewed)\b/i;

export function isAllowedReviewTier(tier) {
  return REVIEW_TIER_SET.has(tier);
}

export function reviewTierRank(tier) {
  return REVIEW_TIERS.indexOf(tier);
}

export function reviewTierLabel(tier) {
  return REVIEW_TIER_DETAILS[tier]?.label ?? "Unknown review tier";
}

export function reviewTierLimit(tier) {
  return REVIEW_TIER_DETAILS[tier]?.limitation ?? "";
}

export function reviewTierForCertificationStatus(status) {
  if (status === "certified") return "internally_certified";
  if (status === "externally_reviewed") return "externally_reviewed";
  return "imported_public_source";
}

export function hasProhibitedReviewTierClaim(value) {
  const text = String(value ?? "").replace(NEGATED_LIMITATION_PATTERN, " ");
  return PROHIBITED_REVIEW_TIER_CLAIM_PATTERN.test(text);
}

function publicTextForRecord(record) {
  return [
    record.summary,
    record.description,
    record.verification_status,
    record.confidence,
    record.legal_status,
    record.institutional_response,
    ...(record.limitations ?? [])
  ].join(" ");
}

export function validateReviewTierRecord(record) {
  const errors = [];
  const label = `Event ${record?.id ?? "unknown"}`;

  if (!record?.review_tier) {
    errors.push(`${label} missing review_tier`);
    return errors;
  }

  if (!isAllowedReviewTier(record.review_tier)) {
    errors.push(`${label} has invalid review_tier ${record.review_tier}`);
    return errors;
  }

  const publicText = publicTextForRecord(record);
  if (hasProhibitedReviewTierClaim(publicText)) {
    errors.push(`${label} review_tier public text overclaims record certainty or permitted use`);
  }

  if (reviewTierRank(record.review_tier) < reviewTierRank("internally_certified") && LOWER_TIER_UPGRADE_PATTERN.test(publicText)) {
    errors.push(`${label} review_tier ${record.review_tier} overclaims human certification or outside review`);
  }

  return errors;
}
