/* One decorative canvas. Theme-specific scenery stays outside the card lanes. */
(function (root) {
  const arena = document.querySelector(".arena"),
    canvas = document.createElement("canvas");
  canvas.id = "arena-ambient";
  canvas.setAttribute("aria-hidden", "true");
  arena.querySelector(".arena-scenery").append(canvas);
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const palettes = {
    rift: ["#b9d968", "leaf"],
    demacia: ["#f7dfab", "dust"],
    noxus: ["#ffac55", "ember"],
    ionia: ["#efb3d3", "petal"],
    freljord: ["#d7f2ff", "snow"],
    piltover: ["#7fdcf1", "spark"],
    bilgewater: ["#b3dce1", "spray"],
    shadowisles: ["#72d8bd", "wisp"],
    shurima: ["#ebc888", "sand"],
    targon: ["#c8beff", "star"],
    bandlecity: ["#d6ef92", "spore"],
    zaun: ["#a3d585", "bubble"],
  };
  const sprites = new Map(),
    gear = new Image();
  gear.src = root.ARENA_AMBIENT_ASSETS.gear;
  let themes = [],
    fields = [],
    raf = 0,
    lastTime = 0,
    lastDraw = 0,
    elapsed = 0,
    live = false;
  const usable = () =>
    ctx &&
    live &&
    !document.hidden &&
    !document.getElementById("game").hidden &&
    document.body.classList.contains("in-duel") &&
    root.ArenaMotion.enabled &&
    !root.ArenaMotion.reduced;
  function halo(color) {
    if (sprites.has(color)) return sprites.get(color);
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 96;
    const p = sprite.getContext("2d"),
      gradient = p.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.32, color + "88");
    gradient.addColorStop(1, color + "00");
    p.fillStyle = gradient;
    p.fillRect(0, 0, 96, 96);
    sprites.set(color, sprite);
    return sprite;
  }
  function glow(x, y, r, color, alpha = 1, aspect = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(halo(color), x - r, y - r * aspect, r * 2, r * 2 * aspect);
    ctx.globalAlpha = 1;
  }
  function seed(key, side) {
    let value = [...key].reduce(
      (a, c) => (a * 31 + c.charCodeAt(0)) >>> 0,
      97 + side,
    );
    const random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const count = key === "freljord" ? 26 : key === "piltover" ? 12 : 18;
    return Array.from({ length: count }, (_, i) => ({
      x: i % 2 ? 1350 + random() * 210 : 35 + random() * 215,
      y: random() * 500,
      phase: random() * Math.PI * 2,
      speed: 8 + random() * 17,
      size: 1.2 + random() * 2.4,
    }));
  }
  function haze(t, color, strength = 0.14) {
    for (const [i, x] of [110, 1480].entries()) {
      glow(
        x + Math.sin(t * 0.11 + i) * 22,
        240 + Math.cos(t * 0.09 + i) * 95,
        155,
        color,
        strength,
        0.9,
      );
      glow(
        x + Math.sin(t * 0.08 + i) * 35,
        380 + Math.sin(t * 0.12 + i) * 25,
        135,
        color,
        strength,
        0.35,
      );
    }
  }
  function sparks(key, t, particles) {
    const [color, kind] = palettes[key];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    for (const p of particles) {
      const down = ["snow", "petal", "leaf", "sand", "spray"].includes(kind),
        direction = down ? 1 : -1;
      const y = (((p.y + t * p.speed * direction) % 500) + 500) % 500;
      const x = p.x + Math.sin(t * 0.3 + p.phase) * 16;
      // Fade at the edges instead of teleporting visibly on wraparound.
      const edge = Math.min(1, y / 38, (500 - y) / 38),
        alpha = edge * (kind === "dust" ? 0.25 : 0.46);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      if (kind === "leaf" || kind === "petal") {
        ctx.rotate(t * 0.32 + p.phase);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 2.1, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "bubble") {
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2.1, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === "wisp") {
        glow(0, 0, p.size * 5, color, alpha, 0.65);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-10, 7, -5, 22);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (kind === "star") {
        const a = 0.4 + 0.4 * Math.sin(t * 0.65 + p.phase);
        ctx.globalAlpha = alpha * a;
        ctx.fillRect(-p.size * 2, -0.6, p.size * 4, 1.2);
        ctx.fillRect(-0.6, -p.size * 2, 1.2, p.size * 4);
      } else if (kind === "spark" || kind === "ember") {
        ctx.rotate(-0.3);
        ctx.fillRect(0, 0, 1.4, p.size * 2.2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (kind === "snow" ? 0.7 : 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function steam(t, x, y, color, strength = 0.2) {
    for (let i = 0; i < 6; i++) {
      const age = (t * 0.18 + i / 6) % 1,
        drift = Math.sin(age * 5 + i) * 13;
      glow(
        x + drift,
        y - age * 105,
        12 + age * 35,
        color,
        Math.sin(age * Math.PI) * strength,
        0.65,
      );
    }
  }
  function wheel(t, x, y, r, flatten = 1, reverse = 1) {
    if (!gear.complete || !gear.naturalWidth) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, flatten);
    ctx.rotate(t * 0.16 * reverse);
    ctx.drawImage(gear, -r, -r, r * 2, r * 2);
    ctx.restore();
    // A fixed highlight keeps the mechanism seated while its spokes turn.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, flatten);
    ctx.strokeStyle = "#c1a36888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.87, -2.5, -0.5);
    ctx.stroke();
    ctx.restore();
  }
  function current(t, x, y, r, color, flatten = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, flatten);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.35 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, a, a + 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }
  function wind(t, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = 80 + i * 96 + Math.sin(t * 0.18 + i) * 20;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.bezierCurveTo(74, y - 25, 130, y + 20, 260, y - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1340, y + 20);
      ctx.bezierCurveTo(1420, y - 5, 1490, y + 42, 1600, y + 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function environment(key, t) {
    if (key === "piltover") {
      wheel(t, 202, 106, 64);
      wheel(t, 1460, 297, 46, 0.54, -1);
      current(t, 1460, 297, 80, "#85dff1", 0.54);
      steam(t, 270, 345, "#a2dfe3", 0.23);
      steam(t + 2, 1320, 276, "#c1d9dc", 0.18);
      glow(1460, 297, 87, "#51b7d9", 0.1, 0.56);
    } else if (key === "zaun") {
      haze(t, "#7ab96b", 0.16);
      steam(t, 200, 320, "#abd282", 0.3);
      steam(t + 3, 1430, 360, "#85c693", 0.26);
    } else if (key === "shadowisles") {
      haze(t, "#4d938e", 0.16);
      for (const [x, y] of [
        [1305, 253],
        [1480, 268],
        [1345, 336],
        [254, 337],
      ])
        glow(x + Math.sin(t * 0.5 + x) * 2, y, 23, "#72dfd4", 0.28);
    } else if (key === "freljord") {
      haze(t, "#9dbdd4", 0.14);
      wind(t, "#e0f2ff");
    } else if (key === "bilgewater" || key === "rift") {
      const color = key === "rift" ? "#6bb6cb" : "#9ebfc5";
      for (const x of [78, 1515])
        for (let i = 0; i < 3; i++) {
          const a = (t * 0.13 + i / 3) % 1;
          ctx.globalAlpha = Math.sin(a * Math.PI) * 0.22;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(
            x,
            130 + i * 37,
            14 + a * 46,
            4 + a * 10,
            -0.3,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      ctx.globalAlpha = 1;
      if (key === "bilgewater") haze(t, "#b4cece", 0.12);
    } else if (key === "noxus") {
      for (const x of [100, 1490]) {
        glow(x, 340, 47, "#e58a3b", 0.16);
        for (let i = 0; i < 3; i++) {
          const a = (t * 0.5 + i / 3) % 1;
          glow(
            x + Math.sin(a * 8 + i) * 5,
            342 - a * 29,
            10 - a * 6,
            "#ffc273",
            Math.sin(a * Math.PI) * 0.45,
            1.5,
          );
        }
      }
    } else if (key === "shurima") {
      haze(t, "#d0ab6b", 0.1);
      wind(t, "#e7ce95");
    } else if (key === "ionia") {
      haze(t, "#d3b0cf", 0.08);
    } else if (key === "targon") {
      haze(t, "#927dbb", 0.12);
      current(t, 140, 335, 30, "#d6c7fa", 0.5);
    } else if (key === "demacia") {
      for (const x of [245, 1355])
        glow(x, 220 + Math.sin(t * 0.12) * 10, 90, "#f2db9f", 0.075, 2.2);
    } else if (key === "bandlecity") {
      for (let i = 0; i < 6; i++) {
        const x = i % 2 ? 1420 : 160,
          y = 120 + i * 43;
        glow(
          x + Math.sin(t * 0.4 + i) * 22,
          y + Math.cos(t * 0.3 + i) * 18,
          8,
          "#e0ed9b",
          0.35,
        );
      }
    }
  }
  function draw(t) {
    if (!ctx) return;
    const w = arena.clientWidth,
      h = arena.clientHeight,
      scale = Math.min(devicePixelRatio || 1, 1.25);
    if (
      canvas.width !== Math.round(w * scale) ||
      canvas.height !== Math.round(h * scale)
    ) {
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let side = 0; side < 2; side++) {
      ctx.save();
      if (side)
        ctx.setTransform(
          -canvas.width / 1600,
          0,
          0,
          -canvas.height / 1000,
          canvas.width,
          canvas.height / 2,
        );
      else
        ctx.setTransform(
          canvas.width / 1600,
          0,
          0,
          canvas.height / 1000,
          0,
          canvas.height / 2,
        );
      ctx.beginPath();
      ctx.rect(0, 0, 1600, 500);
      ctx.clip();
      environment(themes[side], t + side * 2.7);
      sparks(themes[side], t, fields[side]);
      ctx.restore();
    }
    // Integer-pixel cutouts avoid low-alpha clip-edge residue on narrow canvases.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const inset = Math.floor(canvas.width * (w <= 700 ? 0.1 : 310 / 1600));
    const top = Math.floor(canvas.height * 0.08),
      bottom = Math.ceil(canvas.height * 0.92);
    ctx.clearRect(inset, top, canvas.width - inset * 2, bottom - top);
    const middle = Math.floor(canvas.height / 2),
      gap = Math.ceil(canvas.height * 0.006);
    ctx.clearRect(0, middle - gap, canvas.width, gap * 2 + 1);
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    canvas.dataset.running = "false";
    canvas.hidden = true;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  function tick(now) {
    raf = 0;
    if (!usable()) {
      pause();
      return;
    }
    if (lastTime) elapsed += Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (now - lastDraw >= 1000 / 24) {
      draw(elapsed);
      lastDraw = now;
    }
    raf = requestAnimationFrame(tick);
  }
  function sync(s) {
    if (s) live = s.winner === null;
    if (!usable() || themes.length !== 2) {
      pause();
      return;
    }
    canvas.hidden = false;
    canvas.dataset.running = "true";
    if (!raf) {
      draw(elapsed);
      raf = requestAnimationFrame(tick);
    }
  }
  root.ArenaAmbient = {
    enter(keys) {
      pause();
      themes = keys.map((k) => (Object.hasOwn(palettes, k) ? k : "rift"));
      fields = themes.map(seed);
      elapsed = 0;
      canvas.dataset.localTheme = themes[0];
      canvas.dataset.enemyTheme = themes[1];
    },
    sync,
    pause,
    get running() {
      return Boolean(raf);
    },
  };
  canvas.hidden = true;
  new ResizeObserver(() => {
    if (usable() && themes.length === 2) draw(elapsed);
  }).observe(arena);
  document.addEventListener("visibilitychange", () => sync());
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    () => sync(),
  );
  document
    .getElementById("motion-toggle")
    .addEventListener("click", () => queueMicrotask(() => sync()));
})(window);
