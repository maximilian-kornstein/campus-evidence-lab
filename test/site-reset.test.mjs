import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { buildSite, REQUIRED_FILES, PAGE_FILES, PAPER_SLUGS, FULL_PAPER_SLUGS, PREVIEW_PAGES, previewFiles, ROOT } from "../scripts/build-static.mjs";
import { checkSite } from "../scripts/check-site.mjs";
import { createSiteServer } from "../scripts/dev-server.mjs";

const document = (body, extra = "") => `<!doctype html><html lang="en"><head><title>Kornstein Lab</title><meta name="viewport" content="width=device-width, initial-scale=1">${extra}<link rel="stylesheet" href="/assets/styles.css"><link rel="icon" href="/assets/favicon.svg"></head><body><main><h1>Kornstein Lab</h1>${body}</main></body></html>`;
const noindex = '<meta name="robots" content="noindex">';
const publicRoutes = [
  "/", "/research/", "/methods/", "/about/",
  "/research/dark-figure/", "/research/contagion/", "/research/attitudes/", "/research/amplification/",
  "/research/measurement/", "/research/detection/", "/research/narratives/",
];
const webp = (body = "VP8 fixture image") => {
  const chunk = Buffer.from(`WEBP${body}`);
  const header = Buffer.from("RIFF\0\0\0\0");
  header.writeUInt32LE(chunk.length, 4);
  return Buffer.concat([header, chunk]);
};

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "kornstein-site-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of REQUIRED_FILES) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    let content = "fixture";
    if (file.endsWith(".html")) content = document('<a href="/">Home</a>', ["404.html", "reader/index.html"].includes(file) ? noindex : "");
    if (file.endsWith(".css")) content = "body { color: black; }";
    if (file.endsWith(".svg")) content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842"/>';
    if (file.endsWith(".pdf")) content = "%PDF-1.7\nfixture document\n%%EOF\n";
    if (file.endsWith(".js")) content = "export {};";
    if (file.endsWith(".webp")) content = webp();
    await writeFile(path.join(root, file), content);
  }
  await writeFile(path.join(root, "index.html"), document('<a href="#research">Research</a><section id="research">Quantitative research</section>'));
  return root;
}

test("build removes stale routes and excludes retained archive sources and unrelated assets", async (t) => {
  const root = await fixture(t);
  for (const directory of ["events", "data", "papers/dark-figure/pdf", "dist/events"]) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, "events/index.html"), "legacy archive");
  await writeFile(path.join(root, "data/events.json"), "[]");
  await writeFile(path.join(root, "papers/measurement.tex"), "private build source");
  await writeFile(path.join(root, "papers/dark-figure/pdf/The-Dark-Figure.pdf"), "%PDF-1.7\nsource copy\n%%EOF\n");
  await writeFile(path.join(root, "pdfs/dark-figure/page-13.webp"), webp());
  await writeFile(path.join(root, "dist/events/index.html"), "stale deployed archive");
  await writeFile(path.join(root, "assets/app.js"), "throw new Error('retired');");
  await writeFile(path.join(root, "sitemap.xml"), "legacy sitemap");
  await writeFile(path.join(root, "rss.xml"), "legacy feed");
  const dist = await buildSite({ root, siteUrl: "" });
  const files = await checkSite(dist);
  for (const excluded of ["events/index.html", "data/events.json", "papers/measurement.tex", "papers/dark-figure/pdf/The-Dark-Figure.pdf", "pdfs/dark-figure/page-13.webp", "assets/app.js", "rss.xml"]) assert.ok(!files.includes(excluded), excluded);
  for (const route of publicRoutes) assert.ok(files.includes(route.slice(1) + "index.html"), route);
  for (const slug of FULL_PAPER_SLUGS) {
    for (const file of [`pdfs/${slug}.pdf`, `assets/artwork-paper-${slug}.png`, `assets/artwork-research-${slug}.png`, ...previewFiles(slug)]) assert.ok(files.includes(file), file);
  }
  assert.equal(await readFile(path.join(root, "events/index.html"), "utf8"), "legacy archive");
  assert.equal(await readFile(path.join(dist, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\n");
});

test("sitemap indexes real pages once, excludes reader and 404, and is removed when SITE_URL is omitted", async (t) => {
  const root = await fixture(t);
  const dist = await buildSite({ root, siteUrl: "https://example.org/lab" });
  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(urls, publicRoutes.map((route) => `https://example.org/lab${route}`));
  assert.doesNotMatch(sitemap, /reader|404|events|pdfs/);
  await checkSite(dist);
  assert.match(await readFile(path.join(dist, "robots.txt"), "utf8"), /Sitemap: https:\/\/example.org\/lab\/sitemap.xml/);
  await buildSite({ root, siteUrl: "" });
  assert.ok(!(await readdir(dist)).includes("sitemap.xml"));
});

test("invalid publication URL or missing required source cannot replace a valid build", async (t) => {
  const root = await fixture(t);
  const dist = await buildSite({ root, siteUrl: "" });
  const original = await readFile(path.join(dist, "index.html"), "utf8");
  for (const url of ["file:///tmp", "https://name:secret@example.org", "https://example.org/?draft=1"]) await assert.rejects(buildSite({ root, siteUrl: url }), /SITE_URL/);
  for (const file of ["pdfs/detection.pdf", "pdfs/contagion/page-07.webp", "pdfs/attitudes.pdf", "research/amplification/index.html"]) {
    const content = await readFile(path.join(root, file));
    await rm(path.join(root, file));
    await assert.rejects(buildSite({ root, siteUrl: "" }), /ENOENT/, file);
    assert.equal(await readFile(path.join(dist, "index.html"), "utf8"), original);
    await writeFile(path.join(root, file), content);
  }
});

test("site check catches deleted-page links, missing fragments, and inaccessible images", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "index.html"), document('<a href="/events/">Archive</a>'));
  const dist = await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing link target \/events\//);
  await writeFile(path.join(root, "index.html"), document('<a href="#missing">Research</a>'));
  await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing fragment #missing/);
  await writeFile(path.join(root, "index.html"), document('<img src="/assets/artwork-reference.png">'));
  await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing alt text/);
  await writeFile(path.join(root, "index.html"), document('<a href="/research/dark-figure/#methods">Methods</a>'));
  await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing fragment \/research\/dark-figure\/#methods/);
});

test("site check catches missing CSS assets, invalid PDFs and previews, and unexpected public files", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "assets/styles.css"), 'body { background: url("missing.svg"); }');
  const dist = await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing link target missing.svg/);
  await writeFile(path.join(dist, "assets/styles.css"), "body {}");
  await checkSite(dist);
  const restore = [];
  const corrupt = async (file, content, pattern) => {
    restore.push([file, await readFile(path.join(dist, file))]);
    await writeFile(path.join(dist, file), content);
    await assert.rejects(checkSite(dist), pattern, file);
    for (const [name, original] of restore.splice(0)) await writeFile(path.join(dist, name), original);
  };
  await corrupt("pdfs/measurement.pdf", "not a pdf", /Invalid PDF document: measurement/);
  await corrupt("pdfs/dark-figure.pdf", "%PDF-1.7\ntruncated", /Invalid PDF document: dark-figure/);
  await corrupt("pdfs/amplification.pdf", "<html>not found</html>", /Invalid PDF document: amplification/);
  await corrupt("pdfs/contagion/page-12.webp", Buffer.from("\x89PNG\r\n\x1a\nnot webp"), /Invalid preview image: pdfs\/contagion\/page-12.webp/);
  await corrupt("pdfs/attitudes/page-01.webp", webp().subarray(0, 16), /Invalid preview image: pdfs\/attitudes\/page-01.webp/);
  await rm(path.join(dist, "pdfs/dark-figure/page-03.webp"));
  await assert.rejects(checkSite(dist), /Missing public file: pdfs\/dark-figure\/page-03.webp/);
  await writeFile(path.join(dist, "pdfs/dark-figure/page-03.webp"), webp());
  await checkSite(dist);
  await writeFile(path.join(dist, "pdfs/dark-figure/page-13.webp"), webp());
  await assert.rejects(checkSite(dist), /Unexpected public file: pdfs\/dark-figure\/page-13.webp/);
  await rm(path.join(dist, "pdfs/dark-figure/page-13.webp"));
  await writeFile(path.join(dist, "private.json"), "{}");
  await assert.rejects(checkSite(dist), /Unexpected public file: private.json/);
});

test("dev server serves pages, PDFs and previews with correct types while retired routes remain real 404s", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "package.json"), '{"private": true}');
  const dist = await buildSite({ root, siteUrl: "" });
  const server = createSiteServer(dist);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const readerRoutes = [...PAPER_SLUGS, ...FULL_PAPER_SLUGS].map((slug) => `/reader/?paper=${slug}`);
  for (const route of [...publicRoutes, ...readerRoutes, "/reader/?paper=dark-figure&page=12"]) assert.equal((await fetch(`${url}${route}`)).status, 200, route);
  const canonical = await fetch(`${url}/research?topic=models`, { redirect: "manual" });
  assert.equal(canonical.status, 308);
  assert.equal(canonical.headers.get("location"), "/research/?topic=models");
  for (const [file, type] of [["assets/styles.css", "text/css"], ["assets/reader.js", "text/javascript"], ["assets/fonts/InterVariable.woff2", "font/woff2"], ["assets/artwork-reference.png", "image/png"], ["assets/artwork-paper-contagion.png", "image/png"]]) {
    const response = await fetch(`${url}/${file}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
  }
  for (const slug of [...PAPER_SLUGS, ...FULL_PAPER_SLUGS]) {
    const response = await fetch(`${url}/pdfs/${slug}.pdf`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(await response.text(), /^%PDF-/);
  }
  for (const slug of PAPER_SLUGS) assert.equal((await fetch(`${url}/pdfs/${slug}-page.svg`)).headers.get("content-type"), "image/svg+xml");
  for (const slug of FULL_PAPER_SLUGS) {
    for (const file of [previewFiles(slug)[0], previewFiles(slug).at(-1)]) {
      const response = await fetch(`${url}/${file}`);
      assert.equal(response.status, 200, file);
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.equal(Buffer.from(await response.arrayBuffer()).subarray(8, 12).toString(), "WEBP");
    }
    assert.equal((await fetch(`${url}/pdfs/${slug}/page-13.webp`)).status, 404);
  }
  for (const retired of ["/events/", "/schools/", "/data/events.json", "/assets/app.js", "/package.json", "/papers/measurement.tex", "/papers/dark-figure/pdf/The-Dark-Figure.pdf", "/_headers"]) {
    const response = await fetch(`${url}${retired}`);
    assert.equal(response.status, 404, retired);
    assert.match(await response.text(), /name="robots" content="noindex"/);
  }
  assert.equal((await fetch(`${url}/%2e%2e%2fpackage.json`)).status, 400);
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.ok(Number(head.headers.get("content-length")) > 0);
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
});

test("reader allows only known papers, preview pages and zoom levels", async () => {
  const reader = await import("../assets/reader.js");
  const { PAPERS, resolvePaper, resolvePage, previewSource, normalizeZoom } = reader;
  assert.deepEqual(Object.keys(PAPERS).sort(), [...PAPER_SLUGS, ...FULL_PAPER_SLUGS].sort());
  for (const slug of PAPER_SLUGS) {
    assert.equal(resolvePaper(`?paper=${slug}`).slug, slug);
    assert.equal(resolvePaper(`?paper=${slug}`).kind, "proposal");
    assert.equal(previewSource(PAPERS[slug], 5), `/pdfs/${slug}-page.svg`);
    assert.equal(resolvePage(`?paper=${slug}&page=5`), 1);
  }
  assert.equal(reader.PREVIEW_PAGES, PREVIEW_PAGES);
  for (const slug of FULL_PAPER_SLUGS) {
    const entry = resolvePaper(`?paper=${slug}`);
    assert.equal(entry.slug, slug);
    assert.equal(entry.kind, "paper");
    assert.equal(entry.previewPages, PREVIEW_PAGES);
    assert.ok(Number.isInteger(entry.pages) && entry.pages > PREVIEW_PAGES, slug);
    assert.ok(entry.title && entry.subtitle && entry.abstract && entry.toc.length >= 5, slug);
    assert.deepEqual(previewFiles(slug).map((file) => `/${file}`), Array.from({ length: PREVIEW_PAGES }, (_, index) => previewSource(entry, index + 1)));
    for (const [page, expected] of [["1", 1], ["5", 5], ["12", 12], ["%31%32", 12]]) assert.equal(resolvePage(`?paper=${slug}&page=${page}`), expected, page);
    for (const page of ["", "0", "13", "99", "05", "-1", "5.5", "1e1", "+5", " 5", "five", "../1", "https://example.org/"]) assert.equal(resolvePage(`?paper=${slug}&page=${encodeURIComponent(page)}`), 1, page);
  }
  for (const search of ["", "?paper=unknown", "?paper=../../package.json", "?paper=https://example.org/evil.pdf", "?paper=__proto__", "?paper=constructor",
    "?paper=toString", "?paper=Dark-Figure", "?paper=dark-figure%2F..%2Fmeasurement", "?paper=%20contagion", "?paper[]=contagion", "?page=3"]) {
    assert.equal(resolvePaper(search).slug, "measurement", search);
    assert.equal(resolvePage(search), 1, search);
  }
  assert.equal(resolvePaper("?paper=attitudes&paper=../../evil").slug, "attitudes");
  for (const zoom of [75, 100, 125, 150]) assert.equal(normalizeZoom(String(zoom)), zoom);
  for (const zoom of ["", "javascript:alert(1)", -1, 999, "NaN"]) assert.equal(normalizeZoom(zoom), 100);
});

test("paper contents match the LaTeX section headings", async () => {
  const { PAPERS } = await import("../assets/reader.js");
  for (const slug of FULL_PAPER_SLUGS) {
    const main = await readFile(path.join(ROOT, `papers/${slug}/main.tex`), "utf8");
    const headings = [];
    for (const [, file] of main.matchAll(/^\\IfFileExists\{(sections\/[^}]+)\.tex\}/gm)) {
      const source = await readFile(path.join(ROOT, `papers/${slug}/${file}.tex`), "utf8");
      headings.push(/^\\section\{([^}]+)\}/m.exec(source)[1]);
    }
    assert.deepEqual(PAPERS[slug].toc, headings, slug);
    assert.match(PAPERS[slug].abstract, /report no (empirical estimates|finding)/, slug);
    assert.doesNotMatch(PAPERS[slug].abstract, /[\\$]|\{|\}/, slug);
  }
});

const READER_IDS = ["canvas", "sheet", "preview", "zoom", "back", "download", "title", "transcript", "status", "prev", "next", "count", "end", "end-note", "end-open", "end-download"];
const element = (tag = "") => ({
  tag, children: [], events: new Map(), attributes: new Map(), textContent: "", value: "100", disabled: true, hidden: false,
  style: { setProperty(name, value) { this[name] = value; } },
  append(child) { this.children.push(child); },
  replaceChildren(...children) { this.children = children; },
  addEventListener(name, handler) { this.events.set(name, handler); },
  setAttribute(name, value) { this.attributes.set(name, String(value)); },
  getAttribute(name) { return this.attributes.get(name) ?? null; },
  focus() { globalThis.document.activeElement = this; },
});
const text = (node) => [node.textContent, ...node.children.map(text)].join(" ");

function fakeBrowser(t) {
  const saved = Object.fromEntries(["document", "window", "Image"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return async (search, { history } = {}) => {
    const { initializeReader } = await import("../assets/reader.js");
    const nodes = Object.fromEntries(READER_IDS.map((key) => [`reader-${key}`, element()]));
    nodes.main = element("main");
    nodes["reader-end"].hidden = true;
    nodes["reader-canvas"].clientWidth = 1430;
    const windowEvents = new Map();
    globalThis.document = { title: "", activeElement: null, getElementById: (id) => nodes[id], createElement: element, createDocumentFragment: element };
    globalThis.window = { location: { search }, history, addEventListener: (name, handler) => windowEvents.set(name, handler) };
    initializeReader();
    const click = (key) => nodes[`reader-${key}`].events.get("click")();
    const press = (key, options = {}) => {
      const event = { key, target: nodes["reader-canvas"], defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
      nodes["reader-canvas"].events.get("keydown")(event);
      return event.defaultPrevented;
    };
    return { nodes, windowEvents, click, press };
  };
}

test("reader keeps single-page proposals: matching links and transcript, disabled paging, resize and zoom", async (t) => {
  const mount = fakeBrowser(t);
  for (const slug of PAPER_SLUGS) {
    const { nodes, windowEvents, click, press } = await mount(`?paper=${slug}&page=3`);
    assert.equal(nodes.main.getAttribute("data-reader-kind"), "proposal");
    assert.equal(nodes["reader-back"].href, `/research/${slug}/`);
    assert.equal(nodes["reader-download"].href, `/pdfs/${slug}.pdf`);
    assert.equal(nodes["reader-download"].download, `${slug}.pdf`);
    assert.equal(nodes["reader-preview"].src, `/pdfs/${slug}-page.svg`);
    assert.equal(nodes["reader-preview"].loading, undefined);
    assert.match(text(nodes["reader-transcript"]), /Kornstein Lab for Antisemitism Research.*Abstract.*Limitations/);
    assert.doesNotMatch(text(nodes["reader-transcript"]), /Research proposal|Contents|full text/);
    for (const key of ["prev", "next"]) assert.equal(nodes[`reader-${key}`].disabled, true, key);
    assert.equal(nodes["reader-count"].textContent, "1 / 1");
    assert.equal(nodes["reader-count"].getAttribute("aria-label"), "Page 1 of 1");
    assert.equal(nodes["reader-end"].hidden, true);
    assert.equal(nodes["reader-preview"].hidden, false);
    click("next");
    assert.equal(press("ArrowRight"), false);
    assert.equal(press("PageDown"), false);
    assert.equal(nodes["reader-preview"].src, `/pdfs/${slug}-page.svg`);
    assert.equal(nodes["reader-count"].textContent, "1 / 1");
    assert.equal(nodes["reader-next"].disabled, true);
    assert.equal(nodes["reader-status"].textContent, "");
    assert.equal(nodes["reader-sheet"].style.width, "710px");
    assert.equal(nodes["reader-zoom"].disabled, false);
    nodes["reader-zoom"].value = "150";
    nodes["reader-zoom"].events.get("change")();
    assert.equal(nodes["reader-sheet"].style.width, "1065px");
    assert.match(nodes["reader-status"].textContent, /150/);
    nodes["reader-canvas"].clientWidth = 328;
    windowEvents.get("resize")();
    assert.equal(nodes["reader-sheet"].style.width, "420px");
    nodes["reader-preview"].events.get("error")();
    assert.match(nodes["reader-status"].textContent, /Download PDF to read the proposal/);
  }
});

test("reader pages through methods-paper previews to an end-of-preview sheet", async (t) => {
  const { PAPERS } = await import("../assets/reader.js");
  const mount = fakeBrowser(t);
  for (const slug of FULL_PAPER_SLUGS) {
    const entry = PAPERS[slug];
    const { nodes, windowEvents, click, press } = await mount(`?paper=${slug}`);
    const preview = nodes["reader-preview"];
    const count = nodes["reader-count"];
    const status = nodes["reader-status"];
    const expectPage = (page) => {
      assert.equal(preview.src, `/pdfs/${slug}/page-${String(page).padStart(2, "0")}.webp`);
      assert.equal(preview.hidden, false);
      assert.equal(nodes["reader-end"].hidden, true);
      assert.equal(count.textContent, `${page} / 12`);
      assert.equal(count.getAttribute("aria-label"), `Preview page ${page} of 12 (the full paper has ${entry.pages} pages)`);
      assert.equal(nodes["reader-prev"].disabled, page === 1);
      assert.equal(nodes["reader-next"].disabled, false);
    };
    const expectEnd = () => {
      assert.equal(nodes["reader-end"].hidden, false);
      assert.equal(preview.hidden, true);
      assert.equal(count.textContent, "End");
      assert.match(count.getAttribute("aria-label"), new RegExp(`End of preview: page 12 of ${entry.pages}`));
      assert.equal(nodes["reader-prev"].disabled, false);
      assert.equal(nodes["reader-next"].disabled, true);
    };

    assert.equal(nodes.main.getAttribute("data-reader-kind"), "paper");
    assert.equal(globalThis.document.title, `${entry.title} — Kornstein Lab`);
    assert.equal(nodes["reader-title"].textContent, entry.title);
    assert.equal(nodes["reader-back"].href, `/research/${slug}/`);
    for (const key of ["download", "end-download"]) {
      assert.equal(nodes[`reader-${key}`].href, `/pdfs/${slug}.pdf`);
      assert.equal(nodes[`reader-${key}`].download, `${slug}.pdf`);
    }
    assert.equal(nodes["reader-end-open"].href, `/pdfs/${slug}.pdf`);
    assert.equal(nodes["reader-end-open"].target, "_blank");
    assert.match(nodes["reader-end-open"].rel, /\bnoopener\b/);
    assert.equal(nodes["reader-end-note"].textContent, `Preview ends here, page 12 of ${entry.pages}.`);
    assert.equal(preview.loading, "lazy");
    assert.deepEqual([preview.width, preview.height], [612, 792]);
    assert.equal(status.textContent, "");
    expectPage(1);

    const transcript = text(nodes["reader-transcript"]);
    for (const part of [entry.title, entry.subtitle, "Abstract", entry.abstract, "Contents", ...entry.toc, "The full text is available in the PDF."]) assert.ok(transcript.includes(part), part);
    assert.doesNotMatch(transcript, /Limitations|Proposed methodology|Research proposal/);
    const find = (node, tag) => node.tag === tag ? node : node.children.map((child) => find(child, tag)).find(Boolean);
    const contents = find(nodes["reader-transcript"], "ol");
    assert.deepEqual(contents.children.map((item) => [item.tag, item.textContent]), entry.toc.map((heading) => ["li", heading]));

    for (let page = 2; page <= 12; page += 1) {
      click("next");
      expectPage(page);
      assert.equal(status.textContent, `Preview page ${page} of 12.`);
    }
    click("next");
    expectEnd();
    assert.equal(preview.src, `/pdfs/${slug}/page-12.webp`);
    assert.match(status.textContent, new RegExp(`Preview ends here, page 12 of ${entry.pages}\\. Open the full PDF`));
    click("next");
    expectEnd();
    click("prev");
    expectPage(12);

    assert.equal(press("ArrowLeft"), true);
    expectPage(11);
    assert.equal(press("PageUp"), true);
    expectPage(10);
    assert.equal(press("PageDown"), true);
    expectPage(11);
    assert.equal(press("ArrowRight"), true);
    expectPage(12);
    assert.equal(press("ArrowRight"), true);
    expectEnd();
    press("PageDown");
    expectEnd();
    assert.equal(press("ArrowLeft", { target: nodes["reader-end-open"] }), false);
    assert.equal(press("ArrowLeft", { altKey: true }), false);
    assert.equal(press("ArrowDown"), false);
    expectEnd();
    for (let step = 0; step < 15; step += 1) press("ArrowLeft");
    expectPage(1);

    // Zoom applies to every page and after resizing.
    nodes["reader-zoom"].value = "150";
    nodes["reader-zoom"].events.get("change")();
    assert.equal(nodes["reader-sheet"].style.width, "1065px");
    click("next");
    expectPage(2);
    assert.equal(nodes["reader-sheet"].style.width, "1065px");
    nodes["reader-canvas"].clientWidth = 328;
    windowEvents.get("resize")();
    assert.equal(nodes["reader-sheet"].style.width, "420px");
    nodes["reader-zoom"].value = "75";
    nodes["reader-zoom"].events.get("change")();
    assert.equal(nodes["reader-sheet"].style.width, "210px");
    nodes["reader-canvas"].scrollTop = 500;
    click("next");
    assert.equal(nodes["reader-canvas"].scrollTop, 0);

    // A keyboard user is not stranded on a button that has just been disabled.
    click("prev");
    click("prev");
    globalThis.document.activeElement = nodes["reader-prev"];
    click("next");
    click("prev");
    expectPage(1);
    assert.equal(globalThis.document.activeElement, nodes["reader-next"]);
    for (let step = 0; step < 11; step += 1) press("ArrowRight");
    globalThis.document.activeElement = nodes["reader-next"];
    click("next");
    expectEnd();
    assert.equal(globalThis.document.activeElement, nodes["reader-end-open"]);

    // The next page is warmed after the current one loads; errors point to the PDF.
    const requested = [];
    globalThis.Image = class { set src(value) { requested.push(value); } };
    click("prev");
    preview.events.get("load")();
    assert.deepEqual(requested, []);
    click("prev");
    preview.events.get("load")();
    assert.deepEqual(requested, [`/pdfs/${slug}/page-12.webp`]);
    delete globalThis.Image;
    preview.events.get("error")();
    assert.match(status.textContent, /Download PDF to read the paper/);
  }
});

test("reader opens a validated preview page from the link and keeps the address in step", async (t) => {
  const mount = fakeBrowser(t);
  const calls = [];
  const history = { state: null, replaceState(state, title, url) { calls.push(url); } };
  const { nodes, click } = await mount("?paper=contagion&page=5", { history });
  assert.equal(nodes["reader-preview"].src, "/pdfs/contagion/page-05.webp");
  assert.equal(nodes["reader-count"].textContent, "5 / 12");
  assert.equal(nodes["reader-prev"].disabled, false);
  assert.equal(nodes["reader-status"].textContent, "");
  assert.deepEqual(calls, []);
  click("next");
  assert.deepEqual(calls, ["?paper=contagion&page=6"]);
  for (let step = 0; step < 5; step += 1) click("prev");
  assert.equal(calls.at(-1), "?paper=contagion");
  for (let step = 0; step < 12; step += 1) click("next");
  assert.equal(nodes["reader-end"].hidden, false);
  assert.equal(calls.at(-1), "?paper=contagion&page=12");

  for (const search of ["?paper=contagion&page=13", "?paper=contagion&page=0", "?paper=contagion&page=javascript:alert(1)"]) {
    const { nodes: fresh } = await mount(search);
    assert.equal(fresh["reader-preview"].src, "/pdfs/contagion/page-01.webp", search);
    assert.equal(fresh["reader-count"].textContent, "1 / 12", search);
  }
  for (const search of ["?paper=https://example.org/evil.pdf&page=3", "?paper=../pdfs/dark-figure&page=3", "?paper=__proto__"]) {
    const { nodes: fallback } = await mount(search);
    assert.equal(fallback["reader-preview"].src, "/pdfs/measurement-page.svg", search);
    assert.equal(fallback["reader-download"].href, "/pdfs/measurement.pdf", search);
    assert.equal(fallback["reader-back"].href, "/research/measurement/", search);
    assert.equal(fallback["reader-count"].textContent, "1 / 1", search);
    assert.equal(fallback["reader-next"].disabled, true, search);
  }
});

test("reader page offers every PDF without JavaScript and an end-of-preview sheet", async () => {
  const page = await readFile(path.join(ROOT, "reader/index.html"), "utf8");
  for (const id of READER_IDS) assert.match(page, new RegExp(`id="reader-${id}"`), id);
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(page)[1];
  for (const slug of [...PAPER_SLUGS, ...FULL_PAPER_SLUGS]) assert.match(noscript, new RegExp(`href="/pdfs/${slug}\\.pdf"`), slug);
  assert.match(page, /<div class="reader-end" id="reader-end" hidden>/);
  assert.match(page, /id="reader-end-open"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(page, /<button[^>]*id="reader-prev"[^>]*disabled/);
  assert.match(page, /<button[^>]*id="reader-next"[^>]*disabled/);
  const styles = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
  assert.equal(styles.match(/\/\* === Reader: multi-page === \*\//g)?.length, 1);
  assert.match(styles, /\/\* === Reader: multi-page === \*\/[\s\S]*\.reader-end\[hidden\][\s\S]*\/\* === end reader === \*\//);
});

test("current page content keeps Kornstein identity and quantitative research focus", async () => {
  for (const file of PAGE_FILES) {
    const content = await readFile(path.join(ROOT, file), "utf8");
    assert.match(content, /Kornstein Lab/, file);
    assert.doesNotMatch(content, /Campus Evidence Lab|public[- ]records|Search Records/i, file);
  }
  for (const slug of FULL_PAPER_SLUGS) {
    const content = await readFile(path.join(ROOT, `research/${slug}/index.html`), "utf8");
    assert.match(content, new RegExp(`href="/reader/\\?paper=${slug}"`), slug);
    assert.match(content, /\bid="methods"/, slug);
  }
});
