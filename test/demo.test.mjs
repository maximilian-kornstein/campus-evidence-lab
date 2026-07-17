import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { initDemo } from "../assets/demo.js";

const html = await readFile(new URL("../demo/index.html", import.meta.url), "utf8");

test("demo presents six evidence steps with a truthful no-JS fallback", () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const panels = [...document.querySelectorAll("[data-demo-panel]")];

  assert.equal(panels.length, 6);
  assert.ok(panels.every((panel) => !panel.hidden));
  assert.match(document.body.textContent, /Brown University announced a voluntary agreement/);
  assert.match(document.body.textContent, /What CEL does not claim/);
  assert.match(document.body.textContent, /10,000/);
  assert.match(document.body.textContent, /5,470/);
  assert.ok(document.querySelector('a[href="../events/evt_2024_0001/"]'));
  assert.ok(document.querySelector('a[href^="https://www.brown.edu/"]'));
});

test("demo navigation reveals one step at a time without removing evidence", () => {
  const dom = new JSDOM(html, { url: "https://campusevidencelab.org/demo/" });
  const document = dom.window.document;
  const root = document.querySelector("[data-demo]");
  const demo = initDemo(root, { autoplayDelay: 10 });
  const panels = [...document.querySelectorAll("[data-demo-panel]")];

  assert.equal(demo.activeIndex, 0);
  assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
  assert.equal(document.querySelector("[data-demo-step='0']").getAttribute("aria-current"), "step");

  document.querySelector("[data-demo-step='3']").click();
  assert.equal(demo.activeIndex, 3);
  assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
  assert.equal(document.querySelector("[data-current-step]").textContent, "4");

  document.querySelector("[data-demo-back]").click();
  assert.equal(demo.activeIndex, 2);

  document.querySelector("[data-demo-restart]").click();
  assert.equal(demo.activeIndex, 0);
});

test("demo copies the complete citation", async () => {
  const dom = new JSDOM(html, { url: "https://campusevidencelab.org/demo/" });
  const document = dom.window.document;
  const copied = [];
  const root = document.querySelector("[data-demo]");

  initDemo(root, {
    clipboard: {
      async writeText(value) {
        copied.push(value);
      }
    }
  });

  document.querySelector("[data-demo-step='4']").click();
  document.querySelector("[data-copy-citation]").click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(copied.length, 1);
  assert.match(copied[0], /evt_2024_0001/);
  assert.match(copied[0], /campusevidencelab\.org\/events\/evt_2024_0001/);
  assert.equal(document.querySelector("[data-copy-status]").textContent, "Citation copied.");
});
