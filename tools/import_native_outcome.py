"""Import the original LoR banner rig, texture and cubic animation, without retiming."""
from pathlib import Path
import base64
import hashlib
import json
import sys
import zlib
import struct

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
sys.path.insert(0, str(ROOT / 'pesquisa/revisao_downloads_2026-10-15/python_libs'))
import numpy as np
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from import_current_motion import Clip

SOURCE = ROOT / 'assets_extraidos_atualizados_2026-10-15/outcome'
BUNDLES = ROOT / 'cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles'


def matrix(position, rotation, scale):
    x, y, z, w = np.array(rotation) / np.linalg.norm(rotation)
    r = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                  [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                  [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    m = np.eye(4)
    m[:3, :3] = r @ np.diag(scale)
    m[:3, 3] = position
    return m


def main():
    records = json.loads((SOURCE / 'index.json').read_text(encoding='utf-8'))
    paths = {0: ''}
    transforms = {int(p.stem.split('_')[-1]): json.loads(p.read_text()) for p in SOURCE.glob('Transform_*.json')}
    objects = {int(p.stem.split('_')[-1]): json.loads(p.read_text())['m_Name'] for p in SOURCE.glob('GameObject_*.json')}
    for pid, transform in transforms.items():
        names, seen = [], set()
        while transform and pid not in seen:
            seen.add(pid)
            names.insert(0, objects[transform['m_GameObject']['m_PathID']])
            pid = transform['m_Father']['m_PathID']
            transform = transforms.get(pid)
        for start in range(len(names)):
            name = '/'.join(names[start:])
            paths[zlib.crc32(name.encode())] = name
    for r in records:
        if r['type'] == 'Avatar':
            paths.update(json.loads((SOURCE / r['file']).read_text()).get('m_TOS', []))
    clip_id = -2335169206498055647
    clip_file = SOURCE / f'AnimationClip_{clip_id}.json'
    clip = Clip(json.loads(clip_file.read_text()))
    tracks = clip.tracks(paths)
    by_path = {t['path']: t['channels'] for t in tracks['tracks']}
    models, evidence = {}, {'clip': next(r for r in records if r['type'] == 'AnimationClip' and r['pathId'] == str(clip_id)), 'models': {}}
    for outcome, mesh_id, texture_id, delay in [
        ('victory', -1048907677951671566, -6341164921213191011, 2.35),
        ('defeat', -5496488439795928820, -60259011829992443, 1.85),
        ('draw', -5496488439795928820, -5978023231602664267, 2.35),
    ]:
        record = next(r for r in records if r['type'] == 'Mesh' and r['pathId'] == str(mesh_id))
        raw = (BUNDLES / record['bundle']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == record['bundleSha256']
        env = UnityPy.load(raw)
        reader = next(o for o in env.objects if o.path_id == mesh_id)
        tree = reader.read_typetree()
        mesh = MeshHandler(reader.read())
        mesh.process()
        vertices = np.array(mesh.m_Vertices)
        uv = list(mesh.m_UV0)
        indices = [i for sub in mesh.get_triangles() for tri in sub for i in tri]
        bones = [b[0] for b in mesh.m_BoneIndices]
        local = []
        for v, bone in zip(vertices, bones):
            bind = tree['m_BindPose'][bone]
            bind = np.array([[bind[f'e{a}{b}'] for b in range(4)] for a in range(4)])
            local.append((bind @ [*v, 1])[:3])
        # The prefabs attach holders to the two banner bones and animate the
        # separate crystal actor with the timeline's recorded transform curves.
        filters = {'victory': [-5993820367886761275,-5993820370528285358,-5993820371100938754],
                   'defeat': [-8834553487128720900,-8834553487391696386,-8834553486331352015],
                   'draw': [3229795169352107207,3229795171164242405,3229795171791881931]}
        extra_env = UnityPy.load(str(BUNDLES / '8c/d75e76b3c5df3f222740674323aebf.bbq'))
        bone_paths = [paths[h] for h in tree['m_BoneNameHashes']]
        crystal_transform = None
        for fid in filters[outcome]:
            f = json.loads((SOURCE / f'MeshFilter_{fid}.json').read_text())
            transform = next(t for t in transforms.values() if t['m_GameObject']['m_PathID'] == f['m_GameObject']['m_PathID'])
            parent = transforms[transform['m_Father']['m_PathID']]
            parent_name = objects[parent['m_GameObject']['m_PathID']]
            mid = f['m_Mesh']['m_PathID']
            part = MeshHandler(next(o for o in extra_env.objects if o.path_id == mid).read())
            part.process()
            def transform_matrix(t):
                return matrix(list(t['m_LocalPosition'].values()), list(t['m_LocalRotation'].values()), list(t['m_LocalScale'].values()))
            part_matrix = transform_matrix(transform)
            if mid == 7419368400948650538:
                crystal_transform = parent
                bone = len(bone_paths)
            else:
                bone = next(i for i,p in enumerate(bone_paths) if p.endswith('/'+parent_name))
            offset = len(local)
            local.extend((part_matrix @ [*v,1])[:3] for v in part.m_Vertices)
            uv.extend(part.m_UV0)
            bones.extend([bone]*len(part.m_Vertices))
            indices.extend(offset+i for sub in part.get_triangles() for tri in sub for i in tri)
        local = np.array(local)
        timeline_id = 7281560501166539750 if outcome == 'victory' else -3608649492627485415 if outcome == 'defeat' else -5409792938700752417
        timeline = Clip(json.loads((SOURCE / f'AnimationClip_{timeline_id}.json').read_text()))
        def timeline_values(attribute, size, time, default):
            cursor = 0
            from import_current_motion import dimension
            for b in timeline.bindings:
                if paths.get(b['path']) == 'Banner/Victory_Banner_Crystal' and b['attribute']==attribute:
                    return [timeline.value(cursor+i,time) for i in range(size)]
                cursor += dimension(b)
            return default
        frames = []
        final = None
        for sample in range(len(tracks['offsets'])):
            def world(path):
                if not path:
                    return np.eye(4)
                channels = by_path.get(path, {})
                p = channels.get('position', [[0, 0, 0]])
                q = channels.get('rotation', [[0, 0, 0, 1]])
                s = channels.get('scale', [[1, 1, 1]])
                return world(path.rpartition('/')[0]) @ matrix(p[min(sample,len(p)-1)], q[min(sample,len(q)-1)], s[min(sample,len(s)-1)])
            # Export in the prefab faces the camera with a native 180-degree Y turn.
            matrices = [np.diag([-1,1,1,1]) @ world(p) for p in bone_paths]
            t = delay + tracks['offsets'][sample] * tracks['duration']
            position = timeline_values(1,3,t,list(crystal_transform['m_LocalPosition'].values()))
            scale = timeline_values(3,3,t,list(crystal_transform['m_LocalScale'].values()))
            rotation = list(crystal_transform['m_LocalRotation'].values())
            matrices.append(np.diag([1,1,-1,1]) @ matrix(position,rotation,scale))
            frames.append([round(float(x), 7) for m in matrices for x in m.T.flatten()])
            final = np.array([(matrices[b] @ [*v, 1])[:3] for v, b in zip(local, bones)])
        projected = final[:, :2] / final[:, 2:3]
        lo, hi = projected.min(axis=0), projected.max(axis=0)
        center = (lo + hi) / 2
        # Preserve the native projection's aspect ratio; only fit it to this canvas.
        aspect = 2.0
        zoom = min(1.86 / (hi[0]-lo[0]), 1.86 / ((hi[1]-lo[1])*aspect))
        texture = SOURCE / f'Texture2D_{texture_id}.png'
        def packed(values):
            return base64.b64encode(struct.pack('<'+'f'*len(values),*values)).decode()
        models[outcome] = {
            'verticesPacked': packed([float(x) for v, tex, b in zip(local, uv, bones) for x in [*v, *tex[:2], b]]),
            'indices': indices,
            'framesPacked': packed([x for frame in frames for x in frame]), 'frameSize': len(frames[0]),
            'offsets': tracks['offsets'], 'duration': tracks['duration'],
            'boneCount': len(bone_paths)+1, 'center': center.tolist(), 'zoom': float(zoom),
            'texture': 'data:image/png;base64,' + base64.b64encode(texture.read_bytes()).decode(),
            'bannerStart': delay, 'meshPathId': str(mesh_id), 'clipPathId': str(clip_id),
        }
        evidence['models'][outcome] = {'mesh': record, 'texture': next(r for r in records if r['type'] == 'Texture2D' and r['pathId'] == str(texture_id)), 'textureSha256': hashlib.sha256(texture.read_bytes()).hexdigest(), 'vertices': len(local), 'frames': len(frames), 'bannerStart': delay}
    payload = {'version': 1, 'projectionAspect': 2, 'models': models}
    (GAME / 'native-outcome-data.js').write_text('window.NATIVE_OUTCOME_DATA = ' + json.dumps(payload, separators=(',', ':')) + ';\n', encoding='utf-8')
    evidence['limits'] = 'Native banner geometry, UV, rigid bone binding, cubic clip samples and source timeline start times. Browser unlit projection; Unity material erosion, particles and Nexus fracture shaders are not reproduced by this banner renderer.'
    (GAME / 'research/native-outcome-sources.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print('Original banners imported:', [(k, len(v['offsets']), v['duration']) for k,v in models.items()])


if __name__ == '__main__':
    main()
