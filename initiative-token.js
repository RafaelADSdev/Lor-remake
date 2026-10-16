/* Fixed sockets; the attack coin moves only when round ownership changes. */
(function (root) {
  "use strict";
  const coin = document.getElementById("initiative-token"), stage = document.querySelector(".arena"),
    data = root.INITIATIVE_TOKEN_DATA, track = data.tracks[0],
    sockets = [document.getElementById("arena-token"), document.getElementById("enemy-arena-token")];
  let state = null, owner = null, roundNumber = null, animation = null, epoch = 0, layoutFrame = 0;
  function moving() {
    return root.ArenaMotion.enabled && !root.ArenaMotion.reduced && !document.hidden &&
      document.body.classList.contains("in-duel") && state?.winner === null;
  }
  function position(side) {
    const area = stage.getBoundingClientRect();
    const housing = document.getElementById("native-action-housing");
    if (housing) {
      const source = data.socketProjection, circle = source.sockets[side], box = housing.getBBox(), matrix = housing.getScreenCTM(),
        center = new DOMPoint(box.x + circle.center[0]/source.spriteSize[0]*box.width,
          box.y + circle.center[1]/source.spriteSize[1]*box.height).matrixTransform(matrix),
        size = circle.radius*2*box.width/source.spriteSize[0]*Math.hypot(matrix.a, matrix.b)*1.07;
      return { x: center.x - area.x - size/2, y: center.y - area.y - size/2, size };
    }
    const size = innerWidth <= 700 ? 30 : 38;
    const button = document.getElementById("pass").getBoundingClientRect();
    return { x: button.x-area.x+button.width/2-size/2-32,
      y: button.y-area.y+button.height/2-size/2+(side === 0 ? 110 : -110), size };
  }
  function stop() {
    epoch++;
    animation?.cancel(); animation = null;
    coin.removeAttribute("data-transfer-from"); coin.removeAttribute("data-transfer-to");
  }
  function place(side) {
    const point = position(side);
    coin.style.left = point.x + "px"; coin.style.top = point.y + "px";
    coin.style.width = point.size + "px"; coin.style.height = point.size + "px";
    coin.style.setProperty("--token-art-size", point.size*1.35 + "px");
    for (const [index, socket] of sockets.entries()) {
      const p = position(index);
      socket.style.left = p.x + "px"; socket.style.top = p.y + "px";
      socket.style.right = "auto";
      socket.style.width = p.size + "px"; socket.style.height = p.size + "px";
      socket.style.setProperty("--token-art-size", p.size*1.35 + "px");
      socket.style.setProperty("--token-unit", p.size*1.35/20 + "px");
    }
    // Preserve a 44px pointer/keyboard target around the lower socket.
    const attack = document.getElementById("attack"), parent = attack.offsetParent;
    if (parent) {
      const p = position(0), area = stage.getBoundingClientRect(), origin = parent.getBoundingClientRect();
      attack.style.left = p.x + p.size/2 + area.x - origin.x - parent.clientLeft - 22 + "px";
      attack.style.top = p.y + p.size/2 + area.y - origin.y - parent.clientTop - 22 + "px";
      attack.style.right = "auto";
    }
    return point;
  }
  function settle() { stop(); if (owner !== null) place(owner); }
  // Rendering can precede the menu/duel class change. Read the final HUD geometry next frame.
  function syncLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => { if (state && !animation) place(owner); });
  }
  function render(next) {
    const oldState = state, previous = owner, previousRound = roundNumber, wasHidden = coin.hidden,
      target = next.token;
    state = next;
    roundNumber = next.round;
    coin.hidden = next.phase === "mulligan";
    coin.dataset.owner = String(target);
    root.ArenaToken.paintCoin(coin, target, next);
    owner = target;
    if (coin.hidden || wasHidden || !moving() || oldState !== next || previous === null) { settle(); syncLayout(); return; }
    if (previous === target || previousRound === next.round) { if (!animation) { place(target); syncLayout(); } return; }
    // Start a rapid reversal from the coin's current visible position, without queuing stale owners.
    const current = coin.getBoundingClientRect(), area = stage.getBoundingClientRect();
    const startCenter = { x: current.x - area.x + current.width/2,
      y: current.y - area.y + current.height/2 };
    stop();
    const end = place(target), start = { x: startCenter.x-end.size/2, y: startCenter.y-end.size/2 },
      other = position(1-target), channel = track.channels, first = channel.position[0], last = channel.position.at(-1),
      unit = Math.abs(end.y+end.size/2 - other.y-other.size/2) / Math.abs(last[1]-first[1]);
    const frames = data.offsets.map((offset, index) => {
      const p = channel.position[index], e = channel.euler[index], scale = channel.scale[index],
        progress = (p[1]-first[1]) / (last[1]-first[1]);
      return { offset, transform:
        `translate3d(${(start.x-end.x)*(1-progress)}px,${(start.y-end.y)*(1-progress)}px,0)` +
        ` perspective(450px) translateZ(${(p[2]-first[2])*unit}px) rotateX(${-e[0]}deg) rotateY(${-e[1]}deg) rotateZ(${e[2]}deg) scale3d(${scale.join(",")})` };
    });
    const currentEpoch = epoch;
    coin.dataset.transferFrom = String(previous); coin.dataset.transferTo = String(target);
    const flight = coin.animate(frames, { duration: data.duration*1000, easing: "linear", fill: "both" });
    animation = flight;
    flight.finished.then(() => { if (epoch === currentEpoch) settle(); }).catch(() => {});
  }
  root.ArenaInitiative = {
    render,
    cancel() { stop(); cancelAnimationFrame(layoutFrame); state = null; owner = null; roundNumber = null; coin.hidden = true; },
  };
  const resize = new ResizeObserver(() => { if (state) { settle(); syncLayout(); } });
  resize.observe(stage);
  resize.observe(document.getElementById("mana-wheel"));
  document.addEventListener("visibilitychange", () => { if (state) settle(); });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { if (state) render(state); });
})(window);
