# Event Search Flow Performance Design

## Goal

Make homepage task buttons land users directly in the relevant workflow, and make record search feel responsive while preserving shareable URLs, exports, and research-workspace handoff.

## Current Evidence

The `/events/` page renders all 4,000 records on initial load, producing about 3.1 MB of event table HTML. Each search keystroke currently updates filters, rewrites the URL, and re-renders the entire `#events-root` subtree. Browser timing on the existing implementation measured roughly 319-388 ms per character while typing `antisemitism`.

## Approved Direction

Use a capped-results and explicit-search flow rather than a full virtual table.

The `Search Records` homepage and dashboard buttons should open `/events/?focus=search`, where the search input is focused and the page starts in the search task. The `Build Reporting Packet` buttons should open the research workspace with `focus=records`, packet title/query defaults, and the record-search box ready.

The event table should render only the first 100 matching rows. The status copy must make clear when the visible table is capped and that downloads and workspace handoff still operate on the matching filtered set. Empty or broad searches must not render all 4,000 rows.

Typing in the event search box should be cheap. Text input updates filter state and the shareable URL immediately, but expensive filtering/table rendering is debounced. Pressing Enter or clicking `Apply Search` applies immediately.

## Non-Goals

- Do not add a frontend framework.
- Do not implement full table virtualization.
- Do not change dataset contents.
- Do not change protocol or blockchain implementation.
- Do not stage generated school pages or unrelated dirty files.

## Verification

Verification must prove that:

- Homepage rendered links include `/events/?focus=search` and `/research-workspace/?focus=records`.
- The event page renders an `Apply Search` action.
- The initial event table is capped to 100 visible rows.
- Submitting a specific search updates the URL and narrows results.
- Source and built `dist` QA pass.
