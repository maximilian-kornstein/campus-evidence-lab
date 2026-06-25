# Event Search Flow Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CTA buttons open the relevant task state and make `/events/` search responsive by capping visible rows and debouncing expensive renders.

**Architecture:** Keep the static vanilla-JS app. Add focused URL parameters for task entry, cap visible event rows to 100 while preserving full filtered exports, and split text-input filter updates from immediate form submission. Cache normalized event search fields so committed searches do less repeated normalization work.

**Tech Stack:** Static HTML, vanilla JavaScript modules, CSS, Node `jsdom` render QA, existing static build script.

---

## File Responsibilities

- `index.html`: update static homepage hero task links.
- `assets/app.js`: update dynamic dashboard links, event search rendering, debounced filter application, capped result display, focus behavior, and cached search fields.
- `scripts/qa-render.mjs`: rendered behavior checks for CTA links, capped event rows, and immediate form submission.
- `scripts/qa-site.mjs`: static source checks for focused task links and search action copy.
- `docs/superpowers/specs/2026-06-25-event-search-flow-performance-design.md`: approved design.
- `docs/superpowers/plans/2026-06-25-event-search-flow-performance.md`: this plan.

## Task 1: Add Failing Render QA

- [ ] Add QA checks that expect `/events/?focus=search`, `/research-workspace/?focus=records`, `Apply Search`, and at most 100 event rows on first render.
- [ ] Run `npm run qa:render`.
- [ ] Expected result before implementation: FAIL because the current event table renders 4,000 rows and no `Apply Search` button.

## Task 2: Implement Focused CTA Links

- [ ] Update homepage static links and dashboard command links so `Search Records` uses `/events/?focus=search`.
- [ ] Update `Build Reporting Packet` links so the research workspace URL includes `focus=records` plus the existing title/question defaults.
- [ ] Add focus behavior for `focus=search` on events and `focus=records` on the research workspace.

## Task 3: Implement Fast Event Search

- [ ] Add a 100-row visible cap for event table rows.
- [ ] Keep counts based on the full filtered result set.
- [ ] Keep filtered downloads and workspace handoff based on the full filtered result set.
- [ ] Add `Apply Search` as a submit button.
- [ ] Debounce expensive re-rendering for text input while applying Enter, button submit, and select/date changes immediately.
- [ ] Cache normalized event search fields for records.

## Task 4: Verify Source And Dist

- [ ] Run `npm run qa:render`.
- [ ] Run `npm run qa:site`.
- [ ] Run `npm run qa:accessibility`.
- [ ] Run `node scripts/build-static.mjs`.
- [ ] Run `SITE_ROOT=dist npm run qa:render`.
- [ ] Run `SITE_ROOT=dist npm run qa:site`.
- [ ] Run `SITE_ROOT=dist npm run qa:accessibility`.
- [ ] Browser-check `/events/` typing latency and row cap.

## Task 5: Stage And Commit Intended Scope

- [ ] Stage only:
  - `index.html`
  - `assets/app.js`
  - `scripts/qa-render.mjs`
  - `scripts/qa-site.mjs`
  - `docs/superpowers/specs/2026-06-25-event-search-flow-performance-design.md`
  - `docs/superpowers/plans/2026-06-25-event-search-flow-performance.md`
- [ ] Commit with `feat: improve event search flow`.
