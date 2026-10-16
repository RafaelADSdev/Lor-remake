/* Raster fallbacks come from the same original mesh and final native pose. */
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    const out = path.resolve(__dirname,'../assets/outcome'); fs.mkdirSync(out,{recursive:true});
    for (const outcome of ['victory','defeat','draw']) {
      await page.evaluate(outcome => NativeOutcome.show(document.getElementById('result-native-art'),outcome,false),outcome);
      await page.waitForFunction(() => document.querySelector('.result-native-canvas')?.dataset.progress === '1');
      const url=await page.locator('.result-native-canvas').evaluate(c=>c.toDataURL('image/png'));
      fs.writeFileSync(path.join(out,outcome+'.png'),Buffer.from(url.split(',')[1],'base64'));
    }
    console.log('Baked three native final-pose fallbacks.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
