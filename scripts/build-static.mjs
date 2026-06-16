import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./lib.mjs";

const distDir = path.join(rootDir, "dist");

const publicPaths = [
  "index.html",
  "assets",
  "data",
  "docs",
  "schema",
  "events",
  "schools",
  "briefs",
  "sources",
  "quality",
  "methodology",
  "impact",
  "updates",
  "trust",
  "press",
  "acknowledgments",
  "reviewer-brief",
  "journalist-guide",
  "guide",
  "research-guide",
  "research-workspace",
  "reviewer-queue",
  "workflows",
  "robustness",
  "evidence",
  "challenge",
  "codebook",
  "coverage",
  "replicate",
  "credibility",
  "downloads",
  "submit",
  "about",
  "license",
  "robots.txt",
  "rss.xml",
  "sitemap.xml",
  "RELEASE_NOTES.md",
  "_headers",
  "LICENSE.md",
  "DATA_LICENSE.md"
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const publicPath of publicPaths) {
  await cp(path.join(rootDir, publicPath), path.join(distDir, publicPath), {
    recursive: true
  });
}

console.log(`Built static deployment output in ${path.relative(rootDir, distDir)}/`);
