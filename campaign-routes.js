/* A route is a preview of existing encounter rules, never another game state. */
(function (root) {
  'use strict';
  const positions = { patrol: [150, 40], road: [50, 140], river: [150, 140], optional: [250, 140], elite: [100, 240], boss: [100, 340], veteran: [100, 440] };
  const captions = { patrol: 'Patrulha', road: 'Estrada', river: 'Rio', optional: 'Opcional', elite: 'Elite', boss: 'Chefe', veteran: 'Avançado' };
  function render(parent, profile, region, data) {
    const C = root.Campaign, encounters = C.encounters(region);
    const section = document.createElement('section'); section.className = 'campaign-route-section';
    const heading = document.createElement('h4'); heading.textContent = 'Escolha seu caminho';
    const hint = document.createElement('p'); hint.textContent = 'Estrada ou rio levam à elite. O desvio é opcional. Toque em uma etapa para ver a batalha e sua recompensa.';
    const map = document.createElement('nav'); map.className = 'campaign-route-map';
    map.setAttribute('aria-label', 'Caminhos e recompensas de ' + C.region(region).name);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 480'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    for (const encounter of encounters) {
      const end = positions[encounter.suffix];
      for (const id of [...encounter.requires, ...encounter.requiresAny]) {
        const start = positions[C.get(id).suffix];
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('d', `M${start[0]} ${start[1]} L${end[0]} ${end[1]}`);
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.dataset.open = String(C.available(profile, encounter.id));
        svg.append(path);
      }
    }
    map.append(svg);
    for (const encounter of encounters) {
      const [x, y] = positions[encounter.suffix], done = !!profile.completed[encounter.id];
      const open = C.available(profile, encounter.id), earned = C.rewardDeck(encounter.id, data);
      const status = done ? 'Concluído' : open ? 'Aberto' : 'Bloqueado';
      const rewards = `${encounter.xp} XP${earned ? ' · Deck completo' : ''}${encounter.suffix === 'boss' ? ' · Título' : ''}`;
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.route = encounter.id; button.dataset.completed = String(done);
      button.style.left = x / 3 + '%'; button.style.top = y / 4.8 + '%';
      button.dataset.locked = String(!open);
      button.setAttribute('aria-label', `${encounter.name} · ${status} · ${rewards}`);
      const name = document.createElement('strong'); name.textContent = captions[encounter.suffix];
      const label = document.createElement('small'); label.textContent = done ? '✓ Concluído' : status;
      const reward = document.createElement('small'); reward.className = 'campaign-route-reward';
      reward.textContent = done ? 'XP recebido' : `${encounter.xp} XP${earned ? ' · Deck' : ''}`;
      button.append(name, label, reward);
      button.onclick = () => {
        const play = document.querySelector(`#campaign-encounters [data-encounter="${encounter.id}"]`);
        const row = play.closest('li');
        const target = play.disabled ? row : play;
        if (play.disabled) row.tabIndex = -1;
        target.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'center', behavior: 'instant' });
      };
      map.append(button);
    }
    section.append(heading, hint, map); parent.insertBefore(section, parent.querySelector('#campaign-encounters'));
  }
  root.CampaignRoutes = { render };
})(window);
