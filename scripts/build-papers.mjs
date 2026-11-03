import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "papers");
const output = path.join(root, "pdfs");
const work = mkdtempSync(path.join(os.tmpdir(), "kornstein-papers-"));
const slugs = ["measurement", "detection", "narratives"];
mkdirSync(output, { recursive: true });

try {
  for (const slug of slugs) {
    const log = execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", `-output-directory=${work}`, `${slug}.tex`], { cwd: source, encoding: "utf8" });
    if (!/Output written on .*\(1 page,/.test(log)) throw new Error(`${slug}: expected a single-page PDF`);
    if (/Overfull \\[hv]box/.test(log)) throw new Error(`${slug}: overfull typesetting box`);
    const pdf = path.join(work, `${slug}.pdf`);
    const svg = path.join(work, `${slug}-page.svg`);
    execFileSync("pdftocairo", ["-svg", "-f", "1", "-l", "1", pdf, svg]);
    // Cairo's per-process surface counter is not meaningful document content.
    const rendering = readFileSync(svg, "utf8").replace(/surface\d+/g, "paper-page");
    copyFileSync(pdf, path.join(output, `${slug}.pdf`));
    writeFileSync(path.join(output, `${slug}-page.svg`), rendering);
    console.log(`${slug}: one-page LaTeX PDF and matching SVG`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
