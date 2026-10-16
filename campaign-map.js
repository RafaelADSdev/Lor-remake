/* Territory preview is presentation-only: it never captures clicks or selects a chapter. */
(function (root) {
  "use strict";
  const $ = id => document.getElementById(id), map = $("campaign-map"), world = $("campaign-world");
  const content = root.CAMPAIGN_MAP_DATA, regions = root.CAMPAIGN_DATA.regions;
  const ns = "http://www.w3.org/2000/svg", shapes = new Map();
  let selected = "demacia", preview = null, frame = null, pointer = null, panelMotion = null, modality = "pointer";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("campaign-territories"); svg.setAttribute("viewBox", `0 0 ${content.size} ${content.size}`);
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
  for (const record of content.regions) {
    const region = regions.find(r => r.id === record.id);
    const path = document.createElementNS(ns, "path");
    path.classList.add("campaign-territory"); path.dataset.region = record.id; path.dataset.kind = record.kind;
    path.setAttribute("d", record.path); path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.style.setProperty("--territory-color", region.color || "#dcba70");
    svg.append(path); shapes.set(record.id, path);
  }
  world.insertBefore(svg, $("campaign-pins"));
  const hitShapes = [...shapes].sort((a, b) => (b[1].dataset.kind === "city") - (a[1].dataset.kind === "city"));
  const peek = document.createElement("div"); peek.id = "campaign-map-peek"; peek.className = "campaign-map-peek";
  peek.setAttribute("aria-hidden", "true"); peek.hidden = true; map.append(peek);
  function motionAllowed() {
    return !reduced.matches && root.ArenaMotion?.enabled !== false && !document.hidden;
  }
  function preferences() {
    map.dataset.motion = motionAllowed() ? "on" : "off";
    if (!motionAllowed()) { panelMotion?.cancel(); panelMotion = null; }
  }
  function paint() {
    const active = preview || selected;
    map.dataset.previewRegion = preview || ""; map.dataset.activeRegion = active;
    map.dataset.input = modality;
    for (const [id, shape] of shapes) {
      shape.classList.toggle("is-active", id === active);
      shape.classList.toggle("is-preview", !!preview && id === preview);
    }
    for (const button of document.querySelectorAll("#campaign-pins button, #campaign-destinations button"))
      button.classList.toggle("is-map-preview", button.dataset.region === preview);
    const region = regions.find(r => r.id === preview);
    peek.hidden = !region;
    if (region) {
      peek.replaceChildren();
      const heading = document.createElement("strong"), caption = document.createElement("span");
      heading.textContent = region.name;
      caption.textContent = `Prévia · Níveis ${region.level.join("–")} · ${region.boss}`;
      peek.append(heading, caption);
    }
  }
  function show(id) {
    const next = shapes.has(id) ? id : null;
    if (next === preview) return;
    preview = next; paint();
  }
  function regionAt(x, y) {
    const point = new DOMPoint(x, y);
    // City halo takes priority where a territory mask could overlap the strait.
    for (const [id, shape] of hitShapes)
      if (shape.isPointInFill(point)) return id;
    return null;
  }
  function inspectPointer() {
    frame = null;
    if (!pointer || $("campaign").hidden) return;
    const pin = pointer.target.closest(".campaign-pin");
    if (pin) { show(pin.dataset.region); return; }
    const rect = world.getBoundingClientRect();
    show(regionAt((pointer.x - rect.left) / rect.width * content.size, (pointer.y - rect.top) / rect.height * content.size));
  }
  map.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || event.buttons) { show(null); return; }
    modality = "pointer";
    pointer = { x: event.clientX, y: event.clientY, target: event.target };
    if (frame === null) frame = requestAnimationFrame(inspectPointer);
  });
  map.addEventListener("pointerleave", () => { pointer = null; if (frame !== null) cancelAnimationFrame(frame); frame = null; show(null); });
  const destinations = $("campaign-destinations");
  function previewDestination(event) {
    if (event.pointerType === "touch" || (event.type === "pointerover" && modality === "keyboard")) return;
    const button = event.target.closest("button[data-region]");
    if (button) { modality = "pointer"; show(button.dataset.region); }
  }
  destinations.addEventListener("pointerover", previewDestination);
  destinations.addEventListener("pointermove", previewDestination);
  destinations.addEventListener("pointerleave", () => show(null));
  $("campaign").addEventListener("focusin", event => {
    const button = event.target.closest("button[data-region]");
    if (button && modality === "keyboard") show(button.dataset.region);
  });
  $("campaign").addEventListener("focusout", event => {
    if (modality === "keyboard" && !event.relatedTarget?.closest("button[data-region]")) show(null);
  });
  document.addEventListener("keydown", () => {
    modality = "keyboard"; map.dataset.input = modality;
    pointer = null; if (frame !== null) cancelAnimationFrame(frame); frame = null;
  }, true);
  document.addEventListener("pointerdown", event => {
    modality = event.pointerType === "touch" ? "touch" : "pointer"; map.dataset.input = modality;
    if (map.contains(event.target) && !event.target.closest("button")) show(null);
  }, true);
  function sync(id) {
    const changed = selected !== id;
    pointer = null; if (frame !== null) cancelAnimationFrame(frame); frame = null;
    selected = id; preview = null;
    preferences(); paint();
    panelMotion?.cancel(); panelMotion = null;
    if (changed && modality !== "keyboard" && motionAllowed() && !$("campaign").hidden)
      panelMotion = $("campaign-region-panel").animate(
        [{ opacity: .7, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 200, easing: "cubic-bezier(.22,1,.36,1)" },
      );
  }
  new MutationObserver(preferences).observe($("motion-toggle"), { attributes: true, attributeFilter: ["aria-pressed"] });
  new MutationObserver(() => {
    if ($("campaign").hidden) {
      pointer = null; if (frame !== null) cancelAnimationFrame(frame); frame = null;
      panelMotion?.cancel(); panelMotion = null; show(null);
    }
  }).observe($("campaign"), { attributes: true, attributeFilter: ["hidden"] });
  reduced.addEventListener("change", preferences); document.addEventListener("visibilitychange", preferences);
  root.CampaignMap = { sync, regionAt };
  preferences(); paint();
})(window);
