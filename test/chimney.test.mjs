import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot } from '../targets/chimney.js';
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
