# Per-frame forces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `phys.applyForce` called once per frame acts for the whole frame, so Magneto, the harpoon
reel-in and the earthquake get their full force (#29).

**Architecture:** The crashcat backend keeps a pending-force map. `applyForce` fills it, `step()`
re-applies it before every substep and clears it afterwards. Game code stays unchanged.

**Tech Stack:** Buildless vanilla JS (ES modules), crashcat 0.0.5 via the `phys` facade, browser
contract harness `test/harness/physics-contract.html`.

**Spec:** `docs/superpowers/specs/2026-11-13-per-frame-force-design.md`

## Global Constraints

- Touch only `physics/backend-crashcat.js` and `test/harness/contract.js`. Do not edit
  `index.html` (issue #28 changes it concurrently) and do not retune any weapon.
- Game code goes through the `phys` facade only.
- TDD per repo `CLAUDE.md`: failing test first, never edit a test to make it pass.
- Hurricanes use `applyImpulse` and must stay unchanged.

## File Structure

- Modify `physics/backend-crashcat.js`: `pendingForces` map, `applyForce`, `step`, `removeBody`, `destroy`.
- Modify `test/harness/contract.js`: new cases `forceHoldsAgainstGravity`, `forceIsFrameRateIndependent`, `forcesAddUpAndExpire`, `removeBodyDropsPendingForce`.

### Task 1: Failing contract cases

**Files:**
- Modify: `test/harness/contract.js`

- [ ] **Step 1: Register the cases.** In the `cases` array of `runContract`, after `unsupportedSleeperFalls,` add:

```js
    forceHoldsAgainstGravity,
    forceIsFrameRateIndependent,
    forcesAddUpAndExpire,
    removeBodyDropsPendingForce,
```

- [ ] **Step 2: Write the cases.** Append to the file, before `function ground(phys)`:

```js
// Per frame: applyForce(...) then step(dt). (The game calls step first, which only adds a constant
// one-frame lag of force, not a different rate; the tests start with the force to measure the rate.)
function hoverDrift(phys, fps) {
  const m = 5;
  const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: m, material: 'wood', position: { x: 0, y: 10, z: 0 } });
  for (let i = 0; i < fps; i++) { phys.applyForce(b, 0, 9.82 * m, 0); phys.step(1 / fps); }
  const dy = b.position.y - 10;
  cleanup(phys, [b]);
  return dy;
}

function forceHoldsAgainstGravity(phys) {
  const drifts = [30, 60, 120].map((fps) => hoverDrift(phys, fps));
  const pass = drifts.every((d) => Math.abs(d) < 0.05);
  return { name: 'forceHoldsAgainstGravity', pass, detail: `dy@30/60/120fps=${drifts.map((d) => d.toFixed(3)).join('/')} expected ~0` };
}

function liftHeight(phys, fps) {
  const m = 5;
  const b = phys.addBody({ shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] }, mass: m, material: 'wood', position: { x: 0, y: 10, z: 0 } });
  for (let i = 0; i < fps * 0.5; i++) { phys.applyForce(b, 0, 30 * m + 9.82 * m, 0); phys.step(1 / fps); }
  const y = b.position.y - 10;
  cleanup(phys, [b]);
  return y;
}

function forceIsFrameRateIndependent(phys) {
  const ys = [30, 60, 120].map((fps) => liftHeight(phys, fps));
  const ref = ys[1];
  const pass = ref > 1 && ys.every((y) => Math.abs(y - ref) / ref < 0.05);
  return { name: 'forceIsFrameRateIndependent', pass, detail: `lift@30/60/120fps=${ys.map((y) => y.toFixed(3)).join('/')} expected within 5%` };
}

function forcesAddUpAndExpire(phys) {
  const m = 2;
  const mk = () => phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: m, material: 'ball', position: { x: 0, y: 50, z: 0 } });
  const one = mk(), two = mk();
  // gravity cancelled so only the test force acts
  phys.applyForce(one, 10 * m, 9.82 * m, 0);
  phys.applyForce(two, 5 * m, 9.82 * m / 2, 0); phys.applyForce(two, 5 * m, 9.82 * m / 2, 0);
  phys.step(1 / 60);
  const v1 = phys.getVelocity(one).x, v2 = phys.getVelocity(two).x;
  phys.step(1 / 60); // no new applyForce: velocity must not grow
  const v1b = phys.getVelocity(one).x;
  cleanup(phys, [one, two]);
  const pass = Math.abs(v1 - v2) < 0.02 && v1 > 0.1 && Math.abs(v1b - v1) < 0.02;
  return { name: 'forcesAddUpAndExpire', pass, detail: `v1=${v1.toFixed(3)} v2=${v2.toFixed(3)} next=${v1b.toFixed(3)}` };
}

function removeBodyDropsPendingForce(phys) {
  const b = phys.addBody({ shape: { kind: 'sphere', radius: 0.5 }, mass: 1, material: 'ball', position: { x: 0, y: 5, z: 0 } });
  phys.applyForce(b, 1, 1, 1);
  phys.removeBody(b);
  let threw = null;
  try { phys.step(1 / 60); } catch (e) { threw = e.message; }
  return { name: 'removeBodyDropsPendingForce', pass: threw === null, detail: threw === null ? 'step ok' : 'threw: ' + threw };
}
```

- [ ] **Step 3: Run and see the failure.** Serve the repo and open the harness headless; the first two new cases must FAIL and the rest pass:

```bash
(python3 -m http.server 8766 >/dev/null 2>&1 &)
cat > "$TMPDIR/contract.py" <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto("http://localhost:8766/test/harness/physics-contract.html")
    pg.wait_for_function("document.title.startsWith('CONTRACT')", timeout=120000)
    print(pg.title()); print(pg.inner_text('#out')); b.close()
PY
systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0 python3 "$TMPDIR/contract.py"
```

Expected: `CONTRACT FAIL`, with `forceHoldsAgainstGravity` and `forceIsFrameRateIndependent` FAIL. Keep the server running for Task 2.

### Task 2: Persistent forces in the backend

**Files:**
- Modify: `physics/backend-crashcat.js`

- [ ] **Step 1: Add the map.** After `const pendingCollisions = [];` add:

```js
  const pendingForces = new Map();   // handle → [fx, fy, fz]; crashcat clears forces after every updateWorld, so step() re-applies these per substep
```

- [ ] **Step 2: Replace `applyForce`.**

```js
  // A force set during a frame acts for the whole next step() (all its substeps) and is gone
  // afterwards, like cannon-es. Several calls for one body add up.
  function applyForce(h, x, y, z) {
    cc.rigidBody.wake(world, h.raw);
    const f = pendingForces.get(h);
    if (f) { f[0] += x; f[1] += y; f[2] += z; } else pendingForces.set(h, [x, y, z]);
  }
```

- [ ] **Step 3: Re-apply in `step`.** Replace `step` with:

```js
  function step(dt) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= FIXED && n < 10) {
      for (const [h, f] of pendingForces) cc.rigidBody.addForce(world, h.raw, f, true);
      cc.updateWorld(world, listener, FIXED);
      flushCollisions();
      wakeAroundMovers();
      accumulator -= FIXED;
      n++;
    }
    if (n === 10) accumulator = 0;
    if (n > 0) pendingForces.clear(); // a step with no substep keeps them for the next one
  }
```

- [ ] **Step 4: Drop entries on removal.** In `removeBody` add `pendingForces.delete(h);` after `collideCbs.delete(h);`. In `destroy` add `pendingForces.clear();` after `pendingCollisions.length = 0;`.

- [ ] **Step 5: Run the harness (same command as Task 1).** Expected: `CONTRACT PASS`, all cases PASS including the four new ones and the existing 15. If `forcesAddUpAndExpire` fails on `v1 > 0.1`, print `v1` and fix the test's expected value, not the backend.

- [ ] **Step 6: Commit.**

```bash
git add physics/backend-crashcat.js test/harness/contract.js
git commit -m "fix(physics): per-frame forces act on every substep (#29)"
```

### Task 3: Confirm in the game and clean up

**Files:**
- None modified (verification only)

- [ ] **Step 1: Magneto probe.** With the server from Task 1 and Playwright (headless, Chromium), open `http://localhost:8766/index.html`, pick the Magneto weapon, hold the mouse on the barrels for 1.5 s and read the barrels' y with `page.evaluate` against the game's `barrels` array if exposed; if it is not exposed, take a screenshot before/after and confirm barrels lifted. Expected: held barrels visibly rise and gather. Do not edit `index.html`.

- [ ] **Step 2: Stop the server.** Kill it by port: `pkill -f "http.server 8766"`; remove `$TMPDIR/contract.py`.

- [ ] **Step 3: Run the Node tests.** `node --test test/*.test.mjs` (no new Node tests; they must stay green).
