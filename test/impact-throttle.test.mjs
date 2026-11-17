import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPACT, impactVolume, createImpactThrottle } from '../audio/impact-throttle.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const KINDS = ['metal', 'wood', 'stone', 'pin', 'card'];

test('IMPACT_EveryKind_HasThresholdBelowFullSpeedAndAVoiceLength', () => {
  for (const k of KINDS) {
    const m = IMPACT.kinds[k];
    assert.ok(m, k);
    assert.ok(m.minSpeed > 0 && m.minSpeed < m.fullSpeed, k);
    assert.ok(m.voiceMs > 0, k);
  }
  assert.equal(IMPACT.cooldownMs, 120);
  assert.equal(IMPACT.maxVoices, 8);
});

test('impactVolume_BelowMinSpeed_IsZero', () => {
  for (const k of KINDS) assert.equal(impactVolume(k, IMPACT.kinds[k].minSpeed * 0.99), 0, k);
});

test('impactVolume_AtMinSpeed_IsTheAudibleFloor', () => {
  close(impactVolume('metal', IMPACT.kinds.metal.minSpeed), IMPACT.minVolume);
});

test('impactVolume_AtAndAboveFullSpeed_IsOne', () => {
  close(impactVolume('stone', IMPACT.kinds.stone.fullSpeed), 1);
  close(impactVolume('stone', IMPACT.kinds.stone.fullSpeed * 5), 1);
});

test('impactVolume_GrowsWithSpeed', () => {
  const { minSpeed, fullSpeed } = IMPACT.kinds.wood;
  let prev = 0;
  for (let i = 0; i <= 10; i++) {
    const v = impactVolume('wood', minSpeed + (fullSpeed - minSpeed) * i / 10);
    assert.ok(v > prev, `step ${i}: ${v} <= ${prev}`);
    prev = v;
  }
});

test('impactVolume_NegativeSpeed_UsesMagnitude', () => {
  close(impactVolume('card', -IMPACT.kinds.card.fullSpeed), 1);
});

test('impactVolume_UnknownKind_Throws', () => {
  assert.throws(() => impactVolume('glass', 5), /unknown impact kind/);
});

test('admit_FastImpact_ReturnsVoiceWithVolume', () => {
  const t = createImpactThrottle();
  const d = t.admit('a', 'metal', 6, 0);
  assert.ok(d);
  close(d.volume, impactVolume('metal', 6));
  assert.equal(d.evict, null);
  assert.equal(t.activeCount(0), 1);
});

test('admit_SlowImpact_ReturnsNullAndStartsNoCooldown', () => {
  const t = createImpactThrottle();
  assert.equal(t.admit('a', 'stone', 0.3, 0), null);
  assert.ok(t.admit('a', 'stone', 6, 10));
});

test('admit_SameBodyWithinCooldown_IsRejected', () => {
  const t = createImpactThrottle();
  assert.ok(t.admit('a', 'wood', 6, 0));
  assert.equal(t.admit('a', 'wood', 9, IMPACT.cooldownMs - 1), null);
  assert.ok(t.admit('a', 'wood', 6, IMPACT.cooldownMs));
});

test('admit_OtherBodyWithinCooldown_IsAdmitted', () => {
  const t = createImpactThrottle();
  assert.ok(t.admit('a', 'wood', 6, 0));
  assert.ok(t.admit('b', 'wood', 6, 1));
});

test('admit_WithPartner_PartnerAlsoCoolsDown', () => {
  // one contact between two targets reaches both callbacks: only the first may sound
  const t = createImpactThrottle();
  assert.ok(t.admit('a', 'metal', 6, 0, 'b'));
  assert.equal(t.admit('b', 'metal', 6, 0, 'a'), null);
  assert.ok(t.admit('b', 'metal', 6, IMPACT.cooldownMs));
});

test('admit_VoiceEnds_FreesItsSlot', () => {
  const t = createImpactThrottle();
  t.admit('a', 'card', 5, 0);
  assert.equal(t.activeCount(IMPACT.kinds.card.voiceMs - 1), 1);
  assert.equal(t.activeCount(IMPACT.kinds.card.voiceMs), 0);
});

function fillVoices(t, volumeFor) {
  const ids = [];
  for (let i = 0; i < IMPACT.maxVoices; i++) ids.push(t.admit('k' + i, 'stone', volumeFor(i), 0).id);
  return ids;
}

test('admit_CapFullAndNewIsQuieter_IsDropped', () => {
  const t = createImpactThrottle();
  fillVoices(t, () => 8);
  assert.equal(t.admit('new', 'stone', 3, 1), null);
  assert.equal(t.activeCount(1), IMPACT.maxVoices);
});

test('admit_CapFullAndNewIsLouder_EvictsTheQuietest', () => {
  const t = createImpactThrottle();
  const ids = fillVoices(t, (i) => (i === 3 ? 2 : 4));
  const d = t.admit('new', 'stone', 9, 1);
  assert.ok(d);
  assert.equal(d.evict, ids[3]);
  assert.equal(t.activeCount(1), IMPACT.maxVoices);
});

test('admit_CapFullAndAllEquallyQuiet_EvictsTheOldest', () => {
  const t = createImpactThrottle();
  for (let i = 0; i < IMPACT.maxVoices; i++) t.admit('k' + i, 'stone', 3, i);
  const first = 0;
  const d = t.admit('new', 'stone', 9, 20);
  assert.ok(d);
  assert.equal(d.evict, first + 1); // ids start at 1
});

test('admit_NeverExceedsMaxVoices_UnderABurst', () => {
  const t = createImpactThrottle();
  let peak = 0;
  for (let ms = 0; ms < 1000; ms += 4) {
    for (let b = 0; b < 30; b++) t.admit('b' + b, 'metal', 1.5 + ((b * 7 + ms) % 10), ms);
    peak = Math.max(peak, t.activeCount(ms));
  }
  assert.ok(peak <= IMPACT.maxVoices, `peak ${peak}`);
});

test('admit_UnknownKind_Throws', () => {
  const t = createImpactThrottle();
  assert.throws(() => t.admit('a', 'glass', 5, 0), /unknown impact kind/);
});

test('reset_ClearsCooldownsAndVoices', () => {
  const t = createImpactThrottle();
  t.admit('a', 'metal', 6, 0);
  t.reset();
  assert.equal(t.activeCount(0), 0);
  assert.ok(t.admit('a', 'metal', 6, 1));
});

