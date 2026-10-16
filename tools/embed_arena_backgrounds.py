"""Embed native pre-rendered boards for offline image elements, without URL resolution."""
from pathlib import Path
from PIL import Image
import base64
import hashlib
import io
import json

game = Path(__file__).resolve().parents[1]
source = game / 'assets/arenas/current'
dest = game / 'assets/arenas/backgrounds'
dest.mkdir(parents=True, exist_ok=True)
manifest = []
for row in json.loads((source / 'fallback-sources.json').read_text(encoding='utf-8')):
    key = row['key']
    original = source / row['file']
    image = Image.open(original).convert('RGBA')
    board = Image.new('RGB', image.size, '#0b1e20')
    board.paste(image, mask=image.getchannel('A'))
    output = io.BytesIO()
    board.save(output, 'JPEG', quality=96, subsampling=0, optimize=True)
    raw = output.getvalue()
    uri = 'data:image/jpeg;base64,' + base64.b64encode(raw).decode('ascii')
    script = 'window.ARENA_BACKGROUND_DATA = window.ARENA_BACKGROUND_DATA || {};\n'
    script += 'window.ARENA_BACKGROUND_DATA[' + json.dumps(key) + '] = ' + json.dumps(uri) + ';\n'
    target = dest / (key + '.js')
    target.write_text(script, encoding='utf-8')
    manifest.append({'key': key, 'file': target.name, 'width': image.width, 'height': image.height,
                     'source': 'assets/arenas/current/' + original.name,
                     'sourceSha256': hashlib.sha256(original.read_bytes()).hexdigest(),
                     'imageSha256': hashlib.sha256(raw).hexdigest(),
                     'scriptSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                     'imageBytes': len(raw)})
(dest / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Embedded', len(manifest), 'native backgrounds;', sum(r['imageBytes'] for r in manifest), 'image bytes.')
