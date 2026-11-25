# Desktop Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Pull, Cut and Boom buttons on desktop in the existing `#act-bar`, add a new Cut action (button on desktop and mobile, key `O` on desktop), each button visible only while it applies (#63).

**Architecture:** A pure module `ui/actions.js` decides which buttons are visible. `index.html` gets a `#act-cut` button, one `syncActionBar()` that replaces the scattered `hidden` writes, a `cutTether()` action and CSS that makes `#act-bar` work on desktop.

**Tech Stack:** buildless vanilla JS (ES modules), `node:test`, Python Playwright for one screenshot check.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-63-desktop-action-buttons-design.md`

## Global Constraints

- **Runs after #61.** #61 edits the same CSS area (the mobile-mode block, `#mob-bar` rules, hint position). Do not rely on its markup: read the current CSS, then change only the `#act-bar` rules.
- Change only `index.html`, `ui/actions.js`, `test/actions.test.mjs`, `README.md`, `CHANGELOG.md`. No physics or weapon changes; `detachHarpoon` and `detachNet` stay as they are.
- Space (hold) pulls, K detonates, Shift quakes: all unchanged.
- Quake button: mobile only.
- Tests run with `node --test test/*.test.mjs` (no `package.json`).
- Headless browser runs use `--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 180 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`. Stop servers with `fuser -k <port>/tcp`.
- Follow the repo's CLAUDE.md: conventional commits, README and CHANGELOG updates.

## Review Focus

1. **Pull stuck on:** after Cut, `pulling` must be false and the bar must hide Pull and Cut.
2. **Boom/Pull flicker or stale state** after Reset (`reset()` calls both detach functions).
3. **Desktop placement:** the bar must not cover the camera pad, the power bar or the aim area at 1280×720.
4. **Mobile unchanged** apart from the new Cut button.

---

### Task 1: Visibility module and unit tests

**Files:**
- Create: `ui/actions.js`, `test/actions.test.mjs`

- [ ] **Step 1: Write the failing test** `test/actions.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleActions, CUT_KEY } from '../ui/actions.js';

const none = { tethered: false, armed: 0, mobile: false };

test('visibleActions_Idle_Desktop_NothingShown', () => {
  assert.deepEqual(visibleActions(none), { quake: false, pull: false, cut: false, boom: false });
});
test('visibleActions_Idle_Mobile_OnlyQuake', () => {
  assert.deepEqual(visibleActions({ ...none, mobile: true }), { quake: true, pull: false, cut: false, boom: false });
});
test('visibleActions_Tethered_PullAndCut', () => {
  const v = visibleActions({ ...none, tethered: true });
  assert.equal(v.pull, true);
  assert.equal(v.cut, true);
  assert.equal(v.boom, false);
});
test('visibleActions_ArmedCharges_Boom', () => {
  assert.equal(visibleActions({ ...none, armed: 1 }).boom, true);
  assert.equal(visibleActions({ ...none, armed: 6 }).boom, true);
});
test('visibleActions_EverythingAtOnce_Mobile', () => {
  assert.deepEqual(visibleActions({ tethered: true, armed: 2, mobile: true }), { quake: true, pull: true, cut: true, boom: true });
});
test('CUT_KEY_IsLowercaseLetterO', () => {
  assert.equal(CUT_KEY, 'o');
});
```

- [ ] **Step 2: Run, expect failure:** `node --test test/actions.test.mjs` (`Cannot find module`).

- [ ] **Step 3: Implement** `ui/actions.js`:

```js
// Which #act-bar buttons apply right now (#63). Quake is mobile-only; on desktop Shift does it.
export const CUT_KEY = 'o';   // desktop key for "cut the rope"

export function visibleActions({ tethered, armed, mobile }) {
  return {
    quake: Boolean(mobile),
    pull: Boolean(tethered),
    cut: Boolean(tethered),
    boom: armed > 0,
  };
}
```

- [ ] **Step 4: Run all tests:** `node --test test/*.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ui/actions.js test/actions.test.mjs
git commit -m "feat(ui): action button visibility rules (#63)"
```

### Task 2: Markup and CSS, `#act-bar` on desktop

**Files:**
- Modify: `index.html` (markup near the `<div id="act-bar">`, CSS in the `<style>` block)

- [ ] **Step 1: Markup.** In `<div id="act-bar">`, add the Cut button between Pull and Boom, and make Quake start hidden (JS shows it on mobile):

```html
  <button id="act-quake" title="Hold for an earthquake" hidden>🌋<span>Quake</span></button>
  <button id="act-pull" title="Hold to reel the harpoon or net in (Space)" hidden>🪝<span>Pull</span></button>
  <button id="act-cut" title="Cut the rope (O)" hidden>✂️<span>Cut</span></button>
  <button id="act-boom" title="Detonate the remote charges (K)" hidden>💥<span>Boom</span></button>
```

- [ ] **Step 2: CSS.** In the `<style>` block, find every `#act-bar` rule (use search for `act-bar`). Make them apply on all screens:
  - Remove `#act-bar` from the pre-media `display: none` list (the line starting `#mob-bar, #act-bar, ...` or its #61 successor).
  - Before the mobile media query, add the always-on rules (desktop look and position):

```css
  /* ---------- Action bar (#63): Pull, Cut, Boom (and Quake on mobile), each shown only while it applies ---------- */
  #act-bar { display: flex; gap: 8px; position: fixed; right: calc(20px + var(--sa-r)); bottom: calc(190px + var(--sa-b)); user-select: none; -webkit-user-select: none; touch-action: none; }
  #act-bar button {
    font-family: inherit; color: #f5efe4; background: rgba(26,22,17,0.55);
    border: 1px solid rgba(245,239,228,0.3); border-radius: 6px; cursor: pointer;
    width: 60px; height: 60px; padding: 0; font-size: 22px; touch-action: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  }
  #act-bar button:hover { background: rgba(245,239,228,0.18); }
  #act-bar button span { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  #act-bar button[hidden] { display: none; }
  #act-bar button.held { background: rgba(245,239,228,0.32); border-color: rgba(245,239,228,0.7); }
```

  - In the mobile media query, reduce the `#act-bar` rules to the placement override only: `#act-bar { left: calc(12px + var(--sa-l)); right: auto; bottom: calc(46px + var(--sa-b)); }` and delete the now-duplicated `#act-bar button` look rules there (keep the mobile `#act-bar button` from any shared selector with `#mob-bar button`: if the selector is shared, drop only `#act-bar button` from the list).

- [ ] **Step 3: Verify by reading** that every `#act-bar` rule appears once always-on and once as a mobile override. Run `node --test test/*.test.mjs`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): show the action bar on desktop with a Cut button (#63)"
```

### Task 3: Wire `syncActionBar`, `cutTether` and the key

**Files:**
- Modify: `index.html` (imports ~line 353; `syncPullButton` ~line 2100; consts ~line 2546; the Mobile-mode JS section ~line 2864-2870; per-frame loop ~line 3187)

- [ ] **Step 1: Import.** After the other imports add `import { visibleActions, CUT_KEY } from './ui/actions.js';`.

- [ ] **Step 2: Element consts and the sync function.** Next to `const pullBtn = document.getElementById('act-pull');` add:

```js
const quakeBtn = document.getElementById('act-quake');
const cutBtn = document.getElementById('act-cut');
const boomBtn = document.getElementById('act-boom');   // shown while remote charges are armed
```

and remove the later `const boomBtn = document.getElementById('act-boom');` line (keep its `pointerdown` listener). Replace `syncPullButton` with:

```js
function setHidden(el, hidden) { if (el.hidden !== hidden) el.hidden = hidden; }
function syncActionBar() {
  const v = visibleActions({
    tethered: Boolean(harpoonLink || netLink),
    armed: armedRemotes(balls).length,
    mobile: mobileQuery.matches,
  });
  setHidden(quakeBtn, !v.quake);
  setHidden(pullBtn, !v.pull);
  setHidden(cutBtn, !v.cut);
  setHidden(boomBtn, !v.boom);
  if (!v.pull) pulling = false;
}
function syncPullButton() { syncActionBar(); }   // kept: the harpoon and net code calls this name
```

- [ ] **Step 3: Cut action, button and key.** Add near the `holdButton` calls:

```js
function cutTether() {
  if (!harpoonLink && !netLink) return;
  detachHarpoon();
  detachNet();
  pulling = false;
  syncActionBar();
}
cutBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!autoPlay) cutTether(); });
mobileQuery.addEventListener('change', syncActionBar);
syncActionBar();
```

In the main `keydown` handler (the one with `if (k === 'k') detonateRemoteCharges();`) add `if (k === CUT_KEY) cutTether();`. In the per-frame loop replace the two lines `const armed = armedRemotes(balls).length > 0;` and `if (boomBtn.hidden === armed) boomBtn.hidden = !armed;` with `syncActionBar();`. Search `index.html` for any other `pullBtn.hidden` or `boomBtn.hidden` write and remove it.

- [ ] **Step 4: Run tests:** `node --test test/*.test.mjs`. Expected: pass. Check by reading that `mobileQuery` is defined (line ~2828) before the first `syncActionBar()` call executes at load; if the new `syncActionBar();` line sits above that const, move it below.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): Cut action with O key, one syncActionBar for all action buttons (#63)"
```

### Task 4: Hint text, docs, screenshot check

**Files:**
- Modify: `index.html` (`#hint` spans), `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Hint.** In `.hint-desk` replace `Harpoon and heavy net — hold Space to reel the catch in` with `Harpoon and heavy net — hold Space (or Pull) to reel the catch in, O (or Cut) to let it go` and `K detonates remote charges` with `K (or Boom) detonates remote charges`. In `.hint-touch` replace `Harpoon and net: hold Pull to reel the catch in` with `Harpoon and net: hold Pull to reel the catch in, Cut lets it go`.

- [ ] **Step 2: Docs.** `README.md`: in the mobile table change the Pull row to `Hold the 🪝 Pull button, or tap ✂️ Cut to let the catch go; both show while a harpoon or net holds something`. In the desktop controls add rows: `Pull / Cut` (hold Space or the Pull button; `O` or the Cut button), `Detonate` (`K` or the Boom button, bottom right, shown while remote charges are placed). Fix the sentence in the Launchers line to `hold Space / Pull to drag them in, O / Cut to let go`. `CHANGELOG.md` under `## [Unreleased]`: `### Added` entry `- Action buttons on desktop: Pull, Boom and a new Cut button (key O) that lets go of a harpoon or heavy net, each shown only while it applies; Cut is on mobile too (#63)`.

- [ ] **Step 3: Unit tests and one screenshot check.** Run `node --test test/*.test.mjs`. Serve the repo (`python3 -m http.server 8765` in the background) and use Python Playwright (swiftshader flags, capped as in Global Constraints) at 1280×720 and 390×844 (mobile, touch). In each: load the page, fire the Harpoon at a barrel (select with key `J` on desktop or the sheet on mobile; click or tap the barrels) until `#act-pull` is visible, select Remote charge (`B`) and fire one to arm it, wait for `#act-boom` to be visible, screenshot; click `#act-cut`, assert `#act-pull` and `#act-cut` are hidden and `#act-boom` is still visible, screenshot. If aiming is flaky, set the tether up with at most two attempts, otherwise report which assertion could not be checked. Look at the screenshots with the Read tool. Expect desktop: the bar bottom right above the camera pad, not covering the pad or the aim area; mobile: bar bottom left as before plus Cut. Stop the server with `fuser -k 8765/tcp`, delete the screenshots.

- [ ] **Step 4: Commit**

```bash
git add index.html README.md CHANGELOG.md
git commit -m "docs: hint, README and CHANGELOG for the desktop action buttons (#63)"
```
