import { copyFile, lstat, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const PAPER_SLUGS = ["measurement", "detection", "narratives"];
export const PAGE_FILES = [
  "index.html", "404.html", "research/index.html", "methods/index.html", "about/index.html",
  ...PAPER_SLUGS.map((slug) => `research/${slug}/index.html`), "reader/index.html",
];
export const INDEXED_ROUTES = ["", "research/", "methods/", "about/", ...PAPER_SLUGS.map((slug) => `research/${slug}/`)];
export const REQUIRED_FILES = [
  ...PAGE_FILES,
  "assets/styles.css", "assets/favicon.svg", "assets/artwork-reference.png", "assets/reader.js",
  "assets/fonts/InterVariable.woff2", "assets/fonts/OFL.txt", "_headers",
  ...PAPER_SLUGS.flatMap((slug) => [`pdfs/${slug}.pdf`, `pdfs/${slug}-page.svg`]),
];
export const OPTIONAL_FILES = [];

function publicationUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("SITE_URL must be an HTTP(S) site URL without credentials, query, or fragment.");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
  return url.href;
}

const xmlEscape = (value) => value.replace(/[<>&"']/g, (char) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
})[char]);

export async function buildSite({ root = ROOT, siteUrl = process.env.SITE_URL } = {}) {
  const base = publicationUrl(siteUrl);
  const files = [...REQUIRED_FILES];
  for (const file of OPTIONAL_FILES) {
    try {
      await lstat(path.join(root, file));
      files.push(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  // Never copy whole directories: retained archive data and regenerated legacy
  // routes must stay outside the public build.
  for (const file of files) {
    const info = await lstat(path.join(root, file));
    if (!info.isFile()) throw new Error(`Expected a regular site file: ${file}`);
  }
  const dist = path.join(root, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of files) {
    await mkdir(path.dirname(path.join(dist, file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(dist, file));
  }
  await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${new URL("sitemap.xml", base).href}\n` : ""}`);
  if (base) {
    const entries = INDEXED_ROUTES.map((route) => `  <url><loc>${xmlEscape(new URL(route, base).href)}</loc></url>`).join("\n");
    await writeFile(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`);
  }
  return dist;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildSite();
  console.log("Built Kornstein Lab in dist/.");
}
