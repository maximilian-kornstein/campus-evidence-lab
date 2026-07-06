import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/+$/, "");

async function readJsonFilesFromDir(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => readJson(path.join(dir, entry.name)))
    );
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const [events, schools, briefs, sources, importWaves] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.briefs),
  readJson(paths.sources),
  readJsonFilesFromDir(paths.importWavesDir)
]);

const staticPaths = [
  "/",
  "/events/",
  "/schools/",
  "/briefs/",
  "/sources/",
  "/quality/",
  "/import-waves/",
  "/methodology/",
  "/impact/",
  "/updates/",
  "/trust/",
  "/press/",
  "/acknowledgments/",
  "/reviewer-brief/",
  "/journalist-guide/",
  "/guide/",
  "/research-guide/",
  "/research-workspace/",
  "/reviewer-queue/",
  "/workflows/",
  "/robustness/",
  "/review-debt/",
  "/external-review/",
  "/known-limits/",
  "/certification/",
  "/certification/batch-001/",
  "/source-family-certification-review-001/",
  "/ed-provenance/",
  "/certification-batches/",
  ...ED_CERTIFICATION_REVIEW_SPECS.map((spec) => spec.route),
  "/evidence/",
  "/flagship/",
  "/gold-records/",
  "/challenge/",
  "/codebook/",
  "/coverage/",
  "/replicate/",
  "/credibility/",
  "/policies/",
  "/policies/terms-of-use/",
  "/policies/privacy-policy/",
  "/policies/data-license-addendum/",
  "/policies/submission-terms/",
  "/policies/corrections-and-right-of-reply-policy/",
  "/policies/responsible-use-policy/",
  "/policies/ai-use-disclosure/",
  "/policies/takedown-and-redaction-policy/",
  "/policies/reviewer-agreement/",
  "/protocol/",
  "/downloads/",
  "/submit/",
  "/about/",
  "/license/"
];

const eventPaths = events.map((event) => `/events/${event.id}/`);
const schoolPaths = schools.map((school) => `/schools/${school.id}/`);
const briefPaths = briefs.map((brief) => `/briefs/${brief.id}/`);
const sourcePaths = sources.map((source) => `/sources/${source.id}/`);
const importWavePaths = importWaves.map((wave) => `/import-waves/${wave.id}/`);
const urls = [...staticPaths, ...eventPaths, ...schoolPaths, ...briefPaths, ...sourcePaths, ...importWavePaths];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${baseUrl}${url}</loc>
  </url>`
  )
  .join("\n")}
</urlset>
`;

await writeFile(path.join(rootDir, "sitemap.xml"), xml);
console.log(`Generated sitemap with ${urls.length} URLs.`);
