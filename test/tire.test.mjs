import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIRE, tireLaunch, rollingStep, axleTilt, shouldTip, tipSpin } from '../weapons/tire.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const rotY = (q) => { // rotate (0,1,0) by q
  const { x, y, z, w } = q;
  return { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) };
};
const cam = { x: 0, y: 5, z: 10 }, fwd = { x: 0, y: 0, z: -1 };
const upright = tireLaunch(cam, fwd, fwd, 0).quaternion;

test('tireLaunch_FlatAim_SpawnsOnGroundAhead', () => {
  const { position } = tireLaunch(cam, fwd, fwd, 0);
  close(position.x, 0); close(position.y, TIRE.radius + 0.01); close(position.z, 7.5);
});
test('tireLaunch_Power0And1_Speed8And20Horizontal', () => {
  const v0 = tireLaunch(cam, { x: 0, y: -0.3, z: -1 }, fwd, 0).velocity;
  close(Math.hypot(v0.x, v0.z), 8); close(v0.y, 0);
  const v1 = tireLaunch(cam, fwd, fwd, 1).velocity;
  close(v1.z, -20);
});
test('tireLaunch_RollsWithoutSlip', () => {
  const { angularVelocity: w } = tireLaunch(cam, fwd, fwd, 0);
  close(w.x, -8 / TIRE.radius); close(w.y, 0); close(w.z, 0);
});
test('tireLaunch_AxleHorizontalAndPerpendicularToVelocity', () => {
  const { quaternion, velocity } = tireLaunch(cam, { x: 0.6, y: 0, z: -0.8 }, fwd, 0.5);
  const a = rotY(quaternion);
  close(a.y, 0); close(a.x * velocity.x + a.z * velocity.z, 0);
});
test('tireLaunch_VerticalAim_FallsBackToCameraForward', () => {
  const { velocity } = tireLaunch(cam, { x: 0, y: -1, z: 0 }, { x: 1, y: -0.5, z: 0 }, 0);
  close(velocity.x, 8); close(velocity.z, 0);
  assert.ok(Object.values(velocity).every(Number.isFinite));
});
test('rollingStep_HalfSecond_LosesOneMetrePerSecond', () => {
  const r = rollingStep({ x: 0, y: -0.2, z: -8 }, { x: -10, y: 0, z: 0 }, 0.5);
  close(r.velocity.z, -7); close(r.velocity.y, -0.2); close(r.angularVelocity.x, -8.75);
});
test('rollingStep_SpeedBelowDecel_StopsAtZero', () => {
  const r = rollingStep({ x: 0, y: 0, z: -0.5 }, { x: -0.625, y: 0, z: 0 }, 0.5);
  close(r.velocity.z, 0); close(r.angularVelocity.x, 0);
  const z = rollingStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.5);
  assert.ok(Object.values(z.angularVelocity).every(Number.isFinite));
});
test('axleTilt_UprightTire_Zero', () => close(axleTilt(upright), 0));
test('shouldTip_SlowAndUpright_True', () => {
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, upright, false), true);
});
test('shouldTip_FastOrTippedOrLeaning_False', () => {
  assert.equal(shouldTip({ x: 0, y: 0, z: -3 }, upright, false), false);
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, upright, true), false);
  const lean = { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }; // axle 45° up
  assert.equal(shouldTip({ x: 0, y: 0, z: -2 }, lean, false), false);
});
test('tipSpin_AboutRollDirection_SignFromRand', () => {
  const w = tipSpin({ x: 0, y: 0, z: -2 }, 0.2);
  close(w.x, 0); close(w.y, 0); close(w.z, 1.5);
  close(tipSpin({ x: 0, y: 0, z: -2 }, 0.8).z, -1.5);
});