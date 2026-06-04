import { paths, readJson, writeJson } from "./lib.mjs";

const source = {
  id: "src_ed_ocr_whats_new_shared_ancestry_higher_ed",
  title: "What's New in OCR",
  url: "https://www.ed.gov/preview-link/node/5060/e58bc9e0-17b9-483a-845a-0df68624a768",
  publisher: "U.S. Department of Education Office for Civil Rights",
  source_type: "Government release",
  published_date: "Mixed",
  accessed_date: "2026-06-03"
};

const schools = [
  ["emory_university", "Emory University", "Atlanta", "GA"],
  ["university_of_california_los_angeles", "University of California, Los Angeles", "Los Angeles", "CA"],
  ["hinds_community_college", "Hinds Community College", "Raymond", "MS"],
  ["arcadia_university", "Arcadia University", "Glenside", "PA"],
  ["taft_college", "Taft College", "Taft", "CA"],
  ["montgomery_college", "Montgomery College", "Rockville", "MD"],
  ["troy_university", "Troy University", "Troy", "AL"],
  ["salt_lake_community_college", "Salt Lake Community College", "Salt Lake City", "UT"],
  ["michigan_state_university", "Michigan State University", "East Lansing", "MI"],
  ["wittenberg_university", "Wittenberg University", "Springfield", "OH"],
  ["elmira_college", "Elmira College", "Elmira", "NY"],
  ["hunter_college", "Hunter College", "New York", "NY"],
  ["wesley_college", "Wesley College", "Dover", "DE"],
  ["frostburg_state_university", "Frostburg State University", "Frostburg", "MD"],
  ["minot_state_university", "Minot State University", "Minot", "ND"],
  ["occidental_college", "Occidental College", "Los Angeles", "CA"],
  ["erie_community_college", "Erie Community College", "Buffalo", "NY"]
];

const records = [
  {
    school_id: "emory_university",
    date: "2025-01-16",
    category: "OCR complaint",
    affected_communities: ["Muslim", "Palestinian"],
    summary: "OCR announced a resolution agreement with Emory University regarding alleged anti-Muslim and anti-Palestinian discrimination.",
    description: "According to OCR's What's New page, Emory University entered into a resolution agreement to ensure Title VI compliance with respect to alleged harassment of students based on shared Palestinian and/or Muslim ancestry.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "anti-muslim", "anti-palestinian", "resolution-agreement"]
  },
  {
    school_id: "university_of_washington",
    date: "2025-01-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced that the University of Washington entered a resolution agreement regarding shared-ancestry discrimination allegations.",
    description: "According to OCR's What's New page, the University of Washington entered into a resolution agreement after OCR identified Title VI compliance concerns in the university's documentation and assessment of shared-ancestry harassment and discrimination reports.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "university_of_california_los_angeles",
    date: "2025-01-01",
    category: "OCR complaint",
    affected_communities: ["Jewish"],
    summary: "OCR announced an insufficient-evidence finding regarding UCLA's response to alleged antisemitic harassment.",
    description: "According to OCR's What's New page, OCR resolved a complaint alleging UCLA failed to respond promptly or effectively to alleged antisemitic harassment, finding insufficient evidence to support a conclusion that UCLA violated Title VI.",
    legal_status: "OCR insufficient-evidence finding announced",
    tags: ["title-vi", "antisemitism", "insufficient-evidence"]
  },
  {
    school_id: "lehigh_university",
    date: "2025-01-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced a shared-ancestry resolution agreement with Lehigh University.",
    description: "According to OCR's What's New page, Lehigh University entered into a resolution agreement to ensure Title VI compliance when responding to allegations of harassment based on shared ancestry.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "johns_hopkins_university",
    date: "2025-01-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced a shared-ancestry resolution agreement with Johns Hopkins University.",
    description: "According to OCR's What's New page, Johns Hopkins University entered into a resolution agreement to ensure Title VI compliance when responding to allegations of harassment based on shared ancestry.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "rutgers_university",
    date: "2025-01-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced resolution of complaints against Rutgers University alleging shared-ancestry discrimination.",
    description: "OCR's What's New page lists resolution materials for complaints against Rutgers University alleging shared-ancestry discrimination.",
    legal_status: "OCR resolution materials published",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "university_of_cincinnati",
    date: "2024-12-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced a resolution agreement with the University of Cincinnati regarding shared-ancestry discrimination allegations.",
    description: "According to OCR's What's New page, OCR secured a resolution agreement from the University of Cincinnati after reviewing reports of alleged harassment based on shared Jewish ancestry as well as Palestinian ancestry during the 2023-2024 academic year.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "temple_university",
    date: "2024-12-01",
    category: "OCR complaint",
    affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
    summary: "OCR announced a resolution agreement with Temple University regarding shared-ancestry discrimination allegations.",
    description: "According to OCR's What's New page, Temple University entered into a resolution agreement after OCR identified Title VI compliance concerns in the university's assessment and response to shared-ancestry harassment reports.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"]
  },
  {
    school_id: "muhlenberg_college",
    date: "2024-12-01",
    category: "OCR complaint",
    affected_communities: ["Jewish"],
    summary: "OCR announced resolution of an antisemitism investigation of Muhlenberg College.",
    description: "According to OCR's What's New page, Muhlenberg College entered into a resolution agreement after OCR identified compliance concerns regarding repeated reports in a single semester involving possible hostile-environment concerns for Jewish students.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-vi", "antisemitism", "resolution-agreement"]
  },
  {
    school_id: "hinds_community_college",
    date: "2024-06-01",
    category: "Pregnancy discrimination",
    affected_communities: ["Pregnant students", "Women"],
    summary: "OCR announced resolution of a pregnancy harassment and disability discrimination investigation involving Hinds Community College.",
    description: "According to OCR's What's New page, OCR resolved an investigation involving pregnancy harassment and disability discrimination at Hinds Community College, including findings related to Title IX and Section 504 compliance.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "section-504", "pregnancy-discrimination", "resolution-agreement"]
  },
  {
    school_id: "arcadia_university",
    date: "2024-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR resolved a sexual harassment compliance review of Arcadia University.",
    description: "OCR's What's New page lists a resolution agreement with Arcadia University to ensure compliance with Title IX when responding to complaints of sexual harassment.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "sexual-harassment", "resolution-agreement"]
  },
  {
    school_id: "taft_college",
    date: "2024-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced resolution of a sex-based harassment investigation of Taft College.",
    description: "OCR's What's New page states that Taft College entered a resolution agreement to ensure Title IX compliance when responding to allegations of employee harassment based on sex, including sex stereotyping.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "sex-based-harassment", "resolution-agreement"]
  },
  {
    school_id: "montgomery_college",
    date: "2023-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced a resolution agreement with Montgomery College regarding a sexual harassment complaint.",
    description: "According to OCR's What's New page, Montgomery College, Takoma/Silver Spring Campus, entered a resolution agreement to resolve a sexual harassment complaint.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "sexual-harassment", "resolution-agreement"]
  },
  {
    school_id: "troy_university",
    date: "2023-01-01",
    category: "Pregnancy discrimination",
    affected_communities: ["Pregnant students", "Women"],
    summary: "OCR announced resolution of a pregnancy discrimination complaint against Troy University.",
    description: "OCR's What's New page states that Troy University entered a voluntary resolution agreement regarding a student's pregnancy discrimination complaint and Title IX protections for pregnant students.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "pregnancy-discrimination", "resolution-agreement"]
  },
  {
    school_id: "salt_lake_community_college",
    date: "2023-01-01",
    category: "Pregnancy discrimination",
    affected_communities: ["Pregnant students", "Women"],
    summary: "OCR announced resolution of a pregnancy discrimination complaint against Salt Lake Community College.",
    description: "OCR's What's New page states that Salt Lake Community College entered a resolution agreement after OCR investigated allegations involving pregnancy discrimination and academic adjustments.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "section-504", "pregnancy-discrimination", "resolution-agreement"]
  },
  {
    school_id: "michigan_state_university",
    date: "2019-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "The Department of Education announced a fine and corrective action for Michigan State University following Title IX investigations.",
    description: "OCR's What's New page states that the Department announced a record fine and required corrective action for Michigan State University following investigations into systemic failure to protect students from sexual abuse.",
    legal_status: "Federal fine and corrective action announced",
    tags: ["title-ix", "sexual-abuse", "corrective-action"]
  },
  {
    school_id: "wittenberg_university",
    date: "2018-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced an agreement with Wittenberg University after finding Title IX violations in handling sexual assault reports.",
    description: "OCR's What's New page states that OCR reached an agreement with Wittenberg University after finding that the university's handling of complaints arising from reports of sexual assault violated Title IX.",
    legal_status: "OCR agreement after Title IX finding",
    tags: ["title-ix", "sexual-assault", "resolution-agreement"]
  },
  {
    school_id: "elmira_college",
    date: "2015-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced an agreement with Elmira College after finding Title IX response concerns.",
    description: "OCR's What's New page states that OCR reached an agreement with Elmira College after finding the college violated Title IX by failing to promptly and equitably respond to complaints of sexual harassment and sexual violence.",
    legal_status: "OCR agreement after Title IX finding",
    tags: ["title-ix", "sexual-harassment", "sexual-violence", "resolution-agreement"]
  },
  {
    school_id: "hunter_college",
    date: "2015-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced an agreement with CUNY and Hunter College related to Title IX complaint handling.",
    description: "OCR's What's New page states that OCR reached an agreement with CUNY and Hunter College after finding that the college violated Title IX by failing to promptly and equitably respond to complaints of sexual harassment and sexual violence.",
    legal_status: "OCR agreement after Title IX finding",
    tags: ["title-ix", "sexual-harassment", "sexual-violence", "resolution-agreement"]
  },
  {
    school_id: "wesley_college",
    date: "2015-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced an agreement with Wesley College related to Title IX sexual violence and harassment procedures.",
    description: "OCR's What's New page states that OCR entered into an agreement with Wesley College after determining Title IX concerns in how the college handled a sexual misconduct case.",
    legal_status: "OCR agreement after Title IX finding",
    tags: ["title-ix", "sexual-violence", "sexual-harassment", "resolution-agreement"]
  },
  {
    school_id: "frostburg_state_university",
    date: "2015-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced an agreement with Frostburg State University to ensure civil-rights compliance.",
    description: "OCR's What's New page lists an agreement with Frostburg State University of the University System of Maryland to ensure compliance with federal civil-rights requirements.",
    legal_status: "OCR agreement announced",
    tags: ["title-ix", "resolution-agreement"]
  },
  {
    school_id: "minot_state_university",
    date: "2015-01-01",
    category: "Disability access",
    affected_communities: ["Students with disabilities"],
    summary: "OCR announced a resolution agreement with Minot State University after finding civil-rights violations.",
    description: "OCR's What's New page lists a resolution agreement with Minot State University after finding the university in violation of federal civil-rights requirements.",
    legal_status: "OCR resolution agreement announced",
    tags: ["disability", "section-504", "resolution-agreement"]
  },
  {
    school_id: "occidental_college",
    date: "2013-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced a settlement with Occidental College to resolve a sexual violence and harassment complaint investigation.",
    description: "OCR's What's New page states that OCR reached a settlement with Occidental College to resolve a sexual violence and sexual harassment complaint investigation.",
    legal_status: "OCR settlement announced",
    tags: ["title-ix", "sexual-violence", "sexual-harassment", "settlement"]
  },
  {
    school_id: "erie_community_college",
    date: "2013-01-01",
    category: "Athletic equity",
    affected_communities: ["Women"],
    summary: "OCR announced a settlement with Erie Community College related to women's access to athletic opportunities.",
    description: "OCR's What's New page states that OCR reached a settlement with Erie Community College to resolve issues of women's access to athletic opportunities.",
    legal_status: "OCR settlement announced",
    tags: ["title-ix", "athletic-equity", "settlement"]
  },
  {
    school_id: "university_of_virginia",
    date: "2011-01-01",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    summary: "OCR announced a resolution agreement with the University of Virginia regarding sexual violence and harassment handling.",
    description: "OCR's What's New page states that OCR and the University of Virginia announced a resolution agreement to ensure the university's handling of sexual violence and sexual harassment complies with Title IX.",
    legal_status: "OCR resolution agreement announced",
    tags: ["title-ix", "sexual-violence", "sexual-harassment", "resolution-agreement"]
  }
];

const [eventsData, schoolsData, sourcesData, briefsData] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs)
]);

if (!sourcesData.some((item) => item.id === source.id)) {
  sourcesData.push(source);
}

const schoolIds = new Set(schoolsData.map((school) => school.id));
for (const [id, name, city, state] of schools) {
  if (!schoolIds.has(id)) {
    schoolsData.push({ id, name, city, state, country: "US", website: "" });
  }
}

const existingEventIds = new Set(eventsData.map((event) => event.id));
const importedEventIds = [];

for (const [index, record] of records.entries()) {
  const eventId = `evt_2026_${String(index + 1).padStart(4, "0")}`;
  importedEventIds.push(eventId);
  if (existingEventIds.has(eventId)) continue;

  const school = schoolsData.find((item) => item.id === record.school_id);
  eventsData.push({
    id: eventId,
    school_id: record.school_id,
    date: record.date,
    date_precision: "day",
    location: `${school.city}, ${school.state}`,
    affected_communities: record.affected_communities,
    category: record.category,
    summary: record.summary,
    description: record.description,
    source_ids: [source.id],
    source_types: [source.source_type],
    institutional_response: "The record summarizes OCR's public announcement and does not independently evaluate the institution's completed response.",
    response_date: record.date,
    legal_status: record.legal_status,
    verification_status: "Verified from public source",
    confidence: "Medium",
    tags: record.tags,
    created_at: "2026-06-03",
    updated_at: "2026-06-03",
    record_hash: "",
    changelog: [
      {
        date: "2026-06-03",
        note: "Imported from Department of Education OCR What's New higher-ed public record."
      }
    ]
  });
}

if (!briefsData.some((brief) => brief.id === "brief_2026_06_03_ocr_higher_ed")) {
  briefsData.push({
    id: "brief_2026_06_03_ocr_higher_ed",
    title: "OCR Higher-Education Public Record Import",
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: "2026-06-03",
    summary: "Campus Evidence Lab imported a public-source batch of OCR higher-education civil-rights records from the Department of Education's What's New in OCR page.",
    new_event_ids: importedEventIds,
    updated_event_ids: [],
    correction_ids: [],
    snapshot_hash: ""
  });
}

schoolsData.sort((a, b) => a.name.localeCompare(b.name));
eventsData.sort((a, b) => a.id.localeCompare(b.id));
sourcesData.sort((a, b) => a.id.localeCompare(b.id));
briefsData.sort((a, b) => a.published_date.localeCompare(b.published_date) || a.id.localeCompare(b.id));

await Promise.all([
  writeJson(paths.events, eventsData),
  writeJson(paths.schools, schoolsData),
  writeJson(paths.sources, sourcesData),
  writeJson(paths.briefs, briefsData)
]);

console.log(`Imported ${importedEventIds.length} OCR higher-ed records.`);
