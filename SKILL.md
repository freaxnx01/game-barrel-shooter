[//]: # (Source of truth: .ai/base-instructions.md + .ai/stacks/browser-game.md — update those, then regenerate by re-running /sync-ai-instructions)

# SKILL.md — OpenClaw Agent Skill

This skill configures OpenClaw for this project.

# AI Agent Base Instructions

Canonical, **stack-agnostic** reference for all AI coding agents. Applies to every project regardless of language or framework. Stack-specific overlays live in `.ai/stacks/<stack>.md` and are loaded alongside this file. A project loads **base + exactly one stack overlay**. Tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`, `SKILL.md`) derive from base + the chosen stack.

> **Workflow role:** If a `WORKFLOW-ROLE.md` exists at the repo root, read it before continuing — it describes this repo's place in the personal dev workflow (implementer / consumer / workflow infrastructure). See `ai-instructions/workflows/personal-dev-workflow.md` for the workflow doc itself.
>
> **Project context:** If a `PROJECT-OVERVIEW.md` exists at the repo root, read it before continuing — it describes this repo's product/project context (name, purpose, stakeholders, vision, core customer need, key features, architecture in one paragraph). Per-feature PRDs live under `docs/specs/` or `designs/`; ADRs under `docs/adr/`.
>
> **Agent notes:** If an `AGENT-NOTES.md` exists at the repo root, read it before continuing — it holds project-specific agent-facing context that doesn't fit in the regenerated CLAUDE.md: operational gotchas, project-specific commands, repo-local workflow conventions (branch naming, PR conventions, etc.).

---

## Working Method (before any code)

Meta-rules for *how* to approach a task. Framing adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

- **State assumptions explicitly.** If multiple interpretations exist, present them — don't pick silently.
- **Ask when unclear.** Don't hide confusion behind plausible-looking code.
- **Push back when a simpler approach exists.** Minimum code that solves the problem; nothing speculative (no unrequested flexibility, configurability, or error handling for impossible cases).
- **Surgical edits.** Every changed line must trace to the request. Don't "improve" adjacent code, comments, or formatting. Match existing style. Remove orphans *your* change created — leave pre-existing dead code alone (mention it instead).
- **Goal-driven execution.** Restate the task as a verifiable success criterion before starting. For multi-step work, write a brief numbered plan with a `verify:` check per step, then loop until each check passes.

---

## Clean Code Principles

Apply to all generated and modified code, regardless of language:

- **Small methods/functions** — each does one thing at one level of abstraction; aim for ≤20 lines
- **Guard clauses** — validate and return/throw early at the top; avoid nested `if/else` pyramids
- **Command-Query Separation** — a function either performs an action (command, returns nothing) or returns data (query), never both
- **No flag arguments** — avoid boolean parameters that switch behaviour; split into two clearly named functions instead
- **Meaningful names** — names reveal intent; no abbreviations (`cnt`, `mgr`, `svc`) except universally understood ones (`id`, `url`, `dto`)
- **One level of abstraction per function** — don't mix high-level orchestration with low-level detail; extract helpers
- **Fail fast** — detect invalid state as early as possible and throw specific errors; don't let bad data travel deep into the call stack
- **DRY** — if the same logic exists in two places, extract it; but prefer duplication over the wrong abstraction — wait until the pattern is clear before generalising
- **No dead code** — delete unreachable branches, unused parameters, and vestigial methods; git has history
- **No commented-out code blocks** — delete them, git has history

---

## Testing — TDD, Tests First, No Shortcuts

Applies to every language and framework:

1. Write the failing test first
2. Write the minimum implementation to make it pass
3. Refactor
4. **Never modify a test to make it green** — fix the implementation
5. **Never hardcode return values, mock results, or stub logic** to satisfy a test
6. **Never silently swallow exceptions** to make a test green
7. **After implementation, run the full test suite** — not just the new test
8. **If a test fails after 3 attempts, STOP** and explain what's going wrong instead of continuing to iterate
9. Test naming: `MethodName_StateUnderTest_ExpectedBehavior` (or the idiomatic equivalent for the target language)
10. E2E tests must be independent and idempotent — seed and clean up their own data

Framework-specific test project layout, mocking library choice, and assertion library live in the stack overlay.

---

## UI Development Workflow (Mandatory Phase Order)

**Never skip phases. Never write component code before wireframe approval.**

| Phase | Skill | Gate |
|---|---|---|
| 1 — Brainstorm | `/ui-brainstorm` | ASCII wireframe approved |
| 2 — Flow       | `/ui-flow`       | Mermaid diagrams approved |
| 3 — Build      | `/ui-build`      | Shell → logic → interactions → polish |
| 4 — Review     | `/ui-review`     | Checklist passes |

Skill files live in `.ai/skills/`. The skills themselves are stack-neutral — UI component library preferences (e.g. MudBlazor, shadcn/ui, Material, Flutter widgets) are captured in the active stack overlay.

### What to check before writing UI code

- [ ] Does a similar component already exist in a shared folder?
- [ ] Has the ASCII wireframe been approved?
- [ ] Has the Mermaid flow been approved?
- [ ] Are you building the shell first (no business logic yet)?
- [ ] Does the component need a unit/component test?

---

## Localization (i18n) & Regional Formatting

User-facing apps must support **`de` and `en`**. CI tooling and developer-only utilities are exempt.

### Language

- Default language resolved from the OS / browser locale at first launch
- User can override at runtime via an in-app language switcher
- The user's choice is persisted (cookie, preferences store, or user profile — stack-specific)

### Regional formatting (decoupled from language)

Regional formatting (date, time, number, currency separators) is selected from the OS region — **not** dictated by the language.

- Auto-detect any `de-*` OS region (`de-CH`, `de-DE`, `de-AT`, …) and use the matching culture
- If the language is `de` but the OS region is missing or unrecognized: fall back to **`de-CH`**
- For `en`: use the OS-provided region (typically `en-US` / `en-GB`) — do not force a default

### Rules

- All date / number / currency rendering goes through the platform's localization API — never hand-format with raw `string.Format` / `toString()` / template literals.
- Do not couple regional formatting to the UI language. A user can read German text with US formatting, or English text with Swiss formatting; both must work.
- Stack overlays specify the concrete API (`CultureInfo` + `RequestLocalization` for .NET, `flutter_localizations` + `intl` for Flutter, etc.).

---

## Versioning (SemVer)

All projects follow [Semantic Versioning 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH` — `MAJOR` = breaking, `MINOR` = new feature (backwards-compatible), `PATCH` = bug fix.

Conventional Commits mapping: `BREAKING CHANGE:` footer or `!` after type → MAJOR; `feat` → MINOR; `fix`, `perf` → PATCH; `chore`, `docs`, `ci`, `test`, `refactor` → no bump.

- Git tags follow `v<MAJOR>.<MINOR>.<PATCH>` (e.g. `v1.3.0`) — tag on `main` after merge
- Pre-release: `v1.0.0-alpha.1`, `v1.0.0-beta.2`, `v1.0.0-rc.1`
- **git-cliff** is the changelog and release notes tool — configured via `cliff.toml`
- Where the version is declared in the project (build file, manifest, etc.) is defined by the stack overlay — but it must be declared in **exactly one place**

---

## Changelog

All projects maintain a `CHANGELOG.md` in the repo root following [Keep a Changelog](https://keepachangelog.com) conventions. **Sections per release:** `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

- `[Unreleased]` section accumulates changes until a release is cut
- Auto-generation: **git-cliff** with `cliff.toml` configured for Conventional Commits
- CI integration: `orhun/git-cliff-action` in GitHub Actions generates release notes into GitHub Releases
- CI can validate that `[Unreleased]` is not empty before allowing a release branch

Example: [`.ai/references/base/changelog-example.md`](https://github.com/freaxnx01/ai-instructions/blob/main/.ai/references/base/changelog-example.md)

---

## 12-Factor App Compliance

Projects follow the [12-Factor App](https://www.12factor.net/) methodology: one repo per service, all deps declared, env-var config, attached backing services, separate build/release/run stages, stateless processes, port binding, scale via replicas not threads, fast disposability, dev/prod parity, logs to stdout, admin processes as one-offs.

Stack-specific enforcement details (logging library, migrations, etc.) live in the stack overlay.

Full per-factor table: [`.ai/references/base/12-factor.md`](https://github.com/freaxnx01/ai-instructions/blob/main/.ai/references/base/12-factor.md)

---

## Branching Strategy (GitHub Flow + protection rules)

```text
main              ← always deployable, protected
  └── feature/<issue-id>-short-description
  └── fix/<issue-id>-short-description
  └── chore/<short-description>
  └── release/<version>   ← only if needed for staged releases
```

- `main` requires: passing CI, at least 1 PR review, no direct push
- Branch from `main`, PR back to `main`
- Delete branch after merge
- Rebase or squash merge — no merge commits on `main`

Exception: trivial non-code edits (build-script tweaks, comments, docs typos) may skip review and push directly; CI must still pass. Source/runtime-config/CI changes still need a PR.

---

## Git Worktrees

### Worktree directory

- Use **project-local** worktrees under `.worktrees/` at the repo root (hidden directory)
- `.worktrees/` must be listed in `.gitignore` — add and commit it before creating the first worktree in a repo
- Use a **random, short branch name** when the user does not specify one (e.g. `wt/<8-hex-chars>`); do not prompt for a branch name

Agent tooling that automates worktree creation should discover these rules from `CLAUDE.md` / `AGENTS.md` (e.g. a `worktree.*director` grep) and honour them without asking.

---

## Commit Messages (Conventional Commits)

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer: Closes #<issue>]
```

**Types:** `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `ci`, `perf`
**Scope:** module or layer name, e.g. `orders`, `auth`, `infra`, `ui`

```text
feat(orders): add order cancellation endpoint

Implements POST /api/v1/orders/{id}/cancel.
Validates order is in Pending state before cancelling.

Closes #42
```

- Subject line: imperative mood, ≤72 chars, no period
- Body: explain *why*, not *what*
- Breaking changes: add `BREAKING CHANGE:` footer (or `!` after the type)

---

## Pull Request Conventions

### PR Title

Follow Conventional Commits format: `feat(orders): add cancellation endpoint`

### PR Description Template

Body sections: **Summary** · **Changes** · **Testing** (unit, component/integration, E2E, local) · **Checklist** (tests pass, no new vulnerable deps, no secrets, migrations included if schema changed, API/OpenAPI spec still valid).

Template: [`.ai/references/base/pr-description-template.md`](https://github.com/freaxnx01/ai-instructions/blob/main/.ai/references/base/pr-description-template.md)

### Review Guidelines

- PRs should be small and focused — one concern per PR
- Reviewers check: architecture adherence, test quality, security, no shortcuts that make tests green
- Auto-assign reviewers via `CODEOWNERS`

---

## CI/CD (generic outline)

Pipeline stages: `build` → `test` → `security-scan` → `container-build` → `push`

- Build and test run on every PR
- Vulnerable-dependency scan fails the build on HIGH/CRITICAL
- Container image built and pushed only on `main` after tests pass
- E2E tests run against the built image before it is marked as a release candidate

Concrete CI configuration (GitHub Actions YAML, commands, package scanners) lives in the stack overlay.

---

## Documentation Structure

Repo-root `docs/` contains:

- `design/<feature-name>/` — UI wireframes (`wireframe.md`) & Mermaid flows (`flow.md`) per feature
- `adr/` — Architecture Decision Records
- `ai-notes/` — AI agent working notes

Rules:

- `README.md` and `CHANGELOG.md` live in the repo root
- UI design artifacts are saved per feature during the UI workflow phases
- AI agents write working notes to `docs/ai-notes/`, not `.ai/`
- `.ai/` is reserved for agent instructions and skill files only

Layout: [`.ai/references/base/documentation-structure.md`](https://github.com/freaxnx01/ai-instructions/blob/main/.ai/references/base/documentation-structure.md)

---

## Security (baseline)

- Transport security enforced (HTTPS + HSTS)
- No secrets in source files or per-environment config files — environment variables or a secrets manager only
- Validate all inputs at system boundaries before any domain logic
- Run a vulnerable-dependency scan in CI — fail the build on HIGH/CRITICAL findings
- Standard security response headers on every HTTP response

Language- and framework-specific enforcement (specific scanners, validation libraries, header mechanisms) lives in the stack overlay.

---

## Agent Guardrails

- Do not install additional packages without asking first
- Do not change the project's target runtime or framework version
- Do not modify build/project files unless the task requires it
- Do not introduce new architectural patterns unless explicitly asked
- Do not touch files outside the scope of the current task
- Keep changes minimal and focused — do not refactor unrelated code unless asked
- Never skip git hooks (`--no-verify`) unless the user explicitly asks
- Never commit secrets or credential files

Stack-specific guardrails (e.g. "do not add NuGet packages") live in the stack overlay.

---

## Project Scaffold Checklist (baseline)

Init-time checklist (every project, regardless of stack) — including baseline, .NET, and WebAPI layers — lives at [`.ai/references/scaffold-checklists.md`](https://github.com/freaxnx01/ai-instructions/blob/main/.ai/references/scaffold-checklists.md). Stack-specific additions are in the same file under their respective sections.

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
