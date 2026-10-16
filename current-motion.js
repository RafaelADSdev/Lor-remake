/* Native Unity channels projected onto DOM cards. Distances, geometry and fade
 * remain browser adaptations; offsets and transform motion come from the clip.
 * This module does not start animations or bypass ArenaMotion cancellation.
 */
(function (root) {
  "use strict";
  const clips = root.CURRENT_MOTION_DATA.clips;
  const sample = (track, channel, index, fallback) =>
    track.channels[channel]?.[index] || fallback;
  const number = (value) => (Math.abs(value) < 1e-7 ? 0 : +value.toFixed(5));
  function conjugate(q) {
    return [-q[0], -q[1], -q[2], q[3]];
  }
  function multiply(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  function rotation(q, origin) {
    let relative = multiply(q, conjugate(origin));
    const length = Math.hypot(...relative) || 1;
    relative = relative.map((v) => v / length);
    // q and -q represent the same rotation. Keep the shortest DOM rotation.
    if (relative[3] < 0) relative = relative.map((v) => -v);
    const axisLength = Math.hypot(...relative.slice(0, 3));
    if (axisLength < 1e-7) return "rotate3d(0,0,1,0deg)";
    const axis = relative.slice(0, 3).map((v) => number(v / axisLength));
    const angle = number(
      (2 * Math.atan2(axisLength, relative[3]) * 180) / Math.PI,
    );
    return `rotate3d(${axis.join(",")},${angle}deg)`;
  }
  function choose(clip, index, count) {
    return clip.tracks[
      Math.min(
        clip.tracks.length - 1,
        Math.floor((index * clip.tracks.length) / Math.max(1, count)),
      )
    ];
  }
  function projection(clip, width, height) {
    const positions = clip.tracks.flatMap(
      (track) => track.channels.position || [[0, 0, 0]],
    );
    const span = (axis) =>
      Math.max(...positions.map((p) => p[axis])) -
      Math.min(...positions.map((p) => p[axis]));
    return [
      (width * 1.5) / Math.max(1, span(0)),
      (height * 1.5) / Math.max(1, span(1)),
    ];
  }
  function blockFrames(width = 100, baseTransform = "") {
    const clip = clips.block;
    const track = clip.tracks.find((t) => t.path === "Export/Bones/Root");
    const channel = track.channels.position;
    const maximum = Math.max(
      ...channel.map((p) => Math.abs(p[0] - channel[0][0])),
      1e-8,
    );
    return clip.offsets.map((offset, i) => ({
      offset,
      transform:
        `${baseTransform} translateX(${number(((channel[i][0] - channel[0][0]) / maximum) * width * 0.045)}px)`.trim(),
    }));
  }
  function revealFrames(width = 215, height = 323) {
    const clip = clips.reveal,
      track = clip.tracks.find((t) => t.pathHash === 0);
    const last = clip.offsets.length - 1;
    const end = sample(track, "position", last, [0, 0, 0]);
    const endScale = sample(track, "scale", last, [1, 1, 1]);
    const liftSpan = Math.max(
      1,
      ...track.channels.position.map((p) => Math.abs(p[2] - end[2])),
    );
    // Unity's ground-plane orientation is deliberately not applied to a screen
    // facing DOM portrait. Its Z travel and scale provide the reveal's lift.
    return clip.offsets.map((offset, i) => {
      const p = sample(track, "position", i, [0, 0, 0]);
      const scale = sample(track, "scale", i, [1, 1, 1]);
      return {
        offset,
        transform: `translate(${number((p[0] - end[0]) * width * 0.08)}px,${number((-(p[2] - end[2]) / liftSpan) * height * 0.18)}px) scale(${number(scale[0] / endScale[0])},${number(scale[1] / endScale[1])})`,
      };
    });
  }
  function shardFrames(kind, index, width, height, count = 5) {
    const clip =
      clips[
        kind === "championDeath"
          ? "championDeath"
          : kind === "creation"
            ? "creation"
            : "death"
      ];
    const track = choose(clip, index, count),
      [sx, sy] = projection(clip, width, height);
    const final = clip.offsets.length - 1;
    const referenceIndex = kind === "creation" ? final : 0;
    const origin = sample(track, "position", referenceIndex, [0, 0, 0]);
    const quaternion = sample(track, "rotation", referenceIndex, [0, 0, 0, 1]);
    const referenceScale = sample(track, "scale", referenceIndex, [1, 1, 1]);
    return clip.offsets.map((offset, i) => {
      const p = sample(track, "position", i, origin);
      const q = sample(track, "rotation", i, quaternion);
      const s = sample(track, "scale", i, [1, 1, 1]);
      const scale = s.map((v, j) => number(v / (referenceScale[j] || 1)));
      const translation = [
        number((p[0] - origin[0]) * sx),
        number(-(p[1] - origin[1]) * sy),
        number((p[2] - origin[2]) * sx * 0.3),
      ];
      return {
        offset,
        transform: `perspective(500px) translate3d(${translation.map((v) => v + "px").join(",")}) ${rotation(q, quaternion)} scale3d(${scale.join(",")})`,
        // Only the DOM fade is adapted: native clips animate fragment geometry.
        opacity:
          kind === "creation"
            ? Math.min(1, offset * 5)
            : 1 - Math.max(0, (offset - 0.55) / 0.45),
      };
    });
  }
  root.CurrentMotion = Object.freeze({
    blockFrames,
    revealFrames,
    shardFrames,
    duration: (kind) => clips[kind]?.duration * 1000,
    source: (kind) => clips[kind]?.source,
  });
})(window);
