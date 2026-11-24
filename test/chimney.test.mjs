import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, plinthPitch, shaftRadius, shaftWall, isSoot } from '../targets/chimney.js';
import { overlappingPairs, unsupported } from './layout-geometry.mjs';

const byPart = (part) => chimneyLayout().filter(b => b.part === part);
const radial = (b) => Math.hypot(b.x, b.z);

test('chimneyLayout_Has278Blocks', () => {
  assert.equal(chimneyLayout().length, 278);
});
test('chimneyLayout_PartCounts', () => {
  assert.equal(byPart('plinth').length, 18);
  assert.equal(byPart('shaft').length, 240);
  assert.equal(byPart('crown').length, 20);
});
test('chimneyLayout_NoOverlaps', () => {
  assert.deepEqual(overlappingPairs(chimneyLayout()), []);
});
test('chimneyLayout_EveryBlockSupported', () => {
  assert.deepEqual(unsupported(chimneyLayout()), []);
});
test('chimneyLayout_ShaftRadiusStrictlyDecreasing', () => {
  const shaft = byPart('shaft');
  for (let c = 1; c < CHIMNEY.shaftCourses; c++) {
    const mean = (k) => shaft.filter(b => b.course === k).reduce((s, b) => s + radial(b), 0) / CHIMNEY.segments;
    assert.ok(mean(c) < mean(c - 1) - 1e-6, `course ${c}`);
  }
});
test('chimneyLayout_ShaftWallThinsTowardTop', () => {
  const shaft = byPart('shaft');
  assert.ok(Math.abs(shaft.find(b => b.course === 0).hz - CHIMNEY.wallBottom) < 1e-9);
  assert.ok(Math.abs(shaft.find(b => b.course === CHIMNEY.shaftCourses - 1).hz - CHIMNEY.wallTop) < 1e-9);
});
test('chimneyLayout_RunningBond_OddCoursesHalfStep', () => {
  const shaft = byPart('shaft');
  const step = 2 * Math.PI / CHIMNEY.segments;
  const first = (k) => shaft.find(b => b.course === k).ry;
  assert.ok(Math.abs(first(0)) < 1e-9);
  assert.ok(Math.abs(first(1) - step / 2) < 1e-9);
});
test('chimneyLayout_CrownRestsOnShaft', () => {
  const top = byPart('shaft').filter(b => b.course === CHIMNEY.shaftCourses - 1);
  const crown0 = byPart('crown').filter(b => b.course === 0);
  const crown1 = byPart('crown').filter(b => b.course === 1);
  assert.ok(radial(crown0[0]) > radial(top[0]));
  assert.ok(radial(crown1[0]) > radial(crown0[0]));
  // radial extents overlap: inner face of the course above lies inside the outer face below
  assert.ok(radial(crown0[0]) - crown0[0].hz < radial(top[0]) + top[0].hz);
  assert.ok(radial(crown1[0]) - crown1[0].hz < radial(crown0[0]) + crown0[0].hz);
});
test('chimneyLayout_FirstRingInsidePlinth', () => {
  const halfWidth = 1.5 * CHIMNEY.plinthBlock + 0.001;
  for (const b of byPart('shaft').filter(b => b.course === 0)) {
    const c = Math.cos(b.ry), s = Math.sin(b.ry);
    for (const [lx, lz] of [[b.hx, b.hz], [b.hx, -b.hz], [-b.hx, b.hz], [-b.hx, -b.hz]]) {
      const wx = b.x + lx * c + lz * s, wz = b.z - lx * s + lz * c;
      assert.ok(Math.abs(wx) <= halfWidth && Math.abs(wz) <= halfWidth, `corner (${wx.toFixed(3)}, ${wz.toFixed(3)})`);
    }
  }
});
test('chimneyLayout_TopOfCrownHeight', () => {
  const top = Math.max(...chimneyLayout().map(b => b.y + b.hy));
  const expected = CHIMNEY.plinthCourses * plinthPitch() + (CHIMNEY.shaftCourses + CHIMNEY.crownCourses - 1) * coursePitch() + CHIMNEY.courseHeight;
  assert.ok(Math.abs(top - expected) < 1e-9);
  assert.ok(Math.abs(top - 10.0) < 0.01);
});
test('shaftRadiusAndWall_Endpoints', () => {
  assert.equal(shaftRadius(0), CHIMNEY.radiusBottom);
  assert.equal(shaftRadius(CHIMNEY.shaftCourses - 1), CHIMNEY.radiusTop);
  assert.equal(shaftWall(0), CHIMNEY.wallBottom);
  assert.equal(shaftWall(CHIMNEY.shaftCourses - 1), CHIMNEY.wallTop);
});
test('isSoot_TopThreeShaftCoursesAndCrown', () => {
  assert.equal(isSoot({ part: 'shaft', course: CHIMNEY.shaftCourses - 3 }), true);
  assert.equal(isSoot({ part: 'shaft', course: CHIMNEY.shaftCourses - 4 }), false);
  assert.equal(isSoot({ part: 'crown', course: 0 }), true);
  assert.equal(isSoot({ part: 'plinth', course: 1 }), false);
});
test('chimneyLayout_RingBricksHavePositiveLength', () => {
  for (const b of chimneyLayout()) assert.ok(b.hx > 0.1, `${b.part} ${b.course}`);
});
