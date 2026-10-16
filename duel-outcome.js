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
    return a.finished.catch(() => {}).finally(() => { a.cancel(); animations.delete(a); });
  }
  function cancel() {
    epoch++;
    root.NativeOutcome?.stop();
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
    const own = epoch, local = document.createElement("section");
    overlay = local;
    local.id = "duel-ending";
    local.dataset.outcome = s.winner === "draw" ? "draw" : s.winner === 0 ? "victory" : "defeat";
    local.setAttribute("aria-label", "Animação de fim do duelo");
    const veil = document.createElement("div");
    veil.className = "outcome-veil"; veil.setAttribute("aria-hidden", "true");
    const skip = document.createElement("button");
    skip.textContent = "Pular animação"; skip.className = "outcome-skip"; skip.onclick = cancel;
    local.append(veil,skip); document.body.append(local);
    document.body.classList.add("ending-duel");
    animate(veil,[{opacity:0},{opacity:1}],350);
    const defeated = s.winner === "draw" ? [0,1] : [1-s.winner], views=[];
    root.NexusView.sync();
    for (const side of defeated) {
      const plate=document.getElementById(side ? "enemy-nexus" : "my-nexus");
      const source=plate.querySelector(plate.classList.contains("has-nexus-model") ? "canvas" : ".nexus-fallback");
      const rect=(source || plate).getBoundingClientRect(), size=Math.max(rect.width,rect.height)*4;
      const host=document.createElement("div"); host.className="outcome-native-nexus";
      host.setAttribute("aria-hidden","true");
      Object.assign(host.style,{left:rect.x+rect.width/2-size/2+"px",top:rect.y+rect.height/2-size/2+"px",width:size+"px",height:size+"px"});
      local.append(host);
      const model=root.NATIVE_NEXUS_END_DATA[side ? "red" : "blue"];
      const view=root.NativeOutcome.show(host,side ? "red" : "blue",true,model);
      if (view) { views.push(view); plate.classList.add("nexus-fallen"); }
    }
    skip.focus({preventScroll:true}); stage("nexus-break");
    Promise.all(views.map(v=>v.finished)).then(()=>{
      for(const v of views) v.dispose();
      local.remove();
      if(overlay===local) { overlay=null; document.body.classList.remove("ending-duel"); }
    });
    const delay=root.NATIVE_OUTCOME_DATA.models[local.dataset.outcome].bannerStart*1000;
    await animate(skip,[{opacity:1},{opacity:1}],delay,0,"linear");
    if(own!==epoch) return;
  }
  function reveal(dialog, winner) {
    dialog.dataset.outcome =
      winner === "draw" ? "draw" : winner === 0 ? "victory" : "defeat";
    root.NativeOutcome.show(dialog.querySelector('#result-native-art'), dialog.dataset.outcome, fullMotion());
    stage("result");
    if (!fullMotion()) return;
    animate(dialog, [{ opacity: 0 }, { opacity: 1 }], 300);
    for (const [selector, delay] of [
      ["#result-title", 350],
      ["#result-copy", 360],
      ["#campaign-result", 400],
      [".result-actions", 480],
    ]) {
      const el = dialog.querySelector(selector);
      if (el)
        animate(
          el,
          [
            { opacity: 0, transform: "translateY(8px)", filter: "blur(2px)" },
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
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  root.DuelOutcome = { play, reveal, cancel };
})(window);
