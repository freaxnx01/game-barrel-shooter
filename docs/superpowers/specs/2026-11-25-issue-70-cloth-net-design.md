# Heavy net drapes over the catch like cloth (#70)

## Intent

Playtest feedback after #60 (German original: „Kann sich das Netz nicht natürlicher,
flexiber über das Objekt legen?"): the heavy net should lie over the caught pieces more
naturally and flexibly.

Decided in triage: a **visual cloth simulation**. A grid of about 9 × 9 nodes joined by
rope segments, Verlet integration with distance constraints and gravity, nodes colliding
with simple proxies of the caught pieces and the ground. The net hangs over the pieces,
falls down their sides and follows them while they are pulled. Pure JS, no physics-engine
bodies. The catch and pull logic (`selectCaught`, `pullForce`, `isReeledIn`) stays as it is.

This spec was written unattended (`/enrich 70 --quick`). Every decision not stated in the
issue is recorded as an assumption in the issue body; nothing was confirmed in chat.

## Current state (read from the repo)

- `weapons/net.js` holds the tuning and pure helpers (`NET`, `strandOffsets()`,
  `openScale()`, `drapeRadius()`, `drapeParallels()`), tested in `test/net.test.mjs`.
  The open net is `openSize` 4 m, `meshSpacing` 0.5 m, `ropeRadius` 0.035 m
  (`weapons/net.js:16-18`); `strandOffsets()` returns 9 offsets −2 … 2 (`weapons/net.js:72`).
- In flight the net is `makeNetMesh()` (`index.html:1547`): 18 strand meshes and four
  corner weights in a group, strand plane at `y = -(NET.radius - NET.ropeRadius)`
  = −0.265 m below the body, scaled by `openScale(now - born)` and kept flat
  (`index.html:3242-3245`).
- After a catch, `netCatch()` (`index.html:2212`) adds the module-scope rope dome
  `netDrape` (`makeNetDrapeMesh()`, `index.html:1572-1588`); `updateNet()`
  (`index.html:2241`) moves it to the centroid of the caught bodies and scales it uniformly
  to `drapeRadius(spread)`. It ignores the shape of what lies under it.
- `detachNet()` (`index.html:2233`) removes the dome and the pull rope. It runs on Cut (#63),
  on reel-in, when every caught piece has fallen below y = −5, on a new catch and on
  target/round resets (`index.html:1235, 2852, 2957`).
- Physics bodies are handles from `physics/backend-crashcat.js:53-90`. A handle carries
  `position`, `quaternion`, `mass`, `material` and `userData`, **but not its shape**. Shape
  specs are `box {halfExtents}`, `cylinder {radiusTop, height}` (barrels r 0.4725, h 1.1),
  `sphere {radius}`, `spheroid {halfLength, radius}`, `ground`, `none`
  (`physics/backend-crashcat.js:36-45`).
- Static colliders the net can land on: the ground plane at y = 0 and the target platform
  `platBody`, a box 8 × 0.5 × 3 m at z = −6 (`index.html:427, 436`; rebuilt or removed at
  `index.html:1180-1187`). Most targets stand on that platform.
- `animate()` caps `dt` at 1/30 s (`index.html:3050`) and calls `updateNet()` at
  `index.html:3076`.
- Convention: shared module-scope geometries and materials, no per-shot or per-frame GPU
  allocations (`netStrandGeo`, `netWeightGeo`, `netMatl`, `index.html:1318-1327`).

## Goals

### Look

- After a catch the net is a **9 × 9 node rope cloth**, one node per strand crossing of the
  open net, 144 rope segments (8 per row × 9 rows, same for columns), rest length 0.5 m.
- It **starts where the flying net was**: flat, centred on the net body, strand plane
  0.265 m × scale below it, at the open scale the net had at the catch (`rec.mesh.scale.x`).
  It keeps **half of the net body's velocity**, so it does not freeze in the air.
- It **falls over the pieces**: gravity 9.82, ropes keep their length, nodes cannot enter a
  piece, the platform or the ground. The four corner nodes are **4× heavier** (lead
  weights), so the edges pull down the sides.
- It **follows the pieces while they are pulled**: nodes touching a piece take on 80 % of
  its velocity (friction), and nodes farther than 3.5 m from the centroid of the catch are
  pulled back softly (20 % of the excess per substep). A tested 8 m/s drag keeps the cloth
  centre within 1 m of the piece.
- Rendering keeps #60's look: hemp `netMatl`, rope radius 0.035 m, the four lead weights
  (`netWeightGeo`) on the corner nodes. The pull rope from the launcher is tied to the
  **corner node nearest to the launcher** at the moment of the catch.

### Simulation numbers

| Setting | Value | Why |
|---|---|---|
| Nodes | 9 × 9 = 81 | one per strand crossing of the open net (`strandOffsets()`) |
| Segments | 144 structural (rows and columns) | a rope net has no shear or bend stiffness |
| Substep | fixed 1/120 s, at most 4 per frame | `dt` ≤ 1/30 in `animate()`; a hitch never runs more |
| Constraint iterations | 8 per substep (Gauss-Seidel) | hanging test stretches < 5 % |
| Damping | 1 % of the velocity per substep | settles in about a second, no jitter |
| Node radius | 0.05 m | rope radius 0.035 plus air, ropes sit on surfaces |
| Corner mass | 4× | lead weights |
| Friction | 0.8 | net grips the pieces and the ground |
| Carry | 0.5 | share of the flying net's velocity kept at the catch |
| Leash | 3.5 m, stiffness 0.2 | half-diagonal 2.83 m + slack; drags the net along |

### Collision proxies

- Each caught body becomes one proxy per frame, from its shape spec, live position,
  quaternion and velocity: `box` → oriented box with its `halfExtents`; `cylinder` →
  oriented box `[r, h/2, r]`; `spheroid` → oriented box `[r, halfLength, r]`;
  `sphere` → sphere. `ground` and `none` give no proxy.
- The platform (`platBody`, when it exists) is added as a static box proxy with zero
  velocity. The ground is the plane y = 0.
- Push-out: sphere → along the radius to `r + nodeRadius`; oriented box → node rotated
  into the box frame, pushed out through the face of least penetration to
  `half + nodeRadius`, rotated back. A bounding-sphere check skips far boxes first.
- To read the shape, the physics backend stores the spec on the handle
  (`shape: spec.shape`, one line in `physics/backend-crashcat.js`).

### Performance budget (phones)

- Per substep: 144 × 8 = 1 152 distance solves, 81 × (caught + 1) proxy tests
  (≤ 81 × 15 = 1 215, most rejected by the bounding sphere), 81 ground and leash checks.
- Measured with node on the shared dev box (14 barrels + platform, worst-case 1/30 s
  frame, 4 substeps): **0.21 ms** per frame; at 60 fps (2 substeps) about 0.1 ms.
  `Math.hypot` in the hot loop tripled that and is avoided. A phone at 4× slower stays
  under 1 ms.
- Rendering: one `InstancedMesh` of 144 unit cylinders (one draw call) plus 4 weight
  meshes; 144 `setMatrixAt` per frame. No shadow casting (the flying net casts none either).
- Memory: one module-scope cloth (two `Float64Array(243)`, typed segment index arrays)
  and one module-scope mesh group, built once at load; a catch only resets them. No
  per-frame or per-catch GPU buffer; the per-frame proxy list holds at most 15 small objects.

### Endings

- Pieces that fall below y = −5 drop out of the catch as today; their proxies vanish and
  the cloth drops onto whatever is left. When none are left, `detachNet()` runs.
- `detachNet()` (Cut, reel-in, new catch, resets) removes the cloth mesh from the scene
  at once, like the dome today. The cloth state stays in memory for the next catch.

## Non-goals

- Cloth that pushes the pieces (two-way coupling) or physics-engine bodies for the net.
- Changing `selectCaught`, `pullForce`, `isReeledIn`, the capture radius, the catch cap or
  the flight of the net.
- Self-collision of the cloth, tearing, or the net lingering on the ground after a Cut.
- A cloth for a missed net (it still lies flat where it fell and is culled as today).

## Anti-goals

- `TubeGeometry` or any geometry rebuilt per frame or per catch.
- Per-shot `InstancedMesh` creation; the cloth mesh is a single module-scope group.
- `Math.hypot` in the per-substep loops.
- Breaking `node --test test/*.test.mjs`.

## Architecture

New pure module `weapons/cloth.js`, tested in `test/cloth.test.mjs`:

| Export | Purpose |
|---|---|
| `CLOTH` | tuning (table above) |
| `clothSegments(n)` | `[a, b]` node pairs along rows and columns (144 for n = 9) |
| `cornerNodes(n)` | the four corner indices `[0, n-1, (n-1)n, n²-1]` |
| `createCloth()` | allocates the cloth once: `pos`, `prev`, `invMass`, `segA`, `segB`, `rest`, `pending` |
| `resetCloth(cloth, centre, scale, velocity)` | lays the cloth on the flying net's pose |
| `proxyFor(shape, position, quaternion, velocity)` | collision proxy from a shape spec, or `null` |
| `stepCloth(cloth, dt, { proxies, leashCentre })` | fixed-substep Verlet, constraints, collisions, leash |
| `nearestCorner(cloth, point)` | corner node the pull rope is tied to |

`index.html` wires it in:

- `netSegGeo` (unit cylinder, radius `NET.ropeRadius`, 6 sides), `netCloth = createCloth()`
  and `netClothMesh` (InstancedMesh of 144 segments + 4 weights), all at module scope;
  `syncNetClothMesh()` writes the segment matrices and weight positions from `netCloth.pos`.
- `netCatch()` resets the cloth from the net body and adds `netClothMesh`; `netLink`
  gets `ropeNode` instead of `drape`.
- `updateNet(dt)` steps the cloth with proxies from the caught bodies and the platform,
  syncs the mesh and draws the rope to `ropeNode`. The pull part is unchanged.
- `detachNet()` removes `netClothMesh` instead of the dome.
- Removed as orphans: `makeNetDrapeMesh`, `NET_DRAPE_TUBE_R`, `netDrape`, and in
  `weapons/net.js` `drapeRadius`, `drapeParallels` and the four `drape*` constants with
  their two tests.

## Testing

`node --test test/*.test.mjs`. New tests in `test/cloth.test.mjs`:

- 144 segments and the corner indices for 9 × 9.
- `resetCloth` puts the nodes on the open net's plane, at full and half scale.
- Hanging from one pinned edge for 6 s: every far-edge node hangs 4 m ± 0.2 m below it,
  max segment stretch < 5 %.
- Dropped onto a sphere: no node inside, centre node on top, corners below the equator.
- Dropped onto a barrel turned 45°: centre node rests on the lid; never below the ground.
- Thrown into the ground at 40 m/s: no node below the ground in any frame.
- A barrel dragged at 8 m/s for 1.5 s: cloth centre within 1 m of it (fails without
  friction and leash; checked).
- A 1 s hitch runs at most 4 substeps.
- `proxyFor` returns `null` for ground and empty shapes; `nearestCorner` picks the side.

No harness and no Playwright run is required. One optional browser glance after wiring.
