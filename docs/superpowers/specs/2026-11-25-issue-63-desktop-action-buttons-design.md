# Issue #63: desktop action buttons for Pull, Cut rope and Boom

## Problem

`#act-bar` (Quake, Pull, Boom; `index.html:258-262`) exists only in mobile mode. On desktop, reeling in a harpoon or net is "hold Space" (hint at `index.html:250`) and detonating remote charges is K. There is no way to release a tether at all: `detachHarpoon` / `detachNet` (`index.html:~2123`, `~2155`) are internal. Playtest feedback: a clear Pull button, a way to cut the rope, and a trigger button for remote charges.

## Design

- **One bar, both layouts.** `#act-bar` is shown on desktop too. Its base styles move out of the mobile media query; the mobile block keeps only its placement overrides (bottom left, `touch-action`). Desktop placement: bottom right, above the camera pad (`right: 20px; bottom: 190px`), clear of the aim area in the middle and of the bottom-left corner.
- **Four buttons, each shown only while it applies.** Pure logic in `ui/actions.js`: `visibleActions({ tethered, armed, mobile })` returns `{ quake, pull, cut, boom }`:
  - `pull` and `cut`: while a harpoon or net tether exists (`harpoonLink || netLink`).
  - `boom`: while at least one remote charge is armed.
  - `quake`: mobile mode only. On desktop Shift is easy to hold and a permanent button would only add clutter.
- **Cut.** New action `cutTether()`: calls `detachHarpoon()` and `detachNet()` and clears `pulling`. The embedded harpoon is then culled normally. Button `#act-cut` (✂️ Cut). It works on mobile too (same bar). Desktop key: `O` ("cut the rope"), exported as `CUT_KEY` from `ui/actions.js`. Letters taken today: all of 1-9/0, S P L U M G H E D A C T J X V Q F B Z K N R; `O` is free. Ignored during auto-play like the other keys.
- **Single source of visibility.** One `syncActionBar()` replaces the scattered `pullBtn.hidden` writes (`syncPullButton`, `index.html:2100`) and the per-frame `boomBtn.hidden` toggle (`index.html:~3187`). It runs on tether change, every frame (cheap, writes only on change) and on the mobile query `change`.
- **Existing inputs unchanged:** Space (hold) pulls, K detonates, Shift quakes.
- **Hint and docs:** the desktop hint names the buttons and `O`; the mobile hint gains Cut. README and CHANGELOG updated.

## Ordering

Runs after #61 (desktop collapsed menus), which edits the same CSS area (the mobile-mode block and the `#mob-bar` rules). This plan only touches the `#act-bar` rules and does not depend on #61's markup. If #61 already moved shared button styles, the duplicate `#act-bar button` look is harmless.

## Out of scope

Rope-cut animation or sound, a cut for other weapons (chain-based wrecking ball), #52.

## Testing

- Unit: `test/actions.test.mjs` for `visibleActions` and `CUT_KEY`.
- One Playwright screenshot check at 1280×720 and 390×844 with a harpoon attached and a remote charge armed (set up by calling the game's own functions through the page where reachable, else by firing).
