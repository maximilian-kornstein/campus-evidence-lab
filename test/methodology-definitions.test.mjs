import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CATEGORY_DEFINITIONS,
  COMMUNITY_DEFINITIONS,
  CONFIDENCE_DEFINITIONS,
  VERIFICATION_DEFINITIONS,
  SOURCE_TYPE_DEFINITIONS,
  DATE_PRECISION_DEFINITIONS,
  REQUIRED_CODEBOOK_FIELDS,
  validateCodebookDefinitions,
  validateMethodologyExamples
} from "../scripts/methodology-definitions.mjs";

const events = JSON.parse(await readFile(new URL("../data/events.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/sources.json", import.meta.url), "utf8"));

test("all event categories in the dataset have public codebook definitions", () => {
  const categories = new Set(events.map((event) => event.category));
  for (const category of categories) {
    assert.ok(CATEGORY_DEFINITIONS[category], `Missing category definition for ${category}`);
  }
});

test("all affected-community labels in the dataset have public codebook definitions", () => {
  const communities = new Set(events.flatMap((event) => event.affected_communities));
  for (const community of communities) {
    assert.ok(COMMUNITY_DEFINITIONS[community], `Missing community definition for ${community}`);
  }
});

test("Volokh scope clarifications are represented in public definitions", async () => {
  assert.ok(COMMUNITY_DEFINITIONS["Sexual orientation"], "Missing Sexual orientation definition");
  assert.ok(COMMUNITY_DEFINITIONS["Gender identity"], "Missing Gender identity definition");

  const methodology = await readFile(new URL("../methodology/index.html", import.meta.url), "utf8");
  assert.match(methodology, /not a comprehensive First Amendment or student-speech archive/i);
  assert.match(methodology, /Political belief, viewpoint, or ideology is not a standalone affected-community category/i);
  assert.match(methodology, /Zionist, anti-Zionist, Israeli, Palestinian, Jewish, Muslim, Arab/i);
  assert.match(methodology, /false, unfounded, withdrawn, fabricated, or a hoax/i);
});

test("all source types in the dataset have public codebook definitions", () => {
  const sourceTypes = new Set(sources.map((source) => source.source_type));
  for (const sourceType of sourceTypes) {
    assert.ok(SOURCE_TYPE_DEFINITIONS[sourceType], `Missing source type definition for ${sourceType}`);
  }
});

test("each codebook definition includes operational review fields", () => {
  const errors = validateCodebookDefinitions({
    categories: CATEGORY_DEFINITIONS,
    communities: COMMUNITY_DEFINITIONS,
    confidence: CONFIDENCE_DEFINITIONS,
    verification: VERIFICATION_DEFINITIONS,
    sourceTypes: SOURCE_TYPE_DEFINITIONS,
    datePrecision: DATE_PRECISION_DEFINITIONS
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(REQUIRED_CODEBOOK_FIELDS, ["definition", "use_when", "do_not_use_when", "evidence_required", "common_mistake"]);
});

test("methodology examples validate against codebook values and avoid external-review claims", () => {
  const examples = [
    {
      id: "example_excluded_private_screenshot",
      type: "excluded",
      title: "Private screenshot without public source",
      category: "Other source-backed civil rights event",
      affected_communities: ["Religion"],
      confidence: "Low",
      verification_status: "Verified from public source",
      source_basis: "No public source URL is available for independent record review.",
      methodological_point: "Private screenshots are excluded unless independently supported by public source material.",
      public_claim_limit: "This example does not describe a published event record or external review outcome."
    }
  ];

  assert.deepEqual(validateMethodologyExamples(examples), []);
});
