"""Recover native mana textures, UVs and prefab placement; never execute LoR."""
from pathlib import Path
import base64
import hashlib
import json
import re
import sys

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
sys.path.insert(0, str(ROOT / "pesquisa/revisao_downloads_2026-10-15/python_libs"))
import UnityPy
import numpy as np

BUNDLE = ROOT / "cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles/2b/4f2adf1fb53b93fd68946b7ce147f2.bbq"
OUT = GAME / "assets/arenas/hud"
TEXTURES = {"full": -1123416505057766833, "empty": -5385792518978713569}
MESH = -3724746956541237646
FULL_MATERIAL = -6334937908531854551
BUTTON_MESH = -2845255290947377499


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def matrix(tree):
    x, y, z, w = [tree["m_LocalRotation"][key] for key in "xyzw"]
    m = np.eye(4)
    m[:3, :3] = [[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                 [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                 [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]]
    m[:3, :3] = m[:3, :3] @ np.diag([tree["m_LocalScale"][key] for key in "xyz"])
    m[:3, 3] = [tree["m_LocalPosition"][key] for key in "xyz"]
    return m


def main():
    env = UnityPy.load(str(BUNDLE))
    objects = {o.path_id: o for o in env.objects}
    trees = {o.path_id: o.read_typetree() for o in env.objects
             if o.type.name in ["GameObject", "Transform", "MeshFilter", "MeshRenderer"]}

    def world_chain(transform_id):
        chain, world = [], np.eye(4)
        while transform_id:
            tree = trees[transform_id]
            name = trees[tree["m_GameObject"]["m_PathID"]]["m_Name"]
            chain.append({"id": transform_id, "name": name,
                          "position": tree["m_LocalPosition"], "rotation": tree["m_LocalRotation"], "scale": tree["m_LocalScale"]})
            world = matrix(tree) @ world
            transform_id = tree["m_Father"]["m_PathID"]
        return world, chain

    button_bounds = objects[BUTTON_MESH].read().m_LocalAABB
    button_filter = next(t for oid, t in trees.items() if objects[oid].type.name == "MeshFilter"
                         and t.get("m_Mesh", {}).get("m_PathID") == BUTTON_MESH
                         and str(t["m_GameObject"]["m_PathID"]).startswith("325660"))
    button_go = trees[button_filter["m_GameObject"]["m_PathID"]]
    button_world, button_chain = world_chain(button_go["m_Component"][0]["component"]["m_PathID"])
    center = button_world @ np.array([button_bounds.m_Center.x, button_bounds.m_Center.y, button_bounds.m_Center.z, 1])
    button = {"center": center[:2].tolist(), "radius": button_bounds.m_Extent.x}
    sprites, records = {}, []
    for key, texture_id in TEXTURES.items():
        path = OUT / ("mana-pip-" + key + ".png")
        objects[texture_id].read().image.save(path)
        sprites[key] = "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
        records.append({"state": key, "texturePathId": texture_id, "file": path.name, "sha256": sha(path)})
    material = objects[FULL_MATERIAL].read_typetree()
    (OUT / "mana-pip-material.json").write_text(json.dumps(material, indent=2), encoding="utf8")
    obj = objects[MESH].read().export()
    (OUT / "mana-pip.obj").write_text(obj, encoding="utf8")
    vertices, uvs = [], []
    for line in obj.splitlines():
        parts = line.split()
        if parts and parts[0] == "v":
            vertices.append([-float(parts[1]), float(parts[2]), float(parts[3]), 1])
        elif parts and parts[0] == "vt":
            uvs.append([float(parts[1]), 1-float(parts[2]), 1])
    placements = [[], []]
    for go_id, go in trees.items():
        if objects[go_id].type.name != "GameObject" or not str(go_id).startswith("325660") or go.get("m_Name") != "ManaPip_Full":
            continue
        refs = [trees.get(c["component"]["m_PathID"], {}) for c in go["m_Component"]]
        if not any(t.get("m_Mesh", {}).get("m_PathID") == MESH for t in refs):
            continue
        transform_id = go["m_Component"][0]["component"]["m_PathID"]
        world, chain = world_chain(transform_id)
        bottom = any(t["name"] == "ManaTrayBottomContainer" for t in chain)
        if not bottom and not any(t["name"] == "ManaTrayTopContainer" for t in chain):
            continue
        parent = chain[1]["name"]
        match = re.fullmatch(r"ManaPip_Full_override_(\d+)", parent)
        if not match:
            continue
        points = np.array([(world @ np.array(v))[:2] for v in vertices])
        # A texture mapped native quad is affine: (u,1-v,1) -> world XY.
        affine, *_ = np.linalg.lstsq(np.array(uvs), points, rcond=None)
        error = float(np.max(np.abs(np.array(uvs) @ affine - points)))
        assert error < 0.0001, "Native mana quad is no longer affine"
        placements[0 if bottom else 1].append({
            "index": int(match[1])-1, "gameObjectPathId": go_id,
            "affine": [float(n) for n in affine.flatten()], "points": points.tolist(),
            "transformChain": chain,
        })
    for side in placements:
        side.sort(key=lambda p: p["index"])
        assert [p["index"] for p in side] == list(range(10)), "Expected exactly ten native slots per side"
    data = {"sprites": sprites, "button": button, "uvPolygon": [uv[:2] for uv in uvs],
            "slots": [[p["affine"] for p in side] for side in placements]}
    (OUT / "mana-pips.js").write_text("window.NATIVE_MANA_PIPS = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf8")
    manifest = {"bundle": BUNDLE.relative_to(ROOT).as_posix(), "bundleSha256": sha(BUNDLE),
                "meshPathId": MESH, "meshSha256": sha(OUT / "mana-pip.obj"),
                "materialPathId": FULL_MATERIAL, "textures": records,
                "button": {**button, "meshPathId": BUTTON_MESH, "transformChain": button_chain},
                "coordinates": "Native prefab world XY; texture coordinates use u,1-v for SVG image display; no polar approximation",
                "placements": placements}
    (OUT / "mana-pips-sources.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")
    print("Recovered native mana textures and", [len(side) for side in placements], "slots; affine UV projection verified.")


if __name__ == "__main__":
    main()
