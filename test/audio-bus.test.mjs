import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sites = html.split('\n').filter((l) => /\.destination\b/.test(l) && !l.trim().startsWith('//'));

test('AudioBus_OnlyCtxTouchesDestination_EverythingElseUsesSfxOut', () => {
  assert.equal(sites.length, 1, 'only ctx() may reference .destination:\n' + sites.join('\n'));
  assert.match(sites[0], /sfxOut\.connect\(\w+\.destination\)|connect\(audioCtx\.destination\)/);
});
test('AudioBus_SfxOutGainIsOne_BehaviourNeutral', () => {
  assert.match(html, /sfxOut\.gain\.value\s*=\s*1/);
});