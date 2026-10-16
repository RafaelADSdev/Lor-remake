/* Opening-hand and public-information response UI. No opponent hand is inspected. */
(function (root) {
  const $ = (id) => document.getElementById(id);
  let oracleOpen = false;
  function render(s, busy, selected, callbacks) {
    document.body.classList.toggle("choosing-hand", s.phase === "mulligan");
    document.body.classList.toggle("combat-active", !!s.combat);
    document.body.classList.toggle("answering-spell", s.phase === "response");
    const opening = $("opening-hand");
    opening.hidden = s.phase !== "mulligan";
    if (!opening.hidden) {
      const list = $("opening-cards");
      list.replaceChildren();
      for (const c of s.players[0].hand) {
        const button = document.createElement("button");
        button.className = "opening-card";
        button.setAttribute("aria-label", "Trocar " + c.name);
        button.setAttribute("aria-pressed", String(selected.has(c.id)));
        button.disabled = busy;
        const img = document.createElement("img");
        img.src = c.portrait;
        img.alt = c.name;
        const label = document.createElement("span");
        label.textContent = selected.has(c.id) ? "↻ TROCAR" : "MANTER";
        button.append(img, label);
        button.onclick = () => callbacks.toggle(c.id);
        list.append(button);
      }
      $("confirm-opening").textContent = selected.size
        ? `Trocar ${selected.size} e começar`
        : "Manter mão e começar";
      $("confirm-opening").disabled = busy;
      $("confirm-opening").onclick = callbacks.confirm;
    }
    const stack = $("spell-stack");
    stack.replaceChildren();
    stack.hidden = !s.stack?.length;
    // The last committed spell is placed at the left: it resolves first.
    for (const [index, entry] of [...(s.stack || [])].reverse().entries()) {
      const item = document.createElement("button");
      item.className =
        "stack-spell " + (entry.owner === 0 ? "allied" : "hostile");
      item.dataset.id = entry.card.id;
      item.title = `${index + 1}º a resolver · ${entry.card.name} · ${entry.owner === 0 ? "Você" : "Bot"}`;
      item.setAttribute("aria-label", item.title);
      const img = document.createElement("img");
      img.src = entry.card.image;
      img.alt = "";
      const count = document.createElement("b");
      count.textContent = index + 1;
      const label = document.createElement("span");
      label.textContent = entry.card.name;
      item.append(img, count, label);
      item.onclick = () => callbacks.inspect(entry.card);
      stack.append(item);
    }
    const oracle = $("oracle");
    oracle.hidden = !s.combat && s.phase !== "response";
    oracle.disabled = busy || s.priority !== 0;
    if (oracle.hidden) oracleOpen = false;
    oracle.setAttribute("aria-expanded", String(oracleOpen));
    oracle.onclick = () => {
      oracleOpen = !oracleOpen;
      callbacks.render();
    };
    $("oracle-result").hidden = !oracleOpen;
    if (oracleOpen) {
      const prediction = root.Engine.preview(s, callbacks.blocks);
      const mine = s.players[0].board.filter(
        (c) => !prediction.survivors[0].some((u) => u.id === c.id),
      ).length;
      const enemy = s.players[1].board.filter(
        (c) => !prediction.survivors[1].some((u) => u.id === c.id),
      ).length;
      $("oracle-result").textContent =
        `Sem novas respostas · Seu Nexus: ${prediction.nexus[0]} · Nexus inimigo: ${prediction.nexus[1]} · Unidades perdidas: você ${mine}, bot ${enemy}.`;
    }
  }
  root.DuelUI = { render };
})(window);
