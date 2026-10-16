const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'campaign-map-data.js'), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.CAMPAIGN_MAP_DATA));
const sources = require('../assets/campaign/sources.json');

test('atlas geometry covers all ten regions, with nine authentic source masks and a distinct city halo', () => {
  assert.equal(data.size, 2048);
  assert.equal(data.regions.length, 10);
  assert.equal(new Set(data.regions.map(r => r.id)).size, 10);
  for (const region of data.regions) {
    assert.ok(region.path.startsWith('M') && region.path.endsWith('Z'), region.id);
    assert.ok(region.sample.every(n => Number.isFinite(n) && n >= 0 && n <= data.size));
    if (region.kind === 'city') {
      assert.equal(region.id, 'piltover-zaun');
      continue;
    }
    const record = sources.territories[region.id], bytes = fs.readFileSync(path.join(root, record.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.equal(bytes.readUInt32BE(16), 2048); assert.equal(bytes.readUInt32BE(20), 2048);
    assert.deepEqual(region.bounds, record.bounds);
  }
});

test('SVG presentation stays lightweight and cannot intercept campaign map clicks', () => {
  assert.ok(fs.statSync(path.join(root, 'campaign-map-data.js')).size < 50000);
  const css = fs.readFileSync(path.join(root, 'campaign-map.css'), 'utf8');
  assert.match(css, /\.campaign-territories\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.campaign-territory\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
