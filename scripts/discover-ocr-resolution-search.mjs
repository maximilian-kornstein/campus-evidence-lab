import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { ChromeDevToolsClient, closeChromeTarget, createChromeTarget } from "./chrome-devtools-client.mjs";
import {
  OCR_RESOLUTION_BASE_URL,
  OCR_RESOLUTION_SOURCE_FAMILY,
  ocrResolutionSearchPageUrl,
  parseOcrResolutionRows
} from "./ocr-resolution-search-lib.mjs";
import { rootDir, sha256, writeJson } from "./lib.mjs";

const execFileAsync = promisify(execFile);

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countByYear(rows) {
  return rows.reduce((acc, row) => {
    const year = String(row.resolved_date ?? "").slice(-4) || "unknown";
    acc[year] = (acc[year] ?? 0) + 1;
    return acc;
  }, {});
}

function parseDisplayedTotal(text) {
  const match = String(text ?? "").match(/Displaying\s+([\d,]+)\s+results/i);
  if (!match) return 0;
  return Number.parseInt(match[1].replace(/,/g, ""), 10);
}

async function ensureChrome(remoteDebuggingUrl) {
  try {
    const response = await fetch(`${remoteDebuggingUrl.replace(/\/$/, "")}/json/version`);
    if (response.ok) return;
  } catch {}

  if (hasFlag("--no-launch")) {
    throw new Error(`Chrome DevTools is not reachable at ${remoteDebuggingUrl}. Start Chrome with --remote-debugging-port or omit --no-launch.`);
  }

  await execFileAsync("open", [
    "-na",
    "Google Chrome",
    "--args",
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/codex-chrome-ocr-resolution-search",
    "about:blank"
  ]);

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${remoteDebuggingUrl.replace(/\/$/, "")}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Chrome DevTools did not become reachable at ${remoteDebuggingUrl}.`);
}

function extractPageExpression() {
  return `(() => {
    const bodyText = document.body?.innerText || "";
    const rows = [...document.querySelectorAll(".views-row")].map((row) => ({
      text: row.innerText.replace(/\\s+/g, " ").trim(),
      links: [...row.querySelectorAll("a")].map((link) => ({
        text: link.innerText.replace(/\\s+/g, " ").trim(),
        href: link.href
      }))
    })).filter((row) => row.text);
    return JSON.stringify({
      href: location.href,
      title: document.title,
      total: (bodyText.match(/Displaying\\s+[\\d,]+\\s+results/i) || [""])[0],
      rows
    });
  })()`;
}

async function waitForPageRows(client, { pageIndex }) {
  const deadline = Date.now() + 30000;
  let last = null;
  while (Date.now() < deadline) {
    const value = await client.evaluate(extractPageExpression());
    const parsed = JSON.parse(value);
    parsed.total_count = parseDisplayedTotal(parsed.total);
    parsed.parsed_rows = parseOcrResolutionRows(parsed.rows);
    last = parsed;
    if (parsed.total_count > 0 && (parsed.parsed_rows.length > 0 || pageIndex > 0)) return parsed;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Timed out waiting for OCR resolution page ${pageIndex + 1}; last href=${last?.href ?? "none"} total=${last?.total ?? "none"} rows=${last?.parsed_rows?.length ?? 0}`
  );
}

function discoveryRowsForPage(pageResult, pageIndex) {
  return pageResult.parsed_rows.map((row, index) => {
    const sourceLocator = [
      "OCR recent resolution search result",
      `page=${pageIndex}`,
      `page_row=${index + 1}`,
      `institution=${row.institution}`,
      `state=${row.state}`,
      `ocr_reference=${row.ocr_reference}`,
      `resolved_date=${row.resolved_date}`
    ].join("; ");
    return {
      row_id: `ocr_resolution_${String(pageIndex * 20 + index + 1).padStart(5, "0")}`,
      source_page_url: pageResult.href,
      source_locator: sourceLocator,
      raw_source_hash: sha256({ source_page_url: pageResult.href, source_locator: sourceLocator, row }),
      ...row
    };
  });
}

const remoteDebuggingUrl = readArg("--remote-debugging-url", "http://127.0.0.1:9222");
const outPath = readArg("--out", "data/ocr-resolution-search-discovery.json");
const maxPages = Number.parseInt(readArg("--max-pages", "0"), 10);

await ensureChrome(remoteDebuggingUrl);

const command = `node scripts/discover-ocr-resolution-search.mjs --out ${outPath}${maxPages > 0 ? ` --max-pages ${maxPages}` : ""}`;
const pages = [];
const rows = [];

let pageIndex = 0;
let total = 0;
let pageCount = 0;

async function collectPage(pageIndex) {
  const url = ocrResolutionSearchPageUrl({ page: pageIndex });
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const target = await createChromeTarget(remoteDebuggingUrl, "about:blank");
    const client = new ChromeDevToolsClient(target.webSocketDebuggerUrl);

    try {
      await client.connect();
      await client.call("Runtime.enable");
      await client.call("Page.enable");
      await client.call("Page.navigate", { url });
      return await waitForPageRows(client, { pageIndex });
    } catch (error) {
      lastError = error;
      console.warn(`OCR resolution discovery page ${pageIndex + 1} attempt ${attempt} failed: ${error.message}`);
    } finally {
      client.close();
      await closeChromeTarget(remoteDebuggingUrl, target.id);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }

  throw lastError;
}

while (pageIndex === 0 || pageIndex < pageCount) {
  if (maxPages > 0 && pageIndex >= maxPages) break;
  const pageResult = await collectPage(pageIndex);
  total = pageResult.total_count;
  pageCount = Math.ceil(total / Math.max(pageResult.parsed_rows.length, 1));
  const discoveryRows = discoveryRowsForPage(pageResult, pageIndex);
  rows.push(...discoveryRows);
  pages.push({
    page: pageIndex,
    source_url: pageResult.href,
    row_count: discoveryRows.length,
    raw_hash: sha256(discoveryRows)
  });
  console.log(`OCR resolution discovery page ${pageIndex + 1}/${pageCount}: ${discoveryRows.length} rows (${rows.length}/${total}).`);
  if (rows.length >= total) break;
  pageIndex += 1;
}

const artifact = {
  id: "ocr-resolution-search-discovery",
  source_family: OCR_RESOLUTION_SOURCE_FAMILY,
  source_url: OCR_RESOLUTION_BASE_URL,
  generated_at: new Date().toISOString().slice(0, 10),
  command,
  total_rows: rows.length,
  source_total_rows: total,
  page_count: pages.length,
  pages,
  counts: {
    state: countBy(rows, "state"),
    resolved_year: countByYear(rows)
  },
  rows,
  raw_source_hash: sha256(rows),
  public_claim_limit:
    "This discovery artifact preserves OCR Recent Resolution Search source rows for postsecondary institutions. Inclusion means OCR posted resolution documents; it is not a Campus Evidence Lab legal finding, ranking, prevalence estimate, safety score, or severity score."
};

await writeJson(path.resolve(rootDir, outPath), artifact);
console.log(`Wrote ${rows.length} OCR resolution discovery rows to ${outPath}.`);
