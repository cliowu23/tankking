// Shared pure-math helpers. No Babylon imports — just scalars in, scalars out.

// Shortest signed angle (radians) to rotate `from` onto `to`. Result is in (-π, π].
export function shortAngle(from, to) {
  return ((to - from) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

// Health-bar colour ramp: green (full) → yellow (half) → red (empty).
// Returns { red, green } in 0..1; callers scale them for CSS or Color3 as needed.
export function hpColor(ratio) {
  return {
    red:   ratio < 0.5 ? 1.0 : 2 * (1 - ratio),
    green: ratio > 0.5 ? 1.0 : 2 * ratio,
  };
}

// Y rotation (radians) that turns a GLB whose model faces `facingAxis` to game forward (+Z).
export function yRotForFacing(facingAxis) {
  const map = { '+Z': 0, '+X': -Math.PI / 2, '-Z': Math.PI, '-X': Math.PI / 2 };
  return map[facingAxis] ?? -Math.PI / 2;
}
