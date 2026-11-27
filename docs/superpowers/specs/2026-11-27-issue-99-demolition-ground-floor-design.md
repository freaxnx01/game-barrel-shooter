# Demolition tower: ground floor on 3×3 columns (#99)

Builds on the demolition tower of #86
(`2026-11-26-issue-86-demolition-highrise-design.md`).

## Goal

The tower keeps its height and width. Only the ground floor changes: it stands on **three
rows of three columns** (9 columns) under the same first slab. Storeys 1–5 keep their 2×2
columns. A controlled demolition with one K / Boom press must still be possible within the
6-charge limit.

## Decisions (made with the user, 2026-11-27)

- **3×3 on the ground floor only.** Upper storeys stay 2×2. Slab size, storey height and
  total height do not change.
- **A blast crushes neighbouring columns on the same storey.** Today `columnToCrush`
  returns at most one column. It becomes `columnsToCrush`, which returns every column on the
  storey of the nearest column in reach. Columns on other storeys are never crushed, which
  keeps the fix from the #97 review.

## Layout

- New `DEMO.groundGrid: 3`. The outer ground columns stay where they are today
  (±`(grid-1)/2 × pitch` = ±1.5 base units). The ground pitch is
  `(grid-1) × pitch / (groundGrid-1)` = 1.5 base units, so the columns sit at
  x, z ∈ {-1.5, 0, 1.5}.
- Storey 0: 9 columns. Storeys 1–5: 4 columns each. One slab per storey, as before.
  That is 29 columns and 6 slabs, 35 blocks in all (today 30).
- `slabHalf()` stays as it is: it uses `grid` and `pitch`, and the outer ground columns
  are under the same slab edge.

## Crush rule

- `DEMO.breakRadius` goes from 1.0 to **1.8** world units.
- `columnsToCrush(p, columns)`, where columns are `[{ position, hy, storey }]`:
  1. Find the nearest column whose axis is within `breakRadius` of p. If none, return `[]`.
  2. Return every column **on that storey** whose axis is within `breakRadius` of p
     (the nearest one included).
- Ground columns are 3.0 world units apart (1.5 base × TSCALE 2):
  - A charge on a column's face (0.38 from its axis) reaches only that column; the next
    one is at least 2.6 away.
  - A charge on the ground halfway between two columns (1.5 from each) crushes both.
  - The centre of four columns (2.12 from each) crushes none of them.
- On storeys 1–5 the columns are 6.0 world units apart, so a blast there still crushes one
  column at most.
- So 5 charges bring the ground floor down: 4 between pairs and 1 on the last column.
  Placing 6 charges on 6 column faces leaves 3 standing.
- The rule that a landing slab crushes the columns on the storey above it does not change.

## Callers

- `index.html` `crushNear(p)`: passes `storey: b.demo.storey` with each column and
  crushes every column returned.
- `test/harness/demolition.html` `explodeAt`: does the same.

## Testing

- `test/demolition.test.mjs` (`node --test`):
  - Layout: 35 blocks, 9 ground and 20 upper columns, ground columns at pitch 1.5 on the
    3×3 grid, upper ones at pitch 3. No overlaps, every block supported, top still at
    `storeys × storeyPitch()`.
  - `columnsToCrush`:
    - On the face: one column.
    - Midway between two: both.
    - At the centre of four: none.
    - Nothing in reach: `[]`.
    - High on a ground column: only that column, never the one above (the #97 case with
      `storey` set).
- `test/harness/demolition.html`, checked headless; the title still goes to
  `DEMOLITION PASS`/`FAIL`:
  - Stable for 10 s with all bodies woken.
  - The remote and cutting runs that charge every ground column still pancake into the
    footprint. Their charges are 9 now, so these runs test the collapse, not the limit.
  - New required row **five-charge**: 4 charges midway between pairs plus 1 on the last
    column. This uses the real remote charge numbers, and the top slab must end up below
    30 % of its height inside the footprint.
  - **one-charge** still does not bring it down.
  - **six-faces** (6 charges on 6 column faces, 3 left standing): an info row only, not
    required.
- Visual check (look-only game change, see the screenshot gate): a screenshot of the tower
  before and after, attached to the PR.

## Docs

- `README.md`:
  - Update the demolition tower line: ground floor on 3×3 columns.
  - Update the harness line: five charges between columns, one charge does not.

## Out of scope

- The charge limit (stays 6).
- Upper-storey layout.
- Charge placement UI.
