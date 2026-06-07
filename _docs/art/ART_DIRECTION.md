# TanKING — Art Direction (DECIDED)
> Authoritative visual spec. Two separate aesthetic systems that intentionally contrast: a bright cheerful gameplay world, and a dark retro-futurist UI layer. Preserved from the original CLAUDE.md.

---

## Gameplay World — Bright & Cheerful

**North star: "Beautiful in a bright way — a battlefield that feels like a game, not a war."**

Aesthetic references: **Super Mario World × Escape from Duckov × toy soldier.** Bright, casual, cheerful. Grass fields, sunshine, saturated primary colors. Still a battlefield, but inviting rather than oppressive.

- Saturated, confident primary colors — toy soldier plastic, not military drab
- Shapes slightly chunkier / more exaggerated than real proportions
- Bright green grass ground, clear blue sky, warm sunshine lighting
- Tank colors pop hard against the green (blue player, red enemy, orange AI)

## UI / HUD — Retro-Futurist (Tron)

The overlay layer (menus, HUD, overlays) lives in a different register: dark, geometric, neon-lit. Like looking through a targeting computer at a toy battlefield.

- Primary neon: `#00e5ff` (electric cyan), danger: `#ff2060`, hull: `#00ff88`
- Panel background: `rgba(0, 8, 20, 0.93)`, body: `#000810`
- 1px neon borders with glow, dark navy panels — no chrome or decoration
- Thin (5px) glowing bar for HUD meters
- Monospace, uppercase, wide letter-spacing throughout
- Subtle CRT scanlines overlay on full screen (very low opacity)
- One accent color only — cyan. Everything else is dark or glowing text.
- **The menu's monochrome look is intentional — do not change.**

## Approved Color Palette

| Element | Color |
|---------|-------|
| Player tank hull | Cobalt blue `(0.12, 0.42, 0.88)` |
| Player tank turret | Deep cobalt `(0.08, 0.32, 0.75)` |
| Static enemy | Signal red `(0.92, 0.12, 0.08)` |
| AI enemy | Orange `(0.95, 0.42, 0.04)` |
| Shell | Yellow `(1.0, 0.82, 0.0)` with orange emissive |
| Tracks | Near-black `(0.12, 0.12, 0.12)` |
| Ground | Two-tone bright grass `#4db33d` / `#43a035` |
| Walls | Golden yellow `(0.95, 0.82, 0.30)` — Mario block feel |
| Sky | Bright Mario blue `(0.48, 0.78, 1.0)` |
