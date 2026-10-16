/* Bake the extracted native Piltover gear and UVs into an offline 2D sprite. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { chromium } = require("playwright");
(async () => {
  const game = path.resolve(__dirname, ".."),
    root = path.dirname(game),
    mesh = path.join(
      root,
      "assets_extraidos_atualizados_2026-10-15/arenas/piltover/Piltover_Gear_1_8487359235459223492.obj",
    ),
    texture = path.join(game, "assets/arenas/current/piltover.png");
  const vertices = [],
    uv = [],
    faces = [];
  for (const line of fs.readFileSync(mesh, "utf8").split(/\r?\n/)) {
    const [type, ...parts] = line.trim().split(/\s+/);
    if (type === "v") vertices.push(parts.slice(0, 3).map(Number));
    if (type === "vt") uv.push(parts.slice(0, 2).map(Number));
    if (type === "f") {
      const f = parts.map((p) => p.split("/").map((n) => Number(n) - 1));
      for (let i = 1; i < f.length - 1; i++) faces.push(f[0], f[i], f[i + 1]);
    }
  }
  const radius = Math.max(
      ...vertices.flatMap((v) => v.slice(0, 2).map(Math.abs)),
    ),
    packed = [];
  for (const [v, t] of faces)
    packed.push(...vertices[v].map((n) => (n / radius) * 0.94), ...uv[t]);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const png = await page.evaluate(
      async ({ packed, texture }) => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const gl = c.getContext("webgl", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
        });
        function shader(type, src) {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw Error(gl.getShaderInfoLog(s));
          return s;
        }
        const p = gl.createProgram();
        gl.attachShader(
          p,
          shader(
            gl.VERTEX_SHADER,
            "attribute vec3 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p.xy,p.z*.1,1.);}",
          ),
        );
        gl.attachShader(
          p,
          shader(
            gl.FRAGMENT_SHADER,
            "precision mediump float;uniform sampler2D image;varying vec2 v;void main(){gl_FragColor=texture2D(image,v);}",
          ),
        );
        gl.linkProgram(p);
        gl.useProgram(p);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(packed),
          gl.STATIC_DRAW,
        );
        for (const [name, size, offset] of [
          ["p", 3, 0],
          ["uv", 2, 12],
        ]) {
          const i = gl.getAttribLocation(p, name);
          gl.enableVertexAttribArray(i);
          gl.vertexAttribPointer(i, size, gl.FLOAT, false, 20, offset);
        }
        const image = new Image();
        image.src = texture;
        await image.decode();
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, packed.length / 5);
        return c.toDataURL("image/png");
      },
      {
        packed,
        texture:
          "data:image/png;base64," +
          fs.readFileSync(texture).toString("base64"),
      },
    );
    const folder = path.join(game, "assets/arenas/ambient");
    fs.mkdirSync(folder, { recursive: true });
    const bytes = Buffer.from(png.split(",")[1], "base64");
    fs.writeFileSync(path.join(folder, "piltover-gear.png"), bytes);
    fs.writeFileSync(
      path.join(game, "arena-ambient-data.js"),
      "window.ARENA_AMBIENT_ASSETS = " + JSON.stringify({ gear: png }) + ";\n",
    );
    fs.writeFileSync(
      path.join(folder, "sources.json"),
      JSON.stringify(
        {
          mesh: path.relative(root, mesh).replaceAll("\\", "/"),
          meshSha256: crypto
            .createHash("sha256")
            .update(fs.readFileSync(mesh))
            .digest("hex"),
          textureSha256: crypto
            .createHash("sha256")
            .update(fs.readFileSync(texture))
            .digest("hex"),
          spriteSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          triangles: faces.length / 3,
          projection:
            "native XY/UV; camera faces +Z; runtime placement/rotation adapted",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Native Piltover gear sprite rendered:",
      faces.length / 3,
      "triangles.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
