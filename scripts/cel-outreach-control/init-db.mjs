import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const parseArgs = (argv) => {
  const args = { db: path.join(repoRoot, "outreach/control/cel-outreach.sqlite") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--db") {
      args.db = path.resolve(repoRoot, argv[i + 1]);
      i += 1;
    }
  }
  return args;
};

const { db } = parseArgs(process.argv.slice(2));
const schemaPath = path.join(repoRoot, "outreach/control/schema.sql");

fs.mkdirSync(path.dirname(db), { recursive: true });

const schemaSql = fs.readFileSync(schemaPath, "utf8");

execFileSync("sqlite3", [db], {
  cwd: repoRoot,
  input: schemaSql,
  stdio: "pipe",
});

console.log(JSON.stringify({ db, schemaPath }, null, 2));
