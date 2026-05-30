# Dev Toolkit — TanKING

Reference doc for every tool in your development stack.
Keep this in your project root alongside `CLAUDE.md`, `design-doc.md`, `devlog.md`, and `PROMPTS.md`.

---

## Core Stack

| Tool | Role | Cost |
|------|------|------|
| Babylon.js | 3D game engine (browser-based) | Free |
| Vite | Bundler / dev server | Free |
| JavaScript | Language | Free |
| VS Code | Code editor | Free |
| Claude Code | AI coding partner | Pro subscription |
| Git + GitHub | Version control | Free |

---

## Coding and Mechanics

**Claude Code** is your primary coding partner for all game systems — movement physics, targeting, charge-fire mechanics, boost system, research tree, enemy AI, save data, camera, UI logic. No additional coding tools needed right now.

**Babylon.js Inspector** (already built in)
Press `Shift + Ctrl + I` in your running game to open a live scene graph, material editor, performance panel, and debug overlay. Use this constantly. It is how you see what is actually happening in your 3D scene.

**Chrome DevTools — Performance tab**
Right-click → Inspect → Performance. Catch frame rate drops before they become real problems.

**Babylon.js Playground** — https://playground.babylonjs.com
Online sandbox for testing Babylon.js snippets in isolation before adding to your codebase. Great for experimenting.

---

## 3D Asset Creation

### Modeling Tools

**Blockbench** (free) — https://www.blockbench.net
Start here for custom model work. Simpler than Blender, exports GLTF natively. Designed for low-poly / stylized 3D — great for your chunky mechanical tank aesthetic.

**Blender** (free) — https://www.blender.org
Industry standard open source 3D suite. Even if you mostly use downloaded models, you will constantly need to rescale, reformat, or adjust them. Learn just enough to import, adjust, and export GLTF. The internet has endless beginner tutorials.

**Meshy.ai** (free tier) — https://www.meshy.ai
AI text-to-3D model generation, CC0 licensed. Describe what you want, get a rough model, clean it up in Blender or Blockbench. Good for rapid prototyping when nothing in the libraries fits.

### Open Source Model Sources

| Source | License | Notes |
|--------|---------|-------|
| [Kenney.nl](https://kenney.nl) | CC0 | 40k+ assets, consistent style, some military/vehicle packs |
| [Quaternius](https://quaternius.com) | CC0 | Stylized low-poly packs, military and vehicle content |
| [Polyhaven](https://polyhaven.com) | CC0 | 100% CC0 models, textures, HDRIs, high quality |
| [Sketchfab](https://sketchfab.com) | Mixed | Large library, filter for CC0. Search "sci-fi tank" |
| [itch.io asset packs](https://itch.io/game-assets) | Mixed | Indie creators, lots of sci-fi / gritty content |
| [Fab.com](https://www.fab.com) | Mixed | Free and paid, cross-engine, some excellent stylized military |
| [Free3D](https://free3d.com/3d-models/tank) | Mixed | 222+ free tank models |
| [TurboSquid](https://www.turbosquid.com) | Mixed | 300+ free tank models (check license per model) |
| [OpenGameArt.org](https://opengameart.org) | CC0 / CC-BY | Game-focused, quality varies but has gems |
| [The Base Mesh](https://thebasemesh.com) | CC0 | 900+ CC0 3D models |
| [madjin/awesome-cc0](https://github.com/madjin/awesome-cc0) | — | Curated list of CC0 asset sources across the internet |

⚠️ **File format priority for Babylon.js:** Always download **GLB or GLTF** format. Loads natively with one line of code, handles materials automatically. Avoid FBX where possible — it needs extra conversion steps.

---

## Textures and Materials

**Polyhaven** (free, CC0) — https://polyhaven.com
PBR textures for weathered metal, rust, concrete, industrial surfaces. Good for props and cover objects in the arena. Download, apply in Babylon.js using `PBRMaterial`.

**Materialize** (free) — http://boundingboxsoftware.com/materialize
Converts photos into full PBR material sets (diffuse, normal, roughness, metallic maps). Photograph a real metal surface and get a game-ready material out.

**Krita** (free) — https://krita.org
Best free painting tool for hand-painted texture work. Better than GIMP for painting, GIMP is better for photo editing.

---

## Artistic Direction

### Visual Reference

**PureRef** (free) — https://www.pureref.com
A lightweight app that floats a reference board over all your other apps. Drag in Super Mario World screenshots, Escape from Duckov screenshots, toy soldier references, tank silhouettes, color palettes. Keeps your visual target anchored and visible while you work. Prevents aesthetic drift over a long project. Install this today.

### Concept Exploration

**Midjourney** (~$10/mo) — https://midjourney.com
AI image generation for visual direction. Use prompts like:
> *"stylized toy tank battlefield, bright grass field, colorful, chunky low-poly, Super Mario World aesthetic, cheerful, top-down perspective"*

Use outputs as visual targets, not as final art. Extremely useful for locking down direction before you spend hours building something.

**Stable Diffusion** (free, local) — https://stability.ai
Same capability as Midjourney, runs locally on your machine, completely free. Higher setup overhead.

### UI and Screen Design

**Figma** (free for individuals) — https://www.figma.com
Mock up all UI screens *before* building them in code:
- HUD layout (health, fuel, RP counter, target lock indicator)
- Garage / tank builder screen
- Research tree UI
- Boss encounter screen
- Death / results screen

Design visually first, then hand the mockup to Claude Code. Claude Code can translate a described Figma layout into Babylon.js GUI code. Always design before you build — it is dramatically faster.

---

## Audio

### Sound Effects

**ChipTone** (free, web-based) — https://sfbgames.itch.io/chiptone
Instant SFX generation. Great for cannon fire, boost rumble, metal impact, shell ricochet, explosion, UI clicks.

**BFXR** (free, web-based) — https://www.bfxr.net
Alternative SFX generator, slightly more retro-leaning.

**Freesound.org** (free) — https://freesound.org
Massive library of real and synthetic sounds. Search "tank engine," "shell impact," "artillery explosion." Check license per file — many are CC0 or CC-BY.

**Audacity** (free) — https://www.audacityteam.org
Audio editing for trimming, pitch-shifting, layering, and exporting sounds.

### Music

**Suno** (freemium) — https://suno.com
AI music generation. Describe: *"upbeat casual game soundtrack, cheerful mechanical, bright and playful, light percussion, Super Mario World inspired"* and get a backing track that fits the mood.

**Udio** (freemium) — https://udio.com
Alternative AI music generation.

**Kevin MacLeod / Incompetech** (free, CC-BY) — https://incompetech.com
Curated royalty-free tracks. Has industrial and dark ambient options that could work as placeholder music.

---

## Version Control

**Git + GitHub** — https://github.com
Initialize a Git repo on day one. Commit after every working milestone. This is your undo button. When Claude Code breaks something in session 7, you roll back to session 6.

**GitHub Desktop** (free) — https://desktop.github.com
A visual GUI for Git if the terminal feels intimidating. Does everything you need without memorising Git commands.

**GitHub Projects** (free, built into GitHub)
Kanban board inside your repo. Add milestone tasks, track progress, link to commits.

---

## License Reference

Always check license before using any downloaded asset.

| License | Meaning | Safe for commercial games? |
|---------|---------|---------------------------|
| **CC0** | Public domain. No attribution required. | ✅ Yes, safest option |
| **CC-BY** | Must credit the creator. | ✅ Yes, with attribution screen |
| **CC-BY-SA** | Credit + share derivatives under same license. | ⚠️ Tricky, read carefully |
| **CC-BY-NC** | Non-commercial only. | ❌ No — not for games you sell |
| **Royalty-free** | Usually fine, but read specific terms. | ⚠️ Varies |

---

## The Harness: What Connects It All

### CLAUDE.md
Lives in your project root. Claude Code reads it automatically every session. Contains project context, current milestone, coding conventions, and scope rules. **Update it when:**
- Design decisions change
- A milestone completes
- The engine, stack, or art direction changes
- You add a new major system

### PROMPTS.md (create this)
A running file of prompts that worked well with Claude Code. When Claude Code successfully builds a system, save the prompt. When it fixes a tricky Babylon.js bug, save the solution. Over time this becomes a personal knowledge base — reuse what works instead of rediscovering it.

### design-doc.md
The full game design spec. Reference it when making feature decisions. Update when design changes. Paste relevant sections into Claude Code when implementing specific mechanics.

### devlog.md (create this)
A running log — a few lines after each session:
- What you did
- What worked
- What broke and how you fixed it
- Decisions made

Future-you will thank present-you. Claude Code can reference it too.

---

## Babylon.js 3D Art Pipeline

```
1. Source model
   Sketchfab / Quaternius / Kenney / Meshy.ai
         ↓
2. Adjust if needed
   Blender or Blockbench (rescale, reformat, fix)
         ↓
3. Export as GLB / GLTF
         ↓
4. Source PBR textures
   Polyhaven (metal, rust, concrete, industrial)
         ↓
5. Import + apply in Babylon.js
   SceneLoader.ImportMeshAsync + PBRMaterial
         ↓
6. Light the scene
   Babylon.js Inspector → tweak lights live
         ↓
7. Add particles
   Babylon.js Particle System (explosions, dust, sparks)
```

---

## Priority Install Order

Do these in order — don't get distracted by the full list.

- [ ] **Babylon.js Inspector** — built in, activate with Shift+Ctrl+I today
- [ ] **PureRef** — build your reference board this week
- [ ] **Figma** — mock up the HUD before you build it in code
- [ ] **Blockbench** — first custom model tool to learn
- [ ] **Blender** — one 30-minute GLTF import/export tutorial, nothing more yet
- [ ] **Polyhaven** — bookmark for textures when you reach art phase
- [ ] **GitHub Desktop** — if you are not already comfortable with terminal Git
- [ ] **Midjourney or Stable Diffusion** — for concept exploration when you hit aesthetic decisions
- [ ] **ChipTone** — when you are ready to add placeholder SFX

---

*Last updated: project pivot to Babylon.js 3D top-down — May 2026*
