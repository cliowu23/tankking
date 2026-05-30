# Architecture Decision Log

Key decisions made during development — what was chosen, what was rejected, and why.
Newest entries at the top.

---

## 2026-05-30 — Aesthetic pivot: bleak dystopian → bright Mario World

**Decision:** Changed the game's entire visual direction from "Forever Winter bleak dystopian" to "Super Mario World × Escape from Duckov" — bright grass fields, sunshine, saturated primary colors, cheerful and casual.

**What changed:**
- North star: "Beautiful in a bleak way" → "Beautiful in a bright way"
- Ground: near-black checkerboard → bright green grass
- Lighting: dark/cool → warm full sunshine
- Walls: gray → golden yellow (Mario block feel)
- Lava hazard: realistic heat palette → candy pink/magenta
- All documentation and AI generation prompts updated

**What stayed:**
- Tank color palette (cobalt blue / signal red / orange) — already bright, still works
- Menu monochrome — intentional contrast
- CRT transition — still fits the aesthetic
- Bumper-car collision feel — deliberate, not a bug

**Why:** User found the Escape from Duckov / toy soldier direction more fun and accessible. The "bleak" north star was creating friction with the toy/cartoon visual foundation already in place. Bright and cheerful is a better match for a roguelite that rewards repeated runs.

---

## 2026-05-30 — Vertical slice declared complete

**Decision:** All 8 core milestones shipped. Game is playable end-to-end: movement, boost, enemies, lock-on, charge-fire, damage, AI, death/restart.

**Entering:** Design and content phase — environment assets, visual effects, audio, Hangar scene, research tree.

---

## 2026-05-15 — Engine pivot: Phaser 3 → Babylon.js

**Decision:** Switched from Phaser 3 (2D) to Babylon.js 7.54.3 (3D).

**Why:** The game concept evolved toward a true top-down 3D world — tank models with visible turrets and barrels, real barrel elevation for shell arcs, 3D physics. Phaser is a 2D engine and would have required significant workarounds to simulate this. Babylon.js handles it natively and runs in the browser.

**What this meant:** All Phaser scene/entity patterns became Babylon.js Scene/Mesh patterns. The folder structure (scenes/, entities/, systems/) stayed the same conceptually.

---

## 2026-05-15 — Toy/cartoon as base aesthetic

**Decision:** Adopted toy/cartoon as the explicit visual style — chunky proportions, saturated primary colors, flat clear silhouettes.

**Why:** The developer has no 3D modeling background and is working with Babylon.js primitives (boxes, spheres, cylinders). Toy/cartoon reads primitives as intentional design choices rather than unfinished work. It also fits the roguelite loop — bright and approachable, not punishing to look at.

---

## Early dev — Babylon.js primitives over imported models

**Decision:** Build all tank models from Babylon.js primitive meshes (CreateBox, CreateSphere, CreateCylinder) rather than importing external GLTF files.

**Why:** No pipeline dependency (no Blender, no export step), instant iteration, zero file size. The Pershing tank model demonstrated that primitives can produce a good-looking result with careful proportions. External GLTF imports are reserved for environment props (cover objects, terrain) where custom shapes are harder to build from primitives.

---

## Early dev — Plain JavaScript over TypeScript

**Decision:** Keep the codebase in plain JavaScript, no TypeScript.

**Why:** Developer is learning as they build. TypeScript's type system adds cognitive overhead that outweighs the benefits at this project scale and experience level. Can migrate later if scope grows significantly.

---

## Early dev — No test framework

**Decision:** No Jest, Vitest, or other test runner.

**Why:** Game logic is highly stateful and visual. Unit tests don't catch frame-rate issues, physics feel, or rendering bugs. The feedback loop is running the game and playing it. Tests would add tooling overhead without meaningful coverage.

---

## Early dev — AABB collision over Babylon.js physics engine

**Decision:** Use hand-rolled AABB (axis-aligned bounding box) collision instead of Babylon.js's built-in physics engine (Havok/Cannon.js plugin).

**Why:** The game needs precise control over collision behavior — specifically the "bumper-car" ramming feel, the push multipliers, and the friction thresholds. Babylon.js physics would handle this generically and make it harder to tune. AABB with custom response gives full control over every parameter. See PHYSICS_REFERENCE.md for all tuned values.
