// Paintball colours (#54): the palette, the picker cycle and the per-shot colour.
// No engine, no DOM. Index 0 keeps the original red.

export const PAINT_COLORS = [
  { name: 'Red', ball: '#e23b3b', splat: '#d62828' },
  { name: 'Orange', ball: '#f28c28', splat: '#d9731a' },
  { name: 'Yellow', ball: '#f2d02b', splat: '#d6b41c' },
  { name: 'Green', ball: '#3bb54a', splat: '#2e9a3c' },
  { name: 'Blue', ball: '#2f7de1', splat: '#2266c2' },
  { name: 'Purple', ball: '#9b4fd1', splat: '#8038b8' },
  { name: 'Pink', ball: '#ff5fa2', splat: '#e2448a' },
];

export const RANDOM_PAINT = 'random';

export function nextPaintChoice(choice) {
  if (choice === RANDOM_PAINT) return 0;
  return choice + 1 < PAINT_COLORS.length ? choice + 1 : RANDOM_PAINT;
}

// Random mode: uniform over the colours other than the previous shot's.
export function paintIndexForShot(choice, prevIndex, rng) {
  if (choice !== RANDOM_PAINT) return choice;
  const n = PAINT_COLORS.length;
  if (prevIndex === null) return Math.floor(rng() * n);
  const k = Math.floor(rng() * (n - 1));
  return k >= prevIndex ? k + 1 : k;
}

// The dot on the weapon button while paintball is selected (#81).
export function paintDotInfo(choice) {
  const random = choice === RANDOM_PAINT;
  const label = random ? 'Random' : PAINT_COLORS[choice].name;
  return {
    color: random ? null : PAINT_COLORS[choice].ball,
    glyph: random ? '🎲' : '',
    label,
    title: `Paint colour: ${label}, click to change`,
  };
}