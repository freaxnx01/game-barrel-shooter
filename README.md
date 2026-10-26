# Barrel Blast 🛢️💥

A browser-based **3D physics shooting game**. Aim with the mouse and fire projectiles at
destructible targets — from a barrel pyramid and a house of cards to stone fortresses,
matchstick towers, and bowling pins — with realistic rigid-body physics, structural-collapse
simulation, synthesized sound effects, and a score counter.

**▶️ Play it: https://github.freaxnx01.ch/game-barrel-shooter/**

## Demo

https://github.com/user-attachments/assets/2247cfbd-09b6-453b-85c5-6ce47a650d7b

## How to Play

| Action | Control |
| --- | --- |
| **Aim** | Move the mouse — the projectile fires toward the cursor |
| **Fire** | Hold left mouse button to charge power, release to shoot |
| **Orbit camera** | Right-click + drag; scroll wheel to zoom |
| **Switch ammo** | Grouped buttons bottom-left, or keys `1`–`9`, `0`, plus `S` (soccerball), `P` (paintball), `L` (lightning), `U` (hurricane), `M` (magneto), `G` (grenade), `H` (hammer) |
| **Switch target** | Buttons top-right: Barrels / Cards / Fortress / Colosseum / Pyramid / Tower Gate / Gate / Spiral Stair / Pole Tower / Octagon / Crosses / Eiffel / Bowling / Cylinder |
| **Earthquake** | Hold `Shift` to shake the ground |
| **Reset** | `R` key or the Reset button |

> Designed for desktop browsers with a mouse — not built for touch.

## Physics engine

Physics runs on [crashcat](https://github.com/isaac-mason/crashcat), a Jolt-style
rigid-body engine built for stable stacking, loaded from
`https://esm.sh/crashcat@0.0.5`. Structures spawn asleep and stand still until
hit. The original engine, cannon-es, was compared against it during
[#9](https://github.com/freaxnx01/game-barrel-shooter/issues/9) and removed in
[#20](https://github.com/freaxnx01/game-barrel-shooter/issues/20).

Tests: `node --test test/*.test.mjs` runs the pure-module tests (no
`package.json`; `node --test test/` does not work on Node 24). The physics
backend contract runs in the browser: serve the repo and open
`test/harness/physics-contract.html` (title becomes `CONTRACT PASS`/`FAIL`).

## Game Content

**Ammo (grouped in the bottom-left picker):**
- *Balls* — basketball, soccerball, tennis ball, bowling ball, cannonball
- *Explosives* — bomb (explodes on contact), grenade (timed fuse), paintball (splats)
- *Heavy & melee* — wrecking ball (swings on a chain), hammer (tumbles end-over-end), spear (flies point-first)
- *Launchers* — catapult (high lobbed rock), slingshot (fast pellet), mini F-16 (flies nose-first)
- *Powers* — lightning (strikes the aim point), hurricane (wandering tornado funnel that lifts debris), magneto (hold left mouse to gather pieces toward the cursor)

**Targets:** barrel pyramid on a platform; 6-level house of cards; stone fortress and ruined
colosseum; step pyramid; tower gate; gate wall; spiral staircase; pole tower; octagon tower;
stacked crosses; Eiffel-style matchstick truss; bowling pins; cylindrical brick tower.

**Feedback:** score HUD (targets knocked down / total), shot counter, and synthesized
Web Audio sounds (launch whoosh, metal clank, bounce thud, explosion boom, thunder, wind).

## Tech Stack

- Single self-contained `index.html` — no build step, no server-side code. Pure static HTML + ES modules.
- [`three@0.160.0`](https://threejs.org/) for 3D rendering (jsDelivr, via an import map) and [`crashcat@0.0.5`](https://github.com/isaac-mason/crashcat) for physics (esm.sh) — internet connection required at runtime.
- All textures (oil-drum paint, basketball seams) are generated at runtime on a canvas — no image assets.
- All sounds are synthesized with the Web Audio API — no audio assets.

## Technical Notes

- Physics runs at a fixed **240 Hz** substep to stop fast projectiles from tunneling through thin bodies.
- Structures spawn asleep and stay put until something hits them; a moving body wakes whatever sleeps next to it, so pieces whose support is knocked away fall instead of hanging in mid-air.
- Block-built stone buildings use a lighter, lower-friction `masonry` material, and explosions are tuned for crashcat's stiff stacking, so weapons can break walls whose blocks are pinned by the weight above them (#22).
- Knock-down detection compares each body's quaternion/position against its spawn pose.

## Running Locally

No build needed. Because it uses ES-module imports, serve it over HTTP rather than
opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open the local `index.html` in your browser of choice. No python or web server needed.

## Credits

Built by [Claude](https://claude.com/claude-code). Published as-is from the design handoff package.
