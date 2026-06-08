/* Headless screenshot of a served TanKING build, driving the start flow.
   Usage: node capture.js <url> <outPath> [keysJSON] [settleMs] [evalJS] [postEvalMs]
   Resolves the cached Playwright Chromium automatically (no full playwright install needed). */
const { chromium } = require('playwright-core');
const fs = require('fs'), os = require('os'), path = require('path');

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  let best = null;
  for (const d of (fs.existsSync(root) ? fs.readdirSync(root) : [])) {
    if (!d.startsWith('chromium-')) continue;
    const exe = path.join(root, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app',
                          'Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(exe)) best = exe; // take the highest-numbered match
  }
  if (!best) throw new Error('No cached Chromium found under ' + root + ' (set CHROME_PATH).');
  return best;
}

const [,, url, outPath, keysJSON = '[]', settleMs = '2800', evalJS = '', postEvalMs = '4000'] = process.argv;
const keys = JSON.parse(keysJSON);

(async () => {
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(Number(settleMs));
  console.log('initial __state:', await page.evaluate(() => window.__state ?? null));
  await page.mouse.click(640, 400);
  for (const [key, waitMs] of keys) { await page.keyboard.press(key); await page.waitForTimeout(Number(waitMs)); }
  if (evalJS) { await page.evaluate(evalJS); await page.waitForTimeout(Number(postEvalMs)); }
  console.log('final __state:', await page.evaluate(() => window.__state ?? null));
  await page.waitForTimeout(800);
  await page.screenshot({ path: outPath });
  console.log('saved:', outPath, '| console errors:', errs.length);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
