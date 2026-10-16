(function (root) {
  "use strict";
  const C = root.Campaign, content = root.CAMPAIGN_DATA, data = root.CARD_DATA;
  const $ = id => document.getElementById(id), bridge = root.CampaignBridge;
  const key = "runeterra-campaign-v1";
  let profile = C.empty(), storageError = "", selected = "demacia", zoom = 1, pan = { x: 0, y: 0 };
  try {
    const raw = localStorage.getItem(key);
    if (raw) profile = C.importProfile(raw);
  } catch {
    storageError = "Não foi possível ler o progresso salvo. Você pode jogar e exportar um backup desta sessão.";
  }
  selected = profile.selectedRegion;
  function lobbyProgress() {
    const stats = C.stats(profile);
    const storage = storageError ? "Armazenamento indisponível · Exporte seu progresso no mapa" : "Progresso salvo neste navegador";
    $("welcome-campaign-progress").textContent = `Nível ${stats.level} · ${stats.cleared}/${stats.total} encontros concluídos · ${storage}`;
    $("welcome-campaign-action").textContent = stats.cleared ? "Continuar campanha" : "Explorar campanha";
  }
  lobbyProgress();
  function symbol(region, className = "campaign-region-symbol") {
    const img = document.createElement("img");
    img.src = region.symbol; img.alt = ""; img.className = className;
    img.draggable = false; img.width = 64; img.height = 64;
    return img;
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(profile)); storageError = ""; }
    catch { storageError = "O navegador não conseguiu salvar. Exporte seu progresso para guardar suas conquistas."; }
    lobbyProgress();
    $("campaign-storage").textContent = storageError || "Progresso salvo neste navegador. Exporte para levar a outro dispositivo.";
  }
  function deckOptions() {
    const select = $("campaign-deck"), previous = select.value || $("deck").value;
    const earned = C.playerDecks(profile, data);
    for (const d of earned) { data.decks[d.id] = d.cards; data.deckNames[d.id] = d.name; }
    const entries = earned.map(d => [d.id, d.name]);
    for (const [id, list] of Object.entries(data.decks)) {
      if (!(id === "custom" || id.startsWith("saved_"))) continue;
      if (!root.Engine.validateDeck(data.cards, list).length && !C.deckErrors(profile, list, data).length)
        entries.push([id, data.deckNames[id] || "Meu deck"]);
    }
    select.replaceChildren(...entries.map(([id, name]) => new Option(name, id)));
    if (entries.some(([id]) => id === previous)) select.value = previous;
    select.disabled = !entries.length;
  }
  function render() {
    const stats = C.stats(profile), r = C.region(selected);
    const alliance = C.alliance(profile), decks = C.playerDecks(profile, data);
    $("campaign-deck-progress").textContent = `${decks.length} decks conquistados. Vença a elite para ganhar o deck intermediário e o chefe para ganhar o deck principal de cada região. Use qualquer deck liberado em qualquer região.`;
    $("campaign-alliance").textContent = alliance.unlocked
      ? "Aliança entre Regiões liberada · Combine cartas dos decks conquistados de até duas regiões."
      : `Aliança entre Regiões · Chefes: ${Math.min(1, alliance.completed)}/1 · Fases distintas de outra região: ${alliance.cleared}/3. Vença um chefe e três fases de outra região para misturar cartas.`;
    $("campaign-level").textContent = "Nível " + stats.level;
    $("campaign-xp").value = stats.xp % 100;
    $("campaign-xp-label").textContent = `${stats.xp} XP · ${stats.next} para o próximo nível`;
    $("campaign-total").textContent = `${stats.cleared}/${stats.total} encontros`;
    $("campaign-titles").textContent = C.titles(profile).join(" · ") || "Vença um chefe para conquistar seu primeiro título regional.";
    $("campaign-storage").textContent = storageError || "Progresso salvo neste navegador. Exporte para levar a outro dispositivo.";
    const ongoing = bridge.saved();
    $("campaign-resume").hidden = !ongoing || ongoing.winner !== null;
    $("campaign-resume").textContent = ongoing?.campaign ? "Continuar encontro salvo" : "Continuar duelo salvo";
    $("campaign-pins").replaceChildren();
    $("campaign-destinations").replaceChildren();
    for (const region of content.regions) {
      const pin = document.createElement("button");
      pin.type = "button"; pin.className = "campaign-pin";
      pin.dataset.region = region.id;
      pin.style.left = (50 + region.x / 2048 * 100) + "%";
      pin.style.top = (50 - region.y / 2048 * 100) + "%";
      pin.dataset.playable = String(!!region.playable);
      pin.setAttribute("aria-pressed", String(selected === region.id));
      pin.setAttribute("aria-label", region.name + (region.playable ? `, níveis ${region.level.join(" a ")}` : ", capítulo futuro"));
      const mark = document.createElement("span"); mark.className = "campaign-pin-mark";
      mark.append(symbol(region));
      const regionMastery = C.mastery(profile, region.id);
      if (regionMastery.total && regionMastery.cleared === regionMastery.total) {
        const complete = document.createElement("span"); complete.className = "campaign-pin-complete"; complete.textContent = "✓"; mark.append(complete);
      }
      const label = document.createElement("span"); label.className = "campaign-pin-label"; label.textContent = region.name;
      pin.append(mark, label); pin.onclick = () => choose(region.id, "pin");
      $("campaign-pins").append(pin);
      if (region.playable) {
        const target = document.createElement("button"); target.type = "button"; target.dataset.region = region.id;
        target.setAttribute("aria-pressed", String(selected === region.id));
        const name = document.createElement("strong"); name.textContent = region.name;
        const level = document.createElement("span"); level.textContent = `Nv. ${region.level.join("–")} · ${regionMastery.cleared}/${regionMastery.total}`;
        const caption = document.createElement("span"); caption.className = "campaign-destination-caption"; caption.append(name, level);
        target.append(symbol(region), caption); target.onclick = () => choose(region.id, "destination"); $("campaign-destinations").append(target);
      }
    }
    const panel = $("campaign-region-panel");
    panel.style.setProperty("--region-color", r.color || "var(--gold)");
    if (!r.playable) {
      panel.innerHTML = `<div class="campaign-region-heading"><span class="eyebrow">NOVOS HORIZONTES</span><h3>${r.name}</h3><p>Esta região faz parte de Runeterra. Seu capítulo ainda não está disponível nesta primeira versão.</p><button type="button" id="campaign-back-demacia">Explorar Demacia →</button></div>`;
      $("campaign-back-demacia").onclick = () => choose("demacia");
      return;
    }
    const mastery = C.mastery(profile, r.id), portrait = `assets/campaign/portraits/${r.id}.webp`;
    panel.innerHTML = `<div class="campaign-region-hero"><img src="${portrait}" alt="" /><div><span class="eyebrow">NÍVEIS RECOMENDADOS ${r.level.join("–")}</span><div class="campaign-region-name"><img class="campaign-region-symbol" src="${r.symbol}" alt="" width="64" height="64" /><h3>${r.name}</h3></div><p>${r.motto}</p></div></div><div class="campaign-region-heading"><p>${r.description}</p>${r.opponentLabel ? `<p class="campaign-opponent-note">${r.opponentLabel}</p>` : ""}<div class="campaign-mastery"><span>Maestria regional</span><strong>${mastery.percent}%</strong></div><progress max="${mastery.total}" value="${mastery.cleared}" aria-label="Maestria de ${r.name}"></progress><p class="campaign-level-note">${stats.level < r.level[0] ? "Acima do seu nível recomendado. Você pode tentar mesmo assim." : "Região aberta. Escolha um encontro para continuar."}</p></div><ol class="campaign-encounters" id="campaign-encounters"></ol>`;
    for (const [index, e] of C.encounters(r.id).entries()) {
      const done = profile.completed[e.id], unlocked = C.available(profile, e.id);
      const row = document.createElement("li"); row.className = "campaign-encounter";
      row.dataset.kind = e.suffix; row.dataset.completed = String(!!done);
      const number = document.createElement("span"); number.className = "campaign-node-number"; number.textContent = done ? "✓" : String(index + 1).padStart(2, "0");
      const detail = document.createElement("div");
      const kind = document.createElement("span"); kind.className = "campaign-node-kind"; kind.textContent = `${e.kind} · Nv. ${e.level}`;
      const name = document.createElement("h4"); name.textContent = e.name;
      const hint = document.createElement("p"); hint.textContent = e.hint;
      const reward = document.createElement("small");
      const earnedDeck = C.rewardDeck(e.id, data);
      reward.textContent = done ? `Concluído · Melhor vitória: rodada ${done.bestRound}${earnedDeck ? " · Deck conquistado: " + earnedDeck.name : ""}`
        : `${e.xp} XP na primeira vitória${earnedDeck ? " · Deck completo: " + earnedDeck.name : ""}${e.suffix === "boss" ? " · Título: " + r.title : ""}`;
      const play = document.createElement("button"); play.type = "button"; play.dataset.encounter = e.id;
      play.disabled = !unlocked || $("campaign-deck").disabled;
      play.textContent = done ? "Jogar novamente" : unlocked ? (e.suffix === "boss" ? "Enfrentar chefe →" : "Jogar encontro →") : "Conclua a etapa anterior";
      if (!unlocked) {
        hint.textContent = "Primeiro vença: " + (e.requiresAny.length ? e.requiresAny : e.requires).map(id => C.get(id).name).join(e.requiresAny.length ? " ou " : " e ") + ".";
      }
      play.onclick = () => requestStart(e.id);
      detail.append(kind, name, hint, reward, play); row.append(number, detail); $("campaign-encounters").append(row);
    }
    root.CampaignRoutes?.render(panel, profile, selected, data);
    root.CampaignMap?.sync(selected);
  }
  function choose(id, source = null) {
    selected = id;
    if (C.region(id)?.playable) { profile.selectedRegion = id; persist(); }
    render();
    revealRegion(id, source !== "pin");
    if (source) document.querySelector(source === "pin" ? `.campaign-pin[data-region="${id}"]` : `.campaign-destinations [data-region="${id}"]`)?.focus({ preventScroll: true });
  }
  function revealRegion(id, moveMap = true) {
    const pin = document.querySelector(`.campaign-pin[data-region="${id}"]`), map = $("campaign-map");
    if (!pin) return;
    const bounds = map.getBoundingClientRect(), marker = pin.getBoundingClientRect();
    if (moveMap && (marker.left < bounds.left + 8 || marker.right > bounds.right - 8 || marker.top < bounds.top + 8 || marker.bottom > bounds.bottom - 8)) {
      pan.x += bounds.left + bounds.width / 2 - (marker.left + marker.width / 2);
      pan.y += bounds.top + bounds.height / 2 - (marker.top + marker.height / 2);
      transform();
    }
    const destination = document.querySelector(`.campaign-destinations [data-region="${id}"]`), strip = $("campaign-destinations");
    if (destination) {
      const item = destination.getBoundingClientRect(), viewport = strip.getBoundingClientRect();
      if (item.left < viewport.left || item.right > viewport.right) strip.scrollLeft += item.left - viewport.left;
    }
  }
  function open() {
    $("welcome").hidden = true; $("game").hidden = true; $("campaign").hidden = false;
    deckOptions(); render(); revealRegion(selected); $("campaign-title").focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function launch(id) {
    try {
      if (!C.available(profile, id)) throw Error("Conclua a etapa anterior.");
      if (!bridge.start(id, $("campaign-deck").value)) return;
      $("campaign").hidden = true;
    } catch (error) { $("campaign-storage").textContent = error.message; }
  }
  function canStart(id, key) {
    if (!C.available(profile, id)) throw Error("Conclua a etapa anterior.");
    const errors = C.deckErrors(profile, data.decks[key], data);
    if (errors.length) throw Error(errors.join(" "));
    return true;
  }
  const replace = document.createElement("dialog"); replace.className = "campaign-confirm"; replace.id = "campaign-replace";
  replace.setAttribute("aria-labelledby", "campaign-replace-title");
  replace.innerHTML = '<h2 id="campaign-replace-title">Há uma partida em andamento</h2><p>Iniciar este encontro substitui o salvamento da partida atual. Suas conquistas da campanha continuam guardadas.</p><div><button id="campaign-keep-playing" class="primary">Continuar partida salva</button><button id="campaign-replace-confirm">Iniciar novo encontro</button><button id="campaign-replace-cancel">Cancelar</button></div>';
  document.body.append(replace);
  let pending = null;
  function requestStart(id) {
    const match = bridge.saved();
    if (match && match.winner === null) { pending = id; replace.showModal(); }
    else launch(id);
  }
  $("campaign-keep-playing").onclick = () => { replace.close(); $("resume").click(); };
  $("campaign-replace-confirm").onclick = () => { replace.close(); launch(pending); };
  $("campaign-replace-cancel").onclick = () => replace.close();
  $("open-campaign").onclick = open;
  $("campaign-close").onclick = () => { $("campaign").hidden = true; $("welcome").hidden = false; $("open-campaign").focus(); };
  $("campaign-return").onclick = () => { $("result-dialog").close(); bridge.leave(); open(); };
  $("campaign-collection").onclick = () => root.DeckCollection.openDeck($("campaign-deck").value, { campaign: true });
  $("collection-dialog").addEventListener("close", () => { if (!$("campaign").hidden) { deckOptions(); render(); } });
  document.addEventListener("lor-deck-saved", event => {
    if ($("campaign").hidden) return;
    deckOptions();
    if ([...$("campaign-deck").options].some(option => option.value === event.detail.key)) $("campaign-deck").value = event.detail.key;
    render();
  });
  $("campaign-resume").onclick = () => $("resume").click();
  $("campaign-export").onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "runeterra-campanha.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("campaign-import").onclick = () => $("campaign-import-file").click();
  $("campaign-import-file").onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw Error("O arquivo é grande demais para um progresso de campanha.");
      const imported = C.importProfile(await file.text());
      const completed = { ...profile.completed };
      for (const [id, record] of Object.entries(imported.completed)) completed[id] = { bestRound: Math.min(record.bestRound, completed[id]?.bestRound || record.bestRound) };
      profile = C.normalize({ ...profile, completed }); persist(); deckOptions(); render();
      if (!storageError) $("campaign-storage").textContent = "Progresso importado e combinado com suas conquistas atuais.";
    } catch (error) { $("campaign-storage").textContent = "Não foi possível importar: " + error.message; }
    event.target.value = "";
  };
  function transform() {
    $("campaign-world").style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    $("campaign-zoom-in").disabled = zoom >= 2;
    $("campaign-zoom-out").disabled = zoom <= 1;
  }
  function changeZoom(value) { zoom = Math.max(1, Math.min(2, value)); if (zoom === 1) pan = { x: 0, y: 0 }; transform(); }
  $("campaign-zoom-in").onclick = () => changeZoom(zoom + .25);
  $("campaign-zoom-out").onclick = () => changeZoom(zoom - .25);
  $("campaign-zoom-reset").onclick = () => { pan = { x: 0, y: 0 }; zoom = 1; transform(); };
  let drag = null;
  const map = $("campaign-map");
  map.addEventListener("pointerdown", event => {
    if (event.target.closest("button") || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, start: { ...pan } };
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener("pointermove", event => {
    if (!drag) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    const bound = map.clientWidth * .4 * zoom;
    pan = { x: Math.max(-bound, Math.min(bound, drag.start.x + x)), y: Math.max(-bound, Math.min(bound, drag.start.y + y)) }; transform();
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) map.addEventListener(name, () => { drag = null; });
  transform();
  function recordResult(state) {
    const e = C.get(state.campaign?.encounterId), output = $("campaign-result");
    output.hidden = !e; $("campaign-return").hidden = !e;
    $("again").textContent = e ? "Repetir encontro" : "Jogar novamente";
    if (!e) return;
    try {
      const previousLevel = C.stats(profile).level, hadAlliance = C.alliance(profile).unlocked;
      const result = C.complete(profile, e.id, state.winner, state.round);
      profile = result.profile; selected = e.region; profile.selectedRegion = e.region; persist();
      const level = C.stats(profile).level;
      output.textContent = state.winner === 0
        ? `${result.first ? "+" + result.xp + " XP · " : "Encontro já concluído · "}${C.mastery(profile, e.region).percent}% de maestria em ${C.region(e.region).name}.${level > previousLevel ? " Você alcançou o nível " + level + "!" : ""}${result.first && e.suffix === "boss" ? " Título conquistado: " + C.region(e.region).title + "." : ""}`
        : "Suas conquistas continuam guardadas. Ajuste seu deck e tente novamente.";
      if (state.winner === 0 && result.first) {
        const earnedDeck = C.rewardDeck(e.id, data);
        if (earnedDeck) output.textContent += " Deck conquistado: " + earnedDeck.name + ".";
        if (!hadAlliance && C.alliance(profile).unlocked) output.textContent += " Aliança entre Regiões liberada! Agora você pode misturar até duas regiões por deck.";
      }
      if (storageError) output.textContent += " " + storageError;
    } catch (error) { output.textContent = "Não foi possível registrar este resultado: " + error.message; }
  }
  deckOptions();
  root.CampaignUI = { open, recordResult, canStart,
    deckErrors: list => C.deckErrors(profile, list, data),
    ownedCards: () => C.ownedCards(profile, data),
  };
})(window);
