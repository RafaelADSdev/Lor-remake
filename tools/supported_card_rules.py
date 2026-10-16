"""Reviewed card-code rules. Text is evidence, never executable input.

Every trigger is opt-in here. Random creation is allowed only with a complete
official pool whose members have implemented rules; no partial random pools.
"""
def action(kind, **fields):
    return dict(action=kind, **fields)

def spell(*rules, target=None, **fields):
    result = dict(effect='rules', rules=list(rules), **fields)
    if target:
        result['ruleTarget'] = dict(side=target) if isinstance(target, str) else target
    return result

def trigger(hook, *rules, target=None, **fields):
    result = {hook: list(rules), **fields}
    if target:
        result['ruleTarget'] = dict(side=target) if isinstance(target, str) else target
    return result

B = lambda a=0, h=0, **kw: action('buff', amount=a, hp=h, **kw)
S = lambda code, count=1, **kw: action('summon', code=code, count=count, **kw)
C = lambda code, count=1, **kw: action('create', code=code, count=count, **kw)
D = lambda n=1, **kw: action('draw', amount=n, **kw)

RULES = {
    # Ionia: summon/play, draw, recall, attack and strike hooks.
    '01IO020': trigger('onSummon', B(1, scope='ally', other=True)),
    '01IO014': trigger('onSummon', B(1, 1, scope='hand', permanent=True)),
    '01IO029': spell(B(1, scope='hand', permanent=True)),
    '01IO057': trigger('onSummon', D()),
    '01IO021': trigger('onSummon', B(2, 2, scope='ally', other=True)),
    '01IO017': trigger('onSummon', B(scope='self', grantKeywords=['Elusive'])),
    '01IO042': trigger('onOtherSummon', B(1, 1, scope='self')),
    '01IO006': trigger('onOtherSummon', B(1, scope='self')),
    '01IO007': trigger('onStrike', C('01IO013')),
    '01IO043': trigger('onStrike', D(filter={'type':'spell'})),
    '01IO052': trigger('onSummon', action('summonMatchingSelf', code='01IO052T1')),
    '01IO027': trigger('onNexusStrike', C('01IO027')),
    '01IO011': spell(action('recall'), target='ally'),
    '01IO002': spell(action('recall'), target='unit'),
    '01IO024': spell(action('copySummon', count=2, ephemeralCopy=True), target='ally'),
    '01IO038': trigger('onPlay', action('recall', scope='ally', other=True)),
    '01IO046': spell(action('stun'), target={'side':'enemy','attacking':True}),
    '01IO047': spell(B(scope='all', combat=True, followersOnly=True, permanent=True, grantKeywords=['Ephemeral'])),
    # Noxus.
    '01NX055': trigger('onSummon', S('01SI002')),
    '01NX046': trigger('onPlay', action('stun'), target='enemy', skill=True),
    '01NX049': spell(action('stun'), target='enemy'),
    '01NX054': spell(action('stun', scope='enemy', maxPower=4)),
    '01NX013': spell(action('stun'), B(2, scope='ally'), target='enemy'),
    '01NX007': trigger('onAttack', B(1, scope='ally', other=True, combat=True)),
    '01NX009': trigger('onSummon', B(scope='self', perOtherAlly=True, hpPerAmount=True, permanent=True)),
    '01NX010': trigger('onSummon', B(scope='self', perStunRecall=True, hpPerAmount=True, permanent=True)),
    '01NX016': trigger('onSummon', B(2, scope='self', ifOtherRegion='Noxus', permanent=True)),
    '01NX051': trigger('onSummon', C('01NX002', 2)),
    '01NX033': trigger('onSummon', action('drawPerAlly', minPower=5)),
    '01NX032': trigger('onSummon', action('damage', amount=1, scope='ally', other=True)),
    '01NX050': spell(action('damage', amount=1, scope='all', combat=True)),
    '01NX056': spell(action('damage', amount=2), action('rally'), target='enemy'),
    '01NX030': trigger('onSurviveDamage', action('nexusDamage', amount=1)),
    # Demacia.
    '01DE002': trigger('onSummon', action('rally')),
    '01DE052': dict(onSummon=[B(scope='ally',grantKeywords=['Barrier'])],onAttack=[B(scope='ally',grantKeywords=['Barrier'])]),
    '01DE019': spell(action('discountHand', amount=1, unitsOnly=True)),
    '01DE047': spell(S('01DE016')),
    '01DE004': trigger('onPlay', action('copySummon', scope='self')),
    '01DE044': spell(action('healFull'), action('doubleStats'), target='ally'),
    '01DE015': trigger('onSummon', B(scope='self', permanent=True, ifDiedRound=True, grantKeywords=['Lifesteal','Tough'])),
    '01DE003': trigger('onPlay', B(2, 2, permanent=True), target='ally'),
    '01DE009': trigger('onPlay', B(grantKeywords=['Barrier']), target='ally'),
    '01DE027': spell(B(scope='ally', grantKeywords=['Challenger'])),
    '01DE006': trigger('onSummon', C('01DE035')),
    '01DE029': trigger('onOtherSummon', B(scope='self', permanent=True, grantKeywords=['Challenger'])),
    '01DE051': trigger('onAttack', B(1, 1, scope='ally', combat=True, other=True, grantKeywords=['Fearsome'])),
    '01DE054': trigger('onSummon', D(ifDiedRound=True, filter={'type':'unit'})),
    # Piltover: concrete tokens, draw, mana and strike effects.
    '01PZ019': trigger('onSummon', action('refill', amount=2)),
    '01PZ028': dict(**spell(S('01PZ032')),onDiscard=[S('01PZ032')]),
    '01PZ054': trigger('onAttack', action('nexusDamage', amount=2)),
    '01PZ057': spell(S('01PZ032',2)),
    '01PZ014': spell(S('01PZ014T1')),
    '01PZ049': spell(D(3,discount=1)),
    '01PZ055': trigger('onDraw', B(1,scope='self')),
    '01PZ003': trigger('onSpell', B(1,1,scope='self',permanent=True)),
    '01PZ044': trigger('onPlay', action('damage',amount=1,scope='enemy'),skill=True),
    '01PZ021': trigger('onNexusStrike',action('copySummon',scope='self')),
    '01PZ017': trigger('onSummon',S('01PZ047',2)),
    '01PZ047': trigger('onDeath',action('bothNexusDamage',amount=1)),
    # Freljord.
    '01FR022': trigger('onSummon',B(1,1,scope='deck',top=True,limit=2,permanent=True)),
    '01FR029': spell(D(filter={'champion':True})),
    '01FR030': spell(action('freeze'),target={'side':'enemy','maxHealth':3}),
    '01FR041': trigger('onSummon',B(1,1,scope='deck',permanent=True)),
    '01FR011': trigger('onPlay',action('freeze'),target='enemy'),
    '01FR056': trigger('onSummon',action('freeze',scope='enemy',maxHealth=3)),
    '01FR040': trigger('onRoundStart',action('freeze',scope='enemy',strongest=True,limit=1)),
    '01FR034': trigger('onSummon',B(scope='self',perDeath=True,hpPerAmount=True,permanent=True)),
    '01FR003': trigger('onDeath',D()),
    '01FR007': trigger('onSummon',D(filter={'type':'unit','minPower':5})),
    '01FR013': trigger('onSurviveDamage',B(3,scope='self',permanent=True)),
    '01FR035': trigger('onSurviveDamage',B(3,scope='self',permanent=True)),
    '01FR045': trigger('onSurviveDamage',B(3,scope='self',permanent=True)),
    '01FR046': spell(B(3,3,permanent=True),target={'side':'ally','damaged':True}),
    '01FR019': spell(action('kill',scope='enemy',maxPower=0),action('freeze',scope='enemy')),
    '01FR049': trigger('onSummon',S('01FR049T1',enemy=True)),
    # Shadow Isles.
    '01SI007': spell(S('01SI007T1',3)),
    '01SI010': spell(S('01SI024',2)),
    '01SI043': trigger('onDeath',S('01SI002')),
    '01SI048': trigger('onDeath',S('01SI048T1')),
    '01SI033': dict(onPlay=[action('halfNexus')],skill=True,onDeath=[action('returnSelf')]),
    '01SI049': spell(action('kill'),D(2),target='ally'),
    '01SI040': spell(action('drainTarget',amount=1),S('01SI002'),target='unit'),
    '01SI045': spell(action('drainTarget',amount=4),target='ally'),
    '01SI036': spell(S('01SI002',2),requiresDeathsRound=1),
    '01SI050': spell(S('01SI002',3),B(1,scope='ally',subtype='SPIDER',permanent=True)),
    '01SI034': dict(effect='damage',amount=4,unitsOnly=True,targetMode='any',requiresDeathsRound=1),
    '01SI038': trigger('onAllyDeath',action('nexusDamage',amount=1)),
    '01SI023': trigger('onOtherSummon',B(1,1,ephemeral=True,permanent=True)),
    '01SI014': trigger('onSummon',B(1,scope='global',codeMatch='01SI014',permanent=True)),
    '01SI028': spell(action('copySummon',count=1,ephemeralCopy=True,one=True),target='ally'),
    '01SI047': spell(action('copyHand',ephemeralCopy=True),target={'side':'unit','follower':True}),
    # Rising Tides.
    '02PZ010': trigger('onSummon',action('drawBoth',amount=1)),
    '02BW020': dict(effect='nexusDamage',amount=1),
    '02NX006': trigger('onRoundStart',action('nexusDamage',amount=1)),
    '02NX002': trigger('onAttack',action('stun',scope='enemy',damaged=True)),
    '02NX008': spell(action('damage',amount=2),action('nexusDamage',amount=1),target='enemy'),
    '02DE002': spell(S('02DE006T2')),
    '02DE007': spell(B(scope='ally',grantKeywords=['Tough'])),
    '02DE009': trigger('onDeath',S('02DE003')),
    '02DE010': trigger('onSummon',B(1,1,scope='ally',other=True)),
    '02DE006T2': {},
    '02SI008T3': {},
    '02SI009': spell(action('schedule',rules=[S('02SI008T3')])),
    '02SI001': trigger('onAllyDeath',action('drainNexus',amount=1)),
    '02FR007': spell(B(3,4)),
    '02BW035': trigger('onSummon',B(scope='enemy',permanent=True,grantKeywords=['Vulnerable'])),
    '02BW038': trigger('onSummon',D(filter={'type':'spell','maxCost':3})),
    '02BW005': trigger('onSummon',B(scope='enemy',strongest=True,limit=1,permanent=True,grantKeywords=['Vulnerable'])),
    '02BW027': trigger('onSummon',S('02BW036',enemy=True)),
    '02IO005': spell(action('stun'),S('02IO005T1'),target='enemy'),
    '02IO005T1': dict(recallAs='02IO005'),
    # Later sets with fully representable rules.
    '03NX014': spell(B(3,2)),
    '03NX005': trigger('onSummon',B(scope='self',grantKeywords=['QuickStrike'])),
    '03MT067': trigger('onPlay',B(permanent=True,grantKeywords=['Overwhelm']),target='ally'),
    '03MT036': spell(B(3,3,permanent=True)),
    '03MT051': dict(effect='heal',amount=2,draw=1),
    '03MT098': spell(B(0,2,permanent=True)),
    '03MT019': spell(B(1,1,permanent=True,grantKeywords=['SpellShield'])),
    '03MT008': spell(action('healFull',scope='ally',damaged=True)),
    '03IO011': trigger('onStrike',action('doubleAttack',scope='self')),
    '03IO003': trigger('onPlay',B(permanent=True,grantKeywords=['Elusive']),target='ally'),
    '03FR025': spell(action('regenerationGift'),target='ally'),
    '04IO015': trigger('onRecall',D()),
    '04IO014': trigger('onOtherSummon',B(1,scope='self',ifTargetEphemeral=True)),
    '04IO006': trigger('onOtherSummon',B(2,scope='self')),
    '04SH015': trigger('onAttack',B(-2,scope='enemy')),
    '04SH045': spell(B(-2,grantKeywords=['Vulnerable']),target='enemy'),
    '04SH103': trigger('onPlay',B(permanent=True,grantKeywords=['Vulnerable']),target='enemy'),
    '04SH081': trigger('onPlay',B(-1,permanent=True,grantKeywords=['Vulnerable']),target='enemy'),
    '04FR005T4': dict(onAttack=[action('watcher')],costBySummoned8=True),
    '06NX012T1': trigger('onPlay',action('stun'),action('damage',scope='enemy',amount=2,stunnedOrDamaged=True),target='enemy',skill=True),
    '06SI046': trigger('onDeath',D()),
    '06DE041': spell(B(4,4,scope='ally'),action('rally')),
    '07SI001': spell(action('kill',scope='all',maxPower=3)),
    '07DE005': spell(B(2,2)),
    '07IO041': spell(action('healNexus',amount=3),D(2,filter={'type':'spell'})),
    '07FR017': trigger('onPlay',action('damage',amount=2,scope='all',other=True),skill=True),
    '08PZ005': spell(B(2),D(2),target='ally'),
    '08FR019': spell(B(1,3),target='ally'),
    '08DE025': trigger('onSummon',action('discountHand',amount=1,unitsOnly=True)),
    '08IO023': trigger('onPlay',action('copySummon',scope='self',ephemeralCopy=True)),
    '01DE014': spell(S('01DE016',2),B(1,1,scope='ally',subtype='ELITE',permanent=True)),
    '01FR016': spell(B(1,1,scope='global',subtype='PORO',permanent=True)),
    '01SI019': spell(action('damage',amount=3,scope='enemy',summonedThisRound=True)),
    '01FR055': spell(action('shatter',amount=4),target='enemy'),
    '02NX009': spell(action('damage',amount=4),target={'side':'unit','stunnedOrDamaged':True}),
    '02FR004': spell(action('freeze'),B(grantKeywords=['Vulnerable']),target='enemy'),
    '02PZ004': spell(B(2),C('02PZ004',fleeting=True),target='ally'),
    '03MT045': spell(action('heal',amount=4),B(0,4,permanent=True),target='ally'),
    '03SI013': spell(S('01SI014')),
    '03SI014': spell(B(2,2,scope='hand',permanent=True,grantKeywords=['Ephemeral']),B(2,2,scope='deck',permanent=True,grantKeywords=['Ephemeral'])),
    '03PZ013': spell(action('copyHand',amount=1,hp=1),target={'side':'unit','follower':True}),
    '03FR008': spell(B(-3,scope='all'),action('damage',amount=3,scope='all')),
    '03NX019': spell(action('discardEnemyWeakestFollower')),
    '03IO019': spell(action('recall',scope='all',exceptTarget=True),target='ally'),
    '04SH099': spell(S('04SH003T1'),C('04SH099',fleeting=True)),
    '04SH075': spell(B(scope='enemy',grantKeywords=['Vulnerable']),S('04SH003T1',6)),
    '04SH003T1': trigger('onNexusStrike',action('nexusDamage',amount=1)),
    '05SI003': spell(action('drainTarget',amount=5),target='unit'),
    '05SI016': spell(action('kill'),B(-2,scope='enemy'),target='unit'),
    '06PZ046': spell(D(2),action('refill',amount=3)),
    '06SH011': spell(B(permanent=True,grantKeywords=['Overwhelm','SpellShield']),target='ally'),
    '06SH056': spell(action('kill',scope='all',followersOnly=True)),
    '06MT036': spell(action('healFull',scope='ally'),action('powerToHealth',scope='ally')),
    '08SI030': spell(action('obliterateBottom',amount=6)),
    '08BW032': spell(B(1,scope='ally'),action('heal',amount=2,scope='ally',damaged=True)),
    '08NX029': spell(action('killDamagedElseDamage',amount=2),target='unit'),
    '08BC020': spell(action('discardEnemyHighestCost')),
    '09DE047': spell(S('04SH003T14'),B(scope='ally',grantKeywords=['Challenger'])),
    '09IO059': spell(action('stun'),action('schedule',rules=[action('stun')]),target='enemy'),
    # Freljord champions, their level forms and authentic signature spells.
    '01FR039': {},
    '01FR039T2': {},
    '01FR039T1': spell(B(8,4,permanent=True),target='ally'),
    '01FR009': dict(survivalToken='01FR053'),
    '01FR009T1': dict(survivalToken='01FR053'),
    '01FR009T2': spell(B(3,3,permanent=True),target={'side':'ally','damaged':True}),
    '01FR024': dict(onAttack=[action('damage',amount=1,scope='enemy'),action('nexusDamage',amount=1)],attackSkill=True,attackSkillCode='01FR024T2',onDeath=[S('01FR024T4')]),
    '01FR024T3': dict(onAttack=[action('damage',amount=2,scope='enemy'),action('nexusDamage',amount=2)],attackSkill=True,attackSkillCode='01FR024T5',onDeath=[S('01FR024T4')]),
    '01FR024T4': dict(aniviaEgg=True,reviveAs='01FR024'),
    '01FR024T2': spell(action('damage',amount=1,scope='enemy'),action('nexusDamage',amount=1)),
    '01FR024T5': spell(action('damage',amount=2,scope='enemy'),action('nexusDamage',amount=2)),
    '01FR024T1': spell(action('freeze'),target='enemy',targetCount=2),
}

# Single-target buffs require the same explicit ally selection in every case.
for code in ['03NX014','02FR007','03MT036','03MT098','03MT019','07DE005']:
    RULES[code]['ruleTarget']={'side':'ally'}

# These keywords do not require target selection on their own. Support is allowed
# only on the reviewed support cards below; LastBreath requires an explicit hook.
SUPPORTED_KEYWORDS = {
    'Tough','Elusive','Fearsome','CantBlock','Overwhelm','QuickStrike',
    'Regeneration','Attune','Lifesteal','Ephemeral','Barrier','Challenger',
    'Vulnerable','SpellShield','Brash','Immobile','Scout','Fury',
}

SUPPORT_RULES = {
    '01IO045': B(grantKeywords=['Lifesteal']),
    '01NX017': B(grantKeywords=['QuickStrike']),
    '01NX024': B(3,grantKeywords=['Overwhelm']),
    '01DE043': B(1,1),
    '01PZ042': B(grantKeywords=['Elusive']),
    '01SI009': B(2,permanent=True,grantKeywords=['Ephemeral']),
    '03MT071': B(0,2,permanent=True),
    '03IO017': B(2,1),
    '03IO010': B(1,grantKeywords=['QuickStrike']),
}
for code,rule in SUPPORT_RULES.items():
    RULES[code]={'supportRules':[rule]}
