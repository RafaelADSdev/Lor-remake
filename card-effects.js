/* Original card assets projected into a bounded Canvas2D presentation.
 * Group ownership comes from serialized CardProfile PPtr links when available.
 * Native shader graphs/timeline conditions remain outside this browser port.
 * Script/image loaders deliberately support opening index.html with file://.
 */
(function (root) {
  'use strict';
  const catalog = root.CARD_EFFECTS_DATA || { groups: [] };
  const groups = catalog.groups;
  const byId = new Map(groups.map(group => [group.id, group]));
  const byCode = new Map();
  const payloads = new Map(), pending = new Map(), images = new Map();
  const active = new Set();
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const LIMIT = { groups: 8, images: 64, pixels: 24000000, systems: 30, particles: 260, effects: 5, textures: 12, seconds: 4.5 };
  let generation = 0, imagePixels = 0;
  for (const group of groups) {
    for (const code of group.codes || []) {
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(group);
    }
  }
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const lerp = (a, b, t) => a + (b - a) * t;
  const vec = (object, fallback = [0, 0, 0]) => object ? [finite(object.x, fallback[0]), finite(object.y, fallback[1]), finite(object.z, fallback[2])] : fallback.slice();
  const hash = text => { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
  function randomGenerator(seed) {
    return () => { seed += 0x6D2B79F5; let n = seed; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function curveValue(keys, time) {
    if (!keys?.length) return 0;
    if (time <= keys[0].time) return finite(keys[0].value);
    if (time >= keys.at(-1).time) return finite(keys.at(-1).value);
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (keys[mid].time <= time) lo = mid; else hi = mid; }
    const a = keys[lo], b = keys[hi], dt = b.time - a.time;
    if (!dt || a.outSlope === null || b.inSlope === null) return finite(a.value);
    const t = (time - a.time) / dt, t2 = t*t, t3 = t2*t;
    return finite((2*t3 - 3*t2 + 1)*a.value + (t3 - 2*t2 + t)*finite(a.outSlope)*dt + (-2*t3 + 3*t2)*b.value + (t3 - t2)*finite(b.inSlope)*dt, a.value);
  }
  function sampleCurve(curve, time = 0, random = .5, fallback = 0) {
    if (!curve) return fallback;
    const scalar = finite(curve.scalar, fallback), min = finite(curve.minScalar, scalar);
    switch (curve.minMaxState) {
      case 1: return scalar * curveValue(curve.maxCurve?.m_Curve, time);
      case 2: return lerp(min * curveValue(curve.minCurve?.m_Curve, time), scalar * curveValue(curve.maxCurve?.m_Curve, time), random);
      case 3: return lerp(min, scalar, random);
      default: return scalar;
    }
  }
  const colorVector = color => color ? [finite(color.r, 1), finite(color.g, 1), finite(color.b, 1), finite(color.a, 1)] : [1, 1, 1, 1];
  function gradientValue(gradient, time) {
    if (!gradient) return [1, 1, 1, 1];
    const interpolate = (prefix, count, alpha) => {
      const keys = Array.from({ length: count }, (_, i) => ({ time: finite(gradient[prefix + 'time' + i]) / 65535, color: colorVector(gradient['key' + i]) }));
      if (!keys.length) return alpha ? 1 : [1, 1, 1];
      let lo = keys[0], hi = keys.at(-1);
      for (let i = 1; i < keys.length; i++) if (keys[i].time >= time) { lo = keys[i-1]; hi = keys[i]; break; }
      const t = gradient.m_Mode === 1 ? 0 : clamp((time - lo.time) / (hi.time - lo.time || 1), 0, 1);
      return alpha ? lerp(lo.color[3], hi.color[3], t) : lo.color.slice(0, 3).map((v, i) => lerp(v, hi.color[i], t));
    };
    return [...interpolate('c', gradient.m_NumColorKeys || 0, false), interpolate('a', gradient.m_NumAlphaKeys || 0, true)];
  }
  function sampleColor(module, time, random) {
    if (!module) return [1, 1, 1, 1];
    const max = colorVector(module.maxColor), min = colorVector(module.minColor);
    if (module.minMaxState === 1) return gradientValue(module.maxGradient, time);
    if (module.minMaxState === 2) { const a = gradientValue(module.minGradient, time), b = gradientValue(module.maxGradient, time); return a.map((v, i) => lerp(v, b[i], random)); }
    if (module.minMaxState === 3) return min.map((v, i) => lerp(v, max[i], random));
    return max;
  }
  function clipValue(clip, index, time) {
    if (index < clip.stream.length) {
      const keys = clip.stream[index];
      if (!keys.length) return 0;
      let lo = 0, hi = keys.length;
      while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (keys[mid][0] <= time) lo = mid; else hi = mid; }
      const key = keys[lo], t = Math.max(0, time - key[0]);
      return finite(((key[1]*t + key[2])*t + key[3])*t + key[4]);
    }
    index -= clip.stream.length;
    const dense = clip.dense;
    if (index < dense.m_CurveCount) {
      const frame = clamp((time - dense.m_BeginTime)*dense.m_SampleRate, 0, dense.m_FrameCount - 1);
      const lo = Math.floor(frame), hi = Math.min(dense.m_FrameCount - 1, lo + 1);
      return finite(lerp(dense.m_SampleArray[lo*dense.m_CurveCount + index], dense.m_SampleArray[hi*dense.m_CurveCount + index], frame - lo));
    }
    return finite(clip.constants[index - dense.m_CurveCount]);
  }
  const quaternion = value => value ? [...vec(value),finite(value.w,1)] : [0,0,0,1];
  const multiplyQuaternion = (a,b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  function rotateVector(vector,q) {
    const p = multiplyQuaternion(multiplyQuaternion(q,[...vector,0]),[-q[0],-q[1],-q[2],q[3]]);
    return p.slice(0,3);
  }
  function compileTransforms(system,clips) {
    const base = system.transform || {};
    const chain = system.transformChain?.length ? system.transformChain : [{path:system.name,position:base.m_LocalPosition,scale:base.m_LocalScale,rotation:base.m_LocalRotation}];
    system.nativeNodes = chain.map(node=>({path:node.path,position:vec(node.position),scale:vec(node.scale,[1,1,1]),rotation:quaternion(node.rotation)}));
    system.nativeTracks = [];
    const nodeIndex = path => path === '' ? 0 : system.nativeNodes.findIndex(node=>node.path===path || node.path.endsWith('/'+path));
    for (const clip of clips) {
      if (clip.format === 'muscle') {
        for (const binding of clip.bindings) {
          if (binding.type !== 4 || binding.path === null || binding.path === undefined) continue;
          if (binding.path === '') {
            const nativeRoot=system.nativeNodes[0].path.split('/').at(-1).toLowerCase().replace(/[^a-z0-9]/g,'');
            const clipLabel=((clip.path||'')+'/'+(clip.name||'')).toLowerCase().replace(/[^a-z0-9]/g,'');
            // Empty bindings are relative to their own timeline/model root.
            // Applying every group's root curve to every emitter would mix
            // unrelated Cast, Missile and model idle tracks.
            if (!nativeRoot || !clipLabel.includes(nativeRoot)) continue;
          }
          const index = nodeIndex(binding.path);
          if (index >= 0) system.nativeTracks.push({clip,binding,node:index});
        }
      } else if (clip.format === 'legacy') {
        for (const curve of clip.curves || []) {
          const index = nodeIndex(curve.path);
          if (index >= 0 && curve.attribute !== 'scalar' && curve.keys.length) system.nativeTracks.push({clip,curve,node:index});
        }
      }
    }
  }
  function animatedTransform(system, clips, time, progress = null) {
    if (!system.nativeNodes) compileTransforms(system,clips);
    const nodes = system.nativeNodes.map(node=>({position:node.position.slice(),scale:node.scale.slice(),rotation:node.rotation.slice()}));
    for (const track of system.nativeTracks) {
      const {clip,binding,curve} = track, node = nodes[track.node], t=progress === null ? clamp(time,0,clip.duration) : clamp(progress,0,1)*clip.duration;
      let value,attribute;
      if (binding) {
        value=Array.from({length:binding.size},(_,i)=>clipValue(clip,binding.index+i,t+clip.start));
        attribute={1:'position',2:'rotation',3:'scale',4:'euler'}[binding.attribute];
      } else {
        attribute=curve.attribute;
        value=(attribute==='rotation'?['x','y','z','w']:['x','y','z']).map(component=>curveValue(curve.keys.map(key=>({...key,value:key.value?.[component]||0,inSlope:key.inSlope?.[component]||0,outSlope:key.outSlope?.[component]||0})),t));
      }
      if (attribute==='position') node.position=value;
      if (attribute==='scale') node.scale=value;
      if (attribute==='rotation') node.rotation=value;
      if (attribute==='euler') { const angle=value[2]*Math.PI/360;node.rotation=[0,0,Math.sin(angle),Math.cos(angle)]; }
    }
    let position=[0,0,0],scale=[1,1,1],rotation=[0,0,0,1];
    for (const node of nodes) {
      const translated=rotateVector(node.position.map((v,i)=>v*scale[i]),rotation);
      position=position.map((v,i)=>v+translated[i]);
      scale=scale.map((v,i)=>v*node.scale[i]);
      rotation=multiplyQuaternion(rotation,node.rotation);
    }
    return {position,scale,rotation:Math.atan2(2*(rotation[3]*rotation[2]+rotation[0]*rotation[1]),1-2*(rotation[1]**2+rotation[2]**2))};
  }
  function automaticAllowed() {
    const toggle = document.getElementById?.('motion-toggle');
    return !document.hidden && !reduced.matches && (!toggle || toggle.getAttribute('aria-pressed') !== 'false');
  }
  function candidates(code, phase) {
    const found = (byCode.get(code) || []).map(group => ({ group, links: (group.links || []).filter(link => link.code === code && link.phase === phase && link.enabled) })).filter(item => item.links.length && item.group.presentable && item.group.family !== 'MomentSkins' && item.group.classification !== 'skin');
    const exact = found.filter(item => item.links.some(link => link.exact));
    const specific = exact.filter(item => item.group.classification !== 'generic-or-shared');
    return (specific.length ? specific : exact.length ? exact : found).map(item => item.group);
  }
  function trimPayloads() {
    while (payloads.size > LIMIT.groups) {
      const removable = [...payloads.keys()].find(id => ![...active].some(effect => effect.id === id));
      if (!removable) break;
      payloads.delete(removable);
    }
  }
  function register(id, payload) {
    if (!byId.has(id) || payload?.id !== id) return;
    payloads.delete(id);
    payloads.set(id, payload);
    pending.get(id)?.receive(payload);
    trimPayloads();
  }
  function load(group) {
    if (payloads.has(group.id)) { const payload = payloads.get(group.id); payloads.delete(group.id); payloads.set(group.id, payload); return Promise.resolve(payload); }
    if (pending.has(group.id)) return pending.get(group.id).promise;
    let receive, finish;
    const promise = new Promise(resolve => { finish = resolve; });
    const script = document.createElement('script');
    let received = null;
    receive = value => { received = value; };
    const timer = setTimeout(() => done(null), 15000);
    const done = value => { clearTimeout(timer); script.remove(); pending.delete(group.id); finish(value); };
    pending.set(group.id, { promise, receive });
    script.onload = () => done(received);
    script.onerror = () => done(null);
    script.src = group.loader;
    script.async = true;
    document.head.append(script);
    return promise;
  }
  function trimImages() {
    for (const [src, entry] of images) {
      if (images.size <= LIMIT.images && imagePixels <= LIMIT.pixels) break;
      if (entry.pending || [...active].some(effect => effect.imageSources?.has(src))) continue;
      images.delete(src);
      imagePixels -= entry.pixels;
    }
  }
  function loadImage(src) {
    if (images.has(src)) { const entry = images.get(src); images.delete(src); images.set(src, entry); return entry.promise; }
    const image = new Image();
    const entry = { pending: true, pixels: 0, promise: null };
    entry.promise = new Promise(resolve => {
      const timer = setTimeout(() => done(null), 12000);
      const done = result => { if (!entry.pending) return; clearTimeout(timer); entry.pending = false; entry.pixels = result ? result.naturalWidth*result.naturalHeight : 0; imagePixels += entry.pixels; resolve(result); trimImages(); };
      image.onload = () => done(image);
      image.onerror = () => done(null);
      image.src = src;
    });
    images.set(src, entry);
    return entry.promise;
  }
  const textureSlots = ['_MainTex', '_BaseMap', '_BaseColorMap', '_ColorTex', '_AlphaTex', '_MaskTex', '_AlphaMaskTex'];
  function materialTexture(material, textures) {
    if (!material) return null;
    const slots = material.keywords?.includes('ALPHA_TEX') ? ['_AlphaTex', ...textureSlots.filter(slot=>slot !== '_AlphaTex')] : textureSlots;
    for (const slot of slots) {
      const env = material.textures.find(texture => texture.slot === slot && textures.has(texture.texture));
      if (env) return env;
    }
    return material.textures.find(texture => textures.has(texture.texture)) || null;
  }
  function materialColor(material) {
    const colors = material?.colors || {};
    return colorVector(colors._TintColor || colors._Color || colors._BaseColor || colors._Slope || {r:1,g:1,b:1,a:1});
  }
  function tintedSprite(image, color) {
    if (!image || color.slice(0,3).every(value=>value >= .99 && value <= 1.01)) return image;
    const surface = document.createElement('canvas');
    const scale = Math.min(1, 768/Math.max(image.naturalWidth,image.naturalHeight));
    surface.width = Math.max(1,Math.round(image.naturalWidth*scale));
    surface.height = Math.max(1,Math.round(image.naturalHeight*scale));
    const paint = surface.getContext('2d');
    if (!paint) return image;
    paint.drawImage(image,0,0,surface.width,surface.height);
    // Multiply is a drawing operation, so this works with local file images
    // without reading tainted pixels. Screen blending removes black VFX masks.
    const exposure = Math.max(1,...color.slice(0,3));
    const rgb = color.slice(0,3).map(value=>Math.round(clamp(value/exposure,0,1)*255));
    paint.globalCompositeOperation = 'multiply';
    paint.fillStyle = `rgb(${rgb.join(',')})`;
    paint.fillRect(0,0,surface.width,surface.height);
    paint.globalCompositeOperation = 'destination-in';
    paint.drawImage(image,0,0,surface.width,surface.height);
    return surface;
  }
  function phaseMatches(item, phase) { return !item.phases?.length || item.phases.includes(phase); }
  function makeSystems(payload, phase, preview) {
    let systems = payload.particles.filter(system => system.enabled && phaseMatches(system, phase));
    if (!systems.length && preview) systems = payload.particles.filter(system => system.enabled);
    // Spread samples across the actual hierarchy so large effects retain their
    // central, outer and late systems instead of keeping the first N nodes.
    if (systems.length > LIMIT.systems) systems = Array.from({length:LIMIT.systems}, (_, i) => systems[Math.floor(i*systems.length/LIMIT.systems)]);
    const materials = new Map(payload.materials.map(material => [material.id, material]));
    const textures = new Set(payload.textures.map(texture => texture.src));
    return systems.map(system => {
      const material = (system.materials || []).map(id => materials.get(id)).find(item => item && materialTexture(item, textures));
      return { ...system, material, texture: materialTexture(material, textures), color: materialColor(material), particles: [] };
    });
  }
  function spawnParticles(systems, duration, seed) {
    const random = randomGenerator(seed);
    const maxPerSystem = Math.max(3, Math.floor(LIMIT.particles / Math.max(1, systems.length)));
    for (const system of systems) {
      const modules = system.modules, initial = modules.InitialModule || {}, emission = modules.EmissionModule || {}, shape = modules.ShapeModule || {};
      const delay = Math.max(0, sampleCurve(system.delay, 0, random()));
      const bursts = emission.m_Bursts || [];
      const burstCount = bursts.reduce((sum, burst) => sum + sampleCurve(burst.countCurve || {scalar:burst.maxCount || burst.minCount || 1}, 0, random(), 1), 0);
      const rate = emission.enabled ? Math.max(0, sampleCurve(emission.rateOverTime, 0, random(), 5)) : 0;
      // Timeline-driven Emit bursts are not serialized as EmissionModule rates.
      // For this port a disabled emission module displays one representative
      // burst, explicitly as an adapted presentation rather than Unity replay.
      const count = Math.min(maxPerSystem, Math.max(1, Math.round(burstCount || rate*Math.min(duration, finite(system.duration, 1)) || 3)));
      for (let i = 0; i < count; i++) {
        const randoms = Array.from({length:10}, random);
        const life = clamp(Math.abs(sampleCurve(initial.startLifetime, 0, randoms[0], 1)), .08, LIMIT.seconds);
        const nativeBurst = bursts.length ? bursts[i % bursts.length] : null;
        const birth = delay + (nativeBurst ? finite(nativeBurst.time) : rate > 0 ? i / Math.max(1, count)*Math.min(duration*.55, finite(system.duration, duration)) : 0);
        const angle = randoms[1]*Math.PI*2, radius = shape.enabled ? sampleCurve({scalar:shape.radius?.value || 1}, 0)*Math.sqrt(randoms[2]) : 0;
        const scale = vec(shape.m_Scale, [1,1,1]);
        const shapePos = vec(shape.m_Position);
        let origin = [Math.cos(angle)*radius*scale[0], Math.sin(angle)*radius*scale[1], 0];
        if (shape.type === 5 || shape.type === 8) origin = [(randoms[1]-.5)*scale[0], (randoms[2]-.5)*scale[1], (randoms[3]-.5)*scale[2]];
        const speed = sampleCurve(initial.startSpeed, 0, randoms[4]);
        const cone = finite(shape.angle, 25)*Math.PI/180;
        const direction = shape.enabled ? [Math.cos(angle)*Math.sin(cone), Math.cos(cone), Math.sin(angle)*Math.sin(cone)] : [0,1,0];
        const sizeX = Math.abs(sampleCurve(initial.startSize, 0, randoms[5], 1));
        const sizeY = initial.size3D ? Math.abs(sampleCurve(initial.startSizeY, 0, randoms[5], sizeX)) : sizeX;
        system.particles.push({ birth, life, random: randoms[6], origin: origin.map((v,j)=>v + shapePos[j]),
          velocity: direction.map(v=>v*speed), size: [sizeX,sizeY], rotation: sampleCurve(initial.startRotation, 0, randoms[7]),
          color: sampleColor(initial.startColor, 0, randoms[8]), gravity: sampleCurve(initial.gravityModifier, 0, randoms[9]) });
      }
    }
  }
  function point(rect, fallback) {
    return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) ? {x:rect.left + finite(rect.width)/2,y:rect.top + finite(rect.height)/2} : fallback;
  }
  function drawParticle(ctx, system, particle, image, age, transform, projection, center, fade) {
    const modules = system.modules, t = clamp(age / particle.life, 0, 1);
    const velocity = modules.VelocityModule || {}, sizeModule = modules.SizeModule || {}, colorModule = modules.ColorModule || {}, rotationModule = modules.RotationModule || {};
    const position = particle.origin.map((v, i) => (v + particle.velocity[i]*age + (velocity.enabled ? sampleCurve(velocity[['x','y','z'][i]], t, particle.random)*age : 0))*finite(transform.scale[i],1) + finite(transform.position[i]));
    position[1] -= .5*9.81*particle.gravity*age*age;
    const x = center.x + (position[0] - projection.center[0])*projection.scale;
    const y = center.y - (position[1] - projection.center[1] + (position[2] - projection.center[2])*.32)*projection.scale;
    const sx = sizeModule.enabled ? sampleCurve(sizeModule.curve, t, particle.random, 1) : 1;
    const sy = sizeModule.enabled && sizeModule.separateAxes ? sampleCurve(sizeModule.y, t, particle.random, sx) : sx;
    const width = clamp(Math.abs(particle.size[0]*sx*transform.scale[0]*projection.scale), 1, projection.maxSize);
    const height = clamp(Math.abs(particle.size[1]*sy*transform.scale[1]*projection.scale), 1, projection.maxSize);
    const color = colorModule.enabled ? sampleColor(colorModule.gradient, t, particle.random) : [1,1,1,1];
    const alpha = clamp(particle.color[3]*color[3]*system.color[3]*fade, 0, .9);
    if (alpha < .005 || width < 1 || height < 1) return false;
    const rotation = particle.rotation + transform.rotation + (rotationModule.enabled ? sampleCurve(rotationModule.curve || rotationModule.z, t, particle.random)*age : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    if (image) {
      const uv = modules.UVModule || {}, cols = uv.enabled ? Math.max(1, uv.tilesX || 1) : 1, rows = uv.enabled ? Math.max(1, uv.tilesY || 1) : 1;
      let frame = uv.enabled ? Math.floor(sampleCurve(uv.frameOverTime, t, particle.random, t)*cols*rows*finite(uv.cycles,1)) : 0;
      frame = ((frame % (cols*rows)) + cols*rows) % (cols*rows);
      const sw = (image.naturalWidth || image.width)/cols, sh = (image.naturalHeight || image.height)/rows;
      ctx.drawImage(image, (frame % cols)*sw, Math.floor(frame/cols)*sh, sw, sh, -width/2, -height/2, width, height);
    } else {
      const rgb = system.color.slice(0,3).map((c,i)=>Math.round(clamp(c*particle.color[i]*color[i],0,1)*255));
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.beginPath(); ctx.ellipse(0, 0, width/2, height/2, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    return true;
  }
  function projectionFor(systems, width, height) {
    const positions = systems.map(system => animatedTransform(system,[],0).position);
    const center = [0,1,2].map(axis => {
      const values = positions.map(p=>p[axis]).sort((a,b)=>a-b);
      return values.length ? values[Math.floor(values.length/2)] : 0;
    });
    const extents = systems.flatMap(system => {
      const initial = system.modules.InitialModule || {}, transform=animatedTransform(system,[],0),position=transform.position,scale=transform.scale;
      const size = Math.abs(sampleCurve(initial.startSize, 0, .5, 1)*scale[0]);
      return [Math.abs(position[0]-center[0])+size, Math.abs(position[1]-center[1])+size, Math.abs(sampleCurve(initial.startSpeed,0,.5))*.7];
    }).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
    const extent = extents.length ? extents[Math.floor(extents.length*.8)] : 2;
    return { center, scale: clamp(Math.min(width,height)*.23/Math.max(.25,extent), .04, 65), maxSize: Math.min(width,height)*.65 };
  }
  async function play(options = {}) {
    const {code, phase = 'cast', groupId, preview = false, host} = options;
    if (document.hidden || (!preview && !automaticAllowed())) return false;
    const group = groupId ? byId.get(groupId) : candidates(code, phase)[0];
    if (!group || !group.presentable || (!preview && groupId && !candidates(code,phase).includes(group))) return false;
    const ticket = generation;
    const payload = await load(group);
    if (!payload || ticket !== generation || document.hidden || (!preview && !automaticAllowed())) return false;
    const alias = (group.links || []).find(link=>link.code===code && link.phase===phase && link.sourcePhase && (preview || link.enabled));
    const requestedPhase = alias?.sourcePhase || group.phaseAliases?.[phase] || phase;
    const selectedPhase = payload.phases.includes(requestedPhase) ? requestedPhase : preview ? payload.phases[0] : requestedPhase;
    const systems = makeSystems(payload, selectedPhase, preview);
    const textures = payload.textures;
    const imageSources = new Set(systems.map(system=>system.texture?.texture).filter(Boolean));
    if (!imageSources.size && preview) textures.slice(0,5).forEach(texture=>imageSources.add(texture.src));
    const selectedSources = [...imageSources].slice(0,LIMIT.textures);
    const loaded = await Promise.all(selectedSources.map(async src=>[src,await loadImage(src)]));
    if (ticket !== generation || document.hidden || (!preview && !automaticAllowed()) || (host && !host.isConnected)) return false;
    const imageMap = new Map(loaded.filter(([,image])=>image));
    if (!systems.length && !imageMap.size) return false;
    while (active.size >= LIMIT.effects) [...active][0].stop();
    const canvas = document.createElement('canvas');
    canvas.className = 'card-native-effects' + (host ? ' card-native-effects--host' : '');
    canvas.setAttribute('aria-hidden','true');
    canvas.dataset.effectGroup = group.id;
    canvas.dataset.effectPhase = selectedPhase;
    canvas.dataset.requestedPhase = phase;
    const parent = host || document.body;
    const box = host?.getBoundingClientRect();
    const width = Math.max(1, box?.width || root.innerWidth || 1280), height = Math.max(1, box?.height || root.innerHeight || 720);
    const dpr = Math.min(1.5, root.devicePixelRatio || 1);
    canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
    canvas.style.width = width+'px'; canvas.style.height = height+'px';
    parent.append(canvas);
    const ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) { canvas.remove(); return false; }
    ctx.scale(dpr,dpr);
    const origin = {x:box?.left || 0,y:box?.top || 0};
    const center = {x:width/2,y:height/2};
    const fromPoint = point(options.sourceRect, {x:center.x + origin.x,y:center.y + origin.y});
    const toPoint = point(options.targetRect, {x:center.x + origin.x,y:center.y + origin.y});
    const source = {x:fromPoint.x-origin.x,y:fromPoint.y-origin.y}, target = {x:toPoint.x-origin.x,y:toPoint.y-origin.y};
    const clips = payload.clips.filter(clip=>clip.format !== 'unsupported' && phaseMatches(clip,selectedPhase));
    for (const system of systems) compileTransforms(system,clips);
    const nativeDuration = Math.max(.5,...clips.map(clip=>clip.duration),...systems.map(system=>Math.max(Math.min(4,finite(system.duration,1)), sampleCurve(system.delay,0,.5)+Math.min(2,sampleCurve(system.modules.InitialModule?.startLifetime,0,.5,1)))));
    const phaseLimit = preview || selectedPhase === 'levelup' ? LIMIT.seconds : selectedPhase === 'missile' ? .85 : selectedPhase === 'impact' || selectedPhase === 'attack' ? 1.15 : 1.8;
    const duration = clamp(nativeDuration,.6,phaseLimit);
    spawnParticles(systems,duration,hash(group.id + selectedPhase));
    for (const system of systems) system.sprite = tintedSprite(imageMap.get(system.texture?.texture),system.color);
    const projection = projectionFor(systems,host ? width*.9 : Math.min(width,600),host ? height*.9 : Math.min(height,520));
    let complete;
    const finished = new Promise(resolve=>{complete=resolve;});
    const effect = {id:group.id, canvas, imageSources:new Set(selectedSources), frame:0, stop:null};
    effect.stop = (natural = false) => { if (!active.has(effect)) return; cancelAnimationFrame(effect.frame); active.delete(effect); canvas.remove(); trimPayloads(); trimImages(); complete(natural); };
    active.add(effect);
    const start = performance.now(), staticPreview = preview && reduced.matches;
    function draw(now) {
      if (!canvas.isConnected || document.hidden || (!preview && !automaticAllowed())) { effect.stop(); return; }
      const elapsed = staticPreview ? Math.min(.35,duration*.4) : (now-start)/1000;
      if (!staticPreview && elapsed > duration + .15) { effect.stop(true); return; }
      ctx.clearRect(0,0,width,height);
      const progress = clamp(elapsed / duration,0,1);
      const anchor = selectedPhase === 'missile' ? {x:lerp(source.x,target.x,progress),y:lerp(source.y,target.y,progress)} : selectedPhase === 'cast' || selectedPhase === 'attack' ? source : target;
      const fade = staticPreview ? 1 : clamp(elapsed/.1,0,1)*clamp((duration-elapsed)/.25,0,1);
      let drawn = 0;
      for (const system of systems) {
        const transform = animatedTransform(system,clips,elapsed,staticPreview ? .4 : progress);
        const image = system.sprite;
        for (const particle of system.particles) {
          const age = staticPreview ? particle.life*.35 : elapsed-particle.birth;
          if (age < 0 || age > particle.life) continue;
          if (drawParticle(ctx,system,particle,image,age,transform,projection,anchor,fade)) drawn++;
        }
      }
      // Some groups contain mesh/shader effects without a particle emitter.
      // Their original textures are shown as an animated asset plate in preview;
      // it is intentionally not substituted as a generic in-match spell effect.
      if ((!systems.length || (staticPreview && !drawn)) && preview) {
        const sprites = [...imageMap.values()].slice(0,5), size = Math.min(width,height)*.52;
        sprites.forEach((image,i)=>{
          ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=fade/Math.sqrt(sprites.length);
          ctx.translate(center.x,center.y); ctx.rotate((i%2 ? -1 : 1)*elapsed*.1);
          ctx.drawImage(image,-size/2,-size/2,size,size); ctx.restore();
        });
      }
      if (!staticPreview) effect.frame = requestAnimationFrame(draw);
      else { effect.frame = 0; complete(true); }
    }
    effect.frame = requestAnimationFrame(draw);
    return finished;
  }
  function cancel() { generation++; for (const effect of [...active]) effect.stop(); }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  reduced.addEventListener?.('change',()=>{if(reduced.matches)cancel();});
  root.addEventListener?.('pagehide',cancel);
  if (typeof MutationObserver === 'function') {
    const toggle = document.getElementById('motion-toggle');
    if (toggle) new MutationObserver(()=>{if(!automaticAllowed())cancel();}).observe(toggle,{attributes:true,attributeFilter:['aria-pressed']});
    const welcome = document.getElementById('welcome');
    if (welcome) new MutationObserver(()=>{
      if (!welcome.hidden) { generation++; for (const effect of [...active]) if (!effect.canvas.classList.contains('card-native-effects--host')) effect.stop(); }
    }).observe(welcome,{attributes:true,attributeFilter:['hidden']});
  }
  root.CardEffects = Object.freeze({
    list:()=>groups.slice(),
    describe:code=>(byCode.get(code)||[]).slice(),
    has:(code,phase)=>candidates(code,phase).length>0,
    play,cancel,register,
    status:()=>({active:active.size,loadedGroups:payloads.size,pendingGroups:pending.size,cachedImages:images.size,imagePixels,limits:{...LIMIT}}),
    sampleCurve,
  });
})(window);
