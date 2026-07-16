(() => {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[character]);
  const render = async (container) => {
    const limit = Math.max(1, Math.min(10, Number(container.dataset.limit) || 3));
    const feed = container.dataset.feed || "https://campusevidencelab.org/signals/feeds/all.json";
    container.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(feed, { headers: { accept: "application/feed+json, application/json" } });
      if (!response.ok) throw new Error(`Feed unavailable (${response.status})`);
      const data = await response.json();
      const items = (data.items ?? []).slice(0, limit);
      container.innerHTML = `<section class="cel-signals-embed"><header><strong>CEL Signals</strong><a href="${escapeHtml(data.home_page_url || "https://campusevidencelab.org/signals/")}">Open wire</a></header>${items.map((item) => `<article><a href="${escapeHtml(item.url)}"><strong>${escapeHtml(item.title)}</strong></a><p>${escapeHtml(item.content_text)}</p><time datetime="${escapeHtml(item.date_published)}">${escapeHtml(new Date(item.date_published).toLocaleDateString())}</time></article>`).join("")}<footer>Automated, source-linked public-record context · <a href="https://campusevidencelab.org/methodology/">Methodology</a></footer></section>`;
    } catch (error) {
      container.innerHTML = `<p role="status">CEL Signals could not load. <a href="${escapeHtml(feed)}">Open the feed directly</a>.</p>`;
    } finally {
      container.removeAttribute("aria-busy");
    }
  };
  const style = document.createElement("style");
  style.textContent = ".cel-signals-embed{font:14px/1.45 system-ui,sans-serif;border-block:3px solid currentColor;color:#171512}.cel-signals-embed header,.cel-signals-embed footer{display:flex;justify-content:space-between;gap:16px;padding:12px 0}.cel-signals-embed article{padding:16px 0;border-top:1px solid #bcb6aa}.cel-signals-embed article p{margin:6px 0}.cel-signals-embed time,.cel-signals-embed footer{color:#686157;font-size:12px}.cel-signals-embed a{color:inherit;text-underline-offset:3px}";
  document.head.append(style);
  document.querySelectorAll("[data-cel-signals]").forEach(render);
})();
