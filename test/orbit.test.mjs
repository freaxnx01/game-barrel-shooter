import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORBIT_LIMITS, CAM_SPEED, FIT_MARGIN, nudgeOrbit, heldNudge, fitOrbitRadius } from '../camera/orbit.js';

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
test('nudgeOrbit_FitRadiusAboveLimit_ZoomsOutUpToFitRadius', () => {
  const o = { ...orbit(), radius: 60, fitRadius: 60 };
  nudgeOrbit(o, 0, 0, 100);
  assert.equal(o.radius, 60);
  nudgeOrbit(o, 0, 0, -10);
  assert.equal(o.radius, 50);
});
test('nudgeOrbit_FitRadiusBelowLimit_KeepsRadiusMax', () => {
  const o = { ...orbit(), fitRadius: 12 };
  nudgeOrbit(o, 0, 0, 100);
  assert.equal(o.radius, ORBIT_LIMITS.radiusMax);
});

// Screen x (NDC) of the target's nearest outer corner, seen straight on from `radius`.
const edgeNdc = (radius, { halfWidth, nearDepth }, vFovDeg, aspect) =>
  halfWidth / ((radius - nearDepth) * Math.tan(vFovDeg * Math.PI / 360) * aspect);
const fortress = { halfWidth: 10, nearDepth: 9 };

test('fitOrbitRadius_TargetFitsAlready_KeepsBaseRadius', () => {
  assert.equal(fitOrbitRadius(34, fortress, 55, 1280 / 720), 34);
});
test('fitOrbitRadius_WideTargetInPortrait_RaisesRadiusUntilEdgeSitsAtMargin', () => {
  const r = fitOrbitRadius(34, fortress, 55, 390 / 844);
  assert.ok(r > 34);
  close(edgeNdc(r, fortress, 55, 390 / 844), 1 - FIT_MARGIN);
});
test('fitOrbitRadius_NarrowerScreen_LargerRadius', () => {
  assert.ok(fitOrbitRadius(0, fortress, 55, 0.4) > fitOrbitRadius(0, fortress, 55, 0.6));
});
test('fitOrbitRadius_TargetInFrontOfLookAtPoint_AddsNearDepth', () => {
  const flat = fitOrbitRadius(0, { halfWidth: 10, nearDepth: 0 }, 55, 0.5);
  close(fitOrbitRadius(0, { halfWidth: 10, nearDepth: 4 }, 55, 0.5), flat + 4);
});
