export const PREVIEW_PAGES = 12;
const SHEET_WIDTH = 710;

const freezeEntry = (value) => Object.freeze(Object.fromEntries(Object.entries(value)
  .map(([key, item]) => [key, Array.isArray(item) ? Object.freeze([...item]) : item])));
const proposal = (value) => freezeEntry({ kind: "proposal", pages: 1, previewPages: 1, ...value });
const paper = (value) => freezeEntry({ kind: "paper", previewPages: PREVIEW_PAGES, ...value });

// One-page research proposals: a single SVG rendering of the LaTeX PDF.
// Methods papers: the first PREVIEW_PAGES pages as WebP, then the full PDF.
export const PAPERS = Object.freeze({
  measurement: proposal({
    slug: "measurement",
    title: "Measuring antisemitism in online discourse",
    abstract: "This proposed study develops quantitative measures of antisemitism in online discourse, accounting for contextual meaning, classification uncertainty, and differences across sampled communities.",
    introduction: "We propose to study how antisemitism is expressed in online discourse. The aim is to develop transparent measures that account for linguistic context, sampling choices, and uncertainty in reviewed classifications.",
    frameworkTitle: "Measurement framework",
    frameworkIntro: "An illustrative weighted proportion for a defined corpus is",
    equation: "p hat equals the sum, from i equals 1 to n, of w sub i times y sub i, divided by the sum, from i equals 1 to n, of w sub i.",
    framework: "Here, y sub i denotes a reviewed classification and w sub i a sampling weight. This estimand concerns the sampled corpus, not population prevalence. We would report uncertainty alongside each estimate.",
    methods: ["Corpus design and sampling", "Contextual annotation", "Uncertainty and sensitivity analysis"],
    limitations: "Platform coverage, ambiguous language, and annotation disagreement may affect estimates. The proposal does not establish observed prevalence or causal explanations; no empirical results are reported here.",
  }),
  detection: proposal({
    slug: "detection",
    title: "Evaluating algorithms for antisemitism detection",
    abstract: "This proposed study evaluates how algorithms distinguish antisemitic expression from quotation, criticism, and other contextual uses. It examines classification errors, consistency, and performance across different kinds of text.",
    introduction: "We propose a contextual evaluation of algorithms for detecting antisemitism. The aim is to compare model outputs with reviewed annotations and examine failure modes across linguistic settings.",
    frameworkTitle: "Evaluation framework",
    frameworkIntro: "An illustrative classification measure is",
    equation: "F sub 1 equals 2 times P times R divided by P plus R. P equals TP divided by TP plus FP. R equals TP divided by TP plus FN.",
    framework: "Precision P and recall R summarize different error costs. We would report both with uncertainty and contextual error analysis, rather than rely on a single score. Undefined ratios require explicit handling.",
    methods: ["Contextual annotation", "Algorithm benchmarking", "Error and robustness analysis"],
    limitations: "Annotation judgments and corpus selection may limit transfer across languages and contexts. Model performance remains to be measured; this proposal reports no benchmark results.",
  }),
  narratives: proposal({
    slug: "narratives",
    title: "Mapping the spread of antisemitic narratives",
    abstract: "This proposed study examines how antisemitic narratives recur and change across online discourse. It combines text analysis and network methods while distinguishing observed connections from claims about influence.",
    introduction: "We propose to examine recurring narratives and their temporal relationships across sampled online discourse. The aim is to describe observable patterns without treating similarity as evidence of coordination.",
    frameworkTitle: "Network framework",
    frameworkIntro: "An illustrative thresholded similarity network is",
    equation: "A sub i j at time t equals the indicator that s sub i j at time t is greater than or equal to tau, for i not equal to j.",
    framework: "Here, s sub i j at time t denotes a specified similarity measure at time t and tau a chosen threshold. An edge represents similarity under this definition; it does not establish influence or causal transmission.",
    methods: ["Corpus construction", "Narrative identification", "Temporal network analysis"],
    limitations: "Missing observations, repeated quotations, and threshold choices may alter network structure. Sensitivity analysis and contextual review would be required. This proposal reports no empirical network findings.",
  }),
  // Abstracts are the papers' own (main.tex), as plain text; contents are their numbered sections.
  "dark-figure": paper({
    slug: "dark-figure",
    title: "The Dark Figure",
    subtitle: "Estimating unreported antisemitic hate crime",
    pages: 107,
    abstract: "Public debate and policy on antisemitism rely on counts of incidents, but every count is a partial list. Police statistics capture only incidents that reach the police, are classified as bias-motivated and are submitted; non-governmental audits use different definitions and intake channels. This methods paper develops a framework for estimating the dark figure of antisemitic hate crime, the incidents that appear on no list, by combining record linkage with multiple-systems estimation (MSE). List-based MSE estimates N sub V, the incidents reaching some recording channel; the remainder needs a victim survey. We retain the untestable highest-order interaction omega in the classical closed-form K-list estimator as an explicit sensitivity parameter, with sharp two-sided bounds. With three or more lists, neither positive dependence nor heterogeneity fixes the sign of the bias. We model referral between lists and show how provenance data restore identification. Under a stylised linkage-error model, linkage error acts as a linear operator on capture-history tables; we derive its first-order bias for K lists and the correction implied under that model. In a simulation study on synthetic data with known ground truth, records carry realistic attribute noise and are linked by a Fellegi–Sunter model. The resulting errors are dominated by swaps, links to the wrong partner, which the stylised model omits, and the correction then over-corrects. We therefore propagate linkage uncertainty by mixing over linkage draws and use the correction only as a diagnostic; in the simulation, mixing over approximate draws from a plug-in linkage posterior did not remove the linkage bias either. We also specify, but do not evaluate, a Bayesian latent-class and spatiotemporal small-area model. A multiplicative reporting funnel with a Shapley decomposition locates where incidents are lost between the offence and federal statistics. A pre-registered analysis plan covers harmonisation, privacy-preserving linkage and an ethics protocol. We report no empirical estimates from real data.",
    toc: [
      "Introduction",
      "The lists: sources of antisemitic incident data",
      "Statistical framework",
      "Identification and sensitivity",
      "Record linkage and its propagation into the dark figure",
      "Bayesian models for the dark figure",
      "The reporting funnel: where antisemitic incidents go missing",
      "Simulation study",
      "A pre-registered analysis plan",
      "Ethics, privacy and responsible reporting",
      "Discussion",
    ],
  }),
  contagion: paper({
    slug: "contagion",
    title: "Shock and Contagion",
    subtitle: "Separating outside shocks from contagion in incident surges",
    pages: 115,
    abstract: "After salient external events, how much of a surge in antisemitic incidents is direct reaction, how much is contagion, and does online hostility spill offline? We model incident streams as a multivariate Hawkes process with exogenous shocks. Within a stream, the autocorrelation of counts cannot separate contagion from unrecorded shocks, although dominant cross-excitation is identifiable at second order; a rigid background manufactures contagion; and under-reporting attenuates it through an invertible map. We decompose post-event surges into background, direct and contagion parts. The alert rule is Bayes-optimal given the model's state, not with a plug-in state under reporting delays. Synthetic-data simulations evaluate EM, attribution, the boundary test, the thinning correction and a plug-in alert; Bayesian shrinkage, time-rescaling diagnostics, an imputation-based alert, sup-tests and nonparametric kernels were not evaluated. Without contagion, a constant background yields branching ratios of up to 0.63; for rare large shocks maximum likelihood settles 0.06–0.07 below the second-order value even with T = 10,000. Known event times largely removed the artefact where tested; a single spline background did not. The dark-figure correction restores coverage unless excitation is weak and recording poor, and a 30–50% error in the recording probability sets a floor under its precision that more data cannot lower. Forecasts that ignore future external events under-forecast; forecasts that integrate over the event process are calibrated when windows are pooled. No forecaster can time new events, which limits recall rather than pooled calibration. We pre-register a real-data analysis and report no empirical estimates.",
    toc: [
      "Introduction",
      "Data: incident streams, external events and online signals",
      "Self-exciting point processes for incident streams",
      "Identification: contagion, common shocks and under-reporting",
      "Surge attribution: background, shock and contagion",
      "Estimation, testing and model checking",
      "Forecasting and alerting",
      "Simulation study",
      "A pre-registered analysis plan",
      "Ethics and responsible use",
      "Discussion",
    ],
  }),
  attitudes: paper({
    slug: "attitudes",
    title: "Where Does Criticism End?",
    subtitle: "A latent-variable map of antisemitic attitudes",
    pages: 99,
    abstract: "Whether, and when, negative attitudes toward Israel reflect hostility toward Jews is sharply contested, and the competing definitions of antisemitism embed empirical claims alongside normative ones. This methods paper develops tools to test those empirical claims without adjudicating between the definitions. A bifactor graded response model separates a general factor, shared by classic stereotypes about Jews and by Israel-related statements, from factors specific to each domain. For each Israel-related item, the boundary estimand is the share of its common variance due to the general factor; items whose share reaches a pre-registered threshold form a boundary set, and each item is reported as in, out or undetermined. We prove that this decomposition is identified by heterogeneity, not by the correlation between domains: some domain must contain at least four items whose general-factor shares are not all equal save one. With three items per domain, or with proportional loadings, a curve of parameter values fits equally well. We derive the first-order bias in group comparisons when differential item functioning (DIF) is ignored, and how anchors that are not invariant fail. We give the variance cost and optimal design of list experiments, a joint model that identifies item-level social-desirability bias, and multilevel regression and poststratification on the latent trait, and we show when stereotype-count indices misrank groups. A simulation study on synthetic survey data with known ground truth checks these results with the limited-information estimator that the plan adopts as primary. It shows that convergence and agreement across starting values need not reveal an unidentified decomposition, and that cross-loadings of trope-based Israel items and acquiescence move the shares up for some items and down for others unless they are modelled; the primary model therefore includes an acquiescence factor. It also exposed a flaw in our own DIF screen, which missed non-uniform DIF. A pre-registered survey design and analysis plan, revised in light of the simulation, and an ethics protocol specify the empirical study. We report no empirical estimates.",
    toc: [
      "Introduction",
      "Background: definitions, surveys and the boundary question",
      "A bifactor model of antisemitic attitudes",
      "Identification and invariance",
      "Sensitive items: list experiments and social-desirability bias",
      "Small-area estimation and the fragility of stereotype indices",
      "Simulation study",
      "A pre-registered survey design and analysis plan",
      "Ethics and responsible interpretation",
      "Discussion",
    ],
  }),
  amplification: paper({
    slug: "amplification",
    title: "Supply or Demand?",
    subtitle: "Auditing algorithmic amplification of antisemitic content",
    pages: 91,
    abstract: "Whether recommender systems amplify antisemitic content beyond what users seek, the question of supply or demand, is central to platform accountability, including the systemic-risk duties of the EU Digital Services Act, yet “amplification” is rarely defined. This methods paper defines it as a causal contrast: expected exposure to antisemitic content under the algorithmic policy relative to a named reference policy, at fixed demand. For real users, observed exposure splits into demand, supply, demand shaping and a feedback interaction; sock-puppet audits of fixed demand identify only supply. A Markov model of sessions gives long-run exposure, rabbit holes and a perturbation bound: small nudges can have large effects. We state when randomised audits identify amplification, bound the bias when puppets interfere through the system they audit, show that arm-dependent classifier error can put a naive estimate on the wrong side of one, correct it by arm, and give an approximately anytime-valid confidence sequence for stopping as soon as the evidence is clear. In a synthetic recommender, the registered analysis kept its error rates despite heavy-tailed puppet outcomes (time-uniform coverage 98.4–99.7% at nominal 95–97.5%), and the pilot check failed in 89.5–100% of pilots whenever the sequence for the ratio did not hold. Under plausible inputs a materiality audit of four personas needs thousands of accounts; the pre-registered protocol therefore commits only to a pilot and a registered feasibility gate, with ethical safeguards. We have audited no real platform and report no finding about any service.",
    toc: [
      "Introduction",
      "Background: amplification, audits and platform governance",
      "Estimands: what does it mean to amplify?",
      "A Markov model of exposure",
      "Identification from sock-puppet audits",
      "Measurement: misclassification and sequential inference",
      "Simulation study",
      "A pre-registered audit protocol",
      "Ethics and legal considerations",
      "Discussion",
    ],
  }),
});

export function resolvePaper(search = "") {
  const slug = new URLSearchParams(search).get("paper");
  return Object.hasOwn(PAPERS, slug) ? PAPERS[slug] : PAPERS.measurement;
}

// Optional deep link (?paper=<slug>&page=k) to a preview page of a methods paper.
export function resolvePage(search = "", current = resolvePaper(search)) {
  const value = new URLSearchParams(search).get("page");
  if (current.kind !== "paper" || !/^[1-9]\d?$/.test(value ?? "")) return 1;
  const page = Number(value);
  return page <= current.previewPages ? page : 1;
}

export function previewSource(current, page = 1) {
  return current.kind === "paper"
    ? `/pdfs/${current.slug}/page-${String(page).padStart(2, "0")}.webp`
    : `/pdfs/${current.slug}-page.svg`;
}

export function normalizeZoom(value) {
  const zoom = Number(value);
  return [75, 100, 125, 150].includes(zoom) ? zoom : 100;
}

function renderTranscript(container, current) {
  const fragment = document.createDocumentFragment();
  const append = (tag, text, parent = fragment) => {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  if (current.kind === "paper") {
    append("p", current.title);
    append("p", `${current.subtitle}.`);
    append("p", "Kornstein Lab for Antisemitism Research.");
    append("h2", "Abstract");
    append("p", current.abstract);
    append("h2", "Contents");
    const contents = append("ol", "");
    for (const heading of current.toc) append("li", heading, contents);
    append("p", "The full text is available in the PDF.");
    container.replaceChildren(fragment);
    return;
  }
  append("p", "Kornstein Lab for Antisemitism Research.");
  append("h2", "Abstract");
  append("p", current.abstract);
  append("h2", "1 Introduction");
  append("p", current.introduction);
  append("h2", `2 ${current.frameworkTitle}`);
  append("p", current.frameworkIntro);
  append("p", current.equation);
  append("p", current.framework);
  append("h2", "3 Proposed methodology");
  const list = append("ol", "");
  for (const item of current.methods) append("li", `${item}.`, list);
  append("h2", "4 Limitations");
  append("p", current.limitations);
  container.replaceChildren(fragment);
}

export function initializeReader() {
  const byId = (id) => document.getElementById(id);
  const canvas = byId("reader-canvas");
  const sheet = byId("reader-sheet");
  const preview = byId("reader-preview");
  const select = byId("reader-zoom");
  const back = byId("reader-back");
  const download = byId("reader-download");
  const title = byId("reader-title");
  const transcript = byId("reader-transcript");
  const status = byId("reader-status");
  const previous = byId("reader-prev");
  const next = byId("reader-next");
  const count = byId("reader-count");
  const end = byId("reader-end");
  const endNote = byId("reader-end-note");
  const endOpen = byId("reader-end-open");
  const endDownload = byId("reader-end-download");
  if (![canvas, sheet, preview, select, back, download, title, transcript, status,
    previous, next, count, end, endNote, endOpen, endDownload].every(Boolean)) return;

  const current = resolvePaper(window.location.search);
  const isPaper = current.kind === "paper";
  const pdf = `/pdfs/${current.slug}.pdf`;
  document.title = `${current.title} — Kornstein Lab`;
  byId("main")?.setAttribute("data-reader-kind", current.kind);
  title.textContent = current.title;
  back.href = `/research/${current.slug}/`;
  for (const link of [download, endDownload]) {
    link.href = pdf;
    link.download = `${current.slug}.pdf`;
  }
  endOpen.href = pdf;
  endOpen.target = "_blank";
  endOpen.rel = "noopener";
  endNote.textContent = `Preview ends here, page ${current.previewPages} of ${current.pages}.`;
  renderTranscript(transcript, current);

  // Positions 1..previewPages show preview pages; one more is the end-of-preview sheet.
  const last = isPaper ? current.previewPages + 1 : 1;
  let position = resolvePage(window.location.search, current);

  function show(target, announce) {
    position = Math.min(Math.max(1, target), last);
    const atEnd = isPaper && position > current.previewPages;
    end.hidden = !atEnd;
    preview.hidden = atEnd;
    if (!atEnd) preview.src = previewSource(current, position);
    previous.disabled = position <= 1;
    next.disabled = position >= last;
    count.textContent = atEnd ? "End" : `${position} / ${current.previewPages}`;
    count.setAttribute("aria-label", !isPaper ? "Page 1 of 1"
      : atEnd ? `End of preview: page ${current.previewPages} of ${current.pages} shown`
        : `Preview page ${position} of ${current.previewPages} (the full paper has ${current.pages} pages)`);
    if (!announce) return;
    canvas.scrollTop = 0;
    status.textContent = atEnd
      ? `Preview ends here, page ${current.previewPages} of ${current.pages}. Open the full PDF to continue reading.`
      : `Preview page ${position} of ${current.previewPages}.`;
    if (!atEnd && typeof window.history?.replaceState === "function") {
      const query = position > 1 ? `?paper=${current.slug}&page=${position}` : `?paper=${current.slug}`;
      window.history.replaceState(window.history.state, "", query);
    }
  }

  function go(step, control) {
    if (!isPaper) return;
    const before = position;
    show(position + step, true);
    if (position === before) return;
    // Keep keyboard focus on a live control when the pressed button becomes disabled.
    if (control?.disabled && document.activeElement === control) (position === last ? endOpen : next).focus();
  }

  if (isPaper) {
    preview.loading = "lazy";
    preview.decoding = "async";
    preview.width = 612;
    preview.height = 792;
  }
  show(position, false);
  previous.addEventListener("click", () => go(-1, previous));
  next.addEventListener("click", () => go(1, next));
  canvas.addEventListener("keydown", (event) => {
    if (!isPaper || event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const step = { ArrowLeft: -1, PageUp: -1, ArrowRight: 1, PageDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    go(step);
  });

  function fitPage() {
    const zoom = normalizeZoom(select.value);
    const available = Math.max(160, canvas.clientWidth - 48);
    const width = Math.min(SHEET_WIDTH, available) * zoom / 100;
    sheet.style.width = `${width}px`;
    sheet.style.setProperty("--reader-zoom", String(zoom / 100));
  }
  select.disabled = false;
  select.addEventListener("change", () => {
    select.value = String(normalizeZoom(select.value));
    fitPage();
    status.textContent = `Zoom ${select.value} percent.`;
  });
  preview.addEventListener("load", () => {
    // Warm the next preview page so paging does not wait on the network.
    if (isPaper && position < current.previewPages && typeof Image === "function") {
      new Image().src = previewSource(current, position + 1);
    }
  });
  preview.addEventListener("error", () => {
    status.textContent = `The document preview could not load. Use Download PDF to read the ${current.kind}.`;
  });
  window.addEventListener("resize", fitPage, { passive: true });
  fitPage();
}

if (typeof document !== "undefined" && typeof window !== "undefined") initializeReader();
