# Systems Map

What exists in the code today, what each system owns, and what's next.
Reconciled against the real `src/` tree (domain layout) and the v2 design
(see `CLAUDE.md`): extraction roguelite, classless tank.

---

## Source layout (domain-based)

```
src/core/    engine setup, scene orchestration, menu/death DOM glue   (main.js)
src/tank/    player vehicle + modular GLB parts pipeline
src/combat/  projectiles
src/world/   arena/battlefield, enemies, terrain
src/hub/     bunker/hangar, NPCs (driver), garage/designer, props
src/ui/      HUD/menus — currently inline in index.html (folder empty)
src/utils/   shared helpers (modelPaint.js)
```

---

## Entities & tank

| System | File | Owns | Status |
|--------|------|------|--------|
| Player tank | `src/tank/Tank.js` | Primitive fallback vehicle — movement, boost/dash, turret aim, fire, death | ✅ In use |
| Modular parts pipeline | `src/tank/parts/` | GLB hull/turret/cannon composition; `assembleTank.js` recombines; `PARTS_BY_ID` registry in `index.js` | ✅ Built |
| → Hulls | `parts/hulls/{hull-m26,hull-t44}.js` | Load + paint hull GLBs | ✅ Built |
| → Turrets | `parts/turrets/{turret-m26,turret-t44}.js` | Load + paint + base-measure turret GLBs | ✅ Built |
| → Cannons | `parts/cannons/{cannon-90mm,cannon-t44-100mm}.js` | Load barrel GLBs, adaptive offsets | ✅ Built |
| → Measurement | `parts/measureBase.js`, `parts/measureBasket.js` | Trunnion / basket measurement for adaptive composition | ✅ Built |
| Static enemy | `src/world/Enemy.js` | Hull + turret mesh, health bar, death/reset | ✅ Built |
| AI enemy | `src/world/AIEnemy.js` | `Enemy` base + patrol/chase/fire AI, flat-shot aiming | ✅ Built |
| Shell | `src/combat/Shell.js` | Projectile pool, **flat-shot** (no gravity), hit radius, lifetime | ✅ Built |
| Terrain piece | `src/world/TerrainPiece.js` | Cover/obstacle objects (arena collisions hook in) | ⬜ Hook only |
| Driver character | `src/hub/DriverCharacter.js` | Walking driver in the hub (cosmetic), WASD + follow cam | ✅ Built |

> The old primitive `PershingTank.js` / `T80Tank.js` classes were **removed** —
> superseded by the GLB modular-parts pipeline (M26 Pershing, T-44).

---

## Scenes (actual)

There is no separate `BootScene` / `MenuScene` / `GameOverScene` file. The menu,
pause, and death screens are DOM overlays in `index.html`, driven by `main.js`.

| Scene | File | Owns | Status |
|-------|------|------|--------|
| Orchestrator | `src/core/main.js` | Engine, scene lifecycle, menu/death DOM transitions, deploy flow | ✅ Built |
| Hangar (hub) | `src/hub/HangarScene.js` | Bunker bay: geometry, lighting, stations, lounge, kitchen, driver, tank display, exit door, proximity | ✅ Built |
| Tank designer (garage) | `src/hub/TankDesignerScene.js` | Modular part swapping + adaptive composition preview | ✅ Built |
| Arena (battlefield) | `src/world/ArenaScene.js` | Camera, lighting, ground, environment, sky, hazards, entities, lock-on, flat firing, VFX, game loop | ✅ Built |

---

## Arena sub-systems (inside ArenaScene.js)

| Sub-system | Method(s) | Status |
|------------|-----------|--------|
| Camera (soft follow) | `_setupCamera`, `_updateCamera` | ✅ |
| Lighting / ground / environment / sky | `_setupLighting`, `_setupGround`, `_setupEnvironment`, `_setupSky` | ✅ |
| Hazards (lava pool) | `_setupHazards`, `_checkHazards`, `_updateLavaTex` | ✅ |
| Entity spawn | `_setupEntities` | ✅ |
| Player load (primitive / GLB / composed) | `_loadPlayerGLB`, `_loadPlayerComposed` | ✅ |
| Lock-on targeting | `_setupLockOn`, `_lockOnNearestToCursor`, `_updateLockRing` | ✅ |
| Firing — **flat shot** | `_setupFiring`, `_shoot`, `_barrelTip` | ✅ |
| VFX | `_setupVFX`, `_spawnMuzzleFlash`, `_spawnNormalImpact`, `_spawnTankImpact`, `_updateVFX` | ✅ |
| Collisions (AABB + separation) | `_checkCollisions`, `_checkObstacleCollisions`, `_separate` | ✅ |
| Aim indicator | `_updateAimIndicator` | ✅ |
| Screen shake | `_triggerShake` | ✅ |
| HUD (boost + HP) | `_updateHUD` + CSS in index.html | ✅ |
| Pause / death overlays | `_showDeath` + DOM events + CSS | ✅ |

---

## Hub sub-systems (inside HangarScene.js + helpers)

| Sub-system | Method / module | Status |
|------------|-----------------|--------|
| Bay geometry / room | `_buildRoom`, `_buildBayGeometry` | ✅ |
| Lighting | `_buildLighting` | ✅ |
| Stations + props | `_buildStations`, `_buildBayProps`, `HangarProps.js` (workbench, QM crates, map table, radio shelf) | ✅ |
| Lounge | `buildLounge` (`HangarLounge.js`) | ✅ |
| Kitchen | `buildKitchen` (`HangarKitchen.js`) | ✅ |
| Driver | `_setupDriver` (`DriverCharacter.js`) | ✅ |
| Tank display | `_loadTankDisplay` | ✅ |
| Exit door / floor mark | `_buildExitDoor`, `_buildExitFloorMark` | ✅ |
| Blob shadows | `_setupBlobShadows`, `_blobDrop` | ✅ |
| Proximity interaction | `_checkProximity` | ✅ |

---

## What's next (v2 extraction-roguelite roadmap)

Per the dev priorities in `CLAUDE.md`. None of these exist yet.

| System | Priority | Notes |
|--------|----------|-------|
| Zone structure | High | Starter zone, depth-scaled difficulty, largely fixed enemy positions |
| Loot table | High | Common consumables (ammo/fuel/repair/smoke) + rare parts |
| Extraction mechanic | High | Success (keep gains) vs death (lose run gains, keep tank, pay repair) |
| Classless equip system | High | One tank equips parts from any doctrine; parts found in the world |
| Hub NPC system | Medium | 5 rescuable slots: Mechanic, Merchant, Researcher, Combat Ally, Healer |
| Research tree (stats only) | Medium | Mobility / Health / Armor / Fuel; earned with Research Points |
| Boss (found, not triggered) | Low | Encountered by pushing deep; needs design first |
| Audio | Medium | `src/core/AudioManager.js` (to create) wrapping `BABYLON.Sound` |
