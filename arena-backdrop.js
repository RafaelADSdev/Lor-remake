/* A normal image element is the visible board; no CSS file URL or GPU frame required. */
(function (root) {
  function paint(element, key, assets) {
    const theme = Object.hasOwn(assets, key) ? key : "rift";
    const embedded = assets[theme];
    const fallback = "assets/arenas/current/fallback-" + theme + ".png";
    element.dataset.theme = theme;
    element.dataset.background = "loading";
    if (element.tagName !== "IMG")
      throw Error("O fundo da arena precisa ser uma imagem.");
    element.onload = () => {
      element.dataset.background = "ready";
    };
    element.onerror = () => {
      if (element.dataset.background === "fallback") {
        element.dataset.background = "error";
        return;
      }
      element.dataset.background = "fallback";
      element.src = fallback;
    };
    element.src = embedded || fallback;
    if (element.classList?.contains("arena-surface")) {
      const enemy = element.classList.contains("arena-surface-enemy"),
        side = enemy ? "enemy" : "local";
      let frame = element.parentElement.querySelector(".arena-frame-" + side);
      if (!frame) {
        frame = element.ownerDocument.createElement("img");
        frame.className = "arena-frame arena-frame-" + side;
        frame.alt = "";
        frame.draggable = false;
        frame.onerror = () => { frame.hidden = true; };
        frame.onload = () => { frame.hidden = false; };
        element.after(frame);
      }
      frame.dataset.theme = theme;
      // Native PNG alpha preserves the scenery without restoring the dark HUD gaps.
      frame.src = fallback;
    }
    if (element.complete && element.naturalWidth > 0)
      element.dataset.background = "ready";
  }
  const api = { paint };
  if (typeof module !== "undefined") module.exports = api;
  else root.ArenaBackdrop = api;
})(typeof window === "undefined" ? globalThis : window);
