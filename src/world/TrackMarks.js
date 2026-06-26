// src/world/TrackMarks.js
import { MeshBuilder, StandardMaterial, DynamicTexture, Color3, Constants } from '@babylonjs/core';
import { EMIT_SPACING, LIFE, planEmission } from './trackMarksEmit.js';

// Continuous-ribbon track marks: two soft dark bands that trail the tank's
// tracks and fade over their final FADE_TAIL of life. Self-contained — reads
// only tank.position / rotY / speed; nothing in the game depends on it.

const GAUGE     = 1.34;  // lateral track offset — matches Tank.js trackLeft/Right
const OPACITY   = 0.25;  // peak visibility — subtle, but reads as a smear
const MARK_W    = 0.95;  // quad width  (across the track)
const MARK_L    = 1.00;  // quad length (along the heading)
const Y_OFFSET  = 0.03;  // height above ground — gap that helps beat z-fighting
const FADE_TAIL = 0.40;  // fraction of life spent fading out (full opacity before)
// Pool covers LIFE seconds at a generous top speed, 2 quads per step, + headroom.
const TOP_SPEED = 18;    // ballpark sustained/boost speed; oversizing the pool is cheap
const POOL = Math.ceil((TOP_SPEED / EMIT_SPACING) * 2 * LIFE * 1.15);

export default class TrackMarks {
  constructor(scene) {
    this._marks = [];           // { mesh, age, life, active }
    this._head  = 0;
    this._accum = 0;
    this._lastX = null;
    this._lastZ = null;

    // Feathered-all-edges smudge blob: a radial fade to zero alpha on every
    // side, so dense overlapping drops melt into one continuous smear rather
    // than tiling into discrete marks (and the transparent edges hide any
    // mark-vs-mark z-ordering between coplanar quads).
    const tex = new DynamicTexture('trackMarkTex', { width: 64, height: 64 }, scene, false);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 64, 64);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0,    'rgba(30,22,15,0.85)');
    g.addColorStop(0.55, 'rgba(30,22,15,0.42)');
    g.addColorStop(1,    'rgba(30,22,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.hasAlpha = true;
    tex.update();
    this._tex = tex;

    const mat = new StandardMaterial('trackMarkMat', scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_COMBINE;
    mat.zOffset = -2;            // pull toward camera — defeats coplanar z-fight
    this._mat = mat;

    for (let i = 0; i < POOL; i++) {
      const q = MeshBuilder.CreatePlane('trackMark_' + i, { size: 1 }, scene);
      q.rotation.x = Math.PI / 2;        // lie flat on the ground
      q.scaling.set(MARK_W, MARK_L, 1);  // fixed ribbon size
      q.material   = mat;
      q.isPickable = false;
      q.isVisible  = false;
      this._marks.push({ mesh: q, age: 0, life: 0, active: false });
    }
  }

  // Call once per frame, AFTER the tank's own update (so position is final).
  update(dt, tank) {
    const x = tank.position.x, z = tank.position.z;
    if (this._lastX === null) { this._lastX = x; this._lastZ = z; }
    const dist = Math.hypot(x - this._lastX, z - this._lastZ);
    this._lastX = x; this._lastZ = z;

    const { drops, accum } = planEmission(this._accum, dist, tank.speed);
    this._accum = accum;
    for (let i = 0; i < drops; i++) this._drop(x, z, tank.rotY);

    for (const m of this._marks) {
      if (!m.active) continue;
      m.age += dt;
      if (m.age >= m.life) { m.active = false; m.mesh.isVisible = false; continue; }
      const f = 1 - m.age / m.life;                       // 1 fresh → 0 dead
      m.mesh.visibility = OPACITY * Math.min(1, f / FADE_TAIL);
    }
  }

  _drop(x, z, rotY) {
    const rgtX = Math.cos(rotY), rgtZ = -Math.sin(rotY);  // tank's right vector
    for (const s of [-GAUGE, GAUGE]) {
      const m = this._marks[this._head];
      this._head = (this._head + 1) % POOL;
      const q = m.mesh;
      q.position.set(x + rgtX * s, Y_OFFSET, z + rgtZ * s);
      q.rotation.z = -rotY;     // align the quad's long axis to heading
      q.visibility = OPACITY;
      q.isVisible  = true;
      m.age = 0; m.life = LIFE; m.active = true;
    }
  }

  dispose() {
    for (const m of this._marks) m.mesh.dispose();
    this._tex.dispose();
    this._mat.dispose();
  }
}
