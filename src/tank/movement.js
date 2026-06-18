// src/tank/movement.js
// Pure movement helpers — no engine deps, unit-checkable (mirrors shield.js).
// Braking (throttle opposing motion) decelerates HARDER than coasting, so
// tapping reverse stops you faster than releasing the key — the realistic
// "tanks stop fast" feel, and a fix for the old bug where S (which applied
// the weak acceleration value) was slower than just letting go (drag).

export const TURN_FALLOFF = 0.5;   // turn-rate reduction at full speed (0..1)

// Diminishing acceleration: full thrust off the line, tapering toward zero as
// speed nears maxSpeed, so the last push to top speed is the slow part (a power
// curve, not a flat ramp).  curve>1 keeps low-speed accel brisk and bites only
// near the top.  At ratio 1 accel is 0 → top speed is approached asymptotically.
//   c = { acceleration, maxSpeed, accelCurve }
export function accelAt(speed, c) {
  const ratio = Math.min(1, Math.abs(speed) / c.maxSpeed);
  return c.acceleration * (1 - ratio ** (c.accelCurve ?? 1));
}

// One throttle/brake integration step. Returns the new speed.
//   c = { acceleration, maxSpeed, accelCurve, drag, brakeDecel }
// When input opposes current motion, brake at brakeDecel toward zero (no
// overshoot past zero); otherwise accelerate along the diminishing curve;
// with no input, coast at drag.
export function stepThrottle(speed, forwardKey, reverseKey, dt, c) {
  if (forwardKey) {
    if (speed < 0) return Math.min(0, speed + c.brakeDecel * dt);   // braking out of reverse
    return speed + accelAt(speed, c) * dt;
  }
  if (reverseKey) {
    if (speed > 0) return Math.max(0, speed - c.brakeDecel * dt);   // braking out of forward
    return speed - accelAt(speed, c) * dt;                          // reverse accel (same curve)
  }
  if (speed > 0) return Math.max(0, speed - c.drag * dt);            // coast
  if (speed < 0) return Math.min(0, speed + c.drag * dt);
  return 0;
}

// Effective turn rate: tight at a crawl, wide at full tilt (heavy-machine feel).
export function turnRateAt(speed, maxSpeed, rotateSpeed) {
  const ratio = Math.min(1, Math.abs(speed) / maxSpeed);
  return rotateSpeed * (1 - TURN_FALLOFF * ratio);
}
