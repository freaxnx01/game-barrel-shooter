import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GESTURE_RATE, touchPair, pairNudge } from '../camera/gestures.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('touchPair_TwoPoints_CentroidAndDistance', () => {
  const p = touchPair({ x: 0, y: 0 }, { x: 30, y: 40 });
  assert.deepEqual(p, { cx: 15, cy: 20, dist: 50 });
});
test('touchPair_SamePoint_ZeroDistance', () => {
  assert.equal(touchPair({ x: 7, y: 9 }, { x: 7, y: 9 }).dist, 0);
});
test('pairNudge_NoChange_ZeroDeltas', () => {
  const p = touchPair({ x: 0, y: 0 }, { x: 100, y: 0 });
  const n = pairNudge(p, p);
  assert.equal(n.dTheta, 0); assert.equal(n.dPhi, 0); assert.equal(n.dRadius, 0);
});
test('pairNudge_DragRight_TurnsLikeRightDrag', () => {
  const n = pairNudge({ cx: 0, cy: 0, dist: 100 }, { cx: 20, cy: 0, dist: 100 });
  close(n.dTheta, -20 * GESTURE_RATE.theta);
  assert.equal(n.dPhi, 0);
  assert.equal(n.dRadius, 0);
});
test('pairNudge_DragDown_RaisesCamera', () => {
  const n = pairNudge({ cx: 0, cy: 0, dist: 100 }, { cx: 0, cy: 10, dist: 100 });
  close(n.dPhi, 10 * GESTURE_RATE.phi);
});
test('pairNudge_FingersSpread_ZoomsIn', () => {
  const n = pairNudge({ cx: 0, cy: 0, dist: 100 }, { cx: 0, cy: 0, dist: 150 });
  close(n.dRadius, -50 * GESTURE_RATE.zoom);
  assert.ok(n.dRadius < 0);
});
test('pairNudge_FingersPinch_ZoomsOut', () => {
  const n = pairNudge({ cx: 0, cy: 0, dist: 150 }, { cx: 0, cy: 0, dist: 100 });
  assert.ok(n.dRadius > 0);
});
test('GESTURE_RATE_DragMatchesRightDrag', () => {
  assert.equal(GESTURE_RATE.theta, 0.005);
  assert.equal(GESTURE_RATE.phi, 0.004);
});
