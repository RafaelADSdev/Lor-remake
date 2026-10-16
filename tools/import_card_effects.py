"""Rebuild the offline card VFX library from the extracted Unity archives.

This is a bounded 2D presentation port, not the Unity renderer. Exact serialized
CardProfile ownership is kept separate from filename candidates. Native texture
bytes, particle modules, material colors and animation coefficients survive the
conversion; every group loads independently through a local script (file://).
"""
from __future__ import annotations

import argparse
import bisect
import copy
from collections import Counter, OrderedDict, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import zipfile
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_current_motion import Clip, dimension

GAME = Path(__file__).resolve().parents[1]
SOURCE = GAME.parent / 'assets_extraidos_atualizados_2026-10-15/card-animations'
PREFIX = 'Assets/AssetLibrary/'
PHASE_RULES = {
    'levelup': r'level.?up|transformcard|ascend|evolution',
    'summon': r'summon|onplay|on_play|spawn|create|reveal|playcard',
    'attack': r'attack|strike|combat',
    'death': r'death|last.?breath|die|kill|slay',
    'recall': r'recall|return.?to.?hand',
    'cast': r'cast|spell.?start|activation',
    'missile': r'missile|projectile|beam|travel',
    'impact': r'impact|hit(?:_|\b)|explode|explosion|detonate',
}


def phases(name):
    return [phase for phase, pattern in PHASE_RULES.items() if re.search(pattern, name, re.I)]


def resolve_ref(record, ref, assets):
    if not isinstance(ref, dict) or not ref.get('m_PathID'):
        return None
    asset = record['assetFile'].lower()
    file_id = ref.get('m_FileID', 0)
    if file_id:
        externals = assets.get(asset, {}).get('externals', [])
        if file_id > len(externals):
            return None
        asset = externals[file_id - 1].replace('\\', '/').split('/')[-1].lower()
    return asset, str(ref['m_PathID'])


def enabled_link(chain):
    for step in chain:
        for field, value in step.get('controls', {}).items():
            if (field == 'm_Enabled' or field.endswith('.Enabled') or field.endswith('.ContentEnabled')) and value in (0, False):
                return False
    return True


def curve_value(keys, time):
    """Unity unweighted Hermite curve, including infinite tangent step keys."""
    if not keys:
        return 0
    times = [key['time'] for key in keys]
    if time <= times[0]:
        return keys[0]['value']
    if time >= times[-1]:
        return keys[-1]['value']
    i = bisect.bisect_right(times, time) - 1
    a, b = keys[i:i + 2]
    dt = b['time'] - a['time']
    out_slope, in_slope = a.get('outSlope', 0), b.get('inSlope', 0)
    if not math.isfinite(out_slope) or not math.isfinite(in_slope):
        return a['value']
    t = (time - a['time']) / dt
    return (2*t**3 - 3*t*t + 1)*a['value'] + (t**3 - 2*t*t + t)*out_slope*dt + (-2*t**3 + 3*t*t)*b['value'] + (t**3 - t*t)*in_slope*dt


def clean(value):
    """Keep strict JSON and stable native precision; step tangents use null."""
    if isinstance(value, float):
        return round(value, 7) if math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [clean(v) for v in value]
    return value


def key_of(row):
    return row['assetFile'].lower(), str(row['pathId'])


class Archives:
    def __init__(self, source):
        self.source = source
        self.bundles = {}
        self.assets = {}
        self.cache = OrderedDict()
        for line in (source / 'bundles.jsonl').read_text(encoding='utf-8').splitlines():
            bundle = json.loads(line)
            self.bundles[bundle['bundle']] = bundle
            for asset in bundle['assets']:
                self.assets[asset['name'].lower()] = {**asset, 'bundle': bundle['bundle']}
        self.read_count = 0

    def read(self, name):
        if name in self.cache:
            self.cache.move_to_end(name)
            return self.cache[name]
        bundle = self.bundles[name]
        with zipfile.ZipFile(self.source / bundle['archive']) as archive:
            rows = [json.loads(line) for line in archive.read('objects.jsonl').splitlines()]
        records = {key_of(row): row for row in rows}
        self.cache[name] = records
        self.read_count += 1
        while len(self.cache) > 18:
            self.cache.popitem(last=False)
        return records

    def get(self, key):
        if not key:
            return None
        asset = self.assets.get(key[0])
        return self.read(asset['bundle']).get(key) if asset else None

    def ref(self, row, ref):
        return self.get(resolve_ref(row, ref, self.assets))

    def texture(self, row, output):
        bundle = self.bundles[self.assets[row['assetFile'].lower()]['bundle']]
        path = f"textures/{row['assetFile']}/{row['pathId']}.png"
        with zipfile.ZipFile(self.source / bundle['archive']) as archive:
            if path not in archive.namelist():
                return None
            data = archive.read(path)
        sha = hashlib.sha256(data).hexdigest()
        filename = sha[:24] + '.png'
        target = output / 'textures' / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
        return {'src': 'assets/card-effects/textures/' + filename, 'sha256': sha,
                'name': row.get('name', ''), 'width': row['tree'].get('m_Width'),
                'height': row['tree'].get('m_Height'), 'sourceId': ':'.join(key_of(row))}


def curve_record(curve):
    return {k: curve[k] for k in ('minMaxState', 'scalar', 'minScalar', 'maxCurve', 'minCurve') if k in curve}


def particle_record(row, name):
    tree = row['tree']
    modules = {}
    # Retain native curves/gradients and shape parameters rather than a generated
    # palette. The browser supports these modules; unsupported modules are counted.
    for module, fields in {
        'InitialModule': ['startLifetime', 'startSpeed', 'startSize', 'startSizeY', 'size3D', 'startRotation', 'startColor', 'gravityModifier', 'maxNumParticles'],
        'EmissionModule': ['enabled', 'rateOverTime', 'm_Bursts'],
        'ShapeModule': ['enabled', 'type', 'angle', 'radius', 'arc', 'length', 'm_Position', 'm_Rotation', 'm_Scale', 'randomDirectionAmount'],
        'SizeModule': ['enabled', 'curve', 'y', 'separateAxes'],
        'ColorModule': ['enabled', 'gradient'],
        'RotationModule': ['enabled', 'curve', 'x', 'y', 'z'],
        'VelocityModule': ['enabled', 'x', 'y', 'z', 'inWorldSpace'],
        'UVModule': ['enabled', 'tilesX', 'tilesY', 'frameOverTime', 'startFrame', 'cycles', 'animationType', 'rowIndex'],
    }.items():
        native = tree.get(module, {})
        modules[module] = {key: native[key] for key in fields if key in native}
    return {'id': ':'.join(key_of(row)), 'name': name, 'phases': phases(name),
            'duration': tree.get('lengthInSec', 1), 'looping': tree.get('looping', False),
            'delay': curve_record(tree.get('startDelay', {})), 'modules': modules,
            'unsupportedModules': [k for k, v in tree.items() if k.endswith('Module') and isinstance(v, dict) and v.get('enabled') and k not in modules]}


class NativeClip(Clip):
    """Extend the existing decoder for PPtr channels and initial sentinels.

    Unity's serialized curveCount excludes PPtr channels in a few timeline
    clips, but their key indices are present in the same streamed buffer. The
    binding dimensions provide the full count. The negative FLT_MAX frame is
    the initial constant value, including object swaps before the first key.
    """
    def __init__(self, data):
        patched = copy.deepcopy(data)
        native = patched['m_MuscleClip']['m_Clip']['data']
        full_count = sum(dimension(binding) for binding in patched['m_ClipBindingConstant']['genericBindings']) - native['m_DenseClip']['m_CurveCount'] - len(native['m_ConstantClip']['data'])
        native['m_StreamedClip']['curveCount'] = full_count
        words = native['m_StreamedClip']['data']
        raw = struct.pack('<' + 'I'*len(words), *words)
        offset, frames, coincident = 0, [], 0
        while offset < len(raw):
            time, count = struct.unpack_from('<fi', raw, offset)
            offset += 8
            assert count >= 0 and offset + count*20 <= len(raw)
            keys = {}
            for _ in range(count):
                key = struct.unpack_from('<iffff', raw, offset)
                offset += 20
                if key[0] in keys:
                    coincident += 1
                keys[key[0]] = key
            # A few authored timeline clips contain several keys for one
            # channel at the exact same float timestamp. Native bisect-right
            # evaluation selects the final one; retain that same right limit.
            frames.append(struct.pack('<fi', time, len(keys)) + b''.join(struct.pack('<iffff', *key) for key in keys.values()))
        if coincident:
            raw = b''.join(frames)
            native['m_StreamedClip']['data'] = list(struct.unpack('<' + 'I'*(len(raw)//4), raw))
        super().__init__(patched)
        words = native['m_StreamedClip']['data']
        blob = struct.pack('<' + 'I'*len(words), *words)
        offset = 0
        while offset + 8 <= len(blob):
            time, count = struct.unpack_from('<fi', blob, offset)
            offset += 8
            if time >= self.start:
                break
            for _ in range(count):
                index, *coefficients = struct.unpack_from('<iffff', blob, offset)
                offset += 20
                if not self.stream[index] or self.stream[index][0][0] > self.start:
                    self.stream[index].insert(0, [self.start, 0, 0, 0, coefficients[3]])
        self.times = [[key[0] for key in curve] for curve in self.stream]
        self.coincident_key_count = coincident


def decode_clip(row, paths, label):
    data = row['tree']
    metadata = {'id': ':'.join(key_of(row)), 'name': row.get('name'), 'path': label,
                'phases': phases(label + '/' + row.get('name', '')), 'sha256': row['rawSha256']}
    try:
        clip = NativeClip(data)
        # Check the decoder against every native key and every dense scalar.
        for i, curve in enumerate(clip.stream):
            for key in curve:
                assert math.isfinite(clip.value(i, key[0]))
        assert all(math.isfinite(v) for v in clip.constants + clip.dense['m_SampleArray'])
        cursor, bindings = 0, []
        for binding in clip.bindings:
            size = dimension(binding)
            bindings.append({'index': cursor, 'size': size, 'type': binding['typeID'],
                             'attribute': binding['attribute'], 'pathHash': str(binding['path']),
                             'path': paths.get(binding['path']), 'isPPtr': bool(binding.get('isPPtrCurve'))})
            cursor += size
        return {**metadata, 'format': 'muscle', 'start': clip.start, 'duration': max(0, clip.stop - clip.start),
                'stream': clip.stream, 'dense': clip.dense, 'constants': clip.constants, 'bindings': bindings,
                'coincidentRightLimitKeys': clip.coincident_key_count,
                'pptrCurveMapping': [{'fileId': ref['m_FileID'], 'pathId': str(ref['m_PathID'])} for ref in data['m_ClipBindingConstant'].get('pptrCurveMapping', [])]}
    except (KeyError, AssertionError, TypeError, ValueError, IndexError) as exc:
        legacy = []
        for field, attribute in [('m_PositionCurves', 'position'), ('m_ScaleCurves', 'scale'), ('m_EulerCurves', 'euler'), ('m_RotationCurves', 'rotation'), ('m_FloatCurves', 'scalar'), ('m_EditorCurves', 'scalar')]:
            for curve in data.get(field, []):
                legacy.append({'path': curve.get('path', ''), 'attribute': attribute,
                               'property': curve.get('attribute'), 'keys': curve.get('curve', {}).get('m_Curve', [])})
        duration = max((key['time'] for c in legacy for key in c['keys']), default=0)
        return {**metadata, 'format': 'legacy' if legacy else 'unsupported', 'duration': duration,
                'curves': legacy, 'reason': type(exc).__name__ if not legacy else None}


def import_group(group, archives, output):
    rows = {}
    containers = defaultdict(list)
    for name in group['bundles']:
        if name not in archives.bundles:
            continue
        bundle = archives.bundles[name]
        records = archives.read(name)
        rows.update(records)
        for container in bundle['containers']:
            for asset in bundle['assets']:
                key = (asset['name'].lower(), str(container['path_id']))
                if key in records:
                    containers[key].append(container['path'])
    group_prefix = PREFIX + group['id'] + '/'
    owned = {key for key, labels in containers.items() if any(path.startswith(group_prefix) for path in labels)}
    root_names = {key: next(path for path in containers[key] if path.startswith(group_prefix)) for key in owned}
    linked_shared = []
    if not any(rows[key]['type'] == 'GameObject' for key in owned):
        # Override-only groups deliberately reuse a shared BaseAnimation. Resolve
        # its serialized references instead of inventing an unrelated VFX sprite.
        visited = set()
        queue = [(key, root_names[key]) for key in owned if rows[key]['type'] == 'MonoBehaviour']
        while queue:
            key, label = queue.pop()
            if key in visited:
                continue
            visited.add(key)
            row = rows.get(key) or archives.get(key)
            if not row:
                continue
            rows[key] = row
            owned.add(key)
            root_names.setdefault(key, label)

            def references(value, field=''):
                if field in ('m_Script', 'Script', 'm_GameObject', 'm_Parent', 'ParentCardProfile'):
                    return
                if isinstance(value, dict):
                    if 'm_FileID' in value and 'm_PathID' in value:
                        target_key = resolve_ref(row, value, archives.assets)
                        if target_key:
                            yield target_key
                    else:
                        for child_field, child_value in value.items():
                            yield from references(child_value, child_field)
                elif isinstance(value, list):
                    for child_value in value:
                        yield from references(child_value, field)

            if row['type'] == 'MonoBehaviour':
                targets = list(references(row['tree']))
                owner_key = resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets)
                if owner_key:
                    targets.append(owner_key)
                for target_key in targets:
                    target = archives.get(target_key)
                    if target and target['type'] in ('MonoBehaviour', 'GameObject', 'AnimationClip'):
                        rows[target_key] = target
                        queue.append((target_key, label))
                        if target['type'] == 'GameObject':
                            linked_shared.append(':'.join(target_key))
                            bundle_name = archives.assets[target_key[0]]['bundle']
                            rows.update(archives.read(bundle_name))
    transforms = {key: row for key, row in rows.items() if row['type'] == 'Transform'}
    go_transform = {resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets): row for row in transforms.values()}
    go_names = {key: row.get('name', '') for key, row in rows.items() if row['type'] == 'GameObject'}
    object_paths, object_phases, object_transforms = {}, {}, {}

    def walk_go(key, path='', ancestry=(), root_label=''):
        if key in ancestry or len(ancestry) > 100:
            return
        row = rows.get(key)
        if not row or row['type'] != 'GameObject':
            return
        owned.add(key)
        local_path = path + ('/' if path else '') + row.get('name', '')
        object_paths[key] = local_path
        object_phases[key] = phases(root_label + '/' + local_path)
        transform = go_transform.get(key)
        if transform:
            owned.add(key_of(transform))
            object_transforms[key] = transform['tree']
            for child in transform['tree'].get('m_Children', []):
                child_row = archives.ref(transform, child)
                if child_row:
                    rows.setdefault(key_of(child_row), child_row)
                    child_go = resolve_ref(child_row, child_row['tree'].get('m_GameObject'), archives.assets)
                    if child_go not in rows and (child_go_row := archives.get(child_go)):
                        rows[child_go] = child_go_row
                    walk_go(child_go, local_path, (*ancestry, key), root_label)
        for component in row['tree'].get('m_Component', []):
            ref = component.get('component', component)
            component_key = resolve_ref(row, ref, archives.assets)
            if component_key in rows:
                owned.add(component_key)

    for key in list(owned):
        if rows[key]['type'] == 'GameObject':
            walk_go(key, root_label=root_names[key])
    # Unity path bindings omit the prefab root. Keep all suffix CRC identities.
    paths = {0: ''}
    for path in object_paths.values():
        parts = path.split('/')
        for i in range(len(parts)):
            suffix = '/'.join(parts[i:])
            paths[zlib.crc32(suffix.encode('utf-8'))] = suffix
    for row in rows.values():
        if row['type'] == 'Avatar':
            paths.update(row['tree'].get('m_TOS', []))
    material_cache, texture_cache = {}, {}

    def add_texture(row):
        if not row or row['type'] != 'Texture2D':
            return None
        key = key_of(row)
        if key not in texture_cache:
            texture_cache[key] = archives.texture(row, output)
        return texture_cache[key]

    def add_material(row):
        if not row or row['type'] != 'Material':
            return None
        key = key_of(row)
        if key in material_cache:
            return material_cache[key]
        properties = row['tree'].get('m_SavedProperties', {})
        tex = []
        for slot, value in properties.get('m_TexEnvs', []):
            texture = add_texture(archives.ref(row, value.get('m_Texture')))
            if texture:
                tex.append({'slot': slot, 'texture': texture['src'], 'scale': value.get('m_Scale'), 'offset': value.get('m_Offset')})
        material = {'id': ':'.join(key), 'name': row.get('name', ''), 'textures': tex,
                    'colors': dict(properties.get('m_Colors', [])), 'floats': dict(properties.get('m_Floats', [])),
                    'keywords': row['tree'].get('m_ValidKeywords', [])}
        material_cache[key] = material
        return material

    renderers = {}
    for row in rows.values():
        if row['type'] in ('ParticleSystemRenderer', 'MeshRenderer', 'SkinnedMeshRenderer'):
            go = resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets)
            if key_of(row) in owned or go in owned:
                renderers[go] = row
    particles, clips, meshes = [], [], []
    for key in sorted(owned):
        row = rows[key]
        if row['type'] == 'Texture2D':
            add_texture(row)
        elif row['type'] == 'Material':
            add_material(row)
        elif row['type'] == 'AnimationClip':
            clips.append(decode_clip(row, paths, '/'.join(containers.get(key, []))))
        elif row['type'] == 'ParticleSystem':
            go = resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets)
            name = object_paths.get(go, go_names.get(go, ''))
            particle = particle_record(row, name)
            particle['phases'] = object_phases.get(go) or particle['phases']
            particle['transform'] = {k: v for k, v in object_transforms.get(go, {}).items() if k in ('m_LocalPosition', 'm_LocalScale', 'm_LocalRotation')}
            renderer = renderers.get(go)
            particle['materials'] = [m['id'] for ref in renderer['tree'].get('m_Materials', []) if (m := add_material(archives.ref(renderer, ref)))] if renderer else []
            particle['renderMode'] = renderer['tree'].get('m_RenderMode', 0) if renderer else 0
            particle['enabled'] = bool(renderer and renderer['tree'].get('m_Enabled', True))
            particles.append(particle)
    # Include clips owned by a timeline container even when no prefab references
    # it; includes all serialized muscle/scalar channels, not just transforms.
    all_phases = set(phase for asset in group['assets'] for phase in phases(asset['path']))
    all_phases.update(phase for particle in particles for phase in particle['phases'])
    if not all_phases:
        all_phases.add('cast' if group['family'] == 'Spells' else 'summon')
    return {'id': group['id'], 'phases': sorted(all_phases), 'particles': particles,
            'clips': clips, 'materials': list(material_cache.values()),
            'textures': [texture for texture in texture_cache.values() if texture],
            'meshes': meshes,
            'source': {'bundles': group['bundles'], 'sharedPrefabReferences': linked_shared, 'ownership': 'container prefab hierarchy + serialized material PPtr',
                       'presentation': 'bounded Canvas2D port; billboard projection; Unity shaders, mesh deformation and timeline logic are not reproduced'}}


def build_links(catalog, profiles):
    groups = {group['id']: group for group in catalog['groups']}
    group_prefixes = sorted(groups, key=len, reverse=True)
    result = defaultdict(list)
    seen = set()
    for profile in profiles['profiles']:
        code = profile.get('cardCodeCandidateFromFilename')
        if not code or profile.get('variantSuffixFromFilename'):
            continue
        for link in profile.get('links', []):
            for target in link['target'].get('containers', []):
                path = target['path']
                relative = path[len(PREFIX):] if path.startswith(PREFIX) else ''
                group_id = next((group_id for group_id in group_prefixes if relative.startswith(group_id + '/')), None)
                if group_id not in groups:
                    continue
                source_enabled = enabled_link(link['chain'])
                enabled = groups[group_id]['classification'] == 'specific' and groups[group_id]['family'] != 'MomentSkins'
                for phase in phases(path) or ['cast' if group_id.startswith('Spells/') else 'summon']:
                    identity = (group_id, code, phase, enabled, path)
                    if identity in seen:
                        continue
                    seen.add(identity)
                    result[group_id].append({'code': code, 'phase': phase, 'exact': True, 'enabled': enabled,
                                             'ownershipExact': True, 'eventPhaseInferred': True, 'phaseMethod': 'asset-name',
                                             'sourceEnabledFlags': source_enabled, 'activationPolicy': 'browser-event-adaptation',
                                             'sourceControls': [step.get('controls', {}) for step in link['chain'] if step.get('controls')],
                                             'path': path, 'field': link['chain'][-1]['field'],
                                             'requirements': [value for step in link['chain'] for field, value in step.get('controls', {}).items() if field.endswith('.Requirements')]})
    for group_id, group in groups.items():
        # Heuristic ownership remains visible and is used only without an enabled
        # specific PPtr for the same event. Skin candidates are preview-only.
        exact_codes = {link['code'] for link in result[group_id]}
        for candidate in group.get('mapping', {}).get('candidates', []):
            code = candidate['cardCode']
            if code in exact_codes:
                continue
            for phase in sorted({p for asset in group['assets'] for p in phases(asset['path'])}) or ['cast' if group['family'] == 'Spells' else 'summon']:
                result[group_id].append({'code': code, 'phase': phase, 'exact': False,
                                         'enabled': group['classification'] not in ('skin', 'generic-or-shared'),
                                         'path': group.get('mapping', {}).get('method', 'normalized-name')})
    return result


def repair_group_clips(payload, group, archives):
    """Include clips embedded in FBX bundles and referenced controllers."""
    existing = {clip['id']: clip for clip in payload['clips']}
    paths = {int(binding['pathHash']): binding['path'] for clip in payload['clips'] for binding in clip.get('bindings', []) if binding.get('path') is not None}
    raw_clips, controllers, rows = {}, [], {}
    for bundle_name in group['bundles']:
        bundle = archives.bundles.get(bundle_name)
        if not bundle or not any(bundle['types'].get(kind) for kind in ('AnimationClip', 'Animator', 'Animation', 'AnimatorController', 'AnimatorOverrideController')):
            continue
        records = archives.read(bundle_name)
        rows.update(records)
        exclusive = len(archives.bundle_groups.get(bundle_name, [])) == 1
        label = next((asset['path'] for asset in group['assets'] if bundle_name in asset['bundles']), group['id'])
        for key, row in records.items():
            row_id = ':'.join(key)
            if row['type'] == 'AnimationClip' and (exclusive or row_id in existing):
                own_path = existing.get(row_id, {}).get('path') or label + '/' + row.get('name', '')
                raw_clips[key] = (row, own_path, 'container' if row_id in existing else 'exclusive-group-bundle')
            elif row['type'] in ('Animator', 'Animation', 'AnimatorController', 'AnimatorOverrideController'):
                controllers.append(row)

    visited = set()
    while controllers:
        row = controllers.pop()
        if key_of(row) in visited:
            continue
        visited.add(key_of(row))

        def refs(value):
            if isinstance(value, dict):
                if 'm_FileID' in value and 'm_PathID' in value:
                    yield value
                else:
                    for field, child in value.items():
                        if field not in ('m_Script', 'm_GameObject', 'm_Parent'):
                            yield from refs(child)
            elif isinstance(value, list):
                for child in value:
                    yield from refs(child)

        for ref in refs(row['tree']):
            target = archives.ref(row, ref)
            if target and target['type'] == 'AnimationClip':
                raw_clips.setdefault(key_of(target), (target, group['id'] + '/' + row.get('name', '') + '/' + target.get('name', ''), 'AnimatorController-PPtr'))
            elif target and target['type'] in ('AnimatorController', 'AnimatorOverrideController'):
                controllers.append(target)
    # Resolve transform CRCs for clips that share a model bundle with a prefab.
    transform_rows = {key: row for key, row in rows.items() if row['type'] == 'Transform'}
    path_cache = {}

    def transform_path(key, seen=()):
        if key in path_cache:
            return path_cache[key]
        row = transform_rows.get(key)
        if not row or key in seen:
            return ''
        game_object = rows.get(resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets))
        name = game_object.get('name', '') if game_object else ''
        parent = transform_path(resolve_ref(row, row['tree'].get('m_Father'), archives.assets), (*seen, key))
        path_cache[key] = (parent + '/' + name).strip('/')
        return path_cache[key]

    for key in transform_rows:
        parts = transform_path(key).split('/')
        for i in range(len(parts)):
            suffix = '/'.join(parts[i:])
            paths[zlib.crc32(suffix.encode('utf-8'))] = suffix
    repaired = []
    for key, (row, label, ownership) in sorted(raw_clips.items()):
        clip = clean(decode_clip(row, paths, label))
        clip['ownership'] = ownership
        repaired.append(clip)
    represented = {clip['id'] for clip in repaired}
    payload['clips'] = repaired + [clip for clip in payload['clips'] if clip['id'] not in represented]
    return payload


def repair_group_transforms(payload, group, archives):
    rows = {}
    for bundle_name in group['bundles']:
        bundle = archives.bundles.get(bundle_name)
        if bundle and (bundle['types'].get('ParticleSystem') or bundle['types'].get('Transform')):
            rows.update(archives.read(bundle_name))
    # Shared BaseAnimation particles may live outside the named group's bundle.
    for particle in payload['particles']:
        asset_file, path_id = particle['id'].split(':')
        if (asset_file, path_id) not in rows:
            asset = archives.assets.get(asset_file)
            if asset:
                rows.update(archives.read(asset['bundle']))
    transforms = {resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets): row for row in rows.values() if row['type'] == 'Transform'}
    cache = {}

    def chain(row, seen=()):
        key = key_of(row)
        if key in cache:
            return cache[key]
        if key in seen:
            return []
        tree = row['tree']
        parent_key = resolve_ref(row, tree.get('m_Father'), archives.assets)
        parent = rows.get(parent_key) or archives.get(parent_key)
        ancestors = chain(parent, (*seen, key)) if parent and parent['type'] == 'Transform' else []
        game_object_key = resolve_ref(row, tree.get('m_GameObject'), archives.assets)
        game_object = rows.get(game_object_key) or archives.get(game_object_key)
        name = game_object.get('name', '') if game_object else ''
        path = (ancestors[-1]['path'] + '/' if ancestors else '') + name
        cache[key] = ancestors + [{'path': path, 'position': tree.get('m_LocalPosition'), 'scale': tree.get('m_LocalScale'), 'rotation': tree.get('m_LocalRotation')}]
        return cache[key]

    for particle in payload['particles']:
        row = rows.get(tuple(particle['id'].split(':')))
        if not row:
            continue
        game_object = resolve_ref(row, row['tree'].get('m_GameObject'), archives.assets)
        transform = transforms.get(game_object)
        if transform:
            particle['transformChain'] = clean(chain(transform))
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=GAME / 'assets/card-effects')
    parser.add_argument('--group', help='Optional single group rebuild; full catalogue still uses existing group files')
    parser.add_argument('--repair-empty', action='store_true', help='Rebuild only groups without extracted visual assets; reuse the other group payloads')
    parser.add_argument('--repair-clips', action='store_true', help='Re-decode group clips and include embedded FBX/controller clips while reusing visual resources')
    parser.add_argument('--metadata-only', action='store_true', help='Rebuild the lightweight index from existing group payloads without touching resources')
    parser.add_argument('--repair-transforms', action='store_true', help='Rebuild emitter ancestor transforms for native animation projection')
    args = parser.parse_args()
    catalog = json.loads((args.source / 'catalog.json').read_text(encoding='utf-8'))
    profiles = json.loads((args.source / 'profile-links.json').read_text(encoding='utf-8'))
    archives = Archives(args.source)
    archives.bundle_groups = defaultdict(set)
    for group in catalog['groups']:
        for bundle_name in group['bundles']:
            archives.bundle_groups[bundle_name].add(group['id'])
    links = build_links(catalog, profiles)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'groups').mkdir(exist_ok=True)
    entries, totals, unsupported = [], Counter(), []
    unique_clips, unique_particles, unique_textures = set(), set(), set()
    for i, group in enumerate(catalog['groups']):
        slug = hashlib.sha256(group['id'].encode()).hexdigest()[:20]
        filename = args.output / 'groups' / (slug + '.js')
        reuse = args.metadata_only or (args.group and args.group != group['id'])
        if (args.repair_empty or args.repair_clips or args.repair_transforms) and filename.exists():
            text = filename.read_text(encoding='utf-8')
            existing = json.loads(text[text.index(',') + 1:text.rindex(');')])
            reuse = bool(existing['particles'] or existing['textures']) if args.repair_empty else True
        if reuse:
            if not filename.exists():
                raise SystemExit('A full import is required before --group')
            text = filename.read_text(encoding='utf-8')
            payload = json.loads(text[text.index(',') + 1:text.rindex(');')])
        else:
            payload = clean(import_group(group, archives, args.output))
        if args.repair_clips or not reuse:
            payload = repair_group_clips(payload, group, archives)
        if args.repair_transforms or not reuse:
            payload = repair_group_transforms(payload, group, archives)
        for particle in payload['particles']:
            particle['phases'] = sorted(set(particle['phases']) | set(phases(particle['name'])))
        for clip in payload['clips']:
            clip['phases'] = sorted(set(clip['phases']) | set(phases(clip.get('path', '') + '/' + (clip.get('name') or ''))))
        payload['phases'] = sorted(set(payload['phases']) | {phase for asset in group['assets'] for phase in phases(asset['path'])})
        if not args.metadata_only:
            filename.write_text('window.CardEffects.register(' + json.dumps(group['id']) + ',' + json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + ');\n', encoding='utf-8')
        stats = {'particles': len(payload['particles']), 'clips': len(payload['clips']), 'textures': len(payload['textures']), 'materials': len(payload['materials']),
                 'decodedClips': sum(clip['format'] != 'unsupported' for clip in payload['clips']),
                 'channels': sum(sum(binding['size'] for binding in clip.get('bindings', [])) + len(clip.get('curves', [])) for clip in payload['clips'])}
        totals.update(stats)
        unique_clips.update(clip['id'] for clip in payload['clips'])
        unique_particles.update(particle['id'] for particle in payload['particles'])
        unique_textures.update(texture['sha256'] for texture in payload['textures'])
        group_links = list(links[group['id']])
        phase_aliases = {}
        exact_owners = {link['code'] for link in group_links if link['exact'] and link['enabled']}
        for code in sorted(exact_owners):
            source_link = next(link for link in group_links if link['code'] == code and link['exact'] and link['enabled'])
            for phase in payload['phases']:
                if not any(link['code'] == code and link['phase'] == phase and link['enabled'] for link in group_links):
                    group_links.append({'code': code, 'phase': phase, 'exact': True, 'ownershipExact': True,
                                        'eventPhaseInferred': True, 'enabled': True, 'path': source_link['path'],
                                        'method': 'adapter-phase-expansion', 'activationPolicy': 'browser-event-adaptation',
                                        'sourceEnabledFlags': source_link.get('sourceEnabledFlags'),
                                        'sourceControls': source_link.get('sourceControls', []),
                                        'requirements': source_link.get('requirements', [])})
        unit_codes = {candidate['cardCode'] for candidate in group.get('mapping', {}).get('candidates', []) if candidate.get('type') == 'Unit'}
        if group['family'] == 'CardMoments' and unit_codes and 'summon' not in payload['phases'] and 'cast' in payload['phases']:
            phase_aliases['summon'] = 'cast'
            for code in sorted(unit_codes):
                if not any(link['code'] == code and link['phase'] == 'summon' for link in group_links):
                    group_links.append({'code': code, 'phase': 'summon', 'sourcePhase': 'cast', 'exact': False,
                                        'enabled': group['classification'] == 'specific', 'path': 'adapted-unit-play-alias',
                                        'method': 'adapted-unit-play-alias: official Unit type + CardMoments Cast asset; not a verified native summon trigger'})
        name = next((candidate.get('namePt') for candidate in group.get('mapping', {}).get('candidates', []) if candidate.get('namePt')), None) or group.get('sourceName') or group['id'].split('/')[-1]
        entry = {'id': group['id'], 'name': name, 'sourceName': group.get('sourceName') or group['id'].split('/')[-1], 'family': group['family'],
                 'classification': group['classification'], 'codes': sorted({link['code'] for link in group_links}),
                 'phases': sorted(set(payload['phases']) | set(phase_aliases)), 'nativePhases': payload['phases'], 'phaseAliases': phase_aliases,
                 'links': group_links, 'mapping': group.get('mapping', {}).get('method', 'unresolved'),
                 'loader': 'assets/card-effects/groups/' + slug + '.js', 'stats': stats,
                 'presentable': bool(payload['textures'] or payload['particles']),
                 'presentation': 'native-particles' if payload['particles'] else 'texture-plate' if payload['textures'] else 'metadata-only'}
        entries.append(entry)
        unsupported.extend({'group': group['id'], 'clip': clip['id'], 'reason': clip.get('reason')} for clip in payload['clips'] if clip['format'] == 'unsupported')
        if (i + 1) % 25 == 0:
            print(f"Imported {i + 1}/{len(catalog['groups'])} groups; {totals['clips']} clips, {totals['particles']} particle systems", flush=True)
    summary = {'groups': len(entries), 'presentableGroups': sum(entry['presentable'] for entry in entries), **totals,
               'uniqueClips': len(unique_clips), 'uniqueParticleSystems': len(unique_particles), 'uniqueTextures': len(unique_textures),
               'sourceAnimationClips': sum(bundle['types'].get('AnimationClip', 0) for bundle in archives.bundles.values()),
               'sourceParticleSystems': sum(bundle['types'].get('ParticleSystem', 0) for bundle in archives.bundles.values()),
               'adaptedUnitSummonAliases': sum('summon' in entry['phaseAliases'] for entry in entries),
               'adapterPhaseLinks': sum(link.get('method') == 'adapter-phase-expansion' for entry in entries for link in entry['links']),
               'exactLinks': sum(link['exact'] for group_links in links.values() for link in group_links),
               'enabledExactLinks': sum(link['exact'] and link['enabled'] for group_links in links.values() for link in group_links),
               'unsupportedClips': unsupported}
    data = {'version': 1, 'source': 'card-animations/catalog.json + profile-links.json + ZIP objects.jsonl',
            'limitations': ['Canvas2D projection of original particle modules/textures and animation channels; not a Unity shader/timeline renderer.',
                            'Static CardProfile PPtr ownership and named event phases are distinguished from normalized-name fallback.',
                            'Exact ownership activates matching local browser events under an explicit browser-event-adaptation policy. Serialized Enabled/ContentEnabled flags and requirements are preserved without claiming their native runtime semantics. Skins remain preview-only.',
                            'Live effects use bounded particle counts, duration and image caches.'],
            'summary': summary, 'groups': entries}
    (GAME / 'card-effects-data.js').write_text('window.CARD_EFFECTS_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + ';\n', encoding='utf-8')
    (args.output / 'import-summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
