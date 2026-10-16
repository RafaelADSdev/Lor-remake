const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
  await page.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/'));
  assert.equal(await page.evaluate(()=>CardEffects.list().length),564);
  const group=await page.evaluate(()=>CardEffects.list().find(g=>g.id==='ChampMoments/S001/Anivia'&&g.presentable)||CardEffects.list().find(g=>g.presentable&&g.stats.particles>10));
  assert.ok(group,'A native particle group is available');
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='native-effect-test-host';host.style.cssText='position:fixed;left:300px;top:150px;width:720px;height:500px;background:#101722;z-index:9999;isolation:isolate';document.body.append(host);
  });
  await page.evaluate(group=>{window.effectResult=null;window.effectStart=performance.now();CardEffects.play({groupId:group.id,phase:group.phases[0],preview:true,host:document.getElementById('native-effect-test-host')}).then(value=>{window.effectResult=value;window.effectElapsed=performance.now()-window.effectStart;});},group);
  await page.locator('#native-effect-test-host canvas').waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({path:path.resolve(__dirname,'../test-results/card-effects-native.png')});
  assert.equal(await page.locator('#native-effect-test-host canvas').count(),1);
  await page.waitForFunction(()=>window.effectResult!==null,{timeout:12000});
  assert.equal(await page.evaluate(()=>window.effectResult),true);
  assert.ok(await page.evaluate(()=>window.effectElapsed>=500),'play resolves at natural completion');
  assert.equal(await page.locator('#native-effect-test-host canvas').count(),0);
  await page.evaluate(group=>{window.effectResult=null;CardEffects.play({groupId:group.id,phase:group.phases[0],preview:true,host:document.getElementById('native-effect-test-host')}).then(value=>{window.effectResult=value;});},group);
  await page.locator('#native-effect-test-host canvas').waitFor();
  await page.evaluate(()=>CardEffects.cancel());
  await page.waitForFunction(()=>window.effectResult!==null);
  assert.equal(await page.evaluate(()=>window.effectResult),false);
  assert.equal(await page.locator('#native-effect-test-host canvas').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>CardEffects.play({code:'01DE012',phase:'summon'})),false);
  const staticResult=await page.evaluate(group=>CardEffects.play({groupId:group.id,phase:group.phases[0],preview:true,host:document.getElementById('native-effect-test-host')}),group);
  assert.equal(staticResult,true);
  assert.equal(await page.locator('#native-effect-test-host canvas').count(),1);
  await page.evaluate(()=>CardEffects.cancel());
  const stats=await page.evaluate(()=>CardEffects.status());
  assert.equal(stats.active,0);assert.ok(stats.loadedGroups<=stats.limits.groups);assert.ok(stats.cachedImages<=stats.limits.images);
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  console.log(JSON.stringify({group:group.id,offline:true,naturalCompletion:true,cancel:true,reducedMotion:true,stats}));
  await context.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
