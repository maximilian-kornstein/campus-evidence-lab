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
  ["100858001", "Auburn University", "Auburn University", "182 South College Street", "Auburn", "AL", "36849", "2024", "Intimidation", "Gender", "INTIM_GEN24", 4],
  ["490744003", "Northern Technical College", "Northern Technical College North Little Rock", "2641 pike ave", "north little rock", "AR", "72114", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["105154001", "Mesa Community College", "Mesa Community College", "1833 W SOUTHERN AVE", "MESA", "AZ", "85202", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 2],
  ["110565001", "California State University-Fullerton", "Main Campus", "800 N. STATE COLLEGE BLVD", "FULLERTON", "CA", "928319480", "2024", "Intimidation", "Race", "INTIM_RAC24", 5],
  ["126818001", "Colorado State University-Fort Collins", "Main Campus", "102 Administration Building", "Fort Collins", "CO", "805230100", "2024", "Intimidation", "Religion", "INTIM_REL24", 2],
  ["130253001", "Sacred Heart University", "Main Campus", "5151 PARK AVE", "FAIRFIELD", "CT", "068251000", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 2],
  ["131450001", "Gallaudet University", "Main Campus", "800 FLORIDA AVE NE", "WASHINGTON", "DC", "200023695", "2024", "Intimidation", "Ethnicity", "INTIM_ET24", 6],
  ["130943001", "University of Delaware", "Main Campus", "413 Academy St.", "NEWARK", "DE", "19716", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 3],
  ["134608001", "Indian River State College", "Main Campus", "3209 VIRGINIA AVE", "FORT PIERCE", "FL", "349815596", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 2],
  ["482149001", "Augusta University", "Health Science", "1120 15th Street", "AUGUSTA", "GA", "30912", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["153162001", "Cornell College", "Cornell College", "600 FIRST ST SW", "Mount Vernon", "IA", "523141098", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["142522001", "Brigham Young University-Idaho", "Brigham Youn University-Idaho", "525 S CENTER", "Rexburg", "ID", "834601650", "2023", "Intimidation", "Race", "INTIM_RAC23", 1],
  ["146472001", "College of Lake County", "Grayslake Campus", "19351 W WASHINGTON ST.", "GRAYSLAKE", "IL", "600301198", "2024", "Destruction/damage/vandalism", "Ethnicity", "VANDAL_ET24", 3],
  ["151351001", "Indiana University-Bloomington", "Indiana University - Bloomington Campus", "Bryan Hall 100, 107 South Indiana", "BLOOMINGTON", "IN", "474057000", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 4],
  ["155627001", "Ottawa University-Ottawa", "Ottawa, KS Campus", "1001 South Cedar Street", "Ottawa", "KS", "660673399", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["156295001", "Berea College", "Main Campus", "101 Chestnut Street", "BEREA", "KY", "404042184", "2024", "Larceny-theft", "LGBTQ+", "LAR_T_SEX24", 1],
  ["159391001", "Louisiana State University and Agricultural & Mechanical College", "Main Campus", "University Administration BLDG, 3810 W. Lakeshore Drive", "BATON ROUGE", "LA", "70808", "2024", "Intimidation", "Race", "INTIM_RAC24", 3],
  ["168342001", "Williams College", "Main Campus", "880 MAIN ST. PO Box 368", "WILLIAMSTOWN", "MA", "012670368", "2024", "Destruction/damage/vandalism", "Religion", "VANDAL_REL24", 3],
  ["163204119", "University of Maryland Global Campus", "University of Maryland", "7569 Baltimore Avenue", "College Park", "MD", "20742", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 3],
  ["170976001", "University of Michigan-Ann Arbor", "Ann Arbor campus", "1109 Geddes Ave", "ANN ARBOR", "MI", "481091079", "2024", "Intimidation", "National origin", "INTIM_NAT24", 2],
  ["173957001", "Mayo Clinic College of Medicine and Science", "Main Campus", "200 1ST ST SW", "ROCHESTER", "MN", "55905", "2024", "Intimidation", "Race", "INTIM_RAC24", 3],
  ["178624001", "Northwest Missouri State University", "Northwest Missouri State University", "800 UNIVERSITY DRIVE", "MARYVILLE", "MO", "644686001", "2024", "Intimidation", "LGBTQ+", "INTIM_SEX24", 2],
  ["176053001", "Mississippi College", "Main Campus", "200 S CAPITOL ST", "CLINTON", "MS", "390584059", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["180081002", "Highlands College of Montana Tech", "Montana Technological University", "1300 West Park", "Butte", "MT", "59701", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["199120001", "University of North Carolina at Chapel Hill", "The University of North Carolina at Chapel Hill", "CB 9100, 200 South Building UNC-Chapel Hill", "CHAPEL HILL", "NC", "275999100", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 7],
  ["200156001", "University of Jamestown", "Main Campus", "6000 College Lane", "Jamestown", "ND", "58405", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 4],
  ["181428001", "University of Nebraska Medical Center", "Main Campus", "984230 NEBRASKA MEDICAL CTR", "OMAHA", "NE", "681984230", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["182980001", "New England College", "Main Campus", "98 BRIDGE ST", "HENNIKER", "NH", "03242", "2024", "Intimidation", "Gender", "INTIM_GEN24", 1],
  ["475468001", "Christine Valmy International School of Esthetics & Cosmetology", "Main Campus", "201 Willowbrook Blvd. 8th Floor", "Wayne", "NJ", "07470", "2024", "Intimidation", "National origin", "INTIM_NAT24", 4],
  ["188207001", "Southwestern College", "Main Campus", "3960 San Felipe Road", "Santa Fe", "NM", "87507", "2023", "Intimidation", "Race", "INTIM_RAC23", 1],
  ["182281001", "University of Nevada-Las Vegas", "University of Nevada-Las Vegas", "4505 S. Maryland Parkway", "Las Vegas", "NV", "89154", "2022", "Intimidation", "Race", "INTIM_RAC22", 1],
  ["190664001", "CUNY Queens College", "Queens College", "65 30 Kissena Blvd", "Flushing", "NY", "113670904", "2024", "Intimidation", "Race", "INTIM_RAC24", 11],
  ["201973001", "Clark State College", "Main Campus - Leffel Lane", "570 E LEFFEL LN", "SPRINGFIELD", "OH", "455050570", "2024", "Intimidation", "National origin", "INTIM_NAT24", 4],
  ["207500001", "University of Oklahoma-Norman Campus", "Norman Campus", "660 PARRINGTON OVAL", "NORMAN", "OK", "730193072", "2022", "Destruction/damage/vandalism", "Race", "VANDAL_RAC22", 1],
  ["209542001", "Oregon State University", "Corvallis Campus", "600 Kerr Administration Building, 1500 SW Jefferson Ave.", "Corvallis", "OR", "97331", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 4],
  ["214777001", "Pennsylvania State University-Main Campus", "University Park Campus Penn State", "201 OLD MAIN", "UNIVERSITY PARK", "PA", "168021589", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 3],
  ["217493001", "Rhode Island School of Design", "Main Campus", "20 Washington Place", "PROVIDENCE", "RI", "02903", "2024", "Destruction/damage/vandalism", "Religion", "VANDAL_REL24", 2],
  ["218070001", "Furman University", "Main Campus", "3300 POINSETT HWY", "GREENVILLE", "SC", "296136162", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 1],
  ["219046001", "Black Hills State University", "Black Hills State University", "1200 University Street", "Spearfish", "SD", "57799", "2024", "Intimidation", "Ethnicity", "INTIM_ET24", 1],
  ["221999001", "Vanderbilt University", "Main Campus", "2101 WEST END AVENUE", "NASHVILLE", "TN", "37240", "2024", "Intimidation", "Religion", "INTIM_REL24", 3],
  ["223232001", "Baylor University", "Main Campus", "One Bear Place #97121", "Waco", "TX", "767067121", "2024", "Simple assault", "Race", "SIM_A_RAC24", 2],
  ["230764001", "University of Utah", "Main Campus", "201 PRESIDENTS CIRCLE, Rm 203", "SALT LAKE CITY", "UT", "841129008", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 3],
  ["234085001", "Virginia Military Institute", "Virginia Military Institute", "201 Smith Hall", "LEXINGTON", "VA", "244500304", "2024", "Intimidation", "Race", "INTIM_RAC24", 2],
  ["231059001", "Saint Michael's College", "Main Campus", "1 WINOOSKI PARK", "COLCHESTER", "VT", "05439", "2024", "Intimidation", "Race", "INTIM_RAC24", 5],
  ["235167001", "The Evergreen State College", "Main Campus", "2700 EVERGREEN PKY NW", "OLYMPIA", "WA", "98505", "2024", "Destruction/damage/vandalism", "National origin", "VANDAL_NAT24", 7],
  ["238476001", "Carthage College", "Main Campus", "2001 ALFORD PARK DR", "KENOSHA", "WI", "531401994", "2024", "Destruction/damage/vandalism", "Race", "VANDAL_RAC24", 3],
  ["237905001", "West Virginia University Hospital Departments of Rad Tech and Nutrition", "Main Campus", "1 Medical Center Drive", "MORGANTOWN", "WV", "265068062", "2023", "Aggravated assault", "Ethnicity", "AGG_A_ET23", 1],
  ["101161001", "Coastal Alabama Community College", "Coastal Alabama Community College Main Campus - Bay Minette", "1900 U.S. Hwy 31 South", "Bay Minette", "AL", "365072698", "2024", "Intimidation", "Race", "INTIM_RAC24", 2],
  ["106412001", "University of Arkansas at Pine Bluff", "UAPB - University of Arkansas at Pine Bluff", "1200 N UNIVERSITY MAIL SLOT 4789", "Pine Bluff", "AR", "716014789", "2024", "Intimidation", "Race", "INTIM_RAC24", 1],
  ["104151001", "Arizona State University Campus Immersion", "Tempe Campus", "325 E. Apache Blvd.", "TEMPE", "AZ", "852871812", "2024", "Intimidation", "Race", "INTIM_RAC24", 1]
];

function slugify(value) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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

if (!sourcesData.some((item) => item.id === source.id)) sourcesData.push(source);

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
let nextIndex = 126;
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
        note: "Imported from the Department of Education Campus Safety and Security 2025 Excel hate-crime data files for the 250-record diversity checkpoint."
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

if (!briefsData.some((brief) => brief.id === "brief_2026_06_03_ed_campus_safety_hate_data_250_batch")) {
  briefsData.push({
    id: "brief_2026_06_03_ed_campus_safety_hate_data_250_batch",
    title: "Department of Education Campus Safety Hate-Crime Data Expansion II",
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: importedAt,
    summary: "Campus Evidence Lab added a second Department of Education Campus Safety and Security data-file batch to reach the 250-record checkpoint while broadening school coverage across states.",
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

console.log(`Imported ${newEventIds.length} Department of Education campus safety hate-crime data records for the 250 checkpoint.`);
