# crashcat Physics Engine + Temporary Engine Switch — Design

Issue: [freaxnx01/game-barrel-shooter#9](https://github.com/freaxnx01/game-barrel-shooter/issues/9)

## Problem

Barrels behave fine, but the big stacked structures (Eiffel, Colosseum and
the other multi-piece buildings) collapse in a way that looks wrong. In the
reference recording (2026-10-19):

- **Eiffel:** one tennis ball touches the tower. About two seconds later the
  whole lattice "stands up" and **bursts outward**, with struts flying sideways
  and upward, far beyond any plausible fall. That's 69/69 down from a single
  light hit.
- **Colosseum:** the first light hits do almost nothing. Then a light hit
  **launches** top blocks into the air and off to the side, instead of
  toppling or sliding them off.

Both read as the engine **injecting energy** when many resting contacts are
disturbed at once. It is not a matter of projectile strength.

Kit Racer (`freaxnx01/game-kit-racer`) uses
[crashcat](https://github.com/isaac-mason/crashcat), a JS rigid-body engine
modelled on Jolt, which is built for stable stacking. The user wants Barrel
Blast to use it, with a **temporary** switch between the current engine and
crashcat so the two can be compared in play.

## Current state (as found)

- Everything lives in `index.html` (~2300 lines, one `<script type="module">`).
  Engine: `cannon-es@0.20.0` via import map (`index.html:132-138`). Rendering:
  three.js 0.160.
- About 110 direct `CANNON.*` uses: `Body` with `Box`, `Sphere`, `Cylinder`
  and `Plane` shapes, 6 `Material`s and 13 `ContactMaterial` pairs
  (`index.html:172-190`), `SAPBroadphase`, `allowSleep`, one
  `DistanceConstraint` (wrecking ball, `index.html:1222`), one
  `LockConstraint` (harpoon stick, `index.html:1624`), `collide` events with
  `getImpactVelocityAlongNormal` (`index.html:1380-1390`), `applyImpulse`
  and `applyForce`, and `sleepState`/`wakeUp`.
- Fixed-step loop: `world.step(1/240, dt, 10)` (`index.html:2066`).
- **A workaround layer that fights cannon's instability** (`index.html:476-535`
  and call sites):
  - structures are spawned **STATIC** ("frozen until first impact",
    `index.html:429, 611, 830`);
  - `unfreezeCards()` wakes the whole house of cards on first impact;
  - `wakeNear(center, radius)` flips only nearby frozen pieces to dynamic;
  - `collapseUnsupported()` runs every 120 ms (`index.html:2095`) and
    hand-computes support (oriented-box tests) so floating pieces fall;
  - earthquake, hurricane and magneto also special-case STATIC bodies
    (`index.html:2129, 2149, 2181, 2191`).

  Waking a large frozen lattice whose pieces were placed with slight overlaps
  is a likely contributor to the "stand up, then burst" effect.

## Goals

1. crashcat is available as a second physics engine for the whole game. Every
   structure and every weapon/power works on it, except the joint-based
   carve-out below.
2. **Structures collapse believably on crashcat.** A light hit causes local
   damage. A hard hit topples. Pieces fall and slide, and **nothing launches
   skyward** from a gentle touch. A built structure stands still until hit
   (no creeping, no slow self-collapse).
3. Barrels keep their current feel on crashcat: bounce, friction, how
   pyramids topple.
4. A **temporary engine switch**:
   - an on-screen toggle, styled like the existing buttons (`#reset`,
     `#autoplay`), plus a keyboard shortcut;
   - usable mid-game. Flipping **rebuilds the current structure fresh** under
     the other engine and resets projectiles. In-flight state is not carried
     over;
   - a small always-visible label showing the active engine
     (e.g. `Physics: cannon` / `Physics: crashcat`);
   - the choice persists across reloads (`localStorage`, wrapped in
     try/catch, falling back to the default).
5. The game's existing behaviour on cannon is **unchanged**. The cannon path
   is the regression baseline for the comparison.

## Non-goals

- Removing cannon or the switch. That's a **follow-up issue** once the user
  has compared. Build the switch so removing it later is a small deletion,
  not a refactor.
- Carrying a scene's live physics state across a switch.
- Tuning cannon to behave better.
- New weapons, structures or visuals.

## Anti-goals (would count as failure even if it "works")

- The cannon path behaves differently than today.
- crashcat mode needs the same freeze/wake/support-check hacks to look
  right. If a structure only stands on crashcat with those hacks, that's a
  finding to report, not something to hide.
- The game ships a build step, `package.json` or `node_modules` (stack rule:
  buildless static site).

## Decisions made with the user

- Engine: crashcat, as used by Kit Racer.
- The switch is mid-game. Flipping restarts the current structure on the other
  engine.
- It is acceptable for a few exotic weapons to be current-engine-only during
  the comparison phase.

## Calls made by the designer (not explicitly agreed, so check these)

- **Default engine on first load: cannon (current).** crashcat is opt-in via
  the toggle until the user decides.
- **Shortcut key: `K`.** It's unused (the used keys are 0-9, A C D E G H J L M
  P Q R S U V X, Space and Shift).
- **Carve-out:** only the **harpoon** (`LockConstraint` + reel force) and the
  **wrecking ball** (`DistanceConstraint` pendulum) may be cannon-only if
  crashcat's fixed/distance constraints don't behave. Everything else is
  impulses/forces and must work on both. On crashcat, a carved-out weapon is
  disabled in the UI (button dimmed, key ignored, short tooltip) rather than
  silently broken.
- **crashcat version:** pin an exact version from esm.sh, as Kit Racer does (`https://esm.sh/crashcat@<x.y.z>`). Kit Racer pins
  0.0.3. The latest on npm is 0.0.5. Prefer the latest unless it breaks
  something, and pin it exactly.
- **No freeze hacks on crashcat.** On crashcat, structures spawn as ordinary
  **dynamic bodies, asleep**. `unfreezeCards`, `wakeNear`,
  `collapseUnsupported` and the STATIC special cases stay cannon-only. If a
  structure won't stand still asleep on crashcat, the builder may fix its
  placement (remove overlaps, add a hair of clearance) on both engines only
  if the cannon behaviour stays identical. Otherwise fix it on crashcat only.

- **A structure that won't stand on crashcat is not a hard gate.** Spend a
  bounded effort per structure on placement (clearances, overlaps). If it
  still fails, ship it and list it in the PR with what was tried. The
  comparison is the point, and a documented failure is useful data.
- **Unpaired materials:** pairs without one of the 13 `ContactMaterial`s
  use cannon's default contact (friction 0.3, restitution 0) on crashcat
  too, so the feel matches.
- **Per-body tuning carries over where crashcat has an equivalent**
  (`linearDamping`, `angularDamping`, sleep thresholds, see
  `index.html:321-348, 433, 615, 832`). Otherwise use crashcat defaults.
- **Fast projectiles use crashcat CCD** (`MotionQuality.LINEAR_CAST`), so
  cannonballs, spears, F-16 and the sniper don't tunnel through thin struts
  or cards.
- **crashcat loads lazily** via dynamic `import()` the first time crashcat
  is selected, not as a static import. If it fails (CDN down), the game stays
  on cannon, the toggle shows as unavailable, and one console warning is
  logged. The cannon path must never depend on crashcat loading.
- **Carve-out pass test:** the harpoon stays enabled on crashcat if it
  sticks into a barrel and Space reels the barrel in. The wrecking ball stays
  enabled if it swings as a pendulum from its anchor without jitter or
  energy gain and knocks barrels over. Failing either test means that weapon
  is disabled on crashcat.

## Shape of the solution (left to the builder, with a recommendation)

The switch needs one seam between game code and engine. Recommendation: a
small **physics facade** (a plain object with two implementations, e.g.
`cannonBackend` / `crashcatBackend`, inside `index.html` or in a separate ES
module file if that reads cleaner) that covers exactly what the game uses:

- world: create/destroy, gravity, step(fixed 1/240 with the same accumulator
  semantics), sleep enabled;
- bodies: box / sphere / cylinder / static ground (crashcat has no plane, so
  use a large thin static box), mass, static vs dynamic, position,
  quaternion, linear/angular velocity get/set, `applyImpulse`,
  `applyForce`, wake/sleep query, remove;
- materials: the game keeps its six material *names*. Per-pair friction and
  restitution from the 13 `ContactMaterial` pairs are reproduced on crashcat
  via the listener's `onContactAdded` (`settings.combinedFriction` /
  `combinedRestitution`), with a lookup keyed by the two bodies' material
  names;
- contact events: one callback with (bodyA, bodyB, impact speed along the
  normal). That's what the hit sounds, bomb/dynamite triggers, paintball
  splat, harpoon stick and structure wake logic need. Body removal from
  inside the callback must stay **deferred** (crashcat forbids removal inside
  listener callbacks, and the code already defers it for cannon, see
  `index.html:1417`);
- constraints: distance + fixed, for the two joint weapons;
- a backend-neutral **body list**. The game iterates `world.bodies` for
  explosions, the disruptor, magneto and the earthquake
  (`index.html:1406, 1526, 1560, 2190`).

Game code talks only to the facade. A thinner alternative also works: a
crashcat wrapper that mimics the slice of the cannon `Body` API the game
touches, so most game code stays untouched. The builder picks whichever keeps
the diff smaller and the later "delete the loser" step easier, and says which
in the PR.

Mesh sync (`mesh.position.copy(body.position)`, `index.html:837-838`) must
work with either backend's position/quaternion.

## Acceptance (manual playtest, per stack rules)

On **crashcat**:

- Every structure button builds a structure that stands still until hit.
- Eiffel: a single tennis ball causes local damage at most, not a full burst.
  Repeated hits collapse it progressively, and no strut flies above roughly
  the tower's own height.
- Colosseum: a tennis ball never launches a block skyward. A cannonball or
  bomb topples sections.
- Barrels and pyramid: behaviour comparable to cannon.
- All weapons and powers work except the carve-out. Carved-out ones are
  visibly disabled.
- Blocks-down counter and win detection work. Auto-play can clear the
  default pyramid.

Switch:

- The toggle and `K` flip the engine mid-game. The current structure is
  rebuilt and the label updates.
- The choice survives a reload. The default is cannon when nothing is stored.

Regression:

- On cannon, the game behaves exactly as before.
- Empty console on load and after switching back and forth several times
  (no leaked bodies, listeners or meshes).

## Constraints

- Buildless static site. crashcat comes from a CDN (esm.sh) with an exact
  version pin, loaded by dynamic `import()` (see calls above).
- No new framework, bundler or package files.
- `version.js` / tag rules unchanged (no release in this issue).
