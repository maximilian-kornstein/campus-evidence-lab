import path from "node:path";
import { CANONICAL_EXPANSION_ID, canonicalExpansionDigest, validateCanonicalExpansion } from "./canonical-expansion-lib.mjs";
import { paths, readJson, rootDir } from "./lib.mjs";

const [events, manifest] = await Promise.all([readJson(paths.events), readJson(path.join(rootDir, "data", "canonical-expansion-10k.json"))]);
const expansionEvents = events.filter((event) => event.expansion_id === CANONICAL_EXPANSION_ID);
const errors = validateCanonicalExpansion(expansionEvents);
if (events.length !== 10000) errors.push(`canonical dataset must contain exactly 10,000 records; found ${events.length}`);
if (manifest?.selection?.deterministic_digest !== canonicalExpansionDigest(expansionEvents)) errors.push("canonical expansion digest does not match the promoted records");
if (manifest?.totals?.after !== events.length) errors.push("canonical expansion manifest total does not match events.json");
if (errors.length) throw new Error(`Canonical expansion verification failed:\n- ${errors.join("\n- ")}`);
console.log(`Verified ${expansionEvents.length} canonical expansion records across ${new Set(expansionEvents.map((event) => event.school_id)).size} institutions.`);
