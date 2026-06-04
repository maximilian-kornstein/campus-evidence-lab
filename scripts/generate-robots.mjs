import { writeFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./lib.mjs";

const baseUrl = (process.env.SITE_URL || "https://campusevidencelab.org").replace(/\/+$/, "");

const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

await writeFile(path.join(rootDir, "robots.txt"), robots);
console.log(`Generated robots.txt for ${baseUrl}.`);
