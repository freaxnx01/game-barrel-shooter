import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot, brickFaceRects, visibleBrickAspect, chimneyCore } from '../targets/chimney.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const shaft = () => chimneyLayout().filter(b => b.part === 'shaft');
const radial = (b) => Math.hypot(b.x, b.z);

test('chimneyLayout_Has516Blocks', () => {
  assert.equal(chimneyLayout().length, 516);
  assert.equal(CHIMNEY.segments * CHIMNEY.shaftCourses, 516);
});
test('chimneyLayout_OnlyShaftPart', () => {
  assert.equal(shaft().length, chimneyLayout().length);
  assert.equal(CHIMNEY.plinthCourses, undefined);
  assert.equal(CHIMNEY.crownCourses, undefined);
});
test('chimneyLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(chimneyLayout()), []);
});
test('chimneyLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(chimneyLayout()), []);
});
test('chimneyLayout_Course0OnGround', () => {
  for (const b of shaft().filter(b => b.course === 0)) assert.ok(Math.abs(b.y - b.hy) < 1e-9);
});
test('chimneyLayout_ShaftRadiusStrictlyDecreasing', () => {
  for (let c = 1; c < CHIMNEY.shaftCourses; c++) {
    const mean = (k) => shaft().filter(b => b.course === k).reduce((s, b) => s + radial(b), 0) / CHIMNEY.segments;
    assert.ok(mean(c) < mean(c - 1) - 1e-6, `course ${c}`);
  }
});
test('chimneyLayout_ShaftWallThinsTowardTop', () => {
  assert.ok(Math.abs(shaft().find(b => b.course === 0).hz - CHIMNEY.wallBottom) < 1e-9);
  assert.ok(Math.abs(shaft().find(b => b.course === CHIMNEY.shaftCourses - 1).hz - CHIMNEY.wallTop) < 1e-9);
});
test('chimneyLayout_RunningBond_OddCoursesHalfStep', () => {
  const step = 2 * Math.PI / CHIMNEY.segments;
  const first = (k) => shaft().find(b => b.course === k).ry;
  assert.ok(Math.abs(first(0)) < 1e-9);
  assert.ok(Math.abs(first(1) - step / 2) < 1e-9);
});
test('chimneyLayout_TopHeightIsAbout15', () => {
  const top = Math.max(...chimneyLayout().map(b => b.y + b.hy));
  assert.ok(Math.abs(top - CHIMNEY.shaftCourses * coursePitch()) < 1e-9);
  assert.ok(Math.abs(top - 15.0) < 0.06);
});
test('shaftRadiusAndWall_Endpoints', () => {
  assert.equal(shaftRadius(0), CHIMNEY.radiusBottom);
  assert.equal(shaftRadius(CHIMNEY.shaftCourses - 1), CHIMNEY.radiusTop);
  assert.ok(Math.abs(CHIMNEY.radiusBottom - 1.3 * 1.25) < 1e-9);
  assert.ok(Math.abs(CHIMNEY.radiusTop - 0.75 * 1.25) < 1e-9);
  assert.equal(shaftWall(0), CHIMNEY.wallBottom);
  assert.equal(shaftWall(CHIMNEY.shaftCourses - 1), CHIMNEY.wallTop);
});
test('isSoot_TopFiveShaftCourses', () => {
  const n = CHIMNEY.shaftCourses;
  assert.equal(isSoot({ part: 'shaft', course: n - 5 }), true);
  assert.equal(isSoot({ part: 'shaft', course: n - 6 }), false);
  assert.equal(isSoot({ part: 'shaft', course: 0 }), false);
});
test('chimneyLayout_BrickLengthStaysCloseToBefore', () => {
  const bottom = shaft().find(b => b.course === 0);
  assert.ok(bottom.hx * 2 < 0.646 * 1.15, `bottom brick length ${bottom.hx * 2}`);
  for (const b of chimneyLayout()) assert.ok(b.hx > 0.15, `course ${b.course}`);
});
test('chimneyFaceRows_IsTwo', () => {
  assert.equal(CHIMNEY.faceRows, 2);
});
test('brickFaceRects_TwoRows_EqualHeightsAndJoints', () => {
  const rects = brickFaceRects(256, 128, 2, 8);
  assert.equal(rects.length, 2);
  assert.deepEqual(rects[0], { x: 4, y: 4, w: 248, h: 56 });
  assert.deepEqual(rects[1], { x: 4, y: 68, w: 248, h: 56 });
});
test('brickFaceRects_AnyRows_FrameHalfJointGapFullJoint', () => {
  for (const rows of [1, 2, 3]) {
    const rects = brickFaceRects(256, 128, rows, 8);
    assert.equal(rects.length, rows);
    assert.equal(rects[0].y, 4);
    const last = rects[rows - 1];
    assert.ok(Math.abs(128 - (last.y + last.h) - 4) < 1e-9, `bottom frame rows=${rows}`);
    for (let i = 1; i < rows; i++) {
      assert.ok(Math.abs(rects[i].y - (rects[i - 1].y + rects[i - 1].h) - 8) < 1e-9, `gap ${i}`);
      assert.ok(Math.abs(rects[i].h - rects[0].h) < 1e-9);
    }
    for (const r of rects) {
      assert.equal(r.x, 4);
      assert.equal(r.w, 248);
    }
  }
});
test('visibleBrickAspect_EveryBody_Elongated', () => {
  for (const b of chimneyLayout()) {
    const a = visibleBrickAspect(b);
    assert.ok(a >= 2.0 && a <= 4.0, `course ${b.course}: aspect ${a}`);
  }
});
test('visibleBrickAspect_FootLongerThanTop', () => {
  const boxes = chimneyLayout();
  const foot = visibleBrickAspect(boxes.find(b => b.course === 0));
  const top = visibleBrickAspect(boxes.find(b => b.course === CHIMNEY.shaftCourses - 1));
  assert.ok(foot > top);
  assert.ok(Math.abs(foot - 3.805) < 0.01, `foot ${foot}`);
  assert.ok(Math.abs(top - 2.159) < 0.01, `top ${top}`);
});

test('chimneyCore_TwoTubes_BrickThenSoot', () => {
  const core = chimneyCore();
  assert.deepEqual(core.map(t => t.part), ['brick', 'soot']);
});
test('chimneyCore_TubesCoverGroundToTopCourse', () => {
  const [brick, soot] = chimneyCore();
  const top = CHIMNEY.shaftCourses * coursePitch();
  assert.equal(brick.y0, 0);
  assert.ok(Math.abs(brick.y0 + brick.height - soot.y0) < 1e-9);
  assert.ok(Math.abs(soot.y0 + soot.height - top) < 1e-9);
});
test('chimneyCore_SootTubeStartsAtSootCourses', () => {
  const soot = chimneyCore()[1];
  assert.ok(Math.abs(soot.y0 - (CHIMNEY.shaftCourses - CHIMNEY.sootCourses) * coursePitch()) < 1e-9);
});
test('chimneyCore_RadiusIsMidWallAndContinuous', () => {
  const [brick, soot] = chimneyCore();
  assert.ok(Math.abs(brick.radiusTop - soot.radiusBottom) < 1e-9);
  assert.ok(brick.radiusBottom > brick.radiusTop && soot.radiusBottom > soot.radiusTop);
  // at a course centre the tube radius equals the shaft radius of that course
  const c = 10;
  const y = c * coursePitch() + CHIMNEY.courseHeight / 2;
  const r = brick.radiusBottom + (brick.radiusTop - brick.radiusBottom) * (y - brick.y0) / brick.height;
  assert.ok(Math.abs(r - shaftRadius(c)) < 1e-9, `r ${r}`);
});
test('chimneyCore_StaysInsideBlocks_NeverOutsideOuterFace', () => {
  const [brick, soot] = chimneyCore();
  for (const t of [brick, soot]) {
    assert.ok(t.radiusBottom < shaftRadius(0) + shaftWall(0));
    assert.ok(t.radiusTop > 0.5);
  }
});
