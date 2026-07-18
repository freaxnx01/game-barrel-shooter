[//]: # (Stack overlay — loaded together with .ai/base-instructions.md for buildless browser-game projects)

# Browser Game Stack Overlay

Applies on top of `.ai/base-instructions.md` for **`game-*`** repos: vanilla
HTML/CSS/JS browser games shipped as static GitHub Pages, served at
`https://github.freaxnx01.ch/game-<name>/`, with **no build step to ship**.

Use this stack for repos like `game-space-invaders`, `game-kick-fury`, and
`game-tank-toys` — the deliverable is the static site itself, not a compiled
artifact.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript — ES modules (`<script type="module">`) or a classic script; no framework |
| Markup | Semantic HTML5 |
| Styling | Modern CSS — custom properties, Grid/Flexbox; no CSS framework required |
| Rendering | `<canvas>` (2D or WebGL) + `requestAnimationFrame`; DOM/SVG for non-canvas games |
| Audio | Web Audio API / `<audio>` |
| Multiplayer | Manual WebRTC (`RTCPeerConnection` + data channel) — **no signaling server, PeerJS, or Firebase** |
| Persistence | `localStorage` |
| Hosting | GitHub Pages, static, served from repo-root `index.html` |
| Build | **None required.** A few games use a source→`index.html` bundler (dc-tool) — see Project Structure |
| Versioning | Git tag `vX.Y.Z` (authoritative) + `version.js` display mirror |
| Changelog | `git-cliff` + `cliff.toml` (base tooling) |
| Lint / format | Optional `npx prettier` / `npx eslint`; nothing committed |

---

## Project Structure

Layout varies by game complexity — do not force one shape onto all three.

```text
# Minimal (most games)
index.html              ← the whole game (inline <style> + <script>)
README.md  LICENSE

# Richer / P2P game
index.html              ← markup + boot
game.js  (or *-game.js) ← game logic (classic script or ES module)
version.js              ← VERSION mirror (see Versioning)
style.css               ← if split out
assets/                 ← sprites, audio
vendor/                 ← third-party libs vendored (no npm)
CHANGELOG.md  cliff.toml  README.md  LICENSE

# Bundled game (dc-tool)
source/ or *.dc.html    ← EDIT THIS
index.html  support.js  ← GENERATED — do not hand-edit
```

A bundled game is identified by a `data-dc-script` / `type="text/x-dc"` marker
in `index.html`. For those repos, always edit the source and re-bundle — never
hand-edit the generated `index.html` or `support.js`.

---

## JavaScript Conventions

- Prefer **ES modules** (`<script type="module">`) once a game spans more than
  one file; a genuinely single-file game may use one inline `<script>`.
- `const`/`let` only — no `var`.
- Don't leak game internals onto `window`. The one deliberate exception is the
  `version.js` global for non-module (classic-script) games.
- Separate **state**, **render**, and **input** — a render function reads
  state, it never mutates it; input handlers write to state, they never draw.
- Small, pure update functions. Base Clean Code rules apply (small functions,
  guard clauses, no flag arguments) — see base, not restated here.
- No framework, no jQuery.

---

## Game Loop

- **Fixed-timestep simulation, variable-rate render:** an accumulator
  advances the simulation in fixed `deltaTime` steps inside a
  `requestAnimationFrame` callback, so gameplay is independent of frame rate.
- Pause/resume the loop on `document.visibilitychange` — never keep simulating
  a backgrounded tab.
- Sample input into a plain state object (keys/pointer down-state); never
  mutate simulation state directly from an event handler.
- When P2P lockstep is used (see below), the simulation step must be
  **deterministic** — same inputs in the same order produce the same state on
  both peers.

---

## P2P Multiplayer (house pattern)

Manual WebRTC, no infrastructure:

- One peer creates an SDP **offer**, the other creates the **answer**; the two
  are exchanged by the players themselves (copy-paste, or a short displayed
  code) — **no signaling server, no PeerJS, no Firebase**.
- One `RTCDataChannel` carries all game messages.
- **Validate every inbound data-channel message** before applying it — never
  `eval` it, never trust the peer for authority-critical state. Use a
  host-authoritative model or deterministic lockstep, not "peer says so."
- Handle `connectionstatechange` to detect disconnects gracefully and offer a
  rematch/reconnect flow rather than hanging.
- Reference implementations: `game-tank-toys`, `game-kick-fury`.

---

## Versioning (stack binding)

Base SemVer/Conventional-Commits/`git-cliff` rules live in
`base-instructions.md`. For this stack:

- The **git tag `vX.Y.Z` on `main` is the single source of truth.**
  `version.js` is a **display mirror**, never a competing source — it is
  bumped by hand at release time to match the tag, and is rendered as a small
  `vX.Y.Z` badge somewhere in the UI (menu, footer, or about screen).

```js
// version.js — ES-module game
export const VERSION = "1.0.0"; // must equal the latest git tag vX.Y.Z

// version.js — classic-script game (no modules); load BEFORE the game script
window.GAME_VERSION = "1.0.0";  // must equal the latest git tag vX.Y.Z
```

Release flow:

```bash
# 1. bump version.js to the new X.Y.Z
# 2. commit
git commit -am "chore(release): v1.2.0"
# 3. tag on main (authoritative)
git tag v1.2.0
# 4. regenerate changelog from Conventional Commits
git cliff --tag v1.2.0 -o CHANGELOG.md
git commit -am "docs(changelog): v1.2.0"
git push --follow-tags
```

Do **not** add a second version source (no simultaneous `<meta name="version">`
tag, JSON file, and a second const). The tag is truth; `version.js` mirrors it.

---

## Changelog

Adopt base as-is: `CHANGELOG.md` (Keep a Changelog) with an `[Unreleased]`
section, `cliff.toml` using the Conventional Commits preset, and optionally
`orhun/git-cliff-action` to populate GitHub Release notes. Nothing
stack-specific beyond what base already defines.

---

## Tooling & Testing

This stack is **buildless** — there is no build/test toolchain to ship, so a
disciplined **manual in-browser playtest is the test gate**. This is a
deliberate, documented deviation from base's TDD-first mandate, made because
there is no compiler/bundler/test-runner in the deliverable to justify one.

Manual verification checklist before every push/release:

- [ ] Page loads with an empty console (no errors/warnings)
- [ ] Canvas/DOM renders the initial frame correctly
- [ ] Core loop responds to input (movement, actions, pause)
- [ ] `localStorage` state persists across a reload
- [ ] P2P: both peers connect, exchange state, and the game survives a
      disconnect/reconnect

Optional, nothing committed: `npx prettier --write .`, `npx eslint .`.

---

## Localization (i18n)

Base's `de`/`en` rule applies to games with meaningful UI text (menus, HUD
copy, quiz questions). Lightweight vanilla pattern:

- A `strings` object keyed by locale (`{ en: {...}, de: {...} }`)
- Detect the initial language from `navigator.language`
- Provide a switcher; persist the choice in `localStorage`

**Carve-out:** pure-arcade games with negligible on-screen text (a score and a
"GAME OVER") may defer i18n. Text-heavy games (quizzes, dialog-driven games)
must comply.

---

## Games Hub Integration

Each game gets a card in `freaxnx01.github.io/games/index.html` — that repo,
not this one. Screenshots are generated by that repo's
`scripts/capture_screenshots.py`. New releases get the `NEW` tag on the card
per that repo's convention. Do not duplicate hub markup or screenshot tooling
inside a game repo.

---

## Security

- Client-side JS is fully public — never embed API keys, tokens, or secrets in
  it, even "obfuscated."
- Validate WebRTC data-channel and `postMessage` input at the boundary before
  it reaches game logic (see P2P Multiplayer).
- External resources (web fonts, CDN scripts, GitHub Pages badges/buttons) are
  loaded over HTTPS only.
- Never `eval` or `new Function` on remote or peer-supplied content.

---

## Essential Commands

```bash
# Serve locally (buildless)
python3 -m http.server 8000        # then open http://localhost:8000/
# or just open index.html in a browser

# Optional lint/format (nothing committed)
npx prettier --write .
npx eslint .

# Release (see Versioning)
git tag v1.2.0 && git cliff --tag v1.2.0 -o CHANGELOG.md

# Regenerate hub screenshot (run in the freaxnx01.github.io repo)
python3 scripts/capture_screenshots.py
```

---

## Project Scaffold Checklist (browser-game)

- [ ] `index.html` served at repo root
- [ ] `version.js` with the version constant/global, matching the latest tag
- [ ] Version badge wired into the UI (menu/footer/about)
- [ ] `CHANGELOG.md` with `[Unreleased]` section
- [ ] `cliff.toml` for `git-cliff`
- [ ] `.gitignore` includes `.worktrees/`
- [ ] `README.md`
- [ ] `LICENSE`
- [ ] Hub card added in `freaxnx01.github.io/games/index.html`
- [ ] `CLAUDE.md` / `SKILL.md` / `.github/copilot-instructions.md` synced from
      base + this overlay
- [ ] Branch protection on `main`

---

## Agent Guardrails (stack-specific)

In addition to the base guardrails:

- Do not add a framework, bundler, `package.json`, or committed
  `node_modules` without asking.
- Do not introduce a signaling server or a P2P library (PeerJS, Firebase).
- Keep the game shippable as static files — no server-side runtime.
- Keep `version.js` equal to the latest git tag; never let it drift.
- Never hand-edit a bundled game's generated `index.html`/`support.js` — edit
  the source and re-bundle.
- Don't embed secrets in client JS.

### Never generate (this stack)

- Framework imports (React, Vue, Angular, Svelte, jQuery)
- A bundler, `package.json`, or `node_modules` committed into a game repo
- Secrets or API keys in client JS
- A second, competing version source alongside `version.js`/the git tag
- PeerJS/Firebase/signaling-server-based P2P
- `eval` / `new Function` on peer or remote input
- Commented-out code blocks
- A hand-edited generated bundle (`index.html`/`support.js` in a dc-tool repo)
