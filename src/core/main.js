import { Engine } from '@babylonjs/core';
import ArenaScene        from '../world/ArenaScene.js';
import TankDesignerScene from '../hub/TankDesignerScene.js';
import HangarScene       from '../hub/HangarScene.js';
import { getBankedSalvage } from './runState.js';
import { audio } from './audio/AudioManager.js';
import { music } from './audio/MusicManager.js';
import { WORLD1 } from '../world/zones/world1.js';
import { generateRoadLeg } from '../world/zones/roadLeg.js';
import { initMobileControls } from './MobileControls.js';

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

// Boot the audio engine (Babylon Audio Engine v2). Loads sounds now; the browser
// grants playback on the first user gesture (the START / deploy click).
audio.init();
window.__audio = audio; window.__music = music; // debug hooks (mirror __arena/__hangar)
// COLD BOOT: the title opens on a retro CRT boot screen. The first gesture
// (ENTER / click) "powers on" the rig — this is also the user gesture the browser
// requires to unlock audio (autoplay policy: a fresh load can never auto-play).
// Power-on resumes the context, swells the menu theme, runs the CRT flourish,
// then reveals the menu. A second ENTER on the menu deploys (see keydown handler).
let _booted = false;
function powerOn() {
  if (_booted) return;
  _booted = true;
  const boot = document.getElementById('cold-boot');
  if (boot) {
    boot.classList.add('powering');
    setTimeout(() => {
      boot.style.display = 'none';
      window.__state = 'MENU';
      const sb = document.getElementById('settings-btn');
      if (sb) sb.style.display = 'flex';   // reveal the cog now the rig is on
      music.playMenu();   // audio starts once the boot has cleared (the gesture already resumed the context)
    }, 450);
  } else {
    window.__state = 'MENU';
    music.playMenu();
  }
}
window.addEventListener('pointerdown', () => { if (window.__state === 'BOOT') powerOn(); });

// Persistent AUDIO SETTINGS (top-right corner, all screens). A gear opens a small
// panel with Music + SFX volume sliders and a music-mute toggle; everything saves
// to localStorage. M still toggles music mute directly (quick + convenient).
const MUSIC_VOL_KEY = 'tk_music_vol', SFX_VOL_KEY = 'tk_sfx_vol', MUTE_KEY = 'tk_music_muted';

// Apply persisted values on boot (defaults match the engine: music 0.55, sfx 0.90).
const _mv = parseFloat(localStorage.getItem(MUSIC_VOL_KEY));
const _sv = parseFloat(localStorage.getItem(SFX_VOL_KEY));
const _musicVol0 = Number.isFinite(_mv) ? _mv : 0.55;
const _sfxVol0   = Number.isFinite(_sv) ? _sv : 0.90;
music.setMasterVolume(_musicVol0);
audio.setBusVolume('sfx', _sfxVol0);
if (localStorage.getItem(MUTE_KEY) === '1') music.setMuted(true);

const _settingsBtn = document.createElement('button');
_settingsBtn.id = 'settings-btn';
_settingsBtn.title = 'Audio settings';
// Chunky pixel-art cog (inline SVG, crisp edges) — toylike + retro, on-brand with
// the Press Start 2P / Tron UI. An octagonal hub RING (2px walls, 4×4 hole) with
// four protruding teeth (N/S/E/W) on a 16-unit grid — the visible hole is what
// reads as a gear rather than a solid disc.
_settingsBtn.innerHTML =
  '<svg viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" fill="#4fd6ff" aria-hidden="true">' +
    '<rect x="6" y="2" width="4" height="2"/>' +   // N tooth
    '<rect x="6" y="12" width="4" height="2"/>' +  // S tooth
    '<rect x="2" y="6" width="2" height="4"/>' +   // W tooth
    '<rect x="12" y="6" width="2" height="4"/>' +  // E tooth
    '<rect x="5" y="4" width="6" height="1"/>' +   // ring: top (beveled)
    '<rect x="4" y="5" width="8" height="1"/>' +   // ring: top
    '<rect x="4" y="6" width="2" height="4"/>' +   // ring: left wall
    '<rect x="10" y="6" width="2" height="4"/>' +  // ring: right wall
    '<rect x="4" y="10" width="8" height="1"/>' +  // ring: bottom
    '<rect x="5" y="11" width="6" height="1"/>' +  // ring: bottom (beveled)
  '</svg>';
_settingsBtn.style.cssText =
  'position:fixed;top:12px;right:12px;z-index:9999;width:38px;height:38px;border-radius:8px;' +
  'border:1px solid rgba(79,214,255,.4);background:rgba(10,13,18,.6);' +
  'cursor:pointer;backdrop-filter:blur(4px);padding:0;display:flex;align-items:center;justify-content:center;';
// playful spring-y quarter-turn on hover (toy feel)
const _settingsStyle = document.createElement('style');
_settingsStyle.textContent =
  '#settings-btn svg{display:block;transition:transform .35s cubic-bezier(.34,1.56,.64,1)}' +
  '#settings-btn:hover svg{transform:rotate(45deg)}';
document.head.appendChild(_settingsStyle);

const _settingsPanel = document.createElement('div');
_settingsPanel.id = 'settings-panel';
_settingsPanel.style.cssText =
  'position:fixed;top:58px;right:12px;z-index:9999;display:none;width:208px;padding:14px 16px;' +
  'border-radius:10px;border:1px solid rgba(79,214,255,.4);background:rgba(10,13,18,.92);' +
  'backdrop-filter:blur(6px);color:#cdd6e2;font-family:"Press Start 2P",monospace;box-shadow:0 6px 24px rgba(0,0,0,.5);';
_settingsPanel.innerHTML =
  '<div style="font-size:9px;letter-spacing:2px;color:#4fd6ff;margin-bottom:14px;">AUDIO</div>' +
  '<label style="display:block;font-size:7px;letter-spacing:1px;margin-bottom:6px;">MUSIC</label>' +
  '<input id="set-music-vol" type="range" min="0" max="100" step="1" style="width:100%;accent-color:#4fd6ff;margin-bottom:14px;">' +
  '<label style="display:block;font-size:7px;letter-spacing:1px;margin-bottom:6px;">SFX</label>' +
  '<input id="set-sfx-vol" type="range" min="0" max="100" step="1" style="width:100%;accent-color:#4fd6ff;margin-bottom:16px;">' +
  '<button id="set-mute" style="width:100%;font-family:inherit;font-size:8px;letter-spacing:1px;padding:8px;border-radius:6px;cursor:pointer;border:1px solid rgba(79,214,255,.4);background:transparent;color:#cdd6e2;"></button>' +
  '<div style="font-size:6px;color:#7f8da0;margin-top:8px;text-align:center;letter-spacing:1px;">M = QUICK MUTE</div>';

document.body.appendChild(_settingsBtn);
document.body.appendChild(_settingsPanel);
_settingsBtn.style.display = 'none';   // hidden during cold boot; revealed on power-on

const _musicSlider = _settingsPanel.querySelector('#set-music-vol');
const _sfxSlider   = _settingsPanel.querySelector('#set-sfx-vol');
const _muteBtn     = _settingsPanel.querySelector('#set-mute');
_musicSlider.value = Math.round(_musicVol0 * 100);
_sfxSlider.value   = Math.round(_sfxVol0 * 100);

const _renderMute = () => {
  _muteBtn.textContent = music.muted ? '🔇 MUSIC MUTED' : '🔊 MUSIC ON';
  _muteBtn.style.opacity = music.muted ? '0.7' : '1';
  _settingsBtn.style.opacity = music.muted ? '0.55' : '1'; // dim the gear when muted
};
// Unmuting should make music play *now*, not on the next scene change — the music
// graph starts lazily, so re-kick the current state's theme (idempotent _switch).
// (Mobile-session fix, preserved across the merge with the settings panel.)
function _kickMusicForState() {
  try {
    const s = window.__state;
    if (s === 'HANGAR' || s === 'INSPECTOR') music.playHangar();
    else if (s === 'GAME' || s === 'PAUSED') music.playCombat();
    else music.playMenu();
  } catch (e) { console.warn('[music] unmute kick failed:', e); }
}
function _toggleMusicMute() {
  const m = music.toggleMuted();
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  _renderMute();
  if (!m) _kickMusicForState();   // just unmuted → start/keep the right theme audible
}

_musicSlider.addEventListener('input', () => {
  const v = _musicSlider.value / 100;
  music.setMasterVolume(v);
  localStorage.setItem(MUSIC_VOL_KEY, String(v));
  if (music.muted && v > 0) _toggleMusicMute(); // raising music volume un-mutes
});
_sfxSlider.addEventListener('input', () => {
  const v = _sfxSlider.value / 100;
  audio.setBusVolume('sfx', v);
  localStorage.setItem(SFX_VOL_KEY, String(v));
});
_muteBtn.addEventListener('click', (e) => { e.stopPropagation(); _toggleMusicMute(); });

_settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  _settingsPanel.style.display = _settingsPanel.style.display === 'none' ? 'block' : 'none';
});
window.addEventListener('click', (e) => { // click-away closes the panel
  if (_settingsPanel.style.display === 'block' && !_settingsPanel.contains(e.target) && e.target !== _settingsBtn)
    _settingsPanel.style.display = 'none';
});
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') _toggleMusicMute(); });
_renderMute();

// Stop all arena loops (engine, shield, pooled enemy whirs/skitters) when leaving
// or rebuilding the arena, so they don't bleed into the hangar/menu.
function silenceArena() {
  audio.releaseAllPooled();
  audio.stopLoop('tank.engine');
  audio.stopLoop('tank.shield_loop');
  audio.stopLoop('amb.sea');
}

// UI sounds — delegated so it covers menu buttons shown/hidden at runtime.
// hover on entering any button; click → confirm for go-forward actions, else select.
let _uiHover = null;
document.addEventListener('pointerover', (e) => {
  const b = e.target.closest('button');
  if (b && b !== _uiHover) { _uiHover = b; audio.play('ui.hover'); }
  else if (!b) _uiHover = null;
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  // deploy = the one weighty "commit to a run" action → the multi-note jingle.
  // everything else (resume, restart, menu, close, return) = single interact blip.
  audio.play(/deploy/.test(b.id || '') ? 'ui.confirm' : 'ui.interact');
});

let arenaScene    = null;
let designerScene = null;
let hangarScene   = null;
let controlsSeen  = false;   // HOW-TO-PLAY shows on the first arena entry per session only

window.__state = 'BOOT'; // 'BOOT' | 'MENU' | 'HANGAR' | 'GAME' | 'PAUSED' | 'DEAD' | 'CONTROLS' | 'INSPECTOR'

// Additive touch layer for phone playtesting. No-op on non-touch devices; never
// modifies a keyboard handler (it dispatches the game's own key events). See
// MobileControls.js. Pass ?touch=1 to force it on desktop for testing.
initMobileControls();

// ── Transition engine ────────────────────────────────────────────────────────
const _tc   = document.getElementById('transition-canvas');
const _tctx = _tc.getContext('2d');
let   _tBusy = false;
let   _tWatchdog = null;
// A transition must never lock the UI permanently. If one stalls (e.g. tapping
// Play before the first frame settles), force-clear the cover + release the lock
// so the next tap works. iris/checker finish in <1s, so 2s is a safe ceiling.
function _clearTransition() {
  clearTimeout(_tWatchdog);
  _tBusy = false;
  try { _tctx.clearRect(0, 0, _tc.width, _tc.height); } catch (_) {}
  _tc.style.display = 'none';
}

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
      try { hideFn(); showFn(); } catch (e) { console.error('[transition] swap failed:', e); }
      phase = 'open'; start = null;
      requestAnimationFrame(tick);
    } else {
      _tctx.clearRect(0, 0, W, H);
      _tc.style.display = 'none';
      clearTimeout(_tWatchdog);
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
      try { hideFn(); showFn(); } catch (e) { console.error('[transition] swap failed:', e); }
      phase = 'out'; start = null;
      order.sort(() => Math.random() - 0.5); // re-shuffle for reveal
      requestAnimationFrame(tick);
    } else {
      _tctx.clearRect(0, 0, W, H);
      _tc.style.display = 'none';
      clearTimeout(_tWatchdog);
      _tBusy = false;
    }
  }
  requestAnimationFrame(tick);
}

function transition(hideFn, showFn, type = 'checker') {
  if (_tBusy) return;
  _tBusy = true;
  clearTimeout(_tWatchdog);
  _tWatchdog = setTimeout(_clearTransition, 2000); // never lock the UI permanently
  _resizeTC();
  if (type === 'iris') _iris(hideFn, showFn);
  else                 _checker(hideFn, showFn);
}

function startGame() {
  audio.play('ui.interact'); // keyboard-driven start (single blip; may revisit later)
  music.playShutter();       // iris/aperture whoosh under the wipe
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
      music.playCombat();
      arenaScene._paused = true;
      window.__state = 'CONTROLS';
      document.getElementById('controls-screen').style.display = 'flex';
    },
    'iris'
  );
}

function startHangar() {
  music.playShutter();       // iris/aperture whoosh under the wipe
  transition(
    () => {
      document.getElementById('menu').style.display          = 'none';
      document.getElementById('death').style.display         = 'none';
      document.getElementById('hud').style.display           = 'none';
      document.getElementById('hangar-prompt').style.display = 'none';
      document.getElementById('hangar-panel').style.display  = 'none';
      engine.stopRenderLoop();
      silenceArena();
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
      audio.startLoop('amb.hangar'); // warm hangar room tone (2D)
      music.playHangar();
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
  // Loading-screen title/sub/tip reflect the destination (reset for World 1 in
  // case a prior dev deploy changed them).
  if (dev) {
    document.getElementById('deploy-loading-title').textContent = 'DEV ARENA';
    document.getElementById('deploy-loading-sub').textContent   = 'ENEMY TESTING';
    document.getElementById('deploy-tip').textContent           = 'SANDBOX — TEST ENEMIES & MECHANICS';
  } else {
    document.getElementById('deploy-loading-title').textContent = 'WORLD 1';
    document.getElementById('deploy-loading-sub').textContent   = 'GREEN FIELDS';
    document.getElementById('deploy-tip').textContent =
      DEPLOY_TIPS[Math.floor(Math.random() * DEPLOY_TIPS.length)];
  }
  lo.classList.remove('done');
  lo.style.opacity = '1';
  lo.style.display = 'flex';

  document.getElementById('hangar-prompt').style.display  = 'none';
  document.getElementById('hangar-panel').style.display   = 'none';
  document.getElementById('hangar-salvage').style.display = 'none';
  engine.stopRenderLoop();
  audio.stopLoop('amb.hangar');
  music.stop();  // cut hangar music for the loading screen; combat music starts on drop-in
  if (hangarScene) { hangarScene.dispose(); hangarScene = null; }

  // Build on the next frame so the overlay paints before the heavy work starts.
  requestAnimationFrame(() => {
    canvas.style.display = 'block';
    try {
      arenaScene = new ArenaScene(engine, onExtractFromArena, dev ? undefined : makeRoadZone());
    } catch (e) {
      console.error('[deploy] ArenaScene construction failed:', e);
      throw e;
    }
    window.__arena = arenaScene;

    const MIN_MS = 900;   // let the loading screen breathe even on instant loads
    const t0 = performance.now();
    arenaScene.ready.then(() => {
      lo.classList.add('done');   // bar snaps full
      const wait = Math.max(250, MIN_MS - (performance.now() - t0));
      setTimeout(() => {
        document.getElementById('hud').style.display = 'block';
        engine.runRenderLoop(() => arenaScene.scene.render());
        audio.play('ui.wave_start'); // dropped into combat
        if (dev) music.playArena();  // dev test arena gets its own "Test Chamber" track
        else     music.playCombat(); // World 1 keeps the combat theme

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
  music.stop();              // world/combat music ends when the extract overlay appears
  music.playExtract();       // Duckov-style reward jingle on the extract summary (over the fade)
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
  document.getElementById('extract-indicator').style.display = 'none'; // sweep the extraction bar
  document.getElementById('extract-summary').style.display = 'none';   // and the summary, so neither leaks onto the menu
  canvas.style.display = 'none';
  engine.stopRenderLoop();
  if (arenaScene) { arenaScene._paused = false; arenaScene._restart(); }
  if (hangarScene) { hangarScene.dispose(); hangarScene = null; }
  silenceArena(); // after _restart (which restarts engine) so the menu is quiet
  audio.stopLoop('amb.hangar');
  audio.resumeAll(0); // undo any pause fade so menu audio isn't left muted
  music.playMenu();
  music.playCrtOff();        // power-down whine + thunk, synced to the CRT-off visual
  overlay.classList.add('playing');
  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('playing');
    document.getElementById('menu').style.display = 'flex';
    window.__state = 'MENU';
  }, { once: true });
}

function startDesigner() {
  music.playRetro();         // 8-bit blip cascade under the checker/pixelated wipe
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
  music.playRetro();         // 8-bit blip cascade under the checker/pixelated wipe
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
  // Cold boot: ENTER / SPACE powers on the rig (and unlocks audio) → menu.
  if (window.__state === 'BOOT') {
    if (e.code === 'Enter' || e.code === 'Space') powerOn();
    return;
  }
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
  music.fadeResume(); // un-freeze + ramp the soundtrack back up
  audio.resumeAll();  // fade engine + ambience + sfx back to their levels
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
  audio.resumeAll(0);  // undo the pause fade so the restarted run isn't muted
  arenaScene._paused = false;
  arenaScene._restart();
  music.restart(); // soundtrack restarts from the top with the run
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
  music.restart(); // replay whatever track was playing (combat or dev arena), from the top
  window.__state = 'GAME';
});

function autoPause() {
  if (window.__state !== 'GAME') return;
  window.__state = 'PAUSED';
  if (arenaScene) arenaScene._paused = true;
  music.fadePause();   // ramp soundtrack down, then freeze it (resumes from the same bar)
  audio.pauseAll();    // fade engine + ambience + all sfx loops to silence
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

// Controls tab: lock-on is disabled (planned future module), so strip its rows
// and document the shield (Q) in their place. index.html is owned by a parallel
// session, so patch the DOM here.
(() => {
  for (const row of document.querySelectorAll('#controls-screen .ctrl-row')) {
    const desc = row.querySelector('.ctrl-desc')?.textContent || '';
    if (/lock on|locked target/i.test(desc)) row.remove();
  }
  const cols = [...document.querySelectorAll('#controls-screen .controls-col')];
  const combatCol = cols.find(c =>
    /COMBAT/i.test(c.querySelector('.ctrl-section-title')?.textContent || ''));
  if (combatCol) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.innerHTML = '<span class="key">Q</span><span class="ctrl-desc">Shield (hold ground)</span>';
    combatCol.appendChild(row);
  }

  // Move the in-arena run-salvage readout to the screen's top-left (it ships
  // absolutely-positioned inside the bottom-left #hud, overlapping the bars).
  // Done once at load so it's correct on spawn even while paused on the controls
  // screen (the in-loop reposition didn't run until you unpaused).
  const sal = document.getElementById('hud-salvage');
  if (sal) {
    sal.style.position = 'fixed';
    sal.style.top      = '18px';
    sal.style.left     = '24px';
    sal.style.right    = 'auto';
  }

  // The bottom-left meter now powers boost AND the shield (and future modules),
  // so it's the tank's shared ENERGY pool, not just "boost".
  const fuelLabel = document.getElementById('hud-label');
  if (fuelLabel) fuelLabel.textContent = 'ENERGY';
})();

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
let _driverCfg = null;   // latest synced driver config — read by the Bedroll toggle
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
  // Slot-row builder (None + items, + the Bedroll add-on toggle on the back slot).
  const SLOT_LABELS = { face: 'Eyewear', facialhair: 'Facial Hair', hair: 'Hair', headwear: 'Headwear', back: 'Back' };
  const section = (title) => {
    const s = document.createElement('div');
    s.className = 'lng-section';
    s.id = 'lng-sec-' + title.toLowerCase();   // lng-sec-body / lng-sec-head (matches pick regions)
    s.textContent = title;
    host.appendChild(s);
  };
  const buildSlot = (slot) => {
    const items = _wardrobe.slots[slot];
    if (!items) return;
    const btns = row(SLOT_LABELS[slot] ?? (slot[0].toUpperCase() + slot.slice(1)));
    mkBtn(btns, 'None', { gid: 'none', slot }, () => {
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ [slot]: 'none' }));
    });
    for (const it of items) {
      addGrouped(btns, it, id => {
        if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ [slot]: id }));
      });
    }
    if (slot === 'back') {
      // Bedroll is a satchel add-on, not a standalone piece — a toggle that only
      // works while the Satchel is equipped (disabled + auto-dropped otherwise).
      const b = document.createElement('button');
      b.textContent = 'Bedroll';
      b.dataset.bedroll = '1';
      b.addEventListener('click', () => {
        if (!hangarScene) return;
        const on = (_driverCfg?.bedroll ?? 'none') !== 'none';
        syncCrewPanel(hangarScene.setDriverConfig({ bedroll: on ? 'none' : 'back-bedroll' }));
      });
      btns.appendChild(b);
    }
  };
  // Grouped into sections so the panel reads cleanly (Skin sits up top as the base).
  section('BODY');
  const br = row('Outfit');
  for (const it of _wardrobe.bodies ?? []) {
    addGrouped(br, it, id => {
      // outfit drives head+body together (unified character — no head grafting)
      if (hangarScene) syncCrewPanel(hangarScene.setDriverConfig({ character: id }));
    });
  }
  buildSlot('back');
  section('HEAD');
  buildSlot('hair');
  buildSlot('facialhair');
  buildSlot('headwear');
  buildSlot('face');
}
function syncCrewPanel(cfg) {
  _driverCfg = cfg;
  const bedBtn = document.querySelector('#lounge-slots [data-bedroll]');
  if (bedBtn) {
    const hostOn = cfg.back === 'back-satchel';   // bedroll only rides the satchel
    bedBtn.disabled = !hostOn;
    bedBtn.style.opacity = hostOn ? '' : '0.4';
    bedBtn.classList.toggle('on', hostOn && (cfg.bedroll ?? 'none') !== 'none');
  }
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

// Click-on-part nav: the hangar fires 'crewpart' (region = head|body) when the
// player clicks a body region of the driver → scroll that panel section in + pulse it.
window.addEventListener('crewpart', (e) => {
  const sec = document.getElementById('lng-sec-' + e.detail.region);
  if (!sec) return;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  sec.classList.remove('lng-pulse');
  void sec.offsetWidth;          // restart the animation
  sec.classList.add('lng-pulse');
});

window.addEventListener('resize', () => engine.resize());
