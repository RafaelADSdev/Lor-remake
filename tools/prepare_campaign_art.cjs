/* Small offline previews; original card artwork remains untouched. Requires sharp. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const sharp = require('sharp');
const game = path.resolve(__dirname, '..'), content = require('../campaign-data.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(game, 'cards.js'), 'utf8'), context);
const destination = path.join(game, 'assets/campaign/portraits');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  fs.mkdirSync(destination, { recursive: true });
  const sources = [];
  for (const region of content.regions.filter(region => region.playable)) {
    const source = context.window.CARD_DATA.cards[region.leader || region.champion].image;
    const raw = fs.readFileSync(path.join(game, source)), file = region.id + '.webp';
    const info = await sharp(raw).resize({ width: 640, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toFile(path.join(destination, file));
    sources.push({ region: region.id, source, sourceSha256: hash(raw), file,
      sha256: hash(fs.readFileSync(path.join(destination, file))), bytes: info.size, width: info.width, height: info.height });
  }
  fs.writeFileSync(path.join(destination, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
  console.log(`Campaign previews: ${sources.length} images, ${Math.ceil(sources.reduce((sum, image) => sum + image.bytes, 0) / 1024)} KB.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
