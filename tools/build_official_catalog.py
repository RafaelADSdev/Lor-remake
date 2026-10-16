"""Catálogo completo para consulta offline; não libera regras ainda não implementadas."""
import concurrent.futures
import hashlib
import io
import json
import pathlib
import urllib.parse
import urllib.request
from PIL import Image

game=pathlib.Path(__file__).resolve().parents[1]
folder=game/'research/datadragon'
destination=game/'assets/catalog'
destination.mkdir(exist_ok=True)
records=[]
for source in json.loads((folder/'sources.json').read_text(encoding='utf-8')):
    raw=(folder/source['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==source['sha256']
    for card in json.loads(raw): records.append((card,source['set']))
types={'Unidade':'unit','Feitiço':'spell','Monumento':'landmark','Equipamento':'equipment','Habilidade':'ability','Armadilha':'trap'}

def build(item):
    c,set_name=item
    code=c['cardCode']
    out=destination/(code+'.webp')
    if not out.exists():
        local=game.parent/f'datadragon_oficial/extraidos/latest_{set_name}-pt_br/pt_br/img/cards/{code}.png'
        if local.exists(): raw=local.read_bytes()
        else:
            uri=urllib.parse.urlparse(c['assets'][0]['gameAbsolutePath'])
            assert uri.hostname=='dd.b.pvp.net'
            with urllib.request.urlopen(uri._replace(scheme='https').geturl(),timeout=45) as r: raw=r.read()
        with Image.open(io.BytesIO(raw)) as image:
            image.thumbnail((240,320),Image.Resampling.LANCZOS)
            image.save(out,'WEBP',quality=80,method=3)
    text=c['descriptionRaw'] or ' · '.join(c['keywords'])
    return {'code':code,'name':c['name'],'cost':c['cost'],'attack':c['attack'],'health':c['health'],
      'type':types.get(c['type'],'other'),'champion':c['rarityRef']=='Champion' or c.get('supertype') in ('Champion','Campeão'),
      'collectible':c['collectible'],'regions':c['regionRefs'],'region':c['regionRefs'][0] if c['regionRefs'] else '',
      'keywords':c['keywordRefs'],'text':text,'levelText':c.get('levelupDescriptionRaw',''),
      'portrait':f'assets/catalog/{code}.webp','image':f'assets/catalog/{code}.webp','sourceSet':set_name}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    cards=list(pool.map(build,records))
(game/'official-catalog.js').write_text('window.OFFICIAL_CATALOG = '+json.dumps({c['code']:c for c in cards},ensure_ascii=False)+';\n',encoding='utf-8')
print(f'{len(cards)} registros oficiais e artes compactas disponíveis offline; {sum(c["collectible"] for c in cards)} colecionáveis.')
