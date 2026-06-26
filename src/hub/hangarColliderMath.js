// src/hub/hangarColliderMath.js
// Pure seat-pad geometry — no engine deps so it is unit-checkable (mirrors
// shield.js / trackMarksEmit.js). A seat "step-pad" hugs a cushion footprint
// but rises from the floor to a climbable top so the character can step on
// and read as sitting (the cushion itself is too low for the ellipsoid feet).

export const SEAT_PAD_TOP   = 1.05; // world-Y the pad top reaches — low enough to step onto directly (tuned in-game)
export const SEAT_PAD_INSET = 0.10; // shrink each side so the pad doesn't overhang the cushion
export const SEAT_PAD_MIN   = 0.30; // min pad width/depth after inset

// footprint: { x, z, w, d } — cushion centre (x,z) and size (w,d) in the
// station's local build space. Returns a box: size + centre.
export function computeSeatPad(footprint, opts = {}) {
  const top   = opts.top   ?? SEAT_PAD_TOP;
  const inset = opts.inset ?? SEAT_PAD_INSET;
  const min   = opts.min   ?? SEAT_PAD_MIN;
  const width = Math.max(min, footprint.w - 2 * inset);
  const depth = Math.max(min, footprint.d - 2 * inset);
  return { width, depth, height: top, cx: footprint.x, cz: footprint.z, cy: top / 2 };
}
