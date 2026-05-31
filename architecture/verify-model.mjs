/**
 * Model verification utility — takes side/front/default screenshots of a model
 * in the inspector and reports pass/fail on pivot values.
 *
 * Usage (from game/ directory):
 *   node architecture/verify-model.mjs t-55ak.glb
 *   node architecture/verify-model.mjs m26_pershing_war_thunder.glb
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/cliowu/.npm/_npx/5e2e484947874241/node_modules/playwright');

const modelFile = process.argv[2];
if (!modelFile) {
  console.error('Usage: node architecture/verify-model.mjs <model-filename.glb>');
  process.exit(1);
}

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-screenshots');
const slug = modelFile.replace('.glb', '').replace(/_/g, '-');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const pivots = {};
const warnings = [];
page.on('console', msg => {
  const t = msg.text();
  if (t.includes('[Inspector]')) {
    const pivotM = t.match(/turretPivot: x=([\d.-]+) y=([\d.-]+) z=([\d.-]+)/);
    const barrelM = t.match(/barrelPivot: x=([\d.-]+) y=([\d.-]+) z=([\d.-]+)/);
    const scaleM  = t.match(/scale=([\d.-]+), w=([\d.-]+)/);
    if (pivotM)  pivots.turret = { x: +pivotM[1], y: +pivotM[2], z: +pivotM[3] };
    if (barrelM) pivots.barrel = { x: +barrelM[1], y: +barrelM[2], z: +barrelM[3] };
    if (scaleM)  pivots.scale  = { scale: +scaleM[1], w: +scaleM[2] };
  }
  if (t.includes('[Inspector]') && t.includes('misplaced')) warnings.push(t);
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.click('#menu-designer');
await page.waitForTimeout(500);

// Find and click the model button
const buttons = await page.$$('.shape-btn');
let found = false;
for (const btn of buttons) {
  const text = await btn.textContent();
  const label = modelFile.replace('.glb', '').replace(/_war_thunder/gi, '').replace(/_/g, ' ').trim().toUpperCase();
  if (text && text.trim().toUpperCase() === label) {
    await btn.click();
    found = true;
    break;
  }
}

if (!found) {
  // fallback: try partial match
  for (const btn of buttons) {
    const text = await btn.textContent();
    const shortName = modelFile.split('_')[0].toUpperCase();
    if (text && text.toUpperCase().includes(shortName) && text !== 'DEFAULT TANK') {
      await btn.click();
      found = true;
      break;
    }
  }
}

if (!found) {
  console.error(`Could not find button for "${modelFile}". Available buttons:`);
  for (const btn of buttons) console.error(' -', await btn.textContent());
  await browser.close();
  process.exit(1);
}

await page.waitForFunction(() => {
  for (const b of document.querySelectorAll('.shape-btn')) {
    if (b.textContent === 'LOADING…') return false;
  }
  return true;
}, { timeout: 15000 });
await page.waitForTimeout(500);

// Screenshot helper
const shot = async (name, alpha, beta, radius) => {
  if (alpha !== null) {
    await page.evaluate(({ alpha, beta, radius }) => {
      const cam = window.__designerCamera;
      if (!cam) return;
      cam.alpha = alpha; cam.beta = beta; cam.radius = radius;
    }, { alpha, beta, radius });
    await page.waitForTimeout(200);
  }
  const file = path.join(OUT_DIR, `${slug}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  saved: architecture/verify-screenshots/${slug}-${name}.png`);
};

// Expose camera on window so we can reposition it
await page.evaluate(() => {
  if (window.__designerScene) window.__designerCamera = window.__designerScene.camera;
});

await shot('default', null, null, null);
await shot('side',    0,           Math.PI / 2 - 0.05, 9);
await shot('front',  Math.PI / 2, Math.PI / 2 - 0.05, 9);
await shot('top',    -Math.PI / 2, 0.05, 11);

await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\n=== ${modelFile} ===`);
if (pivots.scale) console.log(`scale=${pivots.scale.scale.toFixed(4)}, w=${pivots.scale.w.toFixed(2)}`);

const checks = [];
const pass = (label, val) => { checks.push(`  ✓ ${label}: ${val}`); };
const fail = (label, val, hint) => { checks.push(`  ✗ FAIL ${label}: ${val} — ${hint}`); };

if (pivots.turret) {
  pivots.turret.y > 0.3
    ? pass('turretPivot.y', pivots.turret.y.toFixed(3))
    : fail('turretPivot.y', pivots.turret.y.toFixed(3), 'empty too low — redo Blender empty placement with correct min-Z offset');
  Math.abs(pivots.turret.x) < 0.5
    ? pass('turretPivot.x', pivots.turret.x.toFixed(3))
    : fail('turretPivot.x', pivots.turret.x.toFixed(3), 'add centerTurretX: true to manifest');
  pivots.turret.z > 0
    ? pass('turretPivot.z', pivots.turret.z.toFixed(3))
    : fail('turretPivot.z', pivots.turret.z.toFixed(3), 'turret ring may be behind hull center');
} else {
  fail('turretPivot', 'not found', 'model may have failed to load');
}

if (pivots.barrel) {
  pivots.barrel.z > 0
    ? pass('barrelPivot.z', pivots.barrel.z.toFixed(3))
    : fail('barrelPivot.z', pivots.barrel.z.toFixed(3), 'mount empty behind turret ring');
}

if (pivots.scale) {
  const s = pivots.scale.scale;
  (s >= 0.5 && s <= 1.5)
    ? pass('scale', s.toFixed(4))
    : fail('scale', s.toFixed(4), 'unusual scale — check targetWidth in manifest');
}

console.log(checks.join('\n'));

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.log(' ⚠', w));
}

const failed = checks.filter(c => c.includes('✗')).length;
console.log(`\n${failed === 0 ? 'All checks passed ✓' : `${failed} check(s) failed`}`);
process.exit(failed > 0 ? 1 : 0);
