# Record a video of the game (#95) Implementation Plan

**Goal:** A key (Backquote, `§` on Swiss keyboards) and an on-screen button record the canvas plus the game sound to an `.mp4` or `.webm` download, like Rhyflitzer.

**Files:** `ui/record.js` (new), `test/record.test.mjs` (new), `test/audio-bus.test.mjs` (new), `index.html`, `README.md`, `CHANGELOG.md`.
Spec: `docs/superpowers/specs/2026-11-26-issue-95-record-video-design.md`. Other issues may have landed first and touched `index.html`; work by function and id names (`ctx`, `playWind`, `playClank`, `#mob-bar`), not line numbers. Run tests with `node --test test/*.test.mjs`. Do not run Playwright or a browser unless a step says so.

### Task 1: Pure recording rules

**Files:** create `ui/record.js`, `test/record.test.mjs`.

- [ ] **Step 1: Failing tests.** Create `test/record.test.mjs`:

```js
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
```

- [ ] **Step 2:** Run `node --test test/record.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** Create `ui/record.js`:

```js
// Issue #95: pure rules for the video recording -- no DOM, no three.js. Unit-tested with `node --test test/record.test.mjs`.

// the key left of 1: § on a Swiss keyboard, ` on US; Shift is the earthquake, so no Shift combination
export const RECORD_KEY = 'Backquote';
export const MAX_SECONDS = 600;   // chunks live in RAM, so a recording stops by itself after 10 minutes

// mp4/H.264 preferred (YouTube), else webm -- the first the browser supports wins.
// Opus before AAC in mp4: starting Chrome's platform AAC encoder drops the sound for a moment (Rhyflitzer #891).
// iOS Safari records mp4 only and falls through to the plain 'video/mp4'.
export const FORMATS = ['video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

// isSupported = MediaRecorder.isTypeSupported bound; the first supported mime wins, null when none is
export function pickRecordFormat(isSupported) {
  for (const mime of FORMATS) {
    if (!isSupported(mime)) continue;
    return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

// the download name from the player's local clock: barrel-blast-YYYYMMDD-hhmmss.<ext>
export function recordFileName(date, ext) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `barrel-blast-${day}-${time}.${ext}`;
}

// by pixel count: 12 Mbit/s up to 2.1 MP (1080p), 20 Mbit/s above
export function recordBitrate(w, h) {
  return w * h <= 2100000 ? 12000000 : 20000000;
}

// key = { code, repeat, shiftKey, ctrlKey, altKey, metaKey }
// -> 'toggle' | 'ignore' (a held key: no flicker) | null (not the record key / a modifier is held)
export function recordKeyAction(key) {
  if (key.code !== RECORD_KEY) return null;
  if (key.shiftKey || key.ctrlKey || key.altKey || key.metaKey) return null;
  return key.repeat ? 'ignore' : 'toggle';
}

// states idle | recording | paused | stopping; events start | pause | resume | stop | stopped | fail
// invalid pairs leave the state unchanged; fail always lands in idle
const NEXT = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'stopping', fail: 'idle' },
  paused: { resume: 'recording', stop: 'stopping', fail: 'idle' },
  stopping: { stopped: 'idle', fail: 'idle' },
};
export function recordNext(state, event) {
  return (NEXT[state] && NEXT[state][event]) || state;
}

// c = { startedAt, pausedAt: null | ms, pausedTotal } in performance.now() ms -> elapsed seconds without the pauses
export function recordElapsed(c, now) {
  const paused = c.pausedAt != null ? now - c.pausedAt : 0;
  return Math.max(0, Math.floor((now - c.startedAt - c.pausedTotal - paused) / 1000));
}

// 0 -> '0:00', 65 -> '1:05', 600 -> '10:00'
export function formatClock(sec) {
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
```

- [ ] **Step 4:** Run `node --test test/*.test.mjs`. Expected: all PASS.

- [ ] **Step 5: Commit.** `git add ui/record.js test/record.test.mjs && git commit -m "feat(record): pure rules for the video recording (#95)"`

### Task 2: One master audio bus (behaviour-neutral)

**Files:** create `test/audio-bus.test.mjs`; modify `index.html` (the "Sound (Web Audio, synthesized)" section and every sound function).

Every sound connects to `ac.destination` today. After this task they connect to `ac.sfxOut`, a gain node of 1 that is the only thing connected to `ac.destination`. Nothing audible changes.

- [ ] **Step 1: Failing test.** Create `test/audio-bus.test.mjs`:

```js
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
```

- [ ] **Step 2:** Run `node --test test/audio-bus.test.mjs`. Expected: FAIL (11 sites).

- [ ] **Step 3: Refactor `ctx()`.** Replace:

```js
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
```

with:

```js
function ctx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // one master bus (#95): every sound goes through sfxOut, so the recording can tap it
    audioCtx.sfxOut = audioCtx.createGain();
    audioCtx.sfxOut.gain.value = 1;
    audioCtx.sfxOut.connect(audioCtx.destination);
  }
```

Add, right after `ctx()`, the recording tap:

```js
// #95: the recording's audio tap -- sfxOut feeds a MediaStreamDestination as a second output, created on the first recording
function recordTap() {
  const ac = ctx();
  if (!ac.recDest) { ac.recDest = ac.createMediaStreamDestination(); ac.sfxOut.connect(ac.recDest); }
  return ac.recDest.stream;
}
```

- [ ] **Step 4: Reroute the sites.** In every one of these, `ac.destination` becomes `ac.sfxOut` (inside `ctx()` itself `audioCtx.destination` stays):
  - `playWind`: `src.connect(f).connect(g).connect(ac.destination)`
  - `playThunder`: same chain
  - `playExplosion`: the oscillator chain `o.connect(og).connect(ac.destination)` and the noise chain `src.connect(f).connect(g).connect(ac.destination)`
  - `playShoot`: `src.connect(f).connect(g).connect(ac.destination)`
  - `playClank` default parameter: `out = ctx().destination` becomes `out = ctx().sfxOut`
  - `playWoodKnock` default parameter: same change
  - `playBounce`: `o.connect(g).connect(ac.destination)`
  - `startRumble`: `src.connect(filter).connect(gain).connect(ac.destination)`
  - `playImpactVoice`: `g.connect(ac.destination)`
  - `updateMagnetoHum`: `createMagnetoHum(ac, ac.destination)`

  That is 11 occurrences (2 in `playExplosion`, 2 defaults). Do not touch `audio/magneto-hum.js` or `audio/impact-throttle.js` (they take the output node as a parameter).

- [ ] **Step 5:** Run `grep -n "\.destination" index.html`. Expected: exactly one line, in `ctx()`. Run `node --test test/*.test.mjs`. Expected: all PASS.

- [ ] **Step 6: Commit.** `git add index.html test/audio-bus.test.mjs && git commit -m "refactor(audio): route every sound through one master bus, sfxOut (#95)"`

### Task 3: Recorder, key, button and indicator

**Files:** modify `index.html`.

- [ ] **Step 1: Markup.** In `#mob-bar`, insert before `<button id="mob-help" ...>`:

```html
  <button id="mob-rec" type="button" title="Record a video (key §)" aria-label="Record a video">⏺</button>
```

After the `#mob-bar` closing `</div>` add:

```html
<div id="rec-msg" role="status" aria-live="polite" hidden></div>
```

- [ ] **Step 2: CSS.** Next to the `#mob-bar` rules add:

```css
  #mob-bar #mob-rec { min-width: 38px; }
  #mob-bar #mob-rec.rec { color: #ff6a5e; border-color: #ff6a5e; font-variant-numeric: tabular-nums; }
  #rec-msg { position: fixed; left: 50%; bottom: calc(96px + var(--sa-b)); transform: translateX(-50%); max-width: calc(100% - 32px); padding: 8px 14px; border-radius: 18px; background: rgba(26,22,17,0.88); border: 1px solid rgba(245,239,228,0.3); color: #f5efe4; font-size: 13px; text-align: center; pointer-events: none; z-index: 20; }
  #rec-msg[hidden] { display: none; }
```

- [ ] **Step 3: Import.** Add to the imports of the module script: `import { MAX_SECONDS, pickRecordFormat, recordFileName, recordBitrate, recordKeyAction, recordNext, recordElapsed, formatClock } from './ui/record.js';`

- [ ] **Step 4: Controller.** Add a new section after the magneto-hum section (`updateMagnetoHum`), so `devAudio`, `canvas` and `recordTap` already exist:

```js
// ---------- Video recording (#95) ----------
// Backquote (§) or the ⏺ button records the #c canvas plus the game sound (recordTap) with a MediaRecorder.
// HUD, buttons and #rec-msg are DOM, so they are never in the video. A hidden tab pauses the recorder
// (no frames arrive); a recording stops by itself after MAX_SECONDS because the chunks live in RAM. Rules in ui/record.js.
const REC = { state: 'idle', rec: null, chunks: [], fmt: null, clock: null, timer: 0, msgTimer: 0 };
const recBtn = document.getElementById('mob-rec');
const recMsg = document.getElementById('rec-msg');
function recNotice(text) {
  recMsg.textContent = text; recMsg.hidden = false;
  clearTimeout(REC.msgTimer);
  REC.msgTimer = setTimeout(() => { recMsg.hidden = true; }, 3500);
}
function recPaint() {
  const on = REC.state !== 'idle';
  recBtn.classList.toggle('rec', on);
  recBtn.textContent = on ? '● ' + formatClock(recordElapsed(REC.clock, performance.now())) : '⏺';
  recBtn.title = on ? 'Stop and save the video (key §)' : 'Record a video (key §)';
}
function startRecord() {
  if (REC.state !== 'idle') return;
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { recNotice('Video recording is not supported in this browser'); return; }
  const fmt = pickRecordFormat((m) => MediaRecorder.isTypeSupported(m));
  if (!fmt) { recNotice('Video recording is not supported in this browser'); return; }
  let rec;
  try {
    const stream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...recordTap().getAudioTracks()]);
    rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: recordBitrate(canvas.width, canvas.height), audioBitsPerSecond: 192000 });
  } catch (e) { recNotice('Recording failed'); return; }
  REC.rec = rec; REC.chunks = []; REC.fmt = fmt;
  REC.clock = { startedAt: performance.now(), pausedAt: null, pausedTotal: 0 };
  rec.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  rec.onstop = finishRecord;
  rec.onerror = () => failRecord();
  rec.start(1000);   // a chunk every second
  REC.state = recordNext(REC.state, 'start');
  clearInterval(REC.timer);
  REC.timer = setInterval(() => {
    recPaint();
    if (recordElapsed(REC.clock, performance.now()) >= MAX_SECONDS) { stopRecord(); recNotice('Recording stopped after 10 minutes'); }
  }, 250);
  recPaint();
  recNotice('Recording started');
}
function stopRecord() {
  if (REC.state !== 'recording' && REC.state !== 'paused') return;
  REC.state = recordNext(REC.state, 'stop');
  REC.rec.stop();
}
function finishRecord() {
  const fmt = REC.fmt, chunks = REC.chunks;
  cleanupRecord();
  if (!chunks.length) { recNotice('Recording failed'); return; }
  const url = URL.createObjectURL(new Blob(chunks, { type: fmt.mime.split(';')[0] }));
  const link = document.createElement('a');
  link.href = url; link.download = recordFileName(new Date(), fmt.ext);
  document.body.appendChild(link); link.click(); link.remove();   // the anchor in the document; the URL outlives the click
  setTimeout(() => URL.revokeObjectURL(url), 40000);
  recNotice('Video saved');
}
function failRecord() { cleanupRecord(); recNotice('Recording failed'); }
function cleanupRecord() {
  clearInterval(REC.timer);
  // only the video track: the audio track belongs to the shared recordTap() destination and must stay live
  if (REC.rec && REC.rec.stream) for (const t of REC.rec.stream.getVideoTracks()) t.stop();
  REC.rec = null; REC.chunks = []; REC.fmt = null; REC.clock = null;
  REC.state = recordNext(REC.state, REC.state === 'stopping' ? 'stopped' : 'fail');
  recPaint();
}
function toggleRecord() { if (REC.state === 'idle') startRecord(); else stopRecord(); }
document.addEventListener('visibilitychange', () => {   // a hidden tab draws no frames: hold the recorder, the timer skips it
  if (document.hidden && REC.state === 'recording') {
    REC.rec.pause(); REC.clock.pausedAt = performance.now(); REC.state = recordNext(REC.state, 'pause');
  } else if (!document.hidden && REC.state === 'paused') {
    REC.clock.pausedTotal += performance.now() - REC.clock.pausedAt; REC.clock.pausedAt = null;
    REC.rec.resume(); REC.state = recordNext(REC.state, 'resume');
  }
});
addEventListener('keydown', (e) => {
  const action = recordKeyAction(e);
  if (!action) return;
  e.preventDefault();
  if (action === 'toggle') toggleRecord();
});
recBtn.addEventListener('click', () => { recBtn.blur(); toggleRecord(); });   // blur: a later Space (Pull) must not click the button again
if (devAudio) window.__bsRec = { start: startRecord, stop: stopRecord, state: () => ({ state: REC.state, bytes: REC.chunks.reduce((n, c) => n + c.size, 0) }) };   // ?dev=1: headless checks
```

- [ ] **Step 5: Static checks.** Run `node --test test/*.test.mjs` (must PASS; the audio-bus test still holds) and `grep -n "mob-rec\|rec-msg" index.html` (markup, CSS, controller all present). Confirm by reading that no existing handler reacts to `e.code === 'Backquote'`.

- [ ] **Step 6 (optional, skip if no browser is available): headless check.** Serve the folder (`python3 -m http.server 8123`), open `http://localhost:8123/?dev=1`, call `window.__bsRec.start()`, wait 1.5 s, call `window.__bsRec.stop()` and expect a download named `barrel-blast-*.mp4` or `.webm`. A headless run under a software renderer is slow; do not retry more than once, and say in the PR that it was skipped if it was.

- [ ] **Step 7: Commit.** `git add index.html && git commit -m "feat(record): record the canvas and sound with § or a button (#95)"`

### Task 4: Docs

**Files:** modify `README.md`, `CHANGELOG.md`.

- [ ] **Step 1: README.** In the desktop controls table add a row after **Reset**:

```md
| **Record a video** | `§` key (`` ` `` on a US keyboard) or the ⏺ button in the top bar; press again to stop and save an `.mp4` (or `.webm`) with the game sound. Stops by itself after 10 minutes; pauses while the tab is hidden |
```

In the touch controls table add before **Help**:

```md
| **Record a video** | Tap the ⏺ button in the top bar (it turns red and shows the time); tap again to save the video. On an iPhone or iPad the file is an `.mp4` and goes to Files or the share sheet |
```

- [ ] **Step 2: CHANGELOG.** Under `## [Unreleased]` / `### Added`, as the first entry:

```md
- Video recording: the `§` key (`` ` `` on a US keyboard) or the ⏺ button in the top bar records the scene and the game sound and saves an `.mp4` (or `.webm`) named `barrel-blast-YYYYMMDD-hhmmss`; the button turns red and shows the time while recording, the HUD is not in the video, it pauses while the tab is hidden and stops by itself after 10 minutes (#95)
```

- [ ] **Step 3:** Run `node --test test/*.test.mjs`. Expected: PASS.

- [ ] **Step 4: Commit.** `git add README.md CHANGELOG.md && git commit -m "docs(record): controls and changelog for the video recording (#95)"`
