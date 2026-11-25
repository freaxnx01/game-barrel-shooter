import test from 'node:test';
import assert from 'node:assert/strict';
import { NET, netLaunch, selectCaught, centroid, spread, pullForce, isReeledIn } from '../weapons/net.js';

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
  const near = piece(1), far = piece(2);
  assert.deepEqual(selectCaught([far, near], origin), [near]);
});

test('selectCaught_StaticPiece_Ignored', () => {
  assert.deepEqual(selectCaught([piece(0.5, 0)], origin), []);
});

test('selectCaught_NoPieces_Empty', () => {
  assert.deepEqual(selectCaught([], origin), []);
});

test('selectCaught_MoreThanMax_NearestSixInOrder', () => {
  const pieces = [0.8, 0.3, 0.1, 0.7, 0.5, 0.2, 0.6, 0.4].map((x) => piece(x));
  const caught = selectCaught(pieces, origin);
  assert.equal(caught.length, NET.maxCatch);
  assert.deepEqual(caught.map((p) => p.position.x), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
});

test('centroid_TwoPoints_Midpoint', () => {
  assert.deepEqual(centroid([{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }]), { x: 1, y: 2, z: 3 });
});

test('centroid_Empty_Null', () => {
  assert.equal(centroid([]), null);
});

test('spread_TwoPoints_LargestDistanceFromCentre', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }];
  assert.ok(Math.abs(spread(pts, { x: 1, y: 2, z: 3 }) - Math.sqrt(14)) < 1e-9);
  assert.equal(spread([], origin), 0);
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