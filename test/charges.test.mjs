import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE, chargeLaunch, chargeStickPlan, chargeReach, chargeOutOfRange, quatFromUp, flushPose, pieceOf, isFuseDone, blinkPeriod, ledOn, canPlaceRemote, maxRemoteFor, armedRemotes, CUT, BLAST_LIFT, blastImpulse, cutShove, isRemoteType, isChargeType } from '../weapons/charges.js';

test('chargeLaunch_PowerRange_Speed40To60', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 0).speed, 40);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 1).speed, 60);
});

test('chargeLaunch_PowerOutOfRange_Clamped', () => {
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, -1).speed, 40);
  assert.equal(chargeLaunch({ x: 0, y: 0, z: -1 }, 5).speed, 60);
});

test('chargeLaunch_Aim_DirectionIsExactlyTheAim', () => {
  for (const aim of [{ x: 0, y: 0, z: -1 }, { x: 0.6, y: 0.8, z: 0 }, { x: 0, y: -0.6, z: -0.8 }]) {
    for (const power of [0, 0.5, 1]) {
      const { direction: d } = chargeLaunch(aim, power);
      assert.ok(Math.abs(d.x - aim.x) < 1e-9 && Math.abs(d.y - aim.y) < 1e-9 && Math.abs(d.z - aim.z) < 1e-9);
    }
  }
});

test('chargeLaunch_NoLiftTuning_Removed', () => {
  assert.equal(CHARGE.lift, undefined);
});

test('chargeOutOfRange_BeforeAndAtFlightRange_FalseThenTrue', () => {
  const start = { x: 1, y: 2, z: 3 };
  assert.equal(chargeOutOfRange(start, { x: 1, y: 2, z: 3 - 99.9 }), false);
  assert.equal(chargeOutOfRange(start, { x: 1, y: 2, z: 3 - CHARGE.flightRange }), true);
});

test('chargeReach_AtMaxSpeed_CoversOneFrameOfFlight', () => {
  const dt = 1 / 60;
  assert.ok(chargeReach(60, dt) > 60 * dt);
  assert.ok(chargeReach(60, 0.1) > 60 * 0.1);
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

test('maxRemoteFor_WideBlock12_Others6', () => {
  // #99: one charge per ground column of the six-bay demolition block; the slim tower keeps 6
  assert.equal(maxRemoteFor('demolitionwide'), 12);
  assert.equal(maxRemoteFor('demolition'), 6);
  assert.equal(maxRemoteFor('chimney'), 6);
  assert.equal(maxRemoteFor('barrels'), 6);
});

test('canPlaceRemote_WithDemolitionCap_Allows12', () => {
  assert.equal(canPlaceRemote(11, 12), true);
  assert.equal(canPlaceRemote(12, 12), false);
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

test('chargeStickPlan_OtherIsProjectile_Ignore', () => {
  // projectiles are removed on their own schedule; a joint to one would outlive its body
  assert.equal(chargeStickPlan(false, { mass: 2 }, true), 'ignore');
});

// ---- #78: stick flush on the drawn surface ----
function near(actual, expected, eps = 1e-9) {
  for (const k of Object.keys(expected)) {
    assert.ok(Math.abs(actual[k] - expected[k]) < eps, `${k}: ${actual[k]} vs ${expected[k]}`);
  }
}

// rotates v by the unit quaternion q (v' = q v q*)
function rotate(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

test('chargeReach_Standing_HalfDiagonal', () => {
  assert.ok(Math.abs(chargeReach(0, 0) - 0.21) < 1e-9);
});

test('chargeReach_FullSpeedOneFrame_FramePlusSubstepPlusHalfDiagonal', () => {
  assert.ok(Math.abs(chargeReach(24, 1 / 30) - 1.11) < 1e-9);   // 24 * (1/30 + 1/240) + 0.21
});

test('quatFromUp_Up_Identity', () => {
  near(quatFromUp({ x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 0, w: 1 });
});

test('quatFromUp_Down_HalfTurnAboutX', () => {
  near(quatFromUp({ x: 0, y: -1, z: 0 }), { x: 1, y: 0, z: 0, w: 0 });
});

test('quatFromUp_AnyNormal_TurnsUpOntoIt', () => {
  for (const n of [{ x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, { x: 0.6, y: 0, z: 0.8 }, { x: 0.48, y: -0.6, z: 0.64 }]) {
    const q = quatFromUp(n);
    assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9);
    near(rotate(q, { x: 0, y: 1, z: 0 }), n);
  }
});

test('flushPose_FaceTowardsPlusZ_CentreHalfThicknessOut', () => {
  const pose = flushPose({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 1 });
  near(pose.position, { x: 1, y: 2, z: 3.08 });
  near(rotate(pose.quaternion, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 });
});

test('flushPose_Floor_LiesFlatOnTop', () => {
  const pose = flushPose({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  near(pose.position, { x: 0, y: 0.08, z: 0 });
  near(pose.quaternion, { x: 0, y: 0, z: 0, w: 1 });
});

test('pieceOf_MeshOrChildOfAPiece_ThatPiece', () => {
  const a = { parent: null }, b = { parent: null };
  const pieces = [{ mesh: a }, { mesh: b }];
  assert.equal(pieceOf(b, pieces), pieces[1]);
  assert.equal(pieceOf({ parent: { parent: a } }, pieces), pieces[0]);
});

test('pieceOf_UnrelatedMesh_Null', () => {
  assert.equal(pieceOf({ parent: { parent: null } }, [{ mesh: {} }]), null);
  assert.equal(pieceOf(null, []), null);
});

// ---- #87: cutting charge ----

test('CUT_Tuning_SmallRadiusNoLift', () => {
  assert.equal(CUT.radius, 1.2);
  assert.equal(CUT.lift, 0);
  assert.equal(BLAST_LIFT, 0.3);
});

test('blastImpulse_OutsideRadius_Null', () => {
  assert.equal(blastImpulse({ x: 2, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift), null);
});

test('blastImpulse_Wide_KeepsUpwardKick', () => {
  const i = blastImpulse({ x: 2, y: 0, z: 0 }, 4, 500);   // falloff 0.5 -> 250
  assert.equal(i.x, 250);
  assert.equal(i.y, 250 * BLAST_LIFT);
  assert.equal(i.z, 0);
});

test('blastImpulse_Cut_NoUpwardComponentForSideOffset', () => {
  const i = blastImpulse({ x: 0.8, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(i.x > 0);
  assert.equal(i.y, 0);
});

test('blastImpulse_Cut_FallsOffWithDistance', () => {
  const near = blastImpulse({ x: 0.6, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  const far = blastImpulse({ x: 1.1, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(near.x > far.x);
});

test('blastImpulse_AtCentre_FiniteAndInsideMinDistance', () => {
  const i = blastImpulse({ x: 0, y: 0, z: 0 }, CUT.radius, CUT.strength, CUT.lift);
  assert.ok(Number.isFinite(i.x) && Number.isFinite(i.y) && Number.isFinite(i.z));
});

test('cutShove_PieceToTheRight_HorizontalPushRight', () => {
  const s = cutShove({ x: 3, y: 5, z: 0 });
  assert.equal(s.x, CUT.shove);
  assert.equal(s.y, 0);
  assert.equal(s.z, 0);
});

test('cutShove_DiagonalOffset_UnitDirectionTimesStrength', () => {
  const s = cutShove({ x: 1, y: 2, z: 1 }, 10);
  assert.ok(Math.abs(Math.hypot(s.x, s.z) - 10) < 1e-9);
  assert.equal(s.y, 0);
});

test('cutShove_VerticallyAligned_FallsBackToPlusX', () => {
  assert.deepEqual(cutShove({ x: 0, y: 1, z: 0 }, 7), { x: 7, y: 0, z: 0 });
});

test('isRemoteType_And_isChargeType_Classify', () => {
  assert.ok(isRemoteType('remotecharge') && isRemoteType('cutcharge'));
  assert.ok(!isRemoteType('timedcharge') && !isRemoteType('bomb'));
  assert.ok(isChargeType('timedcharge') && isChargeType('cutcharge') && !isChargeType('dynamite'));
});

test('armedRemotes_CutChargeCountsAsRemote', () => {
  const a = { type: 'cutcharge', exploded: false };
  const b = { type: 'cutcharge', exploded: true };
  assert.deepEqual(armedRemotes([a, b]), [a]);
});
