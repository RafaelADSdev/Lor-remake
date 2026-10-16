/* Explicit previews use their own host; opening the library never starts playback. */
(function (root) {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.id = 'animation-gallery';
  dialog.className = 'animation-gallery';
  dialog.setAttribute('aria-labelledby', 'animation-title');
  dialog.innerHTML = `
    <header><div><span class="eyebrow">BIBLIOTECA</span><h2 id="animation-title">Animações</h2></div><button id="animation-close">Fechar</button></header>
    <div class="animation-layout"><section class="animation-browser" aria-label="Escolher animação">
      <label for="animation-search">Buscar carta ou animação</label><input id="animation-search" type="search" placeholder="Ex.: Tibbers, A Ruína, Garen" autocomplete="off">
      <label for="animation-kind">Tipo</label><select id="animation-kind"><option value="">Todos</option><option value="Spells">Feitiços</option><option value="CardMoments">Invocações e habilidades</option><option value="ChampMoments">Campeões</option><option value="MomentSkins">Efeitos de skins</option><option value="video">Cinemáticas</option></select>
      <button id="animation-clear-filter" hidden>Mostrar todas as cartas</button><p id="animation-count" role="status"></p>
      <div id="animation-list" role="list" aria-label="Animações disponíveis"></div>
      <nav aria-label="Páginas de animações"><button id="animation-prev">Anterior</button><span id="animation-page"></span><button id="animation-next">Próxima</button></nav>
    </section><section class="animation-detail" aria-label="Prévia da animação">
      <h3 id="animation-name">Selecione uma animação</h3><p id="animation-card-name"></p>
      <div id="animation-stage" class="animation-stage"><span>Escolha uma animação e clique em Reproduzir.</span></div>
      <div class="animation-playback"><label for="animation-phase">Momento<select id="animation-phase"></select></label><button id="animation-play" disabled>Reproduzir</button><button id="animation-stop">Parar</button></div>
      <p id="animation-status" role="status" aria-live="polite"></p>
    </section></div>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#' + id);
  const labels = { cast: 'Conjuração', missile: 'Projétil', impact: 'Impacto', summon: 'Invocação', attack: 'Ataque', death: 'Morte', levelup: 'Evolução', levelUp: 'Evolução', recall: 'Retorno', idle: 'Espera', effect: 'Efeito' };
  let selected = null, cardFilter = '', page = 0, epoch = 0, video = null, previousFocus = null;
  const canPreview = entry => !!entry && (entry.kind === 'video' || entry.presentable !== false);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cardNames = entry => (entry.codes || []).map(code => root.OFFICIAL_CATALOG?.[code]?.name || root.CARD_DATA?.cards[code]?.name).filter(Boolean);
  function poster(entry) {
    const code = entry.codes?.find(code => root.OFFICIAL_CATALOG?.[code] || root.CARD_DATA?.cards[code]);
    const src = entry.poster || root.OFFICIAL_CATALOG?.[code]?.portrait || root.CARD_DATA?.cards[code]?.portrait;
    if (!src) {
      const hint = document.createElement('span'); hint.textContent = 'Clique em Reproduzir para ver a animação.';
      $('animation-stage').append(hint); return;
    }
    const image = document.createElement('img'); image.className = 'animation-poster'; image.alt = entry.name || '';
    image.src = src; $('animation-stage').append(image);
  }
  function entries() {
    return [
      ...(root.CardEffects?.list() || []).map(group => ({ ...group, key: 'effect:' + group.id, kind: 'effect' })),
      ...(root.CINEMATIC_LIBRARY || []).map(item => ({ ...item, codes: [...new Set([...(item.codes || []), ...(item.championCodes || [])])], key: 'video:' + item.id, kind: 'video', family: 'video', phases: ['levelup'] })),
    ];
  }
  function stop() {
    epoch++;
    root.CardEffects?.cancel();
    if (video) {
      video.pause(); video.removeAttribute('src'); video.load(); video = null;
    }
    $('animation-stage').replaceChildren();
    $('animation-play').disabled = !canPreview(selected);
    $('animation-status').textContent = '';
  }
  function choose(entry) {
    stop(); selected = entry;
    $('animation-name').textContent = entry.name;
    $('animation-card-name').textContent = [...new Set(cardNames(entry))].join(' · ');
    $('animation-phase').replaceChildren(...(entry.phases?.length ? entry.phases : ['effect']).map(phase => new Option(labels[phase] || phase, phase)));
    $('animation-play').disabled = !canPreview(entry);
    if (!canPreview(entry)) $('animation-status').textContent = 'Este recurso ainda não possui uma prévia reproduzível.';
    poster(entry);
    for (const button of dialog.querySelectorAll('.animation-choice'))
      button.setAttribute('aria-pressed', String(button.dataset.key === entry.key));
    if (dialog.open && innerWidth <= 680)
      dialog.querySelector('.animation-detail').scrollIntoView({ block: 'start' });
  }
  function render() {
    const query = normalize($('animation-search').value), kind = $('animation-kind').value;
    const filtered = entries().filter(entry =>
      (!kind || entry.family === kind) &&
      (!cardFilter || entry.codes?.includes(cardFilter)) &&
      (!query || normalize([entry.name, ...cardNames(entry), ...(entry.codes || [])].join(' ')).includes(query)));
    const pages = Math.max(1, Math.ceil(filtered.length / 40));
    page = Math.min(page, pages - 1);
    $('animation-count').textContent = `${filtered.length} animações e cinemáticas`;
    $('animation-clear-filter').hidden = !cardFilter;
    const list = $('animation-list'); list.replaceChildren();
    for (const entry of filtered.slice(page * 40, page * 40 + 40)) {
      const button = document.createElement('button');
      button.className = 'animation-choice'; button.dataset.key = entry.key;
      button.setAttribute('aria-pressed', String(selected?.key === entry.key));
      const title = document.createElement('strong'), description = document.createElement('small');
      title.textContent = entry.name;
      description.textContent = entry.kind === 'video' ? (entry.skin ? 'Cinemática · ' + entry.skin : 'Cinemática de evolução') : (entry.phases || []).map(phase => labels[phase] || phase).join(' · ');
      button.append(title, description); button.onclick = () => choose(entry); list.append(button);
    }
    if (!filtered.length) list.textContent = 'Nenhuma animação encontrada. Ajuste os filtros.';
    $('animation-page').textContent = `${page + 1} / ${pages}`;
    $('animation-prev').disabled = page === 0; $('animation-next').disabled = page === pages - 1;
  }
  async function play() {
    if (!canPreview(selected)) return;
    stop();
    const own = epoch, entry = selected, host = $('animation-stage');
    $('animation-status').textContent = 'Carregando animação…';
    $('animation-play').disabled = true;
    if (entry.kind === 'video') {
      video = document.createElement('video');
      video.controls = true; video.playsInline = true; video.preload = 'metadata';
      video.src = entry.video; video.setAttribute('aria-label', entry.name);
      if (entry.poster) video.poster = entry.poster;
      host.append(video);
      video.onerror = () => { if (own === epoch) $('animation-status').textContent = 'Não foi possível abrir esta cinemática.'; };
      try { await video.play(); if (own === epoch) $('animation-status').textContent = entry.name; }
      catch { if (own === epoch) $('animation-status').textContent = 'Use o botão de reprodução do vídeo.'; }
      if (own === epoch) $('animation-play').disabled = false;
      return;
    }
    try {
      const rect = host.getBoundingClientRect();
      const ok = await root.CardEffects.play({ groupId: entry.id, phase: $('animation-phase').value,
        code: cardFilter || entry.codes?.[0], preview: true, host,
        sourceRect: { x: rect.x + rect.width * .2, y: rect.y + rect.height * .5, width: 1, height: 1 },
        targetRect: { x: rect.x + rect.width * .65, y: rect.y + rect.height * .45, width: 80, height: 100 }, owner: 0 });
      if (own === epoch) $('animation-status').textContent = ok ? 'Reprodução concluída.' : 'Prévia indisponível para este efeito.';
    } catch {
      if (own === epoch) $('animation-status').textContent = 'Não foi possível carregar esta animação.';
    } finally {
      if (own === epoch) $('animation-play').disabled = false;
    }
  }
  function open({ code = '' } = {}) {
    stop(); selected = null; previousFocus = document.activeElement; cardFilter = code; page = 0;
    $('animation-name').textContent = 'Selecione uma animação'; $('animation-card-name').textContent = '';
    $('animation-phase').replaceChildren(); $('animation-play').disabled = true;
    $('animation-search').value = ''; $('animation-kind').value = '';
    render();
    const first = entries().find(entry => !code || entry.codes?.includes(code));
    if (first) choose(first);
    if (!dialog.open) dialog.showModal();
    $('animation-search').focus();
  }
  $('animation-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { stop(); if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.addEventListener('cancel', stop);
  $('animation-search').oninput = $('animation-kind').onchange = () => { page = 0; render(); };
  $('animation-clear-filter').onclick = () => { cardFilter = ''; page = 0; render(); };
  $('animation-prev').onclick = () => { page--; render(); };
  $('animation-next').onclick = () => { page++; render(); };
  $('animation-play').onclick = play; $('animation-stop').onclick = stop;
  root.document.getElementById('open-animations')?.addEventListener('click', () => open());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.AnimationGallery = { open, close: () => dialog.close(), cancel: stop };
})(window);
