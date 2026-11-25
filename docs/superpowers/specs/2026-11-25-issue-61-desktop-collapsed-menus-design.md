# Issue #61: collapse the weapon and target menus on desktop too

## Problem

On desktop the weapon list (`.ammo`, `index.html:60`, fixed bottom left) and the target list (`.target`, top right) are always open. The weapon panel covers the foot of the chimney (#58), so the player cannot aim there. Mobile mode (`@media (max-width: 900px), (pointer: coarse)`, `index.html:110` onward) already collapses both lists into the `#mob-bar` buttons 🎯 and 💥 and opens them as a sheet over `#sheet-backdrop`. Decided in triage: do the same on desktop.

## Design

One collapsed-menu behaviour for every screen size; mobile keeps its own size tweaks.

- **CSS split.** The "lists become sheets" rules (`.ammo, .target {display:none}`, `#sheet-backdrop.open`, `.ammo.open`, `.target.open`, the `#mob-bar button` look, `#mob-bar` itself) move out of the mobile media query into a new block "Collapsed menus (#61)" placed just before the mobile block. The mobile block keeps only its overrides: full-width sheet geometry, hidden key letters in the sheet, small `#mob-bar` placement, the `?` button.
- **Desktop placement.** `#mob-bar` sits top left under the score (`top: 116px; left: 22px`), content-sized, buttons capped at 170px. The desktop hint moves down to `top: 164px` so the two do not overlap. The desktop sheet is a centered panel, `width: min(900px, 100% - 16px)`, top 8px. Key letters stay visible in the desktop sheet (they teach the shortcuts).
- **Desktop chrome.** `#mob-help` stays mobile-only (the desktop hint is always visible). `#mob-jenga-shoot` stays mobile-only (desktop has `#jenga-shoot`). `.ammo` no longer occupies the bottom left, so the chimney foot is free.
- **Open and close.** The state machine moves into a tiny pure module `ui/sheet.js`: `sheetAfter(open, event)` with events `open-ammo`, `open-target`, `backdrop`, `pick`, `escape`, `layout-change`. `index.html` keeps one `sheetOpen` variable and one `applySheet(event)` that toggles the `open` classes. New on desktop and mobile: Escape closes the sheet.
- **Keyboard shortcuts** are untouched. They still select weapons and targets while the sheet is closed. While a sheet is open, pressing a weapon key still selects it and the button label updates (the existing MutationObserver), the sheet stays open until pick, Escape or backdrop.

## Out of scope

#52 (footer covers the Sniper lens button), the action buttons (#63, runs after this issue), any physics or camera change.

## Testing

- Unit: `test/sheet.test.mjs` for the reducer.
- One Playwright screenshot check at 1280×720 and 390×844: collapsed state, weapon sheet open, chimney foot visible.
