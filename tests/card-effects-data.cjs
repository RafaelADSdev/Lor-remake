const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'card-effects-data.js'),'utf8'),context);
const catalog=context.window.CARD_EFFECTS_DATA,ids=new Set(),clips=new Set(),particles=new Set(),textures=new Map();
let clipReferences=0,particleReferences=0;
assert.equal(catalog.groups.length,564);
assert.equal(catalog.importInProgress,undefined);
for(const group of catalog.groups){
 assert.ok(!ids.has(group.id));ids.add(group.id);
 assert.ok(group.name&&typeof group.name==='string');
 const text=fs.readFileSync(path.join(root,group.loader),'utf8');
 const data=JSON.parse(text.slice(text.indexOf(',')+1,text.lastIndexOf(');')));
 assert.equal(data.id,group.id);
 assert.equal(data.clips.length,group.stats.clips);
 assert.equal(data.particles.length,group.stats.particles);
 for(const clip of data.clips){
  assert.ok(clip.format==='muscle'||clip.format==='legacy',group.id+' has a supported native clip decoder');
  assert.equal(typeof clip.id,'string');clips.add(clip.id);clipReferences++;
  if(clip.format==='muscle'){
   const scalarCount=clip.stream.length+clip.dense.m_CurveCount+clip.constants.length;
   assert.equal(clip.bindings.reduce((sum,binding)=>sum+binding.size,0),scalarCount);
   assert.equal(clip.dense.m_SampleArray.length,clip.dense.m_FrameCount*clip.dense.m_CurveCount);
   for(const curve of clip.stream)for(let i=0;i<curve.length;i++){assert.ok(curve[i].every(Number.isFinite));assert.ok(!i||curve[i][0]>=curve[i-1][0]);}
  }
 }
 for(const particle of data.particles){particles.add(particle.id);particleReferences++;assert.ok(particle.transformChain?.length,group.id+' native emitter parent hierarchy is preserved');}
 for(const texture of data.textures){assert.equal(texture.src.split('/').at(-1),texture.sha256.slice(0,24)+'.png');textures.set(texture.src,texture.sha256);}
 const allSources=new Set(data.textures.map(texture=>texture.src));
 for(const material of data.materials)for(const texture of material.textures)assert.ok(allSources.has(texture.texture));
}
for(const [src,sha] of textures){const bytes=fs.readFileSync(path.join(root,src));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha);}
assert.equal(clips.size,catalog.summary.uniqueClips);assert.equal(particles.size,catalog.summary.uniqueParticleSystems);assert.equal(textures.size,catalog.summary.uniqueTextures);
assert.equal(clipReferences,catalog.summary.clips);assert.equal(particleReferences,catalog.summary.particles);
console.log(JSON.stringify({groups:ids.size,uniqueClips:clips.size,clipReferences,uniqueParticleSystems:particles.size,particleReferences,verifiedOriginalTextures:textures.size}));
