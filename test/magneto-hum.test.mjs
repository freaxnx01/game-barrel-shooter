import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUM, humLevel } from '../audio/magneto-hum.js';

test('humLevel_NoPiecesHeld_IsAudibleBase', () => {
  const l = humLevel(0);
  assert.equal(l.gain, HUM.baseGain);
  assert.equal(l.detune, 0);
});

test('humLevel_MorePiecesHeld_LouderAndHigher', () => {
  const a = humLevel(1), b = humLevel(5);
  assert.ok(b.gain > a.gain && a.gain > humLevel(0).gain);
  assert.ok(b.detune > a.detune && a.detune > 0);
});

test('humLevel_ManyPieces_SaturatesBelowClipping', () => {
  const l = humLevel(500);
  assert.equal(l.gain, HUM.baseGain + HUM.extraGain);
  assert.equal(l.detune, HUM.maxDetune);
  assert.ok(l.gain < 0.5);
  assert.deepEqual(humLevel(HUM.fullAt), l);
});

test('humLevel_NegativeCount_TreatedAsZero', () => {
  assert.deepEqual(humLevel(-3), humLevel(0));
});

test('HUM_FadeOut_SettlesWithinAboutTwoTenthsOfASecond', () => {
  // setTargetAtTime reaches ~1% after 4.6 time constants
  assert.ok(HUM.releaseTau * 4.6 <= 0.2);
});
