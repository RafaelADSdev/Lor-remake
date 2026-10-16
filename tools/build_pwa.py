"""Rebuild the atomic PWA shell and resumable artwork list (stdlib only)."""
import hashlib
import json
import pathlib
import re

game = pathlib.Path(__file__).resolve().parents[1]
html = (game / 'index.html').read_text(encoding='utf-8')
files = {'index.html', 'manifest.webmanifest', 'pwa-artwork.json',
         'assets/pwa/apple-touch-icon.png', 'assets/pwa/icon-192.png',
         'assets/pwa/icon-512.png', 'assets/pwa/maskable-512.png',
         'assets/pwa/card-offline.svg', 'assets/01DE012.png'}
files.update(re.findall(r'<script[^>]+src="([^"]+)"', html))
files.update(p.relative_to(game).as_posix() for p in (game / 'assets/arenas/token').glob('*.png'))
files.update(re.findall(r'<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"', html))
for name in list(files):
    if name.split('?')[0].endswith('.css'):
        css = (game / name.split('?')[0]).read_text(encoding='utf-8')
        files.update(url for url in re.findall(r'url\(["\']?([^\)"\']+)', css)
                     if not url.startswith(('data:', 'http', '#')))

art = sorted(p.relative_to(game).as_posix() for p in (game / 'assets').glob('*.png')
             if p.name != 'arena-v2.png')
art += sorted(p.relative_to(game).as_posix() for p in (game / 'assets/playable-art').rglob('*') if p.is_file())
art += sorted(p.relative_to(game).as_posix() for p in (game / 'assets/catalog').rglob('*') if p.is_file())
card_source = (game / 'cards.js').read_text(encoding='utf-8')
card_data = json.loads(re.search(r'window\.CARD_DATA\s*=\s*(\{.*\});?\s*$', card_source, re.S).group(1))
art += [card[field] for card in card_data['cards'].values() for field in ('image', 'portrait') if card.get(field)]
art = sorted(set(art))
art_hash = hashlib.sha256()
for name in art:
    art_hash.update(name.encode())
    art_hash.update((game / name).read_bytes())
art_version = art_hash.hexdigest()[:12]
(game / 'pwa-artwork.json').write_text(json.dumps({
    'version': art_version, 'bytes': sum((game / name).stat().st_size for name in art),
    'files': art,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

template = (game / 'tools/pwa-worker.js').read_text(encoding='utf-8')
digest = hashlib.sha256(template.encode())
for name in sorted(files):
    digest.update(name.encode())
    digest.update((game / name.split('?')[0]).read_bytes())
worker = template.replace('__CORE_VERSION__', json.dumps(digest.hexdigest()[:12]))
worker = worker.replace('__CORE_FILES__', json.dumps(sorted(files), ensure_ascii=False, indent=2))
worker = worker.replace('__ART_VERSION__', json.dumps(art_version))
(game / 'sw.js').write_text(worker, encoding='utf-8')
size = sum((game / name.split('?')[0]).stat().st_size for name in files)
print(f'PWA: {len(files)} core files, {size / 1048576:.1f} MB; {len(art)} optional artworks.')
