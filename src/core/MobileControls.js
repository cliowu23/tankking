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

let _root, _moveZone, _stick, _stickKnob, _btnBoost, _btnShield, _btnFire, _btnInteract, _btnBack, _btnFs, _btnStart;

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

  /* ── Interface separation: on touch, suppress keyboard-only instructions.
     The on-screen buttons already cover these actions, so the "press E /
     press ENTER" prompts are redundant noise on a phone. !important beats the
     scenes' inline display toggles. */
  body.mc-touch #menu-start,        /* "PRESS ENTER TO START"  -> TAP TO PLAY    */
  body.mc-touch #hangar-prompt,     /* "[E] INTERACT/MOUNT/..." -> orange button */
  body.mc-touch #loot-prompt,       /* "[ E ] LOOT"            -> orange LOOT btn */
  body.mc-touch #controls-grid,     /* WASD/mouse how-to-play grid               */
  body.mc-touch #controls-tip,      /* keyboard tip line                         */
  body.mc-touch #controls-start,    /* -> centered TAP TO START                  */
  body.mc-touch #reticle{ display:none !important; } /* mouse cursor crosshair — meaningless on touch */

  /* Health/Energy HUD is desktop-sized; scale it down on phones (anchored to its
     bottom-left corner so it stays put). */
  body.mc-touch #hud{ transform:scale(0.7); transform-origin:bottom left; }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// ── Move joystick (left side) → synthetic WASD ─────────────────────────────
// The stick stores a screen-space vector; the per-frame controller below turns
// it into the SAME keys a desktop player presses. Two modes:
//   • COMBAT TANK  → direction-based "point where you want to go": the tank auto-
//     turns toward the stick's on-screen direction and drives there. (Hull-
//     relative WASD was unintuitive — to drive "down-screen" you had to push UP.)
//   • HANGAR/DESIGNER walk → simple cone mapping (up = forward) with a forgiving
//     ±34° straight channel so wobble doesn't spin you.
const DEAD = 0.22;            // magnitude deadzone (below this = neutral)
const STEER_CONE = 34;        // cone mode: half-angle (deg) of the no-turn straight channel
const FWD_CONE   = 70;        // cone mode: within this of up/down = forward / reverse
const TURN_DEAD  = 0.14;      // dir mode: heading error (rad, ~8°) within which we stop turning
const DRIVE_ARC  = 1.92;      // dir mode: drive forward once facing within ~110° of target (else pivot first)
const PHI_SIGN   = 1;         // dir mode: maps stick screen-X → world turn direction (verified by measurement)
const STICK_R = 60;           // px radius (matches #mc-stick 120px)
let _moveId = null;           // active pointerId driving the stick
let _ox = 0, _oy = 0;         // stick origin (where the finger first landed)
let _vx = 0, _vy = 0, _vmag = 0; // current stick vector (screen space, normalised)

const wrapPi = (a) => { while (a >  Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function moveStart(e) {
  if (_moveId !== null) return;
  _moveId = e.pointerId;
  _ox = e.clientX; _oy = e.clientY;
  _vx = _vy = _vmag = 0;
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
  _stickKnob.style.transform = `translate(${(dx / len) * cl}px,${(dy / len) * cl}px)`;
  _vx = dx / STICK_R; _vy = dy / STICK_R; _vmag = cl / STICK_R; // computed each frame by the loop
}
function moveEnd(e) {
  if (e.pointerId !== _moveId) return;
  _moveId = null;
  _vx = _vy = _vmag = 0;
  _stick.style.display = 'none';
  releaseDir();
}

// COMBAT: turn the tank toward the stick's on-screen direction and drive there.
// We express "screen direction" in world heading using the camera's facing, so
// it works no matter which way the hull currently points or how the cam has
// yawed. Pressing A/D nudges the hull's rotY (D:+, A:−, per Tank.js) toward the
// target; W drives once roughly aligned (pivot-then-go for big turns).
function combatDirKeys(arena) {
  const want = new Set();
  if (_vmag < DEAD || !arena || !arena.tank) return want;
  const cam = arena.camera;
  const f = cam.getForwardRay().direction;            // world dir that points "into"/up the screen
  const screenUp = Math.atan2(f.x, f.z);              // same convention as tank.rotY (forward=(sinθ,cosθ))
  const phi = Math.atan2(_vx, -_vy);                  // stick angle, CW from screen-up
  const desired = screenUp + PHI_SIGN * phi;          // world heading the player is pointing at
  const err = wrapPi(desired - arena.tank.rotY);
  if (err >  TURN_DEAD) want.add('KeyD');             // rotY must increase → D
  else if (err < -TURN_DEAD) want.add('KeyA');        // rotY must decrease → A
  if (Math.abs(err) < DRIVE_ARC) want.add('KeyW');    // drive once facing close enough
  return want;
}

// HANGAR / DESIGNER: simple camera-relative cone mapping (up = forward).
function coneWalkKeys() {
  const want = new Set();
  if (_vmag < DEAD) return want;
  const ang = Math.atan2(_vx, -_vy) * 180 / Math.PI;  // 0=up, ±180=down, +ve=right
  const a = Math.abs(ang);
  if (a <= FWD_CONE)            want.add('KeyW');
  else if (a >= 180 - FWD_CONE) want.add('KeyS');
  if (a > STEER_CONE && a < 180 - STEER_CONE) want.add(ang < 0 ? 'KeyA' : 'KeyD');
  return want;
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
// Fire = a primary-button pointerdown on the game canvas (reuses ArenaScene's
// existing fire handler, which shoots along the turret's current/auto-aimed angle).
function fireShot() {
  const cv = document.getElementById('renderCanvas');
  if (cv) cv.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
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
  _moveZone.id = 'mc-move';
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

  // FIRE (primary) — turret auto-locks the nearest aggroed enemy; this shoots it.
  // Warm accent + bigger so the right thumb falls on it. Reuses the canvas fire
  // path (a pointerdown on the renderCanvas → _shoot along the auto-aimed angle).
  _btnFire = el('button',
    `right:max(22px,env(safe-area-inset-right));bottom:max(124px,calc(env(safe-area-inset-bottom) + 98px));` +
    `width:104px;height:104px;color:#ff8a3a;border-color:#ff8a3a;box-shadow:0 0 14px rgba(255,138,58,0.4);font-size:13px;`, _root);
  _btnFire.className = 'mc-btn'; _btnFire.innerHTML = 'FIRE';
  bindTap(_btnFire, fireShot);

  // Contextual INTERACT / LOOT (E) — shows only when near a station/container.
  _btnInteract = el('button',
    `right:max(22px,env(safe-area-inset-right));bottom:max(248px,calc(env(safe-area-inset-bottom) + 222px));width:96px;height:96px;color:#ffb000;border-color:#ffb00088;box-shadow:0 0 10px rgba(255,176,0,0.3);`, _root);
  _btnInteract.className = 'mc-btn'; _btnInteract.innerHTML = '◉<br>INTERACT';
  bindTap(_btnInteract, () => tapKey('KeyE'));

  // BACK / PAUSE (Esc) — top-left.
  _btnBack = el('button',
    `left:max(16px,env(safe-area-inset-left));top:max(14px,env(safe-area-inset-top));width:50px;height:50px;font-size:9px;`, _root);
  _btnBack.className = 'mc-btn mc-pill'; _btnBack.innerHTML = 'II';
  bindTap(_btnBack, () => tapKey('Escape'));

  // Fullscreen — top-right, offset LEFT of the global music-mute button (right:12,
  // w:38) so the two don't overlap on browsers that support fullscreen (Android).
  _btnFs = el('button',
    `right:max(62px,calc(env(safe-area-inset-right) + 56px));top:max(14px,env(safe-area-inset-top));width:50px;height:50px;font-size:18px;`, _root);
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
  const moveCtx = inGame || inHangar || inInspect;
  show(_moveZone, moveCtx);
  if (!moveCtx && _moveId !== null) { _moveId = null; _vmag = 0; _stick.style.display = 'none'; releaseDir(); }
  // Per-frame movement: combat = point-to-go controller, hangar/designer = cone walk.
  if (_moveId !== null && moveCtx) {
    setDir(inGame ? combatDirKeys(arena) : coneWalkKeys());
  }

  // Combat-only buttons.
  show(_btnBoost,  inGame);
  show(_btnShield, inGame);
  show(_btnFire,   inGame);
  if (!inGame) {              // safety: drop any stuck holds when leaving combat
    if (_btnBoost.dataset.on)  { key('ShiftLeft', false); delete _btnBoost.dataset.on; }
    if (_btnShield.dataset.on) { key('KeyQ', false); delete _btnShield.dataset.on; }
  }

  // Contextual INTERACT/LOOT — near a hangar station OR an arena container.
  const nearHangar = inHangar && hangar && (hangar._nearStation || hangar._nearContainer);
  const nearLoot   = inGame   && arena  && arena._nearContainer;
  // Single orange button carries the action word the game itself computes
  // (MOUNT / EXIT / station name in the hangar, LOOT in combat) — so the hidden
  // "[E] …" keyboard prompt isn't replaced by a vaguer label.
  let interactLabel = null;
  if (nearLoot) interactLabel = 'LOOT';
  else if (nearHangar) {
    const lbl = document.getElementById('hangar-prompt-label');
    interactLabel = (lbl && lbl.textContent.trim()) || 'ENTER';
  }
  if (interactLabel) _btnInteract.innerHTML = '◉<br>' + interactLabel;
  show(_btnInteract, !!interactLabel);

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

// ── Visual split: phone wants a wider view than desktop ────────────────────
// A fixed ArcRotateCamera radius that frames well on a wide monitor feels far
// too zoomed-in on a tall phone (a narrow portrait viewport shows a thin
// horizontal slice). Scenes read this multiplier when building their camera —
// undefined → 1 on desktop, so desktop framing is byte-for-byte unchanged.
// Portrait (the mode that plays best on phone) pulls back the most.
function camZoomFactor() {
  if (!(window.__mobile && window.__mobile.active)) return 1;
  const portrait = window.innerHeight >= window.innerWidth;
  return portrait ? 1.5 : 1.2;
}

// One-time relabel of static menu text that carries a keyboard glyph (the
// dynamic prompts are hidden via the body.mc-touch CSS instead).
function dehintStatic() {
  const md = document.getElementById('menu-designer');
  if (md) md.textContent = 'SELECT TANK';   // was "[ T ] SELECT TANK"
}

// Touch how-to-play, injected into the controls screen where the (now hidden)
// keyboard grid used to be. Explains the finger controls in the game's voice.
function injectTutorial() {
  const panel = document.getElementById('controls-panel');
  const grid  = document.getElementById('controls-grid');
  if (!panel || document.getElementById('mc-tutorial')) return;
  const block = document.createElement('div');
  block.id = 'mc-tutorial';
  block.style.cssText =
    "display:flex;flex-direction:column;gap:13px;margin:6px auto 22px;width:88%;max-width:320px;box-sizing:border-box;" +
    "font-family:'Press Start 2P',monospace;";
  const rows = [
    ['MOVE',   'Drag the left side — the tank turns and drives the way you point.'],
    ['FIRE',   'The turret auto-locks the nearest enemy. Tap FIRE to shoot it.'],
    ['BOOST',  'Hold the BOOST button to dash.'],
    ['SHIELD', 'Hold SHIELD to brace against incoming fire.'],
    ['ACT',    'Tap the orange button to LOOT / MOUNT / ENTER.'],
  ];
  for (const [label, desc] of rows) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:flex-start;gap:10px;text-align:left;line-height:1.55;';
    r.innerHTML =
      `<span style="flex:0 0 58px;color:#00eedd;font-size:9px;letter-spacing:1px;text-shadow:0 0 8px rgba(0,238,221,0.4)">${label}</span>` +
      `<span style="flex:1;color:#9fb6b3;font-size:8px;letter-spacing:0.4px">${desc}</span>`;
    block.appendChild(r);
  }
  (grid || panel.firstChild).insertAdjacentElement?.('afterend', block) ?? panel.appendChild(block);
}

// ── Public entry — call once from main.js. No-op on non-touch (desktop safe).
export function initMobileControls() {
  if (!touchDevice()) return;          // desktop / no touch → nothing injected
  document.body.classList.add('mc-touch'); // gates the keyboard-hint CSS overrides
  injectMeta();
  injectStyles();
  buildDom();
  dehintStatic();
  injectTutorial();
  startContextLoop();
  window.__mobile = { refresh, key, active: true, version: 2 }; // debug hook (mirrors __arena/__hangar)
  window.__camZoom = camZoomFactor;    // scenes multiply their camera radius by this (1 on desktop)
  console.log('[MobileControls] touch layer active (additive — keyboard untouched)');
}
