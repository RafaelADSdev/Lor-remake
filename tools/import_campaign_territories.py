"""Read Riot's alpha masks and emit lightweight SVG geometry for the offline atlas.

Source PNGs are preserved byte-for-byte. Pillow is used only to analyze alpha;
the runtime renders vectors, without full-size bitmap layers or canvas reads.
"""
import hashlib
import json
import pathlib
import urllib.request
from PIL import Image

game = pathlib.Path(__file__).resolve().parents[1]
folder = game / 'assets/campaign/territories'
folder.mkdir(parents=True, exist_ok=True)
slugs = ('demacia', 'noxus', 'freljord', 'ionia', 'bilgewater', 'shurima', 'targon', 'ixtal', 'shadow-isles')
resolution, step = 512, 4


def simplify(points, tolerance=.7):
    if len(points) <= 2:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    length = ((bx-ax)**2 + (by-ay)**2)**.5
    distances = [abs((bx-ax)*(ay-y)-(ax-x)*(by-ay))/(length or 1) for x, y in points[1:-1]]
    distance = max(distances, default=0)
    if distance <= tolerance:
        return [points[0], points[-1]]
    index = distances.index(distance) + 1
    return simplify(points[:index+1], tolerance)[:-1] + simplify(points[index:], tolerance)


def contours(alpha):
    pixels = list(alpha.resize((resolution, resolution), Image.Resampling.BOX).get_flattened_data())
    solid = {(i % resolution, i // resolution) for i, a in enumerate(pixels) if a >= 24}
    edges = {}
    def add(a, b):
        edges.setdefault(a, []).append(b)
    for x, y in sorted(solid, key=lambda p: (p[1], p[0])):
        if (x, y-1) not in solid: add((x, y), (x+1, y))
        if (x+1, y) not in solid: add((x+1, y), (x+1, y+1))
        if (x, y+1) not in solid: add((x+1, y+1), (x, y+1))
        if (x-1, y) not in solid: add((x, y+1), (x, y))
    paths = []
    while edges:
        start = next(iter(edges))
        points, point = [start], start
        while True:
            next_point = edges[point].pop()
            if not edges[point]: del edges[point]
            point = next_point
            if point == start: break
            points.append(point)
        area = abs(sum(points[i-1][0]*p[1]-p[0]*points[i-1][1] for i, p in enumerate(points)))/2
        if area < 2: continue
        # Split the closed contour before simplifying so its end-to-end length is nonzero.
        pivot = max(range(len(points)), key=lambda i: (points[i][0]-start[0])**2+(points[i][1]-start[1])**2)
        curve = simplify(points[:pivot+1])[:-1] + simplify(points[pivot:]+[start])[:-1]
        if len(curve) >= 3:
            paths.append('M'+'L'.join(f'{x*step},{y*step}' for x, y in curve)+'Z')
    center = (sum(x for x, _ in solid)/len(solid), sum(y for _, y in solid)/len(solid)) if solid else (0, 0)
    sample = min(solid, key=lambda p: (p[0]-center[0])**2 + (p[1]-center[1])**2) if solid else None
    return ''.join(paths), [sample[0]*step+step/2, sample[1]*step+step/2] if sample else None


records, regions = {}, []
for slug in slugs:
    url = f'https://map.leagueoflegends.com/assets/images/regions/terrain/{slug}.png'
    target = folder / f'{slug}.png'
    request = urllib.request.Request(url, headers={'User-Agent': 'Runeterra-offline-asset-import/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        blob = response.read()
    target.write_bytes(blob)
    with Image.open(target) as image:
        if image.size != (2048, 2048) or image.mode != 'RGBA':
            raise ValueError(f'{slug}: expected 2048px RGBA atlas mask')
        alpha = image.getchannel('A')
        path, sample = contours(alpha)
        bounds = list(alpha.getbbox())
    regions.append({'id': slug, 'kind': 'territory', 'path': path, 'sample': sample, 'bounds': bounds})
    records[slug] = {'url': url, 'file': target.relative_to(game).as_posix(), 'sha256': hashlib.sha256(blob).hexdigest(), 'bounds': bounds}
    print(slug, len(path), 'SVG characters')

# The official atlas has nine country masks; Piltover/Zaun is a city marker.
regions.append({'id': 'piltover-zaun', 'kind': 'city', 'path': 'M1250,1133A32,42 0 1 1 1186,1133A32,42 0 1 1 1250,1133Z', 'sample': [1218, 1133], 'bounds': [1186, 1091, 1250, 1175]})
data = {'size': 2048, 'regions': regions}
(game / 'campaign-map-data.js').write_text('/* SVG contours derived from Riot atlas alpha masks; see assets/campaign/sources.json. */\nwindow.CAMPAIGN_MAP_DATA = '+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
sources_file = game / 'assets/campaign/sources.json'
sources = json.loads(sources_file.read_text(encoding='utf-8'))
sources['territories'] = records
sources['territory_geometry'] = {'analysis_grid': resolution, 'alpha_threshold': 24, 'simplification': 'RDP, 2.8 source pixels', 'city_marker': 'Piltover/Zaun has a local city halo, not a country border.'}
sources_file.write_text(json.dumps(sources, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
