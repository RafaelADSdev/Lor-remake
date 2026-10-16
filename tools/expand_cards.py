"""Adiciona apenas cartas cujas regras são suportadas explicitamente pelo motor."""
import hashlib
import html
import json
import pathlib
import re
import shutil
import urllib.parse
import urllib.request

game = pathlib.Path(__file__).resolve().parents[1]
supported = {'Tough', 'Elusive', 'Fearsome', 'CantBlock', 'Overwhelm', 'QuickStrike', 'Regeneration', 'Attune', 'Lifesteal', 'Ephemeral', 'Barrier'}
spells = {
    '01DE032': {'effect':'buff','grantKeywords':['Barrier']},
    '01DE037': {'effect':'buff','amount':3,'grantKeywords':['Barrier']},
    '01IO037': {'effect':'buff','grantKeywords':['Barrier','Lifesteal']},
    '01SI022': {'effect':'buff','amount':2,'hp':2,'permanent':True,'grantKeywords':['Ephemeral']},
    '01PZ052': {'effect':'damage', 'amount':2, 'targetMode':'any'},
    '01FR004': {'effect':'buff', 'amount':0, 'hp':2},
    '01FR005': {'effect':'buff', 'amount':8, 'hp':4, 'permanent':True},
    '01NX019': {'effect':'buff', 'amount':3, 'grantKeywords':['Overwhelm']},
    '01IO018': {'effect':'buff', 'amount':1, 'grantKeywords':['QuickStrike']},
    '01IO022': {'effect':'buff', 'grantKeywords':['Elusive']},
    '01DE013': {'effect':'buff', 'grantKeywords':['Tough'], 'permanent':True},
    '01PZ026': {'effect':'buff', 'grantKeywords':['Elusive'], 'permanent':True},
    '01PZ050': {'effect':'buff', 'amount':4, 'grantKeywords':['QuickStrike']},
    '01DE035': {'effect':'buffAll', 'amount':3, 'hp':3},
    '01FR057': {'effect':'buffAll', 'amount':2, 'hp':2, 'grantKeywords':['Overwhelm']},
    '01IO004': {'effect':'heal', 'amount':3},
    '01IO001': {'effect':'heal', 'amount':4, 'draw':1},
    '01DE021': {'effect':'rally'},
    '01DE007': {'effect':'judgment'},
    '01SI001': {'effect':'kill', 'targetMode':'any'},
    '01NX004': {'effect':'kill', 'targetMode':'any', 'maxPower':3},
    '01SI015': {'effect':'killAll'},
    '01FR020': {'effect':'sweep', 'amount':2},
    '01SI029': {'effect':'sweep', 'amount':1, 'enemyOnly':True, 'heal':3},
    '01SI054': {'effect':'damage', 'amount':3, 'unitsOnly':True, 'drain':True},
    '01FR001': {'effect':'frostbite'},
}

def expand(payload):
    folder = game / 'research/datadragon'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    selected, all_cards, added, region_names = {}, {}, [], {}
    art_file = game / 'assets/datadragon-assets.json'
    art_sources = json.loads(art_file.read_text(encoding='utf-8')) if art_file.exists() else {}
    local_records = {}
    for source in sources:
        raw = (folder / source['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == source['sha256'], 'Snapshot oficial alterado.'
        for c in json.loads(raw):
            all_cards[c['cardCode']] = c
            region_names.update(zip(c['regionRefs'], c['regions']))
            if not c['collectible'] or len(c['regionRefs']) != 1:
                continue
            vanilla = c['type'] == 'Unidade' and c['rarityRef'] != 'Champion' and not c.get('descriptionRaw') and set(c['keywordRefs']) <= supported
            if vanilla or c['cardCode'] in spells:
                selected[c['cardCode']] = (c, source['set'])
    for code, (c, set_name) in selected.items():
        if code in payload['cards']:
            continue
        portrait = game / f'assets/lor-motion/{code}-card.png'
        illustration = game / f'assets/{code}.png'
        local = game.parent / f'datadragon_oficial/extraidos/latest_{set_name}-pt_br/pt_br/img/cards'
        if set_name not in local_records:
            local_json = local.parent.parent / f'data/{set_name}-pt_br.json'
            local_records[set_name] = {c['cardCode']:c for c in json.loads(local_json.read_text(encoding='utf-8'))} if local_json.exists() else {}
        matches = local_records[set_name].get(code, {}).get('assets') == c['assets']
        asset_id = c['assets'][0]['gameAbsolutePath'].replace('http:', 'https:')
        for out, field, file in [(portrait, 'gameAbsolutePath', code+'.png'), (illustration, 'fullAbsolutePath', code+'-full.png')]:
            if not out.exists() or art_sources.get(code) != asset_id:
                if matches and (local / file).exists():
                    shutil.copyfile(local / file, out)
                else:
                    url = urllib.parse.urlparse(c['assets'][0][field])
                    assert url.hostname == 'dd.b.pvp.net'
                    with urllib.request.urlopen(url._replace(scheme='https').geturl(), timeout=45) as response:
                        out.write_bytes(response.read())
                assert out.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), f'Arte inválida: {code}'
        art_sources[code] = asset_id
        text = html.unescape(re.sub(r'<[^>]+>', '', c.get('descriptionRaw', ''))).strip()
        entry = {'code':code, 'name':c['name'], 'cost':c['cost'], 'attack':c['attack'], 'health':c['health'],
                 'keywords':c['keywordRefs'], 'type':'unit' if c['type']=='Unidade' else 'spell', 'champion':False,
                 'collectible':True, 'speed':c['spellSpeedRef'], 'effect':'', 'amount':0, 'hp':0,
                 'text':text, 'region':c['regionRefs'][0], 'image':f'assets/{code}.png', 'portrait':f'assets/lor-motion/{code}-card.png',
                 'sourceSet':set_name, 'sourceArt':c['assets'][0]['gameAbsolutePath'].replace('http:', 'https:')}
        entry.update(spells.get(code, {}))
        payload['cards'][code] = entry
        added.append(code)
    report = {'available_records':len(all_cards), 'official_collectible':sum(bool(c['collectible']) for c in all_cards.values()),
              'added':added, 'playable_collectible':sum(c['collectible'] for c in payload['cards'].values()),
              'excluded_reason':'Cartas fora do conjunto implementado não são liberadas no deck; sem execução automática de texto.'}
    payload['catalogInfo'] = report
    payload['regionNames'] = region_names
    presets = {
      'frost': ['01FR053','01IO005','01FR027','02FR006','01FR026','01FR054','01IO030','01IO018','01IO004','01IO022','01FR004','01FR001','01FR005','01IO001'],
      'shadow': ['01SI037','01SI039','01NX015','01NX037','01NX040','01NX012','01NX041','01NX027','01NX019','01SI001','01SI029','01SI054','01SI015','01NX002'],
    }
    for name, codes in presets.items():
        assert all(code in payload['cards'] for code in codes)
        payload['decks'][name] = codes[:-1]*3 + codes[-1:]
    payload['deckTitles'] = {'frost':'Freljord e Ionia · Gelo e Ímpeto', 'shadow':'Ilhas das Sombras e Noxus · Cerco Sombrio'}
    art_file.write_text(json.dumps(art_sources, ensure_ascii=False, indent=2), encoding='utf-8')
    (folder / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    from import_supported_cards import import_supported_cards
    return import_supported_cards(payload, write=False)
