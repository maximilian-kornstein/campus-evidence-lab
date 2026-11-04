import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAPERS } from "../assets/reader.js";
import { FULL_PAPER_SLUGS, PREVIEW_PAGES, previewFiles } from "./build-static.mjs";

// Copies each final methods-paper PDF into pdfs/ and renders the reader's
// preview pages from it. Needs Poppler (pdfinfo, pdftocairo) and Python 3 with
// Pillow built with WebP support. Normal site builds use the committed output.
const root = fileURLToPath(new URL("../", import.meta.url));
const SOURCES = {
  "dark-figure": "papers/dark-figure/pdf/The-Dark-Figure.pdf",
  contagion: "papers/contagion/pdf/Shock-and-Contagion.pdf",
  attitudes: "papers/attitudes/pdf/Where-Does-Criticism-End.pdf",
  amplification: "papers/amplification/pdf/Supply-or-Demand.pdf",
};
const WIDTH = 1065; // 1.5x the reader's 710px sheet.
const QUALITY = 80;
const TO_WEBP = `
import sys
from PIL import Image
quality = int(sys.argv[1])
for source, target in zip(sys.argv[2::2], sys.argv[3::2]):
    with Image.open(source) as image:
        image.convert("RGB").save(target, "WEBP", quality=quality, method=6)
`;

const work = mkdtempSync(path.join(os.tmpdir(), "kornstein-previews-"));
let total = 0;
try {
  for (const slug of FULL_PAPER_SLUGS) {
    const source = path.join(root, SOURCES[slug]);
    const entry = PAPERS[slug];
    if (!entry || entry.kind !== "paper") throw new Error(`${slug}: missing from the reader registry`);
    const info = execFileSync("pdfinfo", [source], { encoding: "utf8" });
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if (!/^Page size:\s+612 x 792 pts/m.test(info)) throw new Error(`${slug}: expected US letter pages`);
    if (pages !== entry.pages) throw new Error(`${slug}: PDF has ${pages} pages; the reader registry says ${entry.pages}`);
    if (entry.previewPages !== PREVIEW_PAGES || pages < PREVIEW_PAGES) throw new Error(`${slug}: expected ${PREVIEW_PAGES} preview pages`);

    const directory = path.join(work, slug);
    mkdirSync(directory);
    const pairs = [];
    for (let page = 1; page <= PREVIEW_PAGES; page += 1) {
      const name = `page-${String(page).padStart(2, "0")}`;
      execFileSync("pdftocairo", ["-png", "-f", String(page), "-l", String(page), "-singlefile",
        "-scale-to-x", String(WIDTH), "-scale-to-y", "-1", source, path.join(directory, name)]);
      pairs.push(path.join(directory, `${name}.png`), path.join(directory, `${name}.webp`));
    }
    execFileSync("python3", ["-I", "-c", TO_WEBP, String(QUALITY), ...pairs]);

    const output = path.join(root, "pdfs", slug);
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    copyFileSync(source, path.join(root, `pdfs/${slug}.pdf`));
    let size = statSync(path.join(root, `pdfs/${slug}.pdf`)).size;
    for (const file of previewFiles(slug)) {
      copyFileSync(path.join(directory, path.basename(file)), path.join(root, file));
      size += statSync(path.join(root, file)).size;
    }
    const written = readdirSync(output).length;
    if (written !== PREVIEW_PAGES) throw new Error(`${slug}: wrote ${written} preview pages`);
    total += size;
    console.log(`${slug}: ${pages}-page PDF and ${PREVIEW_PAGES} WebP previews (${(size / 1e6).toFixed(2)} MB)`);
  }
  console.log(`Total: ${(total / 1e6).toFixed(2)} MB`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
