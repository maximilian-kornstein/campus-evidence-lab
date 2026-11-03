const paper = (value) => Object.freeze({ ...value, methods: Object.freeze(value.methods) });

export const PAPERS = Object.freeze({
  measurement: paper({
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
  detection: paper({
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
  narratives: paper({
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
});

export function resolvePaper(search = "") {
  const slug = new URLSearchParams(search).get("paper");
  return Object.hasOwn(PAPERS, slug) ? PAPERS[slug] : PAPERS.measurement;
}

export function normalizeZoom(value) {
  const zoom = Number(value);
  return [75, 100, 125, 150].includes(zoom) ? zoom : 100;
}

function renderTranscript(container, current) {
  const fragment = document.createDocumentFragment();
  const append = (tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    fragment.append(element);
    return element;
  };
  append("p", "Kornstein Lab for Antisemitism Research. Research proposal.");
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
  for (const item of current.methods) {
    const li = document.createElement("li");
    li.textContent = `${item}.`;
    list.append(li);
  }
  append("h2", "4 Limitations");
  append("p", current.limitations);
  container.replaceChildren(fragment);
}

export function initializeReader() {
  const canvas = document.getElementById("reader-canvas");
  const sheet = document.getElementById("reader-sheet");
  const preview = document.getElementById("reader-preview");
  const select = document.getElementById("reader-zoom");
  const back = document.getElementById("reader-back");
  const download = document.getElementById("reader-download");
  const title = document.getElementById("reader-title");
  const transcript = document.getElementById("reader-transcript");
  const status = document.getElementById("reader-status");
  if (![canvas, sheet, preview, select, back, download, title, transcript, status].every(Boolean)) return;

  const current = resolvePaper(window.location.search);
  document.title = `${current.title} — Kornstein Lab`;
  title.textContent = current.title;
  back.href = `/research/${current.slug}/`;
  download.href = `/pdfs/${current.slug}.pdf`;
  download.download = `${current.slug}.pdf`;
  preview.src = `/pdfs/${current.slug}-page.svg`;
  renderTranscript(transcript, current);

  function fitPage() {
    const zoom = normalizeZoom(select.value);
    const available = Math.max(160, canvas.clientWidth - 48);
    const width = Math.min(710, available) * zoom / 100;
    sheet.style.width = `${width}px`;
    sheet.style.setProperty("--reader-zoom", String(zoom / 100));
  }
  select.disabled = false;
  select.addEventListener("change", () => {
    select.value = String(normalizeZoom(select.value));
    fitPage();
    status.textContent = `Zoom ${select.value} percent.`;
  });
  preview.addEventListener("error", () => {
    status.textContent = "The document preview could not load. Use Download PDF to read the proposal.";
  });
  window.addEventListener("resize", fitPage, { passive: true });
  fitPage();
}

if (typeof document !== "undefined" && typeof window !== "undefined") initializeReader();
