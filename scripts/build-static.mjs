import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";

const distDir = path.join(rootDir, "dist");

const publicPaths = [
  "index.html",
  "assets",
  "data",
  "docs",
  "schema",
  "contracts",
  "events",
  "schools",
  "briefs",
  "sources",
  "quality",
  "import-waves",
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
  "review-debt",
  "external-review",
  "known-limits",
  "certification",
  "source-family-certification-review-001",
  "ed-provenance",
  "certification-batches",
  ...ED_CERTIFICATION_REVIEW_SPECS.map((spec) => spec.outputDir),
  "evidence",
  "flagship",
  "gold-records",
  "challenge",
  "codebook",
  "coverage",
  "replicate",
  "credibility",
  "policies",
  "protocol",
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
