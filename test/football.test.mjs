import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOOTBALL, footballSpeed, footballLaunch, longAxis, noseAngle, flightAngularVelocity } from '../weapons/football.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (v) => Math.hypot(v.x, v.y, v.z);

test('FOOTBALL_Tuning_RealMassAndProlateShape', () => {
  assert.equal(FOOTBALL.mass, 0.4);
  // real ball 28 x 17 cm, scaled up to the game's ball sizes: keep its aspect ratio
  close(FOOTBALL.halfLength / FOOTBALL.radius, 28 / 17, 0.1);
  assert.ok(FOOTBALL.halfLength * 2 > 0.5, 'reads next to the 0.64 m basketball');
  assert.ok(FOOTBALL.spinRate / (2 * Math.PI) >= 2 && FOOTBALL.spinRate / (2 * Math.PI) <= 6, 'a few revolutions per second');
});

// a pass is thrown harder than the 18-40 m/s balls: at 0.4 kg it needs the speed to tip a barrel
test('footballSpeed_PowerRange_20To48', () => {
  close(footballSpeed(0), 20);
  close(footballSpeed(1), 48);
  close(footballSpeed(-3), 20);
  close(footballSpeed(7), 48);
});

test('longAxis_IdentityQuaternion_IsPlusY', () => {
  const a = longAxis({ x: 0, y: 0, z: 0, w: 1 });
  close(a.x, 0); close(a.y, 1); close(a.z, 0);
});

test('longAxis_QuarterTurnAboutX_PointsAlongZ', () => {
  const s = Math.SQRT1_2;
  const a = longAxis({ x: s, y: 0, z: 0, w: s });
  close(a.x, 0); close(a.y, 0); close(a.z, 1);
});

test('footballLaunch_NoseAlongAim', () => {
  const dir = { x: 0.6, y: 0, z: -0.8 };
  const { quaternion } = footballLaunch(dir, 0.5);
  const a = longAxis(quaternion);
  close(dot(a, dir), 1);
});

test('footballLaunch_VelocityAlongAimAtPowerSpeed', () => {
  const dir = { x: 0, y: 0.6, z: -0.8 };
  const { velocity } = footballLaunch(dir, 1);
  close(velocity.x, 0); close(velocity.y, 28.8); close(velocity.z, -38.4);
});

test('footballLaunch_SpinsAboutItsLongAxis', () => {
  const dir = { x: 0, y: 0, z: -1 };
  const { angularVelocity: w } = footballLaunch(dir, 0);
  close(w.x, 0); close(w.y, 0); close(w.z, -FOOTBALL.spinRate);
});

test('footballLaunch_AimStraightDown_StillAValidQuaternion', () => {
  const { quaternion: q } = footballLaunch({ x: 0, y: -1, z: 0 }, 0);
  close(Math.hypot(q.x, q.y, q.z, q.w), 1);
  close(longAxis(q).y, -1);
});

test('noseAngle_AlignedAndPerpendicular', () => {
  close(noseAngle({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -20 }), 0);
  close(noseAngle({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -20 }), 90);
  close(noseAngle({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 20 }), 180);
});

test('flightAngularVelocity_Aligned_KeepsOnlyTheSpin', () => {
  const axis = { x: 0, y: 0, z: -1 };
  const w = flightAngularVelocity(axis, { x: 1.5, y: -2, z: -25 }, { x: 0, y: 0, z: -20 });
  close(w.x, 0); close(w.y, 0); close(w.z, -25);
});

test('flightAngularVelocity_NoseAboveVelocity_TurnsNoseTowardIt', () => {
  // nose 10 degrees above a level flight path along -z
  const t = 10 * Math.PI / 180;
  const axis = { x: 0, y: Math.sin(t), z: -Math.cos(t) };
  const omega = { x: axis.x * 25, y: axis.y * 25, z: axis.z * 25 };
  const v = { x: 0, y: 0, z: -20 };
  const w = flightAngularVelocity(axis, omega, v);
  // spin about the long axis is kept
  close(dot(w, axis), 25);
  // the rest rotates the nose toward the velocity: d(axis)/dt = w x axis points toward v
  const turn = { x: w.y * axis.z - w.z * axis.y, y: w.z * axis.x - w.x * axis.z, z: w.x * axis.y - w.y * axis.x };
  assert.ok(turn.y < 0, `nose moves down, got ${turn.y}`);
  close(norm(turn), FOOTBALL.alignGain * Math.sin(t));
});

test('flightAngularVelocity_NearlyAtRest_LeavesOmegaAlone', () => {
  const omega = { x: 3, y: -1, z: 2 };
  const w = flightAngularVelocity({ x: 0, y: 1, z: 0 }, omega, { x: 0.1, y: 0, z: 0 });
  assert.deepEqual(w, omega);
});
