# Demolition tower that collapses into itself (#86)

## Intent

Playtest wish: a building for a **controlled demolition**. Charges at the base bring it down
into its own footprint, the floors pancaking straight down, with nothing blown off the top.
Decided in the issue: a new target, heavy floor slabs on slim columns, several storeys, stable at
rest. It must work with the current remote charge (radius 4, strength 500, lift 0.3) placed on
the ground-floor columns, and with the cutting charge that #87 adds (radius about 1.2, no lift).

## Goals

- New pure module `targets/demolition.js` with the layout and the two collapse rules as pure
  helpers, unit-tested in `test/demolition.test.mjs`.
- New target `demolition` ("Demolition Tower") in the *Towers* group of the target picker, with
  its own camera preset.
- Four charges, one on each ground-floor column, detonated together, bring the whole tower down
  as a flat stack of slabs within its footprint: the top slab lands within about 2 m (x/z) of its
  start, no slab ends outside the footprint, every block counts as down (30/30).
- The untouched tower stands still (all woken, less than 1 cm in 10 s).
- One charge alone does not bring it down; charges on one side only make it fall to that side.
- A crushed column does not just vanish: it bursts into a few small debris chunks and a short
  dust puff (user decision, 2026-11-26), without slowing or jamming the pancake.
- A physics harness `test/harness/demolition.html` with these checks (title `DEMOLITION PASS`).

## Non-goals

- No change to `explode()` numbers, to `weapons/charges.js`, or to any other target.
- No cutting charge here: that is #87. This target only has to work with it.
- No physics debris: rubble is visual only and never collides with anything.
- No per-target short link: the game has no URL parameter for the target, so there is nothing
  to add (the hub's `freax.games/<name>/` short links are per game, not per target).

## Anti-goals (a failure even if it technically works)

- The upper floors fly off when the base is blasted.
- The tower tips over like a tree, or sits down one storey and stays standing on the rest.
- The untouched tower creeps or sags, or a ball hit at the top collapses it.

## Why geometry alone is not enough (measured)

Measured during enrichment on the real crashcat backend (scratch harness, same body spec as
`addBlock`: TSCALE 2, masonry, `MASONRY_MASS_SCALE` 0.25, ground storey charges on the +z face):

- 18 geometries of slabs on 2×2, 2×3 and 3×3 column grids (column width 0.3-0.6, storey height
  2-2.5, 4-6 storeys, 1-3 segments per column, heavier slabs), each with 6-8 charge placements.
  None pancaked. With rigid boxes a column never fails: either the ground storey goes and the
  rest **sits down one storey** and stays standing, or a column ends up under the falling slab
  and the whole stack **tips over** (top slab 5-30 m away).
- Friction pins a loaded column: a charge on the face of a column pushes it inward under the
  slab, and the friction under some 600 kg of building stops it after a few decimetres, so it
  keeps holding that corner while the others are gone. A 1.2 m blast without lift (the #87 shape)
  freed a loaded column in only 1 of 8 placements.
- Scripted helpers that keep the bodies (kick crushed columns outward, or make them slippery)
  pancaked, but threw columns 6-50 m and still tipped over in 3 of 8 runs.

So the tower gets two simple collapse rules on top of the geometry.

## Collapse rules (decided)

Both rules apply only while the demolition tower is the target.

1. **A charge crushes the column it sits on.** Every `explode()` crushes each column whose
   vertical axis is within `DEMO.breakRadius` = 1.0 (world units) of the blast centre. A charge
   stuck on a column face sits 0.38-0.5 from its axis; the next column is 6 away, so it is one
   column per charge. Bomb, grenade and dynamite count too (an explosion is an explosion).
2. **A landing slab crushes the columns standing on it.** Per frame, each slab feeds its vertical
   velocity to `slabLanded(state, vy)`: once it has fallen faster than `DEMO.fallSpeed` 1.5 and
   is slower than `DEMO.landSpeed` 0.5 again, it has landed, and every column of the next storey
   up is crushed. That storey's slab then falls onto it, lands, and so on up the tower: the
   floors pancake one after another (slabs land at about 0.7, 1.1, 1.4, 1.8, 2.1 and 2.5 s).

**Crushing a column** (`crushColumn` in `index.html`): it stays in `barrels`, so the HUD total
stays 30, but leaves the simulation: `phys.stopColliding` (the #78 primitive), gravity factor 0,
velocity 0, moved to y = -50 under its home, mesh hidden, `down = true`. Then every tower body is
woken, because crashcat would leave a sleeping slab hovering when its support vanishes.
A harpoon tethered to that column is detached. A charge stuck on it follows the joint below the
ground and is culled by the existing `y < -5` rule.

## Debris and dust (decided, user request)

The user approved the scripted rules with one addition: a crushed column must break into debris
and dust instead of disappearing. Measured above, anything that collides under the slabs gets
pinned by friction and load, so the debris is **visual only**: no physics bodies.

- `crushColumn` calls `spawnDebris(centre, hx, hy, hz)` with the column's world position and half
  extents (from `mesh.scale`), before the body is parked below the ground.
- Pure part in `targets/demolition.js`: `DEBRIS` constants, `debrisChunks(c, hx, hy, hz, seed)`
  (5 chunks spread up the column, size 0.6-1.1 × the column's half width, thrown outward at
  1.5-4.5 with up to 2 upward and a random spin; seeded Park-Miller, no `Math.random`),
  `stepChunk(ch, dt)` (gravity, ground bounce keeping 30 % vertical and 60 % horizontal speed,
  settles once a bounce would be slower than 1), `chunkScale(age)` (1, shrinking to 0 over the
  last of its 4 s) and `dustPuff(age)` (radius factor 1 → 3, opacity 0.5 → 0 over 1.2 s, then null).
- In `index.html`: chunks are `THREE.Mesh(unitBoxGeo, demoColumnMatl)` (shared geometry and
  material, nothing disposed); a puff is one `THREE.Mesh(dustGeo, dustMatl.clone())` sphere,
  whose cloned material is disposed when it ends. `updateDebris(dt)` runs from `animate()`
  while anything is alive; `clearDebris()` runs from `clearTargets()`.
- Cost: at most 24 × 5 = 120 chunks and 24 puffs; allocations only when a column is crushed.
- Chunks fly through slabs where they overlap them (no collisions); at the speeds and the 0.2-0.35
  sizes involved that is not noticeable in play.

Checked headless in the real game: up to 120 chunks and 16 puffs alive at once, all gone about
4 s after the last crush, the collapse unchanged (top slab ended at 15 % of its height, 30/30),
no console errors, and nothing left after switching to another target.

## Shape (decided, builder must follow)

Base units; `addBlock` multiplies by `TSCALE` 2 (the mode is not in the TSCALE 1 list).

| Constant | Value | In game | Note |
|---|---|---|---|
| `storeys` | 6 | | |
| `grid` | 2 | 4 columns per storey | one charge per column, 4 of the 6 remote charges |
| `pitch` | 3 | 6 m | a remote blast at one column does not reach the next (> 4) |
| `column` | 0.3 | 0.6 m square | slim: 1 : 4.2 |
| `storeyHeight` | 1.25 | 2.5 m | column length |
| `slabThickness` | 0.25 | 0.5 m | one slab per storey: cleanest pancake |
| `overhang` | 0.25 | 0.5 m | slab half extent 1.9, slab 7.6 m square |
| top | 9 | 18 m | like Frame High-rise |

30 bodies: 24 columns, 6 slabs. Columns stand exactly on the slab below (vertical contact, no
gap, like the chimney's `ROW_GAP` 0); horizontally nothing touches, so #9's clearance is moot.
Mass via `massFor` (170 × volume) then `MASONRY_MASS_SCALE`: slab 153 kg, column 4.8 kg (32 : 1).

**Look:** columns `#8f8b84`, slabs `#c4c0b8`, both `MeshStandardMaterial` roughness 0.9-0.95,
flat shaded (concrete). Impact sounds as for all `addBlock` targets (`stone`).

## Integration in `index.html`

- Import `DEMO, demolitionLayout, distToColumnAxis, slabLanded` from `./targets/demolition.js`.
- `setupDemolition()` places the layout at zC -6 via `addBlock` and tags each `barrels` entry
  with `demo = { part, storey, hy (world), state: {} }`.
- `camCfg.demolition = { r: 24, ty: 4.5, tz: -6, plat: false, build: setupDemolition }`.
  Checked headless: the whole tower is in view at 1280×720 (top about y 180, base y 548) and at
  390×844 (top y 211, base y 640, clear of the HUD and the Quake button).
- Picker: `<button data-mode="demolition">Demolition Tower</button>` after Chimney in *Towers*.
- `explode()`: `if (targetMode === 'demolition') crushNear(p);` right after `p` is computed,
  before the impulse loop, so a crushed column gets no impulse.
- `animate()`: `if (targetMode === 'demolition') updateDemolition();` before the
  "sync barrels + detect knocked-over" loop.
- HUD label stays "Blocks down"; a full collapse reads 30/30 and triggers the existing win state.

## Measurements with the decided shape and rules

Harness `test/harness/demolition.html` (DEMOLITION PASS in 2.3 s headless):

| Check | Result | Pass if |
|---|---|---|
| stable (all woken, 10 s) | max displacement 0.0027 | < 0.01 |
| remote, all 4 columns, charge at 50 % | top slab 0.90 from home, at 15 % of its height, 30/30 down | < 2.5, < 25 %, all down, slabs in footprint |
| remote at 25 % | 1.34, 15 %, 30/30 | same |
| remote at 75 % | 1.94, 15 %, 30/30 | same |
| cutting (1.2 / 500 / no lift) at 50 % | 0.50, 15 %, 30/30 | same |
| one remote charge | top slab at 100 % | > 95 % |
| front two columns only (info) | top slab 4.73 away, falls forward | info |

Scratch harness, 24 random placements (height 15-85 % of the column, sideways up to 80 % of its
half width): remote 23/24 pancakes (top slab 0.2-2.2 from home), cutting 23/24 (0.5-2.2), no slab
outside the footprint in the passing runs. In the real game (1280×720, four charges through
`explode()` in one frame) the tower ended as a stack, top slab 1.8 m from home, 30/30 down.

**What the radius-4 remote blast does to the floors above:** the slab centres are at least 4.5
from any ground-column charge, so the slabs get no impulse at all. The first-floor columns get a
nominal kick (12, 33 and 54 m/s for a charge at 25, 50 and 75 % height) but are pinned by the
load and move less than 1 cm. So nothing is thrown off the top, and **#87 is not needed** for a
clean result here; the cutting charge only makes the pile tighter (top slab 0.5 vs 0.9-1.9 from
home). Because rule 1 crushes the column whatever the blast numbers, the tower keeps working
whatever radius and strength #87 settles on.

## Edge cases

- Charges detonated one at a time (#79 number buttons): one charge leaves the tower standing on
  three columns; a second one next to it makes it fall to that side. A clean pancake needs all
  four at once (Boom / K), which is how a real demolition works.
- Debris chunks pass through slabs and other pieces; they only bounce on the ground.
- A net holding a column that gets crushed keeps holding an invisible body below the ground;
  harmless, and the net is cut or reset as usual.
- Balls and the earthquake can knock the tower over without charges; if a slab falls and lands,
  rule 2 still pancakes what is above it.

## Testing

- `node --test test/*.test.mjs` (pure layout and rule tests).
- `test/harness/demolition.html` on a served repo; title `DEMOLITION PASS`. The pipeline does not
  run it (swiftshader is slow); the numbers above are from the enrichment run.
