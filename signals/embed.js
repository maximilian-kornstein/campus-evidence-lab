(async function () {
  const script = document.currentScript;
  const signalId = script?.dataset?.signal;
  const base = script?.src ? new URL("../", script.src).toString() : "https://campusevidencelab.org/signals/";
  if (!signalId) return;
  const host = document.createElement("aside");
  host.setAttribute("aria-label", "Campus Evidence Lab context");
  host.style.cssText = "border:1px solid #161512;padding:18px;font:14px/1.45 Georgia,serif;background:#f4f0e6;color:#161512;max-width:720px";
  script.insertAdjacentElement("afterend", host);
  try {
    const response = await fetch(`${base}${encodeURIComponent(signalId)}/index.json`);
    const signal = await response.json();
    host.innerHTML = `<strong style="font:700 12px/1.2 sans-serif;letter-spacing:.08em;text-transform:uppercase">Campus Evidence Lab · Public-record context</strong><h3 style="font-size:22px;margin:10px 0 8px">${signal.institution.name}</h3><p>${signal.bounded_claims.map((row) => row.text).join(" ")}</p><a style="color:inherit" href="${signal.canonical_url}">Sources, limits, and corrections →</a>`;
  } catch { host.textContent = "Campus Evidence Lab context is temporarily unavailable."; }
})();
