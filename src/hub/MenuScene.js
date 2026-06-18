// src/hub/MenuScene.js
// The live main-menu backdrop: the player's tank slowly rotating on a clean teal
// "showroom" stage. Warm key light keeps the tank warm; a teal rim ties it to the
// UI palette. Passive — captures no input. Reuses buildPrimitiveTank so the menu
// tank can't drift from the hangar/designer. Staging values approved via the
// menu-staging-demo (option B). See _docs/design/2026-06-18-main-menu-design.md.
import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  Color3, Color4, Vector3, MeshBuilder, StandardMaterial,
} from '@babylonjs/core';
import { buildPrimitiveTank } from '../tank/primitiveTank.js';
import { shortAngle } from '../utils/mathUtils.js';
import { attachCrt } from '../core/crtFilter.js';

const ROTATE_SPEED = 0.18; // rad/s — slow continuous turntable; tune to taste
const TURRET_SPEED = 1.8;  // rad/s — sweep rate when the turret acquires a new heading

export default class MenuScene {
  constructor(engine) {
    this._engine = engine;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.016, 0.05, 0.10, 1); // dark teal (UI bg)

    // Camera: fixed low heroic angle. Target sits left of the tank so the tank
    // (at origin) frames to the RIGHT, leaving the left third clear for the menu.
    this.camera = new ArcRotateCamera('menuCam', -Math.PI / 2.4, 1.28, 7.6,
      new Vector3(-1.4, 1.1, 0), this.scene);
    this._applyFraming();     // desktop frames RIGHT; portrait phone pulls left + zooms out
    this._onResize = () => this._applyFraming();
    engine.onResizeObservable.add(this._onResize);
    attachCrt(this.camera);   // arcade/CRT post-process (toggled live via Settings)

    // Lighting — warm key + teal rim + low cool ambient.
    const amb = new HemisphericLight('menuAmb', new Vector3(0, 1, 0), this.scene);
    amb.intensity = 0.42; amb.diffuse = new Color3(0.8, 0.92, 1.0); amb.groundColor = new Color3(0.06, 0.12, 0.16);

    const key = new DirectionalLight('menuKey', new Vector3(-0.5, -1, -0.35), this.scene);
    key.intensity = 0.78; key.diffuse = new Color3(1.0, 0.88, 0.66); key.position = new Vector3(8, 16, 8);

    const rim = new DirectionalLight('menuRim', new Vector3(0.6, -0.15, 0.5), this.scene);
    rim.intensity = 0.55; rim.diffuse = new Color3(0.0, 0.93, 0.87);

    // Turntable glow disc under the tank.
    const disc = MeshBuilder.CreateDisc('menuDisc', { radius: 4.2, tessellation: 54 }, this.scene);
    disc.rotation.x = Math.PI / 2; disc.position.y = 0.02; disc.isPickable = false;
    const dm = new StandardMaterial('menuDiscMat', this.scene);
    dm.emissiveColor = new Color3(0.0, 0.16, 0.17);
    dm.diffuseColor  = new Color3(0.02, 0.08, 0.12);
    dm.specularColor = new Color3(0, 0, 0);
    disc.material = dm;

    // Hero tank (shared primitive geometry). Posed slightly off-axis.
    this._tank = buildPrimitiveTank(this.scene, { simpleBarrel: true });
    this._tank.root.position.set(0, 0, 0);
    if (this._tank.turretPivot) this._tank.turretPivot.rotation.y = -0.45;

    // Hull gently sways (not a full spin — that read too "spinny"). The turret rides
    // WITH the hull and periodically swings to a new heading, as if acquiring a target.
    this._turretLocal = -0.45;   // turret angle relative to the hull
    this._turretAim   = -0.45;
    this._dwell       = 4.5;   // FIXED first pause → guaranteed first sweep ~6s after the menu appears (armed ~1.5s in)
    this.turretActive = true;    // frozen during the cold-boot power-on; released once lit

    this._spin = () => {
      const dt = engine.getDeltaTime() / 1000;
      this._tank.root.rotation.y += dt * ROTATE_SPEED;   // slow continuous turntable

      const turret = this._tank.turretPivot;
      if (turret) {
        if (this.turretActive) {   // frozen until the boot lights finish, then a long first pause
          const diff = shortAngle(this._turretLocal, this._turretAim);
          if (Math.abs(diff) > 0.012) {
            this._turretLocal += Math.sign(diff) * Math.min(Math.abs(diff), TURRET_SPEED * dt);
          } else {
            this._dwell -= dt;
            if (this._dwell <= 0) {
              let a;
              do { a = (Math.random() * 2 - 1) * Math.PI; } while (Math.abs(shortAngle(this._turretLocal, a)) < 0.6);
              this._turretAim = a;
              this._dwell = 3 + Math.random() * 3;   // 3–6s between sweeps (a touch more frequent — more movement)
            }
          }
        }
        turret.rotation.y = this._turretLocal;   // rides with the hull (no counter-rotation)
      }
    };
    this.scene.registerBeforeRender(this._spin);
  }

  // Framing adapts to the viewport. Desktop frames the tank to the RIGHT (clear
  // left third for the menu). A portrait phone pulls the tank toward center-left
  // (target moves right of the tank) and zooms out so it fits the tall, narrow
  // screen alongside the scaled-down corner UI.
  _applyFraming() {
    const eng = this._engine;
    const portrait = eng.getRenderHeight() > eng.getRenderWidth();
    const mobile = !!(window.__mobile && window.__mobile.active);
    let tx = -1.4, ty = 1.1, radius = 7.6, fov = 0.72;
    if (mobile && portrait) { tx = 0.2; ty = 0.8; radius = 9.0; fov = 0.84; }  // tank left-of-center, lifted, smaller
    else if (mobile)        { tx = -1.1; ty = 1.1; radius = 8.0; fov = 0.74; } // landscape phone
    this.camera.setTarget(new Vector3(tx, ty, 0));
    this.camera.radius = radius;
    this.camera.fov = fov;
  }

  render() { this.scene.render(); }

  dispose() {
    try { this.scene.unregisterBeforeRender(this._spin); } catch (_) {}
    try { if (this._onResize) this._engine.onResizeObservable.removeCallback(this._onResize); } catch (_) {}
    this.scene.dispose();
  }
}
