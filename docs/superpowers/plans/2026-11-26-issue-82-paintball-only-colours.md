# Paintball only colours (#82) Implementation Plan

**Goal:** The paintball colours the struck piece, puts almost no force on it, and leaves no splash.

**Files:** `weapons/paintball.js`, `test/paintball.test.mjs`, `index.html`, `README.md`, `CHANGELOG.md`.
Other issues (#78, #79, #81) may have landed first and touched other parts of `index.html` and
`weapons/paintball.js`; work by function and constant names, not line numbers.

### Task 1: Paintball mass constant

- [ ] **Step 1: Failing test.** Append to `test/paintball.test.mjs` and add `PAINTBALL` to its import from `../weapons/paintball.js`:

```js
test('PAINTBALL_MaxMomentum_UnderHalfNewtonSecond', () => {
  // top launch speed is 18 + 22 = 40 m/s; a stone block must not be knocked over (#82)
  assert.ok(PAINTBALL.mass * 40 <= 0.5, `momentum ${PAINTBALL.mass * 40}`);
  assert.ok(PAINTBALL.mass > 0);
});
```

Run `node --test test/paintball.test.mjs`. Expected: FAIL (`PAINTBALL` is not exported).

- [ ] **Step 2: Implement.** In `weapons/paintball.js`, after `RANDOM_PAINT`:

```js
// Nearly massless: a paintball only colours what it hits and must not knock stone over (#82).
export const PAINTBALL = { mass: 0.01, radius: 0.15 };
```

Run `node --test test/*.test.mjs`. Expected: all pass.

- [ ] **Step 3: Commit and push.** `git commit -m "feat(weapons): paintball mass constant, nearly massless (#82)"`

### Task 2: Use the mass, drop the splash

- [ ] **Step 1:** In `index.html`, add `PAINTBALL` to the import from `./weapons/paintball.js`, and in `shootBall`'s `cfg` table replace `paintball:   { mass: 0.5, r: 0.15 },` with `paintball:   { mass: PAINTBALL.mass, r: PAINTBALL.radius },`.
- [ ] **Step 2:** In `paintSplat(rec, other)`, delete the splat block, from the comment `// splat blob at the impact spot` through `paintSplats.push(splat);`. Keep the recolouring of `tgt`, the deferred removal of the ball and `playBounce(6)`.
- [ ] **Step 3:** Delete the now-unused `const paintSplatMatls = …`, `const splatGeo = …` and `const paintSplats = [];` declarations, and in the target reset the two lines `for (const s of paintSplats) scene.remove(s);` and `paintSplats.length = 0;`. Then `grep -n "paintSplats\|splatGeo\|paintSplatMatls" index.html` must print nothing. If `PAINT_COLORS[].splat` is still used elsewhere, keep the palette field; it is part of the tested palette.
- [ ] **Step 4:** `node --test test/*.test.mjs` passes.
- [ ] **Step 5: Commit and push.** `git commit -m "fix(weapons): paintball only colours the piece it hits, no splash (#82)"`

### Task 3: Docs

- [ ] **Step 1:** `README.md`, Explosives line: replace `paintball (splats; pick a colour or 🎲 random)` with `paintball (colours the piece it hits without moving it; pick a colour or 🎲 random)`.
- [ ] **Step 2:** `CHANGELOG.md` under `## [Unreleased]`, replace the line
  `- Paintball colours: pick one of seven colours or 🎲 random, where every shot has a different colour; P cycles them (#54)`
  with
  `- Paintball colours: pick one of seven colours or 🎲 random, where every shot has a different colour; P cycles them. A paintball only colours the piece it hits: almost no force, so stone stays standing, and no splash blob (#54, #82)`
- [ ] **Step 3: Commit and push.** `git commit -m "docs: paintball only colours (#82)"`

Optional visual check (skip if short on time): on the Fortress target, fire 10 paintballs at a wall; no block falls, hit blocks change colour, no blobs remain.
