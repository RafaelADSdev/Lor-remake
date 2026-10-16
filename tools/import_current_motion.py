"""Decode current-client Unity animation channels; no Unity runtime or network needed.

StreamedClip stores cubic coefficients in little-endian uint32 words; DenseClip
stores frame-major scalar samples. Bindings consume position/euler/scale XYZ,
quaternion XYZW, or one scalar. Avatar m_TOS resolves hashed transform paths.
Native channels stay separate from the browser's projection and retiming.
"""
from pathlib import Path
import bisect
import hashlib
import json
import math
import struct

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
SOURCE = ROOT / "assets_extraidos_atualizados_2026-10-15"
SELECTED = {
    "block": "CobmatBlock_AN_Card_2589808618009873814.json",
    "reveal": "unit-summon-reveal_GEO_1485965610719946046.json",
    "creation": "CardCreation_Crystals_5429098815508384440.json",
    "death": "Death_Generic_fracture_stack_variation_-6709713522594993901.json",
    "championDeath": "Champion_Generic_DeathExit_card_fracture_Geo_4798666662509963028.json",
}


def dimension(binding):
    if binding["typeID"] == 4:
        return 4 if binding["attribute"] == 2 else 3 if binding["attribute"] in (1, 3, 4) else 1
    return 1


def stream_curves(data, count):
    blob = struct.pack("<" + "I" * len(data), *data)
    offset = 0
    curves = [[] for _ in range(count)]
    while offset < len(blob):
        time, key_count = struct.unpack_from("<fi", blob, offset)
        offset += 8
        assert 0 <= key_count <= count
        for _ in range(key_count):
            index, *coefficients = struct.unpack_from("<iffff", blob, offset)
            offset += 20
            assert 0 <= index < count
            if math.isfinite(time) and time >= 0:
                assert all(math.isfinite(x) for x in coefficients)
                curves[index].append([time, *coefficients])
    assert offset == len(blob)
    return curves


class Clip:
    def __init__(self, data):
        self.data = data
        muscle = data["m_MuscleClip"]
        self.start, self.stop = muscle["m_StartTime"], muscle["m_StopTime"]
        clip = muscle["m_Clip"]["data"]
        stream = clip["m_StreamedClip"]
        self.stream = stream_curves(stream["data"], stream["curveCount"])
        self.times = [[key[0] for key in curve] for curve in self.stream]
        self.dense = clip["m_DenseClip"]
        self.constants = clip["m_ConstantClip"]["data"]
        self.bindings = data["m_ClipBindingConstant"]["genericBindings"]
        self.channel_count = len(self.stream) + self.dense["m_CurveCount"] + len(self.constants)
        assert sum(dimension(b) for b in self.bindings) == self.channel_count
        assert len(self.dense["m_SampleArray"]) == self.dense["m_FrameCount"] * self.dense["m_CurveCount"]

    def value(self, index, time):
        if index < len(self.stream):
            curve = self.stream[index]
            assert curve, f"No finite key for streamed channel {index}"
            key = curve[max(0, bisect.bisect_right(self.times[index], time) - 1)]
            elapsed = max(0, time - key[0])
            return ((key[1] * elapsed + key[2]) * elapsed + key[3]) * elapsed + key[4]
        index -= len(self.stream)
        count = self.dense["m_CurveCount"]
        if index < count:
            dense = self.dense
            frame = min(dense["m_FrameCount"] - 1, max(0, (time - dense["m_BeginTime"]) * dense["m_SampleRate"]))
            lo = int(frame)
            hi = min(dense["m_FrameCount"] - 1, lo + 1)
            a = dense["m_SampleArray"][lo * count + index]
            b = dense["m_SampleArray"][hi * count + index]
            return a + (b - a) * (frame - lo)
        return self.constants[index - count]

    def tracks(self, paths):
        # Preserve each original key time, and sample at 60 Hz for WAAPI's linear
        # segments. This is cubic reconstruction, not an invented easing curve.
        count = math.ceil((self.stop - self.start) * 60)
        times = sorted({self.start, self.stop, *(self.start + i / 60 for i in range(count + 1) if self.start + i / 60 <= self.stop), *(k[0] for curve in self.stream for k in curve if self.start <= k[0] <= self.stop)})
        tracks = {}
        cursor = 0
        for binding in self.bindings:
            size = dimension(binding)
            if binding["typeID"] == 4 and binding["attribute"] in (1, 2, 3, 4):
                path = str(binding["path"])
                track = tracks.setdefault(path, {"pathHash": binding["path"], "path": paths.get(binding["path"]), "channels": {}})
                attribute = {1: "position", 2: "rotation", 3: "scale", 4: "euler"}[binding["attribute"]]
                track["channels"][attribute] = [[round(self.value(cursor + i, t), 7) for i in range(size)] for t in times]
            cursor += size
        return {"duration": self.stop - self.start, "offsets": [round((t - self.start) / (self.stop - self.start), 8) for t in times], "tracks": list(tracks.values())}


def main():
    index = json.loads((SOURCE / "index.json").read_text(encoding="utf-8"))
    paths = {0: ""}
    for entry in index:
        if entry["type"] != "Avatar":
            continue
        export = next(e for e in entry["exports"] if e["path"].endswith(".json"))
        avatar = json.loads((ROOT / export["path"]).read_text(encoding="utf-8"))
        paths.update(avatar.get("m_TOS", []))
    inventory, selected = [], {}
    for entry in index:
        if entry["type"] != "AnimationClip":
            continue
        export = next(e for e in entry["exports"] if e["path"].endswith(".json"))
        path = ROOT / export["path"]
        raw = path.read_bytes()
        assert hashlib.sha256(raw).hexdigest() == export["sha256"]
        clip = Clip(json.loads(raw))
        record = {"source": export["path"], "sha256": export["sha256"], "bundle": entry["bundle"], "bundleSha256": entry["bundle_sha256"], "unityAssetPath": entry["path"], "startTime": clip.start, "stopTime": clip.stop, "sampleRate": clip.data["m_SampleRate"], "streamedChannels": len(clip.stream), "denseChannels": clip.dense["m_CurveCount"], "constantChannels": len(clip.constants), "bindingCount": len(clip.bindings)}
        # Decode every sample of every clip for coverage, even when not shipped.
        tracks = clip.tracks(paths)
        assert all(math.isfinite(v) for t in tracks["tracks"] for channel in t["channels"].values() for frame in channel for v in frame)
        record["decodedTracks"] = len(tracks["tracks"])
        inventory.append(record)
        for name, filename in SELECTED.items():
            if path.name == filename:
                selected[name] = {**record, **tracks}
    assert len(inventory) == 24 and len(selected) == len(SELECTED)
    payload = {"version": 1, "sampling": "Cubic streamed coefficients, linear dense sampling; native key times plus 60 Hz", "clips": selected}
    (GAME / "current-motion-data.js").write_text("window.CURRENT_MOTION_DATA = " + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n", encoding="utf-8")
    (GAME / "research/current-motion-inventory.json").write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Validated all {len(inventory)} AnimationClips; exported {len(selected)} clips, {sum(len(c['tracks']) for c in selected.values())} transform tracks.")


if __name__ == "__main__":
    main()
