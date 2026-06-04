import { spawnSync } from "node:child_process";
import { rootDir } from "./lib.mjs";

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const remoteUrl = args.find((arg) => !arg.startsWith("--"));

function capture(command, commandArgs = []) {
  return spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false
  });
}

function run(command, commandArgs = []) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const branch = capture("git", ["branch", "--show-current"]);
if (branch.status !== 0) {
  fail("Could not read the current Git branch.");
}

if (branch.stdout.trim() !== "main") {
  fail(`Publish from main. Current branch is ${branch.stdout.trim() || "unknown"}.`);
}

const status = capture("git", ["status", "--porcelain"]);
if (status.status !== 0) {
  fail("Could not read Git status.");
}

if (status.stdout.trim()) {
  fail(`Commit or stash local changes before publishing:\n${status.stdout.trim()}`);
}

const existingOrigin = capture("git", ["remote", "get-url", "origin"]);
if (remoteUrl) {
  if (existingOrigin.status === 0 && existingOrigin.stdout.trim() !== remoteUrl) {
    fail(
      `origin already points to ${existingOrigin.stdout.trim()}.\n` +
        `Refusing to replace it with ${remoteUrl}. Update the remote manually if that is intentional.`
    );
  }

  if (existingOrigin.status !== 0) {
    run("git", ["remote", "add", "origin", remoteUrl]);
  }
} else if (existingOrigin.status !== 0) {
  fail(
    "No origin remote is configured.\n" +
      "Create a public GitHub repository, then run:\n" +
      "npm run publish:github -- <repository-url>"
  );
}

if (!skipBuild) {
  run("npm", ["run", "build"]);
}

run("git", ["push", "-u", "origin", "main"]);
run("npm", ["run", "launch:preflight"]);

console.log("");
console.log("GitHub publish complete.");
console.log("Next: set repository Settings -> Pages -> Source to GitHub Actions, then run the Deploy GitHub Pages workflow.");
