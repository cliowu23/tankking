import { Engine } from '@babylonjs/core';
import ArenaScene        from '../world/ArenaScene.js';
import TankDesignerScene from '../hub/TankDesignerScene.js';
import HangarScene       from '../hub/HangarScene.js';
import { getBankedSalvage } from './runState.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });

let arenaScene    = null;
let designerScene = null;
let hangarScene   = null;
let controlsSeen  = false;   // HOW-TO-PLAY shows on the first arena entry per session only

window.__state = 'MENU'; // 'MENU' | 'HANGAR' | 'GAME' | 'PAUSED' | 'DEAD' | 'CONTROLS' | 'INSPECTOR'

// ── Transition engine ────────────────────────────────────────────────────────
const _tc   = document.getElementById('transition-canvas');
const _tctx = _tc.getContext('2d');
let   _tBusy = false;

function _resizeTC() { _tc.width = window.innerWidth; _tc.height = window.innerHeight; }
window.addEventListener('resize', _resizeTC);
_resizeTC();

function _easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// Iris wipe: circle closes → swap screens while fully covered → circle opens
function _iris(hideFn, showFn) {
  const HALF = 420;
  const W = _tc.width, H = _tc.height;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.sqrt(cx*cx + cy*cy) + 4;
  let start = null, phase = 'close';

  _tc.style.display = 'block';
  function tick(t) {
    if (!start) start = t;
    const p = _easeInOut(Math.min((t - start) / HALF, 1));
    _tctx.clearRect(0, 0, W, H);
    _tctx.fillStyle = '#000810';
    _tctx.beginPath();
    _tctx.rect(0, 0, W, H);
    const r = phase === 'close' ? maxR * (1 - p) : maxR * p;
    _tctx.arc(cx, cy, Math.max(r, 0), 0, Math.PI*2, true);
    _tctx.fill();
    if (p < 1) { requestAnimationFrame(tick); return; }
    if (phase === 'close') {
      // Screen fully covered — swap now so the open reveals the live scene
      hideFn(); showFn();
      phase = 'open'; start = null;
      requestAnimationFrame(tick);
    } else {
      _tctx.clearRect(0, 0, W, H);
      _tc.style.display = 'none';
      _tBusy = false;
    }
  }
  requestAnimationFrame(tick);
}

// Checkerboard dissolve: tiles fill in randomly → swap → tiles clear randomly
function _checker(hideFn, showFn) {
  const HALF = 420;
  const W = _tc.width, H = _tc.height;
  const SZ = 28;
  const COLS = Math.ceil(W / SZ), ROWS = Math.ceil(H / SZ);
  const total = COLS * ROWS;
  const order = Array.from({length: total}, (_, i) => i).sort(() => Math.random() - 0.5);
  let start = null, phase = 'in';

  _tc.style.display = 'block';
  function tick(t) {
    if (!start) start = t;
    const p = Math.min((t - start) / HALF, 1);
    _tctx.clearRect(0, 0, W, H);
    _tctx.fillStyle = '#000810';
    const count = Math.floor(p * total);
    if (phase === 'in') {
      for (let i = 0; i < count; i++) {
        const idx = order[i];
        _tctx.fillRect((idx % COLS) * SZ, Math.floor(idx / COLS) * SZ, SZ, SZ);
      }
    } else {
      for (let i = count; i < total; i++) {
        const idx = order[i];
        _tctx.fillRect((idx % COLS) * SZ, Math.floor(idx / COLS) * SZ, SZ, SZ);
      }
    }
    if (p < 1) { requestAnimationFrame(tick); return; }
    if (phase === 'in') {
      // Screen fully covered — swap now so the reveal shows the live scene
      hideFn(); showFn();
      phase = 'out'; start = null;
      order.sort(() => Math.random() - 0.5); // re-shuffle for reveal
      requestAnimationFrame(tick);
    } else {
      _tctx.clearRect(0, 0, W, H);
      _tc.style.display = 'none';
      _tBusy = false;
    }
  }
  requestAnimationFrame(tick);
}

function transition(hideFn, showFn, type = 'checker') {
  if (_tBusy) return;
  _tBusy = true;
  _resizeTC();
  if (type === 'iris') _iris(hideFn, showFn);
  else                 _checker(hideFn, showFn);
}

function startGame() {
  transition(
    () => {
      document.getElementById('menu').style.display = 'none';
    },
    () => {
      canvas.style.display = 'block';
      document.getElementById('hud').style.display = 'block';
      if (!arenaScene) {
        arenaScene = new ArenaScene(engine, onExtractFromArena);
        window.__arena = arenaScene;
      } else {
        arenaScene._restart();
      }
      engine.runRenderLoop(() => arenaScene.scene.render());
      arenaScene._paused = true;
      window.__state = 'CONTROLS';
      document.getElementById('controls-screen').style.display = 'flex';
    },
    'iris'
  );
}

function startHangar() {
  transition(
    () => {
      document.getElementById('menu').style.display          = 'none';
      document.getElementById('death').style.display         = 'none';
      document.getElementById('hud').style.display           = 'none';
      document.getElementById('hangar-prompt').style.display = 'none';
      document.getElementById('hangar-panel').style.display  = 'none';
      engine.stopRenderLoop();
      if (arenaScene) { arenaScene._paused = false; arenaScene = null; }
    },
    () => {
      canvas.style.display = 'block';
      window.__state = 'HANGAR';
      hangarScene = new HangarScene(engine, deployToArena, goToMenu);
      window.__hangar = hangarScene; // debug hook
      const hs = document.getElementById('hangar-salvage');
      if (hs) { hs.textContent = `BANKED SALVAGE: ${getBankedSalvage()}`; hs.style.display = 'block'; }
      engine.runRenderLoop(() => hangarScene.scene.render());
    },
    'iris'
  );
}

function deployToArena() {
  if (_tBusy) return;
  transition(
    () => {
      document.getElementById('hangar-prompt').style.display = 'none';
      document.getElementById('hangar-panel').style.display  = 'none';
      document.getElementById('hangar-salvage').style.display = 'none';
      engine.stopRenderLoop();
      if (hangarScene) { hangarScene.dispose(); hangarScene = null; }
    },
    () => {
      canvas.style.display = 'block';
      document.getElementById('hud').style.display = 'block';
      arenaScene = new ArenaScene(engine, onExtractFromArena);
      window.__arena = arenaScene;
      engine.runRenderLoop(() => arenaScene.scene.render());
      // HOW-TO-PLAY controls screen on the FIRST arena entry of the session only.
      // (The menu routes through the hangar now, so this no longer runs via the
      // dead startGame(); on later deploys we drop straight into the run.)
      if (!controlsSeen) {
        controlsSeen = true;
        arenaScene._paused = true;
        window.__state = 'CONTROLS';
        document.getElementById('controls-screen').style.display = 'flex';
      } else {
        window.__state = 'GAME';
      }
    },
    'checker'
  );
}

function onExtractFromArena(gained, banked) {
  document.getElementById('hud').style.display = 'none';
  document.getElementById('extract-indicator').style.display = 'none';
  document.getElementById('extract-summary-gained').textContent = `+${gained} SALVAGE`;
  document.getElementById('extract-summary-banked').textContent = `BANKED: ${banked}`;
  document.getElementById('extract-summary').style.display = 'flex';
}
document.getElementById('extract-return').addEventListener('click', () => {
  document.getElementById('extract-summary').style.display = 'none';
  startHangar();
});

function dismissControls() {
  if (window.__state !== 'CONTROLS') return;
  document.getElementById('controls-screen').style.display = 'none';
  if (arenaScene) arenaScene._paused = false;
  window.__state = 'GAME';
}

function goToMenu() {
  const overlay = document.getElementById('crt-off');
  if (overlay.classList.contains('playing') || _tBusy) return;
  document.getElementById('pause').style.display = 'none';
  document.getElementById('death').style.display = 'none';
  document.getElementById('hud').style.display   = 'none';
  document.getElementById('hangar-salvage').style.display = 'none';
  canvas.style.display = 'none';
  engine.stopRenderLoop();
  if (arenaScene) { arenaScene._paused = false; arenaScene._restart(); }
  if (hangarScene) { hangarScene.dispose(); hangarScene = null; }
  overlay.classList.add('playing');
  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('playing');
    document.getElementById('menu').style.display = 'flex';
    window.__state = 'MENU';
  }, { once: true });
}

function startDesigner() {
  transition(
    () => {
      document.getElementById('menu').style.display = 'none';
      document.getElementById('hud').style.display  = 'none';
      engine.stopRenderLoop();
    },
    () => {
      canvas.style.display = 'block';
      document.getElementById('designer-ui').style.display          = 'flex';
      document.getElementById('designer-vignette').style.display    = 'block';
      document.getElementById('designer-sidebar').style.display     = 'flex';
      document.getElementById('designer-bottom-hint').style.display = 'block';
      window.__state = 'INSPECTOR';
      if (!designerScene) designerScene = new TankDesignerScene(engine, exitDesigner);
      window.__designer = designerScene; // debug hook (mirrors __arena / __hangar)
      engine.runRenderLoop(() => designerScene.scene.render());
    }
  );
}

function exitDesigner() {
  transition(
    () => {
      document.getElementById('designer-ui').style.display          = 'none';
      document.getElementById('designer-vignette').style.display    = 'none';
      document.getElementById('designer-sidebar').style.display     = 'none';
      document.getElementById('designer-bottom-hint').style.display = 'none';
      canvas.style.display = 'none';
      engine.stopRenderLoop();
      if (designerScene) { designerScene.dispose(); designerScene = null; }
    },
    () => {
      document.getElementById('menu').style.display = 'flex';
      window.__state = 'MENU';
    }
  );
}

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (window.__state === 'HANGAR' && hangarScene) {
    if (e.code === 'KeyE') {
      if (hangarScene._panelOpen) { hangarScene.closePanel(); return; }
      const station = hangarScene._nearStation;
      if (!station) return;
      if (station.id === 'tank') { hangarScene.mountTank(); return; }
      if (station.id === 'exit') { hangarScene.exitToMenu(); return; }
      if (station.id === 'lounge') {
        hangarScene.openLounge();
        buildCrewPanel().then(() => syncCrewPanel(hangarScene.getDriverConfig()))
          .catch(e => console.warn('[crew panel] wardrobe load failed', e));
        return;
      }
      hangarScene.openPanel(station);
    }
    if (e.code === 'Escape' && hangarScene._panelOpen) {
      hangarScene.closePanel();
    }
    return;
  }
  if (window.__state === 'CONTROLS') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') dismissControls();
    return;
  }
  if (window.__state === 'MENU') {
    if (e.code === 'Enter') startHangar();
    if (e.code === 'KeyT')  startDesigner();
  }
  if (window.__state === 'INSPECTOR') {
    if (e.code === 'Escape') exitDesigner();
    if (e.code === 'KeyE' && designerScene) designerScene.confirmSelection();
  }
});

function resumeGame() {
  if (window.__state !== 'PAUSED') return;
  document.getElementById('pause').style.display = 'none';
  if (arenaScene) arenaScene._paused = false;
  window.__state = 'GAME';
}

document.getElementById('controls-start').addEventListener('click', dismissControls);
document.getElementById('menu-designer').addEventListener('click', startDesigner);
document.getElementById('pause-resume').addEventListener('click', resumeGame);
document.getElementById('pause-menu').addEventListener('click', goToMenu);
document.getElementById('pause-restart').addEventListener('click', () => {
  if (!arenaScene) return;
  document.getElementById('pause').style.display = 'none';
  document.getElementById('hud').style.display   = 'block';
  arenaScene._paused = false;
  arenaScene._restart();
  window.__state = 'GAME';
});
document.getElementById('death-hangar').addEventListener('click', startHangar);
document.getElementById('death-menu').addEventListener('click',  goToMenu);
document.getElementById('death-restart').addEventListener('click', () => {
  if (!arenaScene) return;
  document.getElementById('death').style.display = 'none';
  document.getElementById('hud').style.display   = 'block';
  arenaScene._paused = false;
  arenaScene._restart();
  window.__state = 'GAME';
});

function autoPause() {
  if (window.__state !== 'GAME') return;
  window.__state = 'PAUSED';
  if (arenaScene) arenaScene._paused = true;
  document.getElementById('pause').style.display = 'flex';
}

document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);
setInterval(() => { if (!document.hidden && !document.hasFocus()) autoPause(); }, 300);

document.getElementById('hangar-panel-deploy').addEventListener('click', deployToArena);
document.getElementById('hangar-panel-close').addEventListener('click', () => {
  if (hangarScene) hangarScene.closePanel();
});

// ── Crew Quarters panel close ─────────────────────────────────────────────────
document.getElementById('lounge-panel-close').addEventListener('click', () => {
  if (hangarScene) hangarScene.closePanel();
});

// ── Crew Quarters wardrobe panel — rows built from wardrobe.json ──────────────
// (presets row + one row per wardrobe slot: hair / headwear / face / back)
let _wardrobe = null;
async function buildCrewPanel() {
  if (_wardrobe) return;
  _wardrobe = await (await fetch('/assets/models/characters/wardrobe.json')).json();
  const host = document.getElementById('lounge-slots');
  host.innerHTML = '';
  const row = (label) => {
    const g = document.createElement('div');
    g.className = 'lng-grp';
    g.innerHTML = `<div class="lng-lbl">${label}</div>`;
    const btns = document.createElement('div');
    btns.className = 'lng-btns';
    g.appendChild(btns);
    host.appendChild(g);
    return btns;
  };
  const mkBtn = (btns, label, dataset, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.dataset, dataset);
    b.addEventListener('click', onClick);
    btns.appendChild(b);
  };
  const pr = row('Preset');
  for (const p of _wardrobe.presets) {
    mkBtn(pr, p.label, { character: p.id }, () => {
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ character: p.id }));
    });
  }
  for (const [slot, items] of Object.entries(_wardrobe.slots)) {
    const btns = row(slot[0].toUpperCase() + slot.slice(1));
    for (const it of [{ id: 'none', label: 'None' }, ...items]) {
      mkBtn(btns, it.label, { slot, id: it.id }, () => {
        if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ [slot]: it.id }));
      });
    }
  }
}
function syncCrewPanel(cfg) {
  document.querySelectorAll('#lounge-slots [data-character]').forEach(b =>
    b.classList.toggle('on', b.dataset.character === cfg.body));
  document.querySelectorAll('#lounge-slots [data-slot]').forEach(b =>
    b.classList.toggle('on', (cfg[b.dataset.slot] ?? 'none') === b.dataset.id));
}

window.addEventListener('resize', () => engine.resize());
