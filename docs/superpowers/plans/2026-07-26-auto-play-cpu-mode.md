# Auto-Play CPU Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable "Auto-Play" CPU mode that fires basketballs at the nearest standing barrel, full power, waiting for the scene to settle between shots, and stops itself when all 21 barrels are down.

**Architecture:** A single `autoPlay` boolean + a tiny state machine (`aiming` → `settling` → `aiming`, or stopped on win) driven from the existing `requestAnimationFrame` loop in `index.html`. No new timers, no build step, no test framework — this is a buildless single-file game (see Global Constraints).

**Tech Stack:** Vanilla JS ES modules, `three@0.160.0`, `cannon-es@0.20.0` — all loaded via CDN import map already in `index.html`. No changes to dependencies.

## Global Constraints

- Single file: all changes go into `index.html`. No build step, no new files.
- **Buildless stack — no test framework.** Per this repo's `CLAUDE.md` ("Tooling & Testing"), the test gate is a disciplined **manual in-browser playtest**, not automated tests. Every task ends with a manual verification step instead of a unit test.
- Local serving: `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000` (per README "Running Locally"). ES-module imports require serving over HTTP, not `file://`.
- Default game state already matches the issue's "Basketball → Barrels": `ammoType = 'basketball'` (`index.html:1051`), `targetMode = 'barrels'` (`index.html:967`) — auto-play does not need to change ammo or target selection itself.
- Existing conventions to match: buttons share the `#reset, .target button { ... }` CSS rule (`index.html:29-35`); per-barrel state lives on each `barrels[]` entry as `{ body, mesh, home, homeQ, down }` (`index.html:219`, populated in `setupBarrels`); firing goes through `shootBall(dir, power)` (`index.html:1119`), which already increments `shots` and calls `updateHud()` internally — auto-play must not increment `shots` itself or it will double-count.

---

### Task 1: Auto-Play button (markup + styling)

**Files:**
- Modify: `index.html:28-38` (CSS, `<style>` block)
- Modify: `index.html:109` (HTML, next to the existing Reset button)

**Interfaces:**
- Produces: a `<button id="autoplay">` DOM element with an `.active` CSS state class, for Task 2 to wire up via `document.getElementById('autoplay')` and `classList.add/remove('active')`.

- [ ] **Step 1: Add the button markup**

In `index.html`, immediately after line 109 (`<button id="reset">Reset</button>`), add:

```html
<button id="reset">Reset</button>
<button id="autoplay">▶ Auto-Play</button>
```

- [ ] **Step 2: Style it to match the existing Reset/target buttons, positioned just below Reset**

In the `<style>` block, extend the shared button-style selector (currently
`#reset, .target button` at line 29) and its hover rule (line 35) to include
`#autoplay`, and add its own position + active-state rules right after the
existing `#reset` position rule (line 28):

```css
  #reset { position: fixed; top: 20px; right: 20px; }
  #autoplay { position: fixed; top: 66px; right: 20px; }
  #reset, .target button, #autoplay {
    padding: 10px 20px; font-size: 14px;
    background: rgba(245,239,228,0.1); color: #f5efe4; border: 1px solid rgba(245,239,228,0.3);
    border-radius: 6px; cursor: pointer; letter-spacing: 1px; text-transform: uppercase;
    font-family: inherit;
  }
  #reset:hover, .target button:hover, #autoplay:hover { background: rgba(245,239,228,0.22); }
  #autoplay.active { background: rgba(245,239,228,0.28); border-color: rgba(245,239,228,0.7); }
```

(This replaces the existing lines 28-35 — same rule, `#autoplay` folded in,
plus the two new position/active-state lines.)

- [ ] **Step 3: Manual verification**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`, open the browser console, and confirm:

- Console has no errors/warnings on load.
- A "▶ Auto-Play" button renders directly below the "Reset" button, same
  visual style.
- Clicking it does nothing yet (no JS wired up until Task 2) and doesn't
  throw a console error.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(autoplay): add Auto-Play button markup and styling"
```

---

### Task 2: Auto-play state machine, targeting, pacing, and input guards

**Files:**
- Modify: `index.html:1876-1897` (`pointerdown`/`pointerup` handlers — add guard clauses)
- Modify: `index.html:1060-1063` (`ammoEl` click handler — add guard clause)
- Modify: `index.html:1005-1011` (`targetEl` click handler — add guard clause)
- Modify: `index.html:1941-1971` (`keydown` handler — add guard clause)
- Modify: `index.html:1976` (new `// ---------- Auto-play ----------` section, inserted just before `// ---------- Loop ----------`)
- Modify: `index.html:2037-2052` (inside `animate()` — call the new update function)

**Interfaces:**
- Consumes: `barrels` (array of `{ body, mesh, home, homeQ, down }`, `index.html:219`), `balls` (array of `{ body, mesh, born, type, exploded, ... }`, `index.html:1049`), `camera` (`THREE.PerspectiveCamera`, `index.html:151`), `shootBall(dir: THREE.Vector3, power: number)` (`index.html:1119`), `updateHud()` (`index.html:1908`), the `#autoplay` button from Task 1.
- Produces: `autoPlay` (boolean, module-level), `stopAutoPlay()` (function, no args, no return), `updateAutoPlay(now: number)` (function, called once per animation frame).

- [ ] **Step 1: Add the auto-play state machine**

In `index.html`, insert this new section right before the `// ---------- Loop ----------` comment (currently line 1977):

```javascript
// ---------- Auto-play ----------
let autoPlay = false;
let autoPlayState = 'idle'; // 'idle' | 'aiming' | 'settling'
let autoPlayShotAt = 0;
const autoPlayEl = document.getElementById('autoplay');
const AUTOPLAY_SETTLE_VELOCITY = 0.05;
const AUTOPLAY_SHOT_TIMEOUT_MS = 5000;

function nearestStandingBarrel() {
  let best = null, bestDist = Infinity;
  for (const b of barrels) {
    if (b.down) continue;
    const d = camera.position.distanceTo(b.mesh.position);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

function autoPlaySceneSettled() {
  for (const b of balls) if (b.body.velocity.length() > AUTOPLAY_SETTLE_VELOCITY) return false;
  for (const b of barrels) if (b.body.velocity.length() > AUTOPLAY_SETTLE_VELOCITY) return false;
  return true;
}

function autoPlayFireNext() {
  const target = nearestStandingBarrel();
  if (!target) return; // win check in updateAutoPlay stops autoplay before this can happen
  const dir = target.mesh.position.clone().sub(camera.position).normalize();
  shootBall(dir, 1.0);
  autoPlayState = 'settling';
  autoPlayShotAt = performance.now();
}

function stopAutoPlay() {
  autoPlay = false;
  autoPlayState = 'idle';
  autoPlayEl.classList.remove('active');
}

function updateAutoPlay(now) {
  if (!autoPlay) return;
  if (barrels.filter(b => b.down).length === barrels.length) { stopAutoPlay(); return; }
  if (autoPlayState === 'settling') {
    const timedOut = now - autoPlayShotAt > AUTOPLAY_SHOT_TIMEOUT_MS;
    if (!autoPlaySceneSettled() && !timedOut) return;
    autoPlayState = 'aiming';
  }
  if (autoPlayState === 'aiming') autoPlayFireNext();
}

autoPlayEl.addEventListener('click', () => {
  if (autoPlay) { stopAutoPlay(); return; }
  autoPlay = true;
  autoPlayState = 'aiming';
  autoPlayEl.classList.add('active');
});
```

- [ ] **Step 2: Call the update function from the render loop**

In `animate()`, right after the barrel knockdown-sync block (currently ending
at line 2052 with `if (changed) updateHud();`), add one line:

```javascript
  if (changed) updateHud();
  updateAutoPlay(now);
```

- [ ] **Step 3: Guard manual aim/fire while auto-play is active**

In the `canvas.addEventListener('pointerdown', ...)` handler (currently
starting at line 1876), add a guard right after the right-click/orbit branch:

```javascript
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) {
    orbiting = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (autoPlay) return;
  if (e.button !== 0) return;
  ...
```

In the `addEventListener('pointerup', ...)` handler (currently starting at
line 1889), add the same guard right after the orbit-stop branch:

```javascript
addEventListener('pointerup', (e) => {
  if (e.button === 2) { orbiting = false; return; }
  if (autoPlay) return;
  if (magnetoActive) { magnetoActive = false; return; }
  ...
```

- [ ] **Step 4: Guard ammo and target switching while auto-play is active**

In the `ammoEl.addEventListener('click', ...)` handler (currently at line 1060):

```javascript
ammoEl.addEventListener('click', (e) => {
  if (autoPlay) return;
  const btn = e.target.closest('button');
  if (btn) setAmmo(btn.dataset.type);
});
```

In the `targetEl.addEventListener('click', ...)` handler (currently at line 1005):

```javascript
targetEl.addEventListener('click', (e) => {
  if (autoPlay) return;
  const btn = e.target.closest('button');
  ...
```

In the `keydown` handler (currently at line 1941), add one guard line right
after `k` is computed — every ammo-switch shortcut (`1`-`9`, `0`, and the
letter keys) is a separate `if (k === ...)` in this handler, so a single
early return (excluding `r`, which should still work as an escape hatch)
covers all of them without touching each line:

```javascript
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (autoPlay && k !== 'r') return;
  if (k === 'r') reset();
  ...
```

- [ ] **Step 5: Manual verification**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` with the console open and confirm:

- Console has no errors/warnings at any point below.
- Click "▶ Auto-Play": it fires only basketballs, aimed at the barrel
  pyramid, one at a time, waiting between shots.
- Let it run to completion: all 21 barrels go down, the shot counter
  ("Balls: Shots: N") shows a real count (no double-counting), and the
  score HUD shows the existing win-color feedback. Auto-play stops itself —
  the button returns to its non-`active` style.
- Mid-run, try: clicking to aim/fire manually, pressing an ammo key (e.g.
  `1`), clicking a target button — none of these should do anything while
  auto-play is active.
- Mid-run, right-click-drag to orbit the camera — this should still work.
- Toggle "▶ Auto-Play" off mid-run: the in-flight shot finishes settling,
  then it stops (no further shots fire); manual aim/fire, ammo keys, and
  target switching all work again immediately.
- Press `R` to reset while auto-play is active: it should still reset (not
  blocked by the guard).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(autoplay): implement auto-play CPU mode

Adds a toggleable auto-play state machine that fires basketballs at the
nearest standing barrel, full power, waiting for the scene to settle
between shots, and stopping itself when all barrels are down. Manual
aim/fire, ammo switching, and target switching are disabled while active;
orbit-camera and reset still work.

Closes #3"
```

---

## Self-review notes

- **Spec coverage:** button placement/styling (Task 1) · nearest-standing-barrel
  aiming, full power, direct 3D vector (Task 2 Step 1) · settle-based pacing
  with a per-shot timeout safety net (Task 2 Step 1) · toggle button + manual
  input disabled while active, orbit still works (Task 2 Steps 1/3/4) · win
  check auto-stops with no shot cap (Task 2 Step 1) · manual in-browser
  verification in place of automated tests (both tasks' final steps, per this
  repo's buildless-stack testing convention) — every spec section maps to a task.
- **No placeholders:** all steps show literal code to add, with exact
  before/after context and line numbers as of this plan's writing.
- **Type/name consistency:** `autoPlay`, `autoPlayState`, `stopAutoPlay()`,
  `updateAutoPlay(now)`, `nearestStandingBarrel()`, `autoPlaySceneSettled()`,
  `autoPlayFireNext()` are used with the same names everywhere they appear
  across both tasks.
