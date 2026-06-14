// src/journey/journeyState.js
// The Long Road run-state. One active journey at a time. Persisted to
// localStorage so a run survives a reload (plan: C4 persistent run-state).
// Banks into runState.bankSalvage() on final extraction. Pure logic — no DOM.

import { bankSalvage, getBankedSalvage } from '../core/runState.js';

const KEY = 'longRoadJourney';
const THREAD_MAX = 100;

let _j = null; // in-memory active journey, or null

function _blank({ totalLegs, maxFuel }) {
  return {
    legIndex: 0,
    totalLegs,
    maxFuel,
    fuel: maxFuel,
    runSalvage: 0,
    allies: [],
    threads: { power: 0, bonds: 0, truth: 0 },
    hpCarry: null, // 0..1 fraction; null = full hull (first leg)
  };
}

function _persist() {
  if (_j) localStorage.setItem(KEY, JSON.stringify(_j));
  else localStorage.removeItem(KEY);
}

export function startJourney({ totalLegs = 3, maxFuel = 100 } = {}) {
  _j = _blank({ totalLegs, maxFuel });
  _persist();
  return _j;
}

export function restoreJourney() {
  try {
    const raw = localStorage.getItem(KEY);
    _j = raw ? JSON.parse(raw) : null;
  } catch { _j = null; }
  return _j;
}

export function hasActiveJourney() {
  if (_j) return true;
  return localStorage.getItem(KEY) != null;
}

export function getJourney() { return _j; }

export function drainFuel(amount) {
  if (!_j) return;
  _j.fuel = Math.max(0, _j.fuel - Math.max(0, amount));
  _persist();
}

export function refuel(amount) {
  if (!_j) return;
  // Adds `amount` fuel, clamped at maxFuel. Partial refuels are real — callers
  // (town depot, rescued pilot's fuel can) pass different amounts.
  _j.fuel = Math.min(_j.maxFuel, _j.fuel + Math.max(0, amount));
  _persist();
}

export function isStranded() { return !!_j && _j.fuel <= 0; }

export function addSalvage(amount) {
  if (!_j) return;
  _j.runSalvage += Math.max(0, Math.round(amount));
  _persist();
}

export function recruitAlly(id) {
  if (!_j || _j.allies.includes(id)) return;
  _j.allies.push(id);
  _persist();
  tickThread('bonds', 34); // ~3 allies fills the meter in the prototype
}

export function tickThread(name, amount) {
  if (!_j || !(name in _j.threads)) return;
  _j.threads[name] = Math.min(THREAD_MAX, _j.threads[name] + Math.max(0, amount));
  _persist();
}

export function setHpCarry(frac) {
  if (!_j) return;
  _j.hpCarry = Math.max(0, Math.min(1, frac));
  _persist();
}

export function advanceLeg() {
  if (!_j) return;
  _j.legIndex += 1;
  _persist();
}

export function isComplete() { return !!_j && _j.legIndex >= _j.totalLegs; }

// Final extraction: move the run's salvage into the cross-run bank, end the journey.
export function bankJourney() {
  if (!_j) return getBankedSalvage();
  const banked = bankSalvage(_j.runSalvage);
  _j = null;
  _persist();
  return banked;
}
