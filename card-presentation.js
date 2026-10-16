/* Presentation follows public engine results; it never calculates card rules. */
(function (root) {
  'use strict';
  let epoch = 0;
  const unitRect = (id, before) => document.querySelector(`.board [data-id="${id}"]`)?.getBoundingClientRect() || before.nodes.get(id)?.rect;
  const nexusRect = owner => document.getElementById(owner === 0 ? 'my-nexus' : 'enemy-nexus')?.getBoundingClientRect();
  function spellTarget(before, after, owner, target) {
    if (target === 'nexus') return nexusRect(1 - owner);
    if (target === 'my-nexus') return nexusRect(owner);
    if (target) return unitRect(target, before);
    for (const side of [1 - owner, owner]) {
      const changed = before.state.players[side].board.find(old => {
        const next = after.players[side].board.find(unit => unit.id === old.id);
        return !next || next.health !== old.health || next.attack !== old.attack || JSON.stringify(next.keywords) !== JSON.stringify(old.keywords);
      });
      if (changed) return unitRect(changed.id, before);
    }
    return nexusRect(1 - owner);
  }
  async function change(before, state, trace) {
    if (!root.CardEffects || !root.ArenaMotion.enabled || root.ArenaMotion.reduced) return;
    const own = epoch, events = [];
    const add = (code, phases, owner, sourceRect, targetRect) => {
      if (!code) return;
      events.push(async () => {
        for (const phase of phases) {
          if (epoch !== own) return;
          if (root.CardEffects.has(code, phase))
            await root.CardEffects.play({ code, phase, owner, sourceRect, targetRect });
        }
      });
    };
    const cast = (card, owner, after, target, originalState = before.state) => {
      const snapshot = { state: originalState, nodes: before.nodes };
      const sourceRect = before.nodes.get(card.id)?.rect || nexusRect(owner);
      const targets = Array.isArray(target) ? target : [target];
      events.push(async () => {
        if (epoch !== own) return;
        if (root.CardEffects.has(card.code, 'cast'))
          await root.CardEffects.play({ code: card.code, phase: 'cast', owner, sourceRect, targetRect: spellTarget(snapshot, after, owner, targets[0]) });
        for (const phase of ['missile', 'impact']) {
          if (epoch !== own) return;
          if (root.CardEffects.has(card.code, phase))
            await Promise.all(targets.map(id => root.CardEffects.play({ code: card.code, phase, owner, sourceRect, targetRect: spellTarget(snapshot, after, owner, id) })));
        }
      });
    };
    if (trace?.kind === 'stack') {
      for (const spell of trace.spells || [])
        if (spell.resolved) cast(spell.card, spell.owner, spell.after, spell.target, spell.before);
    } else {
      const resolvedIds = new Set();
      for (const event of state.presentationEvents || [])
        if (event.kind === 'spell' &&
            before.state.players[event.owner]?.hand.some(card => card.id === event.id) &&
            !state.players[event.owner].hand.some(card => card.id === event.id)) {
          cast({ code: event.code, id: event.id }, event.owner, state, event.target);
          resolvedIds.add(event.id);
        }
      for (let owner = 0; owner < 2; owner++)
        for (const original of before.state.players[owner].hand) {
          const card = root.Engine?.cardView(before.state, owner, original) || original;
          if (card.type === 'spell' && !resolvedIds.has(card.id) && before.state.phase !== 'mulligan' &&
            !state.players[owner].hand.some(now => now.id === card.id) &&
            !(state.stack || []).some(entry => entry.card.id === card.id)) cast(card, owner, state);
        }
    }
    for (let owner = 0; owner < 2; owner++) {
      const previous = before.state.players[owner].board, current = state.players[owner].board;
      for (const card of current)
        if (!previous.some(old => old.id === card.id))
          add(card.code, ['summon'], owner, before.nodes.get(card.id)?.rect || nexusRect(owner), unitRect(card.id, before));
      for (const card of previous)
        if (!current.some(now => now.id === card.id)) {
          const recalled = state.players[owner].hand.some(now => now.id === card.id) ||
            state.presentationEvents?.some(event => event.kind === 'recall' && event.id === card.id);
          add(card.code, [recalled ? 'recall' : 'death'], owner, unitRect(card.id, before), unitRect(card.id, before));
        }
    }
    if (!before.state.combat && state.combat)
      for (const id of state.combat.ids) {
        const owner = state.combat.owner, card = state.players[owner].board.find(unit => unit.id === id);
        if (card) add(card.code, ['attack'], owner, unitRect(id, before), nexusRect(1 - owner));
      }
    // Limit simultaneous native scenes when a board-wide effect creates many events.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, events.length) }, async () => {
      while (cursor < events.length && epoch === own) {
        const event = events[cursor++];
        try { await event(); } catch { /* Existing game presentation remains available. */ }
      }
    }));
  }
  function cancel() { epoch++; root.CardEffects?.cancel(); }
  root.CardPresentation = { change, cancel };
})(window);
