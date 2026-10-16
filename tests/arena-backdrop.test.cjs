const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const { paint } = require("../arena-backdrop.js"),
  game = path.resolve(__dirname, ".."),
  folder = path.join(game, "assets/arenas/backgrounds");
const manifest = JSON.parse(
  fs.readFileSync(path.join(folder, "sources.json"), "utf8"),
);
const context = { window: {} };
for (const row of manifest)
  vm.runInNewContext(
    fs.readFileSync(path.join(folder, row.file), "utf8"),
    context,
  );
const data = context.window.ARENA_BACKGROUND_DATA;
function image() {
  return {
    tagName: "IMG",
    dataset: {},
    src: "",
    complete: false,
    naturalWidth: 0,
  };
}
test("12 fundos incorporados íntegros não dependem de URLs de arquivo para desenhar", () => {
  assert.equal(manifest.length, 12);
  for (const row of manifest) {
    const file = path.join(folder, row.file),
      original = path.join(game, row.source);
    const sha = (p) =>
      crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    assert.equal(sha(file), row.scriptSha256);
    assert.equal(sha(original), row.sourceSha256);
    assert.match(data[row.key], /^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(data[row.key].split(",")[1], "base64");
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      row.imageSha256,
    );
    const el = image();
    paint(el, row.key, data);
    assert.equal(el.src, data[row.key]);
    el.onload();
    assert.equal(el.dataset.background, "ready");
  }
});
test("região desconhecida usa Floresta; falha tem tentativa de segurança limitada", () => {
  const el = image();
  paint(el, "../../invalido", data);
  assert.equal(el.src, data.rift);
  el.onerror();
  assert.equal(el.dataset.background, "fallback");
  assert.equal(el.src, "assets/arenas/current/fallback-rift.png");
  el.onerror();
  assert.equal(el.dataset.background, "error");
  const cached = image();
  cached.complete = true;
  cached.naturalWidth = 1600;
  paint(cached, "rift", data);
  assert.equal(cached.dataset.background, "ready");
});
test("o HTML usa imagens normais e carrega os 12 fundos antes de preparar a arena", () => {
  const html = fs.readFileSync(path.join(game, "index.html"), "utf8");
  for (const id of [
    "arena-preview-art",
    "arena-enemy-surface",
    "arena-local-surface",
  ])
    assert.match(html, new RegExp('<img\\s+[^>]*id="' + id + '"[^>]*>'));
  const view = html.indexOf('src="arena-view.js');
  for (const row of manifest) {
    const start = html.indexOf(
      'src="assets/arenas/backgrounds/' + row.file + '"',
    );
    assert.ok(start >= 0 && start < view);
  }
  assert.ok(html.indexOf('src="arena-backdrop.js') < view);
});
test("o fundo opaco fica acima do WebGL e abaixo das animações", () => {
  const css = fs.readFileSync(path.join(game, "arena-scene.css"), "utf8"),
    ambient = fs.readFileSync(path.join(game, "arena-ambient.css"), "utf8");
  const block = (selector) => css.slice(css.indexOf(selector)).split("}")[0];
  const z = (s) => Number(/z-index:\s*(-?\d+)/.exec(s)[1]);
  assert.ok(z(block(".arena .arena-surface")) > z(block("#arena-geometry")));
  assert.ok(z(ambient) > z(block(".arena .arena-surface")));
  assert.match(block(".arena .arena-surface"), /opacity:\s*1/);
  assert.match(block(".arena .arena-surface"), /object-fit:\s*fill/);
});
