// Which #act-bar buttons apply right now (#63). Quake is mobile-only; on desktop Shift does it.
export const CUT_KEY = 'o';   // desktop key for "cut the rope"

export function visibleActions({ tethered, armed, mobile }) {
  return {
    quake: Boolean(mobile),
    pull: Boolean(tethered),
    cut: Boolean(tethered),
    boom: armed > 0,
  };
}
