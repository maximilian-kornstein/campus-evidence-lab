import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { rootDir } from "./lib.mjs";

const errors = [];
const siteRoot = process.env.SITE_ROOT ? path.resolve(rootDir, process.env.SITE_ROOT) : rootDir;

async function fileExists(relativePath) {
  try {
    await access(path.join(siteRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles(dir = siteRoot) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (siteRoot === rootDir && entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await htmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function visibleText(element) {
  return element.textContent.replace(/\s+/g, " ").trim();
}

function hasAccessibleName(element, document) {
  const id = element.getAttribute("id");
  if (element.getAttribute("aria-label")) return true;
  if (element.getAttribute("aria-labelledby")) return true;
  if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
  return Boolean(element.closest("label"));
}

for (const filePath of await htmlFiles()) {
  const relativeFile = path.relative(siteRoot, filePath);
  const html = await readFile(filePath, "utf8");
  const dom = new JSDOM(html);
  const { document } = dom.window;

  if (!/^<!doctype html>/i.test(html.trim())) {
    errors.push(`${relativeFile} is missing <!doctype html>`);
  }

  if (document.documentElement.getAttribute("lang") !== "en") {
    errors.push(`${relativeFile} must set html lang="en"`);
  }

  if (!visibleText(document.querySelector("title") ?? document.createElement("title"))) {
    errors.push(`${relativeFile} has an empty title`);
  }

  if (!document.querySelector('meta[name="viewport"]')) {
    errors.push(`${relativeFile} is missing viewport metadata`);
  }

  if (!document.querySelector('link[rel="stylesheet"][href="/assets/styles.css"]')) {
    errors.push(`${relativeFile} is missing the shared stylesheet link`);
  }

  if (document.querySelectorAll("main").length !== 1) {
    errors.push(`${relativeFile} must contain exactly one main landmark`);
  }

  if (document.querySelectorAll("h1").length !== 1) {
    errors.push(`${relativeFile} must contain exactly one h1`);
  }

  for (const nav of document.querySelectorAll("nav")) {
    if (!nav.getAttribute("aria-label")) {
      errors.push(`${relativeFile} has a nav without aria-label`);
    }
  }

  const ids = new Map();
  for (const element of document.querySelectorAll("[id]")) {
    const id = element.getAttribute("id");
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids.entries()) {
    if (count > 1) errors.push(`${relativeFile} has duplicate id "${id}"`);
  }

  for (const control of document.querySelectorAll("input, select, textarea")) {
    if (!hasAccessibleName(control, document)) {
      errors.push(`${relativeFile} has an unlabelled ${control.tagName.toLowerCase()} control`);
    }
  }

  for (const table of document.querySelectorAll("table")) {
    if (!table.querySelector("th")) {
      errors.push(`${relativeFile} has a table without header cells`);
    }
    for (const th of table.querySelectorAll("th")) {
      if (!visibleText(th)) errors.push(`${relativeFile} has an empty table header`);
    }
  }

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!visibleText(link) && !link.getAttribute("aria-label")) {
      errors.push(`${relativeFile} has a link without accessible text: ${href}`);
    }
    if (link.getAttribute("target") === "_blank") {
      const rel = link.getAttribute("rel") ?? "";
      if (!/\bnoreferrer\b/.test(rel)) {
        errors.push(`${relativeFile} external target link is missing rel="noreferrer": ${href}`);
      }
    }
  }

  for (const image of document.querySelectorAll("img")) {
    if (!image.hasAttribute("alt")) {
      errors.push(`${relativeFile} has an image without alt text`);
    }
  }
}

for (const requiredDoc of [
  "docs/content-safety.md",
  "docs/contributing.md",
  "docs/citation.md",
  "docs/review-workflow.md",
  "docs/source-audit.md",
  "docs/methodology.md",
  "docs/data-dictionary.md"
]) {
  if (!(await fileExists(requiredDoc))) {
    errors.push(`Missing public documentation artifact ${requiredDoc}`);
  }
}

if (errors.length) {
  console.error(`Accessibility QA failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Accessibility QA passed for ${(await htmlFiles()).length} HTML pages.`);
