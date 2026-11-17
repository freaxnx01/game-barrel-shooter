// Surface points of a prolate spheroid (long axis along local +Y) for the
// backend's 'spheroid' shape kind, which wraps them in a convex hull (#45).
// Pure module: no engine, no DOM.

export function spheroidPoints(halfLength, radius, rings = 9, segments = 12) {
  if (!(halfLength > 0) || !(radius > 0)) throw new Error('spheroid needs a positive halfLength and radius');
  const out = [0, halfLength, 0, 0, -halfLength, 0];
  for (let i = 1; i <= rings; i++) {
    const polar = (Math.PI * i) / (rings + 1);
    const y = halfLength * Math.cos(polar);
    const ring = radius * Math.sin(polar);
    for (let j = 0; j < segments; j++) {
      const a = (2 * Math.PI * j) / segments;
      out.push(ring * Math.cos(a), y, ring * Math.sin(a));
    }
  }
  return out;
}
