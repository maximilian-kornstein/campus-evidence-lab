# KLAA data card

Kornstein Lab AI Antisemitism Audit (KLAA), item set v1.1, rubric v1.1.0, schema v1.1.0. This card says what the benchmark is, what it is for, and what it must not be used for. Methods are in `docs/METHODS.md`; publication and safety rules in `docs/ETHICS.md`; the fixed analysis plan in `docs/PREREGISTRATION.md`.

## Usage statement

> KLAA measures how AI models respond to a fixed set of antisemitism-relevant prompts. It is **not a definition of antisemitism**, and it must **not be used to classify human speech or speakers or to train or tune content-moderation classifiers**. Contested (CO) items are descriptive only and are **never scored, ranked or aggregated**. The Antisemitism Endorsement Rate (AER) is a **lower bound** on what any single definition would call antisemitic; **cite it together with the Over-refusal Rate (ORR) and the LC parity gap**.

The harness prints this statement in every `report.md` and on the leaderboard page.

## What it is

| | |
|---|---|
| Purpose | Compare AI models' behaviour on antisemitism-relevant prompts in both directions: endorsing antisemitism, and refusing or evading legitimate questions (including criticism of Israel, Palestinian authorities and other governments) |
| Items | 504 (439 base items, 65 robustness variants), English |
| Categories | HF Holocaust facts (57), ST stereotypes (44), CT conspiracy tropes (42), CR collective responsibility (23), LC legitimate-criticism controls (95: Israel 42, Palestinian authorities 12, other 41), JK Jewish knowledge controls (48), SY symmetry probes (95), CO contested (35, descriptive only) |
| Scoring | An LLM judge applies `bench/rubric.json`; human labels estimate the judge's error; rates are Rogan–Gladen corrected |
| Headline metrics | AER, HACC (Holocaust accuracy), ORR, SG (symmetry gap), KS (composite; components always shown) |
| Secondary metrics | AER_strict, AER_broad (sensitivity), RQ, CR_ENG, HACC_lenient, HF_DISTORTION, ORR_strict, LC parity gaps, LC_FACT, CCR, JACC, SG by subset and group, robustness |
| Unit of analysis | A model's single response to an item at temperature 0 |
| Licence and status | `<to be set by the lab before release>`; not yet pre-registered |

## Intended uses

- Comparing AI models, or versions of one model, on how they handle antisemitic tropes, Holocaust denial and distortion, collective blame, and legitimate questions about Israel, Palestine, Judaism and Jewish history.
- Helping developers find failure modes in both directions, through responsible disclosure (`docs/ETHICS.md` §3).
- Research on measurement of AI behaviour on contested political topics.

## Out-of-scope and prohibited uses

- **Not a definition of antisemitism.** The scored core is only what IHRA, the Jerusalem Declaration and the Nexus Document all agree on. A response outside that core is not thereby "not antisemitic", and the benchmark takes no position on contested questions.
- **Not for classifying people or human speech.** Items, labels and rubrics are written for AI responses to fixed prompts. They must not be used to judge, tag or report real people's posts, students, employees, organisations or protests.
- **Not training data for moderation classifiers.** Using the items or judge labels to train or tune content-moderation or speech classifiers would turn a narrow, consensus-only measure into a speech rule it was not designed to be, and would leak the test set.
- **CO is never a verdict.** Contested results must not be ranked, averaged into any score, or described as a model being right or wrong about anti-Zionism, BDS, apartheid, genocide or similar questions.
- **AER alone is not a safety rating.** A model can have a low AER by refusing everything; always report ORR and the LC parity gap with it.
- **Not a jailbreak map.** Per-model results for adversarial persona variants are not published (`docs/ETHICS.md` §2).

## How items were made

Items were drafted with AI assistance (Claude, Anthropic) under the lab's direction, revised after two independent neutrality reviews with opposite lenses (civil liberties; antisemitism expertise), and reconciled by explicit rules R1–R5 (`docs/METHODS.md` §2.1). Every item records how each definition classifies its content, with a citation-style justification. Factual keys accept the full range of mainstream scholarly estimates and name their sources; new factual content in v1.1 was checked against independent sources. Every scored item must be reviewed and approved by a named lab member before pre-registration.

## Known limitations and biases

- English only, with an Anglo-American framing.
- The consensus core is narrow; AER understates what any single definition would flag. AER_broad and HF_DISTORTION are reported as wider views.
- Symmetry probes approximate equivalence across groups; tropes differ in history and harm. The largest mirror group (Muslims) is held to about 25% of pairs, and subsets with few pairs are diagnostics only.
- LC items about 2023–2025 events may be overtaken by later developments; expected behaviours name only well-established elements.
- An LLM judge can share biases with the models it judges; validation corrects marginal error, not all differential error.
- Once public, items may leak into training data.

## Contents that may cause distress

The items quote antisemitic tropes, Holocaust-denial claims and analogous tropes about other groups in order to test rejection. Model outputs collected in a run may contain hateful content; they are never published (`docs/ETHICS.md` §2).

## Maintenance and contact

Changes are logged in `docs/METHODS.md` §12 and, after pre-registration, in the deviations log of `docs/PREREGISTRATION.md` §10. Contact: `<lab role address>`.
