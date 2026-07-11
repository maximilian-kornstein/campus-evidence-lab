import { readJson, rootDir } from "../lib.mjs";
import path from "node:path";
import { canDistribute, idempotencyKey } from "./core.mjs";

const artifact = await readJson(path.join(rootDir, "data", "signals.json"));
const controls = { global_pause: false, bluesky: "live", approved_shadow_count: Number(process.env.APPROVED_SHADOW_COUNT || 0) };
const history = [];
const decisions = artifact.signals.map((signal) => ({ signal_id: signal.id, idempotency_key: idempotencyKey(signal.id, "bluesky"), ...canDistribute({ signal, channel: "bluesky", history, controls }) }));
console.log(JSON.stringify({ mode: "dry_run", policy_version: artifact.policy_version, controls, decisions }, null, 2));
