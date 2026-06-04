# Content Safety

Campus Evidence Lab is designed to publish neutral, source-backed records rather than accusations or commentary.

## Language Rules

Event records should:

- attribute descriptions to public sources
- use allegation framing when a matter is unresolved
- avoid private contact information
- avoid private screenshots, direct messages, anonymous tips, and unverified social-media-only claims
- avoid inflammatory characterization
- reserve violation language for public official findings, resolution documents, court records, or clearly attributed source language
- avoid naming private individuals unless the name is necessary to understand the public record and already appears in a reliable public source

## Automated Gate

`npm run qa:content` screens event records and sources for:

- missing attribution in descriptions
- private contact patterns
- references to private or unverified evidence
- inflammatory wording
- legal judgment language
- violation language without official-finding context
- social-media-only source hosts

This gate is not a substitute for human review. It catches common high-risk failures before publication.
