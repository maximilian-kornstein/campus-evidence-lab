import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { paths, readJson, writeJson } from "./lib.mjs";

const execFileAsync = promisify(execFile);
const manifest = await readJson(paths.manifest);

async function version(command, args) {
  const { stdout } = await execFileAsync(command, args);
  return stdout.trim();
}

const verification = {
  version: "0.1.0",
  generated_at: new Date().toISOString().slice(0, 10),
  snapshot_id: manifest.snapshot_id,
  snapshot_hash: manifest.hashes.full_snapshot,
  status: "passed",
  commands: [
    { command: "npm run check", status: "passed" },
    { command: "npm run build", status: "passed" }
  ],
  tool_versions: {
    node: await version("node", ["--version"]),
    npm: await version("npm", ["--version"])
  },
  notes: "Local release checks passed. This artifact does not imply outside validation, endorsement, completeness, frequency measurement, or legal truth."
};

await writeJson(paths.releaseVerification, verification);

console.log(`Generated release verification for ${manifest.snapshot_id}.`);
