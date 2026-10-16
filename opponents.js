/* Locally generated legal decks; these are not lists supplied by Riot. */
(function (root) {
  const E =
    typeof module !== "undefined" ? require("./engine.js") : root.Engine;
  function fingerprint(cards) {
    const counts = {};
    for (const c of cards) counts[c] = (counts[c] || 0) + 1;
    return Object.entries(counts)
      .sort()
      .map(([c, n]) => c + ":" + n)
      .join("|");
  }
  function describe(catalog, codes, regionNames = {}) {
    const counts = new Map(), regions = new Map();
    for (const code of codes) {
      const card = catalog[code];
      if (!card) continue;
      counts.set(code, (counts.get(code) || 0) + 1);
      regions.set(card.region, (regions.get(card.region) || 0) + 1);
    }
    const ranked = [...counts].sort((a, b) => b[1]-a[1] || catalog[a[0]].name.localeCompare(catalog[b[0]].name, "pt-BR")),
      heroes = ranked.filter(([code]) => catalog[code].champion),
      units = ranked.filter(([code]) => catalog[code].type === "unit"),
      featured = heroes.length ? heroes.slice(0, 2) : (units.length ? units : ranked).slice(0, 1),
      title = [...new Set(featured.map(([code]) => catalog[code].name))].join(" e "),
      places = [...regions].sort((a, b) => b[1]-a[1] || a[0].localeCompare(b[0]))
        .map(([region]) => regionNames[region] || region).join(" / ");
    return title ? title + " · " + places : "Runeterra · Sem cartas restantes";
  }
  function playerName(data, player, key = player.deckKey) {
    const meaningful = value => typeof value === "string" && value.trim() &&
      !/^(seu deck|meu deck|meu novo deck|deck importado|adversario|bot|deck)$/.test(value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) &&
      !/^Gerado\s*·/i.test(value.trim());
    if (meaningful(player.deckName)) return player.deckName.trim();
    const known = id => data.deckNames?.[id] || data.deckTitles?.[id];
    if (key && meaningful(known(key))) return known(key);
    const cards = ["deck", "hand", "board"].flatMap(zone => player[zone] || []).map(card => card.code),
      own = fingerprint(cards), match = Object.entries(data.decks).find(([, list]) => fingerprint(list) === own);
    if (match && meaningful(known(match[0]))) return known(match[0]);
    return describe(data.cards, cards, data.regionNames);
  }
  function generate(catalog, names = {}) {
    const cards = Object.values(catalog).filter((c) => c.collectible),
      regions = [...new Set(cards.map((c) => c.region))].sort(),
      decks = [],
      seen = new Set(), titleCounts = new Map();
    for (let a = 0; a < regions.length; a++)
      for (let b = a; b < regions.length; b++) {
        const pair = [...new Set([regions[a], regions[b]])],
          pool = cards.filter((c) => pair.includes(c.region));
        if (
          pool.length < 14 ||
          pool.filter((c) => c.type === "unit").length * 3 < 20
        )
          continue;
        for (let variant = 0; variant < 12; variant++) {
          let seed = (a + 1) * 100003 + (b + 1) * 3001 + variant * 1177 + 21;
          const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          const list = [],
            counts = {};
          let champions = 0,
            units = 0;
          const style = variant % 3,
            unitTarget = style === 0 ? 29 : style === 1 ? 22 : 26;
          while (list.length < 40) {
            let candidates = pool.filter(
              (c) =>
                (counts[c.code] || 0) < 3 && (!c.champion || champions < 6),
            );
            const preferred = candidates.filter((c) =>
              units < unitTarget ? c.type === "unit" : c.type === "spell",
            );
            if (preferred.length) candidates = preferred;
            if (!candidates.length) break;
            candidates = candidates
              .map((c) => ({
                c,
                score:
                  random() * 7 -
                  (style === 0
                    ? c.cost * 0.25
                    : style === 1
                      ? Math.abs(c.cost - 4) * 0.15
                      : 0),
              }))
              .sort((x, y) => y.score - x.score);
            const c = candidates[0].c;
            list.push(c.code);
            counts[c.code] = (counts[c.code] || 0) + 1;
            if (c.type === "unit") units++;
            if (c.champion) champions++;
          }
          const actual = [...new Set(list.map((code) => catalog[code].region))];
          const key = fingerprint(list);
          if (
            units < 20 ||
            actual.length !== pair.length ||
            seen.has(key) ||
            E.validateDeck(catalog, list).length
          )
            continue;
          seen.add(key);
          const base = describe(catalog, list, names) + " · " + ["Pressão", "Controle", "Equilíbrio"][style],
            number = (titleCounts.get(base) || 0) + 1;
          titleCounts.set(base, number);
          decks.push({
            id: `auto_${a}_${b}_${variant}`,
            name: base + (number > 1 ? " · " + number : ""),
            cards: list,
            origin: "generated",
          });
        }
      }
    return decks;
  }
  function pick(pool, player, last, random = Math.random) {
    const own = fingerprint(player);
    let candidates = pool.filter((d) => fingerprint(d.cards) !== own);
    if (!candidates.length) candidates = [...pool];
    const fresh = candidates.filter((d) => d.id !== last);
    if (fresh.length) candidates = fresh;
    if (!candidates.length) throw Error("Nenhum deck adversário disponível.");
    return candidates[
      Math.min(
        candidates.length - 1,
        Math.max(0, Math.floor(random() * candidates.length)),
      )
    ];
  }
  const api = { generate, pick, fingerprint, describe, playerName };
  if (typeof module !== "undefined") module.exports = api;
  else {
    root.ArenaDecks = api;
    const data = root.CARD_DATA;
    data.deckTitles = { demacia: "Vanguarda de Demacia · Garen", noxus: "Legião de Noxus · Darius", ...data.deckTitles };
    const generated = generate(data.cards, data.regionNames);
    data.generatedDecks = generated;
    for (const d of generated) {
      data.decks[d.id] = d.cards;
      data.deckTitles[d.id] = d.name;
    }
    data.opponents = Object.entries(data.decks).map(([id, cards]) => ({
      id,
      cards,
      name:
        data.deckTitles[id] ||
        describe(data.cards, cards, data.regionNames),
    }));
  }
})(typeof window === "undefined" ? globalThis : window);
