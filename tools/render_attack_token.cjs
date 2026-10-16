/* Bake the original mesh UVs; runtime animates these assets with recovered curves. */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { chromium } = require("playwright");
(async () => {
  const game = path.resolve(__dirname, ".."), folder = path.join(game, "assets/arenas/token");
  const input = JSON.parse(fs.readFileSync(path.join(game, "research/token-render-input.json"), "utf8"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const sprites = await page.evaluate(async ({ geometry, texture }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
      function shader(kind, source) {
        const shader = gl.createShader(kind);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        return shader;
      }
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, "attribute vec3 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p.xy,p.z*.1,1.);}"));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, "precision mediump float;uniform sampler2D image;varying vec2 v;void main(){gl_FragColor=texture2D(image,v);}"));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const [name, size, offset] of [["p", 3, 0], ["uv", 2, 12]]) {
        const loc = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 20, offset);
      }
      const image = new Image(); image.src = texture; await image.decode();
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
      const result = {};
      for (const [name, mesh] of Object.entries(geometry)) {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.packed), gl.STATIC_DRAW);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.packed.length / 5);
        result[name] = canvas.toDataURL("image/png");
      }
      return result;
    }, input);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, "sources.json"), "utf8"));
    manifest.sprites = {};
    for (const [name, url] of Object.entries(sprites)) {
      const png = Buffer.from(url.split(",")[1], "base64");
      fs.writeFileSync(path.join(folder, name + ".png"), png);
      manifest.sprites[name] = { sha256: crypto.createHash("sha256").update(png).digest("hex"), triangles: input.geometry[name].triangles };
    }
    fs.writeFileSync(path.join(folder, "sources.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log("Baked seven original token meshes with original UVs and texture.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
