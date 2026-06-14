// src/journey/sequencer.js
// Deterministic leg assembler. P0 keeps it simple: a fixed spine guaranteeing a
// mandatory fuel stop, with a seeded shuffle of the interchangeable middle legs
// so later content can grow the pool without changing callers.

import { LEG_POOL } from './legs.js';

// Mulberry32 — tiny deterministic PRNG so journeys are reproducible by seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function assembleJourney({ seed = 1, count = 3 } = {}) {
  const rand = rng(seed);
  const finals = LEG_POOL.filter(l => l.exits.length === 0);
  const middles = LEG_POOL.filter(l => l.exits.length > 0);

  // Seeded shuffle of the middle legs (Fisher–Yates).
  const shuffled = [...middles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const legs = shuffled.slice(0, count - 1);
  legs.push(finals[0] ?? LEG_POOL[LEG_POOL.length - 1]);
  return legs;
}
