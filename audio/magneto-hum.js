// Magneto's electric hum (#44): a 50/100 Hz mains hum plus a pulsing, slightly crackling
// buzz. A looping voice like the tire rumble: fades in on start, follows the number of
// held pieces (louder and a bit higher), fades out on stop.
// createMagnetoHum takes the AudioContext, so an OfflineAudioContext can render it too.

export const HUM = {
  baseGain: 0.1,     // master level with nothing held
  extraGain: 0.12,   // added at fullAt held pieces
  fullAt: 12,        // held pieces for the loudest, highest hum
  maxDetune: 200,    // cents, at fullAt
  attackTau: 0.08,   // s, setTargetAtTime time constant
  releaseTau: 0.04,  // s; ~1% after 4.6 tau = 0.18 s
  pulseHz: 7,
};

export function humLevel(held) {
  const f = Math.min(Math.max(held, 0) / HUM.fullAt, 1);
  return { gain: HUM.baseGain + HUM.extraGain * f, detune: HUM.maxDetune * f };
}

function crackleBuffer(ac) {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0);
  let tail = 0;
  for (let i = 0; i < d.length; i++) {
    if (Math.random() < 0.0012) tail = 0.6 + Math.random() * 0.4;
    d[i] = (Math.random() * 2 - 1) * tail;
    tail *= 0.985;   // each spark dies within a few ms
  }
  return buf;
}

function tone(ac, type, freq, level, out) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = level;
  o.connect(g).connect(out);
  return o;
}

// the buzz: a 100 Hz sawtooth through a band-pass, its level pulsing at HUM.pulseHz
function buzz(ac, out) {
  const saw = ac.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 100;
  const band = ac.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 650; band.Q.value = 1.8;
  const g = ac.createGain(); g.gain.value = 0.16;
  const lfo = ac.createOscillator(); lfo.frequency.value = HUM.pulseHz;
  const depth = ac.createGain(); depth.gain.value = 0.12;
  lfo.connect(depth).connect(g.gain);
  saw.connect(band).connect(g).connect(out);
  return { saw, lfo };
}

function crackle(ac, out) {
  const src = ac.createBufferSource(); src.buffer = crackleBuffer(ac); src.loop = true;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
  const g = ac.createGain(); g.gain.value = 0.3;
  src.connect(hp).connect(g).connect(out);
  return src;
}

export function createMagnetoHum(ac, destination) {
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(destination);
  const mains = [tone(ac, 'sine', 50, 0.55, master), tone(ac, 'sine', 100, 0.4, master)];
  const { saw, lfo } = buzz(ac, master);
  const sources = [...mains, saw, lfo, crackle(ac, master)];
  const pitched = [...mains, saw];
  const t0 = ac.currentTime;
  for (const s of sources) s.start(t0);
  master.gain.setTargetAtTime(humLevel(0).gain, t0, HUM.attackTau);
  let stopped = false;
  return {
    setHeld(n) {
      if (stopped) return;
      const t = ac.currentTime, l = humLevel(n);
      master.gain.setTargetAtTime(l.gain, t, HUM.attackTau);
      for (const o of pitched) o.detune.setTargetAtTime(l.detune, t, HUM.attackTau);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ac.currentTime;
      master.gain.setTargetAtTime(0, t, HUM.releaseTau);
      for (const s of sources) s.stop(t + HUM.releaseTau * 6);
    },
  };
}
