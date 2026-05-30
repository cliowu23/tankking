# Design Pipeline

Tracks what's been sourced, approved, and built for each design domain.
Update this as assets come in and get integrated.

---

## Environment / Arena

**Goal:** Populate the arena with cover objects, terrain variety, and visual landmarks. `TerrainPiece.js` is the hook.

| Asset | Type | Source | License | Status |
|-------|------|--------|---------|--------|
| Ground | Procedural (DynamicTexture) | Built in Babylon.js | — | ✅ Built |
| Boundary walls | Procedural (MeshBuilder) | Built in Babylon.js | — | ✅ Built |
| Clouds | Procedural (sphere puffs) | Built in Babylon.js | — | ✅ Built |
| Lava hazard pool | Procedural (cellular automaton) | Built in Babylon.js | — | ✅ Built |
| Cover objects / rubble | 3D models (GLB) | Kenney.nl / Quaternius | CC0 | ⬜ Not sourced |
| Wrecked vehicle props | 3D models (GLB) | Sketchfab / Fab.com | Mixed | ⬜ Not sourced |
| Trees / foliage (grass biome) | 3D models (GLB) | Kenney.nl | CC0 | ⬜ Not sourced |

**Next action:** Browse Kenney.nl "Graveyard Kit" and "City Kit" packs for cover objects. Download GLB format only.

---

## Tank Models

| Model | File | Style | Status | Notes |
|-------|------|-------|--------|-------|
| Player tank | `Tank.js` (primitives) | Cobalt blue, basic box hull | ✅ In-game | Geometry upgrade queued (Pershing-quality) |
| Static enemy | `Enemy.js` (primitives) | Signal red, basic box hull | ✅ In-game | Geometry upgrade queued |
| AI enemy | `AIEnemy.js` (primitives) | Orange, basic box hull | ✅ In-game | Geometry upgrade queued |
| Pershing reference | `PershingTank.js` | Toy green, egg turret, 90mm barrel | ✅ Built | Approved — template for geometry upgrades |
| T-80 reference | `T80Tank.js` | Removed from scene | ⏸️ Dormant | Needs redesign |
| Boss tank | — | TBD | ⬜ Not started | Needs design decision first |

---

## Visual Effects

| Effect | File | Status | Notes |
|--------|------|--------|-------|
| Shell arc preview dots | ArenaScene.js | ✅ Built | Golden-orange dots |
| Lock-on ring | ArenaScene.js | ✅ Built | Red glowing ring, closes as lock completes |
| Lava glow | ArenaScene.js (GlowLayer) | ✅ Built | Candy pink/magenta palette |
| Explosion on kill | `src/effects/Explosion.js` | ⬜ Not built | ParticleSystem burst — high priority |
| Track marks | — | ⬜ Not built | Decals on ground |
| Damage smoke | — | ⬜ Not built | Particle trail when HP low |

---

## Audio

| Asset | Type | Source | License | Status |
|-------|------|--------|---------|--------|
| Cannon fire SFX | Generated | ChipTone | Free | ⬜ Not sourced |
| Boost / dash SFX | Generated | ChipTone | Free | ⬜ Not sourced |
| Shell impact SFX | Generated | ChipTone | Free | ⬜ Not sourced |
| Explosion SFX | Generated or real | ChipTone / Freesound | Free / CC0 | ⬜ Not sourced |
| Engine idle / rumble | Real | Freesound | CC0 | ⬜ Not sourced |
| UI click SFX | Generated | ChipTone | Free | ⬜ Not sourced |
| Background music | AI generated | Suno | Free tier | ⬜ Not sourced |

**Audio manager not built yet.** Create `src/systems/AudioManager.js` before wiring up any SFX.

---

## UI / HUD

| Element | Status | Notes |
|---------|--------|-------|
| Boost bar | ✅ Built | CSS + JS, cyan-blue `#2277ff` |
| HP bar | ✅ Built | CSS + JS, green→yellow→red formula |
| Death overlay | ✅ Built | Semi-transparent, "YOU DIED" |
| Pause overlay | ✅ Built | Semi-transparent, "PAUSED" |
| Lock-on ring | ✅ Built | 3D mesh in scene |
| Shell arc preview | ✅ Built | 3D dots in scene |
| Hangar build UI | ⬜ Not built | Figma mockup first, then code |
| Research tree UI | ⬜ Not built | Figma mockup first, then code |
| Boss health bar | ⬜ Not built | Needs boss design first |

---

## Concept Art / Visual Direction

| Target | Tool | Status | Notes |
|--------|------|--------|-------|
| Arena environment | DiffusionBee | ⬜ Not generated | Prompt ready in TOOLS_ACTIVATION.md |
| Player tank | DiffusionBee | ⬜ Not generated | Prompt ready in TOOLS_ACTIVATION.md |
| Overall mood | DiffusionBee | ⬜ Not generated | Prompt ready in TOOLS_ACTIVATION.md |
| Hangar interior | DiffusionBee | ⬜ Not generated | Generate before building HangarScene |
| Boss design | DiffusionBee | ⬜ Not generated | Generate before building boss entity |
