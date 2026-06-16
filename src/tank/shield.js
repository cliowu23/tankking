// src/tank/shield.js
// Pure shield state machine — no engine deps so it is unit-checkable.
// The shield is a BURST + MITIGATION defense that shares the tank's fuel:
//   - pop (Q) costs SHIELD_FUEL_COST, only if not already active and fuel suffices
//   - stays active SHIELD_DURATION seconds
//   - while active, incoming damage is multiplied by SHIELD_MITIGATION
//   - while active, move speed is multiplied by SHIELD_MOVE_MULT (you can still crawl)
export const SHIELD_DURATION   = 0.8;   // seconds the bubble lasts per pop
export const SHIELD_FUEL_COST  = 25;    // fuel per pop (~4 pops on a full 100 tank)
export const SHIELD_MITIGATION = 0.15;  // damage multiplier while active (85% reduction)
export const SHIELD_MOVE_MULT  = 0.50;  // move-speed multiplier while active

export function makeShieldState() {
  return { active: false, timeLeft: 0 };
}

// Advance the shield one frame.
//   state: { active, timeLeft }   (mutated and returned)
//   dt: seconds
//   popRequested: bool (Q pressed this frame, edge-triggered by caller)
//   fuel: current fuel
// Returns { fuelSpent, justPopped }. Caller subtracts fuelSpent from fuel.
export function stepShield(state, dt, popRequested, fuel) {
  let fuelSpent = 0;
  let justPopped = false;

  if (popRequested && !state.active && fuel >= SHIELD_FUEL_COST) {
    state.active = true;
    state.timeLeft = SHIELD_DURATION;
    fuelSpent = SHIELD_FUEL_COST;
    justPopped = true;
  }

  if (state.active) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.active = false;
      state.timeLeft = 0;
    }
  }

  return { fuelSpent, justPopped };
}

// Damage multiplier to apply to incoming damage given shield state.
export function shieldDamageMultiplier(state) {
  return state.active ? SHIELD_MITIGATION : 1;
}
