# Paintball colour picker stays visible (#81) - design

## Problem

Since #61 the weapon list is a collapsed sheet on every screen size. The paint swatches (`#paint-colors`) sit under the Paintball button and only show once paintball is selected, but selecting a weapon closes the sheet, so nobody sees them. Only the `P` key (a second press cycles the colour) reaches the colours.

## Decided behaviour (from the issue)

1. Picking Paintball keeps the weapon sheet open, so the swatches show right away. Picking a swatch, the backdrop or Escape closes it.
2. The 💥 weapon button shows the current paint colour as a dot (🎲 for random) while paintball is selected. Clicking the dot cycles the colour like the `P` key, without opening the sheet.
3. Same on desktop and mobile.

## Design

- `ui/sheet.js`: new event `'pick-keep-open'`: the sheet stays as it is. `'pick'` still closes.
- `weapons/paintball.js`: new pure helper `paintDotInfo(choice)` returning `{ color, glyph, label, title }` for the dot (colour from `PAINT_COLORS[choice].ball`, `🎲` and `color: null` for random).
- `index.html`:
  - New `<button id="mob-paint" hidden>` in `#mob-bar`, right after `#mob-weapon`. A sibling, not a child: a button inside a button is invalid HTML and a click would bubble into the weapon button.
  - `syncPaintDot()` shows or hides it and sets colour, glyph, `title` and `aria-label`. Called from `setPaintChoice` and `setAmmo`.
  - Dot click: `setPaintChoice(nextPaintChoice(paintChoice))`, ignored while `autoPlay` (same as swatches).
  - Sheet click handler: a swatch click sends `'pick'` (close); the Paintball button sends `'pick-keep-open'`; every other button sends `'pick'`. The swatch handler on `#paint-colors` runs first (bubbling), so the colour is set before the sheet closes. Swatches have no `data-type`, so `setAmmo` is not triggered.

## Out of scope

Hint text wording, other weapons with options, the #78 charges work.

## Testing

`node --test test/*.test.mjs`: reducer cases for `'pick-keep-open'`, and `paintDotInfo` for every colour and for random. The DOM wiring is small and checked by reading; no browser run is required.

## Risks

- #78 (charges) may land first and touch other parts of `index.html`; the plan refers to function names, not line numbers.
- Narrow phones: the extra dot widens `#mob-bar` by about 34 px; the bar is `display:flex` with a right limit, so it must stay inside it (the dot is small, `max-width` rules unchanged).
