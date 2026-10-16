/* Browser reconstruction informed by the user's recording; no rule changes. */
(function (root) {
  async function play(h) {
    const { before, state, trace } = h,
      T = root.LOR_MOTION_PROFILE.adapted;
    const pieces = new Map(),
      numbers = before.state.players.map((p) => p.nexus);
    const vec = (x, y) => ({ x, y });
    const transform = (p, scale = 1) =>
      `translate(${p.x}px,${p.y}px) scale(${scale})`;
    const offsetRect = (rect, p) => ({
      width: rect.width,
      height: rect.height,
      x: rect.x + p.x,
      y: rect.y + p.y,
    });
    function flash(rect, kind) {
      const el = document.createElement("div");
      el.className = "fx-contact " + kind;
      Object.assign(el.style, {
        left: rect.x + "px",
        top: rect.y + "px",
        width: rect.width + "px",
        height: rect.height + "px",
      });
      h.layer.append(el);
      return h
        .animate(
          el,
          [
            { opacity: 0, transform: "scale(.94)" },
            { opacity: 1, transform: "scale(1.04)", offset: 0.2 },
            { opacity: 0, transform: "scale(1.1)" },
          ],
          230,
          0,
          "linear",
        )
        .finally(() => el.remove());
    }
    async function missile(from, to) {
      const dx = to.x - from.x,
        dy = to.y - from.y,
        arc = Math.min(18, Math.abs(dx) * 0.025 + 4);
      const el = document.createElement("span");
      el.className = "fx-nexus-missile";
      Object.assign(el.style, { left: from.x + "px", top: from.y + "px" });
      h.layer.append(el);
      const frames = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        offset: t,
        transform: `translate(${dx * t}px,${dy * t - 4 * arc * t * (1 - t)}px) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg) scale(${1 - t * 0.3})`,
        opacity: t === 1 ? 0.6 : 1,
      }));
      await h.animate(el, frames, T.nexusTravelMs);
      el.remove();
    }
    for (let side = 0; side < 2; side++)
      h.plate(side).querySelector("b").textContent = numbers[side];
    for (const lane of trace.lanes)
      for (const id of [lane.attackerId, lane.blockerId]) {
        if (!id || pieces.has(id)) continue;
        const item = before.nodes.get(id);
        if (!item) continue;
        h.conceal(h.unitNode(id));
        const el = h.ghost(item, "fx-combat-card");
        el.dataset.unitId = id;
        el.style.transform = "none";
        el.style.transformOrigin = "50% 50%";
        pieces.set(id, { item, el });
      }
    try {
      h.stage("combat-ready", {
        owner: trace.owner,
        lanes: trace.lanes.length,
      });
      for (const lane of trace.lanes) {
        if (!h.current()) return;
        const a = pieces.get(lane.attackerId),
          b = pieces.get(lane.blockerId);
        if (!a) continue;
        const from = h.center(a.item.rect),
          to = b
            ? h.center(b.item.rect)
            : { x: from.x, y: from.y + (trace.owner === 0 ? -130 : 130) };
        const dx = to.x - from.x,
          dy = to.y - from.y,
          length = Math.max(1, Math.hypot(dx, dy)),
          ux = dx / length,
          uy = dy / length;
        const extentA =
          (Math.abs(ux) * a.item.rect.width +
            Math.abs(uy) * a.item.rect.height) /
          2;
        const extentB = b
          ? (Math.abs(ux) * b.item.rect.width +
              Math.abs(uy) * b.item.rect.height) /
            2
          : 0;
        const gap = b ? Math.max(18, length - extentA - extentB) : 52;
        const at = vec(
            ux * gap * (b ? 0.64 : 0.55),
            uy * gap * (b ? 0.64 : 0.55),
          ),
          bt = vec(-ux * gap * 0.28, -uy * gap * 0.28);
        h.stage("strike-windup", {
          attacker: lane.attackerId,
          blocker: lane.blockerId,
        });
        const windup = [
          h.animate(
            a.el,
            [
              { transform: "translate(0,0) scale(1)" },
              { transform: transform(vec(-ux * 9, -uy * 9), 1.04) },
            ],
            T.strikeWindupMs,
          ),
        ];
        if (b) {
          h.stage("block-brace", { blocker: lane.blockerId });
          windup.push(flash(b.item.rect, "fx-guard"));
        }
        await Promise.all(windup);
        if (!h.current()) return;
        h.stage("strike-travel", {
          attacker: lane.attackerId,
          blocker: lane.blockerId,
        });
        await Promise.all([
          h.animate(
            a.el,
            [
              { transform: transform(vec(-ux * 9, -uy * 9), 1.04) },
              { transform: transform(at, 1.02) },
            ],
            T.strikeTravelMs,
          ),
          ...(b
            ? [
                h.animate(
                  b.el,
                  [
                    { transform: "translate(0,0)" },
                    { transform: transform(bt) },
                  ],
                  T.strikeTravelMs,
                ),
              ]
            : []),
        ]);
        if (!h.current()) return;
        if (!b && lane.nexusDamage) {
          h.stage("nexus-strike-travel", {
            attacker: lane.attackerId,
            side: 1 - trace.owner,
          });
          await missile(
            { x: from.x + at.x, y: from.y + at.y },
            h.center(h.nexusRect(1 - trace.owner)),
          );
          if (!h.current()) return;
        }
        h.stage("strike-impact", {
          attacker: lane.attackerId,
          blocker: lane.blockerId,
          kind: b ? "blocked" : lane.nexusDamage ? "nexus" : "ghost-block",
        });
        if (b) h.impact("hit");
        const rectA = offsetRect(a.item.rect, at),
          rectB = b
            ? offsetRect(b.item.rect, bt)
            : h.nexusRect(1 - trace.owner);
        const contact = b
          ? {
              x: h.center(rectB).x - ux * extentB - 34,
              y: h.center(rectB).y - uy * extentB - 34,
              width: 68,
              height: 68,
            }
          : rectB;
        const effects =
          b || lane.nexusDamage
            ? [flash(contact, b ? "fx-collision" : "fx-nexus-hit")]
            : [];
        for (const [piece, value, rect] of [
          [a, lane.attackerHealth, rectA],
          [b, lane.blockerHealth, rectB],
        ]) {
          if (!piece) continue;
          const label = piece.el.querySelector(".health");
          if (label) {
            const old = Number(label.textContent);
            label.textContent = Math.max(0, value);
            if (old > value)
              effects.push(h.floatDamage(rect, old - Math.max(0, value), 480));
          }
        }
        if (lane.nexusDamage) {
          if (b) {
            await missile(
              h.center(rectB),
              h.center(h.nexusRect(1 - trace.owner)),
            );
            if (!h.current()) return;
          }
          h.impact("nexus-hit");
          numbers[1 - trace.owner] -= lane.nexusDamage;
          effects.push(
            h.displayNexus(1 - trace.owner, numbers[1 - trace.owner]),
          );
        }
        await h.animate(
          h.layer,
          [{ opacity: 1 }, { opacity: 1 }],
          T.strikeHitStopMs,
        );
        if (!h.current()) return;
        h.stage("block-recoil", {
          attacker: lane.attackerId,
          blocker: lane.blockerId,
        });
        if (b && lane.blockerHealth <= 0)
          effects.push(h.fragment({ ...b.item, rect: rectB }, b.el, h.epoch));
        else if (b) {
          b.el.dataset.nativeClip = "block";
          effects.push(
            (async () => {
              await h.animate(
                b.el,
                root.CurrentMotion.blockFrames(
                  b.item.rect.width,
                  transform(bt),
                ),
                root.CurrentMotion.duration("block"),
                0,
                "linear",
              );
              if (!h.current()) return;
              await h.animate(
                b.el,
                [
                  { transform: transform(bt) },
                  {
                    transform: transform(vec(bt.x + ux * 8, bt.y + uy * 8)),
                    offset: 0.22,
                  },
                  { transform: "translate(0,0) scale(1)" },
                ],
                T.strikeReturnMs,
              );
            })(),
          );
        }
        if (lane.attackerHealth <= 0)
          effects.push(h.fragment({ ...a.item, rect: rectA }, a.el, h.epoch));
        else
          effects.push(
            h.animate(
              a.el,
              [
                { transform: transform(at, 1.02) },
                { transform: "translate(0,0) scale(1)" },
              ],
              T.strikeReturnMs,
            ),
          );
        await Promise.all(effects);
        if (!h.current()) return;
        await h.animate(
          h.layer,
          [{ opacity: 1 }, { opacity: 1 }],
          T.strikeGapMs,
        );
      }
      if (!h.current()) return;
      h.stage("combat-return");
      await Promise.all(
        [...pieces].map(([id, p]) => {
          const target = h.unitNode(id);
          if (!target) return Promise.resolve();
          const end = target.getBoundingClientRect(),
            from = h.center(p.item.rect),
            to = h.center(end);
          return h.animate(
            p.el,
            [
              { transform: "translate(0,0) scale(1)" },
              {
                transform: `translate(${to.x - from.x}px,${to.y - from.y}px) scale(${end.width / p.item.rect.width},${end.height / p.item.rect.height})`,
              },
            ],
            T.combatReturnMs,
          );
        }),
      );
      if (h.current()) {
        h.stage("combat-last-breath");
        await Promise.all(
          state.players.map((p, side) => h.displayNexus(side, p.nexus)),
        );
      }
    } finally {
      for (const p of pieces.values()) p.el.remove();
      if (h.current()) h.restore();
    }
  }
  root.CombatMotion = { play };
})(window);
