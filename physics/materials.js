// Material table and contact pairs for the physics backends.
// Values carried over from the original cannon-es ContactMaterial pairs.
// Pure module: no engine, no DOM.

export const DEFAULT_CONTACT = { friction: 0.3, restitution: 0 };

export const MATERIALS = ['ground', 'barrel', 'ball', 'heavy', 'card', 'stone', 'masonry'];

export const CONTACT_PAIRS = [
  ['heavy', 'ground', { friction: 0.6, restitution: 0.15 }],
  ['heavy', 'barrel', { friction: 0.4, restitution: 0.1 }],
  ['ground', 'barrel', { friction: 0.5, restitution: 0.15 }],
  ['barrel', 'barrel', { friction: 0.45, restitution: 0.1 }],
  ['ball', 'ground', { friction: 0.4, restitution: 0.75 }],
  ['ball', 'barrel', { friction: 0.3, restitution: 0.4 }],
  ['card', 'ground', { friction: 0.9, restitution: 0.0 }],
  ['card', 'card', { friction: 0.8, restitution: 0.0 }],
  ['card', 'ball', { friction: 0.4, restitution: 0.1 }],
  ['stone', 'ground', { friction: 0.8, restitution: 0.0 }],
  ['stone', 'stone', { friction: 0.7, restitution: 0.0 }],
  ['stone', 'ball', { friction: 0.4, restitution: 0.2 }],
  ['stone', 'heavy', { friction: 0.5, restitution: 0.05 }],
  // block-built stone buildings: lower friction than 'stone' so a hit can push loaded
  // blocks out of a wall on crashcat (#22)
  ['masonry', 'ground', { friction: 0.45, restitution: 0.0 }],
  ['masonry', 'masonry', { friction: 0.35, restitution: 0.0 }],
  ['masonry', 'ball', { friction: 0.4, restitution: 0.2 }],
  ['masonry', 'heavy', { friction: 0.5, restitution: 0.05 }],
];

const lookup = new Map();
for (const [a, b, c] of CONTACT_PAIRS) {
  lookup.set(key(a, b), c);
}

function key(a, b) {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function contactFor(a, b) {
  return lookup.get(key(a, b)) ?? DEFAULT_CONTACT;
}
