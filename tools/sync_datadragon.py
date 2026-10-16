"""Sincroniza somente JSONs oficiais; não requer chave de API nem cliente aberto."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

game = pathlib.Path(__file__).resolve().parents[1]
sets = ['set1', 'set2', 'set3', 'set4', 'set5', 'set6', 'set6cde', 'set7', 'set7b', 'set8', 'set9']
target = game / 'research/datadragon'
target.mkdir(exist_ok=True)

def fetch(name):
    url = f'https://dd.b.pvp.net/latest/{name}/pt_br/data/{name}-pt_br.json'
    with urllib.request.urlopen(url, timeout=45) as response:
        raw = response.read()
    cards = json.loads(raw)
    assert isinstance(cards, list) and all('cardCode' in c and 'assets' in c for c in cards)
    filename = f'{name}-pt_br.json'
    (target / filename).write_bytes(raw)
    return {'set': name, 'file': filename, 'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'records': len(cards)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    sources = list(pool.map(fetch, sets))
(target / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(sources)} conjuntos oficiais sincronizados: {sum(s["records"] for s in sources)} registros; hashes preservados.')
