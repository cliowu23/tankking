// src/tank/energy.js
// Pure energy/fuel state machine — no engine deps, unit-checkable (mirrors
// shield.js / movement.js). Boost and shield both spend from one `fuel` pool.
//
// Two recovery modes, by how you ran dry:
//   - PARTIAL use (eased off before empty): after `rechargeDelay` of no spend,
//     regen at `rechargeRate`. Gentle.
//   - REDLINE (drained to exactly 0 by a spend): hard lockout — fuel pinned at 0
//     for `redlineRecovery` seconds (caller disables boost/shield while
//     `redline` is true) — then a FAST sweep-up to full at `redlineRefillRate`
//     (a visible rush, not an instant snap). The punish for over-spending.
//
// Caller computes how much fuel was spent this frame (boost drain + tap + shield)
// and passes it as `spent`; this module applies it and runs all recovery.

export function makeEnergyState(maxFuel = 100) {
  return {
    fuel: maxFuel,
    redline: false,     // true while locked out after a full drain
    _sinceUse: 999,     // seconds since last spend (starts "long ago" so a fresh tank regens)
    _redlineTimer: 0,   // counts down the lockout
    _fastRefill: false, // true during the post-lockout rush to full
  };
}

// Advance one frame. Mutates `state`.
//   spent: fuel consumed this frame by boost/shield (>= 0), computed by caller.
//   c = { maxFuel, rechargeDelay, rechargeRate, redlineRecovery, redlineRefillRate }
export function stepEnergy(state, dt, spent, c) {
  // 1. Apply this frame's spend. Any spend resets the regen delay and cancels a
  //    fast-refill sweep (you chose to burn it instead of letting it fill).
  if (spent > 0) {
    state.fuel = Math.max(0, state.fuel - spent);
    state._sinceUse = 0;
    state._fastRefill = false;
  } else {
    state._sinceUse += dt;
  }

  // 2. Enter redline the moment a spend empties the pool.
  if (!state.redline && spent > 0 && state.fuel <= 0) {
    state.redline = true;
    state._redlineTimer = c.redlineRecovery;
  }

  // 3. Redline lockout: pinned empty, no regen, until the timer expires.
  if (state.redline) {
    state.fuel = 0;
    state._redlineTimer -= dt;
    if (state._redlineTimer <= 0) {
      state.redline = false;
      state._fastRefill = true;   // hand off to the fast sweep-up
    }
    return;
  }

  // 4. Regen (only when not spending this frame).
  if (spent === 0 && state.fuel < c.maxFuel) {
    if (state._fastRefill) {
      state.fuel = Math.min(c.maxFuel, state.fuel + c.redlineRefillRate * dt);
      if (state.fuel >= c.maxFuel) state._fastRefill = false;
    } else if (state._sinceUse >= c.rechargeDelay) {
      state.fuel = Math.min(c.maxFuel, state.fuel + c.rechargeRate * dt);
    }
  }
}

// May the player spend `cost` fuel right now? (boost/shield gate)
// False during redline lockout, or when the pool is too low.
export function canSpend(state, cost) {
  return !state.redline && state.fuel >= cost;
}
