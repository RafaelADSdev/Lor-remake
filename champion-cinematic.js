/* Native champion videos and explicitly selected skins; no skin is a default. */
(function (root) {
  const choice = document.getElementById("champion-cinematic");
  let current = null, lastAudio = null;
  const library = root.CINEMATIC_LIBRARY || [];
  const legacyRugged = { id: "rugged", name: "Garen Rugged", skin: "Rugged",
    championCodes: ["01DE012"], video: "assets/video/garen-rugged-level-up.webm",
    audio: "garen-rugged-level-up", level: 2 };
  // Keep a previously selected skin while simplifying the visible control.
  let variant = "native";
  try {
    const saved = localStorage.getItem("lor-champion-cinematic");
    if (saved === "rugged" || library.some(entry => entry.id === saved)) variant = saved;
    choice.value = ["off", "none", "portrait"].includes(saved) ? "off" : "on";
  } catch {}
  choice.onchange = () => {
    if (choice.value === "off") { cancel(); root.ChampionPresentation?.cancel(); }
    try {
      localStorage.setItem("lor-champion-cinematic", choice.value === "off" ? "off" : variant);
    } catch {}
  };
  function cancel() {
    if (lastAudio) root.RegionalAudio?.stop([lastAudio]);
    lastAudio = null;
    if (current) current.finish(true);
  }
  function entryFor(card) {
    const matches = entry => [...(entry.championCodes || []), ...(entry.codes || [])]
      .some(code => code === card.championKey || code === card.code);
    if (choice.value === "off") return null;
    if (variant === "rugged") return matches(legacyRugged) ? legacyRugged : null;
    if (variant === "native") return library.find(entry =>
      entry.defaultChampionCinematic && matches(entry) && (entry.level || 2) === (card.level || 2)) || null;
    const entry = library.find(entry => entry.id === variant);
    return entry && matches(entry) && (entry.level || 2) === (card.level || 2) ? entry : null;
  }
  root.ChampionCinematic = {
    get enabled() { return choice.value !== "off"; },
    entryFor,
    async play(card) {
      const entry = entryFor(card);
      if (
        !entry ||
        !root.ArenaMotion.enabled ||
        root.ArenaMotion.reduced
      )
        return false;
      cancel();
      const overlay = document.createElement("div");
      overlay.className = "champion-cinematic";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Evolução de " + entry.name);
      const video = document.createElement("video");
      video.src = entry.video;
      video.muted = true; // This source is silent; its original Wwise audio plays separately.
      video.playsInline = true;
      video.preload = "auto";
      const title = document.createElement("p");
      title.textContent = `${entry.name} · ${entry.skin ? "vídeo da skin" : "evolução original"} · Nível ${entry.level || 2}`;
      const skip = document.createElement("button");
      skip.textContent = "Pular animação";
      overlay.append(video, title, skip);
      document.body.append(overlay);
      const previousFocus = document.activeElement;
      skip.focus();
      return new Promise((resolve) => {
        let finished = false;
        // Guard loading/stalls, without cutting off a video that is still playing.
        let timer;
        const armTimeout = () => {
          if (finished) return;
          clearTimeout(timer);
          timer = setTimeout(() => finish(false), 15000);
        };
        function finish(ok, stopSound = true) {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (stopSound && entry.audio) {
            root.RegionalAudio?.stop([entry.audio]);
            if (lastAudio === entry.audio) lastAudio = null;
          }
          video.pause();
          video.removeAttribute("src");
          video.load();
          overlay.remove();
          if (previousFocus?.isConnected) previousFocus.focus();
          if (current?.overlay === overlay) current = null;
          resolve(ok);
        }
        current = { overlay, finish, audio: entry.audio };
        armTimeout();
        skip.onclick = () => finish(true);
        video.addEventListener("playing", () => {
          if (!finished && entry.audio) {
            lastAudio = entry.audio;
            root.RegionalAudio?.sound(entry.audio);
          }
        }, { once: true });
        video.onplaying = () => clearTimeout(timer);
        video.onwaiting = armTimeout;
        video.onstalled = armTimeout;
        video.onended = () => {
          clearTimeout(timer);
          // Preserve all frames, then ease back to the board. The audio tail
          // belongs to the separate Wwise event and finishes naturally.
          overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 180, fill: "forwards",
          }).finished.then(() => finish(true, false)).catch(() => finish(true));
        };
        video.onerror = () => finish(false);
        video.play().catch(() => finish(false));
      });
    },
    cancel,
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancel();
  });
  document.addEventListener("keydown", (e) => {
    if (current && e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (current && e.key === "Tab") {
      e.preventDefault();
      current.overlay.querySelector("button").focus();
    }
  });
})(window);
