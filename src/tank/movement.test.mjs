// Run: node src/tank/movement.test.mjs
// Plain node:assert checks — the project has no test runner on main; pure
// modules (this + shield.js) are verified by running them directly.
import assert from 'node:assert/strict';
import { stepThrottle, turnRateAt, accelAt } from './movement.js';

const C = { acceleration: 4.5, maxSpeed: 16, accelCurve: 2, drag: 20, brakeDecel: 28 };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Forward accel from rest (curve is full at ratio 0)
assert.ok(near(stepThrottle(0, true, false, 0.1, C), 0.45), 'forward accel');

// Reverse accel from rest
assert.ok(near(stepThrottle(0, false, true, 0.1, C), -0.45), 'reverse accel');

// Coast decelerates at drag
assert.ok(near(stepThrottle(10, false, false, 0.1, C), 8.0), 'coast = drag');

// THE BUG FIX: braking (S while moving forward) is HARDER than coasting
const braked = stepThrottle(10, false, true, 0.1, C);   // 10 - 28*0.1 = 7.2
const coast  = stepThrottle(10, false, false, 0.1, C);  // 10 - 20*0.1 = 8.0
assert.ok(near(braked, 7.2), 'brake value');
assert.ok(braked < coast, 'brake faster than coast');

// Brake never overshoots past zero
assert.ok(stepThrottle(1, false, true, 1, C) === 0, 'no overshoot');

// Braking out of reverse (W while moving backward)
assert.ok(near(stepThrottle(-5, true, false, 0.1, C), -2.2), 'brake out of reverse');

// Diminishing-acceleration curve: full at rest, ~0 at top, monotonic between
assert.ok(near(accelAt(0, C), 4.5), 'accel full at rest');
assert.ok(near(accelAt(16, C), 0), 'accel zero at top');
assert.ok(near(accelAt(8, C), 3.375), 'accel @half (curve=2 → 4.5*(1-0.25))');
assert.ok(accelAt(2, C) > accelAt(14, C), 'accel diminishes toward top');

// Spool-up shape: brisk to mid, then a slow asymptotic final push (not snapped).
const tick = 1 / 60;
let s = 0; for (let t = 0; t < 2; t += tick) s = stepThrottle(s, true, false, tick, C);
const at2s = s;
for (let t = 0; t < 4; t += tick) s = stepThrottle(s, true, false, tick, C);
const at6s = s;
assert.ok(at2s > 7 && at2s < 12, `brisk to mid by 2s (~${at2s.toFixed(2)})`);
assert.ok(at6s > 14 && at6s < 16, `slow final push, near but under top by 6s (~${at6s.toFixed(2)})`);
assert.ok(at6s > at2s, 'still climbing toward top');

// Turn falloff: full at rest, half at top
assert.ok(near(turnRateAt(0, 16, 2.1), 2.1), 'turn @rest');
assert.ok(near(turnRateAt(16, 16, 2.1), 1.05), 'turn @top');
assert.ok(near(turnRateAt(8, 16, 2.1), 1.575), 'turn @half');

console.log('movement.js: all checks passed');
