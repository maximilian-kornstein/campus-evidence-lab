# Ambitious Package Backlog

This note preserves the four ambitious package components that are intentionally not the current focus while the immediate design work stays on the Accountability Room.

## Current Focus

- Accountability Room: human-friendly institution briefing pages that make public-source accountability understandable in roughly 90 seconds without rankings, safety scores, legal conclusions, or unsupported claims.

## Deferred Package Components

### Ask CEL

A citation-bound research assistant over Campus Evidence Lab data. The first public scope should answer institution and source-family questions only, retrieve supporting records and source locators, and refuse questions that ask for rankings, legal conclusions, prevalence, safety scores, or unsupported claims.

The strongest framing is not "we trained a model on the data" unless a model is actually trained. The stronger technical claim is: citation-bound AI research over 150,000 official-source QA records, with answer boundaries and local reproducibility.

### CEL Developer API

A static-first developer API for DeSci, civic-tech, journalists, and researchers. It should expose versioned JSON endpoints for institutions, source families, import waves, candidate counts, snapshot hashes, correction paths, and citation packets.

The API should preserve the project's public-use limits: source availability is not prevalence, counts are not rankings, and import-wave acceptance is not individual human certification.

### Local Researcher Kit

A zero-cost terminal workflow for researchers who want to query the archive locally. It should download or use the repo data files, run local search over JSON/CSV, generate citation packets, and optionally support local models through tools such as Ollama or llama.cpp.

The first version should work without any hosted model or paid API key. Hosted AI can be an optional layer, not a dependency.

### Tyler Demo Path

A short guided route designed for a serious evaluator with roughly 90 seconds. It should show one institution Accountability Room, one citation-backed question, one source locator, one correction/right-of-reply path, and one reproducible data/API artifact.

The goal is to communicate founder-grade execution: speed, restraint, taste, institutional usefulness, and low-cost leverage.
