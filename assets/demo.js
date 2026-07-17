const STEP_LABELS = ["Question", "Record", "Response", "Boundary", "Use", "Scale"];
const AUTOPLAY_DELAY_MS = 12000;

export function initDemo(root, options = {}) {
  if (!root || root.dataset.demoReady === "true") return null;

  const panels = [...root.querySelectorAll("[data-demo-panel]")];
  const stepButtons = [...root.querySelectorAll("[data-demo-step]")];
  const nextButtons = [...root.querySelectorAll("[data-demo-next]")];
  const backButton = root.querySelector("[data-demo-back]");
  const restartButton = root.querySelector("[data-demo-restart]");
  const autoplayButton = root.querySelector("[data-demo-autoplay]");
  const currentStep = root.querySelector("[data-current-step]");
  const status = root.querySelector(".demo-status");
  const copyButton = root.querySelector("[data-copy-citation]");
  const copyStatus = root.querySelector("[data-copy-status]");
  const citation = root.querySelector("[data-citation-text]");
  const delay = options.autoplayDelay ?? AUTOPLAY_DELAY_MS;

  if (!panels.length || panels.length !== stepButtons.length) return null;

  let activeIndex = 0;
  let autoplayTimer = null;
  let autoplayActive = false;

  root.classList.add("demo-enhanced");
  root.dataset.demoReady = "true";

  function stopAutoplay() {
    if (autoplayTimer) clearTimeout(autoplayTimer);
    autoplayTimer = null;
    autoplayActive = false;
    if (autoplayButton) {
      autoplayButton.setAttribute("aria-pressed", "false");
      autoplayButton.textContent = "Play automatically";
    }
  }

  function queueAutoplay() {
    if (!autoplayActive) return;
    if (autoplayTimer) clearTimeout(autoplayTimer);

    if (activeIndex >= panels.length - 1) {
      stopAutoplay();
      return;
    }

    autoplayTimer = setTimeout(() => showStep(activeIndex + 1, { announce: true }), delay);
  }

  function showStep(index, { announce = false, focus = false } = {}) {
    const nextIndex = Math.max(0, Math.min(index, panels.length - 1));
    activeIndex = nextIndex;

    panels.forEach((panel, panelIndex) => {
      const isActive = panelIndex === activeIndex;
      panel.hidden = !isActive;
      panel.classList.toggle("is-entering", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    stepButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeIndex;
      if (isActive) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.setAttribute("aria-label", `Step ${buttonIndex + 1}: ${STEP_LABELS[buttonIndex]}`);
    });

    if (backButton) backButton.disabled = activeIndex === 0;
    nextButtons.forEach((button) => {
      if (button.closest(".demo-panel")) return;
      button.disabled = activeIndex === panels.length - 1;
    });
    if (currentStep) currentStep.textContent = String(activeIndex + 1);
    if (status && announce) {
      status.textContent = `Step ${activeIndex + 1} of ${panels.length}: ${STEP_LABELS[activeIndex]}`;
    }
    if (focus) panels[activeIndex].querySelector("h2")?.focus({ preventScroll: true });

    queueAutoplay();
  }

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stopAutoplay();
      showStep(Number(button.dataset.demoStep), { announce: true });
    });
  });

  nextButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const cameFromPanel = Boolean(button.closest(".demo-panel"));
      if (!cameFromPanel) stopAutoplay();
      showStep(activeIndex + 1, { announce: true });
    });
  });

  backButton?.addEventListener("click", () => {
    stopAutoplay();
    showStep(activeIndex - 1, { announce: true });
  });

  restartButton?.addEventListener("click", () => {
    stopAutoplay();
    showStep(0, { announce: true });
    root.querySelector(".demo-intro")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });

  autoplayButton?.addEventListener("click", () => {
    autoplayActive = !autoplayActive;
    autoplayButton.setAttribute("aria-pressed", String(autoplayActive));
    autoplayButton.textContent = autoplayActive ? "Pause" : "Play automatically";
    if (autoplayActive) queueAutoplay();
    else stopAutoplay();
  });

  copyButton?.addEventListener("click", async () => {
    const text = citation?.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;

    try {
      await (options.clipboard ?? navigator.clipboard).writeText(text);
      if (copyStatus) copyStatus.textContent = "Citation copied.";
    } catch {
      if (copyStatus) copyStatus.textContent = "Copy failed. Select the citation text to copy it manually.";
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.target.closest("a, button, input, textarea, select")) return;
    if (event.key === "ArrowRight") {
      stopAutoplay();
      showStep(activeIndex + 1, { announce: true });
    }
    if (event.key === "ArrowLeft") {
      stopAutoplay();
      showStep(activeIndex - 1, { announce: true });
    }
  });

  showStep(0);
  return {
    showStep,
    stopAutoplay,
    get activeIndex() {
      return activeIndex;
    }
  };
}

if (typeof document !== "undefined") {
  const root = document.querySelector("[data-demo]");
  if (root) initDemo(root);
}
