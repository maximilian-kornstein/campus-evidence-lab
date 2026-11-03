import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { buildSite, REQUIRED_FILES, PAGE_FILES, PAPER_SLUGS, ROOT } from "../scripts/build-static.mjs";
import { checkSite } from "../scripts/check-site.mjs";
import { createSiteServer } from "../scripts/dev-server.mjs";

const document = (body, extra = "") => `<!doctype html><html lang="en"><head><title>Kornstein Lab</title><meta name="viewport" content="width=device-width, initial-scale=1">${extra}<link rel="stylesheet" href="/assets/styles.css"><link rel="icon" href="/assets/favicon.svg"></head><body><main><h1>Kornstein Lab</h1>${body}</main></body></html>`;
const noindex = '<meta name="robots" content="noindex">';
const publicRoutes = ["/", "/research/", "/methods/", "/about/", "/research/measurement/", "/research/detection/", "/research/narratives/"];

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
    await writeFile(path.join(root, file), content);
  }
  await writeFile(path.join(root, "index.html"), document('<a href="#research">Research</a><section id="research">Quantitative research</section>'));
  return root;
}

test("build removes stale routes and excludes retained archive sources and unrelated assets", async (t) => {
  const root = await fixture(t);
  for (const directory of ["events", "data", "papers", "dist/events"]) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, "events/index.html"), "legacy archive");
  await writeFile(path.join(root, "data/events.json"), "[]");
  await writeFile(path.join(root, "papers/measurement.tex"), "private build source");
  await writeFile(path.join(root, "dist/events/index.html"), "stale deployed archive");
  await writeFile(path.join(root, "assets/app.js"), "throw new Error('retired');");
  await writeFile(path.join(root, "sitemap.xml"), "legacy sitemap");
  await writeFile(path.join(root, "rss.xml"), "legacy feed");
  const dist = await buildSite({ root, siteUrl: "" });
  const files = await checkSite(dist);
  for (const excluded of ["events/index.html", "data/events.json", "papers/measurement.tex", "assets/app.js", "rss.xml"]) assert.ok(!files.includes(excluded), excluded);
  for (const route of publicRoutes) assert.ok(files.includes(route.slice(1) + "index.html"), route);
  assert.equal(await readFile(path.join(root, "events/index.html"), "utf8"), "legacy archive");
  assert.equal(await readFile(path.join(dist, "robots.txt"), "utf8"), "User-agent: *\nAllow: /\n");
});

test("sitemap indexes real pages once, excludes reader and 404, and is removed when SITE_URL is omitted", async (t) => {
  const root = await fixture(t);
  const dist = await buildSite({ root, siteUrl: "https://example.org/lab" });
  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(urls, publicRoutes.map((route) => `https://example.org/lab${route}`));
  assert.doesNotMatch(sitemap, /reader|404|events/);
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
  await rm(path.join(root, "pdfs/detection.pdf"));
  await assert.rejects(buildSite({ root, siteUrl: "" }), /ENOENT/);
  assert.equal(await readFile(path.join(dist, "index.html"), "utf8"), original);
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
});

test("site check catches missing CSS assets, invalid PDFs, and unexpected public files", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "assets/styles.css"), 'body { background: url("missing.svg"); }');
  const dist = await buildSite({ root, siteUrl: "" });
  await assert.rejects(checkSite(dist), /missing link target missing.svg/);
  await writeFile(path.join(dist, "assets/styles.css"), "body {}");
  await writeFile(path.join(dist, "pdfs/measurement.pdf"), "not a pdf");
  await assert.rejects(checkSite(dist), /Invalid PDF document: measurement/);
  await writeFile(path.join(dist, "private.json"), "{}");
  await assert.rejects(checkSite(dist), /Unexpected public file: private.json/);
});

test("dev server serves pages and PDFs with correct types while retired routes remain real 404s", async (t) => {
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
  for (const route of [...publicRoutes, "/reader/?paper=detection"]) assert.equal((await fetch(`${url}${route}`)).status, 200, route);
  const canonical = await fetch(`${url}/research?topic=models`, { redirect: "manual" });
  assert.equal(canonical.status, 308);
  assert.equal(canonical.headers.get("location"), "/research/?topic=models");
  for (const [file, type] of [["assets/styles.css", "text/css"], ["assets/reader.js", "text/javascript"], ["assets/fonts/InterVariable.woff2", "font/woff2"], ["assets/artwork-reference.png", "image/png"]]) {
    const response = await fetch(`${url}/${file}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
  }
  for (const slug of PAPER_SLUGS) {
    const response = await fetch(`${url}/pdfs/${slug}.pdf`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(await response.text(), /^%PDF-/);
    assert.equal((await fetch(`${url}/pdfs/${slug}-page.svg`)).headers.get("content-type"), "image/svg+xml");
  }
  for (const retired of ["/events/", "/schools/", "/data/events.json", "/assets/app.js", "/package.json", "/papers/measurement.tex", "/_headers"]) {
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

test("reader allows only known papers and zoom levels", async () => {
  const { resolvePaper, normalizeZoom } = await import("../assets/reader.js");
  for (const slug of PAPER_SLUGS) assert.equal(resolvePaper(`?paper=${slug}`).slug, slug);
  for (const search of ["", "?paper=unknown", "?paper=../../package.json", "?paper=https://example.org/evil.pdf"]) assert.equal(resolvePaper(search).slug, "measurement");
  for (const zoom of [75, 100, 125, 150]) assert.equal(normalizeZoom(String(zoom)), zoom);
  for (const zoom of ["", "javascript:alert(1)", -1, 999, "NaN"]) assert.equal(normalizeZoom(zoom), 100);
});

test("reader initializes matching document links and transcript, resizes, and applies zoom", async (t) => {
  const { initializeReader } = await import("../assets/reader.js");
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  const element = () => ({
    children: [], events: new Map(), textContent: "", value: "100", disabled: true,
    style: { setProperty(name, value) { this[name] = value; } },
    append(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(name, handler) { this.events.set(name, handler); },
  });
  const text = (node) => [node.textContent, ...node.children.map(text)].join(" ");
  for (const slug of PAPER_SLUGS) {
    const nodes = Object.fromEntries(["canvas", "sheet", "preview", "zoom", "back", "download", "title", "transcript", "status"].map((key) => [`reader-${key}`, element()]));
    nodes["reader-canvas"].clientWidth = 1430;
    const windowEvents = new Map();
    globalThis.document = {
      getElementById: (id) => nodes[id],
      createElement: element,
      createDocumentFragment: element,
    };
    globalThis.window = {
      location: { search: `?paper=${slug}` },
      addEventListener: (name, handler) => windowEvents.set(name, handler),
    };
    initializeReader();
    assert.equal(nodes["reader-back"].href, `/research/${slug}/`);
    assert.equal(nodes["reader-download"].href, `/pdfs/${slug}.pdf`);
    assert.equal(nodes["reader-download"].download, `${slug}.pdf`);
    assert.equal(nodes["reader-preview"].src, `/pdfs/${slug}-page.svg`);
    assert.match(text(nodes["reader-transcript"]), /Kornstein Lab for Antisemitism Research.*Abstract.*Limitations/);
    assert.doesNotMatch(text(nodes["reader-transcript"]), /Research proposal/);
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
    assert.match(nodes["reader-status"].textContent, /Download PDF/);
  }
});

test("current page content keeps Kornstein identity and quantitative research focus", async () => {
  for (const file of PAGE_FILES) {
    const content = await readFile(path.join(ROOT, file), "utf8");
    assert.match(content, /Kornstein Lab/, file);
    assert.doesNotMatch(content, /Campus Evidence Lab|public[- ]records|Search Records/i, file);
  }
});
