/* Native regional battle arrangements; persistent music and independent effects. */
(function (root) {
  const audio = document.getElementById("duel-music"),
    button = document.getElementById("music-toggle"),
    slider = document.getElementById("music-volume");
  let enabled = true,
    active = false,
    blocked = false,
    epoch = 0;
  try {
    enabled = localStorage.getItem("lor-music-enabled") !== "false";
    slider.value = localStorage.getItem("lor-music-volume") || "25";
  } catch {}
  audio.volume = Number(slider.value) / 100;
  function volumeLabel() {
    document.getElementById("music-volume-value").value = slider.value + "%";
    slider.style.setProperty("--volume-fill", slider.value + "%");
    slider.setAttribute("aria-valuetext", slider.value + "%");
  }
  volumeLabel();
  root.RegionalAudio.enabled = root.ArenaMotion.soundEnabled;
  function label() {
    button.textContent = blocked
      ? "Iniciar música"
      : enabled
        ? "Música: ativada"
        : "Música: desligada";
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", button.textContent);
    button.title = button.textContent + " · clique para alternar";
  }
  async function sync() {
    const current = ++epoch;
    if (!enabled || !active || document.hidden) {
      audio.pause();
      label();
      return;
    }
    try {
      await audio.play();
      if (current !== epoch) return;
      blocked = false;
    } catch {
      if (current !== epoch) return;
      blocked = true;
    }
    label();
  }
  button.onclick = () => {
    if (!blocked) enabled = !enabled;
    try {
      localStorage.setItem("lor-music-enabled", String(enabled));
    } catch {}
    sync();
  };
  slider.oninput = () => {
    audio.volume = Number(slider.value) / 100;
    volumeLabel();
    try {
      localStorage.setItem("lor-music-volume", slider.value);
    } catch {}
  };
  document.addEventListener("visibilitychange", sync);
  audio.addEventListener("error", () => {
    button.textContent = "Música indisponível";
    button.setAttribute("aria-label", button.textContent);
    button.title = "Não foi possível carregar o áudio local.";
  });
  label();
  root.GameAudio = {
    enter(state) {
      root.RegionalAudio.select(state?.arenaThemes?.[0] || "rift", audio);
      active = true;
      sync();
    },
    leave() {
      active = false;
      root.RegionalAudio.stop();
      sync();
    },
    observe(before, state) {
      if (!active) return;
      const play = (key) => root.RegionalAudio.sound(key);
      for (const side of [0, 1]) {
        const old = before.players[side],
          now = state.players[side];
        if (now.mana < old.mana) play("mana");
        if (now.spellMana < old.spellMana) play("spell-mana");
        if (
          now.deck.length < old.deck.length &&
          now.hand.some((c) => !old.hand.some((o) => o.id === c.id))
        )
          play(side ? "draw-enemy" : "draw");
        if (
          side === 1 &&
          now.board.some((c) => !old.board.some((o) => o.id === c.id))
        )
          play("summon-enemy");
        if (
          now.board.some(
            (c) =>
              c.keywords.includes("Barrier") &&
              !old.board
                .find((o) => o.id === c.id)
                ?.keywords.includes("Barrier"),
          )
        )
          play("barrier");
      }
      if (state.priority === 0 && before.priority !== 0) play("turn");
      if (!before.attackTokens?.[0] && state.attackTokens?.[0])
        play("attack-token");
    },
  };
  document.addEventListener("click", (e) => {
    if (active && e.target.closest("button"))
      root.RegionalAudio.sound("button", 0.18);
  });
})(window);
