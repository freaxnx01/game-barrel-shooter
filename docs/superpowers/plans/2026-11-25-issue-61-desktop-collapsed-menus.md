# Desktop Collapsed Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this plan is dispatched through the issue pipeline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop, collapse the weapon and target lists into the `#mob-bar` buttons with a click-to-open sheet, like mobile, so the chimney foot is no longer covered (#61).

**Architecture:** The sheet open/close logic becomes a pure module `ui/sheet.js`. The sheet CSS moves out of the mobile media query into an always-on block, with desktop placement; mobile keeps overrides. `index.html` wires the module and adds Escape.

**Tech Stack:** buildless vanilla JS (ES modules), `node:test`, Python Playwright for one screenshot check.

**Spec:** `docs/superpowers/specs/2026-11-25-issue-61-desktop-collapsed-menus-design.md`

## Global Constraints

- Change only `index.html`, `ui/sheet.js`, `test/sheet.test.mjs`, `README.md`, `CHANGELOG.md`. No physics, camera, weapon or target code.
- Mobile mode must look and behave as before (same sheet geometry, `?` button, key letters hidden in the sheet).
- Keyboard shortcuts unchanged.
- Issue #63 (action buttons) runs after this one and edits the same CSS area (the mobile-mode block and the area near `#act-bar`). Do not touch `#act-bar` rules here.
- Tests run with `node --test test/*.test.mjs` (no `package.json`).
- Headless browser runs use `--use-gl=swiftshader --enable-unsafe-swiftshader`, wrapped in `timeout 180 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`. Stop servers with `fuser -k <port>/tcp`.
- Follow the repo's CLAUDE.md: conventional commits, README and CHANGELOG updates.

## Review Focus

1. **Mobile regression:** the moved CSS must keep the mobile sheet full width and the key letters hidden there.
2. **Hint and `#mob-bar` overlap** on desktop at 1280×720.
3. **`#mob-help` / `#mob-jenga-shoot`** must still show on mobile and stay hidden on desktop.

---

### Task 1: Sheet reducer and unit tests

**Files:**
- Create: `ui/sheet.js`, `test/sheet.test.mjs`

- [ ] **Step 1: Write the failing test** `test/sheet.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetAfter } from '../ui/sheet.js';

test('sheetAfter_OpenAmmo_ShowsAmmo', () => {
  assert.equal(sheetAfter(null, 'open-ammo'), 'ammo');
});
test('sheetAfter_OpenTargetWhileAmmoOpen_SwitchesToTarget', () => {
  assert.equal(sheetAfter('ammo', 'open-target'), 'target');
});
test('sheetAfter_CloseEvents_Close', () => {
  for (const ev of ['backdrop', 'pick', 'escape', 'layout-change']) {
    assert.equal(sheetAfter('ammo', ev), null, ev);
    assert.equal(sheetAfter(null, ev), null, ev);
  }
});
test('sheetAfter_UnknownEvent_KeepsState', () => {
  assert.equal(sheetAfter('target', 'nonsense'), 'target');
  assert.equal(sheetAfter(null, 'nonsense'), null);
});
```

- [ ] **Step 2: Run it, expect failure** (`Cannot find module`): `node --test test/sheet.test.mjs`

- [ ] **Step 3: Implement** `ui/sheet.js`:

```js
// Which list sheet is open: null, 'ammo' or 'target' (#61).
export function sheetAfter(open, event) {
  switch (event) {
    case 'open-ammo': return 'ammo';
    case 'open-target': return 'target';
    case 'backdrop':
    case 'pick':
    case 'escape':
    case 'layout-change': return null;
    default: return open;
  }
}
```

- [ ] **Step 4: Run all tests:** `node --test test/*.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ui/sheet.js test/sheet.test.mjs
git commit -m "feat(ui): sheet open/close reducer (#61)"
```

### Task 2: CSS, always-on collapsed menus

**Files:**
- Modify: `index.html` (the `<style>` block, lines ~21-165, and the `.hint` markup is untouched)

- [ ] **Step 1: Move the sheet rules out of the mobile media query.** In the `<style>` block, find the line `#mob-bar, #act-bar, #sheet-backdrop, .hint .hint-touch, .hint .hint-reload, .hint .hint-ios { display: none; }` (just under the "Mobile mode (#37)" comment). Replace it with:

```css
  #act-bar, .hint .hint-touch, .hint .hint-reload, .hint .hint-ios { display: none; }

  /* ---------- Collapsed menus (#61): weapon and target lists open as a sheet, on every screen size ---------- */
  #sheet-backdrop { display: none; }
  #sheet-backdrop.open { display: block; position: fixed; inset: 0; z-index: 19; background: rgba(0,0,0,0.45); }
  .ammo, .target { display: none; }
  .ammo.open, .target.open {
    position: fixed; z-index: 20; top: calc(8px + var(--sa-t)); left: 50%; transform: translateX(-50%); right: auto; bottom: auto;
    width: min(900px, calc(100% - 16px)); max-width: none; max-height: calc(100% - 56px - var(--sa-t) - var(--sa-b));
    overflow-y: auto; box-sizing: border-box; padding: 12px;
    background: rgba(26,22,17,0.96); border: 1px solid rgba(245,239,228,0.25); border-radius: 10px; color: #f5efe4;
  }
  .ammo.open { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; align-items: start; }
  .ammo.open button { width: 100%; }
  .ammo.open .paint-colors .swatch { width: 28px; height: 28px; }
  .target.open { display: flex; }
  #mob-bar { display: flex; gap: 6px; position: fixed; top: calc(116px + var(--sa-t)); left: calc(22px + var(--sa-l)); }
  #mob-bar button {
    font-family: inherit; color: #f5efe4; background: rgba(26,22,17,0.55);
    border: 1px solid rgba(245,239,228,0.3); border-radius: 6px; cursor: pointer;
    padding: 7px 10px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; touch-action: manipulation;
  }
  #mob-bar button:hover { background: rgba(245,239,228,0.18); }
  #mob-help, #mob-jenga-shoot { display: none; }   /* desktop: the hint is always visible, #jenga-shoot is its own button */
  .hint { top: calc(164px + var(--sa-t)); }
```

- [ ] **Step 2: Trim the mobile block to its overrides.** Inside `@media (max-width: 900px), (pointer: coarse) { ... }`:
  - Replace the `#mob-bar { display: flex; ... }` line with `#mob-bar { top: calc(86px + var(--sa-t)); left: calc(12px + var(--sa-l)); right: calc(12px + var(--sa-r)); }`.
  - Change the shared rule `#mob-bar button, #act-bar button { ... }` to `#act-bar button { ... }` (same declarations) and the following `#mob-bar button { padding... }` line to `#mob-bar button { max-width: 150px; }`.
  - Change `#mob-help { flex: none; width: 34px; padding: 7px 0 !important; font-weight: 700; }` to `#mob-help { display: block; flex: none; width: 34px; padding: 7px 0 !important; font-weight: 700; }` and add `#mob-jenga-shoot:not([hidden]) { display: block; }`.
  - In `.hint { display: none; top: calc(128px + ...` keep as is (it overrides the new desktop top).
  - Replace the block from `/* the two lists become sheets, opened from #mob-bar */` through `.target.open { display: flex; }` with only the mobile overrides:

```css
    /* the two lists are full-width sheets here (the desktop sheet is a centered panel) */
    .ammo.open, .target.open { left: calc(8px + var(--sa-l)); right: calc(8px + var(--sa-r)); transform: none; width: auto; }
    .ammo.open { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .ammo button span:not(.dot) { display: none; }
```

  Keep `.target .glabel { width: 48px; }`. Remove the now-duplicate `#sheet-backdrop.open` line.

- [ ] **Step 3: Verify by reading.** Search `index.html` for `mob-bar`, `.ammo.open`, `sheet-backdrop` in the CSS and confirm each rule exists once in the always-on block and only overrides in the media query. Run `node --test test/*.test.mjs`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(ui): collapse the weapon and target menus on desktop too (#61)"
```

### Task 3: Wire the reducer, Escape, hint text, docs, screenshot check

**Files:**
- Modify: `index.html` (JS section "Mobile mode (#37)", ~line 2827; the `.hint-desk` span at ~line 250), `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Use the reducer.** Add `import { sheetAfter } from './ui/sheet.js';` after the other imports (~line 353). Replace `closeSheets` and `openSheet` and the listeners that use them with:

```js
let sheetOpen = null;
function applySheet(event) {
  sheetOpen = sheetAfter(sheetOpen, event);
  ammoEl.classList.toggle('open', sheetOpen === 'ammo');
  targetEl.classList.toggle('open', sheetOpen === 'target');
  sheetBackdrop.classList.toggle('open', sheetOpen !== null);
}
```

and:

```js
document.getElementById('mob-weapon').addEventListener('click', () => applySheet('open-ammo'));
document.getElementById('mob-target').addEventListener('click', () => applySheet('open-target'));
sheetBackdrop.addEventListener('click', () => applySheet('backdrop'));
for (const el of [ammoEl, targetEl]) {
  el.addEventListener('click', (e) => { if (e.target.closest('button:not(.swatch)')) applySheet('pick'); });
  new MutationObserver(syncSheetLabels).observe(el, { subtree: true, attributeFilter: ['class'] });
}
mobileQuery.addEventListener('change', () => applySheet('layout-change'));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) applySheet('escape'); });
```

Keep `mob-help`, `buttonName`, `syncSheetLabels` and the final `syncSheetLabels();` call. Search for any other `closeSheets(` / `openSheet(` use and replace it with `applySheet(...)`.

- [ ] **Step 2: Desktop hint text.** In the `.hint-desk` span, replace `Aim with mouse, click to fire · ` with `Aim with mouse, click to fire · 🎯 and 💥 (top left) pick target and weapon, the keys still work · `.

- [ ] **Step 3: Docs.** `README.md`: change the "Switch ammo" row's `Grouped buttons bottom-left, or keys` to `The 💥 button top-left opens the weapon list (🎯 for targets), or keys`; add one line under the desktop controls that the 🎯/💥 buttons open sheets and Escape closes them. `CHANGELOG.md`: under `## [Unreleased]` add a `### Changed` entry (create the heading if absent): `- Desktop: the weapon and target lists collapse into the 🎯 and 💥 buttons like on mobile, so the weapon panel no longer covers the chimney foot (#61)`.

- [ ] **Step 4: Unit tests and one screenshot check.** Run `node --test test/*.test.mjs`. Then serve the repo (`python3 -m http.server 8765` in the background), and take screenshots with Python Playwright (swiftshader flags, capped as in Global Constraints): at 1280×720 select the Chimney target, screenshot collapsed; click `#mob-weapon`, screenshot the open sheet; press Escape and assert `#ammo` has no `open` class. At 390×844 (mobile, touch) screenshot collapsed and with `#mob-weapon` open. Look at all four with the Read tool. Expect: desktop, no weapon panel over the chimney foot, `#mob-bar` not overlapping the hint; mobile, unchanged. Stop the server with `fuser -k 8765/tcp`, delete the screenshots.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md CHANGELOG.md
git commit -m "feat(ui): sheet reducer wiring, Escape closes the menus, desktop hint (#61)"
```
