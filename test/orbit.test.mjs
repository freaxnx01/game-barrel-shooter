import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORBIT_LIMITS, CAM_SPEED, nudgeOrbit, heldNudge } from '../camera/orbit.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const orbit = () => ({ theta: 0, phi: 0.24, radius: 15.5 });

test('nudgeOrbit_InsideLimits_AddsDeltas', () => {
  const o = orbit();
  nudgeOrbit(o, 0.5, 0.1, -2);
  close(o.theta, 0.5); close(o.phi, 0.34); close(o.radius, 13.5);
});
test('nudgeOrbit_PhiPastLimits_Clamped', () => {
  const o = orbit();
  nudgeOrbit(o, 0, 5, 0);
  assert.equal(o.phi, ORBIT_LIMITS.phiMax);
  nudgeOrbit(o, 0, -5, 0);
  assert.equal(o.phi, ORBIT_LIMITS.phiMin);
});
test('nudgeOrbit_RadiusPastLimits_Clamped', () => {
  const o = orbit();
  nudgeOrbit(o, 0, 0, 100);
  assert.equal(o.radius, ORBIT_LIMITS.radiusMax);
  nudgeOrbit(o, 0, 0, -100);
  assert.equal(o.radius, ORBIT_LIMITS.radiusMin);
});
test('nudgeOrbit_Theta_NotClamped', () => {
  const o = orbit();
  nudgeOrbit(o, 10, 0, 0);
  assert.equal(o.theta, 10);
});
test('heldNudge_RightHeldOneSecond_TurnsAtThetaSpeed', () => {
  assert.deepEqual(heldNudge({ theta: 1, phi: 0, zoom: 0 }, 1), { dTheta: CAM_SPEED.theta, dPhi: 0, dRadius: 0 });
});
test('heldNudge_ZoomInHeld_ShrinksRadius', () => {
  const n = heldNudge({ theta: 0, phi: 0, zoom: 1 }, 0.5);
  assert.equal(n.dRadius, -CAM_SPEED.zoom * 0.5);
});
test('heldNudge_NothingHeld_Null', () => {
  assert.equal(heldNudge({ theta: 0, phi: 0, zoom: 0 }, 0.016), null);
});
