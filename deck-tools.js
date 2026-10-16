(function (root) {
  const E =
    typeof module !== "undefined" ? require("./engine.js") : root.Engine;
  const normalize = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  function filter(catalog, f = {}) {
    return Object.values(catalog)
      .filter(
        (c) =>
          (f.includeGenerated || c.collectible) &&
          (!f.query ||
            normalize(c.code + " " + c.name + " " + c.text).includes(normalize(f.query))) &&
          (!f.region ||
            c.region === f.region ||
            c.regions?.includes(f.region)) &&
          (!f.type ||
            (f.type === "champion"
              ? c.champion
              : f.type === "follower"
                ? c.type === "unit" && !c.champion
                : c.type === f.type)) &&
          (!f.cost ||
            (f.cost === "7+" ? c.cost >= 7 : c.cost === Number(f.cost))),
      )
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "pt-BR"));
  }
  function stats(catalog, deck) {
    const curve = Array(8).fill(0),
      regions = new Set();
    let champions = 0,
      units = 0,
      spells = 0, landmarks = 0, equipment = 0;
    for (const code of deck) {
      const c = catalog[code];
      if (!c) continue;
      curve[Math.min(7, c.cost)]++;
      regions.add(c.region);
      if (c.champion) champions++;
      if (c.type === "unit") units++;
      else if (c.type === "spell") spells++;
      else if (c.type === "landmark") landmarks++;
      else if (c.type === "equipment") equipment++;
    }
    return { curve, regions: [...regions].sort(), champions, units, spells, landmarks, equipment };
  }
  function read(catalog, text) {
    const payload = JSON.parse(text);
    if (payload?.format !== "lor-offline-deck-v1")
      throw Error("Use um arquivo de deck exportado por este jogo.");
    const errors = E.validateDeck(catalog, payload.cards);
    if (errors.length) throw Error(errors.join(" "));
    return {
      name: String(payload.name || "Deck importado")
        .trim()
        .slice(0, 48),
      cards: [...payload.cards],
    };
  }
  const api = { filter, stats, read };
  if (typeof module !== "undefined") module.exports = api;
  else root.DeckTools = api;
})(typeof window === "undefined" ? globalThis : window);
