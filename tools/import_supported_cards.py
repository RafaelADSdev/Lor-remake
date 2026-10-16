"""Expand gameplay from audited, pinned local Data Dragon records, offline.

Run this directly to update cards.js, or use expand_cards.expand() when rebuilding
the original catalog. Every official collectible can be edited in the collection;
only cards with implemented rules enter automatic duels.
"""
import hashlib
import html
import json
import pathlib
import re
from PIL import Image
from supported_card_rules import RULES as BASE_RULES, SUPPORTED_KEYWORDS
from additional_card_rules import ADDITIONAL_RULES, MANUAL_ONLY
from next_card_rules import NEXT_RULES
from supported_champions import attach_champions
from curated_decks import add_curated_decks

GAME = pathlib.Path(__file__).resolve().parents[1]
RULES = {**BASE_RULES, **ADDITIONAL_RULES, **NEXT_RULES}
assert len(RULES)==len(BASE_RULES)+len(ADDITIONAL_RULES)+len(NEXT_RULES), 'Definições explícitas duplicadas.'


def import_supported_cards(payload, write=True):
    folder = GAME / 'research/datadragon'
    records, sets, english = {}, {}, {}
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    for source in sources:
        raw = (folder / source['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == source['sha256'], 'Snapshot oficial alterado.'
        for record in json.loads(raw):
            records[record['cardCode']] = record
            sets[record['cardCode']] = source['set']
        en_path = GAME.parent / 'datadragon_oficial/dados_multilingues/latest/en_us' / (source['set']+'-en_us.json')
        if en_path.exists():
            english.update({c['cardCode']: c for c in json.loads(en_path.read_text(encoding='utf-8'))})
    for code in RULES:
        assert code in records, 'Código de regra não existe no snapshot: '+code
    cards = payload['cards']
    original = set(cards)
    selected = set(RULES)
    for code, c in records.items():
        if c['collectible'] and c['type']=='Unidade' and c['rarityRef']!='Champion' and not c['descriptionRaw'].strip() and set(c['keywordRefs'])<=SUPPORTED_KEYWORDS:
            selected.add(code)

    # Follow only concrete token references. A missing rule is a hard error.
    def dependencies(value):
        if isinstance(value, dict):
            if value.get('action') in ('summon','create','summonMatchingSelf'):
                yield value['code']
            for child in value.values():
                yield from dependencies(child)
        elif isinstance(value, list):
            for child in value:
                yield from dependencies(child)
    selected.update(code for spec in RULES.values() for code in dependencies(spec))
    for code in list(cards):
        if cards[code].get('rulesSource') and code not in selected:
            del cards[code]
    for code in sorted(selected):
        c = records[code]
        if code not in original and code not in RULES:
            assert not c['descriptionRaw'].strip(), 'Token sem implementação: '+code
            assert set(c['keywordRefs'])<=SUPPORTED_KEYWORDS, 'Keyword não suportada: '+code
        # Existing gameplay cards retain their implementation and art.
        previous=cards.get(code,{})
        if code in cards and not (previous.get('rulesSource') or previous.get('image','').startswith('assets/catalog/')):
            cards[code]['subtypes'] = english.get(code,c).get('subtypes',[])
            continue
        rule = RULES.get(code,{})
        exceptional = {'LastBreath','Support','Scout','Fury','DoubleStrike','Imbue','ElementalSkill'}
        unknown = set(c['keywordRefs']) - SUPPORTED_KEYWORDS - exceptional - {'Burst','Fast','Slow','Focus'}
        assert not unknown, 'Keyword não suportada: '+code+repr(unknown)
        text=html.unescape(re.sub(r'<[^>]+>','',c.get('descriptionRaw',''))).strip()
        entry = dict(code=code,name=c['name'],cost=c['cost'],attack=c['attack'],health=c['health'],keywords=c['keywordRefs'],
                     type='unit' if c['type']=='Unidade' else 'ability' if c['type']=='Habilidade' else 'spell', champion=False,collectible=c['collectible'],speed=c['spellSpeedRef'],
                     effect='',amount=0,hp=0,text=text,region=c['regionRefs'][0],regions=c['regionRefs'],
                     subtypes=english.get(code,c).get('subtypes',[]),sourceSet=sets[code],
                     image=f'assets/catalog/{code}.webp',portrait=f'assets/catalog/{code}.webp',
                     sourceArt=c['assets'][0]['gameAbsolutePath'].replace('http:','https:'),rulesSource='reviewed-card-codes-v1')
        entry.update(rule)
        if entry.get('onAttack') and 'AttackSkillMark' in c.get('description',''):
            entry['attackSkill']=True
        if previous.get('rulesSource'):
            entry['image']=previous['image']
            entry['portrait']=previous['portrait']
        # Convert only newly playable art. All source pixels remain in the local
        # Data Dragon archive; the runtime receives full art instead of thumbnails.
        local = GAME.parent / f'datadragon_oficial/extraidos/latest_{sets[code]}-pt_br/pt_br/img/cards'
        for source_name, field, suffix, size in [(code+'-full.png','image','',(1280,1280)),(code+'.png','portrait','-card',(480,720))]:
            source_path=local/source_name
            destination=GAME/'assets/playable-art'/f'{code}{suffix}.webp'
            if source_path.exists():
                destination.parent.mkdir(exist_ok=True)
                if not destination.exists():
                    with Image.open(source_path) as image:
                        image.thumbnail(size,Image.Resampling.LANCZOS)
                        image.convert('RGB').save(destination,'WEBP',quality=88,method=4)
                entry[field]=destination.relative_to(GAME).as_posix()
        assert (GAME / entry['portrait']).exists(), 'Arte local ausente: '+code
        cards[code] = entry
    attach_champions(cards,records)
    added = sorted(set(cards)-original)
    report = dict(available_records=len(records),official_collectible=sum(c['collectible'] for c in records.values()),
                  playable_collectible=sum(c.get('collectible',True) for c in cards.values()),
                  playable_tokens=sum(not c.get('collectible',True) for c in cards.values()),
                  explicit_rules=len(RULES),added=sorted((set(payload.get('catalogInfo',{}).get('added',[]))|set(added))&set(cards)),
                  automated_collectible=sum(c.get('collectible',True) for c in cards.values()),
                  manual_only=MANUAL_ONLY,
                  excluded_reason='Regras automáticas limitadas às definições declarativas revisadas e palavras-chave suportadas. Os demais registros oficiais podem ser usados para montar e salvar decks na coleção, com regras de duelo pendentes.')
    effects_path=GAME/'card-effects-data.js'
    if effects_path.exists():
        effect_text=effects_path.read_text(encoding='utf-8').strip().removeprefix('window.CARD_EFFECTS_DATA = ').removesuffix(';')
        effect_data=json.loads(effect_text)
        linked={code for group in effect_data['groups'] for code in group.get('codes',[])}
        enabled={link['code'] for group in effect_data['groups'] if group.get('presentable') and group.get('family')!='MomentSkins' and group.get('classification')!='skin' for link in group.get('links',[]) if link.get('enabled')}
        def coverage(codes):
            official=codes&records.keys()
            collectible={code for code in official if records[code]['collectible']}
            return dict(resource_codes=len(codes),official_records=len(official),official_collectible=len(collectible),
                        automated_records=len(official&cards.keys()),automated_collectible=len(collectible&cards.keys()),
                        manual_records=len(official-cards.keys()),manual_collectible=len(collectible-cards.keys()))
        report['effect_code_associations']=coverage(linked)
        report['enabled_effect_links']=coverage(enabled)
    payload['catalogInfo']=report
    for key,codes,title in [
        ('summons',['01SI007','01SI010','01SI043','01SI048','01SI033','01SI049','01SI040','01SI023','01SI014','01SI001','01SI029','01SI054','02SI009','01SI015'], 'Ilhas das Sombras · Relíquias e Invocações'),
        ('recall',['01IO057','01IO011','01IO002','01IO020','01IO014','01IO029','01IO017','01IO006','01NX049','01NX046','01NX055','01NX054','01NX013','01IO024'], 'Ionia e Noxus · Retornos e Atordoamentos'),
        ('freljord_champions',['01FR039','01FR024','01FR009','01FR053','01FR003','01FR011','01FR022','01FR034','01FR041','01FR004','01FR005','01FR001','01FR046','01FR020'], 'Freljord · Fênix, Bárbaro e Poros'),
    ]:
        # A preset is created only when every effect is implemented.
        if all(code in cards for code in codes):
            payload['decks'][key]=(codes[:3]*2+codes[3:]*3+['01FR030']) if key=='freljord_champions' else codes[:-1]*3+codes[-1:]
            payload.setdefault('deckTitles',{})[key]=title
    add_curated_decks(payload)
    (folder/'supported-rules-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if write:
        (GAME/'cards.js').write_text('window.CARD_DATA = '+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
    return payload


if __name__=='__main__':
    text=(GAME/'cards.js').read_text(encoding='utf-8')
    payload=json.loads(text.removeprefix('window.CARD_DATA = ').strip().removesuffix(';'))
    import_supported_cards(payload)
    print(json.dumps(payload['catalogInfo'],ensure_ascii=False))
