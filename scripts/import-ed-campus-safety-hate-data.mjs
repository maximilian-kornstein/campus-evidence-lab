import { paths, readJson, writeJson } from "./lib.mjs";

const importedAt = "2026-06-03";
const sourceId = "src_ed_campus_safety_2025_hate_crime_data_files";
const sourceType = "Government dataset";

const source = {
  id: sourceId,
  title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
  url: "https://ope.ed.gov/campussafety/#/datafile/list",
  publisher: "U.S. Department of Education Office of Postsecondary Education",
  source_type: sourceType,
  published_date: "2026-04-30",
  accessed_date: importedAt
};

const selectedRecords = [
  ["102553001", "University of Alaska Anchorage", "Anchorage Campus", "3211 Providence Dr", "Anchorage", "AK", "99508", "2024", "Destruction/damage/vandalism", "LGBTQ+", "VANDAL_SEX24", 2],
  ["106306001", "Arkansas Baptist College", "Arkansas Baptist College", "1600 Martin Luther King Drive", "LITTLE ROCK", "AR", "722026099", "2024", "Larceny-theft", "Religion", "LAR_T_REL24", 2],
  ["126614001", "University of Colorado Boulder", "University of Colorado Boulder", "Campus Box 17 UCB", "Boulder", "CO", "803090017", "2024", "Intimidation", "Race", "INTIM_RAC24", 4],
  ["153658001", "University of Iowa", "Main Campus", "JESSUP HALL", "IOWA CITY", "IA", "522421316", "2024", "Destruction/damage/vandalism", "Religion", "VANDAL_REL24", 6],
  ["142115001", "Boise State University", "Main Campus", "1910 UNIVERSITY DR", "BOISE", "ID", "837251291", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["155399001", "Kansas State University", "Main Campus", "110 ANDERSON HALL", "MANHATTAN", "KS", "665061303", "2024", "Destruction/damage/vandalism", "LGBTQ+", "VANDAL_SEX24", 3],
  ["161341001", "University of Maine at Presque Isle", "University of Maine at Presque Isle", "181 Main Street", "PRESQUE ISLE", "ME", "047692888", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 1],
  ["179566001", "Missouri State University-Springfield", "Springfield Campus", "901 S NATIONAL", "SPRINGFIELD", "MO", "65897", "2024", "Destruction/damage/vandalism", "LGBTQ+", "VANDAL_SEX24", 5],
  ["181464001", "University of Nebraska-Lincoln", "Main Campus", "14th and R St", "Lincoln", "NE", "685880419", "2024", "Intimidation", "Race", "INTIM_RAC24", 4],
  ["183080001", "Plymouth State University", "Main Campus", "17 HIGH ST", "PLYMOUTH", "NH", "032641595", "2024", "Destruction/damage/vandalism", "Religion", "VANDAL_REL24", 3],
  ["187985001", "University of New Mexico-Main Campus", "University of New Mexico - Main Campus", "2500 Campus Blvd. NE MSC02 1540", "ALBUQUERQUE", "NM", "87131", "2024", "Simple assault", "Race", "SIM_A_RAC24", 2],
  ["182290001", "University of Nevada-Reno", "Main Campus", "1664 N. Virginia Street", "Reno", "NV", "895570250", "2024", "Larceny-theft", "Religion", "LAR_T_REL24", 1],
  ["207449001", "Oklahoma City Community College", "Main Campus", "7777 S MAY AVE", "OKLAHOMA CITY", "OK", "731599987", "2023", "Intimidation", "Race", "INTIM_RAC23", 1],
  ["242617001", "Inter American University of Puerto Rico-San German", "SAN GERMAN CAMPUS", "INTERAMERICAN UNIVERSITY AVENUE", "SAN GERMAN", "PR", "006839801", "2024", "Destruction/damage/vandalism", "Gender", "VANDAL_GEN24", 2],
  ["217882001", "Clemson University", "Main Campus", "201 Sikes Hall", "Clemson", "SC", "29634", "2024", "Intimidation", "Race", "INTIM_RAC24", 2],
  ["219082001", "Dakota State University", "Main Campus", "820 N WASHINGTON", "MADISON", "SD", "57042", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 2],
  ["228723001", "Texas A&M University-College Station", "Texas A&M University", "Main Campus", "COLLEGE STATION", "TX", "77843", "2024", "Intimidation", "Religion", "INTIM_REL24", 5],
  ["238032001", "West Virginia University", "Morgantown", "1500 University Avenue", "MORGANTOWN", "WV", "26506", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 2],
  ["240505001", "Casper College", "Casper College", "125 College Drive", "Casper", "WY", "826014699", "2023", "Intimidation", "LGBTQ+", "INTIM_GID23", 1],
  ["102614001", "University of Alaska Fairbanks", "Troth Yeddha' Campus (Fairbanks)", "P.O. Box 757500", "FAIRBANKS", "AK", "997757480", "2024", "Larceny-theft", "LGBTQ+", "LAR_T_SEX24", 1],
  ["106397001", "University of Arkansas", "Main Campus", "ADMINISTRATION BLDG 425", "FAYETTEVILLE", "AR", "727011201", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 2],
  ["126580001", "University of Colorado Colorado Springs", "University of Colorado Colorado Springs", "1420 AUSTIN BLUFFS PKWY", "COLORADO SPRINGS", "CO", "80918", "2024", "Intimidation", "Race", "INTIM_RAC24", 4],
  ["152992001", "Briar Cliff University", "Main Campus", "3303 REBECCA ST", "SIOUX CITY", "IA", "51104", "2024", "Intimidation", "Gender", "INTIM_GEN24", 2],
  ["455114003", "College of Western Idaho", "Canyon County Center", "2407 Caldwell Blvd", "Nampa", "ID", "83651", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 1],
  ["155317001", "University of Kansas", "Main Campus (Lawrence)", "1450 Jayhawk Boulevard", "Lawrence", "KS", "66045", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 2],
  ["161545001", "Southern Maine Community College", "Southern Maine Community College", "2 FORT RD", "SOUTH PORTLAND", "ME", "041061698", "2023", "Simple assault", "Gender", "SIM_A_GEN23", 1],
  ["176770001", "Cox College", "Cox College", "1423 N JEFFERSON AVE.", "SPRINGFIELD", "MO", "65802", "2024", "Intimidation", "Race", "INTIM_RAC24", 3],
  ["181446001", "Nebraska Wesleyan University", "Main Campus", "5000 Saint Paul Avenue", "LINCOLN", "NE", "685042794", "2024", "Destruction/damage/vandalism", "Ethnicity", "VANDAL_ET24", 2],
  ["182670001", "Dartmouth College", "Dartmouth College Main Campus", "14 North Main Street", "HANOVER", "NH", "03755", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 2],
  ["488554001", "Burrell College of Osteopathic Medicine", "Main Campus", "3501 Arrowhead Drive", "Las Cruces", "NM", "88001", "2024", "Simple assault", "Ethnicity", "SIM_A_ET24", 1],
  ["182005001", "College of Southern Nevada", "College of Southern Nevada - Charleston", "6375 West Charleston Blvd.", "Las Vegas", "NV", "89146", "2023", "Destruction/damage/vandalism", "Religion", "VANDAL_REL23", 1],
  ["207290001", "Northeastern Oklahoma A&M College", "Main Campus", "200 I ST NE", "Miami", "OK", "74354", "2022", "Intimidation", "Race", "INTIM_RAC22", 1],
  ["218663001", "University of South Carolina-Columbia", "Main Campus", "Osborne Building", "COLUMBIA", "SC", "29208", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 2],
  ["219000001", "Augustana University", "Main Campus", "2001 S SUMMIT AVE", "SIOUX FALLS", "SD", "57197", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["229027001", "The University of Texas at San Antonio", "Main Campus", "One UTSA Circle", "San Antonio", "TX", "78249", "2024", "Intimidation", "Religion", "INTIM_REL24", 3],
  ["237969001", "West Virginia Wesleyan College", "Main Campus", "59 College Avenue", "Buckhannon", "WV", "262012994", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 2],
  ["240657001", "Northwest College", "Northwest College", "231 W 6TH ST", "POWELL", "WY", "82435", "2022", "Simple assault", "LGBTQ+", "SIM_A_SEX22", 2],
  ["492069001", "Champion Christian College", "Main Campus", "600 Garland Avenue", "Hot Springs", "AR", "71913", "2024", "Intimidation", "Religion", "INTIM_REL24", 1],
  ["126678001", "Colorado College", "Colorado College", "14 E CACHE LA POUDRE", "COLORADO SPRINGS", "CO", "80903", "2024", "Destruction/damage/vandalism", "Religion", "VANDAL_REL24", 2],
  ["154095001", "University of Northern Iowa", "Main Campus", "1222 W 27TH ST", "CEDAR FALLS", "IA", "50614", "2024", "Larceny-theft", "Religion", "LAR_T_REL24", 2],
  ["142276001", "Idaho State University", "ISU - Pocatello", "921 South 8th Avenue, Stop 8310", "Pocatello", "ID", "832098310", "2024", "Intimidation", "National origin", "INTIM_NAT24", 1],
  ["154721001", "Bethany College", "Main Campus", "335 E Swensson", "LINDSBORG", "KS", "67456", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["161226001", "University of Maine at Farmington", "University of Maine at Farmington", "224 MAIN ST", "FARMINGTON", "ME", "04938", "2022", "Intimidation", "Race", "INTIM_RAC22", 1],
  ["177214001", "Drury University", "Drury University", "900 N. Benton Avenue", "Springfield", "MO", "65802", "2024", "Destruction/damage/vandalism", "LGBTQ+", "VANDAL_SEX24", 2],
  ["181534001", "Peru State College", "Peru State College", "600 Hoyt Street", "Peru", "NE", "684210010", "2024", "Destruction/damage/vandalism", "LGBTQ+", "VANDAL_SEX24", 2]
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function categoryForOffense(offense) {
  if (/vandalism|destruction|damage/i.test(offense)) return "Vandalism";
  if (/assault|intimidation|threat|harassment/i.test(offense)) return "Harassment or threat";
  return "Other source-backed civil rights event";
}

function incidentText(count) {
  return count === 1 ? "one reported on-campus hate-crime statistic" : `${count} reported on-campus hate-crime statistics`;
}

function tagForCode(code) {
  return code.toLowerCase().replace(/_/g, "-");
}

const records = selectedRecords.map(([unitid, name, branch, address, city, state, zip, year, offense, bias, code, count]) => ({
  unitid,
  name,
  branch,
  address,
  city,
  state,
  zip,
  year,
  offense,
  bias,
  code,
  count,
  school_id: slugify(name)
}));

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
for (const record of records) {
  if (!schoolIds.has(record.school_id)) {
    schoolsData.push({
      id: record.school_id,
      name: record.name,
      city: record.city,
      state: record.state,
      country: "US"
    });
    schoolIds.add(record.school_id);
  }
}

const newEventIds = [];
let nextIndex = 81;
for (const record of records) {
  const eventId = `evt_2026_${String(nextIndex).padStart(4, "0")}`;
  nextIndex += 1;
  newEventIds.push(eventId);

  const countText = incidentText(record.count);
  const nextEvent = {
    id: eventId,
    school_id: record.school_id,
    date: `${record.year}-01-01`,
    date_precision: "year",
    location: `${record.city}, ${record.state}`,
    affected_communities: [record.bias],
    category: categoryForOffense(record.offense),
    summary: `ED campus safety data listed ${countText} for ${record.name}: ${record.offense} characterized by ${record.bias}.`,
    description: `According to the Department of Education Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files, the Oncampushate222324.xlsx workbook listed ${countText} for ${record.name} in ${record.year}: ${record.offense} characterized by ${record.bias}.`,
    source_ids: [sourceId],
    source_types: [sourceType],
    institutional_response: "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
    response_date: `${record.year}-01-01`,
    legal_status: "Reported in Department of Education campus safety hate-crime statistics",
    verification_status: "Verified from public source",
    confidence: "Medium",
    tags: ["ed-campus-safety-data", "clery", "hate-crime-statistics", "on-campus", tagForCode(record.code)],
    created_at: importedAt,
    updated_at: importedAt,
    record_hash: "",
    changelog: [
      {
        date: importedAt,
        note: "Imported from the Department of Education Campus Safety and Security 2025 Excel hate-crime data files for the 200-record diversity checkpoint."
      }
    ]
  };

  const existingIndex = eventsData.findIndex((event) => event.id === eventId);
  if (existingIndex >= 0) {
    eventsData[existingIndex] = { ...eventsData[existingIndex], ...nextEvent };
  } else {
    eventsData.push(nextEvent);
  }
}

if (!briefsData.some((brief) => brief.id === "brief_2026_06_03_ed_campus_safety_hate_data_batch")) {
  briefsData.push({
    id: "brief_2026_06_03_ed_campus_safety_hate_data_batch",
    title: "Department of Education Campus Safety Hate-Crime Data Expansion",
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: importedAt,
    summary: "Campus Evidence Lab added a Department of Education Campus Safety and Security data-file batch to broaden school and state coverage with source-backed Clery hate-crime statistics.",
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

console.log(`Imported ${newEventIds.length} Department of Education campus safety hate-crime data records.`);
