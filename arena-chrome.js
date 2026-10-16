/* HUD state feedback: transient button/token changes, deck lift and original Nexus models. */
(function (root) {
  let lastState = null,
    previous = null;
  const active = new Set();
  function motion() {
    return root.ArenaMotion.enabled && !root.ArenaMotion.reduced;
  }
  function animate(el, frames, duration) {
    if (!el || !motion()) return;
    const a = el.animate(frames, {
      duration,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
    active.add(a);
    a.finished.catch(() => {}).finally(() => active.delete(a));
  }
  function lift(deck) {
    animate(
      deck,
      [
        { transform: "translateY(0) rotate(0)" },
        { transform: "translateY(-5px) rotate(-4deg)", offset: 0.35 },
        { transform: "translateY(0) rotate(0)" },
      ],
      260,
    );
  }
  root.ArenaChrome = {
    render(s) {
      root.ArenaAmbient.sync(s);
      root.NexusView.sync();
      root.ArenaHUD.render(s);
      const full = motion();
      document.body.classList.toggle("hud-motion", full);
      const button = document.getElementById("pass"),
        mode =
          s.priority === 1
            ? "opponent"
            : s.phase === "response" || s.phase === "block"
              ? "confirm"
              : "action";
      button.dataset.actionMode = mode;
      button.setAttribute("aria-label", button.textContent);
      document.getElementById("attack").title =
        document.getElementById("attack").textContent;
      if (
        /^(Confirmar bloqueios|Resolver combate|Resolver feitiços)$/.test(
          button.textContent,
        )
      )
        button.textContent = "Confirmar";
      root.ArenaToken.render(s);
      root.ArenaInitiative.render(s);
      for (const side of [0, 1]) {
        const p = s.players[side],
          deck = document.getElementById(side ? "enemy-deck" : "local-deck");
        deck.dataset.remaining = p.deck.length;
        deck.title =
          (side ? "Deck do bot: " : "Seu deck: ") + p.deck.length + " cartas";
      }
      if (s === lastState && previous) {
        for (const side of [0, 1]) {
          const p = s.players[side];
          if (previous.mana[side] !== p.mana)
            animate(
              document.querySelector(
                side
                  ? "#bot-resources .mana-crystals"
                  : "#my-resources .mana-crystals",
              ),
              [
                { opacity: 0.45, transform: "translateY(3px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              220,
            );
          if (side === 1 && previous.deck[side] > p.deck.length) {
            lift(document.getElementById("enemy-deck"));
            animate(
              document.querySelector("#bot-hand :last-child"),
              [
                {
                  opacity: 0,
                  transform: "translate(25px,25px) rotateY(60deg)",
                },
                { opacity: 1, transform: "translate(0,0) rotateY(0deg)" },
              ],
              320,
            );
          }
        }
        if (previous.mode !== mode)
          animate(
            button,
            [
              { filter: "brightness(1.65)", transform: "scale(.97)" },
              { filter: "brightness(1)", transform: "scale(1)" },
            ],
            220,
          );
      }
      previous = {
        mode,
        mana: s.players.map((p) => p.mana),
        deck: s.players.map((p) => p.deck.length),
      };
      lastState = s;
    },
    cancel() {
      root.ArenaToken.cancel();
      root.ArenaInitiative.cancel();
      root.ArenaAmbient.pause();
      root.NexusView.pause();
      for (const a of active) a.cancel();
      active.clear();
      document.body.classList.remove("hud-motion");
    },
  };
  document.addEventListener("arena-motion-stage", (event) => {
    if (event.detail.phase === "combat-ready") {
      const button = document.getElementById("pass");
      button.textContent = "Combate";
      button.setAttribute("aria-label", "Combate em andamento");
      document.getElementById("phase-label").textContent =
        event.detail.owner === 0
          ? "VOCÊ ATACA · RESOLVENDO GOLPES"
          : "BOT ATACA · RESOLVENDO GOLPES";
    }
    if (event.detail.phase === "draw-reveal") {
      lift(document.getElementById("local-deck"));
    }
    if (event.detail.phase === "idle")
      document.body.classList.toggle("hud-motion", motion());
  });
})(window);
