import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSeatPad, SEAT_PAD_TOP, SEAT_PAD_INSET } from './hangarColliderMath.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('pad footprint is inset on each side', () => {
  const r = computeSeatPad({ x: 0, z: 0, w: 0.8, d: 0.8 });
  assert.ok(near(r.width, 0.8 - 2 * SEAT_PAD_INSET));
  assert.ok(near(r.depth, 0.8 - 2 * SEAT_PAD_INSET));
});

test('pad rises from the floor to SEAT_PAD_TOP', () => {
  const r = computeSeatPad({ x: 0, z: 0, w: 0.8, d: 0.8 });
  assert.ok(near(r.height, SEAT_PAD_TOP));   // floor (0) → top
  assert.ok(near(r.cy, SEAT_PAD_TOP / 2));   // box centre
});

test('pad is centred on the cushion', () => {
  const r = computeSeatPad({ x: -2.5, z: -1.95, w: 0.78, d: 1.18 });
  assert.ok(near(r.cx, -2.5));
  assert.ok(near(r.cz, -1.95));
});

test('a tiny cushion is floored at SEAT_PAD_MIN, not negative', () => {
  const r = computeSeatPad({ x: 0, z: 0, w: 0.15, d: 0.15 });
  assert.ok(r.width >= 0.30 - 1e-9);
  assert.ok(r.depth >= 0.30 - 1e-9);
});

test('opts override the defaults', () => {
  const r = computeSeatPad({ x: 0, z: 0, w: 1, d: 1 }, { top: 2, inset: 0.25, min: 0.1 });
  assert.ok(near(r.height, 2));
  assert.ok(near(r.width, 0.5));
});
