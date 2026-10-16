const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const groups = [
  { id: 'Spells/S001/Exact', family: 'Spells', codes: ['X'], phases: ['cast'], presentable: true, links: [{ code: 'X', phase: 'cast', exact: true, enabled: true }] },
  { id: 'Spells/S001/Fallback', family: 'Spells', codes: ['X', 'Y'], phases: ['cast'], presentable: true, links: [{ code: 'X', phase: 'cast', exact: false, enabled: true }, { code: 'Y', phase: 'cast', exact: false, enabled: true }] },
  { id: 'MomentSkins/S001/Skin', family: 'MomentSkins', codes: ['X'], phases: ['summon'], presentable: true, links: [{ code: 'X', phase: 'summon', exact: true, enabled: false }] },
];
const media = { matches: true, addEventListener() {} };
const context = vm.createContext({window:{CARD_EFFECTS_DATA:{groups}}, document:{hidden:false, addEventListener(){}, querySelector(){return null}, getElementById(){return null}}, matchMedia:()=>media, setTimeout, clearTimeout, performance:{now:()=>0}, console});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../card-effects.js'), 'utf8'), context);
const api = context.window.CardEffects;
assert.equal(api.list().length, 3);
assert.equal(api.describe('X').length, 3);
assert.equal(api.has('X', 'cast'), true);
assert.equal(api.has('Y', 'cast'), true);
assert.equal(api.has('X', 'summon'), false, 'Disabled PPtr links do not trigger in matches');
assert.equal(api.has('missing', 'cast'), false);
assert.equal(api.list()[0].id, groups[0].id);
(async()=>{
  assert.equal(await api.play({code:'X',phase:'cast'}), false, 'Reduced motion blocks automatic effects before any loader runs');
  api.cancel();
  assert.equal(api.status().active, 0);
  assert.equal(api.sampleCurve({minMaxState:1,scalar:2,maxCurve:{m_Curve:[{time:0,value:0,outSlope:2},{time:1,value:1,inSlope:0}]}}, .5, .5), 1.5);
  console.log('CardEffects API: metadata, disabled links, reduced motion and native Hermite curves verified');
})().catch(error=>{console.error(error);process.exitCode=1});
const nativeContext=vm.createContext({window:{},document:{hidden:false,addEventListener(){},getElementById(){return null}},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout,clearTimeout,console});
for(const name of ['card-effects-data.js','card-effects.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),nativeContext);
const nativeApi=nativeContext.window.CardEffects;
for(const code of ['01SI015','01DE007','01SI007'])assert.equal(nativeApi.has(code,'cast'),true,code+' exact resource ownership enables the adapted local cast');
assert.equal(nativeApi.has('01SI015','impact'),true,'Ruination native impact phase is available through the owned group');
assert.equal(nativeApi.has('06NX012T1','summon'),true,'Tibbers cast assets adapt to a local unit summon explicitly');
assert.ok(nativeApi.list().every(group=>typeof group.name==='string'&&group.name.trim().length));
assert.ok(nativeApi.list().filter(group=>group.classification==='skin'||group.family==='MomentSkins').every(group=>group.links.every(link=>!link.enabled)),'Skins remain manual regardless of their source folder family');
assert.equal(nativeContext.window.CARD_EFFECTS_DATA.summary.unsupportedClips.length,0);
console.log('CardEffects real catalog: Ruination, Judgment, Haunted Relic, Tibbers and skin eligibility verified');
