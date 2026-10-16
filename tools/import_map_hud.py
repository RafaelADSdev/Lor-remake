"""Export native map HUD meshes, UVs and material texture without running LoR.

Run with the bundled Python 3.13 runtime (UnityPy wheels are in pesquisa/).
Output coordinates preserve UnityPy OBJ convention: reflected Unity X, native Y/Z.
"""
from pathlib import Path
import base64
import hashlib
import json
import struct
import sys

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
sys.path.insert(0, str(ROOT / "pesquisa/revisao_downloads_2026-10-15/python_libs"))
import UnityPy

BUNDLE = ROOT / "cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles/2b/4f2adf1fb53b93fd68946b7ce147f2.bbq"
OUT = GAME / "assets/arenas/hud"
MESH_IDS = {"ui-tray": -3627666283186503513, "spell-mana-tray": 3245518248069910686}
MATERIAL_ID = 2326968707358492394
TEXTURE_ID = -6221100036570150784


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(vertices):
    return [[min(v[i] for v in vertices), max(v[i] for v in vertices)] for i in range(3)]


def parse_obj(text):
    positions, uvs, faces = [], [], []
    for line in text.splitlines():
        words = line.split()
        if not words:
            continue
        if words[0] == "v":
            positions.append([float(v) for v in words[1:4]])
        elif words[0] == "vt":
            uvs.append([float(v) for v in words[1:3]])
        elif words[0] == "f":
            face = [[int(n) - 1 for n in word.split("/")[:2]] for word in words[1:]]
            for i in range(1, len(face) - 1):
                faces.append([face[0], face[i], face[i + 1]])
    return positions, uvs, faces


def components(positions, faces):
    """Weld coincident positions so UV seams do not split a single metal piece."""
    parent = list(range(len(positions)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def join(a, b):
        parent[find(a)] = find(b)

    welded = {}
    for i, vertex in enumerate(positions):
        key = tuple(round(n, 4) for n in vertex)
        if key in welded:
            join(i, welded[key])
        else:
            welded[key] = i
    for face in faces:
        join(face[0][0], face[1][0])
        join(face[0][0], face[2][0])
    grouped = {}
    for i, face in enumerate(faces):
        grouped.setdefault(find(face[0][0]), []).append(i)
    result = []
    for face_ids in grouped.values():
        vertex_ids = sorted({v for i in face_ids for v, _ in faces[i]})
        result.append({"triangles": len(face_ids), "bounds": bounds([positions[i] for i in vertex_ids]), "faceIndices": face_ids})
    return sorted(result, key=lambda item: -item["triangles"])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    env = UnityPy.load(str(BUNDLE))
    objects = {o.path_id: o for o in env.objects}
    texture_path = OUT / "neutral-ui.png"
    objects[TEXTURE_ID].read().image.save(texture_path)
    material = objects[MATERIAL_ID].read_typetree()
    (OUT / "neutral-hud-material.json").write_text(json.dumps(material, indent=2), encoding="utf-8")
    texture_data = "data:image/png;base64," + base64.b64encode(texture_path.read_bytes()).decode()
    trees = {o.path_id: o.read_typetree() for o in env.objects if o.type.name in ["GameObject", "Transform", "MeshFilter", "MeshRenderer"]}
    manifest = {
        "bundle": BUNDLE.relative_to(ROOT).as_posix(),
        "bundleSha256": sha(BUNDLE),
        "materialPathId": MATERIAL_ID,
        "texturePathId": TEXTURE_ID,
        "materialSource": "Assets/AssetLibrary/Playmats/Neutral_Playmat/Materials/neutral_hud_mat.mat",
        "textureSource": "Assets/AssetLibrary/Playmats/Neutral_Playmat/Models/Playmat_Neutral_UI_Color.png",
        "textureFile": texture_path.name,
        "textureSha256": sha(texture_path),
        "coordinates": "UnityPy OBJ: reflected Unity X, native Y/Z; top-down projection XY; native depth Z",
        "connectedComponents": "Coincident positions welded at 4 decimal places; original faces and UVs retained",
        "models": [],
    }
    for key, mesh_id in MESH_IDS.items():
        obj = objects[mesh_id].read().export()
        obj_path = OUT / (key + ".obj")
        obj_path.write_text(obj, encoding="utf-8")
        positions, uvs, faces = parse_obj(obj)
        groups = components(positions, faces)
        assert all(vi == ti for face in faces for vi, ti in face), "OBJ vertex/UV indexing changed"
        model = {"positions": positions, "uvs": uvs, "indices": [vi for face in faces for vi, _ in face], "faces": faces, "components": groups, "bounds": bounds(positions)}
        (OUT / (key + ".json")).write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
        packed = [n for face in faces for vi, ti in face for n in positions[vi] + uvs[ti]]
        browser_model = {
            "vertices": base64.b64encode(struct.pack("<" + "f" * len(packed), *packed)).decode(),
            "count": len(faces) * 3,
            "texture": texture_data,
            "bounds": bounds(positions),
        }
        (OUT / (key + ".js")).write_text("window.MAP_HUD_MODELS=window.MAP_HUD_MODELS||{};window.MAP_HUD_MODELS[" + json.dumps(key) + "]=" + json.dumps(browser_model, separators=(",", ":")) + ";\n", encoding="utf-8")
        instances = []
        for go_id, go in trees.items():
            if "m_Component" not in go:
                continue
            refs = [(c["component"]["m_PathID"], trees.get(c["component"]["m_PathID"], {})) for c in go["m_Component"]]
            if not any(t.get("m_Mesh", {}).get("m_PathID") == mesh_id for _, t in refs):
                continue
            renderer = next((t for _, t in refs if "m_Materials" in t), {})
            if not any(m["m_PathID"] == MATERIAL_ID and m["m_FileID"] == 0 for m in renderer.get("m_Materials", [])):
                continue
            transform_id, transform = next(((oid, t) for oid, t in refs if "m_LocalPosition" in t), (None, {}))
            chain = []
            while transform:
                chain.append({"pathId": transform_id, "position": transform["m_LocalPosition"], "rotation": transform["m_LocalRotation"], "scale": transform["m_LocalScale"]})
                transform_id = transform["m_Father"]["m_PathID"]
                transform = trees.get(transform_id, {})
            instances.append({"gameObjectPathId": go_id, "name": go["m_Name"], "localToRootTransformChain": chain})
        model_manifest = {"key": key, "meshPathId": mesh_id, "objFile": obj_path.name, "objSha256": sha(obj_path), "vertices": len(positions), "triangles": len(faces), "bounds": bounds(positions), "components": [{k: v for k, v in g.items() if k != "faceIndices"} for g in groups], "instances": instances}
        manifest["models"].append(model_manifest)
    (OUT / "sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUT), "models": [{"key": m["key"], "vertices": m["vertices"], "triangles": m["triangles"], "bounds": m["bounds"], "components": len(m["components"])} for m in manifest["models"]]}))


if __name__ == "__main__":
    main()
