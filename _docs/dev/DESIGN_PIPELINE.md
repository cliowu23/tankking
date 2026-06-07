# Design Pipeline

Tracks what's been sourced, approved, and built for each design domain.
Update this as assets come in and get integrated.
Aligned to the v2 vision (`_docs/dev/TANKING_RESTRUCTURE2.md`): extraction
roguelite, classless modular tank, bunker hub + deployable zones.

---

## Environment / Arena

**Goal:** Populate zones with cover, terrain variety, and landmarks.
`src/world/TerrainPiece.js` is the hook. (Current build = single arena; v2 zones
not built yet.)

| Asset | Type | Source | License | Status |
|-------|------|--------|---------|--------|
| Ground | Procedural (DynamicTexture) | Babylon.js | — | ✅ Built |
| Boundary walls | Procedural (MeshBuilder) | Babylon.js | — | ✅ Built |
| Clouds | Procedural (sphere puffs) | Babylon.js | — | ✅ Built |
| Lava hazard pool | Procedural | Babylon.js | — | ✅ Built |
| Cover objects / rubble | GLB | Kenney.nl / Quaternius | CC0 | ⬜ Not sourced |
| Wrecked vehicle props | GLB | Sketchfab / Fab | Mixed | ⬜ Not sourced |
| Trees / foliage | GLB | Kenney.nl | CC0 | ⬜ Not sourced |

**Next action:** Browse Kenney.nl kits for cover objects. GLB only.

---

## Hub (bunker)

**Goal:** A warm, lived-in bunker that fills with rescued NPCs.

| Element | File / module | Status | Notes |
|---------|---------------|--------|-------|
| Bay geometry + lighting | `HangarScene.js` | ✅ Built | Room, exit door, floor mark |
| Workbench / QM crates / map table / radio shelf | `HangarProps.js` | ✅ Built | Built via the station-designer pipeline |
| Lounge | `HangarLounge.js` | ✅ Built | Configurable layout |
| Kitchen | `HangarKitchen.js` | ✅ Built | Built via the station-designer pipeline |
| Driver character | `DriverCharacter.js` | ✅ Built | Cosmetic, walks the hub |
| Tank display | `HangarScene._loadTankDisplay` | ✅ Built | Shows the composed modular tank |
| 5 rescuable NPCs | — | ⬜ Not built | Mechanic, Merchant, Researcher, Combat Ally, Healer |

---

## Tank Models (modular parts pipeline)

The tank is composed from interchangeable GLB parts; `Tank.js` is a primitive
fallback. Parts live in `public/assets/models/tanks/`, described by
`public/assets/models/manifest.json`, assembled by `assembleTank.js`.

| Part | File | Source | Status | Notes |
|------|------|--------|--------|-------|
| Hull — M26 | `parts/hulls/hull-m26.js` + `hull-m26.glb` | War Thunder | ✅ In-game | |
| Hull — T-44 | `parts/hulls/hull-t44.js` + `hull-t44.glb` | War Thunder | ✅ In-game | Bisect-extracted via `extract-t44.py` |
| Turret — M26 | `parts/turrets/turret-m26.js` + `turret-m26.glb` | War Thunder | ✅ In-game | |
| Turret — T-44 | `parts/turrets/turret-t44.js` + `turret-t44.glb` | War Thunder | ✅ In-game | |
| Cannon — 90mm | `parts/cannons/cannon-90mm.js` + `barrel-m26-90mm.glb` | War Thunder | ✅ In-game | |
| Cannon — T-44 100mm | `parts/cannons/cannon-t44-100mm.js` + `barrel-t44-100mm.glb` | War Thunder | ✅ In-game | |
| Player fallback tank | `Tank.js` (primitives) | Babylon.js | ✅ In-game | Cobalt box hull |
| Static / AI enemies | `Enemy.js` / `AIEnemy.js` (primitives) | Babylon.js | ✅ In-game | Red / orange box hulls |
| Boss tank | — | — | ⬜ Not started | Found-in-world; needs design |

> Cross-source models break the WT-tuned composition pipeline — keep parts
> War-Thunder-sourced. The old T-55 (cross-source) was fully removed.

---

## Visual Effects

| Effect | Location | Status | Notes |
|--------|----------|--------|-------|
| Muzzle flash | `ArenaScene._spawnMuzzleFlash` | ✅ Built | |
| Normal impact | `ArenaScene._spawnNormalImpact` | ✅ Built | |
| Tank impact | `ArenaScene._spawnTankImpact` | ✅ Built | |
| Lock-on ring | `ArenaScene._updateLockRing` | ✅ Built | Closes as lock completes |
| Aim indicator | `ArenaScene._updateAimIndicator` | ✅ Built | Flat-shot mode |
| Lava glow | `ArenaScene` (GlowLayer) | ✅ Built | |
| Screen shake | `ArenaScene._triggerShake` | ✅ Built | |
| Track marks / damage smoke | — | ⬜ Not built | |

---

## Audio

Nothing sourced yet. **Create `src/core/AudioManager.js` (wraps `BABYLON.Sound`)
before wiring SFX.**

| Asset | Source | License | Status |
|-------|--------|---------|--------|
| Cannon fire / impact / boost SFX | ChipTone | Free | ⬜ Not sourced |
| Explosion SFX | ChipTone / Freesound | Free / CC0 | ⬜ Not sourced |
| Engine rumble | Freesound | CC0 | ⬜ Not sourced |
| UI click SFX | ChipTone | Free | ⬜ Not sourced |
| Background music | Suno | Free tier | ⬜ Not sourced |

---

## UI / HUD

| Element | Status | Notes |
|---------|--------|-------|
| Boost bar | ✅ Built | CSS + JS |
| HP bar | ✅ Built | CSS + JS |
| Death / pause overlays | ✅ Built | DOM overlays in index.html |
| Lock-on ring / aim indicator | ✅ Built | In-scene |
| Hub station panels | ✅ Built | Proximity-triggered |
| Research tree UI | ⬜ Not built | Stats-only tree (Mobility/Health/Armor/Fuel) |
| Extraction / run-results UI | ⬜ Not built | Success vs death split |
| Loot / inventory UI | ⬜ Not built | Consumables + parts |
| Boss health bar | ⬜ Not built | Needs boss design |
