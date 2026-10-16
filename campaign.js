(function (root) {
  "use strict";
  const content = typeof module !== "undefined" ? require("./campaign-data.js") : root.CAMPAIGN_DATA;
  const nodes = new Map(content.encounters.map(e => [e.id, e]));
  const get = id => nodes.get(id);
  const region = id => content.regions.find(r => r.id === id);
  const encounters = id => content.encounters.filter(e => e.region === id);
  const empty = () => ({ version: 1, selectedRegion: "demacia", completed: {} });
  function available(profile, id) {
    const e = get(id), done = profile.completed;
    return !!e && e.requires.every(key => Object.hasOwn(done, key)) &&
      (!e.requiresAny.length || e.requiresAny.some(key => Object.hasOwn(done, key)));
  }
  function normalize(value) {
    const p = empty();
    if (!value || value.version !== 1) return p;
    if (region(value.selectedRegion)?.playable) p.selectedRegion = value.selectedRegion;
    // Topological encounter order discards impossible boss-only/corrupt imports.
    for (const e of content.encounters) {
      const record = value.completed?.[e.id];
      if (record && Number.isInteger(record.bestRound) && record.bestRound > 0 && record.bestRound <= 10000 && available(p, e.id))
        p.completed[e.id] = { bestRound: record.bestRound };
    }
    return p;
  }
  function importProfile(json) {
    const value = JSON.parse(json);
    if (!value || value.version !== 1 || typeof value.completed !== "object" || !value.completed || Array.isArray(value.completed))
      throw Error("Este arquivo não é um progresso de campanha compatível.");
    return normalize(value);
  }
  function stats(profile) {
    const xp = Object.keys(profile.completed).reduce((sum, id) => sum + (get(id)?.xp || 0), 0);
    return { xp, level: 1 + Math.floor(xp / 100), next: 100 - xp % 100, cleared: Object.keys(profile.completed).length, total: nodes.size };
  }
  function mastery(profile, id) {
    const list = encounters(id), cleared = list.filter(e => Object.hasOwn(profile.completed, e.id)).length;
    return { cleared, total: list.length, percent: list.length ? Math.round(cleared / list.length * 100) : 0 };
  }
  const titles = p => content.regions.filter(r => r.playable && p.completed[r.id + "-boss"]).map(r => r.title);
  function complete(profile, id, winner, round) {
    const p = normalize(profile), e = get(id);
    if (!e || !available(p, id)) throw Error("Conclua um dos caminhos anteriores para enfrentar este encontro.");
    if (winner !== 0) return { profile: p, xp: 0, first: false };
    if (!Number.isInteger(round) || round < 1 || round > 10000) throw Error("Resultado de campanha inválido.");
    const first = !p.completed[id];
    p.completed[id] = { bestRound: Math.min(round, p.completed[id]?.bestRound || round) };
    return { profile: p, xp: first ? e.xp : 0, first };
  }
  function deck(id, data) {
    const e = get(id);
    const base = e && (content.decks[e.deck] || data.decks[e.deck]);
    if (!base) throw Error("Deck deste encontro indisponível.");
    let list = [...base];
    if (e.hero) return list;
    // Early encounters use real regional units instead of champions, at legal copy counts.
    const r = region(e.region);
    const pool = Object.values(data.cards).filter(c => c.collectible && !c.champion && c.code !== r.leader && c.type === "unit" && c.region === r.cardRegion);
    list = list.filter(code => !data.cards[code].champion && code !== region(e.region).leader);
    while (list.length < 40) {
      const counts = new Map();
      for (const code of list) counts.set(code, (counts.get(code) || 0) + 1);
      const targetCost = 1 + e.variant;
      let options = pool.filter(c => (counts.get(c.code) || 0) < 3);
      // Smaller regional catalogs (Shurima) can exhaust units at the three-copy limit.
      if (!options.length) options = Object.values(data.cards).filter(c => c.collectible && c.type === "spell" && c.region === r.cardRegion && (counts.get(c.code) || 0) < 3);
      options = options
        .sort((a, b) => Math.abs(a.cost - targetCost) - Math.abs(b.cost - targetCost) || a.code.localeCompare(b.code));
      if (!options.length) throw Error("Cartas insuficientes para este encontro.");
      list.push(options[0].code);
    }
    // Distinct alternative path: substitute up to three units with a different legal unit.
    if (e.suffix === "river") {
      const extra = pool.filter(c => !list.includes(c.code)).sort((a, b) => a.cost - b.cost || a.code.localeCompare(b.code))[e.region === "freljord" ? 1 : 0];
      if (extra) {
        for (let i = 0, n = 0; i < list.length && n < 3; i++) {
          if (data.cards[list[i]].type === "unit" && data.cards[list[i]].cost >= extra.cost) { list[i] = extra.code; n++; }
        }
      } else {
        const spell = Object.values(data.cards).filter(c => c.collectible && c.type === "spell" && c.region === r.cardRegion && list.filter(code => code === c.code).length < 3)
          .sort((a, b) => a.cost - b.cost || a.code.localeCompare(b.code))[0];
        const index = list.findLastIndex(code => data.cards[code].type === "unit");
        if (spell && index >= 0) list[index] = spell.code;
      }
    }
    return list;
  }
  function guaranteeOpening(state, e) {
    const p = state.players[1];
    const code = e.openingCard || e.champion;
    if (!code || p.hand.some(c => c.code === code)) return;
    const index = p.deck.findIndex(c => c.code === code);
    if (index < 0 || !p.hand.length) return;
    const old = p.hand[0];
    p.hand[0] = p.deck[index]; p.deck[index] = old;
  }
  const starters = [
    { id: "campaign-starter-aggro", role: "Agressivo", name: "Agressivo · Avanço de Noxus", encounter: "noxus-patrol" },
    { id: "campaign-starter-defense", role: "Defensivo", name: "Defensivo · Guarda de Demacia", encounter: "demacia-patrol" },
    { id: "campaign-starter-control", role: "Controle", name: "Controle · Névoa das Ilhas", encounter: "shadow-isles-patrol" },
  ];
  function rewardDeck(id, data) {
    const e = get(id);
    if (!e || !["elite", "boss"].includes(e.suffix)) return null;
    const r = region(e.region), boss = e.suffix === "boss";
    return {
      id: "campaign-reward-" + r.id + (boss ? "" : "-intermediate"),
      name: r.name + " · " + (boss ? r.boss : e.name),
      cards: deck(id, data),
    };
  }
  function playerDecks(profile, data) {
    const p = normalize(profile);
    return [
      ...starters.map(s => ({ id: s.id, role: s.role, name: s.name, cards: deck(s.encounter, data) })),
      ...content.encounters.filter(e => p.completed[e.id]).map(e => rewardDeck(e.id, data)).filter(Boolean),
    ];
  }
  function alliance(profile) {
    const p = normalize(profile), regions = content.regions.filter(r => r.playable);
    const completed = regions.filter(r => p.completed[r.id + "-boss"]);
    const other = regions.filter(r => completed.some(done => done.id !== r.id));
    const cleared = Math.max(0, ...other.map(r => mastery(p, r.id).cleared));
    return { unlocked: completed.length > 0 && cleared >= 3, completed: completed.length, cleared: Math.min(3, cleared), required: 3 };
  }
  // Cards for editing come exclusively from complete decks already unlocked.
  const ownedCards = (profile, data) => new Set(playerDecks(profile, data).flatMap(d => d.cards));
  function deckErrors(profile, list, data) {
    if (!Array.isArray(list)) return ["Escolha um deck da campanha."];
    const errors = [], owned = ownedCards(profile, data);
    if (list.some(code => !owned.has(code))) errors.push("Use apenas cartas dos decks conquistados na campanha.");
    const regions = new Set(list.map(code => data.cards[code]?.region));
    if (regions.size > (alliance(profile).unlocked ? 2 : 1)) errors.push(
      alliance(profile).unlocked ? "Use até duas regiões por deck." : "Aliança entre Regiões bloqueada: vença um chefe e 3 fases distintas de outra região.",
    );
    return errors;
  }
  function prepare(state, id) {
    const e = get(id);
    if (!e) throw Error("Encontro desconhecido.");
    state.campaign = { version: 1, encounterId: id };
    state.players[1].spellMana = e.spellMana || 0;
    guaranteeOpening(state, e);
  }
  function afterMulligan(state) {
    const e = get(state.campaign?.encounterId);
    if (e) guaranteeOpening(state, e);
  }
  const api = { empty, get, region, encounters, available, normalize, importProfile, stats, mastery, titles, complete, deck, prepare, afterMulligan, rewardDeck, playerDecks, alliance, ownedCards, deckErrors };
  if (typeof module !== "undefined") module.exports = api;
  else root.Campaign = api;
})(typeof window === "undefined" ? globalThis : window);
