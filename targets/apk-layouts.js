// Pure layout module for the APK building targets (#24).
// Each exported function returns an array of boxes:
//   { hx, hy, hz, x, y, z, ry }   // half extents + centre, in base units; ry = yaw in radians
// Buildings are centred on x = 0, z = 0 with the ground at y = 0.
// Spec: docs/superpowers/specs/2026-10-31-apk-buildings-design.md

export const APK_UNIT = 0.25;   // prefab unit (u) -> base units

// mass proportional to volume; addBlock() applies MASONRY_MASS_SCALE afterwards (#22)
export function massFor(box) {
  return 170 * (2 * box.hx) * (2 * box.hy) * (2 * box.hz);
}

const CLR = 0.001;   // horizontal clearance between neighbours (#9)

// ---- Frame buildings ---------------------------------------------------------
// Posts of 1×5×1 on a square grid of pitch 5 u. Each storey: posts, x-beams on
// post tops, z-beams on x-beams. Storey pitch 6 u. Ends with the top beams.
export function frameBuilding(grid, storeys) {
  const pitch = 5, postH = 5, beamH = 0.5, beamD = 1, storeyPitch = 6;
  const half = (grid - 1) / 2;
  const gridPts = [];
  for (let k = 0; k < grid; k++) gridPts.push((k - half) * pitch);   // post centres in u
  const boxes = [];
  const emit = (hx, hy, hz, x, y, z, ry = 0) =>
    boxes.push({ hx: hx * APK_UNIT, hy: hy * APK_UNIT, hz: hz * APK_UNIT, x: x * APK_UNIT, y: y * APK_UNIT, z: z * APK_UNIT, ry });

  // returns [lo, hi] x-extent (in u) of the beam in bay b along an axis
  const bayExtent = (b, last) => {
    let lo, hi;
    const leftEnd = b === 0;
    const rightEnd = b === last;
    if (leftEnd) lo = gridPts[0] - beamD / 2;          // reaches corner post outer face
    else lo = gridPts[b] + CLR;                       // meeting end, shorten
    if (rightEnd) hi = gridPts[last + 1] + beamD / 2;  // reaches corner post outer face
    else hi = gridPts[b + 1] - CLR;                    // meeting end, shorten
    return [lo, hi];
  };

  for (let s = 0; s < storeys; s++) {
    const base = s * storeyPitch;
    // 1. posts
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        emit(beamD / 2, postH / 2, beamD / 2, gridPts[i], base + postH / 2, gridPts[j]);
      }
    }
    // 2. x-beams (run along x), one row per z grid line
    const xBeamY = base + postH + beamH / 2;
    const last = grid - 2;
    for (let j = 0; j < grid; j++) {
      for (let b = 0; b <= last; b++) {
        const [lo, hi] = bayExtent(b, last);
        emit((hi - lo) / 2, beamH / 2, beamD / 2, (lo + hi) / 2, xBeamY, gridPts[j]);
      }
    }
    // 3. z-beams (run along z), one row per x grid line, lying on the x-beams
    const zBeamY = base + postH + beamH + beamH / 2;
    for (let i = 0; i < grid; i++) {
      for (let b = 0; b <= last; b++) {
        const [lo, hi] = bayExtent(b, last);
        emit(beamD / 2, beamH / 2, (hi - lo) / 2, gridPts[i], zBeamY, (lo + hi) / 2);
      }
    }
  }
  return boxes;
}

// ---- Brick boxes ------------------------------------------------------------
// Hollow square towers from bricks 1.9×1×0.95 laid lengthwise along their wall.
// Each course, two opposite walls run full width and own the corners; the other
// two fit between them. The owning pair swaps every course (running bond).
// wallOffset = wall centre-line distance from the axis (u); ownBricks = brick
// count of a corner-owning wall; the inner walls get one fewer.
export function brickBox(wallOffset, ownBricks, courses) {
  const brickL = 1.9, brickH = 1, brickD = 0.95, pitch = 2;
  const rowPitch = brickH + 0.001;
  const centres = (n) => {
    const a = [];
    for (let k = 0; k < n; k++) a.push((k - (n - 1) / 2) * pitch);
    return a;
  };
  const own = centres(ownBricks);
  const inner = centres(ownBricks - 1);
  const boxes = [];
  const emit = (hx, hy, hz, x, y, z, ry) =>
    boxes.push({ hx: hx * APK_UNIT, hy: hy * APK_UNIT, hz: hz * APK_UNIT, x: x * APK_UNIT, y: y * APK_UNIT, z: z * APK_UNIT, ry });
  for (let c = 0; c < courses; c++) {
    const y = brickH / 2 + c * rowPitch;
    const zOwns = c % 2 === 0;   // z-walls own the corners in even courses
    // x-walls run along x at z = ±wallOffset
    const xCentres = zOwns ? inner : own;
    for (const xc of xCentres) {
      for (const zo of [wallOffset, -wallOffset]) {
        emit(brickL / 2, brickH / 2, brickD / 2, xc, y, zo, 0);
      }
    }
    // z-walls run along z at x = ±wallOffset (rotated so the long side lies along z)
    const zCentres = zOwns ? own : inner;
    for (const zc of zCentres) {
      for (const xo of [wallOffset, -wallOffset]) {
        emit(brickL / 2, brickH / 2, brickD / 2, xo, y, zc, Math.PI / 2);
      }
    }
  }
  return boxes;
}

// ---- Spirals ----------------------------------------------------------------
// Wendeltreppe: treads spiral up at 30° pitch with the inner ends stacking into
// a central column; a post under each tread i>=1 stands on the ground (i<=11)
// or on tread i-12 one turn below (i>=12), forming the outer ring of posts.
export function spiralStair(treads) {
  const treadRadial = 10, treadTang = 2, treadH = 1;
  const treadR = 4, postR = 8, postSize = 1;
  const step = Math.PI / 6;   // 30°
  const boxes = [];
  const emit = (hx, hy, hz, x, y, z, ry) =>
    boxes.push({ hx: hx * APK_UNIT, hy: hy * APK_UNIT, hz: hz * APK_UNIT, x: x * APK_UNIT, y: y * APK_UNIT, z: z * APK_UNIT, ry });
  for (let i = 0; i < treads; i++) {
    const a = i * step;
    const ca = Math.cos(a), sa = Math.sin(a);
    // tread: radial 10 along local x, tangential 2 along local z, yaw -a
    emit(treadRadial / 2, treadH / 2, treadTang / 2, treadR * ca, i + treadH / 2, treadR * sa, -a);
    if (i >= 1) {
      const full = i <= 11;            // i=11..35 use the constant 11-height form
      const h = full ? i : 11;
      const bottom = full ? 0 : i - 11;
      emit(postSize / 2, h / 2, postSize / 2, postR * ca, bottom + h / 2, postR * sa, 0);
    }
  }
  return boxes;
}

export const LAYOUTS = {
  frameTower: () => frameBuilding(3, 6),
  frameBlock: () => frameBuilding(4, 3),
  frameHigh: () => frameBuilding(4, 6),
  frameHall: () => frameBuilding(5, 4),
  brickBox: () => brickBox(4.5, 5, 16),
  brickTower: () => brickBox(3.5, 4, 14),
  spiral: () => spiralStair(36),
  spiralTower: () => spiralStair(48),
};
