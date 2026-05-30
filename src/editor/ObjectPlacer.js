import { Color3, PointerEventTypes, HighlightLayer } from '@babylonjs/core';
import { createPrefab } from './Prefabs.js';

function findRoot(mesh) {
  let n = mesh;
  while (n && !n.metadata?.prefabType) n = n.parent;
  return n ?? null;
}

export default class ObjectPlacer {
  constructor(scene, shadowGen, obstacles) {
    this._scene     = scene;
    this._shadowGen = shadowGen;
    this._obstacles = obstacles;
    this._placed    = [];
    this._selectedType = null;
    this._selectedRoot = null;
    this._dragging     = false;
    this._active       = false;

    this._hl = new HighlightLayer('editorHL', scene);
    this._hl.innerGlow = false;

    this._setupPointer();
    this._setupKeys();
  }

  _setupPointer() {
    this._scene.onPointerObservable.add((info) => {
      if (!this._active) return;

      if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 0) {
        if (this._selectedType) {
          this._placeAt();
        } else {
          this._trySelect();
          this._dragging = !!this._selectedRoot;
        }
      }

      if (info.type === PointerEventTypes.POINTERMOVE && this._dragging && this._selectedRoot) {
        const pick = this._scene.pick(
          this._scene.pointerX, this._scene.pointerY,
          m => m.name === 'terrain',
        );
        if (pick.hit) {
          this._selectedRoot.position.x = pick.pickedPoint.x;
          this._selectedRoot.position.z = pick.pickedPoint.z;
        }
      }

      if (info.type === PointerEventTypes.POINTERUP) {
        this._dragging = false;
      }
    });
  }

  _setupKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this._active) return;

      if (e.code === 'KeyR' && this._selectedRoot) {
        this._selectedRoot.rotation.y += Math.PI / 4;
      }

      if (e.code === 'Delete' && this._selectedRoot) {
        this._removeSelected();
      }
    });
  }

  _placeAt() {
    const pick = this._scene.pick(
      this._scene.pointerX, this._scene.pointerY,
      m => m.name === 'terrain',
    );
    if (!pick.hit) return;

    const root = createPrefab(this._selectedType, this._scene);
    root.position.set(pick.pickedPoint.x, pick.pickedPoint.y, pick.pickedPoint.z);

    this._placed.push(root);
    this._obstacles.push({ position: root.position, halfW: root.metadata.halfW, halfD: root.metadata.halfD });
    root.getChildMeshes().forEach(m => {
      this._shadowGen.addShadowCaster(m);
      m.receiveShadows = true;
    });
  }

  _trySelect() {
    const pick = this._scene.pick(
      this._scene.pointerX, this._scene.pointerY,
      m => !!findRoot(m),
    );
    const root = pick.hit ? findRoot(pick.pickedMesh) : null;
    this._setSelectedRoot(root);
  }

  _setSelectedRoot(root) {
    if (this._selectedRoot) {
      this._selectedRoot.getChildMeshes().forEach(m => this._hl.removeMesh(m));
    }
    this._selectedRoot = root;
    if (root) {
      root.getChildMeshes().forEach(m => this._hl.addMesh(m, Color3.White()));
    }
  }

  _removeSelected() {
    const root = this._selectedRoot;
    if (!root) return;

    const obsIdx = this._obstacles.findIndex(o => o.position === root.position);
    if (obsIdx !== -1) this._obstacles.splice(obsIdx, 1);

    this._placed.splice(this._placed.indexOf(root), 1);
    root.getChildMeshes().forEach(m => { this._hl.removeMesh(m); m.dispose(); });
    root.dispose();
    this._selectedRoot = null;
  }

  selectType(type) {
    this._selectedType = type;
    if (type) this._setSelectedRoot(null);
  }

  activate() {
    this._active = true;
  }

  deactivate() {
    this._active = false;
    this._dragging = false;
    this._setSelectedRoot(null);
  }

  getPlacedData() {
    return this._placed.map(r => ({
      type: r.metadata.prefabType,
      x: r.position.x, y: r.position.y, z: r.position.z,
      ry: r.rotation.y,
    }));
  }

  loadObjects(objects) {
    for (const obj of objects) {
      const root = createPrefab(obj.type, this._scene);
      root.position.set(obj.x, obj.y ?? 0, obj.z);
      root.rotation.y = obj.ry ?? 0;
      this._placed.push(root);
      this._obstacles.push({ position: root.position, halfW: root.metadata.halfW, halfD: root.metadata.halfD });
      root.getChildMeshes().forEach(m => {
        this._shadowGen.addShadowCaster(m);
        m.receiveShadows = true;
      });
    }
  }

  clearAll() {
    for (const root of [...this._placed]) {
      const obsIdx = this._obstacles.findIndex(o => o.position === root.position);
      if (obsIdx !== -1) this._obstacles.splice(obsIdx, 1);
      root.getChildMeshes().forEach(m => m.dispose());
      root.dispose();
    }
    this._placed = [];
    this._selectedRoot = null;
  }
}
