// #50: when to show the "add to home screen" hint on iPhone/iPad. Pure, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIos, shouldShowIosHint } from '../pwa/iosinstall.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const base = { ua: IPHONE, platform: 'iPhone', maxTouchPoints: 5, installed: false, dismissed: false };

test('isIos_IphoneIpadIpodUserAgents_True', () => {
  assert.equal(isIos({ ua: IPHONE }), true);
  assert.equal(isIos({ ua: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)' }), true);
  assert.equal(isIos({ ua: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)' }), true);
});

test('isIos_IpadOsMacUserAgentWithTouch_True', () => {
  assert.equal(isIos({ ua: IPAD_MAC, platform: 'MacIntel', maxTouchPoints: 5 }), true);
});

test('isIos_RealMacAndroidOrEmpty_False', () => {
  assert.equal(isIos({ ua: IPAD_MAC, platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(isIos({ ua: ANDROID, platform: 'Linux armv81', maxTouchPoints: 5 }), false);
  assert.equal(isIos({}), false);
});

test('shouldShowIosHint_IosBrowserNotDismissed_True', () => {
  assert.equal(shouldShowIosHint(base), true);
});

test('shouldShowIosHint_InstalledDismissedOrNotIos_False', () => {
  assert.equal(shouldShowIosHint({ ...base, installed: true }), false);
  assert.equal(shouldShowIosHint({ ...base, dismissed: true }), false);
  assert.equal(shouldShowIosHint({ ...base, ua: ANDROID, platform: 'Linux armv81' }), false);
});
