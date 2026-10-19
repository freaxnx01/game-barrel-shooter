# crashcat Physics Engine + Temporary Engine Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put all physics behind a small backend facade with two implementations (cannon-es = today, crashcat = new), and add a temporary mid-game switch between them, so stacked structures can be compared on crashcat.

**Architecture:** Game code in `index.html` talks only to a `PhysicsBackend` object (`phys`). `physics/backend-cannon.js` wraps cannon-es 1:1 so today's behaviour is unchanged. `physics/backend-crashcat.js` wraps crashcat, which is loaded lazily via dynamic `import()`. Flipping the engine destroys the world, creates the other backend and rebuilds the current structure through the existing `reset()`. The cannon-only freeze/wake/support workaround stays in `index.html`, guarded by `phys.name === 'cannon'`.

**Tech Stack:** Vanilla ES modules, three.js 0.160 (unchanged), cannon-es 0.20.0 (unchanged), crashcat 0.0.5 via `https://esm.sh/crashcat@0.0.5`, Node's built-in `node:test` for pure modules (`node --test test/`, no `package.json`), in-browser harness pages under `test/harness/` (pattern from `game-kit-racer`), Python Playwright (not committed) for headless harness runs.

**Spec:** `docs/superpowers/specs/2026-10-19-crashcat-physics-switch-design.md`

## Global Constraints

- Buildless static site. No `package.json`, bundler, `node_modules` or framework.
- crashcat pinned exactly: `https://esm.sh/crashcat@0.0.5`, loaded with dynamic `import()`, never a static import. If loading fails, the game stays on cannon.
- cannon path behaviour must be **identical** to today (regression baseline).
- Default engine when nothing is stored: `cannon`. `localStorage` key: `barrelBlast.physicsEngine`. Values: `cannon` | `crashcat`. Every storage access is wrapped in try/catch.
- Shortcut key: `K` (lowercased `k` in the existing keydown handler, `index.html:1949`).
- Fixed step stays 1/240 s with at most 10 substeps per frame (`index.html:2066`).
- Unpaired materials use friction 0.3, restitution 0 on crashcat.
- Fast projectiles on crashcat use `MotionQuality.LINEAR_CAST`.
- Never remove bodies inside a contact callback (crashcat forbids it, and the code already defers removal).
- `const`/`let` only. No new globals on `window`.
- No `version.js` bump, no release.

## Review Focus

1. **Switching repeatedly** (10× via `K`, on several structures) must not leak bodies, joints, meshes or listeners. Expect `phys.bodyCount()` after a switch to equal the count right after a fresh `reset()` on that structure. Test in Task 5, Step 5.
2. **Switching while something is attached:** a tethered harpoon, a swinging wrecking ball, an active hurricane, or auto-play running. The switch must tear all of that down cleanly (`detachHarpoon()`, `removeProjectile`, hurricanes cleared, auto-play stopped). Test in Task 5, Step 5.
3. **crashcat fails to load** (offline, or esm.sh blocked). The game starts and plays on cannon. The toggle shows `Physics: crashcat unavailable` and is disabled, with one `console.warn`. Test in Task 5, Step 5 (block `esm.sh` in DevTools).
4. **Storage misbehaves.** `localStorage` throws (private mode or blocked site data) or holds garbage (`"banana"`): start on cannon, with no exception. Test in Task 1.
5. **A contact callback triggers removal on crashcat** (bomb/dynamite explode, paintball, harpoon stick), all firing inside `updateWorld`. Removal must be deferred to after the step. The contract harness asserts that removing a body from inside `onCollide` does not throw and takes effect after the step (Task 2/4 contract test `collideRemovalDeferred`).

---

## File Structure

| File | Responsibility |
|---|---|
| `physics/materials.js` (create) | The 6 material names and 13 contact pairs (values verbatim from `index.html:176-190`), plus the default contact. Pure. |
| `physics/engine-choice.js` (create) | Read/write the persisted engine choice with fallback. Pure (storage is injected). |
| `physics/backend-cannon.js` (create) | `createCannonBackend(CANNON)`: the facade over cannon-es. |
| `physics/backend-crashcat.js` (create) | `createCrashcatBackend(cc)`: the facade over crashcat. |
| `physics/load-backend.js` (create) | `loadBackend(name)`: lazy import with cannon fallback. |
| `test/materials.test.mjs`, `test/engine-choice.test.mjs` (create) | node:test for the pure modules. |
| `test/harness/contract.js`, `test/harness/physics-contract.html` (create) | The backend contract, run against both backends in a browser. |
| `index.html` (modify) | Use `phys` everywhere, plus the toggle button, label, `K` key and carve-out dimming. |
| `README.md` (modify) | One short "Physics engine (temporary switch)" section. |

The loser of the comparison is later removed by deleting one `backend-*.js` file, the switch UI and `load-backend.js`'s branch. Keep every switch-related line in `index.html` under a `// engine switch (temporary, #9)` comment so the follow-up can find it.

## The facade contract (shared by Tasks 2–5)

```js
/**
 * @typedef {{x:number,y:number,z:number}} V3
 * @typedef {{x:number,y:number,z:number,w:number}} Q4
 * @typedef {'ground'|'barrel'|'ball'|'heavy'|'card'|'stone'} MaterialName
 * @typedef {{kind:'box', halfExtents:[number,number,number]}
 *         | {kind:'sphere', radius:number}
 *         | {kind:'cylinder', radiusTop:number, radiusBottom:number, height:number, segments:number}
 *         | {kind:'ground'}} ShapeSpec            // 'ground' = infinite plane at y=0 (cannon) / 200x1x200 static box with top at y=0 (crashcat)
 * @typedef {{shape:ShapeSpec, mass:number, isStatic?:boolean, material:MaterialName,
 *            position:V3, quaternion?:Q4, linearDamping?:number, angularDamping?:number,
 *            sleepSpeedLimit?:number, sleepTimeLimit?:number, fast?:boolean,
 *            startAsleep?:boolean, userData?:any}} BodySpec
 * @typedef {object} PBody   // opaque handle; read-only live fields below
 * @property {V3} position     live, read-only (write via setPosition)
 * @property {Q4} quaternion   live, read-only
 * @property {MaterialName} material
 * @property {number} mass     0 for static
 * @property {any} userData    free for game use (replaces body._wood, body._mass, etc.)
 * @property {any} raw         underlying engine body; only cannon-only workaround code may touch it
 */
// PhysicsBackend:
//   name: 'cannon'|'crashcat'
//   addBody(spec: BodySpec): PBody          removeBody(b): void      bodies(): PBody[]   bodyCount(): number
//   step(frameDt: number): void             // 1/240 fixed, ≤10 substeps, same as world.step(1/240, dt, 10)
//   getVelocity(b): V3   setVelocity(b, x, y, z)   getAngularVelocity(b): V3   setAngularVelocity(b, x, y, z)
//   setPosition(b, x, y, z)   setQuaternion(b, x, y, z, w)
//   applyImpulse(b, x, y, z)   applyForce(b, x, y, z)   // both at centre of mass
//   wake(b)   isSleeping(b): boolean   isStatic(b): boolean   makeDynamic(b)   // makeDynamic: static → dynamic with spec mass
//   onCollide(b, cb(other: PBody, impactSpeed: number, point: V3)): void   // per-body; impactSpeed ≥ 0 along the normal
//   addDistanceJoint(a, b, length): Joint   addFixedJoint(a, b): Joint   removeJoint(j): void
//   destroy(): void                          // removes everything; the backend is unusable afterwards
```

All game code goes through `phys`. Reads like `b.body.position.x` keep working because `position` is a live `{x,y,z}`. Writes, velocities and impulses become `phys.*` calls.

---

### Task 1: Pure modules — material table and engine choice

**Files:**
- Create: `physics/materials.js`, `physics/engine-choice.js`
- Test: `test/materials.test.mjs`, `test/engine-choice.test.mjs`

**Interfaces:**
- Produces: `MATERIALS: MaterialName[]`, `CONTACT_PAIRS: Array<[MaterialName, MaterialName, {friction, restitution}]>` (the 13 pairs), `DEFAULT_CONTACT = {friction: 0.3, restitution: 0}`, `contactFor(a: MaterialName, b: MaterialName): {friction, restitution}` (order-independent).
- Produces: `ENGINE_KEY = 'barrelBlast.physicsEngine'`, `readEngineChoice(storage): 'cannon'|'crashcat'`, `writeEngineChoice(storage, name): void` (swallows storage exceptions).

- [ ] **Step 1: Write the failing tests**

```js
// test/materials.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_PAIRS, DEFAULT_CONTACT, contactFor } from '../physics/materials.js';

test('contactFor_KnownPair_ReturnsTableValues', () => {
  assert.deepEqual(contactFor('ball', 'ground'), { friction: 0.4, restitution: 0.75 });
  assert.deepEqual(contactFor('stone', 'stone'), { friction: 0.7, restitution: 0.0 });
});
test('contactFor_ReversedOrder_SameResult', () => {
  assert.deepEqual(contactFor('ground', 'ball'), contactFor('ball', 'ground'));
});
test('contactFor_UnpairedMaterials_ReturnsCannonDefault', () => {
  assert.deepEqual(contactFor('card', 'barrel'), { friction: 0.3, restitution: 0 });
  assert.deepEqual(DEFAULT_CONTACT, { friction: 0.3, restitution: 0 });
});
test('CONTACT_PAIRS_HasThirteenPairs', () => assert.equal(CONTACT_PAIRS.length, 13));
```

```js
// test/engine-choice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEngineChoice, writeEngineChoice, ENGINE_KEY } from '../physics/engine-choice.js';
const mem = (init = {}) => ({ d: { ...init }, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } });
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('readEngineChoice_Empty_ReturnsCannon', () => assert.equal(readEngineChoice(mem()), 'cannon'));
test('readEngineChoice_StoredCrashcat_ReturnsCrashcat', () => assert.equal(readEngineChoice(mem({ [ENGINE_KEY]: 'crashcat' })), 'crashcat'));
test('readEngineChoice_Garbage_ReturnsCannon', () => assert.equal(readEngineChoice(mem({ [ENGINE_KEY]: 'banana' })), 'cannon'));
test('readEngineChoice_StorageThrows_ReturnsCannon', () => assert.equal(readEngineChoice(throwing), 'cannon'));
test('readEngineChoice_NoStorage_ReturnsCannon', () => assert.equal(readEngineChoice(undefined), 'cannon'));
test('writeEngineChoice_StorageThrows_DoesNotThrow', () => assert.doesNotThrow(() => writeEngineChoice(throwing, 'crashcat')));
test('writeEngineChoice_ThenRead_RoundTrips', () => { const s = mem(); writeEngineChoice(s, 'crashcat'); assert.equal(readEngineChoice(s), 'crashcat'); });
```

- [ ] **Step 2: Run them to see them fail.** `node --test test/`. Expected: FAIL, cannot find module `../physics/materials.js`.
- [ ] **Step 3: Implement both modules.** Copy the 13 pairs verbatim from `index.html:176-190` (names: `ground`, `barrel`, `ball`, `heavy`, `card`, `stone`). `contactFor` builds a key from the two names sorted.
- [ ] **Step 4: Run them to see them pass.** `node --test test/`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add physics/ test/*.test.mjs && git commit -m "feat(physics): add material table and engine choice store"`

---

### Task 2: Backend contract harness + cannon backend

**Files:**
- Create: `physics/backend-cannon.js`, `test/harness/contract.js`, `test/harness/physics-contract.html`

**Interfaces:**
- Consumes: `CONTACT_PAIRS`, `contactFor` (Task 1).
- Produces: `createCannonBackend(CANNON): PhysicsBackend` (contract above, `name: 'cannon'`). It creates `CANNON.World` with gravity −9.82, `SAPBroadphase`, `allowSleep = true`, one `CANNON.Material` per name, and one `ContactMaterial` per pair. `ground` maps to `CANNON.Plane` rotated −π/2 about X. `cylinder` maps to `CANNON.Cylinder(rTop, rBottom, h, segments)`. `onCollide` maps to the body's `'collide'` event, with `impactSpeed = Math.abs(e.contact.getImpactVelocityAlongNormal())` and `point` = the contact's world point. Joints: `DistanceConstraint` / `LockConstraint`.
- Produces: `runContract(backend): Array<{name: string, pass: boolean, detail: string}>` in `test/harness/contract.js`.

- [ ] **Step 1: Write the contract (the failing test).** `test/harness/contract.js` exports `runContract(phys)` with these cases. Each creates its own bodies and removes them at the end.

| Case | Setup → assertion |
|---|---|
| `restsOnGround` | ground + box(½ extents 0.5, mass 1) at y=3; step 3 s of frames (180 × 1/60) → `\|position.y − 0.5\| < 0.02` |
| `impulseChangesVelocity` | sphere r 0.5, mass 2, gravity irrelevant (read immediately); `applyImpulse(b, 4,0,0)` → `getVelocity(b).x ≈ 2` (±0.01) |
| `staticDoesNotMove` | static box, step 1 s → position unchanged, `isStatic` true, `mass` 0 |
| `makeDynamicFalls` | static box at y=3 with spec mass 1 → `makeDynamic`, step 1 s → y < 2.9 |
| `sleepsWhenResting` | box on ground, step 5 s → `isSleeping` true; `wake` → false |
| `collideReportsImpact` | sphere dropped from y=5 with `onCollide` → callback fired, `impactSpeed > 3`, `other` is the ground handle |
| `collideRemovalDeferred` | in `onCollide`, push the body to a list; after `step` call `removeBody` → no throw, `bodies()` no longer contains it |
| `distanceJointHoldsLength` | static anchor + sphere 2 m away, `addDistanceJoint(…, 2)`, step 2 s → distance 2 ± 0.05 |
| `fixedJointMovesTogether` | two boxes joined with `addFixedJoint`, impulse one → relative offset changes < 0.02 |
| `bodyCountTracks` | add 3 / remove 3 → `bodyCount()` back to its start value |
| `stack10Stands` | 10 boxes (½ 0.5) stacked with 0.001 gap, step 5 s → top box drift < 0.05 (**reported, not required, on cannon**) |

`physics-contract.html` uses the same import map as `index.html` plus `crashcat`, runs `runContract` for every backend it can create, and renders one PASS/FAIL row per case and backend into a `<pre id="out">`. It also sets `document.title` to `CONTRACT PASS` or `CONTRACT FAIL` for headless runs.

- [ ] **Step 2: Run it to see it fail.** `python3 -m http.server 8000` and open `http://localhost:8000/test/harness/physics-contract.html`. Expected: FAIL, module `physics/backend-cannon.js` not found.
- [ ] **Step 3: Implement `createCannonBackend(CANNON)`.** Static bodies get `type: STATIC` with `mass: 0` and keep the spec mass on the handle for `makeDynamic`. `step(dt)` → `world.step(1/240, dt, 10)`. `destroy()` removes all bodies and constraints.
- [ ] **Step 4: Run it to see it pass.** Reload the harness. Expected: every cannon row PASS except `stack10Stands`, which is informational.
- [ ] **Step 5: Commit.** `git commit -m "feat(physics): add cannon backend and contract harness"`

---

### Task 3: Move `index.html` onto the facade (cannon only, zero behaviour change)

**Files:**
- Modify: `index.html` (the physics section `167-215`, every body creation site `321-350, 429-437, 611-620, 830-838, 1160-1230`, the collide handler `1380-1390`, `explode` `1401-1420`, `paintSplat` `1452`, lightning/disruptor/magneto/hurricane/earthquake `1487-1570, 2080-2200`, `harpoonStick`/`detachHarpoon` `1616-1640`, `removeProjectile` `1927-1934`, `clearTargets` `971`, `setPlatform` `963`, the loop `2066`, render sync `2234-2235`, auto-play settle `2005-2006`)

**Interfaces:**
- Consumes: `createCannonBackend` (Task 2).
- Produces: a module-level `let phys` in `index.html`, created once at startup with `createCannonBackend(CANNON)`. A helper `materialOf(b)` is not needed because the handle carries `material`. Replace `body._wood` / `body._mass` with `userData` fields. The freeze workaround (`unfreezeCards`, `wakeNear`, `collapseUnsupported`, and the STATIC special cases in quake/hurricane/magneto) keeps working through `phys.isStatic` / `phys.makeDynamic` / `phys.isSleeping`. Where it needs AABBs it reads `b.raw` and is commented `// cannon-only workaround (#9)`.

- [ ] **Step 1: Capture a baseline.** On `main` before editing, for Barrels, Cards, Colosseum and Eiffel: fire 3 basketballs at the same aim point (auto-play is fine for Barrels) and note the blocks-down counts. Also note the console is empty.
- [ ] **Step 2: Mechanical migration.** Replace every `CANNON.*` use and every `world.*` call outside `physics/backend-cannon.js` with `phys.*`. `CANNON` is then imported only by the backend. The `<script type="module">` imports `createCannonBackend` from `./physics/backend-cannon.js` and `* as CANNON from 'cannon-es'` only to pass it in. Mesh sync keeps `mesh.position.copy(body.position)`, since the handle's `position` is a live `{x,y,z}`. For spear/F-16 orientation (`index.html:2230-2233`), compute the quaternion with THREE (`setFromUnitVectors`) and call `phys.setQuaternion`.
- [ ] **Step 3: Verify that no engine names leak.** Run `grep -n "CANNON\.\|world\." index.html`. Expected: only the import line and the `createCannonBackend(CANNON)` call. Run `node --test test/` and the harness. Expected: still pass.
- [ ] **Step 4: Playtest for regressions.** Repeat Step 1. Counts may differ by ±1 from physics nondeterminism, but the feel must be indistinguishable. Exercise every weapon and power once on Barrels and once on a stone structure. Harpoon: stick and reel with Space. Wrecking ball: swings. Earthquake: Shift. Empty console.
- [ ] **Step 5: Commit.** `git commit -m "refactor(physics): route all physics through backend facade"`

---

### Task 4: crashcat backend

**Files:**
- Create: `physics/backend-crashcat.js`
- Modify: `test/harness/physics-contract.html` (also runs crashcat)

**Interfaces:**
- Consumes: `contactFor` (Task 1), the contract (Task 2).
- Produces: `createCrashcatBackend(cc): PhysicsBackend` with `name: 'crashcat'`, where `cc` is the module namespace from `import('https://esm.sh/crashcat@0.0.5')`.

Decisions the implementer cannot infer:
- World: `cc.registerAll()`, then `createWorldSettings()` with gravity `[0, -9.82, 0]` and two broadphase/object layers (`MOVING`, `NOT_MOVING`) with MOVING↔MOVING and MOVING↔NOT_MOVING collisions enabled, exactly as in the crashcat Quick Start.
- `ground` = `box.create({halfExtents: [100, 0.5, 100]})`, static, at y = −0.5.
- Mass: pass `mass` from the spec (crashcat scales inertia). Pass `linearDamping` / `angularDamping` through. Sleep thresholds have no per-body equivalent, so drop them. `fast: true` → `motionQuality: MotionQuality.LINEAR_CAST`. `startAsleep: true` → `rigidBody.sleep(world, body)` right after creation.
- Materials: each body's handle carries `material`. One world listener `onContactAdded(bodyA, bodyB, manifold, settings)` sets `settings.combinedFriction` / `combinedRestitution` from `contactFor(a.material, b.material)`. It also dispatches `onCollide` callbacks for either body, with `impactSpeed` = |(vA − vB) · `manifold.worldSpaceNormal`| from the bodies' linear velocities and `point` from `getWorldSpaceContactPointOnA(…, 0)`. Look up handles via `body.userData` (the engine body's userData holds the handle; game `userData` lives on the handle).
- `step(frameDt)`: an accumulator with a fixed 1/240 step, at most 10 substeps, calling `updateWorld(world, listener, 1/240)`.
- Live `position` / `quaternion` on the handle: getters over the crashcat `body.position` / `body.quaternion` arrays (`[x,y,z]`, `[x,y,z,w]`).
- `makeDynamic` → `rigidBody.setMotionType(world, body, MotionType.DYNAMIC, true)` plus `setObjectLayer` to MOVING. `isStatic` reads `motionType`.
- Joints: `distanceConstraint.create` / `fixedConstraint.create` with `space: ConstraintSpace.WORLD` at the bodies' current positions. `removeJoint` → the matching `.remove`.

- [ ] **Step 1: The failing test.** Add the crashcat backend to `physics-contract.html` (dynamic import, as the game will). Expected: crashcat rows FAIL with module not found.
- [ ] **Step 2: Implement `createCrashcatBackend(cc)`.**
- [ ] **Step 3: Run the harness.** Expected: **every crashcat row PASS, including `stack10Stands`**. If `stack10Stands` fails on crashcat, stop and report, because it means crashcat won't meet the spec's core goal.
- [ ] **Step 4: Commit.** `git commit -m "feat(physics): add crashcat backend"`

---

### Task 5: Engine switch — lazy load, toggle, label, `K`, persistence, carve-out

**Files:**
- Create: `physics/load-backend.js`
- Modify: `index.html` (HUD markup next to `#reset` / `#autoplay` around `index.html:112-113`, CSS `30-38`, keydown `1949-1980`, startup)

**Interfaces:**
- Consumes: `readEngineChoice` / `writeEngineChoice` (Task 1), both backends (Tasks 2 and 4).
- Produces: `loadBackend(name): Promise<{phys: PhysicsBackend, name: 'cannon'|'crashcat', error?: Error}>`. For `crashcat` it does `await import('https://esm.sh/crashcat@0.0.5')`. On failure it returns the cannon backend with `error` set.
- Produces in `index.html`: `async function switchEngine(name)` and `const CRASHCAT_DISABLED_WEAPONS = new Set([])` (filled in Task 6 only if the carve-out test fails).

- [ ] **Step 1: Startup.** Before the first `buildTargets()`, call `readEngineChoice(localStorage)` (guard the `localStorage` access itself with try/catch) and `await loadBackend(choice)`. If `error` is set, mark crashcat unavailable.
- [ ] **Step 2: `switchEngine(name)`.** Stop auto-play, then `detachHarpoon()`, remove all projectiles (`removeProjectile`), clear hurricanes, `phys.destroy()`, `phys = (await loadBackend(name)).phys`, `writeEngineChoice`, `reset()`, update the label. Re-entrancy: ignore calls while a switch is in flight.
- [ ] **Step 3: UI.** Add `<button id="engine">`, styled with the same rules as `#reset` / `#autoplay` and positioned below `#autoplay` (`top: 112px`). Label text: `Physics: cannon` / `Physics: crashcat` / `Physics: crashcat unavailable` (disabled). A click or `k` toggles. On crashcat, buttons whose `data-type` is in `CRASHCAT_DISABLED_WEAPONS` get `disabled` + `title="Not available on crashcat yet"`, and their keys are ignored. If the current ammo is disabled, fall back to `basketball`.
- [ ] **Step 4: Structures on crashcat.** In the structure builders, pass `isStatic: phys.name === 'cannon'` (today's frozen spawn) and `startAsleep: phys.name === 'crashcat'`. Make `unfreezeCards`, `wakeNear` and `collapseUnsupported` return early when `phys.name !== 'cannon'`. Fast projectiles (`cannonball`, `spear`, `f16`, `sniper`, `slingshot`, `catapult` payload, `harpoon`) pass `fast: true`. The cannon backend ignores it.
- [ ] **Step 5: Verify (Review Focus 1–3).**
  - Press `K` 10× on Colosseum. After each switch, `phys.bodyCount()` (logged once from the console) equals the count after a fresh `reset()` on that engine. Empty console.
  - Switch with a harpoon tethered, with the wrecking ball swinging, with a hurricane running, and with auto-play running. Nothing is left behind and nothing throws.
  - Reload: the engine is restored. DevTools → Application → clear site data → reload: cannon.
  - DevTools → Network → block `esm.sh` → reload with crashcat stored: the game runs on cannon, the button shows `Physics: crashcat unavailable` (disabled), and there's exactly one `console.warn`.
- [ ] **Step 6: Commit.** `git commit -m "feat(physics): add temporary cannon/crashcat engine switch"`

---

### Task 6: crashcat playtest, structure placement and carve-out decision

**Files:**
- Modify: `index.html` structure builders (`setupEiffel` `862`, `setupColosseum` `668`, others only if needed), plus `CRASHCAT_DISABLED_WEAPONS`
- Modify: `README.md` (short "Physics engine (temporary switch)" section: what `K` does, that it is temporary, and the link to #9)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Stand-still check on crashcat.** For every structure button: build it, wait 5 s, and confirm nothing moved. Then fire one tennis ball at the base and confirm no piece moves without being hit or losing its support.
- [ ] **Step 2: Fix placement where a structure creeps or bursts on wake.** Add clearance (e.g. +0.002 × `TSCALE` between stacked pieces) or remove overlaps. If the change alters cannon behaviour, apply it under `phys.name === 'crashcat'` only. Time-box this to about 30 minutes per structure. Anything still failing goes in the PR description with what was tried.
- [ ] **Step 3: Spec acceptance on crashcat.**
  - Eiffel: one tennis ball → local damage at most. Repeated hits collapse it progressively. No strut rises above roughly the tower's height.
  - Colosseum: a tennis ball never launches a block skyward. A cannonball or bomb topples sections.
  - Barrels and pyramid feel comparable to cannon. Blocks-down counter and win detection work. Auto-play clears the default pyramid.
  - Every weapon and power works.
- [ ] **Step 4: Carve-out test.** Harpoon: it sticks into a barrel, and holding Space reels the barrel in. Wrecking ball: it swings as a pendulum from its anchor with no jitter or energy gain, and it knocks barrels over. Add the `data-type` of whichever fails to `CRASHCAT_DISABLED_WEAPONS`.
- [ ] **Step 5: Regression on cannon.** Repeat Task 3 Step 4 on cannon. Then run `node --test test/` and the contract harness: all green.
- [ ] **Step 6: Commit.** `git commit -m "fix(physics): tune structure placement for crashcat; document engine switch"`

**PR description** (in addition to the standard template): per structure, crashcat stand-still and collapse results, the final `CRASHCAT_DISABLED_WEAPONS`, and any structure that still misbehaves on crashcat with what was tried.
