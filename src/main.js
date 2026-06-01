import { Engine } from '@babylonjs/core';
import ArenaScene        from './scenes/ArenaScene.js';
import TankDesignerScene from './scenes/TankDesignerScene.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });

let arenaScene    = null;
let designerScene = null;

// Single source of truth for which screen is active.
// All event handlers read this instead of checking DOM styles.
window.__state = 'MENU'; // 'MENU' | 'GAME' | 'PAUSED' | 'DEAD' | 'CONTROLS' | 'INSPECTOR'

function startGame() {
  canvas.style.display = 'block';
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display  = 'block';

  if (!arenaScene) {
    arenaScene = new ArenaScene(engine);
    window.__arena = arenaScene;
  } else {
    arenaScene._restart();
  }
  engine.runRenderLoop(() => arenaScene.scene.render());

  // Pause and show controls before the player engages
  arenaScene._paused = true;
  window.__state = 'CONTROLS';
  document.getElementById('controls-screen').style.display = 'flex';
}

function dismissControls() {
  if (window.__state !== 'CONTROLS') return;
  document.getElementById('controls-screen').style.display = 'none';
  if (arenaScene) arenaScene._paused = false;
  window.__state = 'GAME';
}

function goToMenu() {
  const overlay = document.getElementById('crt-off');
  if (overlay.classList.contains('playing')) return;
  // Hide everything immediately — white flash masks the cut, collapse plays over black
  document.getElementById('pause').style.display = 'none';
  document.getElementById('death').style.display = 'none';
  document.getElementById('hud').style.display   = 'none';
  canvas.style.display = 'none';
  overlay.classList.add('playing');
  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('playing');
    engine.stopRenderLoop();
    if (arenaScene) {
      arenaScene._paused = false;
      arenaScene._restart();
    }
    document.getElementById('menu').style.display = 'flex';
    window.__state = 'MENU';
  }, { once: true });
}

function startDesigner() {
  engine.stopRenderLoop();
  document.getElementById('menu').style.display   = 'none';
  document.getElementById('hud').style.display    = 'none';
  canvas.style.display = 'block';
  document.getElementById('designer-ui').style.display       = 'flex';
  document.getElementById('designer-vignette').style.display = 'block';
  document.getElementById('designer-sidebar').style.display  = 'flex';
  window.__state = 'INSPECTOR';

  if (!designerScene) designerScene = new TankDesignerScene(engine, exitDesigner);
  engine.runRenderLoop(() => designerScene.scene.render());
}

function exitDesigner() {
  engine.stopRenderLoop();
  document.getElementById('designer-ui').style.display       = 'none';
  document.getElementById('designer-vignette').style.display = 'none';
  document.getElementById('designer-sidebar').style.display  = 'none';
  canvas.style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  window.__state = 'MENU';
  if (designerScene) { designerScene.dispose(); designerScene = null; }
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

document.getElementById('controls-start').addEventListener('click', dismissControls);

document.getElementById('menu-designer').addEventListener('click', startDesigner);

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
