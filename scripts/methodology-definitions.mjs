export const REQUIRED_CODEBOOK_FIELDS = ["definition", "use_when", "do_not_use_when", "evidence_required", "common_mistake"];

function definition(value, noun, evidence = "linked public source material") {
  return {
    definition: `${value} means the record is coded as ${noun} based on public documentation, not private judgment or project inference.`,
    use_when: `Use ${value} only when ${evidence} directly supports this label for the school, date, and public record being described.`,
    do_not_use_when: `Do not use ${value} when the source merely implies the concept, when the label would broaden the record, or when another narrower label fits better.`,
    evidence_required: `A reviewer must be able to point to public source text, metadata, or a public record field that supports ${value} without relying on private context.`,
    common_mistake: `The common mistake is treating ${value} as a severity signal, prevalence claim, motive finding, or legal conclusion rather than a documentation label.`
  };
}

export const CATEGORY_DEFINITIONS = {
  "Athletic equity": definition("Athletic equity", "a public-source record about athletics access, equity obligations, or sex-equity compliance"),
  "Criminal investigation": definition("Criminal investigation", "a public-source record describing a criminal investigation, charge, prosecution, or law-enforcement step"),
  "Disability access": definition("Disability access", "a public-source record about disability access, accommodation, exclusion, or related civil-rights compliance"),
  "Harassment or threat": definition("Harassment or threat", "a public-source record about harassment, threats, intimidation, or source-described hostile treatment"),
  "Institutional response": definition("Institutional response", "a public action, notice, finding, statement, policy step, or response by an institution or agency"),
  "OCR complaint": definition("OCR complaint", "a public-source record involving an OCR complaint, investigation, resolution, letter, or monitoring action"),
  "Official aggregate safety statistic": {
    definition: "Official aggregate safety statistic means an institution-level numeric value transcribed from an identified cell in an official Department of Education Campus Safety and Security workbook.",
    use_when: "Use this category only when the institution, reporting year, scope, statistic, workbook, semantic column, exact cell, and positive numeric value are reproducible from the official source release.",
    do_not_use_when: "Do not use this category for an individual incident, allegation, case, narrative account, inferred trend, rate, prevalence estimate, comparison, or finding about institutional conduct.",
    evidence_required: "The record must retain the official source URL, source-release hash, workbook and sheet names, row, semantic column, cell address, institution identity, year, scope, statistic, and exact numeric value.",
    common_mistake: "The common mistake is treating one aggregate count as an incident record, a measure of prevalence, a safety score, a trend, or evidence of institutional quality or wrongdoing."
  },
  "Other source-backed civil rights event": definition(
    "Other source-backed civil rights event",
    "a campus civil-rights record that is source-supported but does not fit a narrower category"
  ),
  "Pregnancy discrimination": definition("Pregnancy discrimination", "a public-source record about pregnancy-related discrimination, accommodation, or Title IX obligations"),
  "Title IX compliance": definition("Title IX compliance", "a public-source record about Title IX compliance, process, athletics, pregnancy, sex discrimination, or related enforcement"),
  Vandalism: definition("Vandalism", "a public-source record about property damage, defacement, graffiti, or similar conduct tied to the archive scope")
};

export const COMMUNITY_DEFINITIONS = {
  Arab: definition("Arab", "an affected-community label for records where Arab people or Arab identity are named or directly described"),
  Asian: definition("Asian", "an affected-community label for records where Asian people or Asian identity are named or directly described"),
  Black: definition("Black", "an affected-community label for records where Black people or Black identity are named or directly described"),
  "Campus community": {
    definition: "Campus community is a bounded institution-level label for official aggregate statistical records that do not identify a person or a specific protected community.",
    use_when: "Use Campus community only for institution-level aggregate source rows where a narrower affected-community label is neither named nor safely supported by the source.",
    do_not_use_when: "Do not use Campus community to imply that every campus member was affected, to replace a source-supported protected-community label, or to characterize an individual incident.",
    evidence_required: "The official aggregate source must identify the institution and statistical scope while containing no supported basis for naming an individual or narrower affected community.",
    common_mistake: "The common mistake is reading Campus community as a claim of universal impact rather than a conservative label for a non-person-specific institution-level statistic."
  },
  Ethnicity: definition("Ethnicity", "a broad affected-community label for source-backed ethnicity-related records that cannot be narrowed safely"),
  Gender: definition("Gender", "a broad affected-community label for source-backed gender or sex-related records that cannot be narrowed safely"),
  Indigenous: definition("Indigenous", "an affected-community label for records where Indigenous people or identity are named or directly described"),
  Israeli: definition("Israeli", "an affected-community label for records where Israeli people, nationality, or identity are named or directly described"),
  Jewish: definition("Jewish", "an affected-community label for records where Jewish people or Jewish identity are named or directly described"),
  "LGBTQ+": definition("LGBTQ+", "an affected-community label for records where LGBTQ+ people or identity are named or directly described"),
  Latino: definition("Latino", "an affected-community label for records where Latino people or identity are named or directly described"),
  Muslim: definition("Muslim", "an affected-community label for records where Muslim people or Muslim identity are named or directly described"),
  "National origin": definition("National origin", "a broad affected-community label for source-backed national-origin records that cannot be narrowed safely"),
  Native: definition("Native", "an affected-community label for records where Native people or identity are named or directly described"),
  Palestinian: definition("Palestinian", "an affected-community label for records where Palestinian people, nationality, or identity are named or directly described"),
  "Pregnant students": definition("Pregnant students", "an affected-community label for records involving pregnant students or pregnancy-related educational access"),
  Race: definition("Race", "a broad affected-community label for source-backed race-related records that cannot be narrowed safely"),
  Religion: definition("Religion", "a broad affected-community label for source-backed religion-related records that cannot be narrowed safely"),
  "Students with disabilities": definition("Students with disabilities", "an affected-community label for records involving students with disabilities or disability access"),
  Women: definition("Women", "an affected-community label for records involving women or sex-equity access as described by public sources")
};

export const CONFIDENCE_DEFINITIONS = {
  High: {
    definition: "High confidence means strong public source support for the record fields, not high severity or legal certainty.",
    use_when: "Use High when official documentation, structured government data, or multiple reliable public sources support the record.",
    do_not_use_when: "Do not use High merely because the underlying event sounds serious, emotionally salient, or widely discussed.",
    evidence_required: "Public source material must support the school, date, category, community label, and core description with minimal ambiguity.",
    common_mistake: "The common mistake is reading High as a danger score, moral judgment, or independent legal finding."
  },
  Medium: {
    definition: "Medium confidence means the record is publicly sourced but some details are limited, single-source, or less complete.",
    use_when: "Use Medium when a reliable public source supports inclusion but corroboration, date precision, or field detail is incomplete.",
    do_not_use_when: "Do not use Medium to soften an unsupported record that should instead remain unpublished or pending review.",
    evidence_required: "At least one reliable public source must support the core record while leaving a documented limitation visible.",
    common_mistake: "The common mistake is treating Medium as medium severity instead of moderate source support."
  },
  Low: {
    definition: "Low confidence means a public source exists but important details are limited, disputed, broad, or require additional review.",
    use_when: "Use Low when the record should remain reviewable but source support is thin, broad, or dependent on a limited public account.",
    do_not_use_when: "Do not use Low for private tips, unsupported claims, or records with no public source basis.",
    evidence_required: "A public source must still exist, and the record must explicitly avoid unsupported precision or certainty.",
    common_mistake: "The common mistake is publishing Low as a rumor bucket instead of a narrow public-source limitation label."
  }
};

export const VERIFICATION_DEFINITIONS = {
  "Verified from public source": {
    definition: "Verified from public source means the record is supported by at least one public source available for reviewer inspection.",
    use_when: "Use this value when the linked source supports the core school, date, category, and description fields.",
    do_not_use_when: "Do not use this value when the only support is private evidence, inaccessible material, or unsupported inference.",
    evidence_required: "The linked public source must be reachable or archived and must contain enough information to reproduce the record.",
    common_mistake: "The common mistake is treating source verification as proof that every allegation or legal conclusion is true."
  }
};

export const SOURCE_TYPE_DEFINITIONS = {
  "Annual security report": definition("Annual security report", "a school-published Clery or campus safety report source", "the report metadata and table context"),
  "Government case summary": definition("Government case summary", "a public government summary of a case, complaint, resolution, or enforcement matter"),
  "Government dataset": definition("Government dataset", "a structured public dataset released by a government agency"),
  "Government guidance": definition("Government guidance", "public agency guidance, policy explanation, or compliance direction"),
  "Government letter": definition("Government letter", "a public agency letter, notification, resolution document, or similar correspondence"),
  "Government release": definition("Government release", "a public press release, announcement, or agency statement"),
  "Public safety notice": definition("Public safety notice", "a public campus, police, or safety notice"),
  "University statement": definition("University statement", "a public school statement, policy notice, announcement, or institutional communication")
};

export const DATE_PRECISION_DEFINITIONS = {
  day: definition("day", "a date precision value where the public source supports a specific calendar day"),
  month: definition("month", "a date precision value where the public source supports month-level timing but not a precise day"),
  year: definition("year", "a date precision value where the public source supports year-level timing but not month or day")
};

export function validateCodebookDefinitions(groups) {
  const errors = [];
  for (const [groupName, definitions] of Object.entries(groups)) {
    for (const [value, item] of Object.entries(definitions)) {
      for (const field of REQUIRED_CODEBOOK_FIELDS) {
        if (!item[field] || item[field].length < 20) {
          errors.push(`${groupName}.${value}.${field} is missing or too short`);
        }
      }
    }
  }
  return errors;
}

export function validateMethodologyExamples(examples) {
  const errors = [];
  const allowedTypes = new Set(["excluded", "downgraded", "limited", "correction_ready", "source_audit_risk", "broad_label_review"]);
  for (const example of examples) {
    if (!allowedTypes.has(example.type)) errors.push(`${example.id} has invalid type ${example.type}`);
    if (!CATEGORY_DEFINITIONS[example.category]) errors.push(`${example.id} has unknown category ${example.category}`);
    for (const community of example.affected_communities ?? []) {
      if (!COMMUNITY_DEFINITIONS[community]) errors.push(`${example.id} has unknown community ${community}`);
    }
    if (!CONFIDENCE_DEFINITIONS[example.confidence]) errors.push(`${example.id} has unknown confidence ${example.confidence}`);
    if (!VERIFICATION_DEFINITIONS[example.verification_status]) {
      errors.push(`${example.id} has unknown verification_status ${example.verification_status}`);
    }
    for (const field of ["title", "source_basis", "methodological_point", "public_claim_limit"]) {
      if (!example[field] || example[field].length < 20) errors.push(`${example.id} ${field} is missing or too short`);
    }
    if (/external review completed|reviewer approved|endorsed by/i.test(`${example.title} ${example.methodological_point} ${example.public_claim_limit}`)) {
      errors.push(`${example.id} implies external review or endorsement`);
    }
  }
  return errors;
}
