import test from 'node:test';
import assert from 'node:assert/strict';
import { NET, netLaunch, selectCaught, centroid, pullForce, isReeledIn, strandOffsets, openScale } from '../weapons/net.js';

const piece = (x, mass = 8) => ({ position: { x, y: 0, z: 0 }, mass });
const origin = { x: 0, y: 0, z: 0 };

test('netLaunch_PowerRange_Speed12To24', () => {
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 12);
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 24);
  assert.equal(netLaunch({ x: 0, y: 0, z: -1 }, 7).speed, 24);
});

test('netLaunch_FlatAim_LiftedUnitDirection', () => {
  const { direction: d } = netLaunch({ x: 0, y: 0, z: -1 }, 0.5);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  assert.ok(Math.abs(d.y - 0.3 / Math.hypot(0.3, 1)) < 1e-9);
});

test('selectCaught_InAndOutOfRadius_OnlyNearOnes', () => {
  const near = piece(1), far = piece(3);
  assert.deepEqual(selectCaught([far, near], origin), [near]);
});

test('selectCaught_StaticPiece_Ignored', () => {
  assert.deepEqual(selectCaught([piece(0.5, 0)], origin), []);
});

test('selectCaught_NoPieces_Empty', () => {
  assert.deepEqual(selectCaught([], origin), []);
});

test('NET_Catch_RadiusAndCapGrowWithTheOpenNet', () => {
  assert.equal(NET.captureRadius, 2.4);
  assert.equal(NET.maxCatch, 14);
  assert.ok(NET.captureRadius > NET.openSize / 2);          // covers at least the inscribed circle
  assert.ok(NET.captureRadius < NET.openSize / Math.SQRT2); // but not the full diagonal
});

test('selectCaught_MoreThanMax_NearestFourteenInOrder', () => {
  const pieces = Array.from({ length: 20 }, (_, i) => piece((20 - i) * 0.1));   // 2.0 m … 0.1 m, farthest first
  const caught = selectCaught(pieces, origin);
  assert.equal(caught.length, NET.maxCatch);
  assert.deepEqual(caught.map((p) => Math.round(p.position.x * 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
});

test('centroid_TwoPoints_Midpoint', () => {
  assert.deepEqual(centroid([{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }]), { x: 1, y: 2, z: 3 });
});

test('centroid_Empty_Null', () => {
  assert.equal(centroid([]), null);
});

test('pullForce_TowardLauncher_ScaledByMassPlusGravity', () => {
  const f = pullForce({ x: 0, y: 0, z: 10 }, origin, 2);
  assert.equal(f.x, 0);
  assert.ok(Math.abs(f.y - 9.82 * 2) < 1e-9);
  assert.ok(Math.abs(f.z - 160 * 2) < 1e-9);
});

test('pullForce_SamePoint_NoNaN', () => {
  const f = pullForce(origin, origin, 2);
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z));
  assert.ok(Math.abs(f.y - 9.82 * 2) < 1e-9);
});

test('isReeledIn_InsideAndAtReleaseDistance_TrueThenFalse', () => {
  assert.equal(isReeledIn(origin, { x: 0, y: 0, z: 3.9 }), true);
  assert.equal(isReeledIn(origin, { x: 0, y: 0, z: 4 }), false);
});

test('strandOffsets_FourMetreNet_NineStrandsHalfAMetreApart', () => {
  assert.deepEqual(strandOffsets(), [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]);
});

test('openScale_StartAndEnd_BundleThenFull', () => {
  assert.equal(openScale(0), NET.bundleScale);
  assert.equal(openScale(-10), NET.bundleScale);
  assert.equal(openScale(NET.openMs), 1);
  assert.equal(openScale(5000), 1);
});

test('openScale_Midway_MonotonicAndEasedOut', () => {
  const a = openScale(100), b = openScale(200), c = openScale(300);
  assert.ok(NET.bundleScale < a && a < b && b < c && c < 1);
  assert.ok(openScale(NET.openMs / 2) > (NET.bundleScale + 1) / 2);   // ease-out: past half size at half time
});

