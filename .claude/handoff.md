Resume: implement issue freaxnx01/game-barrel-shooter#3 ("Auto-play CPU mode:
Basketball → Barrels, minimize shots").

Spec is written, approved (user said "lgtm"), committed and pushed as
`docs/superpowers/specs/2026-07-26-auto-play-cpu-mode-design.md` (commit
`2fbdc54` on `main`). This is a `/gh:enrich` run — this is a spec-only repo, no
implementation plan exists yet.

Next step: invoke **superpowers:writing-plans** using that spec file to produce
the task-by-task implementation plan at
`docs/superpowers/plans/2026-07-26-auto-play-cpu-mode.md`, commit + push it, then
continue `/gh:enrich`'s remaining steps — update issue #3's body (Acceptance
Criteria + the full plan content inlined verbatim, per the updated `gh:enrich`
command) and confirm it's ready for `/gh:implement`.

For any implementation work (not this planning phase), use
`superpowers:subagent-driven-development` per my default.
