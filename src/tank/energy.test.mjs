// Run: node src/tank/energy.test.mjs
// Plain node:assert checks — the project has no test runner on main; pure
// modules (this + shield.js + movement.js) are verified by running them directly.
import assert from 'node:assert/strict';
import { makeEnergyState, stepEnergy, canSpend } from './energy.js';

const C = { maxFuel: 100, rechargeDelay: 0.5, rechargeRate: 35, redlineRecovery: 1.2, redlineRefillRate: 200 };
const tick = 1 / 60;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- Spend + partial-use regen delay ---
let s = makeEnergyState(100);
stepEnergy(s, tick, 30, C);                 // burn 30 → 70, resets delay
assert.ok(near(s.fuel, 70), `spend applied (~${s.fuel.toFixed(2)})`);
for (let t = 0; t < 0.4; t += tick) stepEnergy(s, tick, 0, C);   // idle 0.4s (< 0.5 delay)
assert.ok(near(s.fuel, 70, 0.01), `no regen before delay (~${s.fuel.toFixed(2)})`);
for (let t = 0; t < 0.5; t += tick) stepEnergy(s, tick, 0, C);   // idle past the delay
assert.ok(s.fuel > 71, `regen after delay (~${s.fuel.toFixed(2)})`);

// --- Redline: full drain → lockout → fast sweep-up to full ---
let r = makeEnergyState(100); r.fuel = 10;
stepEnergy(r, tick, 30, C);                 // try to burn 30 with only 10 → empties, redline
assert.ok(r.fuel === 0 && r.redline === true, 'redline on full drain');
assert.ok(!canSpend(r, 1), 'cannot spend during redline lockout');
for (let t = 0; t < 1.1; t += tick) stepEnergy(r, tick, 0, C);   // still inside 1.2s lockout
assert.ok(r.fuel === 0 && r.redline === true, 'still locked before recovery elapses');
for (let t = 0; t < 0.2; t += tick) stepEnergy(r, tick, 0, C);   // lockout expires mid-loop
assert.ok(r.redline === false, 'redline clears after lockout');
assert.ok(r.fuel > 0 && r._fastRefill, 'fast sweep-up started');
for (let t = 0; t < 0.6; t += tick) stepEnergy(r, tick, 0, C);   // ~200/s fills <0.5s
assert.ok(near(r.fuel, 100, 1e-6), `fast refill reaches full (~${r.fuel.toFixed(2)})`);
assert.ok(r._fastRefill === false, 'fast-refill flag clears at full');

// --- Spending mid-sweep cancels the fast refill (no double-dip) ---
let f = makeEnergyState(100); f.fuel = 50; f._fastRefill = true;
stepEnergy(f, tick, 0, C);                   // sweep adds ~3.3
assert.ok(f.fuel > 50 && f._fastRefill, 'sweep adding');
stepEnergy(f, tick, 5, C);                   // spend during sweep
assert.ok(f._fastRefill === false, 'spend cancels fast refill');
assert.ok(f.fuel > 0 && !f.redline, 'partial spend mid-sweep does not redline');

// --- canSpend gate ---
let g = makeEnergyState(100);
assert.ok(canSpend(g, 25), 'can spend when full');
g.fuel = 10;
assert.ok(!canSpend(g, 25), 'cannot spend more than fuel');
assert.ok(canSpend(g, 5), 'can spend within fuel');

console.log('energy.js: all checks passed');
