/* One fixed action wheel: mana and spell reserves share the housing. */
(function (root) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "mana-wheel";
  svg.setAttribute("viewBox", "0 0 240 440");
  svg.setAttribute("role", "img");
  svg.innerHTML = `<defs>
 <linearGradient id="hud-metal" x2="1" y2="1"><stop stop-color="#333b41"/><stop offset=".45" stop-color="#11191e"/><stop offset="1" stop-color="#292c30"/></linearGradient>
 <linearGradient id="hud-brass" x2="1" y2="1"><stop stop-color="#e1c68c"/><stop offset=".4" stop-color="#80623a"/><stop offset=".7" stop-color="#b69960"/><stop offset="1" stop-color="#43301e"/></linearGradient>
 <linearGradient id="hud-mana" x2="1" y2="1"><stop stop-color="#e2fbff"/><stop offset=".4" stop-color="#57c9fa"/><stop offset="1" stop-color="#1a5ba9"/></linearGradient>
 <filter id="native-mana-tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".504 0 0 0 0  0 .805 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter></defs>
 <path d="M16 48 Q69 56 120 101 C189 119 222 162 224 220 C222 278 189 321 120 339 Q69 384 16 392 L29 331 Q82 330 110 303 C158 280 176 256 176 220 C176 184 158 160 110 137 Q82 110 29 109Z" fill="url(#hud-metal)" stroke="url(#hud-brass)" stroke-width="3"/>
 <path d="M24 56 35 101 Q85 105 115 132 M24 384 35 339 Q85 335 115 308 M143 113 Q215 145 216 220 Q215 295 143 327" fill="none" stroke="#7d694b" stroke-width="1.3"/>
 <circle cx="120" cy="220" r="78" fill="#10151a" stroke="url(#hud-brass)" stroke-width="3"/>
 <circle cx="120" cy="220" r="72" fill="none" stroke="#3b2d1b" stroke-width="3"/>`;
  const ns = svg.namespaceURI,
    sides = [],
    native = root.NATIVE_MAP_HUD,
    pips = root.NATIVE_MANA_PIPS,
    // The button occupies 1/1.8 of this 240-unit SVG viewport.
    nativeScale = pips ? (240 / 1.8 / 2) / pips.button.radius : 4.5,
    nativeCenter = pips?.button.center[0] ?? 92,
    nativeCenterY = pips?.button.center[1] ?? 0;
  if (native) {
    svg.querySelectorAll(":scope > path").forEach(el => el.remove());
    const image = document.createElementNS(ns, "image"),
      [x, y] = native.projection["action-dock"].bounds;
    image.id = "native-action-housing";
    image.setAttribute("href", native.sprites["action-dock"]);
    image.setAttribute("x", 120 + (x[0] - nativeCenter) * nativeScale);
    image.setAttribute("y", 220 - (y[1] - nativeCenterY) * nativeScale);
    image.setAttribute("width", (x[1] - x[0]) * nativeScale);
    image.setAttribute("height", (y[1] - y[0]) * nativeScale);
    svg.insertBefore(image, svg.querySelector("circle"));
    svg.dataset.native = "true";
  }
  if (pips) {
    const clip = document.createElementNS(ns, "clipPath"),
      shape = document.createElementNS(ns, "polygon");
    clip.id = "native-mana-quad";
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    shape.setAttribute("points", pips.uvPolygon.map(p => p.join(",")).join(" "));
    clip.append(shape);
    svg.querySelector("defs").append(clip);
  }
  for (const side of [0, 1]) {
    const group = document.createElementNS(ns, "g");
    group.dataset.side = side;
    const ticks = [],
      nativeImages = [],
      reserve = [];
    for (let i = 0; i < 10; i++) {
      const angle = -91 + i * 8.1,
        rad = (angle * Math.PI) / 180,
        x = 120 + Math.cos(rad) * 94,
        y = 220 + Math.sin(rad) * 94;
      const tick = document.createElementNS(ns, "path");
      tick.setAttribute("d", "M-2.5-5H2.5V5H-2.5Z");
      tick.classList.add("hud-mana-tick");
      tick.setAttribute(
        "transform",
        `translate(${x},${side === 1 ? y : 440 - y}) rotate(${side === 1 ? angle + 90 : -(angle + 90)})`,
      );
      let image = null;
      if (native && pips) {
        // UV -> prefab world XY -> the same projection as the native housing.
        const [a, b, c, d, e, f] = pips.slots[side][i],
          project = (u, v) => [120 + (a * u + c * v + e - nativeCenter) * nativeScale,
            220 - (b * u + d * v + f - nativeCenterY) * nativeScale];
        tick.removeAttribute("transform");
        tick.setAttribute("d", pips.uvPolygon.map(([u, v], j) =>
          (j ? "L" : "M") + project(u, v).join(" ")).join(" ") + "Z");
        image = document.createElementNS(ns, "image");
        image.classList.add("hud-native-mana-pip");
        image.dataset.slot = i + 1;
        image.setAttribute("width", "1");
        image.setAttribute("height", "1");
        image.setAttribute("preserveAspectRatio", "none");
        image.setAttribute("clip-path", "url(#native-mana-quad)");
        image.setAttribute("transform", `matrix(${a * nativeScale} ${-b * nativeScale} ${c * nativeScale} ${-d * nativeScale} ${120 + (e - nativeCenter) * nativeScale} ${220 - (f - nativeCenterY) * nativeScale})`);
      } else {
        tick.setAttribute("stroke", "#111a20");
        tick.setAttribute("stroke-width", "1");
      }
      group.append(tick);
      if (image) group.append(image);
      ticks.push(tick);
      nativeImages.push(image);
    }
    for (let i = 0; i < 3; i++) {
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", [69, 99, 124][i]);
      dot.setAttribute(
        "cy",
        side === 1 ? [74, 86, 100][i] : [366, 354, 340][i],
      );
      dot.setAttribute("r", [13, 10, 7][i]);
      if (native) {
        // Slot centers recovered from the native Spell_mana_tray components.
        dot.setAttribute("cx", 120 + ([98.8591, 101.8752, 104.7841][i] - nativeCenter) * nativeScale);
        dot.setAttribute("cy", 220 + ((side === 1 ? -1 : 1) * [19.9492, 18.9498, 17.6291][i] + nativeCenterY) * nativeScale);
        dot.setAttribute("r", 1.2 * nativeScale);
      }
      dot.setAttribute("stroke", "url(#hud-brass)");
      dot.setAttribute("stroke-width", "2");
      group.append(dot);
      reserve.push(dot);
    }
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", "160");
    label.setAttribute("y", side === 1 ? "84" : "367");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#bceaff");
    label.setAttribute("font-size", "17");
    label.setAttribute("font-family", "Univers");
    label.setAttribute("font-weight", "700");
    if (native) {
      label.setAttribute("x", "166");
      label.setAttribute("y", side === 1 ? "105" : "349");
    }
    label.classList.add("hud-mana-count");
    group.append(label);
    svg.append(group);
    sides.push({ ticks, nativeImages, reserve, label });
  }
  document.getElementById("action-housing").prepend(svg);
  root.ArenaHUD = {
    render(s) {
      for (const side of [0, 1]) {
        const p = s.players[side],
          max = p.maxMana ?? Math.min(10, s.round),
          view = sides[side];
        view.ticks.forEach((el, i) => {
          el.setAttribute(
            "fill",
            view.nativeImages[i] ? "none" : i < p.mana ? "url(#hud-mana)" : i < max ? "#263f50" : "#171e24",
          );
          el.dataset.filled = String(i < p.mana);
          const image = view.nativeImages[i];
          if (image) {
            image.setAttribute("href", pips.sprites[i < p.mana ? "full" : "empty"]);
            image.setAttribute("filter", i < p.mana ? "url(#native-mana-tint)" : "none");
            image.setAttribute("opacity", i < max ? "1" : ".35");
            image.dataset.filled = String(i < p.mana);
          }
        });
        view.reserve.forEach((el, i) => {
          el.setAttribute(
            "fill",
            i < p.spellMana ? "url(#hud-mana)" : "#111a22",
          );
          el.dataset.filled = String(i < p.spellMana);
        });
        view.label.textContent = p.mana + " / " + max;
        document
          .querySelector(side ? "#bot-resources .mana" : "#my-resources .mana")
          ?.setAttribute("aria-hidden", "true");
      }
      svg.setAttribute(
        "aria-label",
        `Mana: você ${s.players[0].mana}/${s.players[0].maxMana ?? Math.min(10, s.round)}, reserva ${s.players[0].spellMana}/3; bot ${s.players[1].mana}/${s.players[1].maxMana ?? Math.min(10, s.round)}, reserva ${s.players[1].spellMana}/3.`,
      );
    },
  };
})(window);
