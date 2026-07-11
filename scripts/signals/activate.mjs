import { parseArgs } from "../cel-outreach-control/lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args["confirm-live"]) throw new Error("Activation requires --confirm-live");
const base = String(process.env.SIGNALS_WORKER_URL || "").replace(/\/$/, "");
const token = process.env.SIGNALS_ADMIN_TOKEN || "";
if (!base || !token) throw new Error("SIGNALS_WORKER_URL and SIGNALS_ADMIN_TOKEN are required");
const health = await fetch(`${base}/health`).then((response) => response.json());
console.log("Pre-activation controls", health.controls);
const response = await fetch(`${base}/api/activate`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
const result = await response.json();
if (!response.ok) throw new Error(`Activation rejected: ${JSON.stringify(result)}`);
console.log(JSON.stringify(result, null, 2));
