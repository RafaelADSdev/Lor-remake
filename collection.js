/* Offline collection, deck composition and named deck library. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    data = window.CARD_DATA,
    E = window.Engine,
    D = window.DeckTools;
  const catalog = { ...window.OFFICIAL_CATALOG, ...data.cards };
  const newCodes = new Set(data.catalogInfo?.added || []);
  const needsRules = cards => [...new Set(cards.filter(code => !data.cards[code]?.collectible))];
  const KEY = "runeterra-custom-deck-v1",
    LIBRARY = "runeterra-deck-library-v1",
    ACTIVE = "runeterra-active-deck-v1",
    DRAFT = "runeterra-deck-draft-v1";
  let draft = [],
    campaignEditing = false,
    catalogPage = 0,
    library = [],
    editing = "",
    pending = null;
  data.deckNames = {
    ...data.deckTitles,
    demacia: "Vanguarda de Demacia · Garen",
    noxus: "Legião de Noxus · Darius",
  };
  const name = () =>
    $("deck-name").value.trim() ||
    ArenaDecks.describe(catalog, draft, data.regionNames);
  const titleFor = (cards, title) =>
    ArenaDecks.playerName({ ...data, cards: catalog }, {
      deckName: title,
      deck: cards.map((code) => ({ code })),
    });
  function register(key, cards, title) {
    title = titleFor(cards, title);
    data.decks[key] = [...cards];
    data.deckNames[key] = title;
    let option = [...$("deck").options].find((o) => o.value === key);
    if (!option) {
      option = document.createElement("option");
      option.value = key;
      $("deck").append(option);
    }
    option.textContent = title;
    if (data.featuredDecks?.includes(key)) {
      let group = document.querySelector('#deck optgroup[label="Novos decks"]');
      if (!group) { group = document.createElement("optgroup"); group.label = "Novos decks"; $("deck").prepend(group); }
      group.append(option);
    }
  }
  for (const [key, title] of Object.entries(data.deckTitles || {}))
    register(key, data.decks[key], title);
  for (const key of data.featuredDecks || [])
    $("collection-preset").append(new Option(data.deckNames[key], key));
  for (const d of data.opponents)
    $("opponent").append(new Option(d.name, d.id));
  $("opponent-summary").textContent =
    `${data.opponents.length} decks disponíveis para o bot. No sorteio, evita espelho e o último adversário.`;
  const catalogTotal = D.filter(data.cards).length;
  const version = document.querySelector(".welcome-version");
  if (version) version.textContent = `Arena v0.32 · Campanha de Runeterra · ${Object.values(catalog).filter(c => c.collectible).length} cartas na coleção · ${catalogTotal} para duelo · ${data.opponents.length} adversários`;
  function regionOptions() {
    const old = $("card-region").value,
      catalog =
        ["playable", "new"].includes($("catalog-source").value)
          ? data.cards
          : window.OFFICIAL_CATALOG;
    $("card-region").replaceChildren(new Option("Todas", ""));
    for (const region of [
      ...new Set(
        Object.values(catalog).flatMap((c) => c.regions || [c.region]),
      ),
    ]
      .filter(Boolean)
      .sort())
      $("card-region").append(
        new Option(data.regionNames?.[region] || region, region),
      );
    if ([...$("card-region").options].some((o) => o.value === old))
      $("card-region").value = old;
  }
  regionOptions();
  $("catalog-size").textContent = Object.values(catalog).filter(c => c.collectible).length;
  $("duel-catalog-size").textContent = catalogTotal;
  function libraryMenu() {
    $("saved-decks").replaceChildren(new Option("Novo deck", ""));
    for (const record of library) {
      const title = titleFor(record.cards, record.name);
      const missing = needsRules(record.cards), key = "saved_" + record.id;
      $("saved-decks").append(new Option(title + (missing.length ? " · Regras pendentes" : ""), record.id));
      if (!missing.length) register(key, record.cards, title);
      else {
        [...$("deck").options].find(option => option.value === key)?.remove();
        delete data.decks[key]; delete data.deckNames[key];
      }
    }
    $("saved-decks").value = editing;
  }
  try {
    const records = JSON.parse(localStorage.getItem(LIBRARY));
    if (Array.isArray(records))
      library = records
        .slice(0, 50)
        .filter(
          (r) =>
            r &&
            typeof r.id === "string" &&
            /^[a-z0-9-]+$/i.test(r.id) &&
            typeof r.name === "string" &&
            !E.validateDeck(catalog, r.cards).length,
        )
        .map((r) => ({
          id: r.id,
          name: r.name.slice(0, 48),
          cards: [...r.cards],
        }));
    const legacy = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(legacy) && !E.validateDeck(data.cards, legacy).length)
      register("custom", legacy, "Meu deck");
    const active = library.find((r) => r.id === localStorage.getItem(ACTIVE));
    if (active && !needsRules(active.cards).length) {
      register("custom", active.cards, active.name);
      $("deck").value = "custom";
    }
    const savedDraft = JSON.parse(localStorage.getItem(DRAFT));
    if (
      savedDraft &&
      Array.isArray(savedDraft.cards) &&
      savedDraft.cards.length <= 40 &&
      savedDraft.cards.every((c) => catalog[c]?.collectible) &&
      !E.validateDeck(catalog, savedDraft.cards).some(
        (e) => !e.includes("40 cartas"),
      )
    )
      pending = savedDraft;
  } catch {}
  libraryMenu();
  function summary() {
    const deck = data.decks[$("deck").value] || [],
      heroes = [...new Set(deck.filter((code) => data.cards[code].champion))];
    $("deck-summary").textContent =
      `${deck.length} cartas · ` +
      (heroes.length
        ? heroes
            .map(
              (code) =>
                `${data.cards[code].name} ×${deck.filter((c) => c === code).length}`,
            )
            .join(" · ")
        : "Sem campeão");
    const trainingName = heroes.length ? data.cards[heroes[0]].name : null;
    const trainingArrow = document.createElement("span");
    trainingArrow.textContent = "→";
    trainingArrow.setAttribute("aria-hidden", "true");
    $("train").replaceChildren(
      document.createTextNode(
        trainingName ? "Treinar com " + trainingName : "Treinar invocação",
      ),
      trainingArrow,
    );
    $("training-description").textContent = trainingName
      ? "Comece com " + trainingName + " na mão e mana para invocá-lo."
      : "Pratique a invocação de um campeão com mana disponível.";
    // Use the selected deck's real art and cards, including saved custom decks.
    const unique = [...new Set(deck)],
      featured = data.cards[heroes[0] || unique[0]],
      title = data.deckNames[$("deck").value] || "Meu deck";
    if (featured) {
      $("welcome-champion-art").src = featured.image;
      $("welcome-champion-name").textContent = featured.name;
      $("welcome-region").textContent =
        data.regionNames?.[featured.region] || featured.region;
    }
    $("welcome-deck-name").textContent = title.split(" · ")[0];
    $("welcome-deck-cards").replaceChildren(
      ...[...heroes, ...unique.filter((code) => !heroes.includes(code))]
        .slice(0, 3)
        .map((code) => {
          const image = document.createElement("img");
          image.src = data.cards[code].portrait;
          image.alt = data.cards[code].name;
          image.draggable = false;
          image.width = 98;
          image.height = 150;
          return image;
        }),
    );
  }
  function remember() {
    pending = { cards: [...draft], name: name(), id: editing };
    try {
      localStorage.setItem(DRAFT, JSON.stringify(pending));
    } catch {}
  }
  function inspect(c) {
    const root = $("builder-preview"),
      img = document.createElement("img"),
      text = document.createElement("div");
    const title = document.createElement("h3"),
      detail = document.createElement("p");
    img.src = c.portrait;
    img.alt = c.name;
    title.textContent = `${c.name} · ${c.cost} mana`;
    const type = c.champion
      ? "Campeão"
      : {
          unit: "Seguidor",
          spell: "Feitiço",
          landmark: "Monumento",
          equipment: "Equipamento",
          ability: "Habilidade",
          trap: "Armadilha",
        }[c.type] || c.type;
    const status = !c.collectible
      ? "Carta gerada: não entra nos decks; é criada durante a partida. "
      : !data.cards[c.code]?.collectible
        ? "Na sua coleção. Pode entrar nos decks salvos; habilidades ainda sem regras de duelo. "
        : "Jogável no duelo contra o bot. ";
    detail.textContent = `${status}${type} · ${(c.regions || [c.region]).map((r) => data.regionNames?.[r] || r).join(" / ")}. ${c.text || "Unidade sem habilidade adicional."}${c.champion && c.levelText ? " Evolução: " + c.levelText : ""}`;
    text.append(title, detail);
    root.replaceChildren(img, text);
    const effects = window.CardEffects?.describe(c.code) || [];
    const videos = (window.CINEMATIC_LIBRARY || []).filter(entry =>
      [...(entry.codes || []), ...(entry.championCodes || [])].includes(c.code));
    if (effects.length || videos.length) {
      const preview = document.createElement("button");
      preview.className = "animation-card-preview";
      preview.textContent = "Ver animações da carta";
      preview.onclick = () => window.AnimationGallery?.open({ code: c.code });
      text.append(preview);
    }
  }
  function adjust(code, delta) {
    if (!catalog[code]?.collectible) return;
    const n = draft.filter((c) => c === code).length;
    if (delta > 0 && n < 3 && draft.length < 40) draft.push(code);
    if (delta < 0 && n) draft.splice(draft.indexOf(code), 1);
    remember();
    render();
  }
  function control(label, text, disabled, handler) {
    const button = document.createElement("button");
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.disabled = disabled;
    button.onclick = handler;
    return button;
  }
  function render() {
    const focused = document.activeElement?.getAttribute("aria-label");
    const stats = D.stats(catalog, draft),
      counts = {};
    for (const code of draft) counts[code] = (counts[code] || 0) + 1;
    const source = $("catalog-source").value;
    const campaignCards = campaignEditing ? window.CampaignUI.ownedCards() : null;
    const filtered = D.filter(
      source === "new" ? Object.fromEntries(Object.entries(data.cards).filter(([code]) => newCodes.has(code))) : source === "playable" ? data.cards : catalog,
      {
        includeGenerated: source === "all",
        query: $("card-search").value,
        region: $("card-region").value,
        type: $("card-type").value,
        cost: $("card-cost").value,
      },
    ).filter(c => !campaignCards || campaignCards.has(c.code));
    const pages = Math.max(1, Math.ceil(filtered.length / 48));
    catalogPage = Math.min(catalogPage, pages - 1);
    const choices =
      ["playable", "new"].includes(source)
        ? filtered
        : filtered.slice(catalogPage * 48, catalogPage * 48 + 48);
    $("collection-count").textContent =
      campaignEditing ? `${filtered.length} cartas dos decks conquistados na campanha · Até duas regiões após liberar a Aliança entre Regiões`
      : ["playable", "new"].includes(source)
        ? `${filtered.length} de ${catalogTotal} cartas jogáveis · selecione a arte para ver detalhes`
        : `${filtered.length} cartas na coleção · ${catalogTotal} disponíveis para duelo · monte e salve seus decks aqui`;
    $("catalog-pagination").hidden = ["playable", "new"].includes(source);
    $("catalog-page-info").textContent =
      `Página ${catalogPage + 1} de ${pages}`;
    $("catalog-previous").disabled = catalogPage === 0;
    $("catalog-next").disabled = catalogPage >= pages - 1;
    const root = $("collection-list");
    root.replaceChildren();
    for (const c of choices) {
      const row = document.createElement("div");
      row.className = "collection-row";
      row.dataset.code = c.code;
      if (c.champion) row.classList.add("collection-champion");
      const usable = !!c.collectible, ready = !!data.cards[c.code]?.collectible;
      if (!ready) row.classList.add("collection-unavailable");
      const art = document.createElement("button"),
        img = document.createElement("img");
      art.className = "collection-art";
      art.setAttribute("aria-label", "Ver detalhes de " + c.name);
      img.src = c.portrait;
      img.alt = c.name;
      art.append(img);
      if (newCodes.has(c.code) && ready) {
        const label = document.createElement("span"); label.className = "collection-new-label"; label.textContent = "NOVA"; art.append(label);
      }
      art.onclick = () => inspect(c);
      const controls = document.createElement("div"),
        count = document.createElement("span");
      controls.className = "collection-controls";
      count.className = "copy-count";
      count.textContent = usable ? (counts[c.code] || 0) + "/3" + (ready ? "" : " · Pendente") : "Gerada";
      controls.append(
        control("Remover " + c.name, "−", !counts[c.code], () =>
          adjust(c.code, -1),
        ),
        count,
        control(
          "Adicionar " + c.name,
          "+",
          !usable ||
            counts[c.code] >= 3 ||
            draft.length >= 40 ||
            (c.champion && stats.champions >= 6) ||
            (!stats.regions.includes(c.region) && stats.regions.length >= 2),
          () => adjust(c.code, 1),
        ),
      );
      row.append(art, controls);
      root.append(row);
    }
    if (!choices.length) {
      const p = document.createElement("p");
      p.className = "collection-empty";
      p.textContent = "Nenhuma carta encontrada. Ajuste a busca ou os filtros.";
      root.append(p);
    }
    $("deck-counter").textContent =
      `${draft.length}/40 cartas · ${stats.champions}/6 campeões`;
    $("deck-regions").textContent = stats.regions.length
      ? stats.regions.map((r) => data.regionNames?.[r] || r).join(" + ")
      : "Selecione até duas regiões";
    $("deck-composition").textContent =
      `${stats.champions} campeões · ${stats.units - stats.champions} seguidores · ${stats.spells} feitiços` +
      (stats.landmarks ? ` · ${stats.landmarks} monumentos` : "") + (stats.equipment ? ` · ${stats.equipment} equipamentos` : "");
    const curve = $("mana-curve");
    curve.replaceChildren();
    stats.curve.forEach((n, i) => {
      const bin = document.createElement("div"),
        amount = document.createElement("b"),
        bar = document.createElement("span"),
        cost = document.createElement("small");
      amount.textContent = n;
      cost.textContent = i === 7 ? "7+" : i;
      bar.style.height = `${Math.max(2, (n / Math.max(1, ...stats.curve)) * 48)}px`;
      bin.setAttribute("aria-label", `${cost.textContent} mana: ${n} cartas`);
      bin.append(amount, bar, cost);
      curve.append(bin);
    });
    const list = $("deck-list");
    list.replaceChildren();
    for (const c of D.filter(catalog).filter((c) => counts[c.code])) {
      const row = document.createElement("div");
      row.className = "deck-card-row";
      row.dataset.code = c.code;
      const cost = document.createElement("b"),
        title = document.createElement("button"),
        amount = document.createElement("span");
      cost.className = "deck-card-cost";
      cost.textContent = c.cost;
      title.textContent = (c.champion ? "★ " : "") + c.name;
      title.onclick = () => inspect(c);
      amount.textContent = "×" + counts[c.code];
      row.append(
        cost,
        title,
        amount,
        control("Retirar do deck: " + c.name, "−", false, () =>
          adjust(c.code, -1),
        ),
      );
      list.append(row);
    }
    if (!draft.length)
      list.textContent = "Seu deck está vazio. Adicione cartas da coleção.";
    const errors = [...E.validateDeck(catalog, draft), ...(campaignEditing ? window.CampaignUI.deckErrors(draft) : [])], missing = needsRules(draft);
    $("deck-error").textContent = errors.length
      ? errors.join(" ")
      : missing.length ? `Deck pronto para salvar · ${missing.length} carta(s) ainda sem regras de duelo.` : "Deck pronto para jogar.";
    $("save-deck").textContent = missing.length ? "Salvar deck" : "Salvar e usar deck";
    $("save-deck").disabled = errors.length > 0;
    $("export-deck").disabled = errors.length > 0;
    if (focused)
      [...document.querySelectorAll("#collection-dialog button")]
        .find((b) => b.getAttribute("aria-label") === focused && !b.disabled)
        ?.focus({ preventScroll: true });
  }
  function load(cards, title, id = "") {
    draft = [...cards];
    editing = id;
    $("deck-name").value = title;
    $("saved-decks").value = editing;
    render();
  }
  function fromMenu() {
    const key = $("deck").value;
    const record = library.find(
      (r) =>
        "saved_" + r.id === key ||
        (key === "custom" &&
          JSON.stringify(r.cards) === JSON.stringify(data.decks.custom)),
    );
    load(
      data.decks[key] || [],
      data.deckNames[key] || "Meu deck",
      record?.id || "",
    );
  }
  $("deck").addEventListener("change", summary);
  summary();
  $("build-deck").onclick = () => {
    campaignEditing = false;
    if (pending)
      load(
        pending.cards,
        String(pending.name || "Meu deck").slice(0, 48),
        library.some((r) => r.id === pending.id) ? pending.id : "",
      );
    else fromMenu();
    $("collection-dialog").showModal();
  };
  $("close-collection").onclick = () => $("collection-dialog").close();
  window.DeckCollection = {
    openDeck(key, options = {}) {
      if (!data.decks[key]) return;
      campaignEditing = !!options.campaign;
      const record = library.find(r => "saved_" + r.id === key || (key === "custom" && JSON.stringify(r.cards) === JSON.stringify(data.decks.custom)));
      load(data.decks[key], data.deckNames[key] || "Meu deck", record?.id || "");
      $("collection-dialog").showModal();
    },
  };
  $("clear-deck").onclick = () => {
    draft = [];
    remember();
    render();
  };
  $("new-deck").onclick = () => {
    load([], "Meu novo deck");
    remember();
  };
  $("load-preset").onclick = () => {
    fromMenu();
    remember();
  };
  $("load-featured-deck").onclick = () => {
    const key = $("collection-preset").value;
    load(data.decks[key], data.deckNames[key]); remember();
  };
  $("saved-decks").onchange = () => {
    const record = library.find((r) => r.id === $("saved-decks").value);
    load(
      record?.cards || [],
      record?.name || "Meu novo deck",
      record?.id || "",
    );
    remember();
  };
  for (const id of [
    "card-search",
    "card-region",
    "card-type",
    "card-cost",
    "catalog-source",
  ])
    $(id).addEventListener("input", () => {
      catalogPage = 0;
      if (id === "catalog-source") regionOptions();
      render();
    });
  $("catalog-previous").onclick = () => {
    catalogPage--;
    render();
    $("collection-list").scrollTop = 0;
  };
  $("catalog-next").onclick = () => {
    catalogPage++;
    render();
    $("collection-list").scrollTop = 0;
  };
  $("deck-name").oninput = remember;
  $("save-deck").onclick = () => {
    const errors = [...E.validateDeck(catalog, draft), ...(campaignEditing ? window.CampaignUI.deckErrors(draft) : [])];
    if (errors.length) {
      $("deck-error").textContent = errors.join(" ");
      return;
    }
    if (!editing && library.length >= 50) {
      $("deck-error").textContent =
        "Biblioteca cheia: selecione um deck salvo para editar.";
      return;
    }
    const record = {
      id:
        editing ||
        Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      name: name(),
      cards: [...draft],
    };
    const index = library.findIndex((r) => r.id === record.id);
    if (index < 0) library.push(record);
    else library[index] = record;
    editing = record.id;
    libraryMenu();
    const ready = !needsRules(draft).length;
    if (ready) { register("custom", draft, record.name); $("deck").value = "custom"; summary(); }
    try {
      localStorage.setItem(LIBRARY, JSON.stringify(library));
      if (ready) { localStorage.setItem(KEY, JSON.stringify(draft)); localStorage.setItem(ACTIVE, record.id); }
      else if (localStorage.getItem(ACTIVE) === record.id) {
        localStorage.removeItem(KEY); localStorage.removeItem(ACTIVE);
        [...$("deck").options].find(option => option.value === "custom")?.remove();
        delete data.decks.custom; delete data.deckNames.custom;
        $("deck").value = "demacia"; summary();
      }
      localStorage.removeItem(DRAFT);
      pending = null;
    } catch {
      refreshDeckFilter(true);
      $("deck-error").textContent =
        "Deck disponível nesta sessão. O navegador não permitiu salvar; exporte o arquivo para guardar.";
      return;
    }
    refreshDeckFilter(true);
    if (ready) {
      $("collection-dialog").close();
      document.dispatchEvent(new CustomEvent("lor-deck-saved", { detail: { key: "custom" } }));
    }
    else $("deck-error").textContent = "Deck salvo em Meus decks. Aguarda implementação das habilidades para entrar no duelo.";
  };
  $("export-deck").onclick = () => {
    if (E.validateDeck(catalog, draft).length) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { format: "lor-offline-deck-v1", name: name(), cards: draft },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "meu-deck-lor-offline.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("import-deck").onclick = () => $("deck-file").click();
  $("deck-file").onchange = async () => {
    const file = $("deck-file").files[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw Error("Arquivo muito grande para um deck.");
      const record = D.read(catalog, await file.text());
      load(record.cards, record.name);
      remember();
    } catch (error) {
      $("deck-error").textContent =
        "Não foi possível importar: " + error.message;
    }
    $("deck-file").value = "";
  };
  const exampleDecks = [
    {
      name: "Exemplo Riot · Demacia / Freljord",
      code: "CEAAEBYBAEDRMGREFYZDKCABAABQMCYSCQNB2JYCAQAQABYMFIWAMAIBBEKCAIRHFE",
      source: "https://developer.riotgames.com/docs/lor#deck-codes",
    },
    {
      name: "Exemplo Riot · Ionia / Piltover e Zaun",
      code: "CEAAECABAQJRWHBIFU2DOOYIAEBAMCIMCINCILJZAICACBANE4VCYBABAILR2HRL",
      source: "https://github.com/RiotGames/LoRDeckCodes",
    },
  ];
  let references = [],
    codeCards = null;
  try {
    const stored = JSON.parse(localStorage.getItem("lor-deck-references-v1"));
    if (Array.isArray(stored))
      references = stored
        .slice(0, 200)
        .filter(
          (r) =>
            r &&
            typeof r.code === "string" &&
            r.code.length <= 2048 &&
            typeof r.name === "string",
        );
  } catch {}
  function referenceMenu() {
    $("deck-code-examples").replaceChildren(
      new Option("Selecione uma lista", ""),
    );
    [...exampleDecks, ...references].forEach((r, i) =>
      $("deck-code-examples").append(new Option(r.name, String(i))),
    );
  }
  function readCode() {
    $("deck-code-lines").replaceChildren();
    codeCards = null;
    $("use-deck-code").disabled = true;
    $("save-deck-reference").disabled = true;
    try {
      const cards = RiotDeckCode.decode($("riot-deck-code").value),
        counts = {};
      for (const c of cards) counts[c] = (counts[c] || 0) + 1;
      const unavailable = cards.filter(
          (c) => !data.cards[c]?.collectible,
        ).length,
        unknown = cards.filter((c) => !window.OFFICIAL_CATALOG[c]).length;
      const errors = E.validateDeck(catalog, cards);
      for (const [code, n] of Object.entries(counts).sort(
        (a, b) =>
          (window.OFFICIAL_CATALOG[a[0]]?.cost || 0) -
          (window.OFFICIAL_CATALOG[b[0]]?.cost || 0),
      )) {
        const c = window.OFFICIAL_CATALOG[code],
          row = document.createElement("p");
        row.textContent = `${n}× ${c?.name || code} · ${data.cards[code]?.collectible ? "Jogável" : c ? "Ainda sem regras de duelo" : "Fora do snapshot atual"}`;
        $("deck-code-lines").append(row);
      }
      $("deck-code-status").textContent =
        `${cards.length} cartas · ${unavailable} cópia(s) ainda sem regras · ${unknown} fora do snapshot. ` +
        (errors.length
          ? "Revise a composição antes de usar no editor."
          : unavailable ? "Pronto para editar e salvar na coleção. Há regras de duelo pendentes." : "Pronto para usar no duelo.");
      codeCards = cards;
      $("use-deck-code").disabled = errors.length > 0;
      $("save-deck-reference").disabled = cards.length !== 40;
    } catch (error) {
      $("deck-code-status").textContent =
        "Não foi possível ler: " + error.message;
    }
  }
  function openCode(cards) {
    if (cards) {
      $("riot-deck-code").value = RiotDeckCode.encode(cards);
      $("deck-code-name").value = name();
      readCode();
    }
    $("deck-code-dialog").showModal();
  }
  referenceMenu();
  $("open-deck-code").onclick = () => openCode();
  $("export-deck-code").onclick = () => {
    if (!E.validateDeck(catalog, draft).length) openCode(draft);
    else
      $("deck-error").textContent =
        "Complete um deck válido antes de exportar o código.";
  };
  $("close-deck-code").onclick = () => $("deck-code-dialog").close();
  $("read-deck-code").onclick = readCode;
  $("riot-deck-code").oninput = () => {
    codeCards = null;
    $("use-deck-code").disabled = true;
    $("save-deck-reference").disabled = true;
  };
  $("deck-code-examples").onchange = () => {
    const record = [...exampleDecks, ...references][
      Number($("deck-code-examples").value)
    ];
    if ($("deck-code-examples").value === "" || !record) return;
    $("riot-deck-code").value = record.code;
    $("deck-code-name").value = record.name.slice(0, 48);
    readCode();
  };
  $("use-deck-code").onclick = () => {
    if (!codeCards || E.validateDeck(catalog, codeCards).length) return;
    load(codeCards, $("deck-code-name").value.trim() || "Deck importado");
    remember();
    $("deck-code-dialog").close();
  };
  $("save-deck-reference").onclick = () => {
    if (!codeCards || codeCards.length !== 40) return;
    const code = RiotDeckCode.encode(codeCards),
      record = {
        name: ($("deck-code-name").value.trim() || "Deck importado").slice(
          0,
          48,
        ),
        code,
        source: "Importado pelo usuário",
      };
    const index = references.findIndex((r) => r.code === code);
    if (index < 0 && references.length >= 200) {
      $("deck-code-status").textContent = "Limite de 200 referências atingido.";
      return;
    }
    if (index < 0) references.push(record);
    else references[index] = record;
    referenceMenu();
    try {
      localStorage.setItem(
        "lor-deck-references-v1",
        JSON.stringify(references),
      );
      $("deck-code-status").textContent =
        "Referência guardada. Disponível na lista acima.";
    } catch {
      $("deck-code-status").textContent =
        "Referência disponível nesta sessão; o navegador não permitiu salvar.";
    }
  };
  const normalizeCard = value => String(value).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const cardChoices = new Map(), names = new Map();
  const filterCards = Object.values(catalog).filter(card => card.collectible).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const card of filterCards) {
    const label = `${card.name} · ${card.code}`;
    cardChoices.set(normalizeCard(label), card);
    cardChoices.set(normalizeCard(card.code), card);
    const key = normalizeCard(card.name);
    names.set(key, names.has(key) ? null : card);
  }
  for (const [key, card] of names) if (card) cardChoices.set(key, card);
  function refreshDeckCardOptions() {
    const codes = new Set(Object.values(data.decks).flat());
    $("deck-card-options").replaceChildren(...filterCards.filter(card => codes.has(card.code)).map(card => {
      const label = `${card.name} · ${card.code}`;
      return new Option(label, label);
    }));
  }
  let lastDeck = $("deck").value;
  function refreshDeckFilter(afterSave = false) {
    if (afterSave) refreshDeckCardOptions();
    const input = $("deck-card-filter"), select = $("deck"), previous = select.value;
    let card = cardChoices.get(normalizeCard(input.value));
    if (afterSave && card && data.decks[previous] && !data.decks[previous].includes(card.code)) {
      input.value = ""; card = null;
    }
    const matches = Object.entries(data.decks).filter(([, cards]) => !card || cards.includes(card.code));
    const groups = new Map([
      ["Novos decks", document.createElement("optgroup")],
      ["Meus decks", document.createElement("optgroup")],
      ["Outros decks", document.createElement("optgroup")],
    ]);
    for (const [label, group] of groups) group.label = label;
    for (const [key] of matches) {
      const label = data.deckNames[key] || data.deckTitles[key] || key;
      const group = data.featuredDecks?.includes(key) ? "Novos decks" : key === "custom" || key.startsWith("saved_") ? "Meus decks" : "Outros decks";
      groups.get(group).append(new Option(label, key));
    }
    const others = groups.get("Outros decks");
    others.replaceChildren(...[...others.children].sort((a, b) => a.textContent.localeCompare(b.textContent, "pt-BR", { numeric: true, sensitivity: "base" })));
    select.replaceChildren(...[...groups.values()].filter(group => group.children.length));
    const available = new Set(matches.map(([key]) => key));
    const chosen = available.has(previous) ? previous : available.has(lastDeck) ? lastDeck : matches[0]?.[0];
    select.disabled = !chosen;
    $("start").disabled = $("train").disabled = !chosen;
    if (chosen) {
      select.value = chosen; lastDeck = chosen;
      if (previous !== chosen) select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const placeholder = new Option("Nenhum deck para duelo", "", true, true); placeholder.disabled = true;
      select.append(placeholder);
      $("deck-summary").textContent = "Escolha outra carta ou limpe o filtro.";
      $("training-description").textContent = "Escolha um deck para treinar.";
      $("welcome-deck-name").textContent = "Nenhum deck selecionado";
    }
    const pendingDecks = card ? library.filter(record => record.cards.includes(card.code) && needsRules(record.cards).length) : [];
    const pendingList = $("deck-card-pending"); pendingList.replaceChildren(); pendingList.hidden = !pendingDecks.length;
    for (const record of pendingDecks) {
      const choice = document.createElement("button"); choice.type = "button"; choice.className = "deck-pending-choice";
      choice.textContent = `${record.name} · Regras pendentes`;
      choice.onclick = () => { load(record.cards, record.name, record.id); remember(); $("collection-dialog").showModal(); };
      pendingList.append(choice);
    }
    $("deck-card-status").textContent = card
      ? (matches.length ? `${matches.length} deck(s) para duelo com ${card.name}.` : `Nenhum deck para duelo com ${card.name}.`) +
        (pendingDecks.length ? ` ${pendingDecks.length} salvo(s) com regras pendentes; abra para editar.` : !matches.length ? " Monte um em Minha coleção." : "")
      : input.value.trim() ? "Escolha uma carta da lista para filtrar os decks." : "A lista mostra apenas cartas dos decks disponíveis para duelo.";
    $("clear-deck-card-filter").hidden = !input.value;
  }
  function clearDeckFilter() { $("deck-card-filter").value = ""; refreshDeckFilter(); }
  $("deck-card-filter").addEventListener("input", () => refreshDeckFilter());
  $("clear-deck-card-filter").onclick = () => { clearDeckFilter(); $("deck-card-filter").focus(); };
  $("deck").addEventListener("change", () => { if ($("deck").value) lastDeck = $("deck").value; });
  $("resume").addEventListener("click", () => { if (!$("deck").value) clearDeckFilter(); });
  refreshDeckCardOptions();
  refreshDeckFilter();
})();
