import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/+$/, "");
const [events, schools, briefs, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.briefs),
  readJson(paths.sources)
]);

const staticPaths = [
  "/",
  "/events/",
  "/schools/",
  "/briefs/",
  "/sources/",
  "/quality/",
  "/methodology/",
  "/impact/",
  "/trust/",
  "/acknowledgments/",
  "/guide/",
  "/research-guide/",
  "/research-workspace/",
  "/reviewer-queue/",
  "/downloads/",
  "/submit/",
  "/about/",
  "/license/"
];

const eventPaths = events.map((event) => `/events/${event.id}/`);
const schoolPaths = schools.map((school) => `/schools/${school.id}/`);
const briefPaths = briefs.map((brief) => `/briefs/${brief.id}/`);
const sourcePaths = sources.map((source) => `/sources/${source.id}/`);
const urls = [...staticPaths, ...eventPaths, ...schoolPaths, ...briefPaths, ...sourcePaths];

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
