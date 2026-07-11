import path from "node:path";
import { readJson, rootDir, writeJson } from "./lib.mjs";
import { collectAll } from "./signals/collectors.mjs";
import { buildIdentityIndex, resolveInstitutions } from "./signals/identity.mjs";

const config = await readJson(path.join(rootDir, "config", "signals-sources.json"));
if (config.sources.some((source) => source.cost !== "free")) throw new Error("Signals source configuration contains a non-free provider");
const schools = await readJson(path.join(rootDir, "data", "schools.json"));
const aliasOverrides = await readJson(path.join(rootDir, "config", "institution-aliases.json"));
const identityIndex = buildIdentityIndex(schools, aliasOverrides);
const collected = await collectAll(config.sources);
const triggers = collected.triggers.map((trigger) => { const matches = resolveInstitutions(trigger, schools, identityIndex); return { ...trigger, institution_matches: matches, institution_ids: matches.map((row) => row.school_id) }; });
await writeJson(path.join(rootDir, "data", "signal-triggers.json"), { generated_at: new Date().toISOString(), policy: config.policy, providers: collected.results.map((row) => ({ source_id: row.source_id, ok: row.ok, reason: row.reason ?? "", trigger_count: row.triggers.length })), triggers });
await writeJson(path.join(rootDir, "data", "institution-identity-index.json"), { generated_at: new Date().toISOString(), alias_count: identityIndex.aliases.length, ambiguous_count: identityIndex.ambiguous.length, ...identityIndex });
console.log(`Collected ${triggers.length} trigger(s); ${triggers.filter((row) => row.institution_ids.length).length} exact institution match(es).`);
