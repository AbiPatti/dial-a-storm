---
name: verify-site
description: Test that the Dial-a-Storm website and pipeline still work after a change. Use after adding a feature, fixing a bug, refactoring, changing data/artifacts, or touching anything in web/, pipeline/ or docs/CONTRACTS.md, and before saying a change is done, committing, or merging.
---

# Verify the site after a change

Run this after every change, before you report the work as done. Do not skip steps because a
change "looks small"; a renamed prop or moved file can break the page with no type error.

## 1. Scope the change

```bash
git status --short
git diff --stat main...HEAD     # plus uncommitted changes from git status
```

- Anything under `pipeline/` → step 2 is required.
- Anything under `web/`, `web/public/data/` or `docs/CONTRACTS.md` → steps 3–4 are required.
- When unsure, run everything.

## 2. Pipeline tests (from `pipeline/`)

```bash
.venv/Scripts/pytest            # macOS/Linux: .venv/bin/pytest
```

If `.venv` is missing: `py -3.12 -m venv .venv && .venv/Scripts/pip install -r requirements.txt`.
All causality tests must pass. If a change touches an exporter, also regenerate into a scratch
folder (`WEB_DATA_DIR=<scratch> .venv/Scripts/python -m dial_a_storm.make_fixtures`) and confirm
the web app still accepts the output (the Zod schemas in `web/lib/types.ts`).

## 3. Typecheck (from `web/`)

```bash
npm run typecheck
```

## 4. Browser tests (from `web/`)

```bash
npm run test:e2e
```

This builds the production site, serves it on port 3100 (a running `npm run dev` on 3000 is not
affected) and drives it in headless Chromium. `web/e2e/site.spec.ts` covers:

- every JSON artifact is served (manifest, storms, 8 windows, 8 scenario grids)
- the page loads with no console errors or uncaught exceptions; header, source badge, WebGL canvas,
  chart, "How it works" and hold-out sections render
- each of the 8 storms can be selected and loads its data
- the Bz / speed / density sliders change the prediction, the BEYOND TRAINING DATA warning appears
  at extreme settings, and Reset restores the baseline
- playback: Play, Pause, scrub, Restart, replay speed and Simulate

First run on a new machine: `npx playwright install chromium`.
To run one test: `npx playwright test -g "playback"`. On failure, look at the screenshot and trace
in `web/test-results/` (`npx playwright show-trace <path>/trace.zip`).

## 5. Cover the new feature

If the change adds or alters user-visible behaviour, add or update a test in `web/e2e/` that would
fail without the change. Prefer role/label selectors (`getByRole`, `getByLabel`) over CSS classes,
and add an `aria-label` to the component if there is nothing stable to select. Run step 4 again.

## 6. Look at it (UI or visual changes only)

Tests do not judge looks. For visual changes, take a screenshot and read it:

```bash
npx next start -p 3100            # after npm run build; run in the background
npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=5000 http://localhost:3100 <scratchpad>/site.png
```

Also check a phone width (`--viewport-size=390,844`). Stop the server afterwards.

## 7. Report

Say which steps ran and their results (for example "17 pytest passed, typecheck clean, 5/5 e2e
passed"). If anything fails, fix it and re-run; never report a change as working with a failing or
skipped step. If a test is wrong rather than the code, say so and explain the fix to the test.
