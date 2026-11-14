import test from 'node:test';
import assert from 'node:assert/strict';
import { SNIPER, sniperSpeed, isOutOfRange, streakLength } from '../weapons/sniper.js';

test('sniperSpeed_PowerRange_Between160And240', () => {
  assert.equal(sniperSpeed(0), 160);
  assert.equal(sniperSpeed(1), 240);
  assert.equal(sniperSpeed(0.5), 200);
});

test('sniperSpeed_PowerOutOfRange_Clamped', () => {
  assert.equal(sniperSpeed(-1), 160);
  assert.equal(sniperSpeed(5), 240);
});

test('isOutOfRange_Under150m_False', () => {
  assert.equal(isOutOfRange({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -149 }), false);
});

test('isOutOfRange_At150m_True', () => {
  assert.equal(isOutOfRange({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -150 }), true);
});

test('streakLength_JustFired_CappedToDistanceFlown', () => {
  assert.equal(streakLength(0), 0);
  assert.equal(streakLength(1.5), 1.5);
  assert.equal(streakLength(40), SNIPER.streakLength);
});

test('SNIPER_Tuning_MatchesSpec', () => {
  assert.equal(SNIPER.mass, 1.2);
  assert.equal(SNIPER.radius, 0.1);
});
