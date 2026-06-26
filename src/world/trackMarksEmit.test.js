import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planEmission, EMIT_SPACING } from './trackMarksEmit.js';

test('parked tank emits nothing and clears the accumulator', () => {
  const r = planEmission(0.5, 0.01, 0.1);   // speed below SPEED_EPS
  assert.equal(r.drops, 0);
  assert.equal(r.accum, 0);
});

test('moving under one spacing banks distance, no drop', () => {
  const r = planEmission(0, EMIT_SPACING * 0.5, 16);
  assert.equal(r.drops, 0);
  assert.ok(Math.abs(r.accum - EMIT_SPACING * 0.5) < 1e-9);
});

test('crossing one spacing drops once and carries the remainder', () => {
  const r = planEmission(0, EMIT_SPACING + 0.05, 16);
  assert.equal(r.drops, 1);
  assert.ok(Math.abs(r.accum - 0.05) < 1e-9);
});

test('banked accumulator contributes to the next drop', () => {
  const r = planEmission(EMIT_SPACING - 0.05, 0.10, 16);
  assert.equal(r.drops, 1);
  assert.ok(Math.abs(r.accum - 0.05) < 1e-9);
});

test('huge dist burst is capped and the backlog is dropped', () => {
  const r = planEmission(0, 1000, 16, EMIT_SPACING, 0.4, 24);
  assert.equal(r.drops, 24);
  assert.equal(r.accum, 0);
});

test('reverse motion still emits (uses absolute speed)', () => {
  const r = planEmission(0, EMIT_SPACING + 0.01, -16);
  assert.equal(r.drops, 1);
});
