import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRecordFormat, recordFileName, recordBitrate, recordKeyAction, recordNext, recordElapsed, formatClock, FORMATS, MAX_SECONDS, RECORD_KEY } from '../ui/record.js';

const key = (o) => ({ code: 'Backquote', repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...o });

test('pickRecordFormat_AllSupported_Mp4First', () => {
  assert.deepEqual(pickRecordFormat(() => true), { mime: FORMATS[0], ext: 'mp4' });
});
test('pickRecordFormat_OnlyWebm_Webm', () => {
  assert.deepEqual(pickRecordFormat((m) => m.startsWith('video/webm')), { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' });
});
test('pickRecordFormat_OnlyPlainMp4_Mp4_IosSafari', () => {
  assert.deepEqual(pickRecordFormat((m) => m === 'video/mp4'), { mime: 'video/mp4', ext: 'mp4' });
});
test('pickRecordFormat_NothingSupported_Null', () => {
  assert.equal(pickRecordFormat(() => false), null);
});
test('pickRecordFormat_OpusBeforeAacInMp4_AacEncoderStartDropsAudio', () => {
  assert.equal(FORMATS[0], 'video/mp4;codecs=avc1,opus');
  assert.ok(FORMATS.indexOf('video/mp4;codecs=avc1,opus') < FORMATS.indexOf('video/mp4;codecs=avc1,mp4a.40.2'));
  const noOpus = new Set(['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']);
  assert.deepEqual(pickRecordFormat((m) => noOpus.has(m)), { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' });
});
test('recordFileName_LocalClock_PrefixedAndPadded', () => {
  assert.equal(recordFileName(new Date(2026, 10, 26, 7, 5, 3), 'mp4'), 'barrel-blast-20261126-070503.mp4');
  assert.equal(recordFileName(new Date(2026, 11, 31, 23, 59, 59), 'webm'), 'barrel-blast-20261231-235959.webm');
});
test('recordBitrate_UpTo1080p_12Mbit_Above_20Mbit', () => {
  assert.equal(recordBitrate(1920, 1080), 12_000_000);
  assert.equal(recordBitrate(2560, 1230), 20_000_000);
});
test('recordKeyAction_Backquote_Toggle', () => {
  assert.equal(RECORD_KEY, 'Backquote');
  assert.equal(recordKeyAction(key({})), 'toggle');
});
test('recordKeyAction_Held_Ignore', () => {
  assert.equal(recordKeyAction(key({ repeat: true })), 'ignore');
});
test('recordKeyAction_ModifierOrOtherKey_Null', () => {
  for (const m of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) assert.equal(recordKeyAction(key({ [m]: true })), null);
  assert.equal(recordKeyAction(key({ code: 'KeyX' })), null);
});
test('recordNext_StateMachine_InvalidEventsChangeNothing', () => {
  assert.equal(recordNext('idle', 'start'), 'recording');
  assert.equal(recordNext('recording', 'pause'), 'paused');
  assert.equal(recordNext('paused', 'resume'), 'recording');
  assert.equal(recordNext('paused', 'stop'), 'stopping');
  assert.equal(recordNext('stopping', 'stopped'), 'idle');
  assert.equal(recordNext('recording', 'fail'), 'idle');
  assert.equal(recordNext('idle', 'stop'), 'idle');
  assert.equal(recordNext('idle', 'pause'), 'idle');
  assert.equal(recordNext('recording', 'resume'), 'recording');
});
test('recordElapsed_PausedTimeDoesNotCount', () => {
  assert.equal(recordElapsed({ startedAt: 1000, pausedAt: null, pausedTotal: 2000 }, 8000), 5);
  assert.equal(recordElapsed({ startedAt: 1000, pausedAt: 4000, pausedTotal: 0 }, 9000), 3);
});
test('formatClock_MinutesAndSeconds', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
});
test('MAX_SECONDS_TenMinutes', () => {
  assert.equal(MAX_SECONDS, 600);
});