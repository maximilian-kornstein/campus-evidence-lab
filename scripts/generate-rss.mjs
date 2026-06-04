import { writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/+$/, "");
const briefs = await readJson(paths.briefs);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rfc822(date) {
  return new Date(`${date}T12:00:00Z`).toUTCString();
}

const items = [...briefs]
  .sort((a, b) => b.published_date.localeCompare(a.published_date))
  .map((brief) => {
    const link = `${baseUrl}/briefs/${brief.id}/`;
    return `    <item>
      <title>${escapeXml(brief.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(brief.published_date)}</pubDate>
      <description>${escapeXml(brief.summary)}</description>
    </item>`;
  })
  .join("\n");

const latestDate = briefs
  .map((brief) => brief.published_date)
  .sort()
  .at(-1);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Campus Evidence Lab Briefs</title>
    <link>${baseUrl}/briefs/</link>
    <description>Public-source research briefs from Campus Evidence Lab.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(latestDate)}</lastBuildDate>
${items}
  </channel>
</rss>
`;

await writeFile(path.join(rootDir, "rss.xml"), xml);
console.log(`Generated RSS feed with ${briefs.length} briefs.`);
