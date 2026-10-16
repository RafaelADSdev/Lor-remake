const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({offline:true,reducedMotion:'reduce',viewport:{width:1280,height:900}});
  const page=await context.newPage(),errors=[],failed=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>{if(request.url().includes('/card-effects/'))failed.push({url:request.url(),error:request.failure()?.errorText})});
  page.on('request',request=>{if(/^https?:/.test(request.url()))remote.push(request.url())});
  await page.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/'));
  const groups=await page.evaluate(()=>CardEffects.list().map(group=>({id:group.id,phases:group.phases,presentable:group.presentable,presentation:group.presentation,stats:group.stats})));
  assert.equal(groups.length,564);
  await page.evaluate(()=>{
   const host=document.createElement('div');host.id='all-native-effects-test';host.style.cssText='position:fixed;inset:100px 200px;width:720px;height:480px;background:#111a25;z-index:9999;isolation:isolate';document.body.append(host);
  });
  const results=[];
  for(const [index,group] of groups.entries()) {
   const result=await page.evaluate(async group=>{
    if(!group.presentable)return {id:group.id,metadataOnly:true};
    const host=document.getElementById('all-native-effects-test');
    const start=performance.now();
    const ok=await CardEffects.play({groupId:group.id,phase:group.phases[0],preview:true,host});
    const canvases=host.querySelectorAll('canvas').length;
    CardEffects.cancel();
    return {id:group.id,ok,canvases,ms:Math.round(performance.now()-start),status:CardEffects.status()};
   },group);
   results.push(result);
   if(!result.metadataOnly) {
    assert.equal(result.ok,true,group.id+' preview renders its available native assets');
    assert.equal(result.canvases,1,group.id+' keeps one preview canvas');
    assert.equal(result.status.active,0);
    assert.ok(result.status.loadedGroups<=result.status.limits.groups,group.id+' group cache is bounded');
    assert.ok(result.status.cachedImages<=result.status.limits.images,group.id+' image cache is bounded');
   }
   if((index+1)%50===0)console.log('Previewed '+(index+1)+'/'+groups.length+' groups');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(remote,[]);
  const report={listed:groups.length,rendered:results.filter(result=>result.ok).length,metadataOnly:results.filter(result=>result.metadataOnly).map(result=>result.id),errors,failed,remote,results};
  fs.writeFileSync(path.resolve(__dirname,'../test-results/card-effects-all-groups.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({listed:report.listed,rendered:report.rendered,metadataOnly:report.metadataOnly.length,errors:0,failedRequests:0,remoteRequests:0}));
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
