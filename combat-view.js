/* Public combat roles and instructions; does not change game rules. */
(function (root) {
  function describe(s, ui = {}) {
    const roles = {},
      combat = s.combat;
    const blocks = ui.blocks || combat?.blocks || {};
    let title = "",
      instruction = "",
      detail = "",
      unblocked = 0;
    if (!combat) {
      if (ui.mode === "attack") {
        title = "ESCOLHA SEUS ATACANTES";
        instruction =
          "Selecione suas unidades e confirme em Atacar. O bot escolherá os bloqueadores depois.";
        detail = `${ui.selected?.size || 0} unidade(s) selecionada(s) · ataque ainda não confirmado`;
        for (const c of s.players[0].board)
          roles[c.id] = {
            kind: ui.selected?.has(c.id) ? "prepare" : "reserve",
            label: ui.selected?.has(c.id) ? "⚔ VAI ATACAR" : "RESERVA",
          };
      }
      return { title, instruction, detail, roles, unblocked };
    }
    const defending = combat.owner === 1;
    title = defending ? "BOT ATACA · VOCÊ DEFENDE" : "VOCÊ ATACA · BOT DEFENDE";
    if (s.phase === "block")
      title = defending
        ? "BOT ATACA · ESCOLHA BLOQUEIOS"
        : "VOCÊ ATACA · BOT ESCOLHE BLOQUEIOS";
    for (let side = 0; side < 2; side++)
      for (const c of s.players[side].board) {
        const cannotBlock = (c.keywords || []).includes("CantBlock");
        const available =
          side !== combat.owner && s.phase === "block" && !cannotBlock;
        roles[c.id] = {
          kind: available ? "available" : "reserve",
          label: available
            ? "🛡 DISPONÍVEL"
            : side !== combat.owner && cannotBlock
              ? "NÃO BLOQUEIA"
              : "RESERVA",
        };
      }
    combat.ids.forEach((id, index) => {
      const blocked = !!blocks[id] || combat.blockedIds?.includes(id);
      roles[id] = {
        kind: "attack",
        lane: index + 1,
        label: "⚔ ATACA " + (index + 1),
        outcome: blocked ? "BLOQUEADO" : "SEM BLOQUEIO → NEXUS",
      };
      if (blocks[id] && roles[blocks[id]])
        roles[blocks[id]] = {
          kind: "block",
          lane: index + 1,
          label: "🛡 BLOQUEIA " + (index + 1),
        };
      if (!blocked) unblocked++;
    });
    detail = `${combat.ids.length} atacante(s) · ${combat.ids.length - unblocked} bloqueado(s) · ${unblocked} sem bloqueio → Nexus`;
    if (s.phase === "block") {
      instruction = defending
        ? "Clique em um aliado para bloquear um atacante livre. Clique novamente para recolher. Termine em Confirmar bloqueios."
        : "O bot está escolhendo os bloqueadores. Aguarde a sua janela de resposta.";
      if (defending && ui.blocker) {
        const unit = s.players[0].board.find((c) => c.id === ui.blocker);
        const assigned = Object.keys(blocks).find(
          (id) => blocks[id] === ui.blocker,
        );
        instruction = assigned
          ? `${unit?.name || "Bloqueador"} selecionado: já bloqueia o atacante ${combat.ids.indexOf(assigned) + 1}. Clique em outro atacante para mudar o par ou no aliado para recolher.`
          : `${unit?.name || "Bloqueador"} selecionado. Clique em um atacante válido para formar o par.`;
      }
    } else
      instruction =
        s.priority === 0
          ? "Confira os pares numerados. Você pode usar Rápidos/Súbitos ou clicar em Resolver combate para aceitar os golpes."
          : "O bot pode responder com feitiços. Os golpes ainda não aconteceram.";
    return { title, instruction, detail, roles, unblocked };
  }
  if (typeof module !== "undefined") module.exports = { describe };
  else root.CombatView = { describe };
})(typeof window === "undefined" ? globalThis : window);
