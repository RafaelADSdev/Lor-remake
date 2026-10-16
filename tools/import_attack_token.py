"""Package source-verified token geometry and native Unity curves for the browser."""
from pathlib import Path
import base64
import hashlib
import json
import math
import shutil
import zlib
from import_current_motion import Clip

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
SOURCE = ROOT / "assets_extraidos_atualizados_2026-10-15/attack-token"
CLIPS = {"idle": -3216709456795182560, "punch": -3216709458205192947, "ignite": -3216709459361067319, "assemble": -4523325569182150486, "consume": -58852017857384705}
MESHES = {"blade": -7572842338828069574, "defense": 1409966079181695269, **{f"shard{i+1}": pid for i, pid in enumerate([7474042844354001074, 7474042847715094673, 7474042847456989975, 7474042845014311639, 7474042844854255786])}}


def main():
    index = json.loads((SOURCE / "index.json").read_text(encoding="utf-8"))
    records = {r["pathId"]: r for r in index}
    for entry in index:
        for export in entry["exports"]:
            assert hashlib.sha256((SOURCE / export["file"]).read_bytes()).hexdigest() == export["sha256"]
    objects, transforms, paths = {}, {}, {0: ""}
    for record in index:
        kind, pid = record["type"], record["pathId"]
        if kind not in ["GameObject", "Transform", "Avatar"]:
            continue
        data = json.loads((SOURCE / f"{kind}_{pid}.json").read_text(encoding="utf-8"))
        if kind == "GameObject": objects[pid] = data["m_Name"]
        if kind == "Transform": transforms[pid] = data
        if kind == "Avatar": paths.update(data.get("m_TOS", []))
    for pid, transform in transforms.items():
        names, seen = [], set()
        while transform and pid not in seen:
            seen.add(pid)
            names.insert(0, objects[transform["m_GameObject"]["m_PathID"]])
            pid = transform["m_Father"]["m_PathID"]
            transform = transforms.get(pid)
        for start in range(len(names)):
            name = "/".join(names[start:])
            paths[zlib.crc32(name.encode())] = name
    selected = {}
    for name, pid in CLIPS.items():
        clip = Clip(json.loads((SOURCE / f"AnimationClip_{pid}.json").read_text(encoding="utf-8")))
        tracks = clip.tracks(paths)
        assert all(track["path"] is not None for track in tracks["tracks"])
        assert all(math.isfinite(x) for track in tracks["tracks"] for channel in track["channels"].values() for sample in channel for x in sample)
        selected[name] = {**tracks, "pathId": str(pid)}
    geometry = {}
    for name, pid in MESHES.items():
        vertices, uv, faces = [], [], []
        for line in (SOURCE / f"Mesh_{pid}.obj").read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if not parts: continue
            if parts[0] == "v": vertices.append([float(x) for x in parts[1:4]])
            if parts[0] == "vt": uv.append([float(x) for x in parts[1:3]])
            if parts[0] == "f":
                face = [[int(x)-1 for x in corner.split("/")] for corner in parts[1:]]
                for i in range(1, len(face)-1): faces.extend([face[0], face[i], face[i+1]])
        radius = 6.5 if name == "defense" else 10
        geometry[name] = {"packed": [x for v, t, *_ in faces for x in [*(n/radius for n in vertices[v]), *uv[t]]], "triangles": len(faces)//3}
    texture = SOURCE / "Texture2D_9040272080616807251.png"
    render = {"geometry": geometry, "texture": "data:image/png;base64," + base64.b64encode(texture.read_bytes()).decode()}
    (GAME / "research/token-render-input.json").write_text(json.dumps(render, separators=(",", ":")), encoding="utf-8")
    particle = json.loads((SOURCE / "ParticleSystem_-4423452921485605215.json").read_text(encoding="utf-8"))
    lifetime = particle["InitialModule"]["startLifetime"]
    flame = {"tilesX": particle["UVModule"]["tilesX"], "tilesY": particle["UVModule"]["tilesY"], "duration": (lifetime["scalar"] + lifetime["minScalar"]) / 2, "nativeLifetime": [lifetime["minScalar"], lifetime["scalar"]]}
    payload = {"clips": selected, "flame": flame, "nativeAngle": 50, "projection": "OBJ XY/UV; 20 source units per blade sprite; native samples at 60Hz plus key times"}
    (GAME / "attack-token-data.js").write_text("window.ATTACK_TOKEN_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
    manifest = {"texture": records[9040272080616807251], "flame": {"texture": records[6922009557475948872], "particleSystem": records[-4423452921485605215], **flame}, "meshes": {name: records[pid] for name, pid in MESHES.items()}, "clips": {name: {**records[pid], "duration": selected[name]["duration"], "tracks": [track["path"] for track in selected[name]["tracks"]]} for name, pid in CLIPS.items()}, "reaEvidence": "ev_9d7cdbcab755bcb4cd2e28b40b27f53c4b2a247c5e1ed07e3924b29f39c7797d", "projection": payload["projection"]}
    folder = GAME / "assets/arenas/token"
    folder.mkdir(exist_ok=True)
    shutil.copyfile(SOURCE / "Texture2D_6922009557475948872.png", folder / "flame.png")
    (folder / "sources.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Verified source hashes; packaged 7 native meshes and 5 clips with resolved transform paths.")


if __name__ == "__main__":
    main()
