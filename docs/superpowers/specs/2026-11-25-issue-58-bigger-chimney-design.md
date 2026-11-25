# Bigger brick chimney without crown and base (#58)

## Intent

Playtest feedback on the brick chimney (#55, PR #56): make it bigger and plainer. The
shaft gets 1.25× wider and 1.5× higher, the corbelled crown and the stone plinth go away,
and the bare shaft stands directly on the ground. Bricks keep their size, so the chimney
gets taller by adding courses and wider by adding bricks per ring, not by scaling bricks.
Collapse behaviour stays the same idea as in #55: a hit at the foot tips the shaft over
and it breaks apart; a light ball only knocks a few bricks; an untouched chimney stands still.

## Goals

- `targets/chimney.js`: shaft only (no `plinth`, no `crown` parts); radius 1.625 → 0.9375;
  43 courses of the unchanged 0.35 height, total height 15.05 base units (30.1 m in game).
- 12 bricks per ring, so brick length stays close to #55 (0.71 m at the foot, 0.40 m at the top,
  was 0.65 / 0.37).
- Soot tint stays on the top shaft courses (5 courses, see below).
- Harness, camera and unit tests follow the new shape; harness still reports `CHIMNEY PASS`.
- The #55 spec no longer contradicts the code.

## Non-goals

- No change to `physics/materials.js`, damping, sleep values, `addBlock`, any other target, weapon or camera code.
- No taller bricks, no new bricks types, no new textures; the picker entry stays `Chimney`.
- No performance work beyond keeping the brick count stated below.

## Anti-goals (a failure even if it technically works)

- The untouched chimney creeps or sheds bricks (43 stacked courses at `ROW_GAP` 0 is the risk).
- A light ball flattens it, or two cannonballs at the foot cannot topple it.
- A brick at course 0 floats above the ground, or the crown/plinth leaves dead code or stale docs.

## Shape (decided, builder must follow)

Base units; `addBlock` multiplies by `TSCALE` 2.

| Constant | #55 | #58 | Note |
|---|---|---|---|
| `segments` | 10 | **12** | keeps brick length within ~10 % of #55 (13 would match best; 12 is even and cheaper) |
| `shaftCourses` | 24 | **43** | 43 × 0.35 = 15.05, nearest whole course count to 15.0 |
| `courseHeight` | 0.35 | 0.35 | unchanged, pitch exactly `courseHeight` (`ROW_GAP` 0) |
| `radiusBottom` / `radiusTop` | 1.3 / 0.75 | **1.625 / 0.9375** | exactly ×1.25 |
| `wallBottom` / `wallTop` | 0.30 / 0.18 | 0.30 / 0.18 | unchanged: bricks keep their size |
| `sootCourses` | 3 (+2 crown) | **5** | the visible soot band stays about as tall as before |
| `clearance` | 0.002 | 0.002 | |
| plinth, crown constants | present | **removed** | `plinthCourses`, `plinthBlock`, `plinthHeight`, `crownCourses`, `crownStep`, `crownWalls` |

Ring brick formula is unchanged (`hx = (R − hz)·tan(π/segments) − clearance`).
Shaft course 0 starts at y = 0, so its bricks stand on the ground (the support check accepts a
bottom face within 0.0015 of y = 0). Taper per course is 0.0164 in radius, far below the wall
depth, so each brick overlaps the ring below.

Body count: 43 × 12 = **516** bricks (was 278; Brick Box, the largest other target, has 288).
Exports after the change: `CHIMNEY`, `chimneyLayout`, `coursePitch`, `shaftRadius`, `shaftWall`,
`isSoot`. `plinthPitch` is removed. Box `part` is always `'shaft'`.

## Look

- Materials: the brick and soot materials stay; the plinth branch in `chimneyMatl` goes, so `stoneMatls` is no longer used by the chimney.
- Camera: `camCfg.chimney = { r: 45, ty: 7.5, tz: -6, plat: false, build: setupChimney }`
  (distance and look-at height scaled ×1.5 with the height; `ty` is half the new height in base units).
  The builder checks 1280×720 and 390×844 screenshots: the whole chimney from ground to top in view
  with some sky above and the foot visible; adjust `r`/`ty` if not. Fog is 45–140 and the far plane
  200, so a distance of 45 × 1.5 = 67.5 stays inside it.

## Collapse and harness (decided)

`test/harness/chimney.html` keeps its three checks, adapted:

- The "crown" becomes the **top bricks**: shaft courses `>= shaftCourses − sootCourses` (the soot band). Mean y of the top bricks replaces the crown mean y.
- `shaftCourseY(c) = (c · coursePitch() + courseHeight / 2) · S` (no plinth offset).
- Stable: unchanged, max displacement after 5 s with every brick woken < 0.02.
- Base hit: two cannonballs (mass 9, r 0.29, 40 m/s, 1 s apart) at shaft course 1 (y 1.05 world); top mean y falls below 50 % of home within 12 s. Ball parameters stay.
- Light hit: mass 0.6, r 0.33, 25 m/s at mid-shaft course 21; top mean y stays above 80 % of home and fewer than 10 % of the bricks (`Math.round(0.1 × brickCount)` = 52) move more than 0.45 (the same 10 % rule as #55's 28 of 278).
- Tip-over signature stays INFO; its "toppled sideways" threshold goes from 2.0 to 2.5 (wider shaft).

### Tuning if a check fails (geometry only, in this order)

1. `wallBottom`/`wallTop`: thicker (e.g. 0.375 / 0.225) for stability or a failing light hit, thinner for an easier collapse. Re-run the unit tests after each change.
2. `segments`: 12 → 10 (430 bricks, longer bricks, the issue's own count) or 13 (559 bricks).
3. `shaftCourses` 41–45 (total 14.35–15.75). Only with the change recorded in the PR and tests/spec updated; anything outside that range: stop and report.

`physics/materials.js`, damping, sleep values and the `ROW_GAP` of 0 stay as they are. Record the
final values and measured numbers in the harness header comment and in the PR.

## Verification

- `node --test test/*.test.mjs` green: 516 blocks, all `shaft`, no overlaps, every block supported (course 0 on the ground), radius strictly decreasing, 1.625 / 0.9375 endpoints, running bond, top at 15.05 (±0.06 of 15.0), no `plinth`/`crown` part.
- `test/harness/chimney.html` shows `CHIMNEY PASS`; the other harnesses still pass.
- Screenshots 1280×720 and 390×844 of the standing chimney and one mid-collapse, viewed with the Read tool; the target feels responsive (no visible frame-rate drop with 516 bricks in the headless run, noted informally).
- README (Targets paragraph) and CHANGELOG (`[Unreleased]`) no longer mention plinth or crown for the chimney; the #55 spec carries an update note and corrected passages.

## Left to the builder

Camera `r`/`ty` within the framing rule; tint hex values untouched; tuning inside the ranges above.
