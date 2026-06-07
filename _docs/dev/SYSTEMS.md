# Systems Map

What exists, what each system owns, and what's next.

---

## Entities

| System | File | Owns | Status |
|--------|------|------|--------|
| Player Tank | `src/entities/Tank.js` | Hull + turret mesh, movement, boost, barrel elevation, fire, death state | ✅ Complete |
| Static Enemy | `src/entities/Enemy.js` | Hull + turret mesh, health bar, death state, reset | ✅ Complete |
| AI Enemy | `src/entities/AIEnemy.js` | Enemy.js base + patrol, chase, fire AI behavior | ✅ Complete |
| Shell | `src/entities/Shell.js` | Projectile pool (10 shells), physics arc, hit radius, lifetime | ✅ Complete |
| Pershing Tank (model) | `src/entities/PershingTank.js` | Visual-only reference model, egg turret, 90mm barrel | ✅ Complete |
| T-80 Tank (model) | `src/entities/T80Tank.js` | File on disk, removed from scene — needs redesign before use | ⏸️ Dormant |
| Terrain Piece | `src/entities/TerrainPiece.js` | Placeholder for cover/obstacle objects in the arena | ⬜ Shell only |

---

## Scenes

| Scene | File | Owns | Status |
|-------|------|------|--------|
| Boot | `src/scenes/BootScene.js` | Initial load | ✅ Complete |
| Menu | `src/scenes/MenuScene.js` | Title screen, monochrome intentional | ✅ Complete |
| Arena | `src/scenes/ArenaScene.js` | Camera, lighting, ground, environment, hazards, entities, lock-on, firing, game loop | ✅ Complete |
| Hangar | `src/scenes/HangarScene.js` | Hub — tank builder, research terminal, arena gate | ⬜ Stub |
| Game Over | `src/scenes/GameOverScene.js` | Death / results / return to hangar | ✅ Complete |

---

## Arena Sub-Systems (all inside ArenaScene.js)

| Sub-system | Method | Status |
|------------|--------|--------|
| Camera | `_setupCamera` + soft follow in game loop | ✅ Complete |
| Lighting | `_setupLighting` | ✅ Complete |
| Ground | `_setupGround` | ✅ Complete |
| Environment / walls | `_setupEnvironment` | ✅ Complete |
| Sky + clouds | `_setupSky` | ✅ Complete |
| Hazards (lava pool) | `_setupHazards` + `_updateLavaTex` | ✅ Complete |
| Entity spawn | `_setupEntities` | ✅ Complete |
| Lock-on targeting | `_setupLockOn` | ✅ Complete |
| Charge-to-fire | `_setupFiring` | ✅ Complete |
| Game loop | `_setupGameLoop` | ✅ Complete |
| Collision (AABB) | Inside game loop | ✅ Complete |
| Shell arc preview | Inside firing setup | ✅ Complete |
| Screen shake | `_triggerShake` | ✅ Complete |
| HUD (boost + HP bars) | JS in game loop + CSS in index.html | ✅ Complete |
| Pause / death overlays | JS events + CSS in index.html | ✅ Complete |
| CRT transition | CSS animation in index.html | ✅ Complete |

---

## Empty Folders (no files yet)

| Folder | Intended use |
|--------|-------------|
| `src/systems/` | Cross-cutting concerns — input manager, save state, audio manager |
| `src/utils/` | Shared helpers — math, pooling, etc. |

These are empty because the vertical slice didn't need them. They become relevant when building the Hangar, research tree, and save system.

---

## What's Next (Design Phase)

| System | Priority | Notes |
|--------|----------|-------|
| Arena content — terrain / cover | High | TerrainPiece.js is the hook, needs populating |
| Explosion effects | High | New `src/effects/Explosion.js` — ParticleSystem burst on kill |
| Hangar scene | Medium | Build station UI + research terminal |
| Audio manager | Medium | `src/systems/AudioManager.js` — wraps BABYLON.Sound |
| Save system | Low | localStorage, simple key-value |
| Boss entity | Low | Unique enemy, needs design first |
