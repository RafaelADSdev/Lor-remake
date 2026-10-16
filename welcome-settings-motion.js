/* Interruptible feedback for the lobby's native settings disclosure. */
(function () {
  const panel = document.querySelector(".welcome-settings");
  const preview = panel?.querySelector(".arena-preview");
  const toggle = document.getElementById("motion-toggle");
  const welcome = document.getElementById("welcome");
  if (!panel || !preview || !toggle || !welcome) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let current = null;
  function cancel() {
    current?.cancel();
    current = null;
  }
  function allowed() {
    return (
      panel.open &&
      !welcome.hidden &&
      !reduced.matches &&
      !document.hidden &&
      toggle.getAttribute("aria-pressed") === "true"
    );
  }
  panel.addEventListener("change", (event) => {
    if (!event.target.matches("select")) return;
    cancel();
    if (!allowed() || typeof preview.animate !== "function") return;
    const animation = preview.animate(
      [
        { opacity: 0.35, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    current = animation;
    animation.finished
      .then(() => {
        if (current === animation) current = null;
      })
      .catch(() => {});
  });
  panel.addEventListener("toggle", () => {
    if (!panel.open) cancel();
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) cancel();
  });
  new MutationObserver(() => {
    if (toggle.getAttribute("aria-pressed") !== "true") cancel();
  }).observe(toggle, { attributes: true, attributeFilter: ["aria-pressed"] });
  new MutationObserver(() => {
    if (welcome.hidden) cancel();
  }).observe(welcome, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancel();
  });
})();
