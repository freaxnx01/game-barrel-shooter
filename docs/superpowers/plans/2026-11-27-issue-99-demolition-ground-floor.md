# Demolition Tower Ground Floor on 3×3 Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The demolition tower's ground floor stands on 9 columns (3×3), and one blast crushes every column in reach on the same storey, so 5 charges still bring the tower down.

**Architecture:** `targets/demolition.js` holds the layout and the crush rule. Both are pure, with no THREE and no DOM. `demolitionLayout()` gives storey 0 a 3×3 grid under the same slab. `columnToCrush` (one column) becomes `columnsToCrush` (array, same storey only). `index.html` and the physics harness call it and crush each returned column.

**Tech Stack:** Vanilla ES modules, `node --test`, crashcat physics in the browser harness (`test/harness/demolition.html`).

**Spec:** `docs/superpowers/specs/2026-11-27-issue-99-demolition-ground-floor-design.md`

## Global Constraints

- Upper storeys (1–5) keep 2×2 columns at pitch 3. Slab size, storey height and top height (9 base units) do not change.
- Ground columns at x, z ∈ {-1.5, 0, 1.5} base units. 29 columns + 6 slabs = 35 blocks.
- `DEMO.breakRadius` = 1.8 world units (TSCALE 2).
- A blast never crushes columns on a storey other than that of the nearest column in reach (#97 review).
- The charge limit stays 6.
- Every commit ends with the session attribution lines the pipeline provides.

## Review Focus

- A charge on one column's face must not take its neighbour (they're 2.6+ away). Pinned in Task 1 (`columnsToCrush_OnFace_OnlyThatColumn`).
- A charge at the centre of four ground columns (2.12 from each) crushes none. Pinned in Task 1.
- A charge high on a ground column must not crush the column above, even with the larger reach. Pinned in Task 1 (#97 case).
- The slab-landing chain must still crush the columns of the storey above. That code isn't touched, and the harness pancake rows cover it in Task 2.
- The tower must stand still with 9 ground columns (no jitter from the extra contacts). Covered by the harness `stable` row in Task 2.

---

### Task 1: Layout and crush rule (`targets/demolition.js`)

**Files:**
- Modify: `targets/demolition.js` (DEMO, `demolitionLayout`, `columnToCrush` → `columnsToCrush`, header comment)
- Modify: `index.html:408` (import) and `index.html:1081-1085` (`crushNear`)
- Test: `test/demolition.test.mjs`

**Interfaces:**
- Produces: `DEMO.groundGrid` (3), `DEMO.breakRadius` (1.8); `columnsToCrush(p, columns) -> Array` where `columns` is `[{ position: {x,y,z}, hy, storey, ... }]` (world units) and the result contains the same objects that were passed in. `columnToCrush` is removed.

- [ ] **Step 1: Write the failing tests**

In `test/demolition.test.mjs`, change the import (replace `columnToCrush` with `columnsToCrush`) and replace these existing tests:

```js
test('demolitionLayout_Has35Blocks_29ColumnsAnd6Slabs', () => {
  assert.equal(demolitionLayout().length, 35);
  assert.equal(columns().length, 29);
  assert.equal(slabs().length, 6);
});
test('demolitionLayout_GroundColumnsStandOnGround_3x3', () => {
  const ground = columns().filter(b => b.storey === 0);
  assert.equal(ground.length, 9);
  for (const b of ground) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
  const xs = [...new Set(ground.map(b => b.x))].sort((a, b) => a - b);
  const zs = [...new Set(ground.map(b => b.z))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-1.5, 0, 1.5]);
  assert.deepEqual(zs, [-1.5, 0, 1.5]);
});
test('demolitionLayout_UpperColumnsAtPitch3AndAllSlim', () => {
  const upper = columns().filter(b => b.storey >= 1);
  assert.equal(upper.length, 20);
  const xs = [...new Set(upper.map(b => b.x))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-1.5, 1.5]);
  for (const b of columns()) {
    assert.ok(Math.abs(b.hx - 0.15) < 1e-9 && Math.abs(b.hz - 0.15) < 1e-9);
    assert.ok(Math.abs(b.hy - 0.625) < 1e-9);
  }
});
test('demolitionLayout_OneSlabPerStoreyOnItsColumns', () => {
  for (const s of slabs()) {
    const below = columns().filter(b => b.storey === s.storey);
    assert.equal(below.length, s.storey === 0 ? 9 : 4);
    for (const c of below) assert.ok(Math.abs(c.y + c.hy - (s.y - s.hy)) < 1e-9);
    assert.ok(Math.abs(s.hx - slabHalf()) < 1e-9 && Math.abs(s.hz - slabHalf()) < 1e-9);
  }
});
```

Keep `demolitionLayout_NoOverlaps`, `_EveryBlockSupported`, `_SlabOverhangsColumns` (it uses `columns()[0]`, which is at x = -1.5, so it still holds), `_TopAt9BaseUnits`, `_SlabsMuchHeavierThanColumns` unchanged. Delete the old `_Has30Blocks_24ColumnsAnd6Slabs`, `_GroundColumnsStandOnGround` and `_ColumnsAtPitch3AndSlim`.

Replace the two `columnToCrush_*` tests with:

```js
// world units: ground columns 3.0 apart (1.5 base x TSCALE 2), hy 1.25, axis centre y 1.25
const gcol = (x, z) => ({ position: { x, y: 1.25, z }, hy: 1.25, storey: 0 });
const row3 = () => [gcol(-3, 0), gcol(0, 0), gcol(3, 0)];

test('columnsToCrush_OnFace_OnlyThatColumn', () => {
  const cols = row3();
  assert.deepEqual(columnsToCrush({ x: 0, y: 1.2, z: 0.38 }, cols), [cols[1]]);
});
test('columnsToCrush_MidwayBetweenTwo_Both', () => {
  const cols = row3();
  const hit = columnsToCrush({ x: -1.5, y: 0.3, z: 0 }, cols);
  assert.equal(hit.length, 2);
  assert.ok(hit.includes(cols[0]) && hit.includes(cols[1]));
});
test('columnsToCrush_CentreOfFour_None', () => {
  const cols = [gcol(0, 0), gcol(3, 0), gcol(0, 3), gcol(3, 3)];
  assert.deepEqual(columnsToCrush({ x: 1.5, y: 0.3, z: 1.5 }, cols), []);
});
test('columnsToCrush_ChargeHighOnGroundColumn_NeverTheOneAbove', () => {
  // review on #97: the column above is within reach too; only the nearest column's storey goes
  const ground = { position: { x: 0, y: 1.25, z: 0 }, hy: 1.25, storey: 0 };
  const above = { position: { x: 0, y: 4.25, z: 0 }, hy: 1.25, storey: 1 };
  const p = { x: 0.38, y: 2.4, z: 0 };
  assert.ok(distToColumnAxis(p, above.position, above.hy) < DEMO.breakRadius);   // both are in reach
  assert.deepEqual(columnsToCrush(p, [above, ground]), [ground]);
});
test('columnsToCrush_NothingInReach_Empty', () => {
  assert.deepEqual(columnsToCrush({ x: 5, y: 1, z: 0 }, [gcol(0, 0)]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/demolition.test.mjs`
Expected: FAIL. `columnsToCrush` is not exported (SyntaxError on import).

- [ ] **Step 3: Implement**

In `targets/demolition.js`:

Header comment line 2: `// slim columns, six storeys; the ground floor stands on 3×3 columns (#99). No THREE, no DOM.`
Add after line 9: `// Ground floor: docs/superpowers/specs/2026-11-27-issue-99-demolition-ground-floor-design.md`

In `DEMO`:

```js
  grid: 2,              // columns per side, storeys 1 and up
  groundGrid: 3,        // columns per side on the ground floor (#99), same outer columns
  ...
  breakRadius: 1.8,     // world units: an explosion this close to a column's axis crushes it (#99:
                        // reaches both columns from midway between two ground columns, 3.0 apart)
```

`demolitionLayout()`:

```js
export function demolitionLayout() {
  const { storeys, grid, groundGrid, pitch, column, storeyHeight, slabThickness } = DEMO;
  const span = (grid - 1) * pitch;   // outer column centre to outer column centre, every storey
  const points = (n) => {
    const pts = [];
    for (let k = 0; k < n; k++) pts.push(n === 1 ? 0 : -span / 2 + k * span / (n - 1));
    return pts;
  };
  const half = slabHalf();
  const boxes = [];
  for (let storey = 0; storey < storeys; storey++) {
    const base = storey * storeyPitch();
    const pts = points(storey === 0 ? groundGrid : grid);
    for (const x of pts) {
      for (const z of pts) {
        boxes.push({ hx: column / 2, hy: storeyHeight / 2, hz: column / 2, x, y: base + storeyHeight / 2, z, ry: 0, part: 'column', storey });
      }
    }
    boxes.push({ hx: half, hy: slabThickness / 2, hz: half, x: 0, y: base + storeyHeight + slabThickness / 2, z: 0, ry: 0, part: 'slab', storey });
  }
  return boxes;
}
```

For grid 2 this gives -1.5, 1.5, and for groundGrid 3 it gives -1.5, 0, 1.5. The `deepEqual` tests on these sets need exact values, so check that `0` comes out as `0` and not `-0`. `-1.5 + 1 * 1.5` is `0`, which is fine.

Replace `columnToCrush` and its comment:

```js
// The columns an explosion at p crushes: every column on the storey of the nearest column in
// reach whose axis is within breakRadius, or []. Never a column on another storey, so a charge
// high on a ground column does not also take out the column standing on the slab above it
// (review on #97). columns: [{ position, hy, storey }] in world units; returns those objects.
export function columnsToCrush(p, columns) {
  let nearest = null, bestD = DEMO.breakRadius;
  for (const c of columns) {
    const d = distToColumnAxis(p, c.position, c.hy);
    if (d < bestD) { bestD = d; nearest = c; }
  }
  if (!nearest) return [];
  return columns.filter(c => c.storey === nearest.storey && distToColumnAxis(p, c.position, c.hy) < DEMO.breakRadius);
}
```

In `index.html`, change the import on line 408 from `columnToCrush` to `columnsToCrush`. Change `crushNear`:

```js
function crushNear(p) {
  const cols = barrels.filter((b) => b.demo?.part === 'column' && !b.crushed).map((b) => ({ b, position: b.body.position, hy: b.demo.hy, storey: b.demo.storey }));
  for (const hit of columnsToCrush(p, cols)) crushColumn(hit.b);
}
```

Also update the comment above `setupDemolition` (around line 1010): `an explosion next to a column crushes that column` → `an explosion crushes the columns in reach on one storey`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/demolition.test.mjs && node --test test/*.test.mjs`
Expected: all PASS. Also `grep -rn "columnToCrush" --include=*.js --include=*.html --include=*.mjs .` only finds `test/harness/demolition.html`, which Task 2 fixes.

- [ ] **Step 5: Commit**

```bash
git add targets/demolition.js index.html test/demolition.test.mjs
git commit -m "feat(targets): demolition tower ground floor on 3x3 columns, a blast crushes its storey's columns in reach (#99)"
```

---

### Task 2: Physics harness, README, screenshot

**Files:**
- Modify: `test/harness/demolition.html` (import, `explodeAt`, `blast`, new `checkFiveCharges` and `checkSixFaces`, `main`, header comment)
- Modify: `README.md:76` (harness line) and `README.md:94-95` (tower description)

**Interfaces:**
- Consumes: `columnsToCrush`, `DEMO.groundGrid` from Task 1.

- [ ] **Step 1: Update the harness**

Import `columnsToCrush` instead of `columnToCrush`. In `explodeAt`:

```js
  const cols = ctx.blocks.filter(b => b.part === 'column' && !b.crushed).map(b => ({ b, position: b.body.position, hy: b.hy * S, storey: b.storey }));
  for (const hit of columnsToCrush(p, cols)) crush(ctx, hit.b);
```

Split `blast` so the charge points can be given directly. Keep `blast(charge, fy, which)` as is for the existing rows (it now charges all 9 ground columns), but move its body after the charges into `settle(ctx)`, which returns the result object. Add:

```js
async function blastAt(charge, points) {
  const ctx = await fresh();
  for (const p of points) explodeAt(ctx, p, charge);
  step(ctx, 10);
  return settle(ctx);   // same result object as blast(): xz, yFrac, slabOut, upperOut, down, total
}

// world positions of the 3×3 ground columns: x, z offsets in {-3, 0, 3} (1.5 base × S)
const G = 1.5 * S;
async function checkFiveCharges() {
  // 4 charges on the ground midway between pairs, 1 on the +z face of the last column
  const y = 0.3;
  const pts = [
    { x: -G / 2, y, z: ZC - G },        // (-G,-G) + (0,-G)
    { x: G,      y, z: ZC - G / 2 },    // (G,-G)  + (G,0)
    { x: -G / 2, y, z: ZC },            // (-G,0)  + (0,0)
    { x: -G / 2, y, z: ZC + G },        // (-G,G)  + (0,G)
    { x: G, y: 1.2, z: ZC + G + DEMO.column / 2 * S + 0.08 },   // (G,G) alone
  ];
  const r = await blastAt(REMOTE, pts);
  const pass = r.yFrac < 0.3 && r.slabOut < 0.5 && r.down === r.total;
  row(pass, 'five-charge', `5 remote charges (4 between pairs): top slab at ${(100 * r.yFrac).toFixed(0)} % of its height (< 30 %), slabs outside footprint ${r.slabOut.toFixed(2)} (< 0.5), blocks down ${r.down}/${r.total}`);
}

async function checkSixFaces() {
  // 6 charges on 6 column faces leave the middle row (z = 0) standing
  const r = await blast(REMOTE, 0.5, (b) => b.z !== 0);
  row(r.yFrac < 0.3, 'six-faces', `6 charges on faces, 3 columns left: top slab at ${(100 * r.yFrac).toFixed(0)} % of its height`, false);
}
```

In `main`, call `checkFiveCharges()` after `checkPancake('cutting', …)` and `checkSixFaces()` after `checkOneCharge()`. `checkOneCharge` (`b.x < 0 && b.z > 0`) now picks exactly one column (x = -1.5, z = 1.5). Keep it, and change its detail text from `the other three columns hold it` to `the other eight columns hold it`. `checkFrontOnly` now charges the 3 front columns. Keep it, and change its text to `front three columns only`.

Update the header comment. It now says the ground floor is 3×3 (#99), all-column rows use 9 charges, the five-charge row checks the real 6-charge limit, and the `Measured …` block is from #86. Add a line with this run's numbers once Step 2 has passed.

- [ ] **Step 2: Run the harness headless**

```bash
python3 -m http.server 8765 >/dev/null 2>&1 &
SERVER=$!
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto('http://localhost:8765/test/harness/demolition.html')
    pg.wait_for_function("document.title.startsWith('DEMOLITION')", timeout=120000)
    print(pg.title()); print(pg.inner_text('#out'))
    b.close()
EOF
kill $SERVER
```

Expected: `DEMOLITION PASS`, with `stable`, the four pancake rows, `five-charge` and `one-charge` all PASS.

If `five-charge` fails because the slab tips instead of sinking, the charges go off at the same time but the crushes come one by one. Do **not** loosen the thresholds. Report the measured numbers in the PR and check whether `stable` and the pancake rows still pass. The spec's decision is that 5 charges must work.

If `stable` fails, the 9 ground columns overlap or float. Recheck the layout tests from Task 1.

- [ ] **Step 3: README**

Line 76:

```
`test/harness/demolition.html` checks the demolition tower: it stands still, charges on all ground-floor columns pancake it into its footprint (remote and cutting charge), five charges (four between pairs of columns) bring the 3×3 ground floor down, one charge does not (title `DEMOLITION PASS`/`FAIL`).
```

Lines 94-95: change `a six-storey demolition tower of concrete slabs on slim columns that` to `a six-storey demolition tower of concrete slabs on slim columns, nine of them on the ground floor, that`. Leave the rest of that sentence as it is. If the sentence names how many charges it takes, add that a charge between two columns takes both.

- [ ] **Step 4: Screenshot before and after**

This is a visible change. Put a screenshot of the Demolition Tower target from the default camera, before (`main`) and after (this branch), into the PR description. Open `index.html` over the same local server, click the `Demolition Tower` button (`[data-mode="demolition"]`), wait 2 s, and take a 1280×720 screenshot.

- [ ] **Step 5: Commit**

```bash
git add test/harness/demolition.html README.md
git commit -m "test(targets): demolition harness for the 3x3 ground floor and the five-charge demolition (#99)"
```
