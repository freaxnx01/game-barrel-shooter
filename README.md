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
| **Orbit camera** | Right-click + drag, arrow keys, or the pad bottom-right (hold to keep turning); scroll wheel or the pad's `+`/`−` to zoom. On a Chromebook touchpad, Alt + press and drag works as right-drag |
| **Switch ammo** | The 💥 button top-left opens the weapon list (🎯 for targets), or keys `1`–`9`, `0`, plus `S` (soccerball), `P` (paintball; `P` again cycles the colour; picking Paintball in the list keeps it open for the colour swatches, and the dot next to 💥 shows the colour and cycles it), `L` (lightning), `U` (hurricane), `M` (magneto), `G` (grenade), `H` (hammer), `T` (tractor tire), `F` (American football), `B` (remote charge), `Y` (cutting charge), `Z` (timed charge), `N` (heavy net) |
| **Switch target** | Grouped buttons top-right — *Stacks:* Barrels / Wooden Barrels / Cards / Bowling · *Stone:* Fortress / Colosseum / Pyramid / Gate / Tower Gate / Arch Gate / Double Gate / Castle Gate / Small Castle Gate · *Towers:* Cylinder / Octagon / Pole Tower / Brick Box / Brick Tower / Jenga / Chimney / Demolition Tower · *Frames:* Spiral Stair / Spiral Tower / Frame Tower / Frame Block / Frame High-rise / Frame Hall / Crosses / Eiffel |
| **Earthquake** | Hold `Shift` or the 🌋 Quake button bottom right to shake the ground |
| **Pull / Cut** | Hold Space or the 🪝 Pull button to reel a harpoon or net in; `O` or the ✂️ Cut button lets it go. The buttons sit bottom right and show only while a harpoon or net holds something |
| **Detonate** | `K` or the 💥 Boom button (bottom right, shown while remote and cutting charges are placed, with their count) blows up all placed remote and cutting charges. The small ▸ next to it opens buttons `1`..`6` that blow up just that charge; each placed charge shows its number floating above it |
| **Jenga: push a block** | On the Jenga target, hold the left mouse button on a block: it slides slowly out along its length, away from where you pressed; let go to stop. Blocks under the whole tower (the bottom layer) stick. The 🔫 Shoot button under Auto-Play switches to the normal weapons and back (✋ Push) |
| **Reset** | `R` key or the Reset button |

The 🎯 and 💥 buttons top-left open the target and weapon lists as a sheet on every screen size; pick an entry, click outside, or press `Escape` to close it.

### On a phone or tablet

On small or touch screens (`max-width: 900px` or a coarse pointer) the game switches to
a mobile mode; the desktop layout is unchanged.

| Action | Touch control |
| --- | --- |
| **Aim / fire** | Tap and hold on the scene to charge, let go to fire |
| **Orbit / zoom** | Drag with two fingers to orbit, pinch to zoom (a second finger cancels a charge without firing); the smaller pad bottom-right still works |
| **Switch weapon / target** | The 💥 and 🎯 buttons at the top open the list as a sheet; tap an entry to pick it, tap outside to close |
| **Earthquake** | Hold the 🌋 Quake button bottom-left |
| **Harpoon / net pull** | Hold the 🪝 Pull button, or tap ✂️ Cut to let the catch go; both show while a harpoon or net holds something |
| **Detonate** | Tap the 💥 Boom button bottom-left (shown while remote and cutting charges are placed, with their count) to blow up all of them; tap the ▸ next to it, then a number `1`..`6`, to blow up just that charge |
| **Jenga: push a block** | Tap and hold a block; a second finger cancels the push. The 🔫 Shoot button in the top bar switches to the weapons |
| **Help** | `?` shows the touch controls |

In portrait the camera starts far enough back for wide targets (Fortress, Colosseum, Pyramid, …) to fit
the screen, and turning the phone re-fits the view.

"Add to Home Screen" installs it as a fullscreen app (`manifest.webmanifest`, icons in `icons/`, including a
maskable one for Android launchers). iOS Safari has no install button, so on an iPhone or iPad in the browser
a dismissible tip below the top bar shows the route, **Share ⬆ → Add to Home Screen**, and the `?` panel repeats it
(`pwa/iosinstall.js`). It never shows in the installed app or on other devices.

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
`test/harness/barrel-support.html` checks that barrels which lose their support topple (title `SUPPORT PASS`/`FAIL`).
`test/harness/jenga.html` checks the Jenga push: the tower stands, single blocks slide out, the
bottom layer sticks and pushing out a whole layer ends the round (title `JENGA PASS`/`FAIL`).
`test/harness/magneto-hum.html` renders the Magneto hum with an OfflineAudioContext and checks it is
audible, does not clip, rises with held pieces and fades out within 0.2 s (title `HUM PASS`/`FAIL`).
`test/harness/football-flight.html` checks the American football: nose along the flight path, spin,
irregular bounces, mass and barrels per hit (title `FOOTBALL PASS`/`FAIL`).
`test/harness/chimney.html` checks the brick chimney: it stands still, one dynamite charge at the foot brings it down and a light ball does not (title `CHIMNEY PASS`/`FAIL`).
`test/harness/demolition.html` checks the demolition tower: it stands still, four charges on the ground-floor columns pancake it into its footprint (remote and cutting charge), one charge does not bring it down (title `DEMOLITION PASS`/`FAIL`).

## Game Content

**Ammo (grouped in the bottom-left picker):**
- *Balls* — basketball, soccerball, tennis ball, bowling ball, cannonball, American football (a light 0.4 kg spiral pass that flies nose-first and hops off unpredictably when it lands; it tips single barrels rather than clearing the pyramid)
- *Explosives* — bomb (explodes on contact), grenade (timed fuse), paintball (colours the piece it hits without moving it; pick a colour or 🎲 random), remote charge (flies straight to the crosshair and lies still until you press K / Boom; up to 6), cutting charge (like the remote charge, numbered, detonated with K / Boom, but a 1.2 m blast with no upward kick that shoves the piece it sits on sideways, for a controlled demolition; shares the 6-charge limit), timed charge (flies straight to the crosshair, explodes 4 s after the throw, LED blinks faster)
- *Heavy & melee* — wrecking ball (swings on a chain), hammer (tumbles end-over-end), spear (flies point-first), tractor tire (rolls into the target, slows, and tips over)
- *Launchers* — catapult (high lobbed rock), slingshot (fast pellet), mini F-16 (flies nose-first), sniper lens (key Q: a round scope at the cursor shows the target 5× magnified with a reticle; the tracer flies dead straight to its centre), heavy net (a 4 m rope net that drapes over what it catches like cloth, up to 14 pieces, hold Space / Pull to drag them in, O / Cut to let go)
- *Powers* — lightning (strikes the aim point), hurricane (wandering tornado funnel that lifts debris), magneto (hold left mouse to gather pieces toward the cursor)

**Targets:** barrel pyramid on a platform; 6-level house of cards; stone fortress and ruined
colosseum; step pyramid; tower gate; gate wall; spiral staircase; pole tower; octagon tower;
stacked crosses; Eiffel-style matchstick truss; bowling pins; cylindrical brick tower; arch, double
and castle gates; hollow brick box and brick tower; four post-and-beam frame buildings; spiral
tower; Jenga tower of 18 crosswise layers of 3 wooden blocks, where you push blocks out
instead of shooting (the HUD counts blocks pulled; the round ends when the tower falls);
tall brick industrial chimney, tapering to a soot-blackened top, that tips over and breaks apart
when hit at the foot; a six-storey demolition tower of concrete slabs on slim columns that
pancakes into its own footprint, its columns bursting into rubble and dust, when charges take out
all four ground-floor columns at once.

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

Building designs for the frame buildings, brick towers, gates and spirals are adapted from the
Android game *Physics Simulation Building Destruction* (#24); the layouts are rebuilt from scratch.
