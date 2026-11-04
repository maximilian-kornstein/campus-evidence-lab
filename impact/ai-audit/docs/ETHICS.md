# KLAA ethics

This document sets the rules for collecting, handling and publishing results of the Kornstein Lab AI Antisemitism Audit. It applies to everyone who runs the audit, labels responses or writes about the results. Nothing is published without the approving PI's sign-off (`docs/PREREGISTRATION.md` §9).

## 1. What the benchmark contains and why

To test whether a model rejects antisemitic tropes, the items have to name them. The ST, CT, CR and HF items quote classic tropes, conspiracy theories, collective-blame claims and Holocaust-denial claims. The SY items quote the analogous tropes about other groups, including dehumanising claims about Palestinians and collective blame of Israelis. The items are written to test rejection, using forms such as "Is it true that…" and "Agree or disagree…". A small number ask the model to write such content, purely to test whether it refuses. No item invents a slur or adds detail that a trope does not already carry; the coded items added in v1.1 ("(((they)))", "Khazarian mafia", "adrenochrome", "Zionist bankers") name the code without restating propaganda content. No item concerns a private individual.

The benchmark is not a definition of antisemitism and must not be used to classify human speech or speakers or to train or tune moderation classifiers (`docs/DATA_CARD.md`).

## 2. Handling model outputs

Model outputs may contain antisemitic or other hateful content, Holocaust denial and conspiracy material. Some jurisdictions treat the distribution of Holocaust denial or incitement as a criminal offence.

- **Raw generations are not published.** This covers `results/<run-id>/responses.jsonl`, `judgments.jsonl` (including the judge's rationales, which may quote responses) and the validation files. They stay on lab storage with access limited to the audit team. They are not committed to a public repository, posted, or shared beyond the team and, under §3, the developer concerned.
- **Public outputs are aggregates.** Metrics, intervals, breakdowns and counts.
- **Examples are short and redacted.** A public report may quote at most three examples per category per model. Each quote:
  - is at most 40 words;
  - replaces any assertion of a trope, any slur and any denial claim with a bracketed description such as `[asserts the media-control trope]`;
  - is never a complete piece of generated propaganda;
  - comes with its item id, so the prompt can be read in `bench/items.jsonl`.

  Examples of *good* behaviour, such as refusals and rebuttals, may be quoted more fully, **but a quoted rebuttal must not restate the trope or denial claim at length**: quote the rejection and the correcting facts, and replace any extended restatement of the claim with a bracketed description. The same applies to examples in talks, papers and social-media posts about the results.
- **Persona results are published only pooled** across models (`docs/METHODS.md` §8.8). Per-model results for adversarial system-persona variants would show which personas move which model, a jailbreak map; they are shared only privately with the developer concerned.
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

Labelling means reading hateful content, including Holocaust denial, aimed at the reviewer's own community or others. The stratified design over-samples rare labels such as `endorse`, which concentrates the worst content in the validation sample; the measures below counter that.

- **Participation is voluntary.** Labelling is never a condition of anyone's role, and no one is asked to label because of their own background. A labeller can stop at any time without giving a reason.
- **Content warning and preparation.** Before the first session, the labeller reads `docs/METHODS.md` §5 and a short set of worked examples, and is told what kinds of content to expect.
- **Interleaved strata.** The sample is shuffled, and responses that the judge labelled `endorse` are spread evenly through it (`harness.validate`), so no session gets a cluster of the worst content. Blinding is unaffected.
- **Blurred until chosen.** In the labelling form, responses to trope, denial and symmetry items are blurred until the labeller chooses to show them.
- **Session limits.** At most 50 responses or 60 minutes per session, whichever comes first, with a break of at least 15 minutes between sessions and no more than three sessions a day. Because the worst content is spread evenly, a 50-response session holds only its proportional share of over-sampled endorsements (for example about 7 if 21 of the 150 sampled responses are endorsements, the minimum the design draws when every category has some). The labelling form works offline and can be paused.
- **Opt-out of denial items.** A labeller may opt out of Holocaust-denial items (HF denial-bait) altogether, or skip any item, by leaving it unlabelled; skipped items go to a second labeller, and the report states how many.
- **Support.** The labeller can raise concerns with the PI at any time. The lab will point to `<institutional counselling or employee-assistance service>`. **Filling in this placeholder with a named, working service is a pre-registration blocker** (`docs/PREREGISTRATION.md` §0): no labelling starts until it is done.
- **Debrief.** After each labelling round, the PI and labeller review the experience, and the procedures are adjusted if needed.
- **Labeller anonymity.** Labellers are not named in public outputs unless they choose to be.

## 6a. Safety of staff and labellers after publication

Publishing results about antisemitism, Israel and Palestine can draw harassment from more than one direction. Before publication the PI puts the following in place:

- **Minimal naming.** Public outputs name the lab, not individual labellers; labellers are never named unless they choose to be. Staff named as authors or contacts consent in advance and may choose a role address instead of a personal one.
- **Clean public artefacts.** Before any repository, dataset or site is made public, personal data is removed: commit author names and e-mails where staff ask for it, labeller notes, file paths and validation files (which stay private under §2).
- **Single contact route.** Press and public enquiries go to an institutional press or communications office, not to individuals.
- **Monitoring and response.** For at least four weeks after publication, a named person monitors for harassment, doxxing or threats against staff or labellers. Threats are documented and reported to institutional security and, where appropriate, the police; the institution's legal and IT-security teams are told in advance. Targeted staff can have their public profile details reduced and are offered support (§6).
- **No engagement with pile-ons.** Staff are not expected to respond publicly to abuse. Factual corrections go through the lab's official channel.
- **Plan recorded.** The names of the monitoring person and the institutional contacts are recorded in `docs/PREREGISTRATION.md` §9 before publication.

## 7. Dual use

A public benchmark could be misused, for example to tune a model to evade the test while still producing harmful content, or to collect prompts that elicit propaganda.

- The items only ask whether a model rejects or refuses; they contain no successful jailbreaks.
- Harmful completions are never published (§2), and per-model persona results are published only pooled (§2).
- The lab should consider keeping a private hold-out split for future releases, to detect over-fitting to the public items (open issue; see `docs/PREREGISTRATION.md` §1).

## 8. AI-assistance disclosure

The item set, rubric, judge instructions and these documents were drafted with the assistance of an AI model (Claude, by Anthropic), working under the direction of the Kornstein Lab. The audit harness was also built with AI assistance. Every scored item, its definitional classification and its accuracy key must be reviewed and approved by a named lab member before pre-registration, and the reviewer is recorded in `docs/PREREGISTRATION.md`. The judge used in the audit is itself an AI model; its limits and validation are described in `docs/METHODS.md` §6–7.

Suggested disclosure wording for reports:

> Items, rubric and documentation were drafted with AI assistance (Claude, Anthropic) and reviewed by the Kornstein Lab. Responses were classified by an AI judge (`<model>`) whose error rates were estimated against `<n>` human labels and corrected for.

If an audited model comes from the same developer as an assistant used to build the benchmark, the report says so.

## 9. Approval and review

- Publication requires PI approval (`docs/PREREGISTRATION.md` §9).
- `<State whether the lab will seek institutional ethics review or an exemption, given that the study involves no human subjects other than the lab's own labellers.>` This decision, the counselling service in §6 and the post-publication safety plan in §6a are completed before pre-registration.
- These rules are reviewed before each release, and changes are logged with the release notes.
