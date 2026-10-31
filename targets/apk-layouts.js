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

export const LAYOUTS = {
  frameTower: () => frameBuilding(3, 6),
  frameBlock: () => frameBuilding(4, 3),
  frameHigh: () => frameBuilding(4, 6),
  frameHall: () => frameBuilding(5, 4),
};
