import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, REQUIRED_FILES, OPTIONAL_FILES, INDEXED_ROUTES, PAPER_SLUGS, FULL_PAPER_SLUGS, previewFiles } from "./build-static.mjs";

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), `${name}/`));
    else files.push(name);
  }
  return files;
}

const isPdf = (data) => data.subarray(0, 5).equals(Buffer.from("%PDF-")) && data.subarray(-1024).includes(Buffer.from("%%EOF"));
// A RIFF/WEBP header whose chunk size matches the file catches truncated renders.
const isWebp = (data) => data.length > 12 && data.subarray(0, 4).equals(Buffer.from("RIFF"))
  && data.subarray(8, 12).equals(Buffer.from("WEBP")) && data.readUInt32LE(4) + 8 === data.length;

export async function checkSite(dist = path.join(ROOT, "dist")) {
  const files = await listFiles(dist);
  const allowed = new Set([...REQUIRED_FILES, ...OPTIONAL_FILES, "robots.txt", "sitemap.xml"]);
  for (const file of files) {
    if (!allowed.has(file)) throw new Error(`Unexpected public file: ${file}`);
  }
  for (const file of [...REQUIRED_FILES, "robots.txt"]) {
    if (!files.includes(file)) throw new Error(`Missing public file: ${file}`);
  }
  for (const file of files.filter((name) => /\.(html|css)$/.test(name))) {
    const content = await readFile(path.join(dist, file), "utf8");
    if (file.endsWith(".html")) {
      for (const [name, pattern] of [
        ["document language", /<html\b[^>]*\blang=["'][^"']+["']/i],
        ["page title", /<title>[^<]+<\/title>/i],
        ["viewport", /<meta\b[^>]*name=["']viewport["']/i],
        ["main landmark", /<main\b/i],
      ]) {
        if (!pattern.test(content)) throw new Error(`${file}: missing ${name}`);
      }
      if ((content.match(/<h1\b/gi) || []).length !== 1) throw new Error(`${file}: expected one h1`);
      for (const image of content.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt\s*=\s*["'][^"']*["']/i.test(image[0])) throw new Error(`${file}: image is missing alt text`);
      }
    }
    const references = file.endsWith(".html")
      ? [...content.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])
      : [...content.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)].map((match) => match[1]);
    for (const reference of references) {
      if (file.endsWith(".css") && reference.startsWith("#")) continue;
      if (/^javascript:/i.test(reference)) throw new Error(`${file}: unsupported link ${reference}`);
      if (/^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(reference)) continue;
      const resolved = new URL(reference.replaceAll("&amp;", "&"), `https://site.invalid/${file}`);
      let target = decodeURIComponent(resolved.pathname).replace(/^\//, "");
      if (!target || target.endsWith("/")) target += "index.html";
      if (!files.includes(target)) throw new Error(`${file}: missing link target ${reference}`);
      if (resolved.hash && target.endsWith(".html")) {
        const destination = await readFile(path.join(dist, target), "utf8");
        const ids = new Set([...destination.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
        if (!ids.has(decodeURIComponent(resolved.hash.slice(1)))) throw new Error(`${file}: missing fragment ${reference}`);
      }
    }
  }
  for (const file of ["404.html", "reader/index.html"]) {
    const page = await readFile(path.join(dist, file), "utf8");
    if (!/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(page)) {
      throw new Error(`${file} must be marked noindex`);
    }
  }
  for (const slug of [...PAPER_SLUGS, ...FULL_PAPER_SLUGS]) {
    if (!isPdf(await readFile(path.join(dist, `pdfs/${slug}.pdf`)))) throw new Error(`Invalid PDF document: ${slug}`);
  }
  for (const slug of PAPER_SLUGS) {
    const svg = await readFile(path.join(dist, `pdfs/${slug}-page.svg`), "utf8");
    if (!/<svg\b[^>]*\bviewBox=/i.test(svg)) throw new Error(`Missing PDF page rendering: ${slug}`);
  }
  for (const file of FULL_PAPER_SLUGS.flatMap(previewFiles)) {
    if (!isWebp(await readFile(path.join(dist, file)))) throw new Error(`Invalid preview image: ${file}`);
  }
  if (files.includes("sitemap.xml")) {
    const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    if (urls.length !== INDEXED_ROUTES.length || new Set(urls).size !== urls.length) throw new Error("Sitemap must list each public page once");
    const expected = INDEXED_ROUTES.map((route) => new URL(route, urls[0]).href);
    if (urls.some((url, index) => url !== expected[index])) throw new Error("Sitemap contains an unexpected route");
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = await checkSite();
  console.log(`Checked ${files.length} public files: routes, assets, metadata, and links.`);
}
