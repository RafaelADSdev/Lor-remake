"""Champion forms attached only after all associated rules/art exist."""
import copy

CHAMPIONS = [
    ('01FR039','01FR039T2','01FR039T1'),
    ('01FR024','01FR024T3','01FR024T1'),
    ('01FR009','01FR009T1','01FR009T2'),
]


def attach_champions(cards, records):
    for base, level, spell in CHAMPIONS:
        for code, number in [(base,1),(level,2)]:
            cards[code].update(champion=True,championKey=base,level=number,strikes=0)
            cards[code]['levelText']=records[code]['levelupDescriptionRaw']
        level_spec=copy.deepcopy(cards[level])
        spell_spec=copy.deepcopy(cards[spell])
        base_stats={key:copy.deepcopy(cards[base][key]) for key in ['code','attack','health','cost','name','image','portrait','keywords','text']}
        for code in [base, level]:
            cards[code].update(levelSpec=level_spec,spellSpec=spell_spec,baseStats=base_stats)
    egg=cards['01FR024T4']
    egg.update(champion=True,championKey='01FR024',level=1,spellSpec=copy.deepcopy(cards['01FR024T1']),baseStats=copy.deepcopy(cards['01FR024']['baseStats']))
    egg['levelText']=records['01FR024T4']['levelupDescriptionRaw']
