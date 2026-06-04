import { paths, readJson, writeJson } from "./lib.mjs";

const source = {
  id: "src_ed_2025_03_10_letters_60",
  title: "U.S. Department of Education's Office for Civil Rights Sends Letters to 60 Universities Under Investigation for Antisemitic Discrimination and Harassment",
  url: "https://www.ed.gov/about/news/press-release/us-department-of-educations-office-civil-rights-sends-letters-60-universities-under-investigation-antisemitic-discrimination-and-harassment",
  publisher: "U.S. Department of Education",
  source_type: "Government release",
  published_date: "2025-03-10",
  accessed_date: "2026-06-03"
};

const schools = [
  ["american_university", "American University", "Washington", "DC"],
  ["arizona_state_university", "Arizona State University", "Tempe", "AZ"],
  ["boston_university", "Boston University", "Boston", "MA"],
  ["brown_university", "Brown University", "Providence", "RI"],
  ["california_state_university_sacramento", "California State University, Sacramento", "Sacramento", "CA"],
  ["chapman_university", "Chapman University", "Orange", "CA"],
  ["columbia_university", "Columbia University", "New York", "NY"],
  ["cornell_university", "Cornell University", "Ithaca", "NY"],
  ["drexel_university", "Drexel University", "Philadelphia", "PA"],
  ["eastern_washington_university", "Eastern Washington University", "Cheney", "WA"],
  ["emerson_college", "Emerson College", "Boston", "MA"],
  ["george_mason_university", "George Mason University", "Fairfax", "VA"],
  ["harvard_university", "Harvard University", "Cambridge", "MA"],
  ["illinois_wesleyan_university", "Illinois Wesleyan University", "Bloomington", "IL"],
  ["indiana_university_bloomington", "Indiana University, Bloomington", "Bloomington", "IN"],
  ["johns_hopkins_university", "Johns Hopkins University", "Baltimore", "MD"],
  ["lafayette_college", "Lafayette College", "Easton", "PA"],
  ["lehigh_university", "Lehigh University", "Bethlehem", "PA"],
  ["middlebury_college", "Middlebury College", "Middlebury", "VT"],
  ["muhlenberg_college", "Muhlenberg College", "Allentown", "PA"],
  ["northwestern_university", "Northwestern University", "Evanston", "IL"],
  ["ohio_state_university", "Ohio State University", "Columbus", "OH"],
  ["pacific_lutheran_university", "Pacific Lutheran University", "Tacoma", "WA"],
  ["pomona_college", "Pomona College", "Claremont", "CA"],
  ["portland_state_university", "Portland State University", "Portland", "OR"],
  ["princeton_university", "Princeton University", "Princeton", "NJ"],
  ["rutgers_university", "Rutgers University", "New Brunswick", "NJ"],
  ["rutgers_university_newark", "Rutgers University-Newark", "Newark", "NJ"],
  ["santa_monica_college", "Santa Monica College", "Santa Monica", "CA"],
  ["sarah_lawrence_college", "Sarah Lawrence College", "Bronxville", "NY"],
  ["stanford_university", "Stanford University", "Stanford", "CA"],
  ["suny_binghamton", "State University of New York Binghamton", "Binghamton", "NY"],
  ["suny_rockland", "State University of New York Rockland", "Suffern", "NY"],
  ["suny_purchase", "State University of New York, Purchase", "Purchase", "NY"],
  ["swarthmore_college", "Swarthmore College", "Swarthmore", "PA"],
  ["temple_university", "Temple University", "Philadelphia", "PA"],
  ["the_new_school", "The New School", "New York", "NY"],
  ["tufts_university", "Tufts University", "Medford", "MA"],
  ["tulane_university", "Tulane University", "New Orleans", "LA"],
  ["union_college", "Union College", "Schenectady", "NY"],
  ["university_of_california_davis", "University of California Davis", "Davis", "CA"],
  ["university_of_california_san_diego", "University of California San Diego", "San Diego", "CA"],
  ["university_of_california_santa_barbara", "University of California Santa Barbara", "Santa Barbara", "CA"],
  ["university_of_california_berkeley", "University of California, Berkeley", "Berkeley", "CA"],
  ["university_of_cincinnati", "University of Cincinnati", "Cincinnati", "OH"],
  ["university_of_hawaii_at_manoa", "University of Hawaii at Manoa", "Honolulu", "HI"],
  ["university_of_massachusetts_amherst", "University of Massachusetts Amherst", "Amherst", "MA"],
  ["university_of_michigan", "University of Michigan", "Ann Arbor", "MI"],
  ["university_of_minnesota_twin_cities", "University of Minnesota, Twin Cities", "Minneapolis", "MN"],
  ["university_of_north_carolina", "University of North Carolina", "Chapel Hill", "NC"],
  ["university_of_south_florida", "University of South Florida", "Tampa", "FL"],
  ["university_of_southern_california", "University of Southern California", "Los Angeles", "CA"],
  ["university_of_tampa", "University of Tampa", "Tampa", "FL"],
  ["university_of_tennessee", "University of Tennessee", "Knoxville", "TN"],
  ["university_of_virginia", "University of Virginia", "Charlottesville", "VA"],
  ["university_of_washington", "University of Washington-Seattle", "Seattle", "WA"],
  ["university_of_wisconsin_madison", "University of Wisconsin, Madison", "Madison", "WI"],
  ["wellesley_college", "Wellesley College", "Wellesley", "MA"],
  ["whitman_college", "Whitman College", "Walla Walla", "WA"],
  ["yale_university", "Yale University", "New Haven", "CT"]
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

for (const [index, [schoolId, schoolName, city, state]] of schools.entries()) {
  const eventId = `evt_2025_${String(index + 10).padStart(4, "0")}`;
  importedEventIds.push(eventId);
  if (existingEventIds.has(eventId)) continue;

  eventsData.push({
    id: eventId,
    school_id: schoolId,
    date: "2025-03-10",
    date_precision: "day",
    location: `${city}, ${state}`,
    affected_communities: ["Jewish"],
    category: "OCR complaint",
    summary: `The U.S. Department of Education listed ${schoolName} among 60 universities receiving OCR letters while under investigation or monitoring for antisemitic discrimination and harassment concerns.`,
    description: `According to the Department of Education, OCR sent letters to 60 institutions of higher education on March 10, 2025 warning of potential enforcement actions if institutions do not fulfill Title VI obligations to protect Jewish students. The source lists ${schoolName} among the institutions that received letters.`,
    source_ids: [source.id],
    source_types: [source.source_type],
    institutional_response: "The record currently summarizes the public OCR letter action. It does not evaluate the institution's completed response.",
    response_date: "2025-03-10",
    legal_status: "OCR letter sent while institution was under investigation or monitoring",
    verification_status: "Verified from public source",
    confidence: "High",
    tags: ["title-vi", "shared-ancestry", "ocr", "warning-letter", "antisemitism"],
    created_at: "2026-06-03",
    updated_at: "2026-06-03",
    record_hash: "",
    changelog: [
      {
        date: "2026-06-03",
        note: "Imported from official Department of Education 60-university OCR letter list."
      }
    ]
  });
}

if (!briefsData.some((brief) => brief.id === "brief_2026_06_03_ed_letters")) {
  briefsData.push({
    id: "brief_2026_06_03_ed_letters",
    title: "Department of Education 60-University Letter Import",
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: "2026-06-03",
    summary: "Campus Evidence Lab imported a public-source batch from the Department of Education's March 10, 2025 OCR letter announcement listing 60 institutions under investigation or monitoring for antisemitic discrimination and harassment concerns.",
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

console.log(`Imported ${importedEventIds.length} OCR letter records.`);
