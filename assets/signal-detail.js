const signalId = document.body.dataset.signalId;
const api = document.querySelector('meta[name="cel-signals-api"]')?.content?.replace(/\/$/, "");

function track(eventType, metadata = {}) {
  if (!api || !signalId) return;
  const payload = JSON.stringify({ signal_id: signalId, event_type: eventType, referrer: document.referrer, metadata });
  if (navigator.sendBeacon) navigator.sendBeacon(`${api}/api/track`, new Blob([payload], { type: "application/json" }));
  else fetch(`${api}/api/track`, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
}

track(sessionStorage.getItem(`cel-signal-${signalId}`) ? "return_visit" : "signal_view");
sessionStorage.setItem(`cel-signal-${signalId}`, "1");
for (const link of document.querySelectorAll("[data-source-id]")) link.addEventListener("click", () => track("source_open", { source_id: link.dataset.sourceId }));
