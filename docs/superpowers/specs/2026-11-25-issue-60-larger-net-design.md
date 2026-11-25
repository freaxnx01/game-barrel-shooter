# Larger heavy net with wide meshes and thick ropes (#60)

## Intent

Playtest feedback on the heavy net from #54 (German original: „Das Netz ist viel zu
klein, es soll viel großflächiger sein mit breiten Maschen, also so vielleicht ein Netz
mit dicken Seilen."): the net is far too small. It should cover a much larger area, with
wide meshes and thick ropes.

Decided in triage: the net should **look bigger and catch more**. The catch radius and
the maximum piece count grow with the visible size, so the net catches what it appears
to cover.

This spec was written unattended (`/enrich 60 --quick`). Every decision not stated in
the issue is recorded as an assumption in the issue body; nothing was confirmed in chat.

## Current state (read from the repo)

- Tuning and pure helpers live in `weapons/net.js` with tests in `test/net.test.mjs`
  (`node --test test/*.test.mjs`). `NET.radius` is 0.3, `captureRadius` 1.6, `maxCatch`
  6, `pullPerKg` 160 (`weapons/net.js:4-15`).
- The thrown net is a 0.3 m wireframe icosahedron plus four 0.06 m weights at
  ±0.24 m (`makeNetBundleMesh()`, `index.html:1523-1533`), built from the shared
  module-scope geometries `netBundleGeo` and `netWeightGeo` (`index.html:1304-1305`)
  and the wireframe material `netMatl` (`index.html:1296`). The comment at
  `index.html:1298` states the convention: shared geometries, no per-shot GPU buffers.
- Its physics body is a sphere r 0.3, mass 6, material `'heavy'` (`index.html:1568`).
- `netCatch()` (`index.html:2133`) selects pieces with `selectCaught()` around the
  body position on first contact, then builds a drape as a **new**
  `SphereGeometry(1, 16, 8, 0, 2π, 0, π/2)` hemisphere in `netMatl` (wireframe), which
  `detachNet()` disposes (`index.html:2155-2161`). `updateNet()` scales the drape to
  `spread + 0.6` every frame (`index.html:2173`).
- The ball sync in `animate()` copies position and quaternion of the body onto the mesh
  for every projectile (`index.html:3148-3149`), so the net mesh tumbles with the
  rolling sphere body.
- Target sizes: oil and wooden barrels are r 0.45, h 1.1 (`index.html:421`), standing
  in a 6-5-4-3-2-1 pyramid with 1.035 m between centres (`BARREL_R * 2.3`,
  `index.html:589`); the pyramid is about 5.2 m wide and 6.7 m high. Cards are 1.0 m
  high. Stone targets use `TSCALE = 2` (`index.html:1219`).
- The pull is `pullPerKg * mass` per piece plus gravity compensation
  (`pullForce()`, `weapons/net.js:48`), so every caught piece gets the same acceleration
  regardless of how many pieces are caught.
- README.md:80 and CHANGELOG.md:25 say the net catches up to 6 pieces.

## Goals

### Look: a real throw net

- In flight the net is an **open square of 4 m × 4 m** made of **thick rope strands**:
  9 strands along each axis, **0.5 m apart** (8 × 8 cells, wide meshes), each strand a
  cylinder of **radius 0.035 m** (7 cm thick rope). Four **lead weights** (spheres,
  r 0.1 m) sit on the corners.
- The net **opens during the throw**: it leaves the launcher as a bundle (scale 0.12,
  about 0.5 m across, like today's icosahedron) and eases open to full size over the
  first **350 ms** of flight.
- The net **flies and lies flat**: its mesh keeps a horizontal orientation instead of
  tumbling with the sphere body. The strand plane sits 0.265 m below the body centre
  (`NET.radius - NET.ropeRadius`), so a missed net lies on the ground where it fell.
- The material changes from a 1-px wireframe to a solid hemp-coloured rope material
  (`#7a6646`, roughness 0.95). The weights keep their metal material.
- After a catch the drape is a **rope dome** built from the same kind of thick strands:
  8 meridians (half-tori) and 4 parallels (tori) on a unit hemisphere, scaled every
  frame to `max(1.2, spread + 0.8)` m. It replaces the wireframe hemisphere.

### Catch: as much as it looks

- `captureRadius` grows from 1.6 m to **2.4 m**: a bit more than the half-width of the
  open net (2.0 m), less than its half-diagonal (2.83 m). On the barrel pyramid that is
  roughly two neighbours in every direction from the landing point.
- `maxCatch` grows from 6 to **14**, in step with the catch area
  ((2.4 / 1.6)² = 2.25 → 6 × 2.25 ≈ 14). A well-placed net takes most of the 21-barrel
  pyramid, a bad one still leaves pieces standing.
- `pullPerKg` stays **160**: the pull force is applied per piece and per kilogram, so
  more pieces do not pull slower. Mass, speed, lift and release distance are unchanged.

### Physics stays simple

- The collider remains a sphere r 0.3, mass 6. The open net is a visual on top of it.
- `selectCaught()` keeps selecting by distance from the contact point, nearest first.

## Non-goals

- Cloth simulation, joints between caught pieces, a net that wraps around pieces.
- A collider that matches the open net (a 4 m flat body would snag on everything).
- Changing the harpoon, the rope tether, Space/Pull handling or the release rule.
- Translating the UI.

## Anti-goals

- Per-shot allocation of strand geometries (the shared-geometry convention at
  `index.html:1298` holds; meshes may be created per shot, geometries may not).
- A per-catch `SphereGeometry` that is forgotten in `detachNet()`; the new drape is a
  single module-scope group that is added to and removed from the scene.
- A thin or wireframe look anywhere on the net.
- Breaking `node --test test/*.test.mjs`.

## Architecture

All numbers and pure math go into `weapons/net.js`, tested in `test/net.test.mjs`:

| Export | Purpose |
|---|---|
| `NET.openSize` 4, `NET.meshSpacing` 0.5, `NET.ropeRadius` 0.035, `NET.weightRadius` 0.1 | open-net geometry |
| `NET.bundleScale` 0.12, `NET.openMs` 350 | opening animation |
| `NET.captureRadius` 2.4, `NET.maxCatch` 14 | catch |
| `NET.drapeMargin` 0.8, `NET.drapeMin` 1.2, `NET.drapeMeridians` 8, `NET.drapeParallels` 4 | drape |
| `strandOffsets()` | strand positions along one axis: `[-2, -1.5, …, 2]` |
| `openScale(elapsedMs)` | eased scale from `bundleScale` to 1 over `openMs` |
| `drapeRadius(spread)` | `max(drapeMin, spread + drapeMargin)` |
| `drapeParallels()` | `{ radius, y }` of each parallel on the unit hemisphere |

`index.html` wires them in:

- shared geometries `netStrandGeo` (cylinder along the strand), `netWeightGeo`
  (bigger), one module-scope `netDrape` group built once by `makeNetDrapeMesh()`
- `makeNetMesh()` replaces `makeNetBundleMesh()`: 18 strand meshes plus 4 weights in a
  group, strand plane at `y = -(NET.radius - NET.ropeRadius)`
- the ball sync in `animate()`: for `type === 'net'` reset the mesh quaternion to
  identity and set `scale` to `openScale(now - born)`
- `netCatch()` adds `netDrape` to the scene instead of a new hemisphere;
  `detachNet()` removes it (no dispose); `updateNet()` uses `drapeRadius(spread)`
- README.md and CHANGELOG.md mention the new size and count

No physics facade change, no new ammo, no key change.

## Decided numbers

| | Old | New |
|---|---|---|
| Open net | 0.3 m icosahedron | 4 m × 4 m square, 9 × 9 strands, 0.5 m mesh |
| Rope strand | wireframe line | cylinder r 0.035 m, 6 segments |
| Weights | 4 × r 0.06 at ±0.24 m | 4 × r 0.1 at the corners (±2 m) |
| Opening | none | scale 0.12 → 1, eased, over 350 ms |
| Orientation in flight | tumbles with body | flat |
| Catch radius | 1.6 m | 2.4 m |
| Max catch | 6 | 14 |
| Pull | 160 N/kg | 160 N/kg (unchanged) |
| Drape | wireframe hemisphere, scale `spread + 0.6`, per-catch geometry | rope dome, 8 meridians + 4 parallels, tube r 0.02 at unit scale, scale `max(1.2, spread + 0.8)`, shared |

## Testing

- `node --test test/*.test.mjs`: new tests for `strandOffsets`, `openScale`,
  `drapeRadius`, `drapeParallels`; the `selectCaught` cap test moves from 6 to 14.
- One cheap visual check at the end of the plan (serve, fire one net at the barrel
  pyramid, watch it open and drape). No new browser harness, no Playwright run.

## Consequences

- The net is now the strongest "clear the pyramid" weapon short of dynamite: up to 14
  of 21 barrels in one throw. If that feels too strong in play, `maxCatch` is a single
  number in `weapons/net.js`.
- A 4 m flat mesh over a 0.3 m collider clips through pieces it flies past; the catch
  happens at the body's first contact, as before.
- The drape's tube thickness scales with the dome (2.4 cm at the smallest dome, 8 cm at
  a 4 m dome); it is one shared geometry, so no per-catch allocation.
- Docs (README, CHANGELOG) change from "up to 6" to "up to 14".
