# Barrel Blast 🛢️💥

A browser-based **3D physics shooting game**. Aim with the mouse and fire projectiles at
destructible targets — a barrel pyramid, a house of cards, a medieval fortress, or a ruined
colosseum — with realistic rigid-body physics, synthesized sound effects, and a score counter.

**▶️ Play it: https://freaxnx01.github.io/game-barrel-shooter/**

## How to Play

| Action | Control |
| --- | --- |
| **Aim** | Move the mouse — the projectile fires toward the cursor |
| **Fire** | Hold left mouse button to charge power, release to shoot |
| **Orbit camera** | Right-click + drag; scroll wheel to zoom |
| **Switch ammo** | Buttons bottom-left, or keys `1`–`9`, `0` |
| **Switch target** | Buttons top-right: Barrels / Cards / Fortress / Colosseum |
| **Reset** | `R` key or the Reset button |

> Designed for desktop browsers with a mouse — not built for touch.

## Game Content

**Ammo types:** basketball, cannonball, bomb (explodes on contact with a blast impulse,
particle flash, and camera shake), tennis ball, bowling ball, spear (flies point-first),
plus a wrecking ball (swings on a chain), a slingshot, and a mini F-16 jet dart.

**Targets:**
- **Barrels** — 21 oil drums stacked in a 6-level pyramid on a platform
- **Cards** — 6-level house of cards (57 cards); spawns asleep so it stands until hit
- **Fortress** — walled castle with gate, battlements, and four corner towers (heavy stone
  blocks, frozen until first impact)
- **Colosseum** — ruined amphitheatre: full ground arcade, partial upper tiers

**Feedback:** score HUD (targets knocked down / total), shot counter, and synthesized
Web Audio sounds (launch whoosh, metal clank, bounce thud, explosion boom).

## Tech Stack

- Single self-contained `index.html` — no build step, no server-side code. Pure static HTML + ES modules.
- [`three@0.160.0`](https://threejs.org/) for 3D rendering, [`cannon-es@0.20.0`](https://pmndrs.github.io/cannon-es/) for physics — both loaded from the jsDelivr CDN via an import map (internet connection required at runtime).
- All textures (oil-drum paint, basketball seams) are generated at runtime on a canvas — no image assets.
- All sounds are synthesized with the Web Audio API — no audio assets.

## Technical Notes

- Physics runs at a fixed **240 Hz** substep to stop fast projectiles from tunneling through thin bodies.
- Stone structures spawn as `STATIC` bodies and convert to dynamic on first projectile impact; cards spawn asleep with clearance gaps to prevent self-collapse.
- Knock-down detection compares each body's quaternion/position against its spawn pose.

## Running Locally

No build needed. Because it uses ES-module imports, serve it over HTTP rather than
opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Credits

Built by [Claude](https://claude.com/claude-code). Published as-is from the design handoff package.
