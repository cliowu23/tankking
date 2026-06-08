// src/core/runState.js
// Cross-run persisted state. Slice 1 = banked salvage only; future cross-run
// state (research points, owned parts) joins this module.

const KEY = 'bankedSalvage';

export function getBankedSalvage() {
  const raw = parseInt(localStorage.getItem(KEY), 10);
  return Number.isFinite(raw) ? raw : 0;
}

// Adds amount (clamped >= 0, rounded) to the banked total, persists, returns new total.
export function bankSalvage(amount) {
  const total = getBankedSalvage() + Math.max(0, Math.round(amount));
  localStorage.setItem(KEY, String(total));
  return total;
}
