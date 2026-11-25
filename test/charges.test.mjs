import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE, chargeLaunch, chargeMomentum, chargeStickPlan, isFuseDone, blinkPeriod, ledOn, canPlaceRemote, armedRemotes } from '../weapons/charges.js';

test('chargeLaunch_PowerRange_Speed12To26', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 12);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 26);
});

test('chargeLaunch_PowerOutOfRange_Clamped', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, -1).speed, 12);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 5).speed, 26);
});

test('chargeLaunch_FlatAim_LiftedUnitDirection', () => {
  const { direction: d } = chargeLaunch({ x: 0, y: 0, z: -1 }, 0.5);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  assert.ok(Math.abs(d.y - 0.28 / Math.hypot(0.28, 1)) < 1e-9);
  assert.ok(d.z < 0);
  assert.equal(d.x, 0);
});

test('isFuseDone_BeforeAndAtFuse_FalseThenTrue', () => {
  assert.equal(isFuseDone(1000, 4999), false);
  assert.equal(isFuseDone(1000, 5000), true);
});

test('blinkPeriod_OverTheFuse_SlowsToFast', () => {
  assert.equal(blinkPeriod(0), 600);
  assert.equal(blinkPeriod(2000), 350);
  assert.equal(blinkPeriod(4000), 100);
});

test('blinkPeriod_OutsideTheFuse_Clamped', () => {
  assert.equal(blinkPeriod(-100), 600);
  assert.equal(blinkPeriod(9000), 100);
});

test('ledOn_FirstAndSecondHalfOfPeriod_OnThenOff', () => {
  assert.equal(ledOn(0), true);
  assert.equal(ledOn(100), true);    // period 587.5, first half
  assert.equal(ledOn(400), false);   // period 550, second half
});

test('canPlaceRemote_BelowAndAtCap_TrueThenFalse', () => {
  assert.equal(canPlaceRemote(CHARGE.maxRemote - 1), true);
  assert.equal(canPlaceRemote(CHARGE.maxRemote), false);
});

test('armedRemotes_MixedRecords_OnlyUnexplodedRemotes', () => {
  const a = { type: 'remotecharge', exploded: false };
  const b = { type: 'remotecharge', exploded: true };
  const c = { type: 'timedcharge', exploded: false };
  const d = { type: 'bomb', exploded: false };
  assert.deepEqual(armedRemotes([a, b, c, d]), [a]);
  assert.deepEqual(armedRemotes([]), []);
});

test('CHARGE_Tuning_MatchesSpec', () => {
  assert.equal(CHARGE.mass, 0.1);
  assert.deepEqual(CHARGE.halfExtents, [0.16, 0.08, 0.11]);
  assert.equal(CHARGE.blastRadius, 4);
  assert.equal(CHARGE.blastStrength, 500);
  assert.equal(CHARGE.fuseMs, 4000);
  assert.equal(CHARGE.maxRemote, 6);
});

test('chargeMomentum_FullPower_StaysBelowThreeNewtonSeconds', () => {
  assert.ok(chargeMomentum(1) <= 3);
  assert.ok(Math.abs(chargeMomentum(1) - 2.6) < 1e-9);
});

test('chargeMomentum_NoPower_IsBaseSpeedTimesMass', () => {
  assert.ok(Math.abs(chargeMomentum(0) - 1.2) < 1e-9);
});

test('chargeStickPlan_AlreadyStuck_Ignore', () => {
  assert.equal(chargeStickPlan(true, { mass: 5 }), 'ignore');
});

test('chargeStickPlan_FirstContactWithPiece_Joint', () => {
  assert.equal(chargeStickPlan(false, { mass: 5 }), 'joint');
});

test('chargeStickPlan_FirstContactWithStaticBody_Joint', () => {
  assert.equal(chargeStickPlan(false, { mass: 0 }), 'joint');
});

test('chargeStickPlan_NoOtherBody_Freeze', () => {
  assert.equal(chargeStickPlan(false, null), 'freeze');
  assert.equal(chargeStickPlan(false, undefined), 'freeze');
});