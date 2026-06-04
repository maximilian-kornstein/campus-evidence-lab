import { paths, readJson, writeJson } from "./lib.mjs";

const importedAt = "2026-06-03";
const sourceType = "Annual security report";

function categoryForOffense(offense) {
  if (/vandalism|graffiti|destruction|damage/i.test(offense)) return "Vandalism";
  if (/assault|intimidation|threat|harassment/i.test(offense)) return "Harassment or threat";
  return "Other source-backed civil rights event";
}

const sources = [
  {
    id: "src_arizona_2025_asr_hate_crimes",
    title: "2025 Annual Security & Fire Safety Report",
    url: "https://clery.arizona.edu/asr",
    publisher: "University of Arizona",
    source_type: sourceType,
    published_date: "2026-04-01",
    accessed_date: importedAt
  },
  {
    id: "src_montana_state_2025_asr_hate_crimes",
    title: "2025 Annual Security Report",
    url: "https://www.montana.edu/clery/reports/asr/2025/index.html",
    publisher: "Montana State University",
    source_type: sourceType,
    published_date: "2025-10-01",
    accessed_date: importedAt
  },
  {
    id: "src_wentworth_2025_asfsr_hate_crimes",
    title: "2025 Annual Security and Fire Safety Report",
    url: "https://wit.edu/sites/default/files/2025-09/2025%20Annual%20Security%20and%20Fire%20Safety%20Report%20CY%202022-2023-2024%20%281%29.pdf",
    publisher: "Wentworth Institute of Technology",
    source_type: sourceType,
    published_date: "2025-09-01",
    accessed_date: importedAt
  },
  {
    id: "src_umass_amherst_2024_asr_hate_crimes",
    title: "Annual Security Report for 2024",
    url: "https://www.umass.edu/police/media/175/download",
    publisher: "University of Massachusetts Amherst Police Department",
    source_type: sourceType,
    published_date: "2025-10-01",
    accessed_date: importedAt
  },
  {
    id: "src_farmingdale_hate_crime_resources",
    title: "Hate Crime Resources",
    url: "https://www.farmingdale.edu/university-police/hate-crime-res.shtml",
    publisher: "Farmingdale State College University Police",
    source_type: "Public safety notice",
    published_date: "2025-12-12",
    accessed_date: importedAt
  },
  {
    id: "src_qcc_2025_asr_hate_crimes",
    title: "Queensborough Community College Department of Public Safety 2025 Annual Security Report",
    url: "https://www.qcc.cuny.edu/publicSafety/docs/2025-QCC-ASR.pdf",
    publisher: "Queensborough Community College Department of Public Safety",
    source_type: sourceType,
    published_date: "2025-10-01",
    accessed_date: importedAt
  },
  {
    id: "src_villanova_2025_asfsr_hate_crimes",
    title: "Annual Security and Fire Safety Report 2025",
    url: "https://www.villanova.edu/university/public-safety/reports-policies/annual-security-fire-safety-report-2025.html",
    publisher: "Villanova University Department of Public Safety",
    source_type: sourceType,
    published_date: "2025-10-01",
    accessed_date: importedAt
  },
  {
    id: "src_sjsu_2022_anti_asian_hate_crime",
    title: "Anti-Asian Hate Crime on SJSU Campus",
    url: "https://www.sjsu.edu/diversity/office/comms/archive/20220617_anti-asian_hate_crime_on_sjsu_campus.php",
    publisher: "San Jose State University Office of Diversity, Equity and Inclusion",
    source_type: "University statement",
    published_date: "2022-06-17",
    accessed_date: importedAt
  },
  {
    id: "src_ohio_2023_black_students_threats",
    title: "Reiterating OHIO's commitment to fostering a community of respect",
    url: "https://www.ohio.edu/news/2023/12/reiterating-ohios-commitment-fostering-community-respect",
    publisher: "Ohio University",
    source_type: "University statement",
    published_date: "2023-12-10",
    accessed_date: importedAt
  },
  {
    id: "src_towson_2016_hate_bias_update",
    title: "Hate/bias investigation update",
    url: "https://www.towson.edu/news/2016/hatebiasupdate.html",
    publisher: "Towson University",
    source_type: "University statement",
    published_date: "2016-11-16",
    accessed_date: importedAt
  }
];

const schools = [
  ["university_of_arizona", "University of Arizona", "Tucson", "AZ", "https://www.arizona.edu"],
  ["montana_state_university", "Montana State University", "Bozeman", "MT", "https://www.montana.edu"],
  ["wentworth_institute_of_technology", "Wentworth Institute of Technology", "Boston", "MA", "https://wit.edu"],
  ["farmingdale_state_college", "Farmingdale State College", "Farmingdale", "NY", "https://www.farmingdale.edu"],
  ["queensborough_community_college", "Queensborough Community College", "Bayside", "NY", "https://www.qcc.cuny.edu"],
  ["villanova_university", "Villanova University", "Villanova", "PA", "https://www.villanova.edu"],
  ["san_jose_state_university", "San Jose State University", "San Jose", "CA", "https://www.sjsu.edu"],
  ["ohio_university", "Ohio University", "Athens", "OH", "https://www.ohio.edu"],
  ["towson_university", "Towson University", "Towson", "MD", "https://www.towson.edu"]
];

function asrRecord({
  school_id,
  date,
  source_id,
  affected_communities,
  offense,
  bias,
  geography,
  count = 1,
  tags = []
}) {
  const source = sources.find((item) => item.id === source_id);
  if (!source) {
    throw new Error(`Missing source definition for ${source_id}`);
  }

  const incidentText = count === 1 ? "one reported hate crime" : `${count} reported hate crimes`;
  return {
    school_id,
    date,
    date_precision: "year",
    affected_communities,
    category: categoryForOffense(offense),
    summary: `The annual security report listed ${incidentText}: ${offense} characterized by ${bias}.`,
    description: `According to the institution's annual security report, the school listed ${incidentText} in ${date.slice(0, 4)} involving ${offense} characterized by ${bias} in ${geography}.`,
    institutional_response: "The record summarizes a public Clery/annual security report entry and does not independently evaluate investigative or disciplinary outcomes.",
    response_date: date,
    legal_status: "Reported in annual security or hate-crime statistics",
    verification_status: "Verified from public source",
    confidence: "Medium",
    source_ids: [source_id],
    source_types: [source.source_type],
    tags: ["clery", "hate-crime-statistics", ...tags]
  };
}

const protectedClass = {
  race: ["Race"],
  racial: ["Race"],
  religion: ["Religion"],
  religious: ["Religion"],
  nationalOrigin: ["National origin"],
  ethnicity: ["Ethnicity"],
  sexualOrientation: ["LGBTQ+"],
  genderIdentity: ["LGBTQ+"],
  gender: ["Gender"],
  disability: ["Students with disabilities"]
};

const records = [
  ...[
    ["2022-01-01", protectedClass.sexualOrientation, "four on-campus aggravated assault incidents", "sexual orientation bias", "on campus", 4, ["sexual-orientation-bias"]],
    ["2022-01-01", protectedClass.nationalOrigin, "one on-campus simple assault incident", "national origin bias", "on campus", 1, ["national-origin-bias"]],
    ["2022-01-01", protectedClass.nationalOrigin, "three on-campus intimidation incidents", "national origin bias", "on campus", 3, ["national-origin-bias"]],
    ["2022-01-01", protectedClass.racial, "one on-campus intimidation incident", "racial bias", "on campus", 1, ["racial-bias"]],
    ["2022-01-01", protectedClass.gender, "one on-campus destruction/damage/vandalism incident", "gender bias", "on campus", 1, ["gender-bias"]],
    ["2023-01-01", protectedClass.nationalOrigin, "two public-property intimidation incidents", "national origin bias", "public property", 2, ["national-origin-bias"]],
    ["2023-01-01", protectedClass.ethnicity, "one student-housing destruction/damage/vandalism incident", "ethnicity bias", "on-campus student housing", 1, ["ethnicity-bias"]],
    ["2024-01-01", protectedClass.sexualOrientation, "one on-campus simple assault incident", "sexual orientation bias", "on campus", 1, ["sexual-orientation-bias"]],
    ["2024-01-01", protectedClass.sexualOrientation, "one noncampus intimidation incident", "sexual orientation bias", "noncampus property", 1, ["sexual-orientation-bias"]],
    ["2024-01-01", protectedClass.sexualOrientation, "one student-housing destruction/damage/vandalism incident", "sexual orientation bias", "on-campus student housing", 1, ["sexual-orientation-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "university_of_arizona", date, source_id: "src_arizona_2025_asr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2024-01-01", protectedClass.sexualOrientation, "one on-campus intimidation incident", "sexual orientation bias", "on campus", 1, ["sexual-orientation-bias"]],
    ["2023-01-01", protectedClass.racial, "one student-housing simple assault incident", "racial bias", "on-campus student housing", 1, ["racial-bias"]],
    ["2023-01-01", protectedClass.gender, "one student-housing vandalism incident", "gender bias", "on-campus student housing", 1, ["gender-bias"]],
    ["2023-01-01", protectedClass.racial, "two on-campus intimidation incidents", "racial bias", "on campus", 2, ["racial-bias"]],
    ["2023-01-01", protectedClass.racial, "one student-housing intimidation incident", "racial bias", "on-campus student housing", 1, ["racial-bias"]],
    ["2023-01-01", protectedClass.religious, "one student-housing intimidation incident", "religious bias", "on-campus student housing", 1, ["religious-bias"]],
    ["2023-01-01", protectedClass.sexualOrientation, "one student-housing intimidation incident", "sexual orientation bias", "on-campus student housing", 1, ["sexual-orientation-bias"]],
    ["2023-01-01", protectedClass.sexualOrientation, "one public-property intimidation incident", "sexual orientation bias", "public property", 1, ["sexual-orientation-bias"]],
    ["2022-01-01", protectedClass.racial, "one public-property intimidation incident", "racial bias", "public property", 1, ["racial-bias"]],
    ["2022-01-01", protectedClass.racial, "one noncampus intimidation incident", "racial bias", "noncampus property", 1, ["racial-bias"]],
    ["2022-01-01", protectedClass.racial, "one on-campus intimidation incident", "racial bias", "on campus", 1, ["racial-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "montana_state_university", date, source_id: "src_montana_state_2025_asr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2024-01-01", ["LGBTQ+"], "one on-campus vandalism incident", "sexual orientation and gender identity bias", "on campus", 1, ["sexual-orientation-bias", "gender-identity-bias"]],
    ["2024-01-01", protectedClass.racial, "one residential-facility intimidation incident", "racial bias", "on-campus residential facility", 1, ["racial-bias"]],
    ["2024-01-01", protectedClass.religious, "one residential-facility vandalism incident", "religious bias", "on-campus residential facility", 1, ["religious-bias"]],
    ["2024-01-01", protectedClass.racial, "two public-property intimidation incidents", "racial bias", "public property", 2, ["racial-bias"]],
    ["2023-01-01", protectedClass.nationalOrigin, "one public-property intimidation incident", "national origin issue", "public property", 1, ["national-origin-bias"]],
    ["2022-01-01", protectedClass.gender, "four residential-facility intimidation incidents", "gender bias", "on-campus residential facility", 4, ["gender-bias"]],
    ["2022-01-01", protectedClass.racial, "one residential-facility destruction/damage/vandalism incident", "racial bias", "on-campus residential facility", 1, ["racial-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "wentworth_institute_of_technology", date, source_id: "src_wentworth_2025_asfsr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2024-01-01", ["LGBTQ+", "Race"], "one residence-hall vandalism incident", "sexual orientation and race bias", "on-campus residence hall", 1, ["sexual-orientation-bias", "racial-bias"]],
    ["2024-01-01", ["National origin", "Religion"], "two vandalism incidents", "nationality and religion bias", "campus or non-campus properties", 2, ["national-origin-bias", "religious-bias"]],
    ["2023-01-01", ["National origin", "Religion"], "one on-campus assault incident", "nationality and religion bias", "on campus", 1, ["national-origin-bias", "religious-bias"]],
    ["2022-01-01", protectedClass.racial, "one on-campus assault incident", "racial bias", "on campus", 1, ["racial-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "university_of_massachusetts_amherst", date, source_id: "src_umass_amherst_2024_asr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2021-01-01", protectedClass.racial, "one on-campus graffiti report", "racial bias", "on campus", 1, ["racial-bias"]],
    ["2022-01-01", protectedClass.sexualOrientation, "one on-campus graffiti report", "sexual orientation bias", "on campus", 1, ["sexual-orientation-bias"]],
    ["2022-01-01", protectedClass.religious, "one on-campus graffiti report", "religious bias", "on campus", 1, ["religious-bias"]],
    ["2023-01-01", protectedClass.religious, "one in-person-dispute intimidation report", "religious bias", "on campus", 1, ["religious-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "farmingdale_state_college", date, source_id: "src_farmingdale_hate_crime_resources", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2023-01-01", protectedClass.religious, "one on-campus simple assault report", "religious bias", "on campus", 1, ["religious-bias"]],
    ["2023-01-01", protectedClass.racial, "one on-campus graffiti report", "racial bias", "on campus", 1, ["racial-bias"]],
    ["2024-01-01", protectedClass.racial, "one on-campus graffiti report", "racial bias", "on campus", 1, ["racial-bias"]],
    ["2024-01-01", protectedClass.religious, "one on-campus graffiti report", "religious bias", "on campus", 1, ["religious-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "queensborough_community_college", date, source_id: "src_qcc_2025_asr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  ...[
    ["2024-01-01", protectedClass.racial, "one on-campus intimidation incident", "racial bias", "university campus", 1, ["racial-bias"]],
    ["2024-01-01", protectedClass.sexualOrientation, "one on-campus intimidation incident", "perceived sexual orientation bias", "university campus", 1, ["sexual-orientation-bias"]],
    ["2024-01-01", protectedClass.sexualOrientation, "one on-campus intimidation incident", "perceived sexual orientation bias", "university campus", 1, ["sexual-orientation-bias"]],
    ["2024-01-01", protectedClass.religious, "one on-campus destruction-of-property incident", "religious bias", "university campus", 1, ["religious-bias"]],
    ["2024-01-01", protectedClass.nationalOrigin, "one on-campus destruction-of-property incident", "national origin bias", "university campus", 1, ["national-origin-bias"]],
    ["2023-01-01", protectedClass.racial, "one on-campus intimidation incident", "racial bias", "university campus", 1, ["racial-bias"]],
    ["2023-01-01", protectedClass.racial, "one on-campus intimidation incident", "racial bias", "university campus", 1, ["racial-bias"]],
    ["2023-01-01", protectedClass.racial, "one public-property intimidation incident", "racial bias", "public property", 1, ["racial-bias"]],
    ["2022-01-01", protectedClass.ethnicity, "one on-campus intimidation incident", "ethnic bias", "university campus", 1, ["ethnicity-bias"]],
    ["2022-01-01", protectedClass.religious, "one on-campus intimidation incident", "religious bias", "university campus", 1, ["religious-bias"]]
  ].map(([date, affected_communities, offense, bias, geography, count, tags]) =>
    asrRecord({ school_id: "villanova_university", date, source_id: "src_villanova_2025_asfsr_hate_crimes", affected_communities, offense, bias, geography, count, tags })
  ),
  {
    school_id: "san_jose_state_university",
    date: "2022-06-17",
    date_precision: "day",
    affected_communities: ["Asian"],
    category: "Criminal investigation",
    summary: "San Jose State University publicly addressed an anti-Asian hate crime attack on campus.",
    description: "According to San Jose State University's Office of Diversity, Equity and Inclusion, an SJSUAlert described an anti-Asian hate crime attack that targeted a male of Asian descent on campus, and the university stated that the suspect was arrested.",
    institutional_response: "The university statement describes outreach to AAPI campus groups, coordination with University Police, and support resources; this record does not independently evaluate investigative outcomes.",
    response_date: "2022-06-17",
    legal_status: "University public statement after reported hate crime",
    verification_status: "Verified from public source",
    confidence: "High",
    source_ids: ["src_sjsu_2022_anti_asian_hate_crime"],
    source_types: ["University statement"],
    tags: ["anti-asian-hate", "hate-crime", "university-statement"]
  },
  {
    school_id: "ohio_university",
    date: "2023-12-10",
    date_precision: "day",
    affected_communities: ["Black"],
    category: "Harassment or threat",
    summary: "Ohio University publicly addressed an alleged incident involving racial slurs and threats directed at three Black students.",
    description: "According to an Ohio University message to the Athens campus, community members received a police notification about an incident that allegedly involved racial slurs and threats directed at three Black students.",
    institutional_response: "The university message condemned the alleged bigotry and threats, noted that the investigation was ongoing, and stated that the record does not resolve investigative findings.",
    response_date: "2023-12-10",
    legal_status: "University public statement; investigation described as ongoing",
    verification_status: "Verified from public source",
    confidence: "High",
    source_ids: ["src_ohio_2023_black_students_threats"],
    source_types: ["University statement"],
    tags: ["anti-black-racism", "racial-slurs", "threats", "university-statement"]
  },
  {
    school_id: "towson_university",
    date: "2016-11-16",
    date_precision: "day",
    affected_communities: ["Black"],
    category: "Institutional response",
    summary: "Towson University publicly updated a hate/bias investigation involving two Black students reportedly followed and called a racial slur.",
    description: "According to Towson University's public update, a social media post described two Black students being followed by a group and repeatedly called a racial slur; the university stated that its investigation determined the incident occurred the prior April and involved a non-affiliate.",
    institutional_response: "The university update states that campus police identified the non-affiliate and issued a denial of access to campus; this record summarizes that public statement without independently evaluating the investigation.",
    response_date: "2016-11-16",
    legal_status: "University hate/bias investigation update",
    verification_status: "Verified from public source",
    confidence: "High",
    source_ids: ["src_towson_2016_hate_bias_update"],
    source_types: ["University statement"],
    tags: ["anti-black-racism", "racial-slurs", "hate-bias-investigation", "university-statement"]
  }
];

const [eventsData, schoolsData, sourcesData, briefsData] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs)
]);

const sourceIds = new Set(sourcesData.map((source) => source.id));
for (const source of sources) {
  if (!sourceIds.has(source.id)) sourcesData.push(source);
}

const schoolIds = new Set(schoolsData.map((school) => school.id));
for (const [id, name, city, state, website] of schools) {
  if (!schoolIds.has(id)) schoolsData.push({ id, name, city, state, country: "US", website });
}

const existingEventIds = new Set(eventsData.map((event) => event.id));
const newEventIds = [];
let nextIndex = 28;

for (const record of records) {
  const eventId = `evt_2026_${String(nextIndex).padStart(4, "0")}`;
  nextIndex += 1;
  const school = schoolsData.find((item) => item.id === record.school_id);
  const nextEvent = {
    id: eventId,
    school_id: record.school_id,
    date: record.date,
    date_precision: record.date_precision,
    location: `${school.city}, ${school.state}`,
    affected_communities: record.affected_communities,
    category: record.category,
    summary: record.summary,
    description: record.description,
    source_ids: record.source_ids,
    source_types: record.source_types,
    institutional_response: record.institutional_response,
    response_date: record.response_date,
    legal_status: record.legal_status,
    verification_status: record.verification_status,
    confidence: record.confidence,
    tags: record.tags,
    created_at: importedAt,
    updated_at: importedAt,
    record_hash: "",
    changelog: [
      {
        date: importedAt,
        note: "Imported from public Clery, annual security, or university hate/bias response source for the 150-record diversity checkpoint."
      }
    ]
  };

  newEventIds.push(eventId);
  const existingIndex = eventsData.findIndex((event) => event.id === eventId);
  if (existingIndex >= 0) {
    eventsData[existingIndex] = { ...eventsData[existingIndex], ...nextEvent };
  } else {
    eventsData.push(nextEvent);
  }
}

if (!briefsData.some((brief) => brief.id === "brief_2026_06_03_clery_hate_crime_batch")) {
  briefsData.push({
    id: "brief_2026_06_03_clery_hate_crime_batch",
    title: "Clery and University Hate/Bias Record Expansion",
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: importedAt,
    summary: "Campus Evidence Lab added a public-source batch from annual security reports, public safety pages, and university hate/bias response statements to broaden community, source-type, school, and state coverage.",
    new_event_ids: newEventIds,
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

console.log(`Imported ${newEventIds.length} Clery and university hate/bias records.`);
