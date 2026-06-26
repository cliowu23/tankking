// src/hub/hangarColliders.js
import { MeshBuilder, Vector3 } from '@babylonjs/core';
import { computeSeatPad } from './hangarColliderMath.js';

// Shared hangar collision helpers. Three kinds of collider:
//   • solid  → the visual mesh itself (markSolid) — collider == what you see.
//   • seat   → a tight raised step-pad over a cushion (makeSeatPad) — the only
//              case where the collider is taller than the visual, so the
//              character can climb on and read as sitting.
//   • trigger→ an invisible NON-colliding proximity marker for the [E] prompt.

export function markSolid(mesh) {
  mesh.checkCollisions = true;
  mesh.isPickable      = false;
  return mesh;
}

// footprint: { x, z, w, d } in the parent's local space. The pad is parented
// to the same (scaled) station root, so station scaling/offsets carry it into
// world space exactly like the visual props.
export function makeSeatPad(scene, name, footprint, parent) {
  const g = computeSeatPad(footprint);
  const m = MeshBuilder.CreateBox(name, { width: g.width, height: g.height, depth: g.depth }, scene);
  m.position        = new Vector3(g.cx, g.cy, g.cz);
  m.isVisible       = false;
  m.isPickable      = false;
  m.checkCollisions = true;
  if (parent) m.parent = parent;
  return m;
}

export function makeTrigger(scene, name, center, size = 1) {
  const m = MeshBuilder.CreateBox(name, { size }, scene);
  m.position        = center.clone();
  m.isVisible       = false;
  m.isPickable      = false;
  m.checkCollisions = false;   // proximity only — never blocks the character
  return m;
}

// Invisible WORLD-SPACE blocker — placed at absolute (cx,cz), NOT parented to any
// scaled station root, so collision-editor marks (which are in world coords) bake
// directly with no authored→world transform. `height` is tall by default so the
// player can't ride up and walk on top (use a low height for a step-pad instead).
// box: { cx, cz, w, d }.
export function makeWorldWall(scene, name, box, height = 3.0) {
  const m = MeshBuilder.CreateBox(name, { width: box.w, height, depth: box.d }, scene);
  m.position        = new Vector3(box.cx, height / 2, box.cz);
  m.isVisible       = false;
  m.isPickable      = false;
  m.checkCollisions = true;
  return m;
}
