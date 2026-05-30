import TerrainEditor from './TerrainEditor.js';
import ObjectPlacer  from './ObjectPlacer.js';
import { saveLayout, loadLayout, clearLayout } from './SceneSerializer.js';

export default class LevelEditor {
  constructor(scene, terrainMesh, shadowGen, obstacles, { onActivate, onDeactivate }) {
    this._scene        = scene;
    this._active       = false;
    this._mode         = 'terrain'; // 'terrain' | 'objects'
    this._onActivate   = onActivate;
    this._onDeactivate = onDeactivate;

    this.terrainEditor = new TerrainEditor(scene, terrainMesh);
    this.objectPlacer  = new ObjectPlacer(scene, shadowGen, obstacles);

    this._buildUI();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  toggle() {
    this._active ? this._deactivate() : this._activate();
  }

  applyLayout(data) {
    if (data.terrain) this.terrainEditor.loadHeightData(data.terrain);
    if (data.objects) this.objectPlacer.loadObjects(data.objects);
  }

  // ── Activate / deactivate ────────────────────────────────────────────────

  _activate() {
    this._active = true;
    this._onActivate();
    this._setMode('terrain');
    document.getElementById('editor-ui').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  }

  _deactivate() {
    this._active = false;
    this.terrainEditor.deactivate();
    this.objectPlacer.deactivate();
    this._onDeactivate();
    document.getElementById('editor-ui').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
  }

  // ── Mode switching ───────────────────────────────────────────────────────

  _setMode(mode) {
    this._mode = mode;

    this.terrainEditor.deactivate();
    this.objectPlacer.deactivate();

    const terrBtn = document.getElementById('editor-terrain-btn');
    const objBtn  = document.getElementById('editor-objects-btn');
    const palette = document.getElementById('editor-palette');
    const hint    = document.getElementById('editor-hint');

    if (mode === 'terrain') {
      this.terrainEditor.activate();
      terrBtn.classList.add('active');
      objBtn.classList.remove('active');
      palette.style.display = 'none';
      hint.style.display    = 'block';
      hint.textContent      = 'click a yellow node to select   |   UP / DOWN arrows to raise / lower   |   SHIFT for fine control';
    } else {
      this.objectPlacer.activate();
      terrBtn.classList.remove('active');
      objBtn.classList.add('active');
      palette.style.display = 'flex';
      hint.style.display    = 'none';
      // Reset palette selection
      document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
      this.objectPlacer.selectType(null);
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  _buildUI() {
    document.getElementById('editor-terrain-btn').addEventListener('click', () => this._setMode('terrain'));
    document.getElementById('editor-objects-btn').addEventListener('click', () => this._setMode('objects'));

    document.getElementById('editor-exit-btn').addEventListener('click', () => this._deactivate());

    document.getElementById('editor-save-btn').addEventListener('click', () => this._save());

    document.getElementById('editor-clear-btn').addEventListener('click', () => {
      if (!confirm('Remove all placed objects?')) return;
      this.objectPlacer.clearAll();
      clearLayout();
    });

    document.getElementById('editor-reset-btn').addEventListener('click', () => {
      if (!confirm('Reset terrain to flat and remove all objects?')) return;
      this.terrainEditor.resetToFlat();
      this.objectPlacer.clearAll();
      clearLayout();
    });

    document.querySelectorAll('.palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const isActive = btn.classList.contains('active');
        document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
        if (!isActive) {
          btn.classList.add('active');
          this.objectPlacer.selectType(type);
        } else {
          this.objectPlacer.selectType(null);
        }
      });
    });

    // S key to save while editor is open
    window.addEventListener('keydown', (e) => {
      if (!this._active || e.code !== 'KeyS') return;
      this._save();
    });
  }

  _save() {
    saveLayout(
      this.terrainEditor.getHeightData(),
      this.objectPlacer.getPlacedData(),
    );
    const btn = document.getElementById('editor-save-btn');
    btn.textContent = 'SAVED';
    setTimeout(() => { btn.textContent = 'SAVE [S]'; }, 1200);
  }
}
