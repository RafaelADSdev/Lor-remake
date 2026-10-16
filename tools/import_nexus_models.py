"""Package original current-client crystal meshes and textures for file:// WebGL."""
from pathlib import Path
import base64
import hashlib
import json
import struct

game=Path(__file__).resolve().parents[1]
source=game.parent/'assets_extraidos_atualizados_2026-10-15/arenas/summonersrift'
assets=[('blue_crystal_-6176179175671571015.obj','BlueCrystal_TX_-7788748656017317295.png'),('Red_crystal_479733317668410737.obj','RedCrystal_TX_-7119359608776867456.png')]
models=[]
for mesh,texture in assets:
    vertices=[];uvs=[];normals=[];faces=[]
    for line in (source/mesh).read_text(encoding='utf-8').splitlines():
        words=line.split()
        if not words:continue
        if words[0]=='v':vertices.append(tuple(map(float,words[1:4])))
        elif words[0]=='vt':uvs.append(tuple(map(float,words[1:3])))
        elif words[0]=='vn':normals.append(tuple(map(float,words[1:4])))
        elif words[0]=='f':
            face=[tuple(int(v)-1 for v in w.split('/')) for w in words[1:]]
            for i in range(1,len(face)-1):faces.extend([face[0],face[i],face[i+1]])
    center=[(min(v[i] for v in vertices)+max(v[i] for v in vertices))/2 for i in range(3)]
    radius=max(abs(v[i]-center[i]) for v in vertices for i in [0,1])
    packed=[]
    for vi,ti,ni in faces:
        packed.extend([(vertices[vi][i]-center[i])/radius*.82 for i in range(3)])
        packed.extend(uvs[ti]);packed.extend(normals[ni])
    raw=(source/texture).read_bytes()
    models.append({'vertices':base64.b64encode(struct.pack('<'+'f'*len(packed),*packed)).decode(),'count':len(faces),'texture':'data:image/png;base64,'+base64.b64encode(raw).decode(),'sourceMesh':mesh,'sourceTexture':texture,'meshSha256':hashlib.sha256((source/mesh).read_bytes()).hexdigest(),'textureSha256':hashlib.sha256(raw).hexdigest()})
(game/'nexus-data.js').write_text('window.NEXUS_MODELS = '+json.dumps(models,separators=(',',':'))+';\n',encoding='utf-8')
(game/'assets/arenas/nexus-sources.json').write_text(json.dumps([{k:v for k,v in m.items() if k not in ['vertices','texture']} for m in models],indent=2),encoding='utf-8')
print('Packaged two original meshes:',[m['count']//3 for m in models],'triangles; textures embedded to support offline file://')
