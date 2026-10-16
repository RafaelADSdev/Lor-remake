"use strict";
const $ = (id) => document.getElementById(id),
  E = window.Engine,
  data = window.CARD_DATA;
const KEY = "runeterra-mesa-v1";
let state = null,
  saved = null,
  mode = null,
  selected = new Set(),
  challenges = {},
  challengeSource = null,
  blocks = {},
  blocker = null,
  spell = null,
  spellTargets = [],
  attackDraft = null,
  timer = null,
  toastTimer = null,
  busy = false,
  motionEpoch = 0,
  peekTimer = null;
const labels = {
  Tough: "Robusto · recebe 1 dano a menos",
  Elusive: "Elusivo · bloqueado somente por Elusivos",
  Fearsome: "Assustador · bloqueado por poder 3+",
  CantBlock: "Não pode bloquear",
  Overwhelm: "Sobrepujar · excesso de dano atinge o Nexus",
  LastBreath: "Suspiro final",
  Regeneration: "Regeneração · recupera toda a vida ao terminar a rodada",
  QuickStrike: "Ataque Rápido · ataca antes do bloqueador ao atacar",
  Attune: "Sintonia · ao invocar, recupera 1 de mana de feitiço",
  Lifesteal: "Roubo de Vida · dano causado também cura seu Nexus",
  Ephemeral: "Efêmero · morre após golpear ou no fim da rodada",
  Barrier: "Barreira · impede o próximo dano nesta rodada",
  Challenger: "Desafiador · escolha qual inimigo bloqueia esta unidade",
  Vulnerable: "Vulnerável · inimigos podem escolher esta unidade como bloqueadora",
  SpellShield: "Escudo de Feitiço · impede o próximo feitiço ou habilidade inimiga que afetaria a unidade",
  Fury: "Fúria · recebe +1|+1 ao abater um inimigo",
  Scout: "Patrulheiro · o primeiro ataque só com Patrulheiros renova o ataque",
  DoubleStrike: "Ataque Duplo · golpeia antes e durante o combate ao atacar",
  Immobile: "Imóvel · não pode ser declarado atacante ou bloqueador",
};
function notify(t) {
  $("toast").textContent = t;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4000);
}
function validSave(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Number.isInteger(s.round) ||
    s.round < (s.phase === "mulligan" ? 0 : 1) ||
    !["main", "block", "response", "mulligan", "over"].includes(s.phase) ||
    ![0, 1].includes(s.priority) ||
    ![0, 1].includes(s.token) ||
    !Array.isArray(s.players) ||
    s.players.length !== 2 ||
    !Array.isArray(s.log)
  )
    return false;
  const ids = new Set();
  for (const p of s.players) {
    if (
      !Number.isFinite(p.nexus) ||
      !Number.isInteger(p.mana) ||
      p.mana < 0 ||
      p.mana > 10 ||
      !Number.isInteger(p.spellMana) ||
      p.spellMana < 0 ||
      p.spellMana > 3
    )
      return false;
    for (const zone of ["hand", "board", "deck"]) {
      if (!Array.isArray(p[zone])) return false;
      for (const c of p[zone]) {
        if (
          !data.cards[c.code] ||
          typeof c.id !== "string" ||
          ids.has(c.id) ||
          !Number.isFinite(c.attack) ||
          !Number.isFinite(c.health) ||
          !Array.isArray(c.keywords)
        )
          return false;
        ids.add(c.id);
      }
    }
  }
  if (
    (s.phase === "block" || s.responseContext === "combat") &&
    (!s.combat ||
      ![0, 1].includes(s.combat.owner) ||
      !Array.isArray(s.combat.ids) ||
      s.combat.ids.some(
        (id) => !s.players[s.combat.owner].board.some((u) => u.id === id),
      ))
  )
    return false;
  return true;
}
try {
  saved = JSON.parse(localStorage.getItem(KEY));
  if (saved?.players)
    for (const p of saved.players)
      for (const zone of ["board", "hand", "deck"])
        if (Array.isArray(p[zone]))
          p[zone] = p[zone].map((c) => ({ ...data.cards[c.code], ...c }));
  if (!validSave(saved)) saved = null;
  else E.hydrate(saved, data.cards);
} catch {
  saved = null;
}
$("resume").hidden = !saved;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $("save-status").textContent = "Partida salva neste navegador.";
    saved = structuredClone(state);
    $("resume").hidden = false;
  } catch {
    $("save-status").textContent =
      "Salvamento automático indisponível. Use Exportar salvamento.";
  }
}
function inspect(c) {
  if (busy) return;
  if (!matchMedia("(pointer: coarse)").matches && !state?.combat && mode !== "attack" && !spell)
    document.body.classList.add("peek-open");
  clearTimeout(peekTimer);
  const box = $("inspection");
  box.replaceChildren();
  const image = document.createElement("img");
  image.src = data.cards[c.code].portrait || data.cards[c.code].image;
  image.alt = c.name;
  box.append(image);
  const h = document.createElement("h3");
  h.textContent = c.name;
  box.append(h);
  const meta = document.createElement("p");
  meta.className = "muted";
  meta.textContent = `${c.region} · ${c.cost} mana · ${c.type === "unit" ? "Unidade" : "Feitiço"}`;
  if (c.champion) meta.textContent += ` · Campeão nível ${c.level || 1}`;
  box.append(meta);
  for (const k of c.keywords) {
    if (["Burst", "Focus", "Fast", "Slow"].includes(k)) continue;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = labels[k] || k;
    box.append(tag);
  }
  const p = document.createElement("p");
  p.textContent =
    c.text || (c.type === "unit" ? "Unidade sem habilidade adicional." : "");
  box.append(p);
  if (c.champion) {
    const progress = document.createElement("p");
    progress.className = "champion-progress";
    progress.textContent =
      c.level === 2
        ? "Nível 2 · Evolução concluída"
        : c.championKey === "01DE012"
          ? `Evolução: ${Math.min(2, c.strikes || 0)}/2 golpes.`
          : c.championKey === "01NX038"
            ? "Evolução: Nexus inimigo com 10 ou menos de vida."
            : c.championKey === "01FR009"
              ? `Evolução: ${Math.min(10, c.survivedDamage || 0)}/10 de dano sobrevivido.`
              : c.championKey === "01FR039"
                ? "Evolução: na primeira vez que eu morrer."
                : "Evolução: alcance 10 de mana máxima (Iluminado).";
    box.append(progress);
  }
  if (c.type === "spell") {
    const note = document.createElement("p");
    note.className = "fine";
    note.textContent =
      c.speed === "Burst"
        ? "Súbito: resolve imediatamente e você conserva a ação."
        : c.speed === "Focus"
          ? "Focado: resolve imediatamente e você conserva a ação. Só pode ser usado fora do combate e da sequência de respostas."
        : state.rulesVersion >= 5
          ? `${c.speed === "Fast" ? "Rápido" : "Lento"}: entra na sequência e permite resposta do adversário.`
          : "Partida antiga: resolução imediata. Inicie um duelo novo para usar respostas.";
    box.append(note);
  }
}
function closeInspectionSoon() {
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => document.body.classList.remove("peek-open"), 250);
}
$("grimoire").addEventListener("mouseenter", () => clearTimeout(peekTimer));
$("grimoire").addEventListener("mouseleave", closeInspectionSoon);
$("grimoire").addEventListener("focusin", () => clearTimeout(peekTimer));
$("grimoire").addEventListener("focusout", closeInspectionSoon);
function card(c, zone, owner) {
  if (zone === "hand") c = E.cardView(state, owner, c);
  const btn = document.createElement("button");
  btn.className = "card";
  btn.dataset.type = c.type;
  btn.dataset.id = c.id;
  btn.dataset.code = c.code;
  if (c.champion) {
    btn.classList.add("champion-card");
    btn.dataset.level = c.level || 1;
  }
  btn.setAttribute(
    "aria-label",
    `${c.name}, custo ${c.cost}${c.type === "unit" ? `, ataque ${c.attack}, vida ${c.health}` : ""}`,
  );
  btn.title = c.name;
  const img = document.createElement("img");
  img.src =
    zone === "hand" ? data.cards[c.code].portrait : data.cards[c.code].image;
  img.alt = "";
  img.addEventListener("error", () => {
    btn.classList.add("art-unavailable");
    img.src = "assets/pwa/card-offline.svg";
  }, { once: true });
  const cost = document.createElement("span");
  cost.className = "cost";
  cost.textContent = c.cost;
  const name = document.createElement("span");
  name.className = "card-name";
  name.textContent = c.name;
  const stats = document.createElement("span");
  stats.className = "stats";
  if (c.type === "unit") {
    const a = document.createElement("span"),
      h = document.createElement("span");
    a.className = "power";
    h.className = "health";
    a.textContent = c.attack;
    h.textContent = c.health;
    stats.append(a, h);
  } else stats.textContent = "✦ Feitiço";
  btn.append(img, cost, name, stats);
  if (c.champion && zone === "board") {
    const badge = document.createElement("span");
    badge.className = "champion-badge";
    badge.textContent = c.level === 2 ? "★ NÍVEL 2" : "★ CAMPEÃO";
    btn.append(badge);
  }
  if (
    zone === "board" &&
    c.keywords.some((k) => !["Fast", "Burst", "Focus", "Slow"].includes(k))
  ) {
    const marks = document.createElement("span");
    marks.className = "keyword-marks";
    marks.textContent = c.keywords
      .map(
        (k) =>
          ({
            Tough: "◆",
            Fearsome: "◈",
            Elusive: "⌁",
            Overwhelm: "»",
            CantBlock: "×",
            LastBreath: "✧",
            Regeneration: "↻",
            QuickStrike: "ϟ",
            Attune: "✦",
            Lifesteal: "♥",
            Ephemeral: "◌",
            Barrier: "◇",
          })[k] || "",
      )
      .join(" ");
    marks.title = c.keywords.map((k) => labels[k] || k).join(" · ");
    btn.append(marks);
  }
  btn.addEventListener("mouseenter", () => inspect(c));
  btn.addEventListener("focus", () => inspect(c));
  btn.addEventListener("mouseleave", closeInspectionSoon);
  btn.addEventListener("blur", closeInspectionSoon);
  btn.addEventListener("click", () => clickCard(c, zone, owner));
  if (selected.has(c.id) || blocker === c.id) btn.classList.add("selected");
  if (zone === "board" && c.stunned) {
    btn.classList.add("card-stunned");
    const status = document.createElement("span");
    status.className = "card-status"; status.textContent = "ATORDOADO";
    btn.append(status);
    btn.setAttribute("aria-label", btn.getAttribute("aria-label") + ", Atordoado nesta rodada");
  }
  if (["board", "hand"].includes(zone) && spell && (E.targets(state, 0, spell, spellTargets).includes(c.id) || spellTargets.includes(c.id))) {
    btn.classList.add("spell-target");
    btn.title = `Utilizar ${spell.name} em ${c.name}`;
    if (spellTargets.includes(c.id)) btn.classList.add("spell-target-picked");
  }
  if (zone === "board" && mode === "attack" && owner === 1 && challengeSource) {
    const source = state.players[0].board.find(unit => unit.id === challengeSource);
    if (source && E.canChallenge?.(source, c)) {
      btn.classList.add("challenge-target");
      btn.title = `${source.name}: desafiar ${c.name}`;
    }
  }
  if (zone === "board" && (Object.values(challenges).includes(c.id) || challenges[c.id])) {
    btn.classList.add("challenge-paired");
    btn.setAttribute("aria-label", btn.getAttribute("aria-label") + ", desafio escolhido");
  }
  if (state.combat?.ids.includes(c.id)) btn.classList.add("attacking");
  btn.style.setProperty("--combat-shift", owner === 0 ? "-18px" : "18px");
  if (Object.values(blocks).includes(c.id)) btn.classList.add("blocking");
  if (zone === "hand") {
    btn.disabled =
      !["main", "block", "response"].includes(state.phase) ||
      state.priority !== 0 ||
      (!!mode &&
        !(
          mode === "attack" &&
          c.type === "spell" &&
          ["Burst", "Focus", "Fast"].includes(c.speed)
        )) ||
      !E.playable(state, 0, c) ||
      busy;
    if (spell) btn.disabled = busy || state.priority !== 0 || !(E.targets(state, 0, spell, spellTargets).includes(c.id) || spellTargets.includes(c.id));
    btn.draggable = !matchMedia("(pointer: coarse)").matches && !btn.disabled && !spell;
    btn.addEventListener("dragstart", (event) => {
      if (btn.disabled) return event.preventDefault();
      event.dataTransfer.setData("text/plain", c.id);
      event.dataTransfer.effectAllowed = "move";
      document.body.classList.add("dragging-card");
    });
    btn.addEventListener("dragend", () =>
      document.body.classList.remove("dragging-card"),
    );
    if (btn.disabled && !busy && state.priority === 0) {
      const available =
        state.players[0].mana +
        (c.type === "spell" ? state.players[0].spellMana : 0);
      btn.title =
        available < c.cost
          ? `${c.name}: custa ${c.cost} mana. Você tem ${available}.`
          : c.effect === "buff" && !state.players[0].board.length
            ? "Invoque um aliado no campo para receber este efeito."
            : c.effect === "judgment"
              ? "Julgamento: selecione um aliado como bloqueador antes de usar."
              : "Carta indisponível nesta fase ou campo cheio.";
    }
  }
  if (busy) btn.disabled = true;
  if (zone === "board") {
    btn.addEventListener("dragover", (event) => {
      if (
        !busy &&
        state.priority === 0 &&
        document.body.classList.contains("dragging-card")
      )
        event.preventDefault();
    });
    btn.addEventListener("drop", (event) => {
      const id = event.dataTransfer.getData("text/plain"),
        original = state.players[0].hand.find((c) => c.id === id);
      const cast = original && E.cardView(state, 0, original);
      if (!cast || !E.targets(state, 0, cast).includes(c.id)) return;
      event.preventDefault();
      event.stopPropagation();
      document.body.classList.remove("dragging-card");
      if ((cast.targetCount || 1) > 1) {
        spell = cast; spellTargets = []; mode = "spell"; pickSpellTarget(c.id);
      } else run(() => E.play(state, 0, id, c.id));
    });
  }
  if (
    zone === "board" &&
    owner === 0 &&
    state.phase === "main" &&
    state.priority === 0 &&
    E.canAttack(state, 0) &&
    !busy &&
    mode !== "spell"
  ) {
    btn.draggable = !matchMedia("(pointer: coarse)").matches && !c.stunned && !c.keywords.includes("Immobile");
    btn.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", "attack:" + c.id);
      event.dataTransfer.effectAllowed = "move";
      document.body.classList.add("dragging-attacker");
    });
    btn.addEventListener("dragend", () =>
      document.body.classList.remove("dragging-attacker"),
    );
  }
  return btn;
}
function clickCard(c, zone, owner) {
  if (busy) return;
  inspect(c);
  document.body.classList.remove("peek-open");
  clearTimeout(peekTimer);
  if (state.winner !== null) return;
  if (mode === "attack" && zone === "board" && owner === 1 && challengeSource) {
    const source = state.players[0].board.find(unit => unit.id === challengeSource);
    if (!source || !E.canChallenge?.(source, c)) return;
    for (const id of Object.keys(challenges))
      if (challenges[id] === c.id) delete challenges[id];
    challenges[challengeSource] = c.id;
    challengeSource = null;
    render();
    return;
  }
  if (spell) {
    if (["board", "hand"].includes(zone) && (E.targets(state, 0, spell, spellTargets).includes(c.id) || spellTargets.includes(c.id)))
      pickSpellTarget(c.id);
    return;
  }
  if (
    state.phase === "block" &&
    state.priority === 0 &&
    state.combat.owner === 1 &&
    zone === "board"
  ) {
    if (owner === 0) {
      if (Object.values(state.combat.forcedBlocks || {}).includes(c.id))
        return notify("Esta unidade foi desafiada e já tem um bloqueio obrigatório.");
      if (c.keywords.includes("CantBlock"))
        return notify("Esta unidade não pode bloquear.");
      const assigned = Object.keys(blocks).find((id) => blocks[id] === c.id);
      if (assigned) {
        delete blocks[assigned];
        blocker = null;
      } else {
        const target = state.combat.ids.find(
          (id) =>
            !blocks[id] &&
            state.players[1].board.some((u) => u.id === id) &&
            E.canBlock(
              state.players[1].board.find((u) => u.id === id),
              c,
            ),
        );
        if (target) blocks[target] = c.id;
        blocker = c.id;
      }
      E.previewBlocks(state, 0, blocks);
      render();
    } else if (blocker) {
      if (state.combat.forcedBlocks?.[c.id])
        return notify("Este atacante já escolheu seu bloqueador com Desafiador.");
      const b = state.players[0].board.find((u) => u.id === blocker);
      if (!E.canBlock(c, b))
        return notify("Esse bloqueador não pode bloquear esta unidade.");
      for (const id of Object.keys(blocks))
        if (blocks[id] === blocker) delete blocks[id];
      blocks[c.id] = blocker;
      E.previewBlocks(state, 0, blocks);
      blocker = null;
      render();
    } else if (blocks[c.id]) {
      if (state.combat.forcedBlocks?.[c.id])
        return notify("Esse bloqueio foi escolhido pelo atacante.");
      delete blocks[c.id];
      E.previewBlocks(state, 0, blocks);
      render();
    }
    return;
  }
  if (
    zone === "board" &&
    owner === 0 &&
    state.phase === "main" &&
    state.priority === 0 &&
    E.canAttack(state, 0)
  ) {
    if (c.stunned || c.keywords.includes("Immobile"))
      return notify(c.stunned ? "Esta unidade está Atordoada nesta rodada." : "Esta unidade é Imóvel.");
    if (mode !== "attack") {
      mode = "attack";
      selected.clear();
    }
    const canPick = state.players[1].board.some(enemy => E.canChallenge?.(c, enemy));
    if (selected.has(c.id) && canPick && challengeSource !== c.id) {
      challengeSource = c.id;
    } else if (selected.has(c.id)) {
      selected.delete(c.id); delete challenges[c.id]; challengeSource = null;
    } else {
      selected.add(c.id); challengeSource = canPick ? c.id : null;
    }
    if (!selected.size) mode = null;
    render();
    return;
  }
  if (zone === "hand" && owner === 0 && state.priority === 0) {
    if (E.targets(state, 0, c).length) {
      if (mode === "attack") attackDraft = [...selected];
      spell = c;
      spellTargets = [];
      mode = "spell";
      render();
    } else run(() => E.play(state, 0, c.id));
  }
}
function pickSpellTarget(target) {
  const chosen = spell;
  if (!chosen || (!spellTargets.includes(target) && !E.targets(state, 0, chosen, spellTargets).includes(target))) return;
  const count = chosen.targetCount || 1;
  if (count === 1) return run(() => E.play(state, 0, chosen.id, target));
  if (spellTargets.includes(target)) spellTargets = chosen.targetSlots
    ? spellTargets.slice(0, spellTargets.indexOf(target))
    : spellTargets.filter(id => id !== target);
  else if (spellTargets.length < count) spellTargets.push(target);
  const picked = [...spellTargets];
  const required = chosen.targetSlots ? chosen.targetSlots.length : Math.min(count, E.targets(state, 0, chosen).length);
  if (picked.length >= required)
    run(() => E.play(state, 0, chosen.id, picked));
  else render();
}
function resource(id, p, enemy) {
  const root = $(id);
  root.replaceChildren();
  const mana = document.createElement("div");
  mana.className = "mana";
  const strong = document.createElement("strong");
  strong.textContent = p.mana;
  mana.append(
    strong,
    document.createTextNode("/ " + (p.maxMana ?? Math.min(10, state.round)) + " mana"),
  );
  const bank = document.createElement("div");
  bank.className = "bank";
  bank.textContent = "Reserva ✦ " + p.spellMana + "/3";
  mana.append(bank);
  const crystals = document.createElement("div");
  crystals.className = "mana-crystals";
  crystals.setAttribute("aria-hidden", "true");
  for (let i = 0; i < (p.maxMana ?? Math.min(10, state.round)); i++) {
    const gem = document.createElement("span");
    gem.className = i < p.mana ? "gem filled" : "gem";
    crystals.append(gem);
  }
  mana.append(crystals);
  const nx = document.createElement("button");
  nx.className = "nexus";
  nx.id = enemy ? "enemy-nexus" : "my-nexus";
  nx.setAttribute(
    "aria-label",
    (enemy ? "Nexus inimigo" : "Seu Nexus") + ", " + p.nexus + " de vida",
  );
  const n = document.createElement("b");
  n.textContent = p.nexus;
  const label = document.createElement("small");
  label.textContent = "NEXUS";
  nx.append(n, label);
  const nativeDock = window.NATIVE_MAP_HUD?.sprites[enemy ? "nexus-red-dock" : "nexus-blue-dock"];
  if (nativeDock) {
    const dock = document.createElement("img");
    dock.className = "nexus-native-dock";
    dock.src = nativeDock;
    dock.alt = "";
    dock.draggable = false;
    nx.classList.add("has-native-dock");
    nx.prepend(dock);
  }
  const nexusTarget = enemy ? "nexus" : "my-nexus";
  if (spell && (E.targets(state, 0, spell, spellTargets).includes(nexusTarget) || spellTargets.includes(nexusTarget)))
    nx.classList.add("spell-target");
  nx.onclick = () => {
    if (spell && (E.targets(state, 0, spell, spellTargets).includes(nexusTarget) || spellTargets.includes(nexusTarget)))
      pickSpellTarget(nexusTarget);
  };
  root.append(mana, nx);
}
function render() {
  const battleView = CombatView.describe(state, {
    mode,
    selected,
    blocks,
    blocker,
  });
  document.body.classList.toggle(
    "combat-preparing",
    mode === "attack" && !state.combat,
  );
  document.body.dataset.combatOwner = state.combat
    ? String(state.combat.owner)
    : "";
  const mine = state.players[0],
    enemy = state.players[1];
  resource("my-resources", mine, false);
  resource("bot-resources", enemy, true);
  mine.deckName = ArenaDecks.playerName(data, mine);
  enemy.deckName = ArenaDecks.playerName(data, enemy, state.opponentKey || enemy.deckKey);
  $("my-name").textContent = mine.deckName;
  $("bot-name").textContent = "Bot · " + enemy.deckName;
  $("my-name").title = mine.deckName;
  $("bot-name").title = "Bot · " + enemy.deckName;
  $("round-label").textContent =
    (state.training ? "TREINO · RODADA " : "RODADA ") +
    String(state.round).padStart(2, "0");
  $("token-label").textContent =
    E.canAttack(state, 0) && E.canAttack(state, 1)
      ? "◆ AMBOS PODEM ATACAR"
      : E.canAttack(state, 0)
        ? "◆ SEU ATAQUE"
        : E.canAttack(state, 1)
          ? "◆ ATAQUE DO BOT"
          : "◇ TOKEN CONSUMIDO";
  $("phase-label").textContent =
    state.phase === "over"
      ? "Duelo encerrado"
      : state.phase === "mulligan"
        ? "Escolha sua mão inicial"
        : state.phase === "response"
          ? state.priority === 0
            ? "Sua resposta"
            : "Bot respondendo…"
          : state.phase === "block"
            ? "Fase de bloqueio"
            : state.priority === 0
              ? "Sua ação"
              : "Bot pensando…";
  $("bot-hand").replaceChildren();
  for (let i = 0; i < enemy.hand.length; i++) {
    const b = document.createElement("span");
    b.className = "back";
    b.textContent = "R";
    $("bot-hand").append(b);
  }
  for (const [id, list, owner, zone] of [
    ["enemy-board", enemy.board, 1, "board"],
    ["my-board", mine.board, 0, "board"],
    ["my-hand", mine.hand, 0, "hand"],
  ]) {
    const root = $(id);
    root.replaceChildren();
    if (zone === "hand") root.style.setProperty("--hand-count", list.length);
    for (const [index, c] of list.entries()) {
      const element = card(c, zone, owner);
      if (zone === "board" && battleView.roles[c.id]) {
        const role = battleView.roles[c.id],
          badge = document.createElement("span");
        badge.className = "combat-role";
        badge.textContent = role.label;
        element.dataset.combatRole = role.kind;
        if (role.lane) element.dataset.combatLane = role.lane;
        element.setAttribute(
          "aria-label",
          element.getAttribute("aria-label") +
            ", " +
            role.label +
            (role.outcome ? ", " + role.outcome : ""),
        );
        element.append(badge);
        if (role.outcome) {
          const outcome = document.createElement("span");
          outcome.className = "combat-outcome";
          outcome.textContent = role.outcome;
          element.append(outcome);
        }
      }
      if (zone === "hand") {
        const offset = index - (list.length - 1) / 2;
        element.style.setProperty(
          "--fan-angle",
          `${offset * (list.length > 6 ? 0.5 : 1.5)}deg`,
        );
        element.style.setProperty("--fan-y", `${Math.abs(offset) * 1.5}px`);
      }
      root.append(element);
    }
    if (!list.length) {
      const t = document.createElement("p");
      t.className = "empty";
      t.textContent =
        zone === "hand" ? "Sua mão está vazia." : "Aguardando unidades";
      root.append(t);
    }
  }
  $("my-deck").textContent = mine.deck.length + " CARTAS NO DECK";
  $("bot-deck").textContent = enemy.deck.length + " CARTAS NO DECK";
  $("log").replaceChildren();
  for (const t of [...state.log].reverse()) {
    const li = document.createElement("li");
    li.textContent = t;
    $("log").append(li);
  }
  const active = state.priority === 0 && state.phase === "main";
  $("attack").disabled =
    !active ||
    !E.canAttack(state, 0) ||
    !mine.board.some(unit => !unit.stunned && !unit.keywords.includes("Immobile")) ||
    mode === "spell" ||
    busy;
  $("attack").textContent =
    mode === "attack"
      ? `Confirmar ataque (${selected.size})`
      : "Preparar ataque";
  if (mode === "attack" && !selected.size) $("attack").disabled = true;
  $("cancel").hidden = !mode;
  $("pass").disabled = !active || !!mode || busy;
  $("pass").textContent = "Passar";
  if (mode === "attack") {
    $("pass").textContent = "Atacar";
    $("pass").disabled = !active || !selected.size || busy;
  }
  if (state.phase === "block" && state.combat.owner === 1) {
    $("pass").disabled = busy || !!mode || state.priority !== 0;
    $("pass").textContent = "Confirmar bloqueios";
    $("attack").disabled = true;
  }
  if (state.phase === "response") {
    $("pass").disabled = busy || !!mode || state.priority !== 0;
    $("pass").textContent = state.combat
      ? "Resolver combate"
      : "Resolver feitiços";
  }
  if (spell && (spell.targetCount || 1) > 1) {
    $("pass").textContent = `Confirmar alvos (${spellTargets.length}/${spell.targetCount})`;
    $("pass").disabled = busy || state.priority !== 0 || (spell.targetSlots ? spellTargets.length !== spell.targetSlots.length : spellTargets.length === 0);
  }
  $("instruction").textContent =
    state.phase === "over"
      ? "Partida encerrada. Comece um novo duelo pelo menu."
      : spell
        ? `Escolha ${spell.effect === "buff" ? "um aliado destacado" : "o alvo destacado"} para ${spell.name}.`
        : mode === "attack"
          ? "Clique nas suas unidades para selecionar os atacantes."
          : state.phase === "response"
            ? "Jogue um Rápido ou Súbito para responder, ou confirme a resolução. Unidades e Lentos aguardam."
            : state.phase === "block"
              ? "Escolha uma unidade sua e clique no atacante inimigo. Clique no atacante novamente para remover o bloqueio."
              : active
                ? E.canAttack(state, 0) && mine.board.length
                  ? "Clique numa unidade do campo para atacar. Clique novamente para recolher; confirme no botão de ação."
                  : "Clique numa carta da mão para jogá-la. O token indica quem pode atacar."
                : "O bot está escolhendo sua próxima ação.";
  if (battleView.title) {
    $("phase-label").textContent = battleView.title;
    if (!spell) $("instruction").textContent = battleView.instruction;
  }
  if (spell && (spell.targetCount || 1) > 1)
    $("instruction").textContent = spell.targetSlots
      ? `Escolha o alvo ${spellTargets.length + 1} de ${spell.targetSlots.length} destacado para ${spell.name}. Clique em um alvo escolhido para refazer a seleção a partir dele.`
      : `Escolha até ${spell.targetCount} alvos para ${spell.name}. Clique no alvo novamente para retirar ou confirme a seleção no botão de ação.`;
  if (mode === "attack" && challengeSource)
    $("instruction").textContent = "Clique em um inimigo destacado para escolher o bloqueador. Confirme em Atacar quando terminar.";
  else if (mode === "attack" && Object.keys(challenges).length)
    $("instruction").textContent = `${Object.keys(challenges).length} desafio(s) escolhido(s). Clique no seu atacante para mudar o alvo ou confirme em Atacar.`;
  $("combat-detail").hidden = !battleView.title;
  $("combat-detail").textContent = battleView.detail;
  const enemyHeading =
    document.querySelector("#bot-deck").previousElementSibling;
  const myHeading = document.querySelector("#my-deck").previousElementSibling;
  enemyHeading.textContent = state.combat
    ? state.combat.owner === 1
      ? "⚔ BOT ATACANDO"
      : "🛡 BOT DEFENDENDO"
    : "CAMPO INIMIGO";
  myHeading.textContent = state.combat
    ? state.combat.owner === 0
      ? "⚔ VOCÊ ATACANDO"
      : "🛡 VOCÊ DEFENDENDO"
    : "SEU CAMPO";
  ArenaView.render(state, { mode, selected, busy, battleView });
  updateCombatLinks();
  for (const el of document.querySelectorAll(".board [data-combat-lane]")) {
    const emphasize = (on) => {
      for (const card of document.querySelectorAll(".board [data-combat-lane]"))
        card.classList.toggle(
          "combat-pair-focus",
          on && card.dataset.combatLane === el.dataset.combatLane,
        );
    };
    el.addEventListener("mouseenter", () => emphasize(true));
    el.addEventListener("mouseleave", () => emphasize(false));
    el.addEventListener("focus", () => emphasize(true));
    el.addEventListener("blur", () => emphasize(false));
  }
  DuelUI.render(state, busy, selected, {
    toggle(id) {
      selected.has(id) ? selected.delete(id) : selected.add(id);
      render();
    },
    confirm() {
      run(() => {
        E.mulligan(state, [...selected]);
        window.Campaign?.afterMulligan(state);
      });
    },
    inspect,
    render,
    blocks,
  });
  ArenaChrome.render(state);
}
function updateCombatLinks() {
  if (!state || $("game").hidden) return;
  const svg = $("combat-links");
  svg.replaceChildren();
  if (state.combat || mode === "attack") {
    const arena = document.querySelector(".arena").getBoundingClientRect();
    for (const [a, b] of Object.entries(state.combat ? blocks : challenges)) {
      const attacker = document.querySelector(`.board [data-id="${a}"]`),
        defender = document.querySelector(`.board [data-id="${b}"]`);
      if (!attacker || !defender) continue;
      const r = attacker.getBoundingClientRect(),
        d = defender.getBoundingClientRect(),
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${r.x + r.width / 2 - arena.x} ${r.y + r.height / 2 - arena.y} L ${d.x + d.width / 2 - arena.x} ${d.y + d.height / 2 - arena.y}`,
      );
      svg.append(path);
    }
  }
}
window.addEventListener("resize", () =>
  requestAnimationFrame(updateCombatLinks),
);
document.addEventListener("arena-layout-settled", updateCombatLinks);
function resetSelection() {
  attackDraft = null;
  mode = null;
  selected.clear();
  challenges = {};
  challengeSource = null;
  blocks = state?.combat ? { ...(state.combat.blocks || {}) } : {};
  blocker = null;
  spell = null;
  spellTargets = [];
}
let finishedState = null;
async function finish() {
  if (state.winner === null || finishedState === state) return;
  const endingState = state,
    epoch = motionEpoch;
  finishedState = state;
  window.CampaignUI?.recordResult(state);
  $("result-title").textContent =
    state.winner === "draw"
      ? "Empate"
      : state.winner === 0
        ? "Vitória"
        : "Derrota";
  $("result-copy").textContent =
    `Duelo encerrado na rodada ${state.round}. ${state.winner === "draw" ? "Os dois Nexus caíram." : state.winner === 0 ? "Seu Nexus resistiu." : "Experimente outro deck ou uma nova estratégia."}`;
  await DuelOutcome.play(endingState);
  if (epoch !== motionEpoch || endingState !== state) return;
  if (!$("result-dialog").open) $("result-dialog").showModal();
  DuelOutcome.reveal($("result-dialog"), state.winner);
}
function schedule() {
  clearTimeout(timer);
  if (state.winner !== null) {
    finish();
    return;
  }
  if (state.priority === 1 && state.phase !== "mulligan") {
    timer = setTimeout(() => run(() => E.bot(state)), 650);
  }
}
async function run(action) {
  if (busy) return;
  const epoch = motionEpoch;
  try {
    const before = ArenaMotion.snapshot(state);
    const prepared = attackDraft || (mode === "attack" ? [...selected] : null);
    const preparedChallenges = { ...challenges };
    const result = action();
    GameAudio.observe(before.state, state);
    document.body.classList.remove("peek-open");
    clearTimeout(peekTimer);
    busy = true;
    resetSelection();
    if (
      prepared &&
      state.phase === "main" &&
      state.priority === 0 &&
      state.winner === null
    ) {
      mode = "attack";
      selected = new Set(
        prepared.filter((id) =>
          state.players[0].board.some((c) => c.id === id),
        ),
      );
      challenges = Object.fromEntries(Object.entries(preparedChallenges).filter(([attacker, defender]) =>
        selected.has(attacker) && state.players[1].board.some(unit => unit.id === defender)));
    }
    render();
    save();
    await Promise.all([
      ArenaMotion.change(before, state, result),
      window.CardPresentation?.change(before, state, result),
    ]);
    if (epoch !== motionEpoch) return;
    await ChampionPresentation.change(before, state);
    if (epoch !== motionEpoch) return;
    busy = false;
    render();
    schedule();
  } catch (e) {
    busy = false;
    render();
    notify(e.message);
  }
}
function start(training = false, campaignEncounter = null, campaignDeck = null) {
  if (campaignEncounter) {
    try { window.CampaignUI.canStart(campaignEncounter, campaignDeck); }
    catch (error) { notify(error.message); return false; }
  }
  motionEpoch++;
  DuelOutcome.cancel();
  busy = false;
  ArenaMotion.cancel();
  ChampionPresentation.cancel();
  window.CardPresentation?.cancel();
  ArenaChrome.cancel();
  clearTimeout(timer);
  const choice = campaignDeck || $("deck").value;
  if (E.validateDeck(data.cards, data.decks[choice]).length) {
    notify("Monte um deck válido de 40 cartas antes de começar.");
    return;
  }
  const hero = data.decks[choice].find((code) => data.cards[code].champion);
  if (training && !hero) {
    notify("Seu deck precisa ter um campeão para usar o treino.");
    return;
  }
  const fixed = data.opponents.find((d) => d.id === $("opponent").value);
  let last = null;
  try {
    last = localStorage.getItem("lor-last-opponent");
  } catch {}
  const opponent = campaignEncounter
    ? { id: "campaign-" + campaignEncounter, name: Campaign.get(campaignEncounter).name, cards: Campaign.deck(campaignEncounter, data) }
    : fixed || ArenaDecks.pick(data.opponents, data.decks[choice], last);
  const other = opponent.id;
  const opponentCards = campaignEncounter ? opponent.cards : data.decks[other];
  try {
    localStorage.setItem("lor-last-opponent", other);
  } catch {}
  if (training)
    state = E.training(
      data.cards,
      data.decks[choice],
      opponentCards,
      Date.now(),
      hero,
      { faithful: true },
    );
  else
    state = E.create(
      data.cards,
      data.decks[choice],
      opponentCards,
      Date.now(),
      { faithful: true },
    );
  state.players[0].deckKey = choice;
  state.players[1].deckKey = other;
  state.players[0].deckName = ArenaDecks.playerName(data, state.players[0]);
  state.players[1].deckName = opponent.name;
  state.opponentKey = other;
  if (campaignEncounter) Campaign.prepare(state, campaignEncounter);
  ArenaView.prepare(state, [data.decks[choice], opponentCards]);
  showGame();
  save();
  return true;
}
function showGame() {
  ArenaView.enter(state);
  GameAudio.enter(state);
  document.body.classList.add("in-duel");
  resetSelection();
  $("welcome").hidden = true;
  $("campaign").hidden = true;
  $("game").hidden = false;
  render();
  schedule();
}
$("start").onclick = () => start(false);
$("train").onclick = () => start(true);
$("resume").onclick = () => {
  state = E.hydrate(structuredClone(saved), data.cards);
  showGame();
};
$("menu").onclick = () => {
  GameAudio.leave();
  motionEpoch++;
  DuelOutcome.cancel();
  busy = false;
  ArenaMotion.cancel();
  ChampionPresentation.cancel();
  window.CardPresentation?.cancel();
  ArenaChrome.cancel();
  document.body.classList.remove("in-duel", "peek-open", "journal-open");
  $("journal").setAttribute("aria-expanded", "false");
  clearTimeout(timer);
  if (state) save();
  $("welcome").hidden = false;
  $("welcome").classList.remove("choosing-duel");
  $("choose-duel").setAttribute("aria-expanded", "false");
  $("game").hidden = true;
  $("campaign").hidden = true;
};
$("help").onclick = () => $("help-dialog").showModal();
$("close-help").onclick = () => $("help-dialog").close();
$("cancel").onclick = () => {
  resetSelection();
  render();
};
$("attack").onclick = () => {
  if (mode === "attack") {
    const pickedChallenges = { ...challenges };
    run(() => E.attack(state, 0, [...selected], pickedChallenges));
  }
  else {
    mode = "attack";
    selected.clear();
    render();
  }
};
$("pass").onclick = () =>
  run(() =>
    spell && (spell.targetCount || 1) > 1
      ? E.play(state, 0, spell.id, [...spellTargets])
      : mode === "attack"
      ? E.attack(state, 0, [...selected], { ...challenges })
      : state.phase === "block"
        ? E.commitBlocks(state, 0, blocks)
        : E.pass(state, 0),
  );
$("again").onclick = () => {
  $("result-dialog").close();
  if (state?.campaign && Campaign.get(state.campaign.encounterId)) {
    const key = state.players[0].deckKey;
    if (data.decks[key]) start(false, state.campaign.encounterId, key);
    else { $("menu").click(); window.CampaignUI?.open(); }
  } else start();
};
$("view-result").onclick = () => {
  $("result-dialog").close();
  DuelOutcome.cancel();
};
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "runeterra-partida.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("beforeunload", () => {
  if (state) save();
});
function motionLabel() {
  const on = ArenaMotion.enabled;
  $("motion-toggle").textContent = !on
    ? "Efeitos: desligados"
    : ArenaMotion.reduced
      ? "Efeitos: reduzidos"
      : on
        ? "Efeitos: ativados"
        : "Efeitos: desligados";
  $("motion-toggle").setAttribute(
    "aria-pressed",
    String(on && !ArenaMotion.reduced),
  );
  $("motion-toggle").setAttribute("aria-label", $("motion-toggle").textContent);
  $("motion-toggle").title = $("motion-toggle").textContent + " · clique para alternar";
}
motionLabel();
$("motion-toggle").onclick = () => {
  ArenaMotion.toggle();
  if (!ArenaMotion.enabled) {
    ChampionPresentation.cancel();
    window.CardPresentation?.cancel();
    ArenaChrome.cancel();
  }
  if (state && !$("game").hidden) ArenaChrome.render(state);
  motionLabel();
};
function soundLabel() {
  const on = ArenaMotion.soundEnabled;
  $("sound-toggle").textContent = on ? "Som: ativado" : "Som: desligado";
  $("sound-toggle").setAttribute("aria-pressed", String(on));
  $("sound-toggle").setAttribute("aria-label", $("sound-toggle").textContent);
  $("sound-toggle").title = $("sound-toggle").textContent + " · clique para alternar";
}
soundLabel();
$("sound-toggle").onclick = () => {
  ArenaMotion.toggleSound();
  soundLabel();
};
$("choose-duel").onclick = () => {
  $("welcome").classList.add("choosing-duel");
  $("choose-duel").setAttribute("aria-expanded", "true");
  $("deck").focus({ preventScroll: true });
  $("duel-setup").scrollIntoView({ block: "start" });
};
$("back-to-modes").onclick = () => {
  $("welcome").classList.remove("choosing-duel");
  $("choose-duel").setAttribute("aria-expanded", "false");
  $("choose-duel").focus();
};
const moreMenu = document.querySelector(".header-more");
moreMenu.addEventListener("click", (event) => {
  if (event.target.closest("button")) moreMenu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && moreMenu.open) {
    moreMenu.open = false;
    moreMenu.querySelector("summary").focus();
  }
});
$("journal").onclick = () => {
  const on = document.body.classList.toggle("journal-open");
  $("journal").setAttribute("aria-expanded", String(on));
};
const field = $("my-board");
field.addEventListener("dragover", (event) => {
  if (!busy && state?.phase === "main" && state.priority === 0) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    field.classList.add("drop-ready");
  }
});
field.addEventListener("dragleave", () => field.classList.remove("drop-ready"));
field.addEventListener("drop", (event) => {
  event.preventDefault();
  field.classList.remove("drop-ready");
  document.body.classList.remove("dragging-card");
  const id = event.dataTransfer.getData("text/plain");
  const c = state?.players[0].hand.find((c) => c.id === id);
  if (c && !busy && E.playable(state, 0, c))
    clickCard(E.cardView(state, 0, c), "hand", 0);
});
for (const target of [
  $("enemy-board"),
  document.querySelector(".battle-line"),
]) {
  target.addEventListener("dragover", (event) => {
    if (document.body.classList.contains("dragging-attacker")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    document.body.classList.remove("dragging-attacker");
    const value = event.dataTransfer.getData("text/plain"),
      id = value.slice(7);
    if (
      !value.startsWith("attack:") ||
      busy ||
      state.phase !== "main" ||
      state.priority !== 0 ||
      !E.canAttack(state, 0) ||
      !state.players[0].board.some((c) => c.id === id)
    )
      return;
    mode = "attack";
    selected.add(id);
    render();
  });
}
window.CampaignBridge = {
  saved: () => saved,
  start: (id, deck) => start(false, id, deck),
  leave: () => $("menu").click(),
};
