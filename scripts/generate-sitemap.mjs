import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/+$/, "");
const [events, schools, briefs, sources, signalsArtifact] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.briefs),
  readJson(paths.sources),
  readJson(paths.signals).catch(() => ({ signals: [] }))
]);

const staticPaths = [
  "/",
  "/events/",
  "/schools/",
  "/briefs/",
  "/signals/",
  "/sources/",
  "/quality/",
  "/methodology/",
  "/impact/",
  "/updates/",
  "/trust/",
  "/press/",
  "/acknowledgments/",
  "/reviewer-brief/",
  "/journalist-guide/",
  "/researcher-start/",
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
  "/downloads/",
  "/submit/",
  "/about/",
  "/license/"
];

const eventPaths = events.map((event) => `/events/${event.id}/`);
const schoolPaths = schools.map((school) => `/schools/${school.id}/`);
const briefPaths = briefs.map((brief) => `/briefs/${brief.id}/`);
const sourcePaths = sources.map((source) => `/sources/${source.id}/`);
const signalPaths = (signalsArtifact.signals ?? []).map((signal) => `/signals/${signal.id}/`);
const urls = [...staticPaths, ...eventPaths, ...schoolPaths, ...briefPaths, ...sourcePaths, ...signalPaths];

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
