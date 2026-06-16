import { Engine } from '@babylonjs/core';
import ArenaScene        from '../world/ArenaScene.js';
import TankDesignerScene from '../hub/TankDesignerScene.js';
import HangarScene       from '../hub/HangarScene.js';
import { getBankedSalvage } from './runState.js';
import { WORLD1 } from '../world/zones/world1.js';
import { generateRoadLeg } from '../world/zones/roadLeg.js';

// The Long Road: wrap a generated leg into an ArenaScene-compatible zone. Provides the
// generic fields ArenaScene's setup expects (empty enemies/loot, extraction at the
// checkpoint, bounds/spawn/palette) plus roadLeg for the RoadBuilder. Deferred for now:
// enemies-on-road, loot-pickup behaviour, the checkpoint extract menu.
function makeRoadZone(seed = (Date.now() & 0xffff)) {
  const leg = generateRoadLeg(seed);
  return {
    id: 'road-leg', kind: 'road', name: 'THE LONG ROAD — LEG',
    palette: WORLD1.palette,
    bounds: { half: leg.bbox.clampHalf, visual: leg.bbox.clampHalf + 60 },
    spawn: leg.start,   // road's south start (z≈0)
    // chaff scout-bots get placed by POIs (zone.chaff); none seeded by default.
    enemies: leg.enemies, chaff: leg.chaff ?? [], loot: leg.loot, containers: leg.containers, bandTuning: WORLD1.bandTuning,
    extraction: { x: leg.checkpoint.x, z: leg.checkpoint.z, radius: 6 },
    // boundary corridor: stay within `half` of the road centerline (sides + front), and a
    // hard wall right behind spawn (southLimit) — no reversing down the approach you came in on.
    corridor: { centerline: leg.centerline, half: 50, southLimit: leg.start.z - 8 },
    roadLeg: leg,
  };
}

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });

// ── Safari / low-end-GL light fix ────────────────────────────────────────────
// In WebGL2, Babylon gives each light its own uniform-buffer block, so a material
// shader needs (3 base UBOs + N lights) blocks. Safari/WebKit caps the per-stage
// uniform-buffer count low (GL_MAX_VERTEX_UNIFORM_BLOCKS = 12), while Chrome's ANGLE
// allows far more. The glTF loader compounds this: on every GLB load it force-raises
// *every* scene material's maxSimultaneousLights to scene.lights.length (the Hangar
// has 14). On Safari those 14-light shaders blow past the block limit, fail to
// compile, and the bunker renders dark/unlit (Chrome never hits the limit, hiding it).
//
// Fix: when the GPU reports too few vertex uniform blocks for our worst-case light
// count, fall back to Babylon's non-UBO uniform path (no per-stage block limit — only
// the far larger MAX_VERTEX_UNIFORM_VECTORS applies). This compiles every light count
// cleanly with zero shader-recompile thrash and full visual parity with Chrome. It is
// capability-gated (not UA-sniffed), so any low-limit driver is covered too.
const WORST_CASE_UNIFORM_BLOCKS = 17; // 14 lights (Hangar) + Scene/Mesh/Material
const gl2 = canvas.getContext('webgl2');
const maxVertexUniformBlocks = gl2 ? gl2.getParameter(gl2.MAX_VERTEX_UNIFORM_BLOCKS) : 0;
if (maxVertexUniformBlocks && maxVertexUniformBlocks < WORST_CASE_UNIFORM_BLOCKS) {
  engine.disableUniformBuffers = true;
}

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

const DEPLOY_TIPS = [
  'AMBUSHERS HIDE IN THE TALL GRASS — WATCH FOR THE OFF-COLOR PATCHES',
  'EXTRACTION = DRIVE BACK INTO THE TUNNEL AND HOLD THE PAD',
  'LOOT GETS RICHER THE FURTHER NORTH YOU PUSH — SO DO THE PATROLS',
  'THE FLANKS HIDE POINTS OF INTEREST. GREED IS A CHOICE',
  'DIE OUT THERE AND THE RUN\'S SALVAGE STAYS OUT THERE',
  'LOCK-ON (HOLD F) ALERTS THE TARGET — MANUAL AIM KEEPS YOU QUIET',
];

// Deploy uses the loading screen, not the checker transition: the overlay goes
// up instantly, the arena builds + the tank GLB loads behind it (arenaScene.ready),
// then it fades into the world. _tBusy still guards against double-deploys.
// dev=true deploys the development arena (no zone) — a flat sandbox for enemy
// testing. dev=false deploys World 1 (the generated road leg).
function deployToArena(dev = false) {
  if (_tBusy) return;
  _tBusy = true;

  const lo = document.getElementById('deploy-loading');
  document.getElementById('deploy-tip').textContent =
    DEPLOY_TIPS[Math.floor(Math.random() * DEPLOY_TIPS.length)];
  lo.classList.remove('done');
  lo.style.opacity = '1';
  lo.style.display = 'flex';

  document.getElementById('hangar-prompt').style.display  = 'none';
  document.getElementById('hangar-panel').style.display   = 'none';
  document.getElementById('hangar-salvage').style.display = 'none';
  engine.stopRenderLoop();
  if (hangarScene) { hangarScene.dispose(); hangarScene = null; }

  // Build on the next frame so the overlay paints before the heavy work starts.
  requestAnimationFrame(() => {
    canvas.style.display = 'block';
    arenaScene = new ArenaScene(engine, onExtractFromArena, dev ? undefined : makeRoadZone());
    window.__arena = arenaScene;

    const MIN_MS = 900;   // let the loading screen breathe even on instant loads
    const t0 = performance.now();
    arenaScene.ready.then(() => {
      lo.classList.add('done');   // bar snaps full
      const wait = Math.max(250, MIN_MS - (performance.now() - t0));
      setTimeout(() => {
        document.getElementById('hud').style.display = 'block';
        engine.runRenderLoop(() => arenaScene.scene.render());
        // HOW-TO-PLAY controls screen on the FIRST arena entry of the session only.
        if (!controlsSeen) {
          controlsSeen = true;
          arenaScene._paused = true;
          window.__state = 'CONTROLS';
          document.getElementById('controls-screen').style.display = 'flex';
        } else {
          window.__state = 'GAME';
        }
        lo.style.opacity = '0';
        setTimeout(() => { lo.style.display = 'none'; _tBusy = false; }, 500);
      }, wait);
    });
  });
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
  // Long Road: E-loot a POI container (chest) when in range.
  if (window.__state === 'GAME' && e.code === 'KeyE' && arenaScene && arenaScene._nearContainer) {
    arenaScene.lootNearbyContainer();
    return;
  }
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

// Tactical-map DEPLOY → World 1. (Wrap so the click Event isn't passed as `dev`.)
const _deployBtn = document.getElementById('hangar-panel-deploy');
_deployBtn.textContent = 'DEPLOY · WORLD 1';
_deployBtn.addEventListener('click', () => deployToArena(false));

// Second destination: a DEV ARENA button injected next to DEPLOY (index.html is
// owned by a parallel session, so the button is built in JS). HangarScene.openPanel
// toggles its visibility alongside the deploy button.
const _devBtn = document.createElement('button');
_devBtn.id = 'hangar-panel-deploy-dev';
_devBtn.textContent = 'DEV ARENA · TEST';
// Match the deploy/close button look (shared CSS targets fixed IDs, so style
// inline) with an amber "dev/test" accent to set it apart from the red World 1.
_devBtn.style.cssText =
  "display:none;background:transparent;font-family:'Press Start 2P',monospace;" +
  'font-size:9px;padding:10px 20px;cursor:none;letter-spacing:2px;' +
  'border:1px solid #ffb000;color:#ffb000;box-shadow:0 0 8px rgba(255,176,0,0.3);';
_devBtn.addEventListener('mouseenter', () => { _devBtn.style.background = 'rgba(255,176,0,0.1)'; });
_devBtn.addEventListener('mouseleave', () => { _devBtn.style.background = 'transparent'; });
_deployBtn.insertAdjacentElement('afterend', _devBtn);
_devBtn.addEventListener('click', () => deployToArena(true));

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
  // (Preset row removed — character = Outfit + Skin + Hair + Headwear + Face + Back.
  // The old presets loaded the retiring Kenney reference models.)
  const hr = row('Skin');
  for (const hex of _wardrobe.skinTones ?? []) {
    const b = document.createElement('button');
    b.dataset.skin = hex;
    b.style.cssText = `width:22px;height:22px;padding:0;background:${hex};`;
    b.addEventListener('click', () => {
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ skin: hex }));
    });
    hr.appendChild(b);
  }
  const wheel = document.createElement('input');
  wheel.type = 'color';
  wheel.id = 'skin-wheel';
  wheel.value = '#eebb94';
  wheel.style.cssText = 'width:30px;height:24px;padding:0;border:1px solid #00eedd55;background:none;cursor:pointer;';
  wheel.addEventListener('input', () => {
    if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ skin: wheel.value }));
  });
  hr.appendChild(wheel);
  // Grouped item: ONE button per model + small color dots for its variants.
  // Button + dots live in a single .lng-item so they never wrap apart.
  const addGrouped = (btns, it, apply) => {
    if (!it.variants) {
      mkBtn(btns, it.label, { gid: it.id }, () => apply(it.id));
      return;
    }
    const grp = document.createElement('div');
    grp.className = 'lng-item';
    mkBtn(grp, it.label, { gmodel: it.model }, () => apply(it.variants[0].id));
    for (const v of it.variants) {
      const d = document.createElement('button');
      d.dataset.gid = v.id;
      d.title = v.cw;
      d.style.cssText = `width:14px;height:14px;padding:0;border-radius:50%;background:${v.hex};`;
      d.addEventListener('click', () => apply(v.id));
      grp.appendChild(d);
    }
    btns.appendChild(grp);
  };
  const br = row('Outfit');
  for (const it of _wardrobe.bodies ?? []) {
    addGrouped(br, it, id => {
      // outfit drives head+body together (unified character — no head grafting)
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ character: id }));
    });
  }
  for (const [slot, items] of Object.entries(_wardrobe.slots)) {
    const btns = row(slot[0].toUpperCase() + slot.slice(1));
    mkBtn(btns, 'None', { gid: 'none', slot }, () => {
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ [slot]: 'none' }));
    });
    for (const it of items) {
      addGrouped(btns, it, id => {
        if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ [slot]: id }));
      });
    }
  }
}
function syncCrewPanel(cfg) {
  document.querySelectorAll('#lounge-slots [data-skin]').forEach(b =>
    b.classList.toggle('on', b.dataset.skin === cfg.skin));
  const wheel = document.getElementById('skin-wheel');
  if (wheel && typeof cfg.skin === 'string' && /^#[0-9a-f]{6}$/i.test(cfg.skin)) wheel.value = cfg.skin;
  const active = new Set(Object.values(cfg));
  document.querySelectorAll('#lounge-slots [data-gid]').forEach(b =>
    b.classList.toggle('on', active.has(b.dataset.gid)
      || (b.dataset.gid === 'none' && b.dataset.slot && (cfg[b.dataset.slot] ?? 'none') === 'none')));
  document.querySelectorAll('#lounge-slots [data-gmodel]').forEach(b =>
    b.classList.toggle('on', [...active].some(v => typeof v === 'string' && v.startsWith(b.dataset.gmodel))));
}

window.addEventListener('resize', () => engine.resize());
