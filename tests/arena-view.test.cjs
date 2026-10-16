const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  A = require("../arena-view.js");
test("arena automática prioriza campeão e depois quantidade de cartas; escolha manual prevalece", () => {
  const cards = [
    { region: "Noxus" },
    { region: "Noxus" },
    { region: "Demacia", champion: true },
  ];
  assert.equal(A.fromDeck(cards), "demacia");
  assert.equal(A.fromDeck(cards.slice(0, 2)), "noxus");
  assert.equal(A.selection(cards, {}, "freljord"), "freljord");
  assert.equal(A.selection(cards, {}, "auto"), "demacia");
  assert.equal(A.fromDeck([{ region: "Shurima" }]), "shurima");
  assert.equal(A.fromDeck([{ region: "Targon" }]), "targon");
  assert.equal(A.fromDeck([{ region: "BandleCity" }]), "bandlecity");
  assert.equal(A.fromDeck([{ region: "Runeterra" }]), "rift");
  assert.equal(A.fromDeck([]), "rift");
});
test("doze arenas e texturas preservam SHA-256 e bytes originais registrados", () => {
  assert.equal(Object.keys(A.themes).length, 12);
  const folder = path.resolve(__dirname, "../assets/arenas"),
    manifest = JSON.parse(
      fs.readFileSync(path.join(folder, "sources.json"), "utf8"),
    );
  for (const r of manifest.files) {
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(folder, r.file)))
        .digest("hex"),
      r.sha256,
    );
    assert.equal(r.modified, false);
  }
  for (const t of Object.values(A.themes)) {
    assert.ok(t.y + t.height <= 2048);
    assert.ok(fs.existsSync(path.join(folder, t.file)));
  }
});
test("arena da campanha segue o local do encontro, inclusive invasores e cidades", () => {
  const C = require('../campaign.js');
  const expected = { demacia: 'demacia', noxus: 'noxus', freljord: 'freljord', ionia: 'ionia', 'piltover-zaun': 'piltover', bilgewater: 'bilgewater', shurima: 'shurima', targon: 'targon', ixtal: 'rift', 'shadow-isles': 'shadowisles' };
  for (const [region, theme] of Object.entries(expected)) {
    for (const encounter of C.encounters(region)) {
      assert.equal(A.campaignTheme({ campaign: { encounterId: encounter.id } }, C), theme, encounter.id);
    }
  }
  assert.equal(A.campaignTheme({}, C), null);
  assert.equal(A.campaignTheme({ campaign: { encounterId: 'invalid' } }, C), null);
});
