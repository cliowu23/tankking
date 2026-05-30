import {
  MeshBuilder, StandardMaterial, Color3, Vector3,
  VertexBuffer, VertexData, PointerEventTypes,
} from '@babylonjs/core';

const NODE_COLOR    = new Color3(1.0, 0.88, 0.0);
const NODE_SELECTED = new Color3(1.0, 1.0, 1.0);
const NODE_EMISSIVE = new Color3(0.45, 0.38, 0.0);
const HEIGHT_STEP   = 0.5;
const HEIGHT_FINE   = 0.1;
const HEIGHT_MIN    = -3;
const HEIGHT_MAX    = 8;

export default class TerrainEditor {
  constructor(scene, terrainMesh) {
    this._scene   = scene;
    this._mesh    = terrainMesh;
    this._nodes   = [];
    this._active  = false;
    this._selected = null;

    this._buildNodes();
    this._setupInput();
  }

  _buildNodes() {
    const positions = this._mesh.getVerticesData(VertexBuffer.PositionKind);
    const count     = positions.length / 3;

    // Shared material — individual nodes swap emissive for selection state
    const mat = new StandardMaterial('terrNodeMat', this._scene);
    mat.diffuseColor  = NODE_COLOR;
    mat.emissiveColor = NODE_EMISSIVE;

    for (let i = 0; i < count; i++) {
      const node = MeshBuilder.CreateSphere(`terrNode_${i}`, { diameter: 0.55, segments: 3 }, this._scene);
      node.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      node.material   = mat.clone(`terrNodeMat_${i}`);
      node.isVisible  = false;
      node.isPickable = false;
      node.metadata   = { vertexIndex: i };
      this._nodes.push(node);
    }
  }

  _setupInput() {
    // Click to select a node
    this._scene.onPointerObservable.add((info) => {
      if (!this._active || info.type !== PointerEventTypes.POINTERDOWN) return;
      if (info.event.button !== 0) return;

      const pick = this._scene.pick(
        this._scene.pointerX, this._scene.pointerY,
        m => m.name.startsWith('terrNode_'),
      );
      if (pick.hit) this._selectNode(pick.pickedMesh);
    });

    // Arrow keys to adjust height
    window.addEventListener('keydown', (e) => {
      if (!this._active || !this._selected) return;
      const fine = e.shiftKey;
      const step = fine ? HEIGHT_FINE : HEIGHT_STEP;
      const idx  = this._selected.metadata.vertexIndex;

      if (e.code === 'ArrowUp')   { e.preventDefault(); this._applyHeight(idx, this._selected.position.y + step); }
      if (e.code === 'ArrowDown') { e.preventDefault(); this._applyHeight(idx, this._selected.position.y - step); }
    });
  }

  _selectNode(node) {
    if (this._selected) {
      this._selected.material.emissiveColor = NODE_EMISSIVE.clone();
      this._selected.material.diffuseColor  = NODE_COLOR.clone();
    }
    this._selected = node;
    node.material.diffuseColor  = NODE_SELECTED.clone();
    node.material.emissiveColor = NODE_SELECTED.clone();
  }

  _applyHeight(idx, rawY) {
    const y         = Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, rawY));
    const positions = this._mesh.getVerticesData(VertexBuffer.PositionKind);
    positions[idx * 3 + 1] = y;
    this._nodes[idx].position.y = y;

    const indices = this._mesh.getIndices();
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    this._mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    this._mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  }

  activate() {
    this._active = true;
    for (const n of this._nodes) { n.isVisible = true; n.isPickable = true; }
  }

  deactivate() {
    this._active  = false;
    this._selected = null;
    for (const n of this._nodes) { n.isVisible = false; n.isPickable = false; }
  }

  getHeightData() {
    const positions = this._mesh.getVerticesData(VertexBuffer.PositionKind);
    return Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 1]);
  }

  resetToFlat() {
    const positions = this._mesh.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 1] = 0;
      if (this._nodes[i]) this._nodes[i].position.y = 0;
    }
    const indices = this._mesh.getIndices();
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    this._mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    this._mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
    this._selected = null;
  }

  loadHeightData(heights) {
    const positions = this._mesh.getVerticesData(VertexBuffer.PositionKind);
    heights.forEach((h, i) => {
      positions[i * 3 + 1] = h;
      if (this._nodes[i]) this._nodes[i].position.y = h;
    });
    const indices = this._mesh.getIndices();
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    this._mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    this._mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  }
}
