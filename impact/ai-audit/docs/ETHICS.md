# KLAA ethics

This document sets the rules for collecting, handling and publishing results of the Kornstein Lab AI Antisemitism Audit. It applies to everyone who runs the audit, labels responses or writes about the results. Nothing is published without the approving PI's sign-off (`docs/PREREGISTRATION.md` §9).

## 1. What the benchmark contains and why

To test whether a model rejects antisemitic tropes, the items have to name them. The ST, CT, CR and HF items quote classic tropes, conspiracy theories, collective-blame claims and Holocaust-denial claims. The SY items quote the analogous tropes about other groups. The items are written to test rejection, using forms such as "Is it true that…" and "Agree or disagree…". A small number ask the model to write such content, purely to test whether it refuses. No item invents a slur or adds detail that a trope does not already carry. No item concerns a private individual.

## 2. Handling model outputs

Model outputs may contain antisemitic or other hateful content, Holocaust denial and conspiracy material. Some jurisdictions treat the distribution of Holocaust denial or incitement as a criminal offence.

- **Raw generations are not published.** This covers `results/<run-id>/responses.jsonl`, `judgments.jsonl` (including the judge's rationales, which may quote responses) and the validation files. They stay on lab storage with access limited to the audit team. They are not committed to a public repository, posted, or shared beyond the team and, under §3, the developer concerned.
- **Public outputs are aggregates.** Metrics, intervals, breakdowns and counts.
- **Examples are short and redacted.** A public report may quote at most three examples per category per model. Each quote:
  - is at most 40 words;
  - replaces any assertion of a trope, any slur and any denial claim with a bracketed description such as `[asserts the media-control trope]`;
  - is never a complete piece of generated propaganda;
  - comes with its item id, so the prompt can be read in `bench/items.jsonl`.

  Examples of *good* behaviour, such as refusals and rebuttals, may be quoted more fully.
- **Retention.** Raw outputs are kept for `<N>` years for verification and re-analysis, then deleted, unless the PI decides otherwise and records the decision.
- **Keys and credentials.** API keys come only from environment variables and are never written to disk, logs or results.

## 3. Responsible disclosure

1. Before publication, each developer whose model is audited is sent its model-specific findings at least **30 days** in advance. The package contains:
   - the headline and category metrics;
   - the items that triggered the disclosure rules in `docs/PREREGISTRATION.md` §8;
   - the full responses to those items, sent privately;
   - the method and rubric.
2. Developers are invited to point out factual errors in the audit, such as a mis-recorded model version or a misapplied rubric. Corrections of fact are made. Disagreements about the rubric itself are noted in the report and do not change the scoring.
3. A developer's response, or its absence, may be summarised in the report. Developers do not get a veto, and the publication date is not extended beyond 60 days except for a safety reason documented by the PI.
4. If a model readily produces content that incites violence against Jews or any other group, the developer is told promptly rather than at the end of the audit.
5. All developers get the same notice period and the same information, whatever the lab's relationship with them.

## 4. Neutrality in conduct and reporting

The benchmark's neutrality principle (`docs/METHODS.md` §2) also governs how results are described.

- **Describe behaviour, not character.** Write "Model X endorsed or legitimised a trope on 4% of trope items (95% CI …)". Do not write "Model X is antisemitic" or attribute motives to developers.
- **Report both directions.** Every report gives the over-refusal results, the LC parity gap and the symmetry results with the same prominence as the endorsement results. A model that over-refuses legitimate questions about Israel, Palestinians or Jewish life is reported as failing in that respect.
- **Contested items stay descriptive.** CO results are never ranked, never folded into a score, and never described as a model being "right" or "wrong" about anti-Zionism, BDS, apartheid, genocide or similar questions.
- **Apply the same standard to every developer and every group.** The SY items exist so that bigotry against Muslims, Palestinians, Arabs, Christians, Roma, Black people, Chinese people and others is held to the same standard as antisemitism.
- **Disclose interests.** The report states the lab's funding sources and any relationship with model developers or advocacy organisations.

## 5. No attacks on individuals

- No item targets a private individual. Public figures appear only where a conspiracy theory about them is the object of the test (e.g. the Rothschild family, George Soros), or where their documented public conduct is a legitimate policy question (e.g. the ICC warrants, OSF's spending). The expected behaviour always separates documented conduct from the trope.
- Reports name models and developers, never individual employees.
- The audit team does not use results to campaign against individuals, organisations or political positions.

## 6. Reviewer wellbeing

Labelling means reading hateful content, including Holocaust denial, aimed at the reviewer's own community or others.

- **Participation is voluntary.** Labelling is never a condition of anyone's role, and no one is asked to label because of their own background. A labeller can stop at any time without giving a reason.
- **Content warning and preparation.** Before the first session, the labeller reads `docs/METHODS.md` §5 and a short set of worked examples, and is told what kinds of content to expect.
- **Session limits.** At most 50 responses or 60 minutes per session, whichever comes first, with a break of at least 15 minutes between sessions and no more than three sessions a day. The labelling form works offline and can be paused.
- **Support.** The labeller can raise concerns with the PI at any time. The lab will point to `<institutional counselling or employee-assistance service>`. Distressing items can be skipped and passed to a second labeller.
- **Debrief.** After each labelling round, the PI and labeller review the experience, and the procedures are adjusted if needed.
- **Labeller anonymity.** Labellers are not named in public outputs unless they choose to be.

## 7. Dual use

A public benchmark could be misused, for example to tune a model to evade the test while still producing harmful content, or to collect prompts that elicit propaganda.

- The items only ask whether a model rejects or refuses; they contain no successful jailbreaks.
- Harmful completions are never published (§2).
- The lab should consider keeping a private hold-out split for future releases, to detect over-fitting to the public items (open issue; see `docs/PREREGISTRATION.md` §1).

## 8. AI-assistance disclosure

The item set, rubric, judge instructions and these documents were drafted with the assistance of an AI model (Claude, by Anthropic), working under the direction of the Kornstein Lab. The audit harness was also built with AI assistance. Every scored item, its definitional classification and its accuracy key must be reviewed and approved by a named lab member before pre-registration, and the reviewer is recorded in `docs/PREREGISTRATION.md`. The judge used in the audit is itself an AI model; its limits and validation are described in `docs/METHODS.md` §6–7.

Suggested disclosure wording for reports:

> Items, rubric and documentation were drafted with AI assistance (Claude, Anthropic) and reviewed by the Kornstein Lab. Responses were classified by an AI judge (`<model>`) whose error rates were estimated against `<n>` human labels and corrected for.

If an audited model comes from the same developer as an assistant used to build the benchmark, the report says so.

## 9. Approval and review

- Publication requires PI approval (`docs/PREREGISTRATION.md` §9).
- `<State whether the lab will seek institutional ethics review or an exemption, given that the study involves no human subjects other than the lab's own labellers.>`
- These rules are reviewed before each release, and changes are logged with the release notes.
