# Paintball colour picker (#81) Implementation Plan

> For agentic workers: implement task by task, TDD, one commit per task. Spec: `docs/superpowers/specs/2026-11-26-issue-81-paintball-picker-design.md`.

**Goal:** Picking Paintball keeps the weapon sheet open so the colour swatches show; a dot on the 💥 button shows and cycles the colour.

**Architecture:** Pure logic (sheet reducer event, dot info helper) in the existing modules with node tests; wiring in `index.html`; docs last.

**Note:** #78 (charges) may land first and touch other parts of `index.html`. Find code by function and element names (`setPaintChoice`, `setAmmo`, `applySheet`, `#mob-bar`), not by line numbers. Run `node --test test/*.test.mjs` before each commit. Do not run Playwright.

### Task 1: Reducer event and dot helper

**Files:** Modify `ui/sheet.js`, `weapons/paintball.js`, `test/sheet.test.mjs`. Create `test/paint-dot.test.mjs`.

- [ ] **Step 1: Failing tests.** Append to `test/sheet.test.mjs`:

```js
test('sheetAfter_PickKeepOpen_KeepsAmmoOpen', () => {
  assert.equal(sheetAfter('ammo', 'pick-keep-open'), 'ammo');
});
test('sheetAfter_PickKeepOpenWhileClosed_StaysClosed', () => {
  assert.equal(sheetAfter(null, 'pick-keep-open'), null);
});
test('sheetAfter_PickAfterKeepOpen_Closes', () => {
  assert.equal(sheetAfter(sheetAfter('ammo', 'pick-keep-open'), 'pick'), null);
});
```

Create `test/paint-dot.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINT_COLORS, RANDOM_PAINT, paintDotInfo } from '../weapons/paintball.js';

test('paintDotInfo_EveryColour_UsesBallColourAndName', () => {
  PAINT_COLORS.forEach((c, i) => {
    const d = paintDotInfo(i);
    assert.equal(d.color, c.ball);
    assert.equal(d.glyph, '');
    assert.equal(d.label, c.name);
    assert.equal(d.title, `Paint colour: ${c.name}, click to change`);
  });
});
test('paintDotInfo_Random_ShowsDice', () => {
  const d = paintDotInfo(RANDOM_PAINT);
  assert.equal(d.color, null);
  assert.equal(d.glyph, '🎲');
  assert.equal(d.title, 'Paint colour: Random, click to change');
});
```

- [ ] **Step 2:** `node --test test/sheet.test.mjs test/paint-dot.test.mjs` fails (no such event, no export).

- [ ] **Step 3: Implement.** In `ui/sheet.js` add one case before `default`:

```js
    case 'pick-keep-open': return open;   // paintball: the swatches stay in view (#81)
```

Append to `weapons/paintball.js`:

```js
// The dot on the weapon button while paintball is selected (#81).
export function paintDotInfo(choice) {
  const random = choice === RANDOM_PAINT;
  const label = random ? 'Random' : PAINT_COLORS[choice].name;
  return {
    color: random ? null : PAINT_COLORS[choice].ball,
    glyph: random ? '🎲' : '',
    label,
    title: `Paint colour: ${label}, click to change`,
  };
}
```

- [ ] **Step 4:** `node --test test/*.test.mjs` passes.
- [ ] **Step 5:** Commit `feat(paintball): keep-open sheet event and colour dot helper (#81)`.

### Task 2: Wire it up in index.html

**Files:** Modify `index.html`.

- [ ] **Step 1: Markup.** In `#mob-bar`, directly after the `#mob-weapon` button add:

```html
  <button id="mob-paint" type="button" hidden><span id="mob-paint-dot"></span></button>
```

- [ ] **Step 2: CSS.** After the `#mob-bar button:hover` rule add:

```css
  #mob-bar #mob-paint { padding: 7px 9px; line-height: 1; }
  #mob-paint-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #f5efe4; box-sizing: border-box; font-size: 13px; line-height: 10px; text-align: center; }
  #mob-paint-dot.dice { border: 0; width: auto; height: auto; line-height: 1; }
```

- [ ] **Step 3: Import.** Add `paintDotInfo` to the existing `import { PAINT_COLORS, RANDOM_PAINT, nextPaintChoice, paintIndexForShot } from './weapons/paintball.js';`.

- [ ] **Step 4: Dot sync.** Directly above `function setPaintChoice` add:

```js
function syncPaintDot() {
  const btn = document.getElementById('mob-paint');
  const dot = document.getElementById('mob-paint-dot');
  btn.hidden = ammoType !== 'paintball';
  const d = paintDotInfo(paintChoice);
  dot.style.background = d.color || 'none';
  dot.classList.toggle('dice', d.glyph !== '');
  dot.textContent = d.glyph;
  btn.title = d.title;
  btn.setAttribute('aria-label', d.title);
}
```

At the end of `setPaintChoice` (after the `for` loop) add `syncPaintDot();`. In `setAmmo`, after `paintColorsEl.hidden = type !== 'paintball';` add `syncPaintDot();`. (`setPaintChoice(0)` runs at load, which sets the initial hidden state.)

- [ ] **Step 5: Dot click.** Right after the `paintColorsEl.addEventListener('click', ...)` block add:

```js
document.getElementById('mob-paint').addEventListener('click', () => {
  if (autoPlay) return;
  setPaintChoice(nextPaintChoice(paintChoice));   // like the P key; does not open the sheet
});
```

- [ ] **Step 6: Sheet handler.** In the Mobile-mode section, replace the line `el.addEventListener('click', (e) => { if (e.target.closest('button:not(.swatch)')) applySheet('pick'); });` with:

```js
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    // Paintball keeps the sheet open so its swatches show; a swatch (or any other pick) closes it (#81).
    applySheet(b.dataset.type === 'paintball' ? 'pick-keep-open' : 'pick');
  });
```

A swatch has no `data-type`, so it sends `'pick'` and closes the sheet; the `#paint-colors` handler has already set the colour (it runs first while the click bubbles). The `new MutationObserver(...)` line below stays as is.

- [ ] **Step 7: Check.** `node --test test/*.test.mjs` still passes. Read the edited code once for typos (the module has no unit test for DOM code). Optional single cheap check, only if it takes under two minutes: `node --check` is not possible on inline modules, so skip it.
- [ ] **Step 8:** Commit `feat(ui): paintball keeps the weapon sheet open, colour dot on the weapon button (#81)`.

### Task 3: README and CHANGELOG

**Files:** Modify `README.md`, `CHANGELOG.md`.

- [ ] **Step 1: README.** In the **Switch ammo** row replace `` `P` (paintball; `P` again cycles the colour) `` with `` `P` (paintball; `P` again cycles the colour; picking Paintball in the list keeps it open for the colour swatches, and the dot next to 💥 shows the colour and cycles it) ``.
- [ ] **Step 2: CHANGELOG.** Under `## [Unreleased]` add to the `### Added` list (first entry):

```
- Paintball colour picker is visible again: choosing Paintball keeps the weapon list open so the colour swatches show, and a colour dot next to the 💥 button (🎲 for random) shows the colour and cycles it with a click, like the P key (#81)
```

- [ ] **Step 3:** `node --test test/*.test.mjs` passes.
- [ ] **Step 4:** Commit `docs: paintball colour picker in README and changelog (#81)`.
