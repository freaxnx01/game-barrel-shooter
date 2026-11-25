// Which list sheet is open: null, 'ammo' or 'target' (#61).
export function sheetAfter(open, event) {
  switch (event) {
    case 'open-ammo': return 'ammo';
    case 'open-target': return 'target';
    case 'backdrop':
    case 'pick':
    case 'escape':
    case 'layout-change': return null;
    default: return open;
  }
}
