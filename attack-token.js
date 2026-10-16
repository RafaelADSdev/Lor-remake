/* Native token meshes baked to sprites, animated with source Unity transform samples. */
(function (root) {
  "use strict";
  const data = root.ATTACK_TOKEN_DATA;
  function sprite(name) {
    const image = document.createElement("img");
    image.src = "assets/arenas/token/" + name + ".png";
    image.alt = "";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  function createView(token, side) {
    const sword = document.createElement("span"), blade = sprite("blade"), medal = sprite("defense-shield");
    const flame = document.createElement("span");
    flame.className = "token-flame";
    flame.setAttribute("aria-hidden", "true");
    flame.hidden = true;
    token.style.setProperty("--token-angle", (data.nativeAngle + side * 180) + "deg");
    token.dataset.side = side;
    sword.className = "token-sword";
    blade.className = "token-blade";
    medal.className = "token-defense";
    const caption = document.createElement("span");
    caption.className = "token-state-caption";
    caption.setAttribute("aria-hidden", "true");
    sword.append(flame, blade);
    token.replaceChildren(medal, sword, caption);
    const animations = new Set();
    let previous = null, state = null, epoch = 0;

    function enabled() {
      return root.ArenaMotion.enabled && !root.ArenaMotion.reduced &&
        !document.hidden && document.body.classList.contains("in-duel") && state?.winner === null;
    }
    function frames(clip, track) {
      return clip.offsets.map((offset, index) => {
        const channel = track.channels, p = channel.position?.[index] || [0, 0, 0],
          scale = channel.scale?.[index] || [1, 1, 1], q = channel.rotation?.[index];
        let rotation = "";
        if (q) {
          const length = Math.hypot(...q), w = Math.max(-1, Math.min(1, q[3] / length)),
            angle = 2 * Math.acos(w), axis = Math.hypot(q[0], q[1], q[2]);
          if (axis > 0.000001)
            rotation = ` rotate3d(${-q[0]/axis},${-q[1]/axis},${q[2]/axis},${angle}rad)`;
        } else if (channel.euler) {
          const e = channel.euler[index];
          rotation = ` rotateZ(${e[2]}deg) rotateY(${-e[1]}deg) rotateX(${-e[0]}deg)`;
        }
        return { offset, transform:
          `translate3d(calc(var(--token-unit) * ${-p[0]}),calc(var(--token-unit) * ${-p[1]}),calc(var(--token-unit) * ${p[2]}))` +
          rotation + ` scale3d(${scale.join(",")})` };
      });
    }
    function play(element, keyframes, clip, iterations = 1) {
      const animation = element.animate(keyframes, { duration: clip.duration * 1000, easing: "linear", iterations });
      animations.add(animation);
      return animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    }
    function stop() {
      epoch++;
      for (const animation of animations) animation.cancel();
      animations.clear();
      sword.querySelector(".token-fragments")?.remove();
      blade.hidden = false;
      flame.hidden = true;
      blade.removeAttribute("data-native-clip");
      token.removeAttribute("data-native-transition");
    }
    function idle() {
      if (!enabled() || !previous?.attack) return;
      const clip = data.clips.idle, track = clip.tracks.find(t => t.path.endsWith("/Sword"));
      blade.dataset.nativeClip = "idle";
      flameLoop();
      play(blade, frames(clip, track), clip, Infinity);
    }
    function flameLoop() {
      if (!enabled()) return;
      flame.hidden = false;
      if (flame.getAnimations().length) return;
      const count = data.flame.tilesX * data.flame.tilesY;
      const samples = Array.from({ length: count + 1 }, (_, index) => {
        const tile = index % count;
        return { offset: index/count, easing: "steps(1, end)",
          maskPosition: `${tile % data.flame.tilesX * 100/(data.flame.tilesX-1)}% ${Math.floor(tile/data.flame.tilesX)*100/(data.flame.tilesY-1)}%` };
      });
      play(flame, samples, data.flame, Infinity);
    }
    async function gesture(name, current) {
      const clip = data.clips[name], track = clip.tracks.find(t => t.path.endsWith("/Sword"));
      blade.dataset.nativeClip = name;
      flameLoop();
      await play(blade, frames(clip, track), clip);
      if (current === epoch) idle();
    }
    async function fragments(name, current) {
      const clip = data.clips[name], holder = document.createElement("span");
      holder.className = "token-fragments";
      blade.hidden = true;
      flame.hidden = true;
      token.dataset.nativeTransition = name;
      sword.append(holder);
      const pending = [];
      for (let i = 1; i <= 5; i++) {
        const track = clip.tracks.find(t => t.path.endsWith("AttackToken_Fracture_00" + i)), image = sprite("shard" + i);
        holder.append(image);
        const samples = frames(clip, track);
        // Source scale/flight stay intact; opacity substitutes the Unity erosion shader.
        for (const frame of samples) frame.opacity = name === "consume" ? Math.min(1, (1-frame.offset)*4) : Math.min(1, frame.offset*10);
        pending.push(play(image, samples, clip));
      }
      if (name === "assemble") {
        const track = clip.tracks.find(t => t.path === "AttackToken_Fracture_MD");
        pending.push(play(holder, frames(clip, track), clip));
      }
      await Promise.all(pending);
      if (current !== epoch) return;
      holder.remove();
      blade.hidden = false;
      sword.hidden = !previous.attack;
      token.removeAttribute("data-native-transition");
      if (previous.attack) gesture("ignite", current);
    }
    function render(next) {
      state = next;
      const attack = root.Engine.canAttack(next, side),
        declaring = attack && side === 0 && document.querySelector(".arena").dataset.arenaPhase === "prepare",
        moving = enabled();
      const key = next.winner !== null ? "finished" : attack ? (declaring ? "declaring" : "available") :
        root.Engine.canAttack(next, 1 - side) || next.combat?.owner === 1 - side ? "defending" : "spent";
      const owner = side ? "Bot" : "Você";
      token.dataset.priority = String(next.priority === side);
      token.setAttribute("aria-label", owner + (attack ? " tem o token de ataque" : key === "defending" ? " está na defesa" : " está sem token de ataque e pode defender") + (next.priority === side ? " · com a iniciativa" : ""));
      token.title = token.getAttribute("aria-label");
      if (previous?.state === next && previous.key === key && previous.moving === moving) return;
      const old = previous;
      stop();
      previous = { state: next, key, attack, moving };
      token.dataset.tokenState = key;
      token.classList.toggle("has-attack", attack);
      caption.textContent = owner.toUpperCase() + " · " + (attack ? "ATAQUE" : "DEFESA");
      medal.hidden = attack;
      sword.hidden = !attack;
      if (!moving) return;
      const current = epoch;
      if (attack && (!old?.attack || old.state !== next)) fragments("assemble", current);
      else if (!attack && old?.attack && old.state === next) {
        sword.hidden = false;
        if (side === 1) gesture("punch", current).then(() => { if (current === epoch) fragments("consume", current); });
        else fragments("consume", current);
      } else if (declaring && old?.key !== "declaring") gesture("punch", current);
      else if (attack) idle();
    }
    const api = {
      render,
      cancel() { stop(); previous = null; state = null; },
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { stop(); if (previous) previous.moving = false; }
      else if (state) render(state);
    });
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { if (state) render(state); });
    return api;
  }
  const views = ["arena-token", "enemy-arena-token"].map((id, side) => {
    const element = document.getElementById(id);
    return element ? createView(element, side) : null;
  }).filter(Boolean);
  root.ArenaToken = {
    render(state) { for (const view of views) view.render(state); },
    cancel() { for (const view of views) view.cancel(); },
    paintCoin(coin, side, state) {
      const attack = root.Engine.canAttack(state, side), face = attack ? "attack" : "defense";
      if (coin.dataset.face === face && coin.dataset.faceSide === String(side)) return;
      coin.dataset.face = face;
      coin.dataset.faceSide = String(side);
      coin.classList.toggle("has-attack", attack);
      coin.style.setProperty("--token-angle", (data.nativeAngle + side*180) + "deg");
      const image = sprite(attack ? "blade" : "defense-shield");
      image.className = attack ? "token-blade" : "token-defense";
      if (attack) {
        const sword = document.createElement("span");
        sword.className = "token-sword";
        sword.append(image);
        coin.replaceChildren(sword);
      } else coin.replaceChildren(image);
    },
  };
})(window);
