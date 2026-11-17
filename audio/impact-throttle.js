// Anti-cacophony rules for target impact sounds (#44).
// Pure module: no Web Audio, no DOM. The game asks admit() for every target contact;
// it says whether a voice may play, how loud, and which running voice to cut.

// impactSpeed is the relative normal speed of a new contact in m/s (physics/backend-crashcat.js).
// minSpeed keeps settling contacts and sleep/wake jitter silent; fullSpeed is a hard hit.
// A freshly built barrel pyramid settles its rows at up to ~1.3 m/s, hence 1.6 for barrels.
export const IMPACT = {
  cooldownMs: 120,  // per body
  maxVoices: 8,     // impact voices at once
  minVolume: 0.12,  // a contact just over the threshold is still audible
  kinds: {
    metal: { minSpeed: 1.6, fullSpeed: 8, voiceMs: 450 },  // oil barrels
    wood: { minSpeed: 1.6, fullSpeed: 7, voiceMs: 220 },   // wooden barrels, Jenga, matchsticks
    stone: { minSpeed: 1.5, fullSpeed: 9, voiceMs: 380 },  // stone and masonry buildings
    pin: { minSpeed: 1.0, fullSpeed: 6, voiceMs: 200 },    // bowling pins
    card: { minSpeed: 0.8, fullSpeed: 4, voiceMs: 160 },   // house of cards
  },
};

function kindOf(kind) {
  const k = IMPACT.kinds[kind];
  if (!k) throw new Error('unknown impact kind: ' + kind);
  return k;
}

// 0 below the kind's threshold, else minVolume..1 rising linearly up to fullSpeed.
export function impactVolume(kind, speed) {
  const { minSpeed, fullSpeed } = kindOf(kind);
  const s = Math.abs(speed);
  if (s < minSpeed) return 0;
  const t = Math.min((s - minSpeed) / (fullSpeed - minSpeed), 1);
  return IMPACT.minVolume + (1 - IMPACT.minVolume) * t;
}

export function createImpactThrottle() {
  const lastHit = new Map();  // body key → ms of its last sounding contact
  let voices = [];            // { id, volume, start, end }
  let nextId = 1;

  function coolingDown(key, now) {
    const t = lastHit.get(key);
    return t !== undefined && now - t < IMPACT.cooldownMs;
  }

  function expire(now) {
    voices = voices.filter(v => v.end > now);
  }

  // quietest voice; the oldest of equally quiet ones
  function weakestVoice() {
    let w = voices[0];
    for (const v of voices) if (v.volume < w.volume || (v.volume === w.volume && v.start < w.start)) w = v;
    return w;
  }

  // Decides one contact of body `key`. Returns null (stay silent) or
  // { id, volume, evict } where evict is the id of a running voice to cut, or null.
  // `partner` (the other target in the contact) cools down too, so a contact between two
  // targets, which reaches both of their callbacks, sounds once.
  function admit(key, kind, speed, now, partner) {
    const volume = impactVolume(kind, speed);
    if (volume === 0 || coolingDown(key, now)) return null;
    expire(now);
    let evict = null;
    if (voices.length >= IMPACT.maxVoices) {
      const weakest = weakestVoice();
      if (weakest.volume >= volume) return null;
      evict = weakest.id;
      voices = voices.filter(v => v !== weakest);
    }
    const id = nextId++;
    voices.push({ id, volume, start: now, end: now + IMPACT.kinds[kind].voiceMs });
    lastHit.set(key, now);
    if (partner !== undefined) lastHit.set(partner, now);
    return { id, volume, evict };
  }

  function activeCount(now) {
    return voices.filter(v => v.end > now).length;
  }

  function reset() {
    lastHit.clear();
    voices = [];
  }

  return { admit, activeCount, reset };
}
