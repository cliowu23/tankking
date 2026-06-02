import {
  MeshBuilder, ArcRotateCamera, StandardMaterial,
  Color3, Vector3,
} from '@babylonjs/core';

const SPEED = 5; // units/sec

export default class DriverCharacter {
  constructor(scene) {
    this.scene = scene;

    // Capsule placeholder — swap for GLB later with no logic changes
    this.mesh = MeshBuilder.CreateCapsule('driver', { radius: 0.3, height: 1.8 }, scene);
    this.mesh.position        = new Vector3(0, 0.9, -6); // center-south spawn
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid       = new Vector3(0.3, 0.9, 0.3);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.9, 0);

    const mat = new StandardMaterial('driver-mat', scene);
    mat.diffuseColor  = new Color3(0.55, 0.48, 0.32); // khaki
    mat.specularColor = new Color3(0.08, 0.08, 0.08);
    this.mesh.material = mat;

    // Top-down follow camera — same style as the arena
    this.camera = new ArcRotateCamera('driver-cam', -Math.PI / 2, 0.62, 22, this.mesh.position.clone(), scene);
    this.camera.lowerRadiusLimit = 28;
    this.camera.upperRadiusLimit = 28;
    scene.activeCamera = this.camera;

    this._keys       = {};
    this._vy         = 0;
    this._onKeyDown  = (e) => { this._keys[e.code] = true; };
    this._onKeyUp    = (e) => { this._keys[e.code] = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
  }

  update(dt) {
    const fwd   = this._keys['KeyW']     || this._keys['ArrowUp'];
    const back  = this._keys['KeyS']     || this._keys['ArrowDown'];
    const left  = this._keys['KeyA']     || this._keys['ArrowLeft'];
    const right = this._keys['KeyD']     || this._keys['ArrowRight'];

    let dx = 0, dz = 0;
    if (fwd)   dz += 1;
    if (back)  dz -= 1;
    if (left)  dx -= 1;
    if (right) dx += 1;

    // Apply dt-scaled gravity
    this._vy -= 9.8 * dt;

    const move = new Vector3(dx * SPEED * dt, this._vy * dt, dz * SPEED * dt);
    this.mesh.moveWithCollisions(move);

    // Zero vertical velocity when grounded (ellipsoid half-height = 0.9)
    if (this.mesh.position.y <= 0.9 + 0.01) {
      this._vy = 0;
      this.mesh.position.y = 0.9; // snap to floor to avoid drift
    }

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx /= len;
      dz /= len;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  get position() { return this.mesh.position; }

  hide() { this.mesh.isVisible = false; }
  show() { this.mesh.isVisible = true; }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
    this.mesh.dispose();
    this.camera.dispose();
  }
}
