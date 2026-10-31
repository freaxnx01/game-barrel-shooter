import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, frameBuilding, massFor, APK_UNIT } from '../targets/apk-layouts.js';
import { boxesOverlap, overlappingPairs, unsupported } from './layout-geometry.mjs';

const box = (x, y, z, ry = 0) => ({ hx: 0.5, hy: 0.5, hz: 0.5, x, y, z, ry });

test('boxesOverlap_TouchingFaces_False', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1, 0.5, 0)), false);
});
test('boxesOverlap_RotatedCornerIntoNeighbour_True', () => {
  assert.equal(boxesOverlap(box(0, 0.5, 0), box(1.1, 0.5, 0, Math.PI / 4)), true);
});

const EXACT = { frameTower: 126, frameBlock: 120, frameHigh: 240, frameHall: 260 };
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
