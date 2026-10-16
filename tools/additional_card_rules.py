"""Explicit mixed-target, revival, hand-target and mana rules."""
from supported_card_rules import action, B, S, D, spell, trigger

def slots(*specs):
    return {'targetCount':len(specs),'targetSlots':[{'side':s} if isinstance(s,str) else s for s in specs]}

ADDITIONAL_RULES = {
    '01DE026': spell(action('strikePair',mutual=True),**slots('ally','enemy')),
    '01NX011': spell(action('strikePair'),**slots({'side':'ally','combat':True},{'side':'enemy','combat':True})),
    '03NX022': spell(action('strikePair',overwhelm=True),**slots('ally','enemy')),
    '05DE017': spell(action('healFull',targetIndex=0),action('strikePair',mutual=True),**slots('ally','enemy')),
    '08DE010': spell(B(0,2,targetIndex=0),action('strikePair',mutual=True),**slots('ally','enemy')),
    '01NX047': spell(action('damage',amount=1,targetIndex=0),B(2,2,targetIndex=1),**slots('ally','ally')),
    '01SI025': spell(action('atrocity'),**slots('ally',{'side':'unit','allowNexus':'both'})),
    '02NX003': spell(action('damage',amount=3,targetIndex=0),action('damageAnything',amount=3,targetIndex=1),**slots('ally',{'side':'unit','allowNexus':'both'})),
    '01SI032': trigger('onPlay',action('killRevive'),target='ally'),
    '01SI003': spell(action('revive',count=6,strongest=True,ephemeral=True)),
    '01SI046': spell(action('revive',random=True,roundOnly=True)),
    '01SI020': trigger('onSummon',action('revive',strongest=True,champion=True)),
    '01FR023': spell(action('summonDeckTop',repeat=True)),
    '01FR012': spell(action('ramp',amount=1,empty=True),action('healNexus',amount=3)),
    '06FR036': spell(action('ramp',amount=1,empty=True),S('01FR047')),
    '01FR033': trigger('onRoundStart',action('ramp',amount=1,temporary=True)),
    '01FR047': dict(conditionalStats={'ifEnlightened':True,'amount':4,'hp':4}),
    '01IO053': dict(conditionalStats={'ifEnlightened':True,'amount':4,'hp':4}),
    '01IO026': trigger('onPlay',B(1,permanent=True),target={'side':'ally','zone':'hand','type':'unit'}),
    '01IO023': trigger('onPlay',B(3,3,permanent=True),target={'side':'ally','zone':'hand','type':'unit'}),
    '01DE055': trigger('onPlay',B(permanent=True,grantKeywords=['Challenger']),target={'side':'ally','zone':'hand','type':'unit'}),
    '01IO055': spell(B(permanent=True,grantKeywords=['Barrier']),D(),target={'side':'ally','zone':'hand','type':'unit'}),
    '01NX052': spell(action('damage',amount=1),action('copyHand',ifTargetAlive=True),target={'side':'ally','follower':True}),
    '08BW002': spell(action('damage',amount=2,cannotKill=True),target='unit'),
    '01FR050': trigger('onPlay',action('healAnything',amount=3),target={'side':'ally','allowNexus':'ally'}),
    '03MT060': trigger('onRoundStart',action('healNexusDamageSelf',amount=3)),
    '01FR032': trigger('onSpell',B(1,1,scope='deck',top=True,limit=1,permanent=True)),
    '01IO036': trigger('onStrike',action('discountMostExpensiveUnit',amount=1)),
    '08PZ028': dict(onSpell=[D()],onOverdraw=[action('nexusDamage',amount=1)]),
    '03MT092': trigger('onStrike',action('create',code='03MT092T1')),
    '03MT048': trigger('onSummon',action('create',code='03MT092T1')),
    '03MT041': dict(supportRules=[B(2,2,permanent=True)],onDeath=[action('create',code='03MT092T1',count=3)]),
    '03MT025': spell(action('fillHand',code='03MT092T1')),
    '03MT092T1': spell(action('heal',amount=1),B(1,permanent=True),target='ally',speed='Focus'),
}

MANUAL_ONLY = {
    '06SI045': 'Interação de cópias com prevenção da morte de Tryndamere ainda não comprovada por fonte primária; disponível na coleção, com regras de duelo pendentes.',
    '01IO003': 'Atomicidade da transferência de Efêmero contra Escudo de Feitiço ainda não comprovada por fonte primária; disponível na coleção, com regras de duelo pendentes.',
}
