"""Package current-client arena geometry/UVs and original textures for file:// WebGL."""
from pathlib import Path
import base64, hashlib, json, struct, shutil, sys
import numpy as np

game = Path(__file__).resolve().parents[1]
root = game.parent
sys.path.insert(0,str(root/'pesquisa/revisao_downloads_2026-10-15/python_libs'))
import UnityPy
source = root / 'assets_extraidos_atualizados_2026-10-15'
index = json.loads((source/'index.json').read_text(encoding='utf-8'))
groups = {'rift':'summonersrift','demacia':'demacia','noxus':'noxus','ionia':'ionia','freljord':'freljord','piltover':'piltover','bilgewater':'bilgewater','shadowisles':'shadowisles','shurima':'regionshurima','targon':'mounttargon','bandlecity':'bandlecity','zaun':'zaun'}
dest = game/'assets/arenas/current'; dest.mkdir(parents=True, exist_ok=True)
manifest=[]
for key,group in groups.items():
    folder=source/'arenas'/group
    mesh=next(p for p in folder.glob('Base_*.obj'))
    records=[r for r in index if '/playmats/'+group+'/' in r['path'].lower()]
    record=next(r for r in records if r['type']=='Texture2D' and ('color' in r['path'].lower()) and any(e['path'].endswith('.png') for e in r['exports']))
    texture=root/next(e['path'] for e in record['exports'] if e['path'].endswith('.png'))
    packed=[]
    prefab=next((r for r in records if r['type']=='GameObject' and r['path'].lower().endswith('_playmat.prefab')),None)
    selected=[]
    if prefab:
        env=UnityPy.load(str(root/'cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles'/prefab['bundle']))
        trees={o.path_id:o.read_typetree() for o in env.objects if o.type.name in ['Transform','GameObject','MeshFilter','MeshRenderer']}
        def matrix(t):
            x,y,z,w=[t['m_LocalRotation'][k] for k in 'xyzw']
            m=np.eye(4);m[:3,:3]=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]]
            m[:3,:3]=m[:3,:3]@np.diag([t['m_LocalScale'][k] for k in 'xyz']);m[:3,3]=[t['m_LocalPosition'][k] for k in 'xyz'];return m
        wanted={r['path_id']:root/next(e['path'] for e in r['exports'] if e['path'].endswith('.obj')) for r in records if r['type']=='Mesh' and any(e['path'].endswith('.obj') for e in r['exports']) and Path(r['path']).stem.lower() in ['base','baseui','playsurface']}
        def walk(tid,parent):
            t=trees[tid]; world=parent@matrix(t);go=trees[t['m_GameObject']['m_PathID']]
            if not go.get('m_IsActive',True):return
            for c in go['m_Component']:
                comp=trees.get(c['component']['m_PathID'],{})
                if comp.get('m_Mesh',{}).get('m_PathID') in wanted:
                    selected.append((wanted[comp['m_Mesh']['m_PathID']],world))
            for child in t['m_Children']: walk(child['m_PathID'],world)
        walk(trees[prefab['path_id']]['m_Component'][0]['component']['m_PathID'],np.eye(4))
    else:
        selected=[(mesh,np.eye(4))]
    parts=[];vertex_count=0;triangle_count=0
    for part,world in selected:
        vertices=[];uvs=[];faces=[]
        for line in part.read_text(encoding='utf-8').splitlines():
            w=line.split()
            if not w:continue
            if w[0]=='v':
                v=np.array([-float(w[1]),float(w[2]),float(w[3]),1]);v=world@v;vertices.append([-v[0],v[1],v[2]])
            elif w[0]=='vt':uvs.append([float(n) for n in w[1:3]])
            elif w[0]=='f':
                f=[tuple(int(n)-1 for n in q.split('/')) for q in w[1:]]
                for i in range(1,len(f)-1):faces.extend([f[0],f[i],f[i+1]])
        for vi,ti,*_ in faces:packed.extend(vertices[vi]+uvs[ti])
        vertex_count+=len(vertices);triangle_count+=len(faces)//3
        parts.append({'source':part.relative_to(root).as_posix(),'sha256':hashlib.sha256(part.read_bytes()).hexdigest(),'unityWorldTransform':world.tolist()})
    assert selected and triangle_count>0, key
    model={'vertices':base64.b64encode(struct.pack('<'+'f'*len(packed),*packed)).decode(),'count':triangle_count*3,'texture':'data:image/png;base64,'+base64.b64encode(texture.read_bytes()).decode()}
    (dest/(key+'.js')).write_text('window.ARENA_MODELS = window.ARENA_MODELS || {}; window.ARENA_MODELS['+json.dumps(key)+']='+json.dumps(model,separators=(',',':'))+';\n',encoding='utf-8')
    shutil.copyfile(texture,dest/(key+'.png'))
    mesh_record=next(r for r in records if any(e['path']==mesh.relative_to(root).as_posix() for e in r['exports']))
    manifest.append({'key':key,'mesh':mesh.relative_to(root).as_posix(),'meshSha256':hashlib.sha256(mesh.read_bytes()).hexdigest(),'vertices':vertex_count,'triangles':triangle_count,'parts':parts,'texture':texture.relative_to(root).as_posix(),'textureSha256':hashlib.sha256(texture.read_bytes()).hexdigest(),'bundleSha256':mesh_record['bundle_sha256'],'prefabBundleSha256':prefab['bundle_sha256'] if prefab else None,'file':key+'.png','projection':'adapted orthographic XY; native UVs and static Base/BaseUI/PlaySurface world transforms; camera faces +Z'})
(dest/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Packaged',len(manifest),'current arena base meshes with original UVs/textures')
