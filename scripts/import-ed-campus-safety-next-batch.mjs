import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { paths, readJson, writeJson } from "./lib.mjs";

const importedAt = "2026-06-03";
const targetCount = Number(process.argv[2] || 0);
const workbookPath = process.argv[3] || "/tmp/cel-ope/Oncampushate222324.xlsx";
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

if (!Number.isInteger(targetCount) || targetCount <= 0) {
  throw new Error("Usage: node scripts/import-ed-campus-safety-next-batch.mjs <target-count> [workbook-path]");
}

if (!existsSync(workbookPath)) {
  throw new Error(`Missing workbook at ${workbookPath}. Extract Oncampushate222324.xlsx from Crime2025EXCEL.zip first.`);
}

function xml(entry) {
  return execFileSync("unzip", ["-p", workbookPath, entry], {
    encoding: "utf8",
    maxBuffer: 220 * 1024 * 1024
  });
}

function decodeXml(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function sharedStrings() {
  const content = xml("xl/sharedStrings.xml");
  return [...content.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decodeXml(match[1]));
}

function columnIndex(column) {
  let index = 0;
  for (const character of column) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index - 1;
}

function parseWorkbookRows() {
  const strings = sharedStrings();
  const sheet = xml("xl/worksheets/sheet1.xml");
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const column = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
      if (!column) continue;
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      row[columnIndex(column)] = type === "s" ? strings[Number(raw)] : decodeXml(raw);
    }
    rows.push(row);
  }
  return rows;
}

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

const offenseMap = {
  MURD: "Murder/non-negligent manslaughter",
  RAPE: "Rape",
  FOND: "Fondling",
  INCE: "Incest",
  STAT: "Statutory rape",
  ROBBE: "Robbery",
  AGG_A: "Aggravated assault",
  BURGLA: "Burglary",
  VEHIC: "Motor vehicle theft",
  ARSON: "Arson",
  SIM_A: "Simple assault",
  LAR_T: "Larceny-theft",
  INTIM: "Intimidation",
  VANDAL: "Destruction/damage/vandalism"
};

const biasMap = {
  RAC: "Race",
  REL: "Religion",
  SEX: "LGBTQ+",
  GEN: "Gender",
  GID: "LGBTQ+",
  DIS: "Students with disabilities",
  ET: "Ethnicity",
  NAT: "National origin"
};

const [eventsData, schoolsData, sourcesData, briefsData] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs)
]);

if (eventsData.length >= targetCount) {
  console.log(`Dataset already has ${eventsData.length} records; target ${targetCount} reached.`);
  process.exit(0);
}

const batchSize = targetCount - eventsData.length;
const existingSchoolIds = new Set(schoolsData.map((school) => school.id));
const existingSchoolNames = new Set(schoolsData.map((school) => school.name.toLowerCase()));
const rows = parseWorkbookRows();
const headers = rows[0];
const candidates = [];

for (const row of rows.slice(1)) {
  const [unitid, name, , branch, address, city, state, zip] = row.map((value) => String(value || "").trim());
  const schoolId = slugify(name);
  if (!name || !city || !state || existingSchoolIds.has(schoolId) || existingSchoolNames.has(name.toLowerCase())) {
    continue;
  }
  for (const [index, header] of headers.entries()) {
    const match = String(header || "").match(/^(.+?)_(RAC|REL|SEX|GEN|GID|DIS|ET|NAT)(22|23|24)$/);
    if (!match) continue;
    const count = Number(row[index] || 0);
    if (count > 0) {
      candidates.push({
        unitid,
        name,
        school_id: schoolId,
        branch,
        address,
        city,
        state,
        zip,
        year: `20${match[3]}`,
        offense: offenseMap[match[1]] || match[1],
        bias: biasMap[match[2]],
        code: header,
        count
      });
    }
  }
}

function rank(a, b) {
  return b.year.localeCompare(a.year) || b.count - a.count || a.name.localeCompare(b.name) || a.code.localeCompare(b.code);
}

const byState = new Map();
for (const candidate of candidates) {
  if (!byState.has(candidate.state)) byState.set(candidate.state, []);
  byState.get(candidate.state).push(candidate);
}
for (const stateCandidates of byState.values()) stateCandidates.sort(rank);

const selected = [];
const selectedSchoolIds = new Set();
let added = true;
while (selected.length < batchSize && added) {
  added = false;
  for (const state of [...byState.keys()].sort()) {
    const stateCandidates = byState.get(state);
    while (stateCandidates?.length) {
      const candidate = stateCandidates.shift();
      if (selectedSchoolIds.has(candidate.school_id)) continue;
      selected.push(candidate);
      selectedSchoolIds.add(candidate.school_id);
      added = true;
      break;
    }
    if (selected.length >= batchSize) break;
  }
}

if (selected.length < batchSize) {
  throw new Error(`Only found ${selected.length} eligible new school records; need ${batchSize}.`);
}

if (!sourcesData.some((item) => item.id === source.id)) sourcesData.push(source);

for (const record of selected) {
  if (!existingSchoolIds.has(record.school_id)) {
    schoolsData.push({
      id: record.school_id,
      name: record.name,
      city: record.city,
      state: record.state,
      country: "US"
    });
    existingSchoolIds.add(record.school_id);
  }
}

const maxEventIndex = Math.max(...eventsData.map((event) => Number(event.id.match(/^evt_2026_(\d{4})$/)?.[1] || 0)));
const newEventIds = [];
let nextIndex = maxEventIndex + 1;
for (const record of selected) {
  const eventId = `evt_2026_${String(nextIndex).padStart(4, "0")}`;
  nextIndex += 1;
  newEventIds.push(eventId);
  const countText = incidentText(record.count);
  eventsData.push({
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
        note: `Imported from the Department of Education Campus Safety and Security 2025 Excel hate-crime data files for the ${targetCount}-record diversity checkpoint.`
      }
    ]
  });
}

const briefId = `brief_2026_06_03_ed_campus_safety_hate_data_${targetCount}_batch`;
if (!briefsData.some((brief) => brief.id === briefId)) {
  briefsData.push({
    id: briefId,
    title: `Department of Education Campus Safety Hate-Crime Data Expansion ${targetCount}`,
    week_start: "2026-06-01",
    week_end: "2026-06-07",
    published_date: importedAt,
    summary: `Campus Evidence Lab added a Department of Education Campus Safety and Security data-file batch to reach the ${targetCount}-record checkpoint while broadening school coverage across states.`,
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

console.log(`Imported ${selected.length} Department of Education records for target ${targetCount}.`);
