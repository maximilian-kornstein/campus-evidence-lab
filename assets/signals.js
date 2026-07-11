const root = document.querySelector("#signals-list");
const status = document.querySelector("#signal-status");

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function signalRow(signal, index) {
  const claim = signal.bounded_claims?.map((row) => row.text).join(" ") || "Public-record context available.";
  return `<article class="signal-row">
    <div class="signal-index">${String(index + 1).padStart(2, "0")}</div>
    <div class="signal-row__body"><p class="signal-row__meta">${escapeHtml(signal.institution.state || "US")} · ${escapeHtml(signal.trigger.source_kind.replaceAll("_", " "))}</p><h3><a href="${escapeHtml(signal.canonical_url)}">${escapeHtml(signal.institution.name)}</a></h3><p>${escapeHtml(claim)}</p></div>
    <div class="signal-row__state"><span>${escapeHtml(signal.status)}</span><a href="${escapeHtml(signal.canonical_url)}">Open context →</a></div>
  </article>`;
}

try {
  const response = await fetch("../data/signals.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  status.innerHTML = `<strong>${data.totals.shadow_signals}</strong> reviewed Signals · <strong>${data.totals.represented_institutions}</strong> institutions · <strong>${data.totals.active_distribution_institutions}</strong> active-distribution institutions · ${escapeHtml(data.mode.replaceAll("_", " "))}`;
  root.innerHTML = data.signals.length ? data.signals.slice(0, 100).map(signalRow).join("") : `<p class="empty-state">No records currently clear every distribution gate. The wire will not lower its evidence standard to create activity.</p>`;
} catch (error) {
  status.textContent = "The Signals artifact is temporarily unavailable.";
  root.innerHTML = `<p class="error-state">Could not load the wire: ${escapeHtml(error.message)}</p>`;
}
