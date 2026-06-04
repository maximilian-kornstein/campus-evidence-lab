import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { rootDir } from "./lib.mjs";

const failures = [];
const warnings = [];
const passes = [];

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    ...options
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim()
  };
}

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function checkExists(relativePath, label = relativePath) {
  if (existsSync(path.join(rootDir, relativePath))) {
    pass(`${label} exists`);
  } else {
    fail(`${label} is missing`);
  }
}

const insideGit = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (insideGit.ok && insideGit.stdout === "true") {
  pass("Git repository initialized");
} else {
  fail("Git repository is not initialized");
}

const status = run("git", ["status", "--porcelain"]);
if (status.ok && !status.stdout) {
  pass("Git working tree is clean");
} else if (status.ok) {
  fail(`Git working tree has uncommitted changes:\n${status.stdout}`);
} else {
  fail("Could not read git status");
}

const remote = run("git", ["remote", "get-url", "origin"]);
if (remote.ok && remote.stdout) {
  pass(`Git remote origin configured: ${remote.stdout}`);
} else {
  fail("Git remote origin is not configured");
}

const ignoredDist = run("git", ["check-ignore", "-q", "dist/index.html"]);
if (ignoredDist.ok) {
  pass("dist/ is ignored");
} else {
  fail("dist/ is not ignored");
}

const ignoredNodeModules = run("git", ["check-ignore", "-q", "node_modules/.package-lock.json"]);
if (ignoredNodeModules.ok) {
  pass("node_modules/ is ignored");
} else {
  fail("node_modules/ is not ignored");
}

for (const [relativePath, label] of [
  ["dist/index.html", "Built site"],
  ["dist/RELEASE_NOTES.md", "Built release notes"],
  ["dist/data/events.json", "Built events dataset"],
  ["dist/data/events-research.json", "Built research events dataset"],
  ["dist/sitemap.xml", "Built sitemap"],
  [".github/workflows/check.yml", "GitHub Actions workflow"],
  [".github/ISSUE_TEMPLATE/source-submission.yml", "Source submission issue template"],
  ["wrangler.toml", "Cloudflare Pages config"]
]) {
  checkExists(relativePath, label);
}

const ghVersion = run("gh", ["--version"]);
if (ghVersion.ok) {
  pass("GitHub CLI is installed");
  const ghAuth = run("gh", ["auth", "status"]);
  if (ghAuth.ok) {
    pass("GitHub CLI is authenticated");
  } else {
    fail("GitHub CLI is not authenticated");
  }
} else {
  warn("GitHub CLI is not installed; create the GitHub repository through the web UI or install gh");
}

const wranglerWhoami = run("npx", ["wrangler", "whoami"]);
const wranglerOutput = `${wranglerWhoami.stdout}\n${wranglerWhoami.stderr}`;
if (wranglerWhoami.ok && !/not authenticated/i.test(wranglerOutput)) {
  pass("Wrangler is authenticated");
} else {
  fail("Wrangler is not authenticated; run `npx wrangler login` before deploying");
}

let head = "";
try {
  head = execFileSync("git", ["log", "--oneline", "-1"], {
    cwd: rootDir,
    encoding: "utf8"
  }).trim();
} catch {
  head = "unavailable";
}

console.log("Launch preflight");
console.log(`Commit: ${head}`);
console.log("");

for (const message of passes) console.log(`PASS ${message}`);
for (const message of warnings) console.log(`WARN ${message}`);
for (const message of failures) console.log(`FAIL ${message}`);

if (failures.length) {
  console.error(`\nLaunch preflight failed with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log("\nLaunch preflight passed.");
