import { MeshBuilder, StandardMaterial, Color3, Color4, Vector3, Constants } from '@babylonjs/core';

// Impact + muzzle visual effects for the arena. Self-contained: receives world
// positions (and a critical flag) only — never reads tank/enemy/scene game state.

const NORMAL_SPARK_VELS = [
  { vx:  0.0, vy: 5.2, vz:  0.0 },
  { vx:  2.6, vy: 4.6, vz:  0.0 },
  { vx: -2.6, vy: 4.6, vz:  0.0 },
  { vx:  0.0, vy: 4.6, vz:  2.6 },
  { vx:  0.0, vy: 4.6, vz: -2.6 },
  { vx:  1.8, vy: 4.3, vz:  1.8 },
  { vx: -1.8, vy: 4.3, vz: -1.8 },
];
const NORMAL_SPARK_GRAVITY = 14;  // units/s² downward (Babylon Y-up)
const NORMAL_SPARK_TRAIL   = 0.07; // seconds of trail behind spark head

export default class ArenaVFX {
  constructor(scene) {
    this.scene = scene;
    this._activeVFX = [];

    // Muzzle flash — 1 sphere
    const flashMat = new StandardMaterial('muzzleFlashMat', this.scene);
    flashMat.diffuseColor    = new Color3(1.0, 0.85, 0.1);
    flashMat.emissiveColor   = new Color3(1.0, 0.9, 0.2);
    flashMat.disableLighting = true;
    this._muzzleFlashMesh = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 1.0, segments: 5 }, this.scene);
    this._muzzleFlashMesh.material   = flashMat;
    this._muzzleFlashMesh.isVisible  = false;
    this._muzzleFlashMesh.isPickable = false;
    this._muzzleFlashMesh._vfxActive = false;

    // --- Tank impact pools (4 slots) ---
    this._tankCores = [];
    for (let i = 0; i < 4; i++) {
      const mat = new StandardMaterial(`tankCoreMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 0.85, 0.3);
      mat.emissiveColor   = new Color3(1.0, 0.75, 0.1);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankCore_${i}`, { diameter: 1.0, segments: 6 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankCores.push(mesh);
    }

    this._tankFireBlobs = [];
    for (let i = 0; i < 16; i++) {
      const mat = new StandardMaterial(`tankFireMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 0.45, 0.05);
      mat.emissiveColor   = new Color3(0.9, 0.30, 0.0);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankFire_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankFireBlobs.push(mesh);
    }

    this._tankSmokes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new StandardMaterial(`tankSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.25, 0.22, 0.20);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankSmoke_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankSmokes.push(mesh);
    }

    // --- Normal impact pools (4 slots: 1 flash + 7 sparks + 2 smokes each) ---
    this._normalFlashes = [];
    for (let i = 0; i < 4; i++) {
      const mat = new StandardMaterial(`normalFlashMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 1.0, 1.0);
      mat.emissiveColor   = new Color3(0.9, 0.95, 1.0);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalFlash_${i}`, { diameter: 1.0, segments: 5 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalFlashes.push(mesh);
    }

    // 4 slots × 7 sparks = 28 updatable line meshes
    this._normalSparks = [];
    for (let i = 0; i < 28; i++) {
      const line = MeshBuilder.CreateLines(`normalSpark_${i}`, {
        points: [Vector3.Zero(), new Vector3(0, 0.01, 0)],
        colors: [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)],
        updatable: true,
      }, this.scene);
      line.isVisible  = false;
      line.isPickable = false;
      line._vfxActive = false;
      this._normalSparks.push(line);
    }

    // Pre-allocated Vector3/Color4 arrays for spark line updates (avoids GC)
    this._sparkPts = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [Vector3.Zero(), Vector3.Zero()])
    );
    this._sparkCols = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)])
    );

    this._normalSmokes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new StandardMaterial(`normalSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.82, 0.82, 0.85);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalSmoke_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalSmokes.push(mesh);
    }

    // Blast ring disc — expands flat and fades (pressure shockwave)
    const discMat = new StandardMaterial('muzzleDiscMat', this.scene);
    discMat.diffuseColor    = new Color3(1.0, 0.90, 0.5);
    discMat.emissiveColor   = new Color3(1.0, 0.85, 0.3);
    discMat.disableLighting = true;
    discMat.backFaceCulling = false;
    this._muzzleDisc = MeshBuilder.CreateDisc('muzzleDisc', { radius: 0.5, tessellation: 16 }, this.scene);
    this._muzzleDisc.rotation.x   = Math.PI / 2; // lay flat
    this._muzzleDisc.material     = discMat;
    this._muzzleDisc.isVisible    = false;
    this._muzzleDisc.isPickable   = false;
    this._muzzleDisc._vfxActive   = false;

    // Muzzle smoke — 2 spheres that rise and fade after the flash
    this._muzzleSmokes = [];
    for (let i = 0; i < 2; i++) {
      const mat = new StandardMaterial(`muzzleSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.85, 0.82, 0.78);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`muzzleSmoke_${i}`, { diameter: 1.0, segments: 5 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._muzzleSmokes.push(mesh);
    }

    // --- Mortar plasma bursts (3 slots): bright core + expanding plasma shell +
    // a flat ground ring. All RED (the King's plasma) and SIZED to the splash radius. ---
    const additive = (name, rgb, alpha) => {
      const m = new StandardMaterial(name, this.scene);
      m.emissiveColor = new Color3(...rgb); m.diffuseColor = new Color3(0, 0, 0);
      m.disableLighting = true; m.alpha = alpha; m.alphaMode = Constants.ALPHA_ADD; m.backFaceCulling = false;
      return m;
    };
    this._plasmaBursts = [];
    for (let i = 0; i < 3; i++) {
      const core = MeshBuilder.CreateSphere(`plasmaCore_${i}`, { diameter: 1.0, segments: 12 }, this.scene);
      core.material = additive(`plasmaCoreMat_${i}`, [1.0, 0.45, 0.38], 1.0);   // hot red-white centre
      core.isVisible = false; core.isPickable = false;
      const shell = MeshBuilder.CreateSphere(`plasmaShell_${i}`, { diameter: 1.0, segments: 12 }, this.scene);
      shell.material = additive(`plasmaShellMat_${i}`, [1.0, 0.12, 0.08], 0.55); // red plasma ball
      shell.isVisible = false; shell.isPickable = false;
      const ring = MeshBuilder.CreateDisc(`plasmaRing_${i}`, { radius: 1.0, tessellation: 28 }, this.scene);
      ring.rotation.x = Math.PI / 2;
      ring.material = additive(`plasmaRingMat_${i}`, [1.0, 0.16, 0.10], 0.85);   // ground shockwave
      ring.isVisible = false; ring.isPickable = false;
      this._plasmaBursts.push({ core, shell, ring, _vfxActive: false });
    }
  }

  // Big red plasma detonation sized to `radius` (== the splash damage circle): a bright
  // core flash, an expanding plasma sphere whose radius reaches `radius`, and a flat
  // ground ring marking the blast edge. Pooled; silently drops if all slots are busy.
  spawnPlasmaBurst(pos, radius = 4.5) {
    let slot = -1;
    for (let i = 0; i < this._plasmaBursts.length; i++) if (!this._plasmaBursts[i]._vfxActive) { slot = i; break; }
    if (slot === -1) return;
    const b = this._plasmaBursts[slot];
    b._vfxActive = true;
    const oy = Math.max(0.5, pos.y);
    b.core.isVisible  = true; b.core.position.set(pos.x, oy, pos.z);  b.core.scaling.setAll(radius * 0.4);  b.core.material.alpha = 1.0;
    b.shell.isVisible = true; b.shell.position.set(pos.x, oy, pos.z); b.shell.scaling.setAll(radius * 0.5); b.shell.material.alpha = 0.55;
    b.ring.isVisible  = true; b.ring.position.set(pos.x, 0.12, pos.z); b.ring.scaling.setAll(radius * 0.25); b.ring.material.alpha = 0.85;
    this._activeVFX.push({ type: 'plasmaBurst', burst: b, radius, t: 0, duration: 0.5 });
  }

  spawnMuzzleFlash(pos) {
    // Layer 1: bright core sphere
    const flash = this._muzzleFlashMesh;
    if (!flash._vfxActive) {
      flash._vfxActive = true;
      flash.isVisible  = true;
      flash.position.copyFrom(pos);
      flash.scaling.setAll(0.4);
      flash.material.alpha         = 1.0;
      flash.material.diffuseColor  = new Color3(1.0, 0.97, 0.85);
      flash.material.emissiveColor = new Color3(1.0, 0.95, 0.7);
      this._activeVFX.push({ type: 'muzzleFlash', mesh: flash, t: 0, duration: 0.12 });
    }

    // Layer 2: expanding blast ring
    const disc = this._muzzleDisc;
    if (!disc._vfxActive) {
      disc._vfxActive = true;
      disc.isVisible  = true;
      disc.position.copyFrom(pos);
      disc.scaling.setAll(0.2);
      disc.material.alpha = 0.75;
      this._activeVFX.push({ type: 'muzzleDisc', mesh: disc, t: 0, duration: 0.10 });
    }

    // Layer 3: two smoke puffs that rise after the flash
    for (let i = 0; i < 2; i++) {
      const smoke = this._muzzleSmokes[i];
      if (!smoke._vfxActive) {
        smoke._vfxActive = true;
        smoke.isVisible  = true;
        smoke.position.set(pos.x + (i === 0 ? 0.1 : -0.1), pos.y, pos.z + (i === 0 ? 0.1 : -0.1));
        smoke.scaling.setAll(0.3);
        smoke.material.alpha = 0.0;
        this._activeVFX.push({
          type: 'muzzleSmoke', mesh: smoke, t: 0, duration: 0.55,
          ox: smoke.position.x, oy: smoke.position.y, oz: smoke.position.z,
        });
      }
    }
  }

  spawnNormalImpact(pos) {
    let slot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._normalFlashes[i]._vfxActive) { slot = i; break; }
    }
    if (slot === -1) return;

    const oy    = Math.max(0.3, pos.y);
    const flash = this._normalFlashes[slot];
    flash._vfxActive = true;
    flash.isVisible  = true;
    flash.position.set(pos.x, oy, pos.z);
    flash.scaling.setAll(0.5);
    flash.material.alpha = 1.0;

    const sparks = [];
    for (let s = 0; s < 7; s++) {
      const mesh = this._normalSparks[slot * 7 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      sparks.push(mesh);
    }

    const smokes = [];
    for (let s = 0; s < 2; s++) {
      const mesh = this._normalSmokes[slot * 2 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x + (s === 0 ? 0.12 : -0.12), oy, pos.z + (s === 0 ? 0.08 : -0.08));
      mesh.scaling.setAll(0.3);
      mesh.material.alpha = 0.0;
      smokes.push(mesh);
    }

    this._activeVFX.push({
      type: 'normalImpact', slot, flash, sparks, smokes,
      t: 0, duration: 0.75, ox: pos.x, oy, oz: pos.z,
    });
  }

  spawnTankImpact(pos, isCritical = false) {
    if (!isCritical) {
      this.spawnNormalImpact(pos);
      return;
    }

    let slot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._tankCores[i]._vfxActive) { slot = i; break; }
    }
    if (slot === -1) return;

    const oy   = Math.max(0.3, pos.y);
    const core = this._tankCores[slot];
    core._vfxActive = true;
    core.isVisible  = true;
    core.position.set(pos.x, oy, pos.z);
    core.scaling.setAll(0.8);
    core.material.alpha = 1.0;

    const fireBlobs = [];
    for (let b = 0; b < 4; b++) {
      const mesh = this._tankFireBlobs[slot * 4 + b];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x, oy, pos.z);
      mesh.scaling.setAll(0.1);
      mesh.material.alpha = 1.0;
      fireBlobs.push(mesh);
    }

    const smokeBlobs = [];
    for (let s = 0; s < 2; s++) {
      const mesh = this._tankSmokes[slot * 2 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x + (s === 0 ? 0.15 : -0.15), oy, pos.z + (s === 0 ? 0.1 : -0.1));
      mesh.scaling.setAll(0.4);
      mesh.material.alpha = 0.0;
      smokeBlobs.push(mesh);
    }

    // Find a free spark slot (independent from the fireball slot)
    let sparkSlot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._normalSparks[i * 7]._vfxActive) { sparkSlot = i; break; }
    }
    const sparks = [];
    if (sparkSlot !== -1) {
      for (let s = 0; s < 7; s++) {
        const mesh = this._normalSparks[sparkSlot * 7 + s];
        mesh._vfxActive = true;
        mesh.isVisible  = true;
        sparks.push(mesh);
      }
    }

    this._activeVFX.push({
      type: 'tankImpact', slot, core, fireBlobs, smokeBlobs, sparks, sparkSlot,
      t: 0, duration: 0.65, ox: pos.x, oy, oz: pos.z,
    });
  }

  update(dt) {
    for (let i = this._activeVFX.length - 1; i >= 0; i--) {
      const entry = this._activeVFX[i];
      entry.t += dt;

      if (entry.t >= entry.duration) {
        if (entry.type === 'tankImpact') {
          entry.core.isVisible  = false; entry.core._vfxActive = false;
          for (const b of entry.fireBlobs)  { b.isVisible = false; b._vfxActive = false; }
          for (const b of entry.smokeBlobs) { b.isVisible = false; b._vfxActive = false; }
          for (const s of entry.sparks)     { s.isVisible = false; s._vfxActive = false; }
        } else if (entry.type === 'normalImpact') {
          entry.flash.isVisible  = false; entry.flash._vfxActive = false;
          for (const s of entry.sparks) { s.isVisible = false; s._vfxActive = false; }
          for (const s of entry.smokes) { s.isVisible = false; s._vfxActive = false; }
        } else if (entry.type === 'plasmaBurst') {
          const b = entry.burst;
          b.core.isVisible = false; b.shell.isVisible = false; b.ring.isVisible = false;
          b._vfxActive = false;
        } else {
          entry.mesh.isVisible  = false;
          entry.mesh._vfxActive = false;
        }
        this._activeVFX.splice(i, 1);
        continue;
      }

      const p = entry.t / entry.duration;

      if (entry.type === 'muzzleFlash') {
        if (p < 0.4) {
          const phase = p / 0.4;
          entry.mesh.scaling.setAll(0.4 + phase * 0.8);  // 0.4 → 1.2
          entry.mesh.material.alpha = 1.0;
        } else {
          const phase = (p - 0.4) / 0.6;
          entry.mesh.scaling.setAll(1.2 + phase * 0.3);  // 1.2 → 1.5
          entry.mesh.material.alpha = 1.0 - phase;
        }
      } else if (entry.type === 'muzzleDisc') {
        entry.mesh.scaling.setAll(0.2 + p * 2.3);     // 0.2 → 2.5
        entry.mesh.material.alpha = 0.75 * (1 - p);   // fade to 0
      } else if (entry.type === 'muzzleSmoke') {
        const delay = 0.08;
        if (entry.t < delay) {
          entry.mesh.material.alpha = 0;
        } else {
          const sp    = (entry.t - delay) / (entry.duration - delay);
          const eased = 1 - (1 - sp) * (1 - sp);
          entry.mesh.position.y = entry.oy + eased * 0.8;
          entry.mesh.scaling.setAll(0.3 + eased * 0.8);
          entry.mesh.material.alpha = sp < 0.5
            ? sp * 1.4
            : 0.7 * (1 - (sp - 0.5) / 0.5);
        }
      } else if (entry.type === 'tankImpact') {
        const eased      = 1 - (1 - p) * (1 - p);
        const maxCore   = 2.4;
        const maxRadius = 2.8;
        const maxLift   = 1.2;
        const maxFire   = 1.2;

        // Core: bright fireball, fades by 46%
        if (p < 0.46) {
          const cp = p / 0.46;
          entry.core.scaling.setAll(0.8 + eased * (maxCore - 0.8));
          entry.core.material.alpha = 1.0 - cp;
        } else {
          entry.core.isVisible = false;
        }

        // Fire blobs: scatter out and fade by 55%
        for (let b = 0; b < 4; b++) {
          const angle = b * Math.PI * 0.55;
          entry.fireBlobs[b].position.set(
            entry.ox + Math.sin(angle) * eased * maxRadius,
            entry.oy + eased * maxLift,
            entry.oz + Math.cos(angle) * eased * maxRadius,
          );
          entry.fireBlobs[b].scaling.setAll(eased * maxFire);
          if (p < 0.55) {
            entry.fireBlobs[b].isVisible    = true;
            entry.fireBlobs[b].material.alpha = p < 0.35 ? 1.0 : 1.0 - (p - 0.35) / 0.20;
          } else {
            entry.fireBlobs[b].isVisible = false;
          }
        }

        // Smoke: delayed, rises slowly, lingers until end
        const smokeDelay = 0.20;
        for (let s = 0; s < 2; s++) {
          if (entry.t < smokeDelay) {
            entry.smokeBlobs[s].material.alpha = 0;
          } else {
            const sp    = (entry.t - smokeDelay) / (entry.duration - smokeDelay);
            const seased = 1 - (1 - sp) * (1 - sp);
            entry.smokeBlobs[s].position.y = entry.oy + seased * 1.5;
            entry.smokeBlobs[s].scaling.setAll(0.4 + seased * 1.0);
            entry.smokeBlobs[s].material.alpha = sp < 0.4
              ? sp * 1.5
              : 0.6 * (1 - (sp - 0.4) / 0.6);
          }
        }

        // Arc sparks (same physics as normalImpact)
        if (entry.sparkSlot !== -1) {
          const st = entry.t;
          for (let s = 0; s < 7; s++) {
            const vel  = NORMAL_SPARK_VELS[s];
            const mesh = entry.sparks[s];
            const pts  = this._sparkPts[entry.sparkSlot][s];
            const cols = this._sparkCols[entry.sparkSlot][s];
            const tt   = Math.max(0, st - NORMAL_SPARK_TRAIL);

            pts[1].set(
              entry.ox + vel.vx * st,
              entry.oy + vel.vy * st - 0.5 * NORMAL_SPARK_GRAVITY * st * st,
              entry.oz + vel.vz * st,
            );
            pts[0].set(
              entry.ox + vel.vx * tt,
              entry.oy + vel.vy * tt - 0.5 * NORMAL_SPARK_GRAVITY * tt * tt,
              entry.oz + vel.vz * tt,
            );

            const sparkFade = Math.max(0, 1 - p / 0.75);
            cols[0].set(1, 1, 1, sparkFade * 0.4);
            cols[1].set(1, 0.9, 0.3, sparkFade);

            if (sparkFade > 0 && pts[1].y > -1) {
              mesh.isVisible = true;
              MeshBuilder.CreateLines(`normalSpark_${entry.sparkSlot * 7 + s}`, {
                points: pts, colors: cols, instance: mesh,
              });
            } else {
              mesh.isVisible = false;
            }
          }
        }
      } else if (entry.type === 'plasmaBurst') {
        const b = entry.burst, R = entry.radius;
        const eased = 1 - (1 - p) * (1 - p);
        // Core flash: bright, peaks small, fades out by ~45%
        const cp = Math.min(1, p / 0.45);
        b.core.scaling.setAll(R * (0.4 + eased * 0.5));
        b.core.material.alpha = 1.0 - cp;
        if (cp >= 1) b.core.isVisible = false;
        // Plasma shell: sphere radius expands to exactly R (== splash circle), fades out
        b.shell.scaling.setAll(2 * R * eased);          // diameter-1 sphere → radius R at full
        b.shell.material.alpha = 0.55 * (1 - p);
        // Ground ring: disc radius expands to R, fades (snappier)
        b.ring.scaling.setAll(R * eased);               // radius-1 disc → radius R
        b.ring.material.alpha = 0.85 * (1 - p * p);
      } else if (entry.type === 'normalImpact') {
        const eased = 1 - (1 - p) * (1 - p);

        // Flash: scale up fast, fade out fully by p=0.5
        const ff = Math.max(0, 1 - p / 0.5);
        entry.flash.scaling.setAll(0.5 + eased * 1.5);  // 0.5 → 2.0
        entry.flash.material.alpha = ff;
        if (ff <= 0) entry.flash.isVisible = false;

        // Sparks: arc physics + trail line update
        const st = entry.t;
        for (let s = 0; s < 7; s++) {
          const vel  = NORMAL_SPARK_VELS[s];
          const mesh = entry.sparks[s];
          const pts  = this._sparkPts[entry.slot][s];
          const cols = this._sparkCols[entry.slot][s];

          const tt = Math.max(0, st - NORMAL_SPARK_TRAIL);

          // Head position at current time
          pts[1].set(
            entry.ox + vel.vx * st,
            entry.oy + vel.vy * st - 0.5 * NORMAL_SPARK_GRAVITY * st * st,
            entry.oz + vel.vz * st,
          );
          // Tail position at (t - trail)
          pts[0].set(
            entry.ox + vel.vx * tt,
            entry.oy + vel.vy * tt - 0.5 * NORMAL_SPARK_GRAVITY * tt * tt,
            entry.oz + vel.vz * tt,
          );

          const sparkFade = Math.max(0, 1 - p / 0.75);
          cols[0].set(1, 1, 1, sparkFade * 0.4);          // tail: white, dim
          cols[1].set(1, 0.9, 0.3, sparkFade);             // head: yellow, bright

          if (sparkFade > 0 && pts[1].y > -1) {
            mesh.isVisible = true;
            MeshBuilder.CreateLines(`normalSpark_${entry.slot * 7 + s}`, {
              points: pts,
              colors: cols,
              instance: mesh,
            });
          } else {
            mesh.isVisible = false;
          }
        }

        // Smoke: same pattern as tankImpact smokes
        const smokeDelay = 0.18;
        for (let s = 0; s < 2; s++) {
          if (entry.t < smokeDelay) {
            entry.smokes[s].material.alpha = 0;
          } else {
            const sp     = (entry.t - smokeDelay) / (entry.duration - smokeDelay);
            const seased = 1 - (1 - sp) * (1 - sp);
            entry.smokes[s].position.y = entry.oy + seased * 1.2;
            entry.smokes[s].scaling.setAll(0.3 + seased * 0.9);
            entry.smokes[s].material.alpha = sp < 0.4
              ? sp * 1.2
              : 0.48 * (1 - (sp - 0.4) / 0.6);
          }
        }
      }
    }
  }
}
