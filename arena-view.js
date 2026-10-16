/* Theme selection and layout; static backgrounds share the native scene projection. */
(function (root) {
  const themes = {
    rift: {
      name: "Floresta de Runeterra",
      file: "rift.png",
      y: 1028,
      height: 650,
    },
    demacia: {
      name: "Demacia · Salão da Honra",
      file: "demacia.png",
      y: 1275,
      height: 635,
    },
    noxus: {
      name: "Noxus · Fortaleza",
      file: "noxus.png",
      y: 1385,
      height: 640,
    },
    ionia: {
      name: "Ionia · Jardim Espiritual",
      file: "ionia.png",
      y: 1390,
      height: 640,
    },
    freljord: {
      name: "Freljord · Campos de Gelo",
      file: "freljord.png",
      y: 1370,
      height: 678,
    },
    piltover: {
      name: "Piltover · Oficina Hextec",
      file: "piltover.png",
      y: 1270,
      height: 650,
    },
    bilgewater: {
      name: "Águas de Sentina · Porto",
      file: "bilgewater.png",
      y: 1540,
      height: 508,
    },
    shadowisles: {
      name: "Ilhas das Sombras · Ruínas",
      file: "shadowisles.png",
      y: 1040,
      height: 575,
    },
    shurima: {
      name: "Shurima · Templo do Oásis",
      file: "current/shurima.png",
      y: 1595,
      height: 435,
    },
    targon: {
      name: "Targon · Cume Celestial",
      file: "current/targon.png",
      y: 1305,
      height: 730,
    },
    bandlecity: {
      name: "Bandópolis · Bosque dos Portais",
      file: "current/bandlecity.png",
      y: 1305,
      height: 680,
    },
    zaun: {
      name: "Zaun · Submundo Químico",
      file: "current/zaun.png",
      y: 1670,
      height: 360,
    },
  };
  const regionTheme = {
    Demacia: "demacia",
    Noxus: "noxus",
    Ionia: "ionia",
    Freljord: "freljord",
    PiltoverZaun: "piltover",
    Bilgewater: "bilgewater",
    ShadowIsles: "shadowisles",
    Shurima: "shurima",
    Targon: "targon",
    BandleCity: "bandlecity",
  };
  function fromDeck(cards, catalog = {}) {
    const totals = {},
      heroes = {};
    for (const entry of cards) {
      const c = typeof entry === "string" ? catalog[entry] : entry;
      if (!c) continue;
      totals[c.region] = (totals[c.region] || 0) + 1;
      if (c.champion) heroes[c.region] = (heroes[c.region] || 0) + 1;
    }
    const regions = Object.keys(totals).sort(
      (a, b) =>
        (heroes[b] || 0) - (heroes[a] || 0) ||
        totals[b] - totals[a] ||
        a.localeCompare(b),
    );
    return regionTheme[regions[0]] || "rift";
  }
  function selection(cards, catalog, preference) {
    return Object.hasOwn(themes, preference)
      ? preference
      : fromDeck(cards, catalog);
  }
  function campaignTheme(state, campaign = root.Campaign) {
    const region = campaign?.get(state.campaign?.encounterId)?.region;
    if (!region) return null;
    // Ixtal uses the existing forest scenery until it has its own arena asset.
    const key = { 'piltover-zaun': 'piltover', 'shadow-isles': 'shadowisles', ixtal: 'rift' }[region] || region;
    return Object.hasOwn(themes, key) ? key : null;
  }
  const api = { themes, fromDeck, selection, campaignTheme };
  if (typeof module !== "undefined") {
    module.exports = api;
    return;
  }
  const $ = (id) => document.getElementById(id),
    data = root.CARD_DATA;
  function paint(element, key) {
    root.ArenaBackdrop.paint(element, key, root.ARENA_BACKGROUND_DATA || {});
  }
  function preference() {
    return $("arena-choice").value;
  }
  function preview() {
    const key = selection(
      data.decks[$("deck").value] || [],
      data.cards,
      preference(),
    );
    paint($("arena-preview-art"), key);
    $("arena-preview-name").textContent = themes[key].name;
    $("arena-preview-description").textContent =
      preference() === "auto"
        ? "Seu lado acompanha o campeão principal ou a região predominante. O lado do bot acompanha o deck dele."
        : "Esta arena será usada nos dois lados da próxima partida.";
  }
  for (const [id, t] of Object.entries(themes))
    $("arena-choice").append(new Option(t.name, id));
  try {
    const value = localStorage.getItem("lor-arena-choice");
    if (value === "auto" || Object.hasOwn(themes, value))
      $("arena-choice").value = value;
  } catch {}
  $("arena-choice").onchange = () => {
    try {
      localStorage.setItem("lor-arena-choice", preference());
    } catch {}
    preview();
  };
  $("deck").addEventListener("change", preview);
  new MutationObserver(preview).observe($("deck"), {
    childList: true,
    subtree: true,
    characterData: true,
  });
  preview();
  api.prepare = (s, lists) => {
    const chosen = campaignTheme(s) || preference();
    s.arenaThemes = lists.map((cards) => selection(cards, data.cards, chosen));
  };
  let positions = new Map();
  api.enter = (s) => {
    positions.clear();
    const location = campaignTheme(s);
    if (location) s.arenaThemes = [location, location];
    if (
      !s.arenaThemes?.every((key) => Object.hasOwn(themes, key)) ||
      s.arenaThemes.length !== 2
    )
      s.arenaThemes = s.players.map((p) =>
        fromDeck([...p.board, ...p.hand, ...p.deck]),
      );
    paint($("arena-local-surface"), s.arenaThemes[0]);
    paint($("arena-enemy-surface"), s.arenaThemes[1]);
    $("arena-caption").textContent = themes[s.arenaThemes[0]].name;
    $("arena-caption").title =
      "Seu lado: " +
      themes[s.arenaThemes[0]].name +
      " · Adversário: " +
      themes[s.arenaThemes[1]].name;
    document.querySelector(".arena").dataset.localTheme = s.arenaThemes[0];
    root.ArenaAmbient.enter(s.arenaThemes);
    root.ArenaScene.enter(s.arenaThemes);
  };
  api.render = (s, ui) => {
    const preparing = ui.mode === "attack",
      picked = [...ui.selected],
      lanes = s.combat?.ids.length || picked.length || 1;
    for (let side = 0; side < 2; side++) {
      const list = s.players[side].board;
      for (const [index, c] of list.entries()) {
        const el = document.querySelector(`.board [data-id="${c.id}"]`),
          role = ui.battleView.roles[c.id];
        const active = ["attack", "block", "prepare"].includes(role?.kind);
        const lane = role?.lane || picked.indexOf(c.id) + 1;
        const slot = active
          ? lane - (lanes + 1) / 2
          : index - (list.length - 1) / 2;
        el.style.setProperty("--slot", slot);
        el.style.setProperty(
          "--unit-shift",
          active
            ? side === 0
              ? "var(--local-battle-shift, -20cqh)"
              : "17cqh"
            : "0px",
        );
        el.classList.toggle("on-battlefield", active);
        const rect = el.getBoundingClientRect(),
          old = positions.get(c.id);
        const next = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          active,
        };
        if (
          old &&
          old.active !== active &&
          !ui.busy &&
          root.ArenaMotion.enabled &&
          !root.ArenaMotion.reduced
        )
          el.animate(
            [
              { translate: `${old.x - next.x}px ${old.y - next.y}px` },
              { translate: "0px 0px" },
            ],
            { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" },
          )
            .finished.then(() =>
              document.dispatchEvent(new Event("arena-layout-settled")),
            )
            .catch(() => {});
        positions.set(c.id, next);
      }
    }
    const stage = document.querySelector(".arena");
    stage.dataset.priority = String(s.priority);
    stage.dataset.arenaPhase = preparing
      ? "prepare"
      : s.combat
        ? s.combat.owner === 0
          ? "attack"
          : "defend"
        : s.phase;
    const canAttack = root.Engine.canAttack(s, 0),
      enemyAttack = root.Engine.canAttack(s, 1);
    $("arena-token").classList.toggle("has-attack", canAttack);
    $("arena-token").setAttribute(
      "aria-label",
      canAttack
        ? "Você tem o token de ataque"
        : enemyAttack
          ? "O bot tem o token de ataque"
          : "Token de ataque consumido",
    );
    $("arena-token").title = $("arena-token").getAttribute("aria-label");
    $("action-housing").classList.toggle(
      "confirming",
      preparing ||
        s.phase === "response" ||
        (s.phase === "block" && s.priority === 0),
    );
    if (s.priority === 1 && s.phase !== "mulligan")
      $("pass").textContent = "Turno do oponente";
    $("arena-hint").textContent = preparing
      ? "Confirme seu ataque"
      : s.combat
        ? s.combat.owner === 0
          ? "Você ataca · Bot bloqueia"
          : "Bot ataca · Você bloqueia"
        : "";
    $("arena-hint").hidden = !preparing && !s.combat;
    for (const id of positions.keys())
      if (!s.players.some((p) => p.board.some((c) => c.id === id)))
        positions.delete(id);
  };
  root.ArenaView = api;
})(typeof window === "undefined" ? globalThis : window);
