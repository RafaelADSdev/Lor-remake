const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const runtime='C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const result=spawnSync(process.env.PYTHON||runtime,['-c',
  'import json,sys;sys.path.insert(0,"tools");from next_card_rules import NEXT_RULES;print(json.dumps(NEXT_RULES))'],
  {cwd:root,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const next=JSON.parse(result.stdout);
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'cards.js'),'utf8'),context);
const data=JSON.parse(JSON.stringify(context.window.CARD_DATA));
const sources=JSON.parse(fs.readFileSync(path.join(root,'research/datadragon/sources.json'),'utf8'));
const official={},english={};
for(const source of sources){
  for(const c of JSON.parse(fs.readFileSync(path.join(root,'research/datadragon',source.file),'utf8')))official[c.cardCode]=c;
  for(const c of JSON.parse(fs.readFileSync(path.join(root,'../datadragon_oficial/dados_multilingues/latest/en_us',source.set+'-en_us.json'),'utf8')))english[c.cardCode]=c;
}
// Construct isolated fixture definitions; never invoke the importer or rewrite cards.js.
const catalog={...data.cards};
function add(code){
  if(catalog[code]&&!next[code])return;
  const c=official[code];assert.ok(c,code);
  catalog[code]={code,name:c.name,cost:c.cost,attack:c.attack,health:c.health,
    type:c.type==='Unidade'?'unit':'spell',keywords:c.keywordRefs,
    speed:c.spellSpeedRef,champion:false,collectible:c.collectible,
    subtypes:english[code].subtypes,region:c.regionRefs[0],regions:c.regionRefs,
    effect:'',...(next[code]||{})};
}
for(const code of Object.keys(next))add(code);
function dependencies(value){
  if(Array.isArray(value)){value.forEach(dependencies);return;}
  if(!value||typeof value!=='object')return;
  if(['summon','create'].includes(value.action))add(value.code);
  Object.values(value).forEach(dependencies);
}
Object.values(next).forEach(dependencies);
const E=require('../engine.js');
function setup(){const s=E.create(catalog,data.decks.demacia,data.decks.noxus,9,{faithful:true,skipMulligan:true});s.cardCatalog=catalog;s.players.forEach(p=>{p.hand=[];p.board=[];p.mana=10;p.spellMana=3;});return s;}
function put(s,i,code,zone='hand'){const c={...structuredClone(catalog[code]),id:'c'+s.nextId++,maxHealth:catalog[code].health};s.players[i][zone].push(c);return c;}
function use(s,i,code,target){s.priority=i;s.players[i].mana=10;s.players[i].spellMana=3;const c=put(s,i,code);E.play(s,i,c.id,target);if(s.phase==='response')E.pass(s,s.priority);return c;}
function nextRound(s){E.pass(s,s.priority);E.pass(s,s.priority);}

test('new opt-in rules use real bilingual official records and deterministic dependencies',()=>{
  assert.ok(Object.keys(next).length>=75);
  let collectible=0;
  for(const [code,spec] of Object.entries(next)){
    assert.ok(official[code]&&english[code],code);
    assert.equal(official[code].cost,english[code].cost,code);
    assert.equal(official[code].attack,english[code].attack,code);
    assert.equal(official[code].health,english[code].health,code);
    assert.ok(official[code].descriptionRaw.trim()&&english[code].descriptionRaw.trim(),code);
    if(official[code].collectible)collectible++;
    assert.ok(!JSON.stringify(spec).includes('"pool"'),code+' must not approximate a random pool');
  }
  assert.ok(collectible>=75);
});
test('two-ally permanent and temporary buffs affect only selected identities',()=>{
  for(const [code,attack,hp,permanent] of [['01NX025',2,0,true],['01DE041',3,3,false],['01FR010',0,3,true],['05BC141',2,1,false],['05MT009',2,2,true],['05MT002',1,2,false]]){
    const s=setup(),a=put(s,0,'01DE039','board'),b=put(s,0,'01DE039','board'),untouched=put(s,0,'01DE039','board');
    use(s,0,code,[a.id,b.id]);
    assert.equal(a.attack,catalog[a.code].attack+attack,code);assert.equal(a.maxHealth,catalog[a.code].health+hp,code);
    assert.equal(b.attack,a.attack,code);assert.equal(untouched.attack,catalog[untouched.code].attack,code);
    nextRound(s);assert.equal(a.attack,catalog[a.code].attack+(permanent?attack:0),code);assert.equal(a.maxHealth,catalog[a.code].health+(permanent?hp:0),code);
  }
});
test('Yone and Minah select distinct enemies and resolve through a responding skill',()=>{
  for(const [code,n,kind] of [['01IO056',2,'stun'],['01IO033',3,'recall']]){
    const s=setup(),enemies=Array.from({length:4},()=>put(s,1,'01DE039','board'));
    E.play(s,0,put(s,0,code).id,enemies.slice(0,n).map(u=>u.id));
    assert.equal(s.phase,'response');assert.equal(s.players[1].board.length,4);assert.ok(!enemies[0].stunned);
    E.pass(s,1);
    if(kind==='stun'){assert.ok(enemies.slice(0,n).every(u=>u.stunned));assert.ok(!enemies[n].stunned);}
    else {assert.equal(s.players[1].board.length,1);assert.equal(s.players[1].hand.length,n);}
  }
});
test('Spiders and Elites only grant stats to the matching summoned subtype',()=>{
  const s=setup();use(s,0,'01DE034');s.priority=0;const elite=put(s,0,'01DE039');E.play(s,0,elite.id);
  assert.equal(elite.attack,catalog[elite.code].attack+1);
  use(s,0,'05BC108');const y=use(s,0,'05BC102');assert.equal(y.attack,catalog[y.code].attack+1);
  const plain=use(s,0,'01PZ047');assert.equal(plain.attack,catalog[plain.code].attack);
  const t=setup(),spider=put(t,0,'01SI002','board'),other=put(t,0,'01DE039','board');use(t,0,'01NX023');
  assert.equal(spider.attack,catalog[spider.code].attack+2);assert.equal(other.attack,catalog[other.code].attack);
});
test('Marauder everywhere buffs affect existing and future copies',()=>{
  const s=setup(),a=put(s,0,'01NX021','board'),b=put(s,0,'01NX021','board');
  E.attack(s,0,[a.id]);E.resolve(s,{});assert.equal(a.attack,catalog[a.code].attack+1);assert.equal(b.attack,a.attack);
  use(s,0,'04NX017');const copies=s.players[0].board.filter(u=>u.id!==a.id&&u.id!==b.id);
  assert.equal(copies.length,2);assert.ok(copies.every(u=>u.attack===catalog[a.code].attack+1));
});
test('concrete Fae creation grants hand subtype buffs and future summons correctly',()=>{
  const s=setup();use(s,0,'05BC183');const owl=s.players[0].hand.find(u=>u.code==='05BC167T1');assert.ok(owl);
  use(s,0,'05BC218');const owls=s.players[0].hand.filter(u=>u.code==='05BC167T1');assert.equal(owls.length,2);
  assert.ok(owls.every(u=>u.attack===catalog[u.code].attack+1));s.priority=0;E.play(s,0,owl.id);assert.equal(owl.attack,catalog[owl.code].attack+2);
});
test('Necrotic Arachnoid summons actual nestlings and drains once per other death',()=>{
  const s=setup();use(s,0,'07SI010');assert.equal(s.players[0].board.filter(u=>u.code==='07SI010T1').length,2);
  s.players[0].nexus=12;const victim=s.players[0].board.find(u=>u.code==='07SI010T1');use(s,1,'01SI001',victim.id);
  assert.equal(s.players[1].nexus,19);assert.equal(s.players[0].nexus,13);
});
test('Minion schedules a fresh copy into hand at next round start',()=>{
  const s=setup(),m=put(s,0,'05BC119','board');m.attack+=5;use(s,1,'01SI001',m.id);
  assert.equal(s.players[0].hand.length,0);nextRound(s);
  const copy=s.players[0].hand.find(u=>u.code===m.code);assert.ok(copy);assert.equal(copy.attack,catalog[m.code].attack);
});
test('Here to Help checks damage before applying its health grant',()=>{
  for(const damaged of [false,true]){const s=setup(),u=put(s,0,'01DE046','board');if(damaged)u.health--;const previousHealth=u.health;
    use(s,0,'06FR035',u.id);assert.equal(u.attack,catalog[u.code].attack+(damaged?2:0));assert.equal(u.health,previousHealth+3);}
});
test('Reckoning needs a five-power ally at resolution',()=>{
  for(const strong of [false,true]){const s=setup(),enemy=put(s,1,'01DE039','board');if(strong)put(s,0,'01DE046','board').attack=5;
    use(s,0,'01NX053');assert.equal(s.players[1].board.some(u=>u.id===enemy.id),!strong);}
});
test('She Who Wanders obliterates weak units without last breaths and respects SpellShield',()=>{
  const s=setup(),shielded=put(s,1,'03MT007','board'),unshielded=put(s,1,'01FR003','board');
  shielded.attack=1;unshielded.attack=1;const handUnit=put(s,1,'01DE039'),draws=s.players[1].deck.length;
  const source=put(s,0,'01FR052');source.cost=0;E.play(s,0,source.id);assert.equal(s.phase,'response');E.pass(s,1);
  assert.ok(s.players[1].board.some(u=>u.id===shielded.id));assert.ok(!shielded.keywords.includes('SpellShield'));
  assert.ok(!s.players[1].board.some(u=>u.id===unshielded.id));assert.ok(!s.players[1].hand.some(u=>u.id===handUnit.id));
  assert.equal(s.players[1].deck.length,draws);
});
test('Dawnspeakers runs at round end only after an allied death',()=>{
  const s=setup();put(s,0,'01DE031','board');const ally=put(s,0,'01DE039','board');nextRound(s);assert.equal(ally.attack,catalog[ally.code].attack);
  const victim=put(s,0,'01DE039','board');use(s,1,'01SI001',victim.id);nextRound(s);assert.equal(ally.attack,catalog[ally.code].attack+1);
});
test('new rules execute legal actions and survive JSON serialization',()=>{
  for(const code of Object.keys(next)){
    const s=setup();put(s,0,'01DE046','board');put(s,0,'01SI002','board');put(s,1,'01DE046','board');put(s,1,'01DE039','board');
    s.players[0].deathsThisRound=3;const c=put(s,0,code);c.cost=0;
    const choices=E.targets(s,0,c),target=c.targetCount>1?choices.slice(0,c.targetCount):choices[0];
    assert.doesNotThrow(()=>{E.play(s,0,c.id,target);if(s.phase==='response')E.pass(s,s.priority);},code);
    assert.doesNotThrow(()=>JSON.parse(JSON.stringify(s)),code);
    assert.ok(s.players.every(p=>p.board.length<=6&&p.hand.length<=10),code);
  }
});
