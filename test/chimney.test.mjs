import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMNEY, chimneyLayout, coursePitch, shaftRadius, shaftWall, isSoot, brickFaceRects, visibleBrickAspect, wedgeProfile, wedgeFaces } from '../targets/chimney.js';
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
    assert.ok(a >= 3.0 && a <= 6.5, `course ${b.course}: aspect ${a}`);   // long bricks, kept on purpose after #71
  }
});
test('visibleBrickAspect_FootLongerThanTop', () => {
  const boxes = chimneyLayout();
  const foot = visibleBrickAspect(boxes.find(b => b.course === 0));
  const top = visibleBrickAspect(boxes.find(b => b.course === CHIMNEY.shaftCourses - 1));
  assert.ok(foot > top);
  assert.ok(Math.abs(foot - 6.102) < 0.01, `foot ${foot}`);
  assert.ok(Math.abs(top - 3.537) < 0.01, `top ${top}`);
});
test('wedgeProfile_InnerWidthDepthHeightUnchanged', () => {
  for (const b of chimneyLayout()) {
    const w = wedgeProfile(b);
    assert.equal(w.innerHx, b.hx);
    assert.equal(w.hy, b.hy);
    assert.equal(w.hz, b.hz);
  }
});
test('wedgeProfile_OuterWidthMatchesOuterCircumference', () => {
  const t = Math.tan(Math.PI / CHIMNEY.segments);
  for (const c of [0, 20, 42]) {
    const b = shaft().find(x => x.course === c);
    const w = wedgeProfile(b);
    const expected = (shaftRadius(c) + shaftWall(c)) * t - CHIMNEY.clearance;
    assert.ok(Math.abs(w.outerHx - expected) < 1e-9, `course ${c}`);
    assert.ok(w.taper > 1);
    assert.ok(Math.abs(w.taper - w.outerHx / w.innerHx) < 1e-12);
  }
});
test('wedgeProfile_NeighbourOuterCornersMeet', () => {
  // world position of a block's outer corner: centre + yaw-rotated (lx, lz)
  const corner = (b, sx) => {
    const w = wedgeProfile(b);
    const lx = sx * w.outerHx, lz = b.hz;
    return [b.x + lx * Math.cos(b.ry) + lz * Math.sin(b.ry), b.z - lx * Math.sin(b.ry) + lz * Math.cos(b.ry)];
  };
  for (const c of [0, 1, 42]) {
    const ring = shaft().filter(b => b.course === c);
    for (let j = 0; j < ring.length; j++) {
      const a = corner(ring[j], +1);
      const n = corner(ring[(j + 1) % ring.length], -1);
      assert.ok(Math.hypot(a[0] - n[0], a[1] - n[1]) < 0.01, `course ${c} block ${j}`);
    }
  }
});
test('wedgeFaces_ShapeAndOuterFace', () => {
  const taper = 1.6;
  const f = wedgeFaces(taper);
  assert.equal(f.positions.length, 36 * 3);
  assert.equal(f.normals.length, 36 * 3);
  assert.equal(f.uvs.length, 36 * 2);
  const xs = [];
  for (let i = 0; i < 36; i++) {
    if (f.normals[i * 3 + 2] === 1) xs.push(Math.abs(f.positions[i * 3]));
    assert.ok(Math.abs(f.positions[i * 3 + 1]) <= 0.5 + 1e-12);
    assert.ok(Math.abs(f.positions[i * 3 + 2]) <= 0.5 + 1e-12);
  }
  assert.equal(xs.length, 6);                       // outer face is two triangles
  assert.ok(Math.abs(Math.max(...xs) - 0.5 * taper) < 1e-12);
  // inner face (z = -0.5) is exactly the unit box width
  const inner = [];
  for (let i = 0; i < 36; i++) if (f.normals[i * 3 + 2] === -1) inner.push(Math.abs(f.positions[i * 3]));
  assert.equal(inner.length, 6);
  assert.equal(Math.max(...inner), 0.5);
});
test('wedgeFaces_NormalsMatchWindingAndPointOutwards', () => {
  const f = wedgeFaces(1.6);
  const p = (i) => [f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]];
  for (let t = 0; t < 12; t++) {
    const [a, b, c] = [p(t * 3), p(t * 3 + 1), p(t * 3 + 2)];
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const n = [0, 1, 2].map(k => f.normals[t * 9 + k]);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-9, `unit normal tri ${t}`);
    const dot = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2];
    assert.ok(dot > 0, `winding tri ${t}`);
    const centroid = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3);
    assert.ok(centroid[0] * n[0] + centroid[1] * n[1] + (centroid[2]) * n[2] > 0, `outward tri ${t}`);
  }
});
