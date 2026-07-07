import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { ChromeDevToolsClient, closeChromeTarget, createChromeTarget } from "./chrome-devtools-client.mjs";
import {
  OCR_OPEN_INVESTIGATION_BASE_URL,
  OCR_OPEN_INVESTIGATION_SOURCE_FAMILY,
  ocrOpenInvestigationPageUrl,
  parseOcrDisplayCount
} from "./ocr-open-investigations-lib.mjs";
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
    "--user-data-dir=/tmp/codex-chrome-ocr-open-investigations",
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
    const rows = [...document.querySelectorAll("table tbody tr")].map((tr) => {
      const cells = [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\\s+/g, " ").trim());
      return {
        state: cells[0] || "",
        institution: cells[1] || "",
        institution_type: cells[2] || "",
        discrimination_type: cells[3] || "",
        open_investigation_date: cells[4] || ""
      };
    }).filter((row) => row.state && row.institution && row.institution_type && row.discrimination_type && row.open_investigation_date);
    const display = (bodyText.match(/Displaying\\s+[\\d,]+\\s+-\\s+[\\d,]+\\s+of\\s+[\\d,]+\\s+records/i) || [""])[0];
    return JSON.stringify({
      href: location.href,
      title: document.title,
      display,
      rows
    });
  })()`;
}

async function waitForPageRows(client, { expectedStart }) {
  const deadline = Date.now() + 30000;
  let last = null;
  while (Date.now() < deadline) {
    const value = await client.evaluate(extractPageExpression());
    const parsed = JSON.parse(value);
    parsed.display_count = parseOcrDisplayCount(parsed.display);
    last = parsed;
    const expectedRows = parsed.display_count ? parsed.display_count.end - parsed.display_count.start + 1 : 0;
    if (parsed.display_count?.start === expectedStart && parsed.rows.length >= expectedRows) return parsed;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Timed out waiting for OCR page rows at start ${expectedStart}; last href=${last?.href ?? "none"} display=${last?.display ?? "none"} rows=${last?.rows?.length ?? 0}`
  );
}

function discoveryRowsForPage(pageResult, pageIndex) {
  return pageResult.rows.map((row, index) => {
    const sourceLocator = [
      "OCR open investigations table row",
      `page=${pageIndex}`,
      `page_row=${index + 1}`,
      `state=${row.state}`,
      `institution=${row.institution}`,
      `institution_type=${row.institution_type}`,
      `type=${row.discrimination_type}`,
      `open_date=${row.open_investigation_date}`
    ].join("; ");
    return {
      row_id: `ocr_open_${String(pageResult.display_count.start + index).padStart(5, "0")}`,
      source_page_url: pageResult.href,
      source_locator: sourceLocator,
      raw_source_hash: sha256({ source_page_url: pageResult.href, source_locator: sourceLocator, row }),
      ...row
    };
  });
}

const remoteDebuggingUrl = readArg("--remote-debugging-url", "http://127.0.0.1:9222");
const outPath = readArg("--out", "data/ocr-open-investigations-discovery.json");
const itemsPerPage = Number.parseInt(readArg("--items-per-page", "1000"), 10);

if (!Number.isInteger(itemsPerPage) || itemsPerPage <= 0) {
  console.error("Usage: node scripts/discover-ocr-open-investigations.mjs [--items-per-page <positive integer>] [--out <path>]");
  process.exit(1);
}

await ensureChrome(remoteDebuggingUrl);

const command = `node scripts/discover-ocr-open-investigations.mjs --items-per-page ${itemsPerPage} --out ${outPath}`;
const pages = [];
const rows = [];

let pageIndex = 0;
let total = 0;
let pageCount = 0;

async function collectPage(pageIndex) {
  const url = ocrOpenInvestigationPageUrl({ page: pageIndex, itemsPerPage });
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const target = await createChromeTarget(remoteDebuggingUrl, "about:blank");
    const client = new ChromeDevToolsClient(target.webSocketDebuggerUrl);

    try {
      await client.connect();
      await client.call("Runtime.enable");
      await client.call("Page.enable");
      await client.call("Page.navigate", { url });
      const expectedStart = pageIndex * itemsPerPage + 1;
      return await waitForPageRows(client, { expectedStart });
    } catch (error) {
      lastError = error;
      console.warn(`OCR discovery page ${pageIndex + 1} attempt ${attempt} failed: ${error.message}`);
    } finally {
      client.close();
      await closeChromeTarget(remoteDebuggingUrl, target.id);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }

  throw lastError;
}

while (pageIndex === 0 || pageIndex < pageCount) {
  const pageResult = await collectPage(pageIndex);
  total = pageResult.display_count.total;
  pageCount = Math.ceil(total / itemsPerPage);
  const discoveryRows = discoveryRowsForPage(pageResult, pageIndex);
  rows.push(...discoveryRows);
  pages.push({
    page: pageIndex,
    source_url: pageResult.href,
    display_count: pageResult.display_count,
    row_count: discoveryRows.length,
    raw_hash: sha256(discoveryRows)
  });
  console.log(`OCR discovery page ${pageIndex + 1}/${pageCount}: ${discoveryRows.length} rows (${rows.length}/${total}).`);
  pageIndex += 1;
}

const artifact = {
  id: "ocr-open-investigations-discovery",
  source_family: OCR_OPEN_INVESTIGATION_SOURCE_FAMILY,
  source_url: OCR_OPEN_INVESTIGATION_BASE_URL,
  generated_at: new Date().toISOString().slice(0, 10),
  command,
  total_rows: rows.length,
  page_count: pages.length,
  pages,
  counts: {
    institution_type: countBy(rows, "institution_type"),
    discrimination_type: countBy(rows, "discrimination_type"),
    state: countBy(rows, "state")
  },
  rows,
  raw_source_hash: sha256(rows),
  public_claim_limit:
    "This discovery artifact preserves OCR open-investigation source rows. Inclusion means OCR listed an open investigation; it is not a legal finding, ranking, prevalence estimate, safety score, or severity score."
};

await writeJson(path.resolve(rootDir, outPath), artifact);
console.log(`Wrote ${rows.length} OCR open-investigation discovery rows to ${outPath}.`);
