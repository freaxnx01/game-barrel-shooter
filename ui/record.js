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