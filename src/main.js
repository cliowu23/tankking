import { Engine } from '@babylonjs/core';
import ArenaScene        from './scenes/ArenaScene.js';
import TankDesignerScene from './scenes/TankDesignerScene.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });

let arenaScene    = null;
let designerScene = null;

window.__state = 'MENU'; // 'MENU' | 'GAME' | 'PAUSED' | 'DEAD' | 'CONTROLS' | 'INSPECTOR'

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
        arenaScene = new ArenaScene(engine);
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
  canvas.style.display = 'none';
  engine.stopRenderLoop();
  if (arenaScene) { arenaScene._paused = false; arenaScene._restart(); }
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
  if (window.__state === 'CONTROLS') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') dismissControls();
    return;
  }
  if (window.__state === 'MENU') {
    if (e.code === 'Enter') startGame();
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
document.getElementById('death-menu').addEventListener('click',  goToMenu);

function autoPause() {
  if (window.__state !== 'GAME') return;
  window.__state = 'PAUSED';
  if (arenaScene) arenaScene._paused = true;
  document.getElementById('pause').style.display = 'flex';
}

document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);
setInterval(() => { if (!document.hidden && !document.hasFocus()) autoPause(); }, 300);

window.addEventListener('resize', () => engine.resize());
