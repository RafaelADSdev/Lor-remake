/* Authored end-of-duel presentation; uses the engine's settled winner. */
(function (root) {
  const animations = new Set();
  let epoch = 0,
    overlay = null;
  const fullMotion = () =>
    root.ArenaMotion.enabled && !root.ArenaMotion.reduced;
  function stage(phase) {
    document.dispatchEvent(
      new CustomEvent("duel-outcome-stage", { detail: { phase } }),
    );
  }
  function animate(el, frames, duration, delay = 0, easing = "cubic-bezier(.22,1,.36,1)") {
    const a = el.animate(frames, {
      duration,
      delay,
      fill: "both",
      easing,
    });
    animations.add(a);
    return a.finished.catch(() => {}).finally(() => animations.delete(a));
  }
  function cancel() {
    epoch++;
    for (const a of animations) a.cancel();
    animations.clear();
    overlay?.remove();
    overlay = null;
    document.body.classList.remove("ending-duel");
    document
      .querySelectorAll(".nexus-fallen")
      .forEach((el) => el.classList.remove("nexus-fallen"));
  }
  async function play(s) {
    cancel();
    if (!fullMotion()) return;
    const own = epoch;
    overlay = document.createElement("section");
    overlay.id = "duel-ending";
    overlay.dataset.outcome = s.winner === "draw" ? "draw" : s.winner === 0 ? "victory" : "defeat";
    overlay.setAttribute("aria-label", "Animação de fim do duelo");
    const veil = document.createElement("div");
    veil.className = "outcome-veil";
    veil.setAttribute("aria-hidden", "true");
    const skip = document.createElement("button");
    skip.textContent = "Pular animação";
    skip.className = "outcome-skip";
    skip.onclick = cancel;
    overlay.append(veil, skip);
    document.body.append(overlay);
    document.body.classList.add("ending-duel");
    const work = [animate(veil, [{ opacity: 0 }, { opacity: 1 }], 550)];
    const defeated = s.winner === "draw" ? [0, 1] : [1 - s.winner];
    root.NexusView.sync();
    for (const side of defeated) {
      const plate = document.getElementById(side ? "enemy-nexus" : "my-nexus");
      const source = plate.querySelector(plate.classList.contains("has-nexus-model") ? "canvas" : ".nexus-fallback"),
        rect = (source || plate).getBoundingClientRect();
      // Copy the original gem pixels while the WebGL drawing buffer is fresh.
      const snapshot = document.createElement("canvas");
      snapshot.width = source?.width || 128;
      snapshot.height = source?.height || 128;
      const ctx = snapshot.getContext("2d");
      if (source) ctx.drawImage(source, 0, 0);
      else {
        ctx.fillStyle = side ? "#e04978" : "#509aff";
        ctx.beginPath();
        ctx.arc(64, 64, 42, 0, Math.PI * 2);
        ctx.fill();
      }
      const burst = document.createElement("div");
      burst.className = "outcome-nexus-burst";
      const color = side ? "#ff709b" : "#72c8ff";
      burst.style.setProperty("--outcome-color", color);
      Object.assign(burst.style, {
        left: rect.x + "px",
        top: rect.y + "px",
        width: rect.width + "px",
        height: rect.height + "px",
      });
      burst.setAttribute("aria-hidden", "true");
      overlay.append(burst);
      work.push(
        animate(
          burst,
          [
            { opacity: 0, transform: "scale(.94)" },
            { opacity: 0.65, transform: "scale(1.35)", offset: 0.34 },
            { opacity: 1, transform: "scale(2.3)", offset: 0.42 },
            { opacity: 0, transform: "scale(3.4)" },
          ],
          1550,
          0,
          "linear",
        ),
      );
      // The charge holds the intact silhouette before the fragments separate.
      // All effects originate at the actual gem, including on narrow screens.
      for (let i = 0; i < 2; i++) {
        const wave = document.createElement("div");
        wave.className = "outcome-shockwave";
        wave.setAttribute("aria-hidden", "true");
        Object.assign(wave.style, {
          left: rect.x + rect.width / 2 + "px",
          top: rect.y + rect.height / 2 + "px",
          width: rect.width * 2 + "px",
          height: rect.height * 2 + "px",
          "--outcome-color": color,
        });
        overlay.append(wave);
        work.push(animate(wave, [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.45)" },
          { opacity: 0.8, offset: 0.12, transform: "translate(-50%,-50%) scale(.8)" },
          { opacity: 0, transform: `translate(-50%,-50%) scale(${i ? 3.6 : 2.7})` },
        ], 1050, 560 + i * 130));
      }
      for (let i = 0; i < 28; i++) {
        const spark = document.createElement("i");
        spark.className = "outcome-spark";
        spark.setAttribute("aria-hidden", "true");
        const angle = i * 2.39996,
          distance = rect.width * (1.1 + (i % 5) * 0.32);
        Object.assign(spark.style, {
          left: rect.x + rect.width / 2 + "px",
          top: rect.y + rect.height / 2 + "px",
          "--outcome-color": color,
        });
        overlay.append(spark);
        work.push(animate(spark, [
          { opacity: 0, transform: "translate(-50%,-50%)" },
          { opacity: 1, offset: 0.08, transform: `translate(${Math.cos(angle) * 20}px,${Math.sin(angle) * 20}px)` },
          { opacity: 0, transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance + 65}px)` },
        ], 850 + (i % 4) * 100, 560));
      }
      for (let i = 0; i < 14; i++) {
        const shard = snapshot.cloneNode();
        shard.getContext("2d").drawImage(snapshot, 0, 0);
        shard.className = "outcome-shard";
        shard.setAttribute("aria-hidden", "true");
        const a = (i / 14) * Math.PI * 2,
          b = ((i + 1) / 14) * Math.PI * 2;
        const point = (angle) =>
          `${50 + Math.cos(angle) * 73}% ${50 + Math.sin(angle) * 73}%`;
        Object.assign(shard.style, {
          left: rect.x + "px",
          top: rect.y + "px",
          width: rect.width + "px",
          height: rect.height + "px",
          clipPath: `polygon(50% 50%,${point(a)},${point(b)})`,
        });
        overlay.append(shard);
        const angle = (a + b) / 2,
          distance = rect.width * (1.1 + (i % 3) * 0.38);
        work.push(
          animate(
            shard,
            [
              { opacity: 1, transform: "translate(0,0) rotate(0deg)" },
              {
                opacity: 0.9,
                offset: 0.2,
                transform: `translate(${Math.cos(angle) * 8}px,${Math.sin(angle) * 8}px) rotate(0deg)`,
              },
              {
                opacity: 0,
                transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance + 36}px) rotate(${(i % 2 ? 1 : -1) * 22}deg)`,
              },
            ],
            1200 + (i % 3) * 55,
            560,
          ),
        );
      }
      plate.classList.add("nexus-fallen");
    }
    skip.focus({ preventScroll: true });
    stage("nexus-break");
    await Promise.all(work);
    if (own !== epoch) return;
    overlay?.remove();
    overlay = null;
    document.body.classList.remove("ending-duel");
  }
  function reveal(dialog, winner) {
    dialog.dataset.outcome =
      winner === "draw" ? "draw" : winner === 0 ? "victory" : "defeat";
    stage("result");
    if (!fullMotion()) return;
    animate(dialog, [{ opacity: 0 }, { opacity: 1 }], 350);
    for (const wing of dialog.querySelectorAll(".crest-wing")) {
      animate(wing, [
        { opacity: 0, transform: "scaleX(.5)" },
        { opacity: 1, transform: "scaleX(1)" },
      ], 750, 120);
    }
    const rays = dialog.querySelector(".result-rays");
    if (rays) animate(rays, [
      { opacity: 0, transform: "translateX(-50%) scale(.9)" },
      { opacity: 0.7, offset: 0.4, transform: "translateX(-50%) scale(1)" },
      { opacity: 0.3, transform: "translateX(-50%) scale(1.06)" },
    ], 1600);
    const rule = dialog.querySelector(".result-rule");
    if (rule) animate(rule, [
      { opacity: 0, transform: "scaleX(.2)" },
      { opacity: 1, transform: "scaleX(1)" },
    ], 700, 300);
    for (const [selector, delay] of [
      [".result-crest", 0],
      [".eyebrow", 180],
      ["#result-title", 280],
      ["#result-copy", 470],
      [".result-actions", 650],
    ]) {
      const el = dialog.querySelector(selector);
      if (el)
        animate(
          el,
          [
            { opacity: 0, transform: "translateY(10px)", filter: "blur(3px)" },
            { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
          ],
          460,
          delay,
        );
    }
  }
  document.addEventListener("keydown", (e) => {
    if (overlay && e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    () => {
      if (!fullMotion()) cancel();
    },
  );
  document.getElementById("motion-toggle").addEventListener("click", () => {
    queueMicrotask(() => {
      if (!fullMotion()) cancel();
    });
  });
  root.DuelOutcome = { play, reveal, cancel };
})(window);
