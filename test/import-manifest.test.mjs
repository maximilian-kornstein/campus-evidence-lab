import test from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_LEGAL_RISK_CLASSES,
  sourceFamilyForRecord,
  validateImportManifestCoverage,
  validateImportManifests
} from "../scripts/import-manifest-lib.mjs";

const officialDatasetManifest = {
  id: "manifest_ed_campus_safety_dataset",
  source_family: "ed_campus_safety_dataset",
  legal_risk_class: "low_official_structured",
  bulk_import_eligible: true,
  default_review_tier: "imported_public_source",
  source_urls: ["https://ope.ed.gov/campussafety/"],
  acquisition_date: "2026-07-06",
  importer_command: "npm run import:ed-campus-safety-scoped",
  field_map: {
    school: "institution_name",
    date: "reported_year",
    category: "offense_category",
    affected_communities: "bias_category",
    source_locator: "workbook/sheet/row/column/cell"
  },
  duplicate_strategy: "stable deterministic event id plus source-family row locator",
  sampling_plan: "Review importer code, then inspect at least 50 deterministic sample rows per import wave.",
  known_limits: [
    "Official structured source records may describe reported data rather than adjudicated facts.",
    "Publication at import tier does not imply human certification of each row."
  ],
  publishable_fields: ["school", "year", "category", "affected_communities", "source_locator"],
  prohibited_fields: ["private names", "private contact details", "direct messages", "private screenshots"],
  exclusion_rules: ["Exclude rows that require private-person credibility judgments."]
};

const officialOcrResolutionManifest = {
  id: "manifest_ocr_resolution_document",
  source_family: "ocr_resolution_document",
  legal_risk_class: "medium_official_document",
  bulk_import_eligible: true,
  default_review_tier: "imported_public_source",
  source_urls: ["https://ocrcas.ed.gov/ocr-search", "https://www.ed.gov/laws-and-policy/civil-rights-laws/office-civil-rights-ocr-reading-room"],
  acquisition_date: "2026-07-07",
  importer_command: "node scripts/discover-ocr-resolution-search.mjs && node scripts/export-ocr-resolution-wave-candidates.mjs",
  field_map: {
    school: "postsecondary institution named in OCR resolution search",
    date: "resolved date",
    category: "OCR resolution document",
    affected_communities: "civil-rights domain from OCR source family",
    source_locator: "OCR reference number and public resolution-document links"
  },
  duplicate_strategy: "Use OCR reference number and resolved date as stable duplicate keys.",
  sampling_plan: "Inspect discovery counts, document-link samples, mapping quarantine, and at least 50 accepted rows per wave.",
  known_limits: [
    "OCR resolution documents describe agency case resolution materials and must not be summarized as Campus Evidence Lab legal findings.",
    "Publication at import tier does not imply human certification of each row."
  ],
  publishable_fields: ["school", "state", "resolved_date", "ocr_reference", "source_locator"],
  prohibited_fields: ["private names", "private contact details", "complainant names", "respondent names", "unsupported liability conclusions"],
  exclusion_rules: ["Quarantine rows whose institution cannot be resolved to a known postsecondary school before publication."]
};

const events = [
  {
    id: "evt_2026_0001",
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    description: "According to the Department of Education Campus Safety and Security Data Analysis Cutting Tool workbook, the row listed one reported hate-crime incident."
  }
];

const sources = [
  {
    id: "src_dataset",
    title: "Campus Safety and Security Data Analysis Cutting Tool data files",
    publisher: "U.S. Department of Education Office of Postsecondary Education",
    source_type: "Government dataset",
    url: "https://ope.ed.gov/campussafety/"
  }
];

test("sourceFamilyForRecord identifies official structured source families", () => {
  assert.equal(sourceFamilyForRecord(events[0], sources), "ed_campus_safety_dataset");
});

test("sourceFamilyForRecord keeps annual security reports out of federal dataset imports", () => {
  assert.equal(
    sourceFamilyForRecord(
      {
        id: "evt_2026_0002",
        source_ids: ["src_asr"],
        source_types: ["Annual security report"],
        description: "The annual security report lists hate-crime statistics under Clery Act reporting."
      },
      [
        {
          id: "src_asr",
          title: "2025 Annual Security Report",
          publisher: "University public safety office",
          source_type: "Annual security report",
          url: "https://example.edu/clery/asr"
        }
      ]
    ),
    "annual_security_report"
  );
});

test("sourceFamilyForRecord prioritizes publisher source type before OCR keywords", () => {
  assert.equal(
    sourceFamilyForRecord(
      {
        id: "evt_2026_0003",
        source_ids: ["src_university_statement"],
        source_types: ["University statement"],
        description: "The university statement says OCR reached a voluntary resolution agreement."
      },
      [
        {
          id: "src_university_statement",
          title: "University resolves OCR review",
          publisher: "Example University",
          source_type: "University statement",
          url: "https://example.edu/news/ocr-resolution"
        }
      ]
    ),
    "university_statement"
  );
});

test("sourceFamilyForRecord identifies OCR open-investigation table rows", () => {
  assert.equal(
    sourceFamilyForRecord(
      {
        id: "evt_ocr_open_001",
        source_ids: ["src_ocr_open_investigations"],
        source_types: ["Government dataset"],
        description:
          "The Department of Education Office for Civil Rights open-investigations table listed an open investigation for a postsecondary institution."
      },
      [
        {
          id: "src_ocr_open_investigations",
          title: "Pending Cases Currently Under Investigation at Elementary-Secondary and Post-Secondary Schools",
          publisher: "U.S. Department of Education Office for Civil Rights",
          source_type: "Government dataset",
          url: "https://ocrcas.ed.gov/open-investigations"
        }
      ]
    ),
    "ocr_open_investigation"
  );
});

test("sourceFamilyForRecord identifies OCR resolution document rows before generic OCR releases", () => {
  assert.equal(
    sourceFamilyForRecord(
      {
        id: "evt_ocr_resolution_001",
        source_ids: ["src_ocr_resolution"],
        source_types: ["Government case summary"],
        description:
          "The OCR Recent Resolution Search listed OCR reference 01242116 with public Letter and Agreement PDF links from ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/01242116-a.pdf."
      },
      [
        {
          id: "src_ocr_resolution",
          title: "Office for Civil Rights Recent Resolution Search",
          publisher: "U.S. Department of Education Office for Civil Rights",
          source_type: "Government case summary",
          url: "https://ocrcas.ed.gov/ocr-search?f%5B0%5D=it%3APost%20Secondary"
        }
      ]
    ),
    "ocr_resolution_document"
  );
});

test("validateImportManifests accepts low-risk official structured bulk manifests", () => {
  assert.deepEqual(validateImportManifests([officialDatasetManifest]), []);
  assert.equal(IMPORT_LEGAL_RISK_CLASSES.includes("low_official_structured"), true);
});

test("validateImportManifests accepts OCR resolution documents as bulk-eligible official documents with strict limits", () => {
  assert.deepEqual(validateImportManifests([officialOcrResolutionManifest]), []);
});

test("validateImportManifests rejects unsafe bulk import settings", () => {
  const errors = validateImportManifests([
    {
      ...officialDatasetManifest,
      id: "manifest_news",
      source_family: "news_report",
      legal_risk_class: "manual_only_open_web",
      bulk_import_eligible: true,
      default_review_tier: "internally_certified"
    }
  ]);

  assert.equal(errors.some((error) => error.includes("manual_only_open_web cannot be bulk_import_eligible")), true);
  assert.equal(errors.some((error) => error.includes("default_review_tier must be imported_public_source")), true);
});

test("validateImportManifestCoverage requires every event source family to have a manifest", () => {
  assert.deepEqual(validateImportManifestCoverage({ events, sources, manifests: [officialDatasetManifest] }), []);
  assert.equal(
    validateImportManifestCoverage({ events, sources, manifests: [] }).some((error) =>
      error.includes("missing import manifest for source family ed_campus_safety_dataset")
    ),
    true
  );
});
