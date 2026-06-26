// src/world/trackMarksEmit.js
// Pure track-mark emission logic — no engine deps so it is unit-checkable
// (mirrors shield.js / movement.js). Decides how many marks to drop; the
// Babylon TrackMarks class handles placement and fade.

export const SPACING       = 1.1;    // raw spacing chosen in the mockup
export const RIBBON_PACK    = 0.22;   // feathered blobs pack tighter for a seamless smear
export const EMIT_SPACING   = Math.max(0.12, SPACING * RIBBON_PACK); // → 0.242: metres between drop steps
export const SPEED_EPS      = 0.4;    // below this |speed| the tank is "parked" — no marks
export const LIFE           = 6;      // seconds a mark lives before it is fully gone
export const MAX_DROPS_PER_FRAME = 24; // burst guard for respawn/teleport jumps

// Decide how many drop-steps happen this frame and the leftover distance.
//   accum: leftover distance banked from previous frames
//   dist:  distance the tank moved this frame (>= 0)
//   speed: current signed tank speed
// Returns { drops, accum }. When parked, emits nothing and resets the
// accumulator so a stationary tank can't bank a burst.
export function planEmission(
  accum, dist, speed,
  spacing = EMIT_SPACING, speedEps = SPEED_EPS, maxDrops = MAX_DROPS_PER_FRAME,
) {
  if (Math.abs(speed) < speedEps) return { drops: 0, accum: 0 };
  let a = accum + dist;
  let drops = 0;
  while (a >= spacing && drops < maxDrops) { a -= spacing; drops++; }
  if (drops >= maxDrops) a = 0;   // dropped the cap — discard the backlog
  return { drops, accum: a };
}
