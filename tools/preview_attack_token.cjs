/* An enlarged, isolated preview using the production token renderer and assets. */
const fs = require("node:fs"), path = require("node:path"), { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const output = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(output, { recursive: true });
  const file = path.join(output, "token-preview.html");
  fs.writeFileSync(file, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><base href="../">
<link rel="stylesheet" href="attack-token.css"><style>
@font-face{font-family:Beaufort;src:url('assets/beaufort-bold.ttf')}*{box-sizing:border-box}body{margin:0;background:#101b22;color:#f5e9cf;text-align:center;font:14px 'Segoe UI',sans-serif}.arena{position:relative;height:260px;background:#101b22}.arena #arena-token{position:absolute;left:calc(50% - 22px);top:calc(50% - 22px);width:44px;height:44px;transform:scale(2);transform-origin:center}.caption{position:absolute;inset:auto 0 2px;font:25px Beaufort,serif}footer{padding:22px;color:#b5c5ca;border-top:1px solid #b89a6033;font-size:12px}
</style><body class="in-duel"><div class="arena" data-arena-phase="main"><span id="arena-token" class="arena-token" role="img" aria-label="Marcador do duelo"></span><div class="caption">Defesa</div></div><footer>Prévia ampliada · recursos originais do cliente</footer>
<script>window.Engine={canAttack:(state,side)=>state.attackTokens[side]};window.ArenaMotion={enabled:true,reduced:false};window.previewState={winner:null,attackTokens:[false,true]};</script><script src="attack-token-data.js"></script><script src="attack-token.js"></script><script>ArenaToken.render(previewState);window.preview=(attack,declaring=false)=>{previewState.attackTokens=[attack,!attack];document.querySelector('.arena').dataset.arenaPhase=declaring?'prepare':'main';document.querySelector('.caption').textContent=declaring?'Preparar ataque':attack?'Ataque disponível':'Token consumido';ArenaToken.render(previewState)};</script></body></html>`);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 600, height: 340 }, recordVideo: { dir: output, size: { width: 600, height: 340 } }, reducedMotion: "no-preference", offline: true });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.evaluate(() => preview(true));
    await page.waitForTimeout(600);
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, "token-montagem.png") });
    await page.waitForTimeout(1450);
    await page.screenshot({ path: path.join(output, "token-preview.png") });
    await page.evaluate(() => preview(true, true));
    await page.waitForTimeout(850);
    await page.evaluate(() => preview(false));
    await page.waitForTimeout(900);
    if (errors.length) throw Error(errors.join("\n"));
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(output, "token-preview.webm"));
    console.log("Enlarged preview recorded using the production token module.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
