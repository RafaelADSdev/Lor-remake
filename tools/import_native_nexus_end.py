"""Recover the actual 54/65 rigid Nexus fragments and their Unity transform clip."""
from pathlib import Path
import base64
import hashlib
import json
import sys
import struct

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
sys.path.insert(0,str(ROOT/'pesquisa/revisao_downloads_2026-10-15/python_libs'))
import numpy as np
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from import_current_motion import Clip
from import_native_outcome import matrix


def packed(values):
    return base64.b64encode(struct.pack('<'+'f'*len(values),*values)).decode()


def main():
    source=ROOT/'cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles'
    models, evidence={},{}
    for name,bundle,cid,aid,texture in [
        ('red','39/e4efe9c280b79c01abf16fce9cd59d.bbq',-6811966665724754187,-6811966664420748194,'RedCrystal_TX_-7119359608776867456.png'),
        ('blue','3b/3b5678e1ca33b802ad2168ed1ee478.bbq',7916038429985625360,7916038427171632776,'BlueCrystal_TX_-7788748656017317295.png'),
    ]:
        raw=(source/bundle).read_bytes();env=UnityPy.load(raw)
        readers={o.path_id:o for o in env.objects}
        trees={o.path_id:o.read_typetree() for o in env.objects if o.type.name in ['Avatar','GameObject','Transform','MeshFilter','AnimationClip']}
        paths=dict(trees[aid]['m_TOS']);clip=Clip(trees[cid]);tracks=clip.tracks(paths)
        by_path={t['path']:t['channels'] for t in tracks['tracks']}
        transforms={t['m_GameObject']['m_PathID']:t for pid,t in trees.items() if readers[pid].type.name=='Transform'}
        vertices,indices,bone_names=[],[],[]
        for pid,t in trees.items():
            if readers[pid].type.name!='MeshFilter':continue
            go=t['m_GameObject']['m_PathID'];part_name=trees[go]['m_Name']
            if part_name not in by_path:continue
            m=MeshHandler(readers[t['m_Mesh']['m_PathID']].read());m.process()
            bone=len(bone_names);bone_names.append(part_name);offset=len(vertices)//6
            vertices.extend(x for v,uv in zip(m.m_Vertices,m.m_UV0) for x in [*v,*uv[:2],bone])
            indices.extend(offset+i for sub in m.get_triangles() for tri in sub for i in tri)
        frames=[]
        for i in range(len(tracks['offsets'])):
            matrices=[]
            for name_path in bone_names:
                ch=by_path[name_path]
                def value(k,default):return ch.get(k,[default])[min(i,len(ch.get(k,[default]))-1)]
                matrices.append(matrix(value('position',[0,0,0]),value('rotation',[0,0,0,1]),value('scale',[1,1,1])))
            frames.append([float(x) for m in matrices for x in m.T.flatten()])
        first=np.array(frames[0]).reshape(-1,4,4).transpose(0,2,1)
        coords=np.array([(first[int(vertices[i+5])] @ [*vertices[i:i+3],1])[:3] for i in range(0,len(vertices),6)])
        lo,hi=coords[:,:2].min(axis=0),coords[:,:2].max(axis=0)
        texture_path=ROOT/'assets_extraidos_atualizados_2026-10-15/arenas/summonersrift'/texture
        models[name]={
            'verticesPacked':packed(vertices),'indices':indices,
            'framesPacked':packed([x for f in frames for x in f]),'frameSize':len(frames[0]),
            'offsets':tracks['offsets'],'duration':tracks['duration'],'boneCount':len(bone_names),
            'center':((lo+hi)/2).tolist(),'zoom':float(.46/max(hi-lo)),
            'texture':'data:image/png;base64,'+base64.b64encode(texture_path.read_bytes()).decode(),
            'clipPathId':str(cid),'meshPathId':'native-'+name+'-fragments','aspect':1,'orthographic':True,
        }
        evidence[name]={'bundle':bundle,'sha256':hashlib.sha256(raw).hexdigest(),'clip':str(cid),'duration':tracks['duration'],'parts':bone_names,'frames':len(frames),'texture':texture_path.relative_to(ROOT).as_posix(),'textureSha256':hashlib.sha256(texture_path.read_bytes()).hexdigest()}
    (GAME/'native-nexus-end-data.js').write_text('window.NATIVE_NEXUS_END_DATA = '+json.dumps(models,separators=(',',':'))+';\n',encoding='utf-8')
    (GAME/'research/native-nexus-end-sources.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print('Native Nexus fracture clips:',[(k,v['boneCount'],v['duration']) for k,v in models.items()])


if __name__=='__main__':main()
