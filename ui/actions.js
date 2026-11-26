// Which #act-bar buttons apply right now (#63). Quake is mobile-only; on desktop Shift does it.
import { CHARGE } from '../weapons/charges.js';
export const CUT_KEY = 'o';   // desktop key for "cut the rope"

export function visibleActions({ tethered, armed, mobile }) {
  return {
    quake: Boolean(mobile),
    pull: Boolean(tethered),
    cut: Boolean(tethered),
    boom: armed > 0,
  };
}

// The number buttons to show (#79): the armed charges' numbers, valid ones only, sorted, no duplicates.
export function shownNumbers(numbers) {
  return [...new Set(numbers)].filter((n) => Number.isInteger(n) && n >= 1 && n <= CHARGE.maxRemote).sort((a, b) => a - b);
}

// The number row shows while the toggle is open and at least one charge is armed (#79).
export function numberRowShown(open, count) {
  return Boolean(open) && count > 0;
}
