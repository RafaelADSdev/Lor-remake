/* Original champion illustrations; authored level-up presentation for the local engine. */
(function (root) {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    active = new Set();
  let epoch = 0;
  async function change(before, state) {
    if (root.ArenaMotion.reduced || !root.ArenaMotion.enabled || root.ChampionCinematic.enabled === false) return;
    const ownEpoch = epoch;
    const evolved = [], seen = new Set();
    function add(c) {
      if (!c?.champion || c.level !== 2 || seen.has(c.id)) return;
      seen.add(c.id); evolved.push(c);
    }
    for (const event of state.presentationEvents || []) {
      if (event.kind !== "levelup") continue;
      const old = before.state.players[event.owner]?.board.find(c => c.id === event.id);
      if (old?.level === 2) continue;
      const current = state.players[event.owner]?.board.find(c => c.id === event.id);
      const spec = root.CARD_DATA.cards[event.code];
      add(current || (spec && { ...spec, id: event.id }));
    }
    state.players.forEach((p, i) =>
      p.board.filter(
        (c) =>
          c.champion &&
          c.level === 2 &&
          before.state.players[i].board.some(
            (old) => old.id === c.id && old.level !== 2,
          ),
      ).forEach(add),
    );
    for (const c of evolved) {
      if (ownEpoch !== epoch) return;
      if (await root.ChampionCinematic.play(c)) continue;
      if (ownEpoch !== epoch) return;
      const unit = document.querySelector(`.board [data-id="${c.id}"]`);
      if (root.CardEffects?.has(c.championKey || c.code, "levelup")) {
        const rect = unit?.getBoundingClientRect();
        if (await root.CardEffects.play({ code: c.championKey || c.code, phase: "levelup", sourceRect: rect, targetRect: rect })) continue;
      }
      if (ownEpoch !== epoch) return;
      const el = document.createElement("div");
      el.className = "champion-evolution";
      const name = document.createElement("h2");
      name.textContent = c.name + " · Nível 2";
      const label = document.createElement("span");
      label.className = "eyebrow";
      label.textContent = "CAMPEÃO EVOLUÍDO";
      const img = document.createElement("img");
      img.src = root.CARD_DATA.cards[c.code].portrait;
      img.alt = c.name + " evoluído";
      const text = document.createElement("p");
      text.textContent = c.text || "O campeão alcançou seu próximo nível.";
      el.append(label, img, name, text);
      document.getElementById("effects-layer").append(el);
      const animation = el.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(.96)" },
          { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.2 },
          { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.75 },
          { opacity: 0, transform: "translateY(-8px) scale(1)" },
        ],
        { duration: 1300, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
      );
      active.add(animation);
      await animation.finished.catch(() => {});
      active.delete(animation);
      el.remove();
    }
  }
  function cancel() {
    epoch++;
    root.ChampionCinematic.cancel();
    root.CardEffects?.cancel();
    for (const a of active) a.cancel();
    active.clear();
    document.querySelectorAll(".champion-evolution").forEach((e) => e.remove());
  }
  root.ChampionPresentation = { change, cancel };
})(window);
