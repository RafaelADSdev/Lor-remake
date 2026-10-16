/* Static, event-driven WebGL projection of native arena base geometry. */
(function (root) {
  const canvas = document.createElement("canvas");
  canvas.id = "arena-geometry";
  canvas.setAttribute("aria-hidden", "true");
  const arena = document.querySelector(".arena");
  arena.querySelector(".arena-scenery").prepend(canvas);
  let gl,
    program,
    version = 0,
    presentation = 0,
    keys = [],
    enabled = true;
  const cache = new Map(),
    loading = new Map();
  const choice = document.getElementById("arena-renderer");
  try {
    enabled = localStorage.getItem("lor-arena-renderer") !== "light";
  } catch {}
  choice.value = enabled ? "geometry" : "light";
  choice.onchange = () => {
    enabled = choice.value === "geometry";
    try {
      localStorage.setItem("lor-arena-renderer", choice.value);
    } catch {}
    if (keys.length === 2) root.ArenaScene.enter(keys);
  };
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error("Arena shader");
    return s;
  }
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      // The scene is drawn only on entry/resize, while another canvas animates.
      preserveDrawingBuffer: true,
    });
    if (!gl) throw Error("WebGL unavailable");
    program = gl.createProgram();
    gl.attachShader(
      program,
      shader(
        gl.VERTEX_SHADER,
        // Keep the seam fixed while giving combat half of the board height.
        // Native bases devote too much of this orthographic view to scenery.
        "attribute vec3 position;attribute vec2 uv;uniform vec2 flip;varying vec2 vUv;void main(){vUv=uv;float d=-position.y/105.;float t=d<.36?d*(.5/.36):.5+(d-.36)*(.5/.64);gl_Position=vec4(vec2(-position.x/132.,1.-2.*t)*flip,position.z/150.,1.);}",
      ),
    );
    gl.attachShader(
      program,
      shader(
        gl.FRAGMENT_SHADER,
        "precision mediump float;uniform sampler2D image;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);}",
      ),
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error("Arena program");
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  } catch {
    gl = null;
    canvas.hidden = true;
  }
  function fallback() {
    canvas.hidden = true;
    arena.dataset.geometry = "fallback";
  }
  function checkPresentation(ticket) {
    if (ticket !== presentation || !gl || !enabled || canvas.hidden) return;
    const pixel = new Uint8Array(4);
    for (const x of [0.35, 0.5, 0.65])
      for (const y of [0.35, 0.65]) {
        gl.readPixels(
          Math.floor(canvas.width * x),
          Math.floor(canvas.height * y),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        if (pixel[3] && pixel[0] + pixel[1] + pixel[2] > 24) return;
      }
    fallback();
  }
  async function load(key) {
    if (cache.has(key)) {
      const item = cache.get(key);
      cache.delete(key);
      cache.set(key, item);
      return item;
    }
    if (loading.has(key)) return loading.get(key);
    const work = (async () => {
      if (!root.ARENA_MODELS?.[key])
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "assets/arenas/current/" + key + ".js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.append(script);
        });
      const model = root.ARENA_MODELS[key],
        image = new Image();
      image.src = model.texture;
      await image.decode();
      const bytes = Uint8Array.from(atob(model.vertices), (c) =>
          c.charCodeAt(0),
        ),
        buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
      const texture = gl.createTexture();
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const item = { buffer, texture, count: model.count };
      cache.set(key, item);
      delete root.ARENA_MODELS[key];
      return item;
    })();
    loading.set(key, work);
    try {
      return await work;
    } finally {
      loading.delete(key);
    }
  }
  function draw() {
    if (!gl || !enabled || keys.length !== 2 || keys.some((k) => !cache.has(k)))
      return;
    const scale = Math.min(devicePixelRatio || 1, 1.5),
      w = Math.round(arena.clientWidth * scale),
      h = Math.round(arena.clientHeight * scale);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.useProgram(program);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let side = 0; side < 2; side++) {
      const m = cache.get(keys[side]),
        half = Math.floor(h / 2);
      gl.viewport(0, side ? half : 0, w, side ? h - half : half);
      gl.uniform2f(
        gl.getUniformLocation(program, "flip"),
        side ? -1 : 1,
        side ? -1 : 1,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, m.buffer);
      for (const [name, size, offset] of [
        ["position", 3, 0],
        ["uv", 2, 12],
      ]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 20, offset);
      }
      gl.bindTexture(gl.TEXTURE_2D, m.texture);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) {
      fallback();
      return;
    }
    canvas.hidden = false;
    arena.dataset.geometry = "ready";
    const ticket = ++presentation;
    // Validate the retained image after the browser has actually presented it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => checkPresentation(ticket)),
    );
  }
  root.ArenaScene = {
    async enter(themes) {
      const own = ++version;
      presentation++;
      keys = [...themes];
      arena.dataset.geometry = "loading";
      canvas.hidden = true;
      if (!gl || !enabled) {
        fallback();
        return;
      }
      try {
        await Promise.all(keys.map(load));
        if (own === version) {
          for (const [key, model] of cache) {
            if (cache.size <= 4) break;
            if (keys.includes(key)) continue;
            gl.deleteTexture(model.texture);
            gl.deleteBuffer(model.buffer);
            cache.delete(key);
          }
          draw();
        }
      } catch {
        if (own === version) fallback();
      }
    },
    draw,
    get ready() {
      return arena.dataset.geometry === "ready";
    },
  };
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    gl = null;
    presentation++;
    fallback();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) draw();
  });
  new ResizeObserver(draw).observe(arena);
})(window);
