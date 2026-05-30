# Physics & Tuning Reference

Living document. Update whenever a variable changes.

---

## Tank Movement (`Tank.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `maxSpeed` | 8 | units/s | Normal cruising cap — top speed with no boost |
| `acceleration` | 6 | units/s² | How fast speed builds when W is held |
| `drag` | 4 | units/s² | Passive deceleration when W/S is not held, below maxSpeed only |
| `rotateSpeed` | 2.1 | rad/s | How fast the hull turns when A/D is held (~120°/s) |
| `mass` | 1 | — | Relative mass used in collision push calculations |

**Full stop from max speed with no input:** ~2 seconds (`8 / 4 = 2`)

---

## Tap Boost / Dash (`Tank.js`)

Triggered: tap Shift (no direction lock required)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `tapCost` | 18 | fuel | Fuel consumed per tap boost |
| `tapDashDist` | 3.0 | units | Distance covered in the dash window |
| `tapDashExit` | 16 | units/s | Speed set when dash ends (forward) |
| dash duration | 0.14 | s | Hard-coded. Velocity = dist / duration = ~21.4 u/s during dash |
| reverse multiplier | 0.8× | — | Reverse tap boost does 80% dist and 80% exit speed |

---

## Spin Boost (`Tank.js`)

Triggered: tap Shift + W + A or D simultaneously

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `spinBoostRad` | 65° (1.134 rad) | rad | Angle the hull rotates during the spin tween |
| `spinBoostExit` | 8.5 | units/s | Speed injected when the spin completes |
| spin duration | 0.24 | s | Hard-coded tween length |
| easing | ease-in-out cubic | — | Smooth start and finish, snappy mid-point |
| `tapCost` | 18 | fuel | Same cost as tap dash |

**Direction:** D = clockwise, A = counter-clockwise

---

## Hold Boost (`Tank.js`)

Triggered: hold Shift

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `holdBoostAccel` | 30 | units/s² | Acceleration while boost is held (fast ramp-up) |
| `boostMaxSpeed` | 18 | units/s | Hard ceiling — cannot exceed this while boosting (2.25× cruising) |
| `holdFuelDrain` | 20 | fuel/s | Fuel burned per second while held. Full tank = 5s max hold |
| reverse multiplier | 0.8× | — | Reverse hold boost: 80% accel, 80% max speed cap |

---

## Boost Momentum (post-release) (`Tank.js`)

After releasing Shift, speed doesn't snap immediately back to `maxSpeed`.

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `momentumDuration` | 0.175 | s | Coast window — speed is fully preserved, no bleed |
| `boostDecay` | 15 | units/s² | Bleed rate once coast ends, until speed reaches `maxSpeed` |

**Full timeline after releasing boost at max speed (18 u/s):**
```
0.0 – 0.2s   coast at 18 u/s (no change)
0.2 – 1.03s  bleed at 12/s² → hits 8 u/s after ~0.83s
1.03s+       normal drag resumes
```

---

## Fuel (`Tank.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `maxFuel` | 100 | fuel | Tank capacity |
| `fuel` | 100 | fuel | Starting value |
| `fuelRecharge` | 18 | fuel/s | Recharge rate when Shift is not held |
| `tapCost` | 18 | fuel | Cost per tap boost or spin boost |
| `holdFuelDrain` | 20 | fuel/s | Drain rate during hold boost |

**Empty → full recharge time:** ~5.6s (`100 / 18`)
**Full tank hold boost duration:** 5s (`100 / 20`)
**Full tank tap boosts available:** 5 (`100 / 18`, rounded)

---

## Fire Control System (`Tank.js` + `ArenaScene.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `dispersion` | 0 | rad | Max random spread applied to azimuth + elevation at fire time. 0 = perfect. Set by equipped FCS module |

**Tier reference:**
| Tier | Value | Feel |
|---|---|---|
| None | `0.07` | Rough, visible spread |
| Basic | `0.03` | Noticeable but manageable |
| Advanced | `0.01` | Tight, near-accurate |
| Perfect | `0` | Exact (current dev value) |

---

## Turret & Barrel (`Tank.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `turretSpeed` | 72°/s (1.257 rad/s) | rad/s | Max traverse rate for both mouse aim and lock-on tracking |
| `turretAimAngle` | world-space radians | rad | Current aim direction — independent from hull rotation |
| `barrelElevation` | 0–50° | rad | How tilted up the barrel is; drives shell arc height |

**Barrel elevation ramp rates (ArenaScene.js):**
- Free-aim charge: 10° → 50° over 1.5s of holding Space
- Lock-on: snaps to correct angle via exponential lerp, rate 10 (`exp(-10 * dt)`)
- Rest return: exponential decay rate 8 when not charging or locked

---

## Shells (`Shell.js` + `ArenaScene.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `SHELL_GRAVITY` | 14 | units/s² | Downward acceleration on shells in flight |
| `HSPEED` | 16 | units/s | Horizontal speed of every shell (hard-coded in `_shoot`) |
| `vy` | derived | units/s | Vertical launch velocity = `tan(elevation) × HSPEED` |
| shell lifetime | 3.5 | s | Shell auto-deactivates after this long regardless |
| shell pool size | 10 | — | Max simultaneous shells in flight |
| `_fireCooldown` | 0.3 | s | Minimum time between shots |
| shell hit radius | 0.25 | units | Collision half-width added to enemy's `halfW` / `halfD` |
| hit y-band | 0 – 1.6 | units | Shell only checks hits while in this height range |
| damage per shell | 34 | HP | Enemies have 100 HP — 3 shots to kill |

**Arc preview:** 20 dots sampled every 0.1s of simulated flight, shown only during free-aim charge (not while locked).

---

## Lock-On (`ArenaScene.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `_fHoldTime` threshold | 0.7 | s | How long F must be held to complete a lock |
| lock ring start scale | 1.9× | — | Ring opens at 1.9× enemy diameter, closes to 1× as lock completes |
| fade-out duration | 0.2 | s | How long old target ring takes to fade away on switch/unlock |
| cancel fade duration | 0.2 | s | Fade-out time when F is released before lock completes |

**Target selection:** nearest enemy to cursor position, not nearest to tank.

---

## Collisions (`ArenaScene.js`)

AABB (axis-aligned bounding box) between tank and each enemy, checked every frame.

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `staticFrictionThreshold` | 1.0 | units/s | Below this impact speed the enemy barely moves |
| tank speed multiplier on hit | 0.2× | — | Tank loses 80% of its speed on impact |
| `pushMult` (first hit) | 2.2 | — | Enemy gets knocked = `impactSpeed × (mass ratio) × 2.2` |
| `pushMult` (already broken) | 3.5 | — | Subsequent hits push harder (static friction already broken) |
| separation ratio | 0.7 / 0.3 | — | 70% of overlap pushed back onto tank, 30% onto enemy |
| enemy drag (fast) | 1.5 | units/s² | Deceleration above 0.4 u/s after being knocked |
| enemy drag (slow) | 120 | units/s² | Near-instant stop below 0.4 u/s (prevents endless slide) |
| tank halfW | 1.2 | units | Half-width of tank collision box |
| tank halfD | 1.6 | units | Half-depth of tank collision box |
| enemy halfW | 1.0 | units | Half-width of enemy collision box |
| enemy halfD | 1.4 | units | Half-depth of enemy collision box |

---

## Camera (`ArenaScene.js`)

Three behaviours combined every frame:

| Variable | Value | Unit | What it does |
|---|---|---|---|
| aim offset strength | 30% | — | Camera target pulled 30% of the way toward cursor |
| aim offset cap | 4.8 | units | Maximum cursor pull distance (1.5 tank lengths) |
| movement lead multiplier | 0.12 | — | Camera leads ahead in travel direction by `speed × 0.12` |
| movement lead cap | 1.5 | units | Maximum lead offset |
| soft follow rate | 7 | — | Exponential lerp rate (`exp(-7 * dt)`) — higher = snappier |

---

## Enemy Health (`Enemy.js`)

| Variable | Value | Unit | What it does |
|---|---|---|---|
| `maxHp` | 100 | HP | Full health |
| damage per shell | 34 | HP | 3 shots to kill |
| health bar width | 2.0 | units | Full-health pixel width of bar |
| color at 100% HP | green | — | RGB transitions to yellow at 50%, red at 0% |

---

## Arena Bounds

Hard wall clamp on both tank and enemies: `±24` units on both X and Z axes (48×48 unit arena). Ground plane is 50×50.

---

## dt cap

The game loop clamps `dt` to a maximum of `0.05s` (20 FPS equivalent) to prevent physics tunnelling if the tab loses focus or lags.
