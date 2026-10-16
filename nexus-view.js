/* Two persistent WebGL canvases render the original current-client Nexus meshes. */
(function (root) {
  const renderers = [], fallbacks = [],
    reduced = () => !root.ArenaMotion.enabled || root.ArenaMotion.reduced;
  // Recording at 30s: the point faces left; the shaft is concealed by the HUD.
  const cameraYaw = -0.56;
  let frame = 0,
    last = 0;
  function shader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error("Nexus shader");
    return s;
  }
  function create(model, side) {
    const canvas = document.createElement("canvas");
    canvas.className = "nexus-crystal";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = canvas.height = 256;
    canvas.dataset.view = "three-quarter";
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return null;
    const vs = shader(
      gl,
      gl.VERTEX_SHADER,
      "attribute vec3 position;attribute vec2 uv;attribute vec3 normal;uniform float angle;varying vec2 vUv;varying vec3 vNormal;varying float vDepth;void main(){float c=cos(angle),s=sin(angle);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*position;vNormal=r*normal;vUv=uv;vDepth=position.z;gl_Position=vec4(p.x*.83+.12,p.y*.88-p.z*.06,-p.z*.22,1.);}",
    );
    const fs = shader(
      gl,
      gl.FRAGMENT_SHADER,
      "precision mediump float;uniform sampler2D image;uniform float flash;uniform float redCrystal;varying vec2 vUv;varying vec3 vNormal;varying float vDepth;void main(){if(vDepth<-.55)discard;vec3 n=normalize(vNormal);vec3 tex=texture2D(image,vUv).rgb;float gem=smoothstep(.08,.24,max(tex.r,tex.b)-tex.g);float luminance=dot(tex,vec3(.2126,.7152,.0722));vec3 color=mix(tex,mix(vec3(luminance),tex,1.6),gem);vec3 tint=mix(vec3(.65,1.02,1.3),vec3(1.35,.6,.72),redCrystal);color=mix(color,color*tint,gem);float light=max(0.,dot(n,normalize(vec3(-.55,.65,1.))));float shine=pow(max(0.,dot(n,normalize(vec3(-.5,.6,1.5)))),28.)*.4;gl_FragColor=vec4(max(color,vec3(0.))*(.95+.5*light)+shine*gem+flash*.6,1.);}",
    );
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, "redCrystal"), side);
    const bytes = Uint8Array.from(atob(model.vertices), (c) => c.charCodeAt(0)),
      buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(bytes.buffer),
      gl.STATIC_DRAW,
    );
    for (const [name, size, offset] of [
      ["position", 3, 0],
      ["uv", 2, 12],
      ["normal", 3, 20],
    ]) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const state = {
      canvas,
      gl,
      side,
      ready: false,
      hit: 0,
      angle: gl.getUniformLocation(program, "angle"),
      flash: gl.getUniformLocation(program, "flash"),
    };
    state.draw = (time) => {
      if (!state.ready || !canvas.isConnected) return;
      const quiet = reduced(),
        flash =
          state.hit && !quiet ? Math.max(0, 1 - (time - state.hit) / 350) : 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(state.angle, cameraYaw + (side ? 0.12 : 0));
      gl.uniform1f(state.flash, state.hit ? flash : 0);
      gl.drawArrays(gl.TRIANGLES, 0, model.count);
    };
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      state.ready = true;
      canvas.parentElement?.classList.add("has-nexus-model");
      state.draw(performance.now());
    };
    image.src = model.texture;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      state.ready = false;
      canvas.parentElement?.classList.remove("has-nexus-model");
    });
    return state;
  }
  function tick(time) {
    frame = 0;
    if (
      reduced() ||
      document.hidden ||
      !document.body.classList.contains("in-duel")
    )
      return;
    frame = requestAnimationFrame(tick);
    if (time - last < 32) return;
    last = time;
    for (const r of renderers) r?.draw(time);
  }
  root.NexusView = {
    pause() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
    sync() {
      for (let side = 0; side < 2; side++) {
        const parent = document.getElementById(
          side ? "enemy-nexus" : "my-nexus",
        );
        if (!parent) continue;
        if (!fallbacks[side] && root.NEXUS_FALLBACKS?.[side]) {
          const image = new Image(256, 256);
          image.className = "nexus-fallback";
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.src = root.NEXUS_FALLBACKS[side];
          fallbacks[side] = image;
        }
        if (fallbacks[side]) parent.append(fallbacks[side]);
        if (renderers[side] === undefined) {
          try {
            renderers[side] = create(root.NEXUS_MODELS[side], side);
          } catch {
            renderers[side] = null;
          }
        }
        const r = renderers[side];
        if (r) {
          parent.append(r.canvas);
          parent.classList.toggle("has-nexus-model", r.ready);
          r.draw(performance.now());
        }
      }
      if (!frame) frame = requestAnimationFrame(tick);
    },
    impact(side) {
      const r = renderers[side];
      if (r) {
        r.hit = performance.now();
        r.draw(r.hit);
      }
    },
    get ready() {
      return renderers.filter((r) => r?.ready).length;
    },
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) root.NexusView.pause();
    else if (document.body.classList.contains("in-duel")) root.NexusView.sync();
  });
})(window);
