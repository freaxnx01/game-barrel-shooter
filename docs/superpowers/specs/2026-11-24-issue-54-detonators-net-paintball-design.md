# Remote and timed charges, heavy net, paintball colours (#54)

## Intent

Issue #54 asks for three new weapons and a paintball option (German original):

- **Fernzünder** — an explosive charge that goes off when the player presses a button.
- **Zeitzünder** — an explosive charge that goes off after a set time.
- **Schweres Netz** — a heavy net that is thrown and then pulled.
- **Paintball** — a colour choice, or a random mode where every shot has a different colour.

This spec was written unattended (`/enrich 54 --quick`). Every decision not stated in
the issue is recorded as an assumption in the issue body; nothing here was confirmed
in chat.

## Current state (read from the repo)

- Paintball **already exists**: button `index.html:209`, key `P` (`index.html:2560`),
  mass 0.5 / r 0.15 (`index.html:1427`), a single red material `paintMatl` and splat
  material `paintSplatMatl` (`index.html:1239-1240`), and `paintSplat()` paints the hit
  target piece and leaves a blob (`index.html:1754`). So #54 adds colour choice to it;
  it does not add a new paintball.
- Explosions go through `explode(rec, RADIUS = 3, STRENGTH = 320)` (`index.html:1704`);
  bomb uses the default, dynamite `explode(rec, 4.5, 600)` (`index.html:1686`), the
  grenade fuses 1.5 s after launch in the ball loop (`index.html:2858`).
- The harpoon is the existing "throw and pull" weapon: `harpoonStick()` fixes the
  harpoon to one barrel (`index.html:1919`), Space or the mobile 🪝 Pull button sets
  `pulling` (`index.html:2577`, `2627`), and the animate loop draws a rope from a
  launcher point and pulls with `220 * m` (`index.html:2713-2740`).
- Pure weapon tuning lives in `weapons/*.js` with `node:test` tests in
  `test/*.test.mjs` (tire, sniper, football). Run with `node --test test/*.test.mjs`
  (README.md:59).
- Used ammo keys: `1`–`0`, `P L U M G S H E D A C T J X V Q F`, plus `R` reset,
  `Shift` quake, `Space` pull. Free letters include `B`, `K`, `N`, `Z`.
- The picker has 27 weapon buttons today (`grep -c data-type= index.html`).

## Goals

### Remote charge (Fernzünder)

- New ammo **Remote charge**, key **B**, in the *Explosives* group after Dynamite.
- Thrown with a slight arc like the grenade. It does **not** explode on contact; it
  bounces and comes to rest wherever it lands.
- Press **K** (desktop) or the new mobile **💥 Boom** button to detonate **all**
  armed remote charges at once. The Boom button is visible only while at least one
  remote charge is armed.
- At most **6** armed remote charges. Firing a 7th does nothing (no projectile, no
  shot counted).
- Armed remote charges are exempt from the 12 s time cull; they still disappear when
  they fall below y = −5, on detonation and on reset.
- Look: olive-drab brick with a black detonator box, a short antenna and a steady
  green LED.

### Timed charge (Zeitzünder)

- New ammo **Timed charge**, key **Z**, in *Explosives* after Remote charge.
- Thrown like the remote charge, does not explode on contact, explodes **4 s after
  launch**.
- A red LED blinks, faster as the fuse runs down (period from 600 ms to 100 ms).
- Look: olive-drab brick with a black timer box and the red LED.

Both charges explode with radius **4** and strength **500**, between bomb (3/320) and
dynamite (4.5/600).

### Heavy net (Schweres Netz)

- New ammo **Heavy net**, key **N**, in the *Launchers* group after Harpoon.
- Thrown slowly with an arc (heavy, mass 6). On its **first contact with anything** it
  catches up to **6** target pieces whose centres are within **1.6 m** of the net,
  nearest first.
- If it caught something: the net projectile disappears, a draped net mesh covers the
  caught pieces, and a rope runs from the launcher point to them. Hold **Space** or the
  mobile **🪝 Pull** button to drag all caught pieces toward the player (force
  `160 * m` per piece plus gravity compensation, velocity damped by 0.92 per frame,
  like the harpoon). The net lets go when the catch is within 4 m of the launcher
  point, when every caught piece has fallen below y = −5, or on reset / target change.
- If it caught nothing it lies where it landed and is culled like other spent ammo.
- One net at a time: a new net that catches replaces the old one.
- The net and the harpoon can be attached at the same time; Space/Pull pulls both.

### Paintball colours

- Seven colours: red (the current one, default), orange, yellow, green, blue, purple,
  pink, plus **🎲 Random**.
- In Random mode every shot gets a colour that differs from the previous shot's.
- The ball, the splat blob and the painted target piece all use the shot's colour.
- Choice UI: a row of colour swatches directly under the Paintball button, shown only
  while Paintball is selected. Pressing **P** while Paintball is already selected
  cycles to the next choice (… pink → random → red).
- The choice lasts for the session; it is not persisted.

## Non-goals

- Charges sticking to targets.
- Detonating single remote charges, or a configurable fuse time.
- Net physics with cloth simulation or joints between caught pieces.
- Persisting the paint choice, custom colour pickers.
- Translating the UI (the game UI is English-only today).

## Anti-goals

- A charge that explodes on contact (that is the bomb).
- An armed remote charge silently culled after 12 s.
- A paint swatch click that changes the selected weapon, closes the mobile sheet or
  shows up as the selected weapon name in the mobile top bar.
- Auto-Play hanging with remote charges that never go off.

## Architecture

Pure tuning and decision helpers go into three new ES modules with no THREE, no DOM
and no physics, each with a `node:test` file — the same pattern as `weapons/tire.js`,
`weapons/sniper.js` and `weapons/football.js`:

| Module | Exports |
|---|---|
| `weapons/charges.js` | `CHARGE`, `chargeSpeed(power)`, `lobDirection(dir)`, `isFuseDone(bornMs, nowMs)`, `blinkPeriod(elapsedMs)`, `ledOn(elapsedMs)`, `canPlaceRemote(armedCount)`, `armedRemotes(records)` |
| `weapons/net.js` | `NET`, `netSpeed(power)`, `selectCaught(pieces, point)`, `centroid(points)`, `spread(points, centre)`, `pullForce(from, pos, mass)`, `isReeledIn(from, centre)` |
| `weapons/paintball.js` | `PAINT_COLORS`, `RANDOM_PAINT`, `nextPaintChoice(choice)`, `paintIndexForShot(choice, prevIndex, rng)` |

`index.html` wires them in:

- picker buttons, the paint swatch row and its CSS, key bindings `B`, `Z`, `N`, `K`
  and the `P` cycle
- spawn branches in `shootBall()` (shape, mass, speed, mesh, collide handling)
- per-frame work in `animate()`: timed fuse and LED, net drape/rope/pull, Boom button
  visibility
- `detonateRemoteCharges()`, `netCatch()`, `detachNet()`, the mobile `#act-boom`
  button, Auto-Play detonation
- two small extractions shared by harpoon and net: `launcherPoint()` (the
  `(0.6, -0.55, -1.4)` camera-space point, `index.html:2717`) and
  `drawRope(rope, from, to)` (the rope position/orientation/scale/texture-repeat code,
  `index.html:2718-2726`), plus `syncPullButton()`

No physics-facade change: `addBody`, `applyForce`, `applyImpulse`, `setVelocity`,
`getVelocity`, `wake` and `removeBody` already cover everything.

## Decided numbers

| | Value |
|---|---|
| Charge body | box, half extents `[0.16, 0.08, 0.11]`, mass 2, material `'heavy'` |
| Charge launch | direction `normalize(dir + (0, 0.28, 0))`, speed `12 + 14 * power` |
| Charge blast | `explode(rec, 4, 500)` |
| Timed fuse | 4000 ms from launch; blink period `max(100, 600 - 500 * elapsed / 4000)` ms, LED on during the first half of each period |
| Remote cap | 6 armed |
| Net body | sphere r 0.3, mass 6, material `'heavy'` |
| Net launch | direction `normalize(dir + (0, 0.3, 0))`, speed `12 + 12 * power` |
| Net catch | radius 1.6 m, at most 6 pieces, nearest first, only pieces with mass > 0 |
| Net pull | `160 * m` toward the launcher point, `+ 9.82 * m` up, velocity × 0.92 per frame |
| Net release | catch centroid within 4 m of the launcher point |
| Paint colours | red `#e23b3b`/`#d62828` (ball/splat), orange `#f28c28`/`#d9731a`, yellow `#f2d02b`/`#d6b41c`, green `#3bb54a`/`#2e9a3c`, blue `#2f7de1`/`#2266c2`, purple `#9b4fd1`/`#8038b8`, pink `#ff5fa2`/`#e2448a` |

## Testing

- Pure modules: TDD with `node --test test/*.test.mjs` (charges, net, paintball test
  files), every helper covered including edge cases (empty catch, zero distance in
  `pullForce`, random mode never repeating, choice cycle wrap).
- Wiring: a manual playtest checklist per weapon in the plan (serve with
  `python3 -m http.server 8000`), since the repo has no DOM test runner. The existing
  browser harnesses (`test/harness/*.html`) must still pass; none is added.

## Consequences

- The picker grows from 27 to 30 weapons. The hub card on
  `freaxnx01.github.io` mentions a weapon count (commit 7e47593); it may need checking
  after release — not part of this issue.
- `K`, `B`, `Z`, `N` are taken; Space and Pull now mean "pull whatever is tethered".
- Paintball default stays red, so nothing changes for players who never touch the
  swatches.
