"""Preserve the ten official atlas emblems locally, with reproducible provenance."""
import hashlib
import json
import pathlib
import struct
import urllib.request

game = pathlib.Path(__file__).resolve().parents[1]
folder = game / 'assets/campaign'
destination = folder / 'regions'
destination.mkdir(parents=True, exist_ok=True)
slugs = ('demacia', 'noxus', 'freljord', 'ionia', 'piltover-zaun',
         'bilgewater', 'shurima', 'targon', 'ixtal', 'shadow-isles')
records = {}
for slug in slugs:
    source = f'https://map.leagueoflegends.com/assets/images/regions/{slug}.png'
    request = urllib.request.Request(source, headers={'User-Agent': 'Runeterra-offline-asset-import/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        blob = response.read()
    if blob[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{slug}: expected PNG')
    width, height = struct.unpack('>II', blob[16:24])
    if not (32 <= width <= 1024 and 32 <= height <= 1024):
        raise ValueError(f'{slug}: unexpected dimensions')
    (destination / f'{slug}.png').write_bytes(blob)
    records[slug] = {'url': source, 'file': f'assets/campaign/regions/{slug}.png',
                     'sha256': hashlib.sha256(blob).hexdigest(), 'width': width, 'height': height}
sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
sources['symbols'] = records
(folder / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(records)} official region emblems preserved, dimensions and SHA-256 recorded.')
