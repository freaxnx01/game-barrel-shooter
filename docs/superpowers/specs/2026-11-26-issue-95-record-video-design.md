# Record a video of the game (#95) Design

## Problem

Barrel Blast has no way to record a clip of a run. Rhyflitzer has one (`game-rhyflitzer` #749, with the #891 audio fix): a key or button starts a `MediaRecorder` over the canvas plus the game sound, a second press saves an `.mp4` or `.webm`. Barrel Blast gets the same, adapted to its single-file `index.html` and its sound code.

## Reference

`game-rhyflitzer`: `docs/superpowers/specs/2026-11-11-record-video-design.md`, `2026-11-11-record-start-music-dropout-design.md`, `record.js`, `tests/record.test.mjs` and the "video recording (#749)" block in its `index.html`. Read only.

## Design

### Pure rules: `ui/record.js`

A copy of Rhyflitzer's `record.js` with two changes: the file-name prefix is `barrel-blast` and the comments no longer cite Rhyflitzer issue numbers. It exports `RECORD_KEY` (`'Backquote'`), `MAX_SECONDS` (600), `FORMATS` (Opus-before-AAC order from #891), `pickRecordFormat`, `recordFileName`, `recordBitrate`, `recordKeyAction`, `recordNext`, `recordElapsed`, `formatClock`. No DOM, no three.js. Tests: `test/record.test.mjs`.

### Picture

The three.js canvas `#c` (`const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })`). It has no `preserveDrawingBuffer`; `canvas.captureStream(60)` still works on it, because the stream samples the composited canvas, not a `readPixels` copy (Rhyflitzer records its renderer the same way, also without `preserveDrawingBuffer`). The HUD, the buttons and the message element are DOM, so they are never in the video. The 2D sniper scope (#91) is drawn into the same canvas, so it is in the video when visible.

### Sound: one master bus

Today every sound connects straight to `ac.destination` (11 sites, listed in the plan). `ctx()` gets one gain node, `ac.sfxOut` (gain 1, connected to `ac.destination`), and every site connects to `ac.sfxOut` instead. This is behaviour-neutral. `recordTap()` creates, on the first recording, a `MediaStreamAudioDestinationNode` and connects `ac.sfxOut` to it as a second output; the speakers are unaffected. The audio track is shared and never stopped (a stopped track does not restart); only the video track is stopped after a recording.

### Controls

- **Key:** `Backquote` (`§` on a Swiss keyboard, `` ` `` on US). It is free: the existing keydown handlers read `e.key.toLowerCase()` for letters, digits, arrows, `r`, `k`, `o`, space and Shift; none of them uses the backquote key or `e.code`. A new, separate `keydown` listener handles it through `recordKeyAction`. A held key is ignored (no flicker); a held modifier makes it a no-op.
- **Button:** `#mob-rec` in `#mob-bar`, after `#mob-paint` and `#mob-jenga-shoot` and before `#mob-help`. `#mob-bar` is shown on desktop (top left under the score, next to 🎯 and 💥) and on mobile (all three layouts), so one button serves mouse and touch. Idle it shows `⏺`; while recording it turns red and shows `● m:ss` (the clock from `formatClock(recordElapsed(...))`, refreshed every 250 ms). Clicking it toggles the recording. After a click it blurs, so a later Space (Pull) does not click it again.
- **Messages:** Barrel Blast has no toast. A small `#rec-msg` element (`role="status"`, bottom centre, hidden by default) shows one line for 3.5 s: "Recording started", "Video saved", "Recording stopped after 10 minutes", "Video recording is not supported in this browser", "Recording failed".

### Pause

There is no pause menu in the game. The only hold is a hidden tab: `requestAnimationFrame` stops, so the canvas delivers no frames. On `visibilitychange` to hidden the recorder pauses (`rec.pause()`, clock `pausedAt`), on visible it resumes. The timer skips the pause (`recordElapsed`).

### Limit and formats

The recording stops by itself after `MAX_SECONDS` = 600 s (chunks live in RAM) and shows the 10-minute message. `rec.start(1000)` makes a chunk per second. Bitrate 12 Mbit/s up to 1080p pixels, 20 Mbit/s above, audio 192 kbit/s.

iOS Safari: `MediaRecorder` exists from iOS 14.3 and records `video/mp4` only (no webm); `pickRecordFormat` reaches the plain `video/mp4` entry there. A browser without `MediaRecorder` gets the "not supported" message and no state change. The `mp4` download uses a hidden anchor with `download`; on iOS the file lands in Files or the share sheet, not in Photos.

### Test hook

With `?dev=1` (the existing `devAudio` switch), `window.__bsRec = { start, stop, state }` lets a headless check record about 1 s and see the download. Absent without `?dev=1`.

## Out of scope

Pausing on a pause menu (none exists), Rhyflitzer's camera-path record, per-weapon sound mixing, a master volume or mute control (the bus makes one possible later).

## Acceptance

See issue #95. Unit tests for `ui/record.js` and a source guard that `ctx()` holds the only `.destination` in `index.html`.
