# CLAUDE.md

Guidance for Claude Code. The shared instructions for all AI tools live in `AGENTS.md`. Edit that
file, not this one, so Kiro, Claude Code and other tools stay in sync.

@AGENTS.md
@docs/ENGINEERING.md

## Claude Code notes

- **After every change, run the `verify-site` skill (`.claude/skills/verify-site/`) before
  reporting it as done, committing or merging.** New user-visible features get a test in `web/e2e/`.
- On Windows, virtualenv binaries are in `.venv\Scripts\` (for example `.venv\Scripts\pytest`).
- Run a single test:
  - pytest: `.venv/Scripts/pytest tests/test_causality.py::test_gannon_holdout_outside_fit_splits`
  - Playwright: `npx playwright test -g "playback"` (from `web/`)
