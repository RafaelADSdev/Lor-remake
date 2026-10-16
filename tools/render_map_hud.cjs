/* Render complete native mesh components with their original UVs and texture. */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { chromium } = require("playwright");
const folder = path.resolve(__dirname, "../assets/arenas/hud");
const model = JSON.parse(fs.readFileSync(path.join(folder, "ui-tray.json"), "utf8"));
const mana = JSON.parse(fs.readFileSync(path.join(folder, "spell-mana-tray.json"), "utf8"));
const texture = "data:image/png;base64," + fs.readFileSync(path.join(folder, "neutral-ui.png")).toString("base64");
const selections = {
  "action-dock": [[model, [0, 1]], [mana, mana.components.map((_, i) => i)]],
  "nexus-red-dock": [[model, [5]]],
  "nexus-blue-dock": [[model, [4]]],
  "native-tray": [[model, model.components.map((_, i) => i)]],
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const sprites = {}, projection = {}, records = [];
    for (const [name, selectionsForSprite] of Object.entries(selections)) {
      const packed = [];
      for (const [model, components] of selectionsForSprite)
      for (const component of components)
        for (const face of model.components[component].faceIndices)
          for (const index of model.indices.slice(face * 3, face * 3 + 3))
            packed.push(-model.positions[index][0], model.positions[index][1], model.positions[index][2], ...model.uvs[index]);
      const result = await page.evaluate(async ({ packed, texture }) => {
        const bounds = [0, 1].map(axis => {
          const values = packed.filter((_, i) => i % 5 === axis);
          return [Math.min(...values), Math.max(...values)];
        });
        const height = 512, width = Math.ceil(height * (bounds[0][1] - bounds[0][0]) / (bounds[1][1] - bounds[1][0]));
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
        const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
        if (!gl) throw Error("WebGL required for native HUD bake");
        const program = gl.createProgram();
        for (const [type, source] of [
          [gl.VERTEX_SHADER, "attribute vec3 p;attribute vec2 uv;uniform vec4 bounds;varying vec2 v;void main(){v=uv;vec2 xy=(p.xy-bounds.xy)/bounds.zw*2.-1.;gl_Position=vec4(xy*.97,-p.z/20.,1.);}"],
          [gl.FRAGMENT_SHADER, "precision mediump float;uniform sampler2D image;varying vec2 v;void main(){gl_FragColor=texture2D(image,v);}"]
        ]) {
          const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program); gl.useProgram(program);
        gl.uniform4f(gl.getUniformLocation(program, "bounds"), bounds[0][0], bounds[1][0], bounds[0][1] - bounds[0][0], bounds[1][1] - bounds[1][0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packed), gl.STATIC_DRAW);
        for (const [name, size, offset] of [["p", 3, 0], ["uv", 2, 12]]) {
          const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 20, offset);
        }
        const image = new Image(); image.src = texture; await image.decode();
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture()); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height); gl.drawArrays(gl.TRIANGLES, 0, packed.length / 5);
        if (gl.getError() !== gl.NO_ERROR) throw Error("HUD bake failed");
        return {
          png: canvas.toDataURL("image/png"),
          bounds: bounds.map(([min, max]) => {
            const center = (min + max) / 2, half = (max - min) / 2 / .97;
            return [center - half, center + half];
          }),
        };
      }, { packed, texture });
      const { png, bounds } = result;
      const bytes = Buffer.from(png.split(",")[1], "base64");
      fs.writeFileSync(path.join(folder, name + ".png"), bytes);
      if (name !== "native-tray") sprites[name] = png;
      projection[name] = { bounds };
      records.push({ name, components: selectionsForSprite.map(([, parts]) => parts), bounds, triangles: packed.length / 15, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
    fs.writeFileSync(path.join(folder, "sprites.js"), "window.NATIVE_MAP_HUD = " + JSON.stringify({ sprites, projection }) + ";\n");
    const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    fs.writeFileSync(path.join(folder, "sprites.json"), JSON.stringify({ projection: "XY, reflected X, native UV and depth Z; components fitted individually", rendererSha256: sha(__filename), modelSha256: sha(path.join(folder, "ui-tray.json")), manaModelSha256: sha(path.join(folder, "spell-mana-tray.json")), textureSha256: sha(path.join(folder, "neutral-ui.png")), records }, null, 2));
    console.log("Rendered native HUD:", records.map(r => r.name).join(", "));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
