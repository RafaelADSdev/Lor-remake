/* Presentation effects only. The engine remains synchronous and deterministic. */
(function (root) {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let forceFull = false;
  const isReduced = () => reduced.matches && !forceFull;
  const layer = document.getElementById("effects-layer");
  const active = new Set();
  const profile = root.LOR_MOTION_PROFILE,
    O = profile.observed,
    T = profile.adapted;
  const masked = new Set();
  let sequenceEpoch = 0;
  const unitNode = (id) => document.querySelector(`.board [data-id="${id}"]`);
  const plate = (i) =>
    document.getElementById(i === 0 ? "my-nexus" : "enemy-nexus");
  const nexusRect = (side) =>
    (
      plate(side).querySelector(".nexus-crystal") || plate(side)
    ).getBoundingClientRect();
  const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  function stage(phase, extra = {}) {
    layer.dataset.phase = phase;
    document.dispatchEvent(
      new CustomEvent("arena-motion-stage", { detail: { phase, ...extra } }),
    );
  }
  function conceal(el) {
    if (el) {
      masked.add(el);
      el.style.visibility = "hidden";
    }
  }
  function restore() {
    for (const el of masked) el.style.visibility = "";
    masked.clear();
  }
  function sourceTexture(rect, name, cls = "") {
    const el = document.createElement("div");
    el.className = "fx-texture " + cls;
    Object.assign(el.style, {
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      backgroundImage: `url('assets/lor-motion/${name}')`,
    });
    layer.append(el);
    return el;
  }
  async function sourceImpact(rect) {
    const el = sourceTexture(rect, "death-crack.png", "fx-hit-flash");
    await animate(
      el,
      [
        { opacity: 0, transform: "scale(.8)" },
        { opacity: 1, transform: "scale(1)", offset: 0.25 },
        { opacity: 0, transform: "scale(1.1)" },
      ],
      220,
    );
    el.remove();
  }
  async function cardReveal(card, origin, destination, ms, epoch, kind) {
    stage(kind + "-reveal", { card: card.code });
    tone("summon");
    const arena = document.querySelector(".arena").getBoundingClientRect(),
      width = Math.min(215, innerWidth * 0.4),
      height = width * 1.505;
    const rect = {
      x: arena.x + arena.width * 0.5 - width / 2,
      y: Math.max(
        8,
        Math.min(
          arena.y + arena.height * 0.42 - height / 2,
          innerHeight - height - 8,
        ),
      ),
      width,
      height,
    };
    const el = document.createElement("div");
    el.className = "fx-reveal";
    el.dataset.cardCode = card.code;
    const img = document.createElement("img");
    img.src = root.CARD_DATA.cards[card.code].portrait;
    img.alt = card.name;
    el.append(img);
    Object.assign(el.style, {
      left: rect.x + "px",
      top: rect.y + "px",
      width: width + "px",
      height: height + "px",
    });
    layer.append(el);
    const from = center(origin),
      middle = center(rect),
      to = center(destination),
      enter = 180,
      travel = T.unitTravelMs;
    await animate(
      el,
      [
        {
          opacity: 0.5,
          transform: `translate(${from.x - middle.x}px,${from.y - middle.y}px) scale(${origin.width / width}) rotateY(${kind === "draw" ? 65 : 12}deg)`,
        },
        { opacity: 1, transform: "translate(0,0) scale(1) rotateY(0deg)" },
      ],
      enter,
    );
    if (epoch !== sequenceEpoch) {
      el.remove();
      return;
    }
    if (card.champion && kind !== "draw") {
      stage("native-creation", { card: card.code });
      const item = { rect, clone: el.cloneNode(true) };
      el.style.visibility = "hidden";
      await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const shard = ghost(item, "fx-native-creation");
          shard.dataset.nativeClip = "creation";
          shard.style.clipPath = `polygon(${(i * 100) / 6}% 0,${((i + 1) * 100) / 6}% 0,${((i + 1) * 100) / 6}% 100%,${(i * 100) / 6}% 100%)`;
          return animate(
            shard,
            root.CurrentMotion.shardFrames("creation", i, width, height, 6),
            420,
            0,
            "linear",
          ).finally(() => shard.remove());
        }),
      );
      if (epoch !== sequenceEpoch) {
        el.remove();
        return;
      }
      el.style.visibility = "";
    }
    if (kind !== "draw") el.dataset.nativeClip = "reveal";
    const shine = sourceTexture(rect, "creation-shine.png", "fx-reveal-shine");
    const hold = Math.max(O.handRevealFixedMs, ms - enter - travel);
    await Promise.all([
      animate(
        shine,
        [
          { opacity: 0, transform: "translateX(-20%)" },
          { opacity: 0.6, transform: "translateX(0)", offset: 0.5 },
          { opacity: 0, transform: "translateX(20%)" },
        ],
        hold,
      ),
      kind === "draw"
        ? Promise.resolve()
        : animate(
            el,
            root.CurrentMotion.revealFrames(width, height),
            hold,
            0,
            "linear",
          ),
    ]);
    shine.remove();
    if (epoch !== sequenceEpoch) {
      el.remove();
      return;
    }
    stage(kind === "draw" ? "draw-to-hand" : "transform-to-pog", {
      card: card.code,
    });
    const end = `translate(${to.x - middle.x}px,${to.y - middle.y}px) scale(${destination.width / width},${destination.height / height})`;
    await animate(
      el,
      [
        { opacity: 1, transform: "translate(0,0) scale(1)" },
        { opacity: 0.8, transform: end, offset: 0.88 },
        { opacity: 0, transform: end },
      ],
      travel,
    );
    el.remove();
  }
  async function fragment(item, element, epoch) {
    stage("death-marked-dying");
    const crack = sourceTexture(item.rect, "death-crack.png", "fx-death-crack");
    await animate(crack, [{ opacity: 0 }, { opacity: 1 }], 90);
    crack.remove();
    if (epoch !== sequenceEpoch) return;
    stage("death-exit");
    element.style.opacity = "0";
    const clips = [
      "polygon(0 0,55% 0,45% 45%,0 35%)",
      "polygon(55% 0,100% 0,100% 42%,45% 45%)",
      "polygon(0 35%,45% 45%,52% 73%,0 100%)",
      "polygon(45% 45%,100% 42%,100% 100%,52% 73%)",
      "polygon(0 100%,52% 73%,100% 100%)",
    ];
    await Promise.all(
      clips.map((clip, i) => {
        const p = ghost(item, "fx-shard");
        p.style.clipPath = clip;
        const kind = item.clone.classList.contains("champion-card")
          ? "championDeath"
          : "death";
        p.dataset.nativeClip = kind;
        return animate(
          p,
          root.CurrentMotion.shardFrames(
            kind,
            i,
            item.rect.width,
            item.rect.height,
            clips.length,
          ),
          kind === "championDeath" ? 900 : T.deathMs,
          i * 10,
          "linear",
        ).finally(() => p.remove());
      }),
    );
  }
  async function displayNexus(side, value) {
    const el = plate(side),
      old = Number(el.querySelector("b").textContent),
      rect = nexusRect(side);
    el.querySelector("b").textContent = value;
    if (value === old) return;
    if (value > old) return floatDamage(rect, old - value, 480);
    root.NexusView?.impact(side);
    await Promise.all([
      floatDamage(rect, old - value),
      animate(
        el,
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)", offset: 0.3 },
          { transform: "translateX(3px)", offset: 0.6 },
          { transform: "translateX(0)" },
        ],
        220,
      ),
    ]);
  }
  async function combatSequence(before, state, trace, epoch) {
    return root.CombatMotion.play({
      before,
      state,
      trace,
      epoch,
      current: () => epoch === sequenceEpoch,
      center,
      stage,
      animate,
      ghost,
      conceal,
      restore,
      unitNode,
      plate,
      nexusRect,
      layer,
      impact: (key) => {
        if (sound) root.RegionalAudio?.sound(key, 0.6);
      },
      floatDamage,
      displayNexus,
      fragment,
    });
  }
  async function buffSpell(before, state, side, card, epoch) {
    const old = before.state.players[side].board.find((c) => {
      const now = state.players[side].board.find((u) => u.id === c.id);
      return (
        now &&
        (now.attack !== c.attack ||
          now.health !== c.health ||
          JSON.stringify(now.keywords) !== JSON.stringify(c.keywords))
      );
    });
    if (!old) return;
    const unit = unitNode(old.id),
      item = before.nodes.get(old.id);
    const rect = unit?.getBoundingClientRect() || item?.rect;
    if (!rect) return;
    const final = state.players[side].board.find((c) => c.id === old.id);
    const pieces = [],
      oldGhost = item ? ghost(item, "fx-combat-card") : null;
    if (oldGhost) {
      pieces.push(oldGhost);
      conceal(unit);
    }
    const crimson = card.code === "01NX027";
    const position = (el) => {
      Object.assign(el.style, {
        left: rect.x + "px",
        top: rect.y + "px",
        width: rect.width + "px",
        height: rect.height + "px",
      });
      el.style.setProperty("--buff-color", crimson ? "#ff725c" : "#75dcff");
      layer.append(el);
      pieces.push(el);
      return el;
    };
    try {
      const reveal = document.createElement("img");
      reveal.className = "fx-buff-card";
      reveal.src = card.portrait;
      reveal.alt = "";
      const source = before.nodes.get(card.id)?.rect,
        origin = source ? center(source) : { x: innerWidth / 2, y: 120 };
      const middle = { x: innerWidth / 2, y: innerHeight * 0.46 };
      Object.assign(reveal.style, {
        left: middle.x + "px",
        top: middle.y + "px",
      });
      layer.append(reveal);
      pieces.push(reveal);
      stage("buff-reveal", { card: card.code });
      tone("summon");
      await animate(
        reveal,
        [
          {
            opacity: 0,
            transform: `translate(calc(-50% + ${origin.x - middle.x}px),calc(-50% + ${origin.y - middle.y}px)) scale(.92)`,
          },
          {
            opacity: 1,
            transform: "translate(-50%,-50%) scale(1)",
            offset: 0.65,
          },
          { opacity: 0, transform: "translate(-50%,-54%) scale(1)" },
        ],
        360,
      );
      reveal.remove();
      if (epoch !== sequenceEpoch) return;
      const missile = document.createElement("span");
      missile.className = "fx-buff-missile";
      missile.style.setProperty(
        "--buff-color",
        crimson ? "#ff725c" : "#75dcff",
      );
      Object.assign(missile.style, {
        left: middle.x + "px",
        top: middle.y + "px",
      });
      layer.append(missile);
      pieces.push(missile);
      const dest = center(rect);
      stage("buff-flight", { card: card.code });
      await animate(
        missile,
        [
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
          {
            opacity: 1,
            transform: `translate(calc(-50% + ${dest.x - middle.x}px),calc(-50% + ${dest.y - middle.y}px)) scale(.9)`,
          },
        ],
        180,
      );
      missile.remove();
      if (epoch !== sequenceEpoch) return;
      stage("buff-impact", { card: card.code });
      if (oldGhost) {
        oldGhost.querySelector(".power").textContent = final.attack;
        oldGhost.querySelector(".health").textContent = final.health;
      }
      const rune = position(document.createElement("div"));
      rune.className = "fx-buff-rune";
      const gain = position(document.createElement("div"));
      gain.className = "fx-buff-gain";
      gain.textContent =
        "+" +
        (final.attack - old.attack) +
        (final.maxHealth > old.maxHealth
          ? " | +" + (final.maxHealth - old.maxHealth)
          : " ATAQUE");
      if (final.attack === old.attack && final.maxHealth === old.maxHealth)
        gain.textContent = "HABILIDADE CONCEDIDA";
      const effects = [
        animate(
          rune,
          [
            { opacity: 0, transform: "scale(.95)" },
            { opacity: 1, transform: "scale(1.08)", offset: 0.25 },
            { opacity: 0, transform: "scale(1.2)" },
          ],
          520,
        ),
        animate(
          gain,
          [
            { opacity: 0, transform: "translateY(0)" },
            { opacity: 1, transform: "translateY(-16px)", offset: 0.2 },
            { opacity: 0, transform: "translateY(-40px)" },
          ],
          620,
        ),
      ];
      for (let i = 0; i < 8; i++) {
        const spark = position(document.createElement("i"));
        spark.className = "fx-buff-spark";
        effects.push(
          animate(
            spark,
            [
              {
                opacity: 0,
                transform: `translate(${rect.width / 2}px,${rect.height / 2}px) scale(.9)`,
              },
              { opacity: 1, offset: 0.15 },
              {
                opacity: 0,
                transform: `translate(${rect.width / 2 + Math.cos((i * Math.PI) / 4) * 70}px,${rect.height / 2 + Math.sin((i * Math.PI) / 4) * 90}px) scale(.95)`,
              },
            ],
            420,
          ),
        );
      }
      await Promise.all(effects);
    } finally {
      for (const el of pieces) el.remove();
      if (epoch === sequenceEpoch) restore();
    }
  }
  async function stagedSpell(before, state, side, card, epoch) {
    if (card.effect === "buff")
      return buffSpell(before, state, side, card, epoch);
    let targetSide = ["heal", "buffAll", "rally"].includes(card.effect)
        ? side
        : 1 - side,
      changed;
    for (const index of [side, 1 - side]) {
      const candidate = before.state.players[index].board.find((old) => {
        const now = state.players[index].board.find((c) => c.id === old.id);
        return !now || old.health !== now.health || old.attack !== now.attack;
      });
      if (candidate) {
        changed = candidate;
        targetSide = index;
        break;
      }
    }
    if (!changed) {
      const nexusSide = state.players.findIndex(
        (p, i) => p.nexus !== before.state.players[i].nexus,
      );
      if (nexusSide >= 0) targetSide = nexusSide;
    }
    const target = changed ? unitNode(changed.id) : plate(targetSide),
      rect =
        target?.getBoundingClientRect() || before.nodes.get(changed?.id)?.rect;
    if (!rect) return;
    const item = changed ? before.nodes.get(changed.id) : null,
      oldGhost = item ? ghost(item, "fx-combat-card") : null;
    if (target && changed) conceal(target);
    if (!changed)
      plate(targetSide).querySelector("b").textContent =
        before.state.players[targetSide].nexus;
    const fromRect =
        before.nodes.get(card.id)?.rect ||
        document.getElementById("bot-hand").getBoundingClientRect(),
      from = center(fromRect),
      to = center(rect);
    const orb = document.createElement("span");
    orb.className = "fx-spell";
    Object.assign(orb.style, {
      left: from.x + "px",
      top: from.y + "px",
      opacity: "0",
    });
    layer.append(orb);
    stage("spell-cast", { card: card.code });
    tone("summon");
    await animate(
      layer,
      [{ opacity: 1 }, { opacity: 1 }],
      O.damageOffsetsMs.missile,
    );
    if (epoch !== sequenceEpoch) {
      orb.remove();
      oldGhost?.remove();
      return;
    }
    stage("spell-missile", { card: card.code });
    await animate(
      orb,
      [
        { opacity: 1, transform: "translate(-50%,-50%) scale(.8)" },
        {
          opacity: 1,
          transform: `translate(calc(-50% + ${to.x - from.x}px),calc(-50% + ${to.y - from.y}px)) scale(1)`,
        },
      ],
      O.damageOffsetsMs.impact - O.damageOffsetsMs.missile,
    );
    orb.remove();
    if (epoch !== sequenceEpoch) {
      oldGhost?.remove();
      return;
    }
    stage("spell-impact", { card: card.code });
    tone("hit");
    const effects = [sourceImpact(rect)];
    if (!changed)
      effects.push(displayNexus(targetSide, state.players[targetSide].nexus));
    else {
      const result = state.players[targetSide].board.find(
        (c) => c.id === changed.id,
      );
      if (card.effect === "damage")
        effects.push(
          floatDamage(rect, changed.health - Math.max(0, result?.health || 0)),
        );
      if (result) {
        oldGhost.querySelector(".health").textContent = result.health;
        oldGhost.querySelector(".power").textContent = result.attack;
        effects.push(
          animate(
            oldGhost,
            [{ filter: "brightness(1.8)" }, { filter: "brightness(1)" }],
            250,
          ),
        );
      } else effects.push(fragment(item, oldGhost, epoch));
    }
    await Promise.all(effects);
    oldGhost?.remove();
    if (epoch === sequenceEpoch) {
      restore();
      await Promise.all(state.players.map((p, i) => displayNexus(i, p.nexus)));
    }
  }
  async function change(before, state, trace) {
    if (!enabled || isReduced()) return;
    const epoch = sequenceEpoch;
    document.body.classList.add("motion-playing");
    try {
      if (trace?.kind === "stack") {
        for (const entry of trace.spells) {
          if (!entry.resolved) continue;
          await stagedSpell(
            { state: entry.before, nodes: before.nodes },
            entry.after,
            entry.owner,
            entry.card,
            epoch,
          );
          if (epoch !== sequenceEpoch) return;
        }
        if (trace.combat)
          await combatSequence(
            { state: trace.combatBefore, nodes: before.nodes },
            state,
            trace.combat,
            epoch,
          );
        else
          await fallbackChange(
            {
              state: trace.spells.at(-1)?.after || before.state,
              nodes: before.nodes,
            },
            state,
          );
        return;
      }
      if (trace?.kind === "combat") {
        await combatSequence(before, state, trace, epoch);
        return;
      }
      const remaining = {
        state: structuredClone(before.state),
        nodes: before.nodes,
      };
      for (let side = 0; side < 2; side++)
        for (const c of state.players[side].board.filter(
          (c) =>
            !before.state.players[side].board.some((old) => old.id === c.id),
        )) {
          const el = unitNode(c.id);
          if (!el) continue;
          const dest = el.getBoundingClientRect(),
            origin =
              before.nodes.get(c.id)?.rect ||
              document.getElementById("bot-hand").getBoundingClientRect();
          conceal(el);
          await cardReveal(
            c,
            origin,
            dest,
            O.unitRevealFixedMs,
            epoch,
            "summon",
          );
          if (epoch !== sequenceEpoch) return;
          el.style.visibility = "";
          masked.delete(el);
          stage("pog-drop-and-land");
          tone("hit");
          await sourceImpact(dest);
          remaining.state.players[side].board.push(structuredClone(c));
        }
      for (const c of state.players[0].hand.filter(
        (c) => !before.state.players[0].hand.some((old) => old.id === c.id),
      )) {
        const el = document.querySelector(`#my-hand [data-id="${c.id}"]`);
        if (!el) continue;
        const dest = el.getBoundingClientRect(),
          origin = document
            .getElementById("local-deck")
            .getBoundingClientRect();
        conceal(el);
        await cardReveal(
          c,
          origin,
          dest,
          O.drawFromDeckFixedMs || 1000,
          epoch,
          "draw",
        );
        if (epoch !== sequenceEpoch) return;
        el.style.visibility = "";
        masked.delete(el);
        remaining.state.players[0].hand.push(structuredClone(c));
      }
      for (let side = 0; side < 2; side++)
        for (const cast of before.state.players[side].hand.filter(
          (c) =>
            c.type === "spell" &&
            before.state.phase !== "mulligan" &&
            !(state.stack || []).some((entry) => entry.card.id === c.id) &&
            !state.players[side].hand.some((now) => now.id === c.id),
        )) {
          await stagedSpell(before, state, side, cast, epoch);
          if (epoch !== sequenceEpoch) return;
          remaining.state.players[side].hand = remaining.state.players[
            side
          ].hand.filter((c) => c.id !== cast.id);
          for (let i = 0; i < 2; i++) {
            remaining.state.players[i].board = structuredClone(
              state.players[i].board,
            );
            remaining.state.players[i].nexus = state.players[i].nexus;
          }
        }
      for (const player of remaining.state.players)
        player.hand = player.hand.filter(
          (c) =>
            before.state.phase !== "mulligan" &&
            !(state.stack || []).some((entry) => entry.card.id === c.id),
        );
      await fallbackChange(remaining, state);
    } finally {
      if (epoch === sequenceEpoch) {
        restore();
        document.body.classList.remove("motion-playing");
        stage("idle");
      }
    }
  }
  let enabled = true,
    sound = false,
    audio = null;
  try {
    enabled = localStorage.getItem("arena-motion") !== "off";
    forceFull = localStorage.getItem("arena-motion-explicit") === "full";
    document.body.classList.toggle("full-motion", forceFull);
  } catch {}

  function animate(
    element,
    frames,
    duration = 420,
    delay = 0,
    easing = "cubic-bezier(.22,1,.36,1)",
  ) {
    const animation = element.animate(frames, {
      duration,
      delay,
      easing,
      fill: "both",
    });
    active.add(animation);
    return animation.finished
      .catch(() => {})
      .finally(() => active.delete(animation));
  }
  function snapshot(state) {
    const nodes = new Map();
    for (const element of document.querySelectorAll(
      ".card, .stack-spell, .nexus, .lane-heading span:last-child",
    )) {
      const rect = element.getBoundingClientRect();
      if (rect.width)
        nodes.set(
          element.dataset.id ||
            element.id ||
            element.parentElement.nextElementSibling?.id,
          {
            rect,
            clone: element.cloneNode(true),
          },
        );
    }
    const presentation = structuredClone(state);
    for (let i = 0; i < 2; i++)
      presentation.players[i].hand = presentation.players[i].hand.map((c) =>
        root.Engine.cardView(state, i, c),
      );
    return { state: presentation, nodes };
  }
  function ghost(item, className = "") {
    const element = item.clone.cloneNode(true);
    element.removeAttribute("id");
    element.removeAttribute("data-id");
    element.className += " fx-ghost " + className;
    Object.assign(element.style, {
      position: "fixed",
      left: item.rect.x + "px",
      top: item.rect.y + "px",
      width: item.rect.width + "px",
      height: item.rect.height + "px",
      margin: "0",
    });
    layer.append(element);
    return element;
  }
  function floatDamage(rect, amount, duration = 520) {
    if (!amount) return Promise.resolve();
    const label = document.createElement("span");
    label.className = "fx-damage" + (amount < 0 ? " healing" : "");
    label.textContent = (amount < 0 ? "+" : "−") + Math.abs(amount);
    Object.assign(label.style, {
      left: rect.x + rect.width / 2 + "px",
      top: rect.y - 18 + "px",
    });
    layer.append(label);
    return animate(
      label,
      [
        { opacity: 0, transform: "translate(-50%,5px) scale(.95)" },
        {
          opacity: 1,
          transform: "translate(-50%,-3px) scale(1)",
          offset: 0.18,
        },
        {
          opacity: 1,
          transform: "translate(-50%,-8px) scale(1)",
          offset: 0.65,
        },
        { opacity: 0, transform: "translate(-50%,-16px) scale(1)" },
      ],
      duration,
    ).finally(() => label.remove());
  }
  function impact(rect) {
    const ring = document.createElement("span");
    ring.className = "fx-impact";
    Object.assign(ring.style, {
      left: rect.x + rect.width / 2 + "px",
      top: rect.y + rect.height / 2 + "px",
    });
    layer.append(ring);
    return animate(
      ring,
      [
        { opacity: 1, transform: "translate(-50%,-50%) scale(.25)" },
        { opacity: 0, transform: "translate(-50%,-50%) scale(1.6)" },
      ],
      450,
    ).finally(() => ring.remove());
  }
  function tone(kind) {
    if (!sound) return;
    try {
      audio ||= new (root.AudioContext || root.webkitAudioContext)();
      audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        now = audio.currentTime;
      oscillator.type = kind === "hit" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(
        kind === "hit" ? 110 : kind === "round" ? 340 : 220,
        now,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        kind === "hit" ? 45 : kind === "round" ? 510 : 440,
        now + 0.16,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.065, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(now + 0.25);
    } catch {
      sound = false;
    }
  }
  async function fallbackChange(before, state) {
    if (!enabled || isReduced()) return;
    const effects = [];
    for (let side = 0; side < 2; side++) {
      const previous = before.state.players[side],
        current = state.players[side];
      for (const cast of previous.hand.filter(
        (c) => c.type === "spell" && !current.hand.some((x) => x.id === c.id),
      )) {
        const start = before.nodes.get(cast.id);
        const targetSide = cast.effect === "buff" ? side : 1 - side;
        const changed = before.state.players[targetSide].board.find((old) => {
          const now = state.players[targetSide].board.find(
            (c) => c.id === old.id,
          );
          return !now || now.attack !== old.attack || now.health !== old.health;
        });
        const target = changed
          ? document.querySelector(`.board [data-id="${changed.id}"]`)
          : document.getElementById(side === 0 ? "enemy-nexus" : "my-nexus");
        const destination =
          target?.getBoundingClientRect() ||
          before.nodes.get(changed?.id)?.rect;
        if (!destination) continue;
        const origin =
          start?.rect ||
          document.getElementById("bot-hand").getBoundingClientRect();
        const orb = document.createElement("span");
        orb.className = "fx-spell";
        Object.assign(orb.style, {
          left: origin.x + origin.width / 2 + "px",
          top: origin.y + origin.height / 2 + "px",
        });
        layer.append(orb);
        const dx =
            destination.x + destination.width / 2 - origin.x - origin.width / 2,
          dy =
            destination.y +
            destination.height / 2 -
            origin.y -
            origin.height / 2;
        effects.push(
          animate(
            orb,
            [
              { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
              {
                opacity: 1,
                transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.75)`,
                offset: 0.8,
              },
              {
                opacity: 0,
                transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.3)`,
              },
            ],
            500,
          ).finally(() => orb.remove()),
        );
        effects.push(impact(destination));
        tone("summon");
      }
      if (side === 0)
        for (const drawn of current.hand.filter(
          (c) => !previous.hand.some((old) => old.id === c.id),
        )) {
          const element = document.querySelector(
            `#my-hand [data-id="${drawn.id}"]`,
          );
          if (!element) continue;
          effects.push(
            animate(
              element,
              [
                { opacity: 0, transform: "translate(70px,-30px) rotate(8deg)" },
                { opacity: 1, transform: "translate(0,0) rotate(0deg)" },
              ],
              420,
            ),
          );
        }
      for (const unit of current.board) {
        const element = document.querySelector(`.board [data-id="${unit.id}"]`);
        if (!element) continue;
        const old = previous.board.find((c) => c.id === unit.id),
          oldNode = before.nodes.get(unit.id);
        if (!old) {
          tone("summon");
          const destination = element.getBoundingClientRect();
          const dx = oldNode ? oldNode.rect.x - destination.x : 0,
            dy = oldNode
              ? oldNode.rect.y - destination.y
              : side === 0
                ? 100
                : -100;
          effects.push(
            animate(
              element,
              [
                {
                  opacity: 0.2,
                  transform: `translate(${dx}px,${dy}px) scale(.92)`,
                  filter: "brightness(1.8)",
                },
                {
                  opacity: 1,
                  transform: "translate(0,0) scale(1)",
                  filter: "brightness(1)",
                },
              ],
              500,
            ),
          );
          effects.push(impact(destination));
        } else if (unit.health < old.health) {
          const rect = element.getBoundingClientRect();
          effects.push(floatDamage(rect, old.health - unit.health));
          effects.push(
            animate(
              element,
              [
                { filter: "brightness(1)" },
                { filter: "brightness(2)", offset: 0.25 },
                { filter: "brightness(1)" },
              ],
              350,
            ),
          );
        }
      }
      for (const old of previous.board) {
        if (current.board.some((c) => c.id === old.id)) continue;
        const item = before.nodes.get(old.id);
        if (!item) continue;
        const element = ghost(item, "fx-death");
        effects.push(
          animate(
            element,
            [
              {
                opacity: 1,
                filter: "brightness(1.8)",
                transform: "translateY(0) scale(1)",
              },
              {
                opacity: 0,
                filter: "brightness(.4) blur(5px)",
                transform: "translateY(20px) scale(.95)",
              },
            ],
            520,
          ).finally(() => element.remove()),
        );
        effects.push(impact(item.rect));
      }
      if (current.nexus < previous.nexus) {
        const element = document.getElementById(
          side === 0 ? "my-nexus" : "enemy-nexus",
        );
        const rect = element.getBoundingClientRect();
        tone("hit");
        effects.push(floatDamage(rect, previous.nexus - current.nexus));
        effects.push(impact(rect));
        effects.push(
          animate(
            element,
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-5px)", offset: 0.25 },
              { transform: "translateX(5px)", offset: 0.5 },
              { transform: "translateX(0)" },
            ],
            300,
          ),
        );
      }
    }
    if (state.combat && !before.state.combat) {
      for (const [index, id] of state.combat.ids.entries()) {
        const element = document.querySelector(`.board [data-id="${id}"]`);
        if (!element) continue;
        const offset = state.combat.owner === 0 ? -28 : 28;
        effects.push(
          animate(
            element,
            [
              { transform: "translateY(0)" },
              { transform: `translateY(${offset}px) scale(1.06)`, offset: 0.6 },
              { transform: "translateY(0)" },
            ],
            400,
            index * 45,
          ),
        );
      }
    }
    if (before.state.combat && !state.combat) {
      tone("hit");
      for (const id of before.state.combat.ids) {
        const item = before.nodes.get(id);
        if (!item) continue;
        const element = ghost(item, "fx-striker");
        const offset = before.state.combat.owner === 0 ? -80 : 80;
        effects.push(
          animate(
            element,
            [
              { opacity: 0.8, transform: "translateY(0)" },
              {
                opacity: 0.65,
                transform: `translateY(${offset}px) scale(1.08)`,
                offset: 0.45,
              },
              { opacity: 0, transform: `translateY(${offset}px) scale(1)` },
            ],
            450,
          ).finally(() => element.remove()),
        );
      }
    }
    if (state.round !== before.state.round) {
      const banner = document.getElementById("round-banner");
      banner.textContent = `Rodada ${state.round} · ${state.token === 0 ? "Você tem o ataque" : "Oponente tem o ataque"}`;
      tone("round");
      effects.push(
        animate(
          banner,
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)", offset: 0.2 },
            { opacity: 1, transform: "translateY(0)", offset: 0.7 },
            { opacity: 0, transform: "translateY(-8px)" },
          ],
          1000,
        ),
      );
    }
    await Promise.all(effects);
  }
  function cancel() {
    sequenceEpoch++;
    root.RegionalAudio?.stop(["hit", "nexus-hit"]);
    restore();
    document.body.classList.remove("motion-playing");
    stage("idle");
    for (const animation of active) animation.cancel();
    active.clear();
    layer.replaceChildren();
  }
  function toggle() {
    if (enabled && isReduced()) forceFull = true;
    else enabled = !enabled;
    document.body.classList.toggle("full-motion", forceFull);
    cancel();
    try {
      localStorage.setItem("arena-motion", enabled ? "on" : "off");
      localStorage.setItem(
        "arena-motion-explicit",
        forceFull ? "full" : "system",
      );
    } catch {}
    return enabled;
  }
  root.ArenaMotion = {
    snapshot,
    change,
    cancel,
    toggle,
    get enabled() {
      return enabled;
    },
    get reduced() {
      return isReduced();
    },
    get soundEnabled() {
      return sound;
    },
    toggleSound() {
      sound = !sound;
      if (root.RegionalAudio) root.RegionalAudio.enabled = sound;
      if (sound) tone("round");
      return sound;
    },
  };
})(window);
