import { Engine } from '@babylonjs/core';
import ArenaScene        from './scenes/ArenaScene.js';
import TankDesignerScene from './scenes/TankDesignerScene.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

let arenaScene    = null;
let designerScene = null;

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
  document.getElementById('controls-screen').style.display = 'flex';
}

function dismissControls() {
  const el = document.getElementById('controls-screen');
  if (el.style.display === 'none') return;
  el.style.display = 'none';
  if (arenaScene) arenaScene._paused = false;
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
}

document.addEventListener('keydown', (e) => {
  // Controls screen intercepts Enter/Space — dismiss before anything else
  if (document.getElementById('controls-screen').style.display === 'flex') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') dismissControls();
    return;
  }
  if (document.getElementById('menu').style.display !== 'none') {
    if (e.code === 'Enter') startGame();
    if (e.code === 'KeyT')  startDesigner();
  }
  if (e.code === 'Escape' && document.getElementById('designer-ui').style.display !== 'none') {
    exitDesigner();
  }
});

document.getElementById('controls-start').addEventListener('click', dismissControls);

document.getElementById('menu-designer').addEventListener('click', startDesigner);

document.getElementById('pause-menu').addEventListener('click', goToMenu);
document.getElementById('death-menu').addEventListener('click',  goToMenu);

function autoPause() {
  if (!arenaScene || arenaScene._paused) return;
  if (document.getElementById('menu').style.display !== 'none') return;
  arenaScene._paused = true;
  document.getElementById('pause').style.display = 'flex';
}

document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);
setInterval(() => { if (!document.hidden && !document.hasFocus()) autoPause(); }, 300);

window.addEventListener('resize', () => engine.resize());
