/* Original LoR skinned banner, sampled from its Unity clip at native timing. */
(function (root) {
  const content = root.NATIVE_OUTCOME_DATA;
  const active = new Map();
  function stop() {
    for (const state of active.values()) state.dispose();
    active.clear();
  }
  function unpack(value) {
    const raw=atob(value), bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }
  function show(host, outcome, motion, override = null) {
    active.get(host)?.dispose();
    const model = override || content.models[outcome];
    if(model.verticesPacked && !model.vertices) model.vertices=unpack(model.verticesPacked);
    if(model.framesPacked && !model.frames) {
      const samples=unpack(model.framesPacked);
      model.frames=model.offsets.map((_,i)=>samples.subarray(i*model.frameSize,(i+1)*model.frameSize));
    }
    host.replaceChildren();
    const fallback = document.createElement('img');
    if(!model.orthographic) fallback.src = `assets/outcome/${outcome}.png`;
    else fallback.hidden = true;
    fallback.alt = ''; fallback.className = 'result-native-fallback';
    host.append(fallback);
    const canvas = document.createElement('canvas');
    canvas.width = model.orthographic ? 600 : 1200; canvas.height = 600;
    canvas.className = 'result-native-canvas';
    canvas.dataset.clip = model.clipPathId;
    canvas.dataset.mesh = model.meshPathId;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) { host.dataset.renderer = 'fallback'; return; }
    const shaders = [], buffers = [];
    let program, texture, vertexBuffer;
    const cpu = model.boneCount > 8;
    const state = { alive: true, frame: 0, dispose, finished: null, resolve: null };
    state.finished = new Promise(resolve=>{state.resolve=resolve;});
    function dispose() {
      if(!state.alive) return;
      state.alive=false;
      if(active.get(host)===state) active.delete(host);
      cancelAnimationFrame(state.frame);
      state.resolve?.();
      for (const b of buffers) gl.deleteBuffer(b);
      for (const s of shaders) gl.deleteShader(s);
      if (texture) gl.deleteTexture(texture);
      if (program) gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
      fallback.hidden=!!model.orthographic;
    }
    active.set(host,state);
    try {
      function shader(type, source) {
        const s = gl.createShader(type); shaders.push(s);
        gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Native banner shader unavailable');
        return s;
      }
      const vs = shader(gl.VERTEX_SHADER, `
        attribute vec3 position; attribute vec2 uv; attribute float bone;
        uniform mat4 bones[${cpu ? 1 : model.boneCount}]; uniform vec2 center; uniform float zoom;
        varying vec2 texcoord;
        void main() {
          vec3 p = (bones[int(bone)] * vec4(position,1.)).xyz;
          vec2 projected = (${model.orthographic ? 'p.xy' : 'p.xy / max(p.z,1.)'} - center) * zoom;
          gl_Position = vec4(projected.x, projected.y * ${model.aspect || 2}., clamp(p.z / 500., -.99, .99), 1.);
          texcoord = uv;
        }`);
      const fs = shader(gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 texcoord; uniform sampler2D art;
        void main(){ vec4 c=texture2D(art,texcoord); if(c.a<.01) discard; gl_FragColor=c; }`);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Native banner program unavailable');
      gl.useProgram(program);
      function buffer(target, values) {
        const b = gl.createBuffer(); buffers.push(b); gl.bindBuffer(target, b); gl.bufferData(target, values, gl.STATIC_DRAW);
      }
      buffer(gl.ARRAY_BUFFER, new Float32Array(model.vertices));
      vertexBuffer = buffers.at(-1);
      for (const [name, size, offset] of [['position',3,0],['uv',2,12],['bone',1,20]]) {
        const loc = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 24, offset);
      }
      buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.indices));
      gl.uniform2fv(gl.getUniformLocation(program,'center'), model.center);
      gl.uniform1f(gl.getUniformLocation(program,'zoom'), model.zoom);
      const boneUniform = gl.getUniformLocation(program,'bones[0]');
      texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      const image = new Image();
      image.onload = () => {
        if (!state.alive) return;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        host.append(canvas); host.dataset.renderer = 'native-webgl';
        fallback.hidden = true;
        const start = performance.now(), values = new Float32Array(model.frames[0].length);
        const deformed = cpu ? new Float32Array(model.vertices) : null;
        function draw(now) {
          if (!state.alive) return;
          const t = motion ? Math.min(1,(now-start)/(model.duration*1000)) : 1;
          let hi = model.offsets.findIndex(offset => offset >= t);
          if (hi < 0) hi = model.offsets.length-1;
          const lo = Math.max(0,hi-1), span = model.offsets[hi]-model.offsets[lo];
          const blend = span ? (t-model.offsets[lo])/span : 1;
          for (let i=0;i<values.length;i++) values[i]=model.frames[lo][i]+(model.frames[hi][i]-model.frames[lo][i])*blend;
          if(cpu) {
            const source=model.vertices;
            for(let i=0;i<source.length;i+=6) {
              const b=source[i+5]*16,x=source[i],y=source[i+1],z=source[i+2];
              deformed[i]=values[b]*x+values[b+4]*y+values[b+8]*z+values[b+12];
              deformed[i+1]=values[b+1]*x+values[b+5]*y+values[b+9]*z+values[b+13];
              deformed[i+2]=values[b+2]*x+values[b+6]*y+values[b+10]*z+values[b+14];
              deformed[i+5]=0;
            }
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,deformed);
            gl.uniformMatrix4fv(boneUniform,false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
          } else gl.uniformMatrix4fv(boneUniform,false,values);
          gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          gl.drawElements(gl.TRIANGLES,model.indices.length,gl.UNSIGNED_SHORT,0);
          canvas.dataset.progress = String(t);
          if (t<1) state.frame=requestAnimationFrame(draw);
          else state.resolve();
        }
        draw(start);
      };
      image.src=model.texture;
    } catch {
      dispose(); active.delete(host); host.dataset.renderer='fallback';
    }
    return state;
  }
  root.NativeOutcome = { show, stop };
})(window);
