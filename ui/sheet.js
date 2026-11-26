// Which list sheet is open: null, 'ammo' or 'target' (#61).
export function sheetAfter(open, event) {
  switch (event) {
    case 'open-ammo': return 'ammo';
    case 'open-target': return 'target';
    case 'backdrop':
    case 'pick':
    case 'escape':
    case 'layout-change': return null;
    case 'pick-keep-open': return open;   // paintball: the swatches stay in view (#81)
    default: return open;
  }
}
