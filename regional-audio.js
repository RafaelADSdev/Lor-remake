/* Native Wwise assets, resolved through actual Unity playmat profiles. */
(function (root) {
  const playing = new Map();
  let soundsEnabled = true;
  const aliases = { mounttargon: "targon", regionshurima: "shurima", summonersrift: "rift" };
  function select(theme, audio = document.getElementById("duel-music")) {
    const key = aliases[theme] || theme || "rift";
    const entry = root.REGIONAL_AUDIO?.[key];
    if (!audio || !entry) return false;
    if (audio.dataset.regionalTheme === key) return true;
    audio.pause();
    audio.src = entry.src;
    audio.dataset.regionalTheme = key;
    audio.dataset.sourceEvent = entry.event;
    audio.load();
    return true;
  }
  function stop(keys) {
    for (const [voice, key] of playing) {
      if (keys && !keys.includes(key)) continue;
      voice.pause();
      voice.removeAttribute("src");
      playing.delete(voice);
    }
  }
  async function sound(key, volume = 0.45) {
    const entry = root.NATIVE_SOUNDS?.[key];
    if (!soundsEnabled || !entry || document.hidden || playing.size >= 6) return false;
    const voice = new Audio(entry.src);
    voice.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    playing.set(voice, key);
    const finish = () => playing.delete(voice);
    voice.addEventListener("ended", finish, { once: true });
    voice.addEventListener("error", finish, { once: true });
    try { await voice.play(); return true; } catch { finish(); return false; }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  root.RegionalAudio = {
    select, sound, stop,
    set enabled(value) { soundsEnabled = Boolean(value); if (!soundsEnabled) stop(); },
    get enabled() { return soundsEnabled; },
    get activeSounds() { return playing.size; },
    get themes() { return Object.keys(root.REGIONAL_AUDIO || {}); },
  };
})(window);
