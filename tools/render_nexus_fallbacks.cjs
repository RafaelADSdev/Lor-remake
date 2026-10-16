/* Bake the same original geometry and HUD camera for machines without WebGL. */
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const digest = raw => crypto.createHash("sha256").update(raw).digest("hex");
(async () => {
  const game = path.resolve(__dirname, ".."), folder = path.join(game, "assets/arenas/nexus");
  fs.mkdirSync(folder, { recursive:true });
  const temp = path.join(game, "test-results/nexus-bake.html");
  fs.mkdirSync(path.dirname(temp), { recursive:true });
  fs.writeFileSync(temp, '<!doctype html><base href="../"><body class="in-duel"><div id="my-nexus"></div><div id="enemy-nexus"></div><script>window.ArenaMotion={enabled:false,reduced:true}</script><script src="nexus-data.js"></script><script src="nexus-view.js"></script><script>NexusView.sync()</script>');
  const browser = await chromium.launch({channel:"chrome",headless:true});
  try {
    const page = await browser.newPage({offline:true});
    await page.goto(pathToFileURL(temp).href);
    await page.waitForFunction(() => NexusView.ready === 2);
    const data = await page.evaluate(() => ["my-nexus", "enemy-nexus"].map(id => document.querySelector('#'+id+' canvas').toDataURL('image/png')));
    const sources = JSON.parse(fs.readFileSync(path.join(game, 'assets/arenas/nexus-sources.json'), 'utf8'));
    const manifest = data.map((src, side) => {
      const raw = Buffer.from(src.split(',')[1], 'base64'), name = side ? 'red.png' : 'blue.png';
      fs.writeFileSync(path.join(folder,name),raw);
      return {...sources[side], file:'assets/arenas/nexus/'+name, sha256:digest(raw), bytes:raw.length};
    });
    fs.writeFileSync(path.join(game,'nexus-fallback-data.js'),'window.NEXUS_FALLBACKS = '+JSON.stringify(data)+';\n');
    fs.writeFileSync(path.join(folder,'sources.json'),JSON.stringify({rendererSha256:digest(fs.readFileSync(path.join(game,'nexus-view.js'))), width:256,height:256,sprites:manifest},null,2));
    console.log('Baked two original Nexus meshes with the current HUD camera; embedded offline PNG fallbacks.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
