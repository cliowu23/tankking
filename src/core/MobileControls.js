// MobileControls.js — additive touch/finger input for TanKING (phone playtesting).
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  KEYBOARD IS SACRED.  This module NEVER modifies a keydown/keyup handler. │
// │  Every touch action is delivered by DISPATCHING the game's OWN keyboard   │
// │  events (movement / boost / shield / interact / start / back) so they run │
// │  THROUGH the existing handlers, or by letting a finger tap reach the      │
// │  canvas natively (fire). If touch works, keyboard provably still works,   │
// │  because touch reuses keyboard's own code paths. The only edit to any     │
// │  existing file is one import + initMobileControls() call in main.js.      │
// └─────────────────────────────────────────────────────────────────────────┘
//
// It reads ONLY pre-existing globals: window.__state, window.__arena,
// window.__hangar. It writes NOTHING into game state directly.

// ── Activation ────────────────────────────────────────────────────────────
// Real touch devices, or ?touch=1 / window.__forceMobile for desktop testing.
const _params = new URLSearchParams(location.search);
function touchDevice() {
  return ('ontouchstart' in window) ||
         navigator.maxTouchPoints > 0 ||
         _params.has('touch') ||
         window.__forceMobile === true;
}

// Dispatch a synthetic key event on `document` with bubbles:true so it reaches
// BOTH document-level handlers (main.js flow keys) AND window-level handlers
// (Tank.js WASD/Q/Shift, which listen on window — bubble phase carries it up).
function key(code, down) {
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
}
function tapKey(code) { key(code, true); key(code, false); } // momentary (Enter, E, T, Esc)

// ── DOM helper ────────────────────────────────────────────────────────────
function el(tag, css, parent) {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (parent) parent.appendChild(n);
  return n;
}

let _root, _moveZone, _stick, _stickKnob, _btnBoost, _btnShield, _btnInteract, _btnBack, _btnFs, _btnStart;

// Active WASD codes currently "held" by the joystick (so we only fire edges).
const _heldDir = new Set();
function setDir(codes) {
  // codes: Set of wanted WASD codes. Release any no longer wanted, press new ones.
  for (const c of _heldDir) if (!codes.has(c)) { key(c, false); _heldDir.delete(c); }
  for (const c of codes)    if (!_heldDir.has(c)) { key(c, true);  _heldDir.add(c); }
}
function releaseDir() { setDir(new Set()); }

// ── Inject mobile meta tags + PWA hints (index.html is owned by another
//    session, so we do it all from JS) ──────────────────────────────────────
function injectMeta() {
  // Lock the viewport: no pinch/double-tap zoom, cover the notch safe-area.
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
  vp.setAttribute('content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');

  const metas = [
    ['apple-mobile-web-app-capable', 'yes'],            // iOS: chrome-less when added to Home Screen
    ['mobile-web-app-capable', 'yes'],                  // Android equivalent
    ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
    ['theme-color', '#0a0a0a'],
  ];
  for (const [name, content] of metas) {
    if (document.querySelector(`meta[name="${name}"]`)) continue;
    const m = document.createElement('meta'); m.name = name; m.content = content;
    document.head.appendChild(m);
  }
}

function injectStyles() {
  const css = `
  #mc-root{position:fixed;inset:0;z-index:40;pointer-events:none;
    font-family:'Press Start 2P',monospace;
    -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
  #mc-root *{touch-action:none;-webkit-tap-highlight-color:transparent;}
  .mc-btn{pointer-events:auto;position:absolute;display:none;align-items:center;
    justify-content:center;text-align:center;border-radius:50%;
    background:rgba(10,12,14,0.45);color:#00eedd;border:2px solid #00eedd88;
    box-shadow:0 0 10px rgba(0,238,221,0.25);backdrop-filter:blur(3px);
    font-size:11px;letter-spacing:1px;line-height:1.3;}
  .mc-btn:active{background:rgba(0,238,221,0.22);}
  .mc-pill{border-radius:14px;}
  #mc-stick{position:absolute;display:none;width:120px;height:120px;
    margin-left:-60px;margin-top:-60px;border-radius:50%;pointer-events:none;
    border:2px solid #00eedd55;background:rgba(0,238,221,0.06);}
  #mc-knob{position:absolute;left:50%;top:50%;width:54px;height:54px;
    margin-left:-27px;margin-top:-27px;border-radius:50%;
    background:rgba(0,238,221,0.35);border:2px solid #00eeddcc;
    box-shadow:0 0 12px rgba(0,238,221,0.4);}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// ── Move joystick (left side) → synthetic WASD ─────────────────────────────
// Tank semantics: W/S drive forward/back, A/D rotate (steer). We map the stick
// y-axis to W/S and x-axis to A/D — identical to the keys a desktop player uses.
const DEAD = 0.28;            // deadzone fraction of stick radius
const STICK_R = 60;           // px radius (matches #mc-stick 120px)
let _moveId = null;           // active pointerId driving the stick
let _ox = 0, _oy = 0;         // stick origin (where the finger first landed)

function moveStart(e) {
  if (_moveId !== null) return;
  _moveId = e.pointerId;
  _ox = e.clientX; _oy = e.clientY;
  _stick.style.display = 'block';
  _stick.style.left = _ox + 'px';
  _stick.style.top  = _oy + 'px';
  _stickKnob.style.transform = 'translate(0px,0px)';
  try { _moveZone.setPointerCapture(e.pointerId); } catch {}
}
function moveMove(e) {
  if (e.pointerId !== _moveId) return;
  let dx = e.clientX - _ox, dy = e.clientY - _oy;
  const len = Math.hypot(dx, dy) || 1;
  const cl = Math.min(len, STICK_R);
  const kx = (dx / len) * cl, ky = (dy / len) * cl;
  _stickKnob.style.transform = `translate(${kx}px,${ky}px)`;

  const nx = dx / STICK_R, ny = dy / STICK_R;   // normalised -1..1 (clamped feel)
  const want = new Set();
  if (ny < -DEAD) want.add('KeyW');             // up    = forward
  if (ny >  DEAD) want.add('KeyS');             // down  = reverse
  if (nx < -DEAD) want.add('KeyA');             // left  = rotate left
  if (nx >  DEAD) want.add('KeyD');             // right = rotate right
  setDir(want);
}
function moveEnd(e) {
  if (e.pointerId !== _moveId) return;
  _moveId = null;
  _stick.style.display = 'none';
  releaseDir();
}

// ── Hold button (boost / shield): keydown on press, keyup on release ───────
function bindHold(btn, code) {
  const down = (e) => { e.preventDefault(); e.stopPropagation(); key(code, true);  btn.dataset.on = '1'; };
  const up   = (e) => { e.preventDefault(); e.stopPropagation(); if (btn.dataset.on) { key(code, false); delete btn.dataset.on; } };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}
function bindTap(btn, fn) {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
}

// ── Fullscreen (Android Chrome supports it; iOS Safari/iPhone does not — there
//    the PWA "Add to Home Screen" route gives the chrome-less view) ──────────
function fsSupported() {
  return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
}
function toggleFs() {
  const d = document, root = d.documentElement;
  const isFs = d.fullscreenElement || d.webkitFullscreenElement;
  try {
    if (!isFs) (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  } catch {}
}

// ── Build the overlay ──────────────────────────────────────────────────────
function buildDom() {
  _root = el('div', '', document.body); _root.id = 'mc-root';

  // Left half = move zone (dynamic joystick appears under the finger).
  _moveZone = el('div',
    'pointer-events:auto;position:absolute;left:0;top:6%;width:46%;height:84%;', _root);
  _moveZone.addEventListener('pointerdown', moveStart);
  _moveZone.addEventListener('pointermove', moveMove);
  _moveZone.addEventListener('pointerup', moveEnd);
  _moveZone.addEventListener('pointercancel', moveEnd);

  _stick = el('div', '', _root); _stick.id = 'mc-stick';
  _stickKnob = el('div', '', _stick); _stickKnob.id = 'mc-knob';

  // Right-side action buttons (safe-area aware).
  const safeR = 'right:max(22px,env(safe-area-inset-right))';
  const safeB = 'bottom:max(26px,env(safe-area-inset-bottom))';

  _btnShield = el('button', `${safeR};${safeB};width:84px;height:84px;`, _root);
  _btnShield.className = 'mc-btn'; _btnShield.innerHTML = 'SHIELD';
  bindHold(_btnShield, 'KeyQ');

  _btnBoost = el('button', `right:max(118px,calc(env(safe-area-inset-right) + 96px));${safeB};width:84px;height:84px;`, _root);
  _btnBoost.className = 'mc-btn'; _btnBoost.innerHTML = 'BOOST';
  bindHold(_btnBoost, 'ShiftLeft');

  // Contextual INTERACT / LOOT (E) — shows only when near a station/container.
  _btnInteract = el('button',
    `right:max(22px,env(safe-area-inset-right));bottom:max(130px,calc(env(safe-area-inset-bottom) + 104px));width:96px;height:96px;color:#ffb000;border-color:#ffb00088;box-shadow:0 0 10px rgba(255,176,0,0.3);`, _root);
  _btnInteract.className = 'mc-btn'; _btnInteract.innerHTML = '◉<br>INTERACT';
  bindTap(_btnInteract, () => tapKey('KeyE'));

  // BACK / PAUSE (Esc) — top-left.
  _btnBack = el('button',
    `left:max(16px,env(safe-area-inset-left));top:max(14px,env(safe-area-inset-top));width:50px;height:50px;font-size:9px;`, _root);
  _btnBack.className = 'mc-btn mc-pill'; _btnBack.innerHTML = 'II';
  bindTap(_btnBack, () => tapKey('Escape'));

  // Fullscreen — top-right.
  _btnFs = el('button',
    `right:max(16px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:50px;height:50px;font-size:18px;`, _root);
  _btnFs.className = 'mc-btn mc-pill'; _btnFs.innerHTML = '⛶';
  bindTap(_btnFs, toggleFs);

  // START / TAP-TO-PLAY (Enter) — big center button for menu + controls screens.
  _btnStart = el('button',
    'pointer-events:auto;position:absolute;left:50%;bottom:14%;transform:translateX(-50%);display:none;' +
    'padding:18px 34px;border-radius:16px;background:rgba(0,238,221,0.14);color:#00eedd;' +
    'border:2px solid #00eedd;box-shadow:0 0 16px rgba(0,238,221,0.4);font-size:13px;letter-spacing:2px;' +
    "font-family:'Press Start 2P',monospace;", _root);
  _btnStart.id = 'mc-start'; _btnStart.textContent = 'TAP TO PLAY';
  bindTap(_btnStart, () => tapKey('Enter'));
}

// ── Visibility driven by game state + proximity flags ──────────────────────
function show(node, on) { if (node) node.style.display = on ? 'flex' : 'none'; }

function refresh() {
  const st = window.__state;
  const arena = window.__arena, hangar = window.__hangar;

  const inGame   = st === 'GAME';
  const inHangar = st === 'HANGAR';
  const inMenu   = st === 'MENU' || st === 'CONTROLS';
  const inInspect = st === 'INSPECTOR';

  // Move joystick: combat + hangar walking + designer orbit all read WASD.
  show(_moveZone, inGame || inHangar || inInspect);
  if (!(inGame || inHangar || inInspect) && _moveId !== null) { _moveId = null; _stick.style.display = 'none'; releaseDir(); }

  // Combat-only buttons.
  show(_btnBoost,  inGame);
  show(_btnShield, inGame);
  if (!inGame) {              // safety: drop any stuck holds when leaving combat
    if (_btnBoost.dataset.on)  { key('ShiftLeft', false); delete _btnBoost.dataset.on; }
    if (_btnShield.dataset.on) { key('KeyQ', false); delete _btnShield.dataset.on; }
  }

  // Contextual INTERACT/LOOT — near a hangar station OR an arena container.
  const nearHangar = inHangar && hangar && (hangar._nearStation || hangar._nearContainer);
  const nearLoot   = inGame   && arena  && arena._nearContainer;
  const interactOn = !!(nearHangar || nearLoot);
  _btnInteract.innerHTML = nearLoot ? '◉<br>LOOT' : '◉<br>ENTER';
  show(_btnInteract, interactOn);

  // BACK/PAUSE — in combat (pause) and inspector (exit). Designer confirm is E.
  show(_btnBack, inGame || inInspect);

  // START — menu + controls "press enter" screens.
  show(_btnStart, inMenu);
  if (_btnStart) _btnStart.textContent = st === 'CONTROLS' ? 'TAP TO START' : 'TAP TO PLAY';

  // Inspector confirm reuses the INTERACT button (E = confirm selection).
  if (inInspect) { _btnInteract.innerHTML = '✓<br>CONFIRM'; show(_btnInteract, true); }

  // Fullscreen button only where the browser actually supports it.
  show(_btnFs, fsSupported());
}

let _loopRunning = false;
function startContextLoop() {
  if (_loopRunning) return; _loopRunning = true;
  const tick = () => { try { refresh(); } catch {} requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// ── Public entry — call once from main.js. No-op on non-touch (desktop safe).
export function initMobileControls() {
  if (!touchDevice()) return;          // desktop / no touch → nothing injected
  injectMeta();
  injectStyles();
  buildDom();
  startContextLoop();
  window.__mobile = { refresh, key, version: 1 }; // debug hook (mirrors __arena/__hangar)
  console.log('[MobileControls] touch layer active (additive — keyboard untouched)');
}
