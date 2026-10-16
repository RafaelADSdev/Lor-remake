const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window: {} });
for (const name of ["current-motion-data.js", "current-motion.js"])
  vm.runInContext(fs.readFileSync(path.join(root, name), "utf8"), context);
const api = context.window.CurrentMotion;
const clips = context.window.CURRENT_MOTION_DATA.clips;
assert.equal(Object.keys(clips).length, 5);
assert.ok(Math.abs(api.duration("block") - 300) < 0.001);
assert.ok(Math.abs(api.duration("reveal") - 500) < 0.001);
assert.equal(clips.death.denseChannels, 420);
assert.equal(clips.block.streamedChannels, 3);
assert.equal(clips.death.tracks.length, 42);
assert.equal(clips.championDeath.tracks.length, 58);
assert.equal(clips.creation.tracks.length, 29);
const block = api.blockFrames(100);
const x = block.map((f) =>
  Number(f.transform.match(/translateX\(([-\d.]+)/)[1]),
);
assert.ok(
  Math.min(...x) < -4.4 && Math.max(...x) > 4.4,
  "Native block's alternating recoil survives projection",
);
assert.ok(Math.abs(x[0]) < 0.001 && Math.abs(x.at(-1)) < 0.001);
for (const frames of [
  block,
  api.revealFrames(),
  ...Array.from({ length: 5 }, (_, i) => api.shardFrames("death", i, 100, 75)),
  api.shardFrames("championDeath", 2, 100, 75),
  api.shardFrames("creation", 2, 215, 323),
]) {
  assert.equal(frames[0].offset, 0);
  assert.equal(frames.at(-1).offset, 1);
  frames.forEach((frame, i) => {
    assert.ok(!/NaN|Infinity|undefined/.test(frame.transform));
    assert.ok(!i || frame.offset >= frames[i - 1].offset);
  });
}
assert.notEqual(
  api.shardFrames("death", 0, 100, 75).at(-1).transform,
  api.shardFrames("death", 1, 100, 75).at(-1).transform,
  "Each shard uses a different recovered trajectory",
);
const inventory = JSON.parse(
  fs.readFileSync(
    path.join(root, "research/current-motion-inventory.json"),
    "utf8",
  ),
);
assert.equal(inventory.length, 24);
const crypto = require("node:crypto");
for (const entry of inventory) {
  const raw = fs.readFileSync(path.join(root, "..", entry.source));
  assert.equal(
    crypto.createHash("sha256").update(raw).digest("hex"),
    entry.sha256,
  );
}
console.log(
  "Current motion: native clip durations, hashes, 133 transform tracks, recoil and finite browser projections passed.",
);
