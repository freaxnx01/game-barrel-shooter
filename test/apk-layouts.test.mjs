import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, frameBuilding, brickBox, spiralStair, pierGate, massFor, APK_UNIT } from '../targets/apk-layouts.js';
import { boxesOverlap, overlappingPairs, unsupported } from './layout-geometry.mjs';

const box = (x, y, z, ry = 0) => ({ hx: 0.5, hy: 0.5, hz: 0.5, x, y, z, ry });

test('boxesOverlap_TouchingFaces_False', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1, 0.5, 0)), false);
});
test('boxesOverlap_RotatedCornerIntoNeighbour_True', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1.1, 0.5, 0, Math.PI / 4)), true);
});

const EXACT = { frameTower: 126, frameBlock: 120, frameHigh: 240, frameHall: 260,
  brickBox: 288, brickTower: 196, spiral: 71, spiralTower: 95 };
for (const [name, n] of Object.entries(EXACT)) {
  test(`${name}_Layout_HasPrefabBlockCount`, () => assert.equal(LAYOUTS[name]().length, n));
  test(`${name}_Layout_NoOverlaps`, () => assert.deepEqual(overlappingPairs(LAYOUTS[name]()), []));
  test(`${name}_Layout_EveryBlockRests`, () => assert.deepEqual(unsupported(LAYOUTS[name]()), []));
}
test('frameBuilding_Grid4_PostsAre1x5x1AtPitch5', () => {
  const posts = frameBuilding(4, 1).filter(b => b.hy > b.hx);
  assert.equal(posts.length, 16);
  assert.ok(posts.every(p => Math.abs(p.hy - 2.5 * APK_UNIT) < 1e-9 && Math.abs(p.hx - 0.5 * APK_UNIT) < 1e-9));
  const xs = [...new Set(posts.map(p => +(p.x / APK_UNIT).toFixed(3)))].sort((a, b) => a - b);
  assert.deepEqual(xs, [-7.5, -2.5, 2.5, 7.5]);
});
test('massFor_UnitCube_Is170TimesVolume', () => {
  assert.equal(massFor({ hx: 0.5, hy: 0.5, hz: 0.5 }), 170);
});

test('brickBox_Course0And1_SwapCornerOwnership', () => {
  const b = brickBox(4.5, 5, 2);
  const c0 = b.filter(x => x.y < 0.5 * APK_UNIT + 1e-6), c1 = b.filter(x => x.y > 0.5 * APK_UNIT + 1e-6);
  const owners = c => c.filter(x => Math.abs(Math.abs(x.x) - 4.5 * APK_UNIT) < 1e-6).length;
  assert.equal(owners(c0), 10);  // x-walls own corners in course 0
  assert.equal(owners(c1), 8);   // and not in course 1
});

test('spiralStair_36Treads_Has35PostsOf25FullHeight', () => {
  const thin = v => Math.abs(v - 0.5 * APK_UNIT) < 1e-9;
  const posts = spiralStair(36).filter(b => thin(b.hx) && thin(b.hz));
  assert.equal(posts.length, 35);   // one under every tread i >= 1
  assert.equal(posts.filter(p => Math.abs(p.hy * 2 - 11 * APK_UNIT) < 1e-6).length, 25); // i = 11..35
});
test('spiralStair_Tread0_BottomOnGround', () => {
  const t0 = spiralStair(36).reduce((a, b) => (b.y < a.y ? b : a));
  assert.ok(Math.abs(t0.y - t0.hy) < 1e-6);
});

const APPROX = { archGate: 311, doubleGate: 515, castleGate: 352, castleGateSmall: 258 };
for (const [name, ref] of Object.entries(APPROX)) {
  test(`${name}_Layout_CountWithin15Percent`, () => {
    const n = LAYOUTS[name]().length;
    assert.ok(n >= ref * 0.85 && n <= ref * 1.15, `${n} vs ${ref}`);
  });
  test(`${name}_Layout_NoOverlaps`, () => assert.deepEqual(overlappingPairs(LAYOUTS[name]()), []));
  test(`${name}_Layout_EveryBlockRests`, () => assert.deepEqual(unsupported(LAYOUTS[name]()), []));
}
test('pierGate_ThreePiers_HasTwoOpenings', () => {
  const g = pierGate(3), low = g.filter(b => b.y < 1.5 * APK_UNIT);
  const covered = x => low.some(b => Math.abs(b.x - x) < b.hx + b.hz);
  assert.equal(covered(0), true);  // centre pier
  const openings = [-1, 1].map(s => s * 6 * APK_UNIT).filter(x => !covered(x)); // piers at 0, ±12 u
  assert.equal(openings.length, 2);
});
test('castleGate_GateOpening_ClearAtGroundLevel', () => {
  const low = LAYOUTS.castleGate().filter(b => b.y < 1.5 * APK_UNIT);
  assert.ok(!low.some(b => Math.abs(b.x) < 2 * APK_UNIT && Math.abs(b.z) < 1.5 * APK_UNIT));
});
