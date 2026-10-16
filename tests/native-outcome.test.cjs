const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const context = { window: {} };
for (const name of ['native-outcome-data.js','native-nexus-end-data.js']) vm.runInNewContext(fs.readFileSync(require.resolve('../'+name),'utf8'),context);
const banners=context.window.NATIVE_OUTCOME_DATA.models, nexus=context.window.NATIVE_NEXUS_END_DATA;
function floats(base64) {
  const b=Buffer.from(base64,'base64'),values=[];
  for(let i=0;i<b.length;i+=4) values.push(b.readFloatLE(i));
  return values;
}
test('all three banners use original rig IDs, native 0.6-second clip and verified textures',()=>{
  const sources=require('../research/native-outcome-sources.json');
  for(const [name,m] of Object.entries(banners)) {
    assert.equal(m.clipPathId,'-2335169206498055647');
    assert.ok(Math.abs(m.duration-.6)<.000001);
    assert.equal(m.meshPathId,sources.models[name].mesh.pathId);
    assert.equal(m.bannerStart,name==='defeat'?1.85:2.35);
    const vertices=floats(m.verticesPacked),frames=floats(m.framesPacked);
    assert.equal(vertices.length%6,0);
    assert.equal(frames.length,m.offsets.length*m.frameSize);
    assert.equal(m.frameSize,m.boneCount*16);
    assert.ok(vertices.every(Number.isFinite)&&frames.every(Number.isFinite));
    assert.ok(m.indices.every(i=>i>=0&&i<vertices.length/6&&i<65536));
    const texture=Buffer.from(m.texture.split(',')[1],'base64');
    assert.equal(crypto.createHash('sha256').update(texture).digest('hex'),sources.models[name].textureSha256);
    assert.equal(m.offsets[0],0);assert.equal(m.offsets.at(-1),1);
    assert.notDeepEqual(frames.slice(0,m.frameSize),frames.slice(-m.frameSize));
  }
});
test('Nexus fracture uses all original rigid fragments and native clip duration',()=>{
  const sources=require('../research/native-nexus-end-sources.json');
  for(const [name,count] of [['red',54],['blue',65]]) {
    const m=nexus[name],vertices=floats(m.verticesPacked),frames=floats(m.framesPacked);
    assert.equal(m.boneCount,count);
    assert.equal(m.clipPathId,sources[name].clip);
    assert.ok(Math.abs(m.duration-2.3666668)<.000001);
    assert.equal(frames.length,m.offsets.length*count*16);
    assert.ok(frames.every(Number.isFinite));
    assert.equal(new Set(vertices.filter((_,i)=>i%6===5)).size,count);
    assert.ok(m.indices.every(i=>i>=0&&i<vertices.length/6&&i<65536));
    assert.equal(crypto.createHash('sha256').update(Buffer.from(m.texture.split(',')[1],'base64')).digest('hex'),sources[name].textureSha256);
  }
});
