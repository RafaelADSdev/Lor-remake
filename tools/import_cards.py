"""Recria o catálogo; reaproveita as artes locais e baixa as faltantes do Data Dragon."""
import json, pathlib, shutil
game=pathlib.Path(__file__).resolve().parents[1]
source=game.parent/'datadragon_oficial/extraidos/latest_set1-pt_br/pt_br'
cards={c['cardCode']:c for c in json.loads((source/'data/set1-pt_br.json').read_text(encoding='utf-8'))}
names={'01DE039':'Cithria de Campinuvem','01DE049':'Poro Valente','01DE020':'Defensora da Vanguarda','01DE046':'Vigia da Vanguarda','01DE028':'Cavalaria da Vanguarda','01DE030':'Precursora de Rapina','01DE056':'Primeira-Espada da Vanguarda','01DE018':'Golpe Radiante','01NX012':'Retaguarda da Legião','01NX015':'Cria Preciosa','01NX026':'Trifariano Imprudente','01NX041':'Quebra-escudos Trifariano','01NX040':'Sabotadora da Legião','01NX037':'Granadeiro da Legião','01NX044':'Aríete','01NX014':'Shiraza, a Lâmina','01NX002':'Dizimar','01NX043':'Fio da Lâmina','01NX027':'Elixir da Ira'}
effects={'01DE056':('growAttack',2,2),'01DE018':('buff',1,1),'01NX040':('attackDamage',1,0),'01NX037':('lastDamage',1,0),'01NX044':('growAttack',4,0),'01NX014':('doubleNexus',0,0),'01NX002':('nexusDamage',4,0),'01NX043':('damage',1,0),'01NX027':('buff',3,0)}
descriptions={'growAttack':'Ao atacar, ganho +{a}|+{h} permanentemente.','buff':'Dê +{a}|+{h} a um aliado nesta rodada.','attackDamage':'Ao atacar, cause 1 de dano ao Nexus inimigo.','lastDamage':'Ao morrer, cause 1 de dano ao Nexus inimigo.','doubleNexus':'Causo o dobro de dano ao Nexus quando não bloqueada.','nexusDamage':'Cause 4 de dano ao Nexus inimigo.','damage':'Cause 1 de dano a um inimigo ou ao Nexus inimigo.'}
catalog={}
names.update({'01DE012':'Garen','01DE012T1':'Garen','01DE012T2':'Julgamento de Garen','01NX038':'Darius','01NX038T2':'Darius','01NX038T1':'Dizimar de Darius'})
effects.update({'01DE012':('garen',1,1),'01DE012T1':('garen',1,1),'01DE012T2':('judgment',0,0),'01NX038T1':('nexusDamage',4,0)})
descriptions.update({'garen':'Ao me invocar, dê +1|+1 aos outros aliados nesta rodada. Regeneração.','judgment':'Um aliado em batalha golpeia todos os inimigos em batalha. Embaralhe 1 Garen no deck.'})
for code,name in names.items():
 c=cards[code];e,a,h=effects.get(code,('',0,0))
 catalog[code]={'code':code,'name':name,'cost':c['cost'],'attack':c['attack'],'health':c['health'],'keywords':c['keywordRefs'],'type':'unit' if c['type']=='Unidade' else 'spell','effect':e,'amount':a,'hp':h,'text':descriptions[e].format(a=a,h=h) if e else '', 'region':c['regionRefs'][0],'image':'assets/'+code+'.png','portrait':'assets/lor-motion/'+code+'-card.png'}
 catalog[code].update({'collectible':c['collectible'],'speed':c['spellSpeedRef'],'champion':c['type']=='Unidade' and c['rarityRef']=='Champion' or code in ('01DE012T1','01NX038T2')})
 if code=='01DE056':catalog[code]['text']='Ao atacar, ganho +2|+2 nesta rodada.'
 shutil.copyfile(source/'img/cards'/f'{code}-full.png',game/'assets'/f'{code}.png')
 (game/'assets/lor-motion').mkdir(exist_ok=True)
 shutil.copyfile(source/'img/cards'/f'{code}.png',game/'assets/lor-motion'/f'{code}-card.png')
dem=['01DE039','01DE049','01DE020','01DE046','01DE028','01DE030','01DE056','01DE018','01NX043','01NX027']
nox=['01NX012','01NX015','01NX026','01NX041','01NX040','01NX037','01NX044','01NX014','01NX002','01NX043']
for base,level,spell in [('01DE012','01DE012T1','01DE012T2'),('01NX038','01NX038T2','01NX038T1')]:
 for code in [base,level]:catalog[code].update({'championKey':base,'level':1 if code==base else 2,'strikes':0})
 catalog[base]['levelText']='Golpeei duas vezes.' if base=='01DE012' else 'Vejo o Nexus inimigo com 10 ou menos de vida.'
 catalog[level]['text']=catalog[base]['text']+(' Início de rodada: Mobilizar.' if base=='01DE012' else '')
 catalog[spell]['text']+=' Embaralhe 1 '+catalog[base]['name']+' no deck.' if base=='01NX038' else ''
 leveled=dict(catalog[level]);spell_data=dict(catalog[spell]);base_stats={k:catalog[base][k] for k in ['code','attack','health','cost','name','image','portrait','keywords','text']}
 for code in [base,level]:catalog[code].update({'levelSpec':leveled,'spellSpec':spell_data,'baseStats':base_stats})
starter_dem=dem+['01DE012','01NX015','01NX026','01NX041']
starter_nox=nox+['01NX038','01DE039','01DE020','01DE046']
payload={'cards':catalog,'decks':{'demacia':starter_dem[:-1]*3+starter_dem[-1:],'noxus':starter_nox[:-1]*3+starter_nox[-1:]}}
from expand_cards import expand
payload=expand(payload)
(game/'cards.js').write_text('window.CARD_DATA = '+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
print(f'{len(catalog)} cartas e artes locais importadas.')
