# Frontend Green Theme Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the active application theme to the owner's green palette and prevent blue brand tokens from returning.

**Architecture:** Keep `frontend/src/shared/styles/global.css` as the single active Tailwind theme source. Add one Playwright regression test that loads the compiled application and validates the computed light/dark brand and canvas tokens.

**Tech Stack:** Tailwind CSS v4 theme tokens, CSS custom properties, Playwright, TypeScript.

## Global Constraints

- Use `#16a34a` as the light-theme action color and `#4ade80` as the dark-theme action color.
- Preserve layouts, typography, semantic status behavior, accessibility rules, and API logic.
- Do not import the legacy `frontend/src/index.css`.
- Do not stage or modify `frontend/fix.cjs` or `frontend/fix-checks.cjs`.

---

### Task 1: Lock and restore the active green theme

**Files:**
- Create: `frontend/tests/theme.spec.ts`
- Modify: `frontend/src/shared/styles/global.css`

**Interfaces:**
- Consumes: `frontend/src/main.tsx` importing `@/shared/styles/global.css`.
- Produces: canonical Tailwind tokens such as `action`, `canvas`, `surface`, and `border` for all existing UI components.

- [x] **Step 1: Write the failing regression test**

Open `/login` in a real browser. Assert `getComputedStyle(document.documentElement)` reports `#16A34A` with the light green canvas, then emulate dark color scheme and assert `#4ADE80` with the dark green canvas.

- [x] **Step 2: Run the focused test and verify RED**

Run: `$env:CI='1'; npm.cmd run test:e2e -- tests/theme.spec.ts --project=chromium`

Expected: FAIL because the active stylesheet still contains blue action tokens.

- [x] **Step 3: Apply the minimal green token update**

Set the light action palette to green-600/700, light canvas and borders to green-50/100/200, dark canvas and surfaces to green-950/900/800, and dark action palette to green-400/300. Change selection and decorative RGBA accents to the matching green RGB values.

- [x] **Step 4: Verify focused and full frontend checks**

Run:

```powershell
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run build
$env:CI='1'; npm.cmd run test:e2e -- tests/theme.spec.ts --project=chromium
```

Expected: all commands exit 0.

- [x] **Step 5: Review, commit, and push**

Confirm `git diff --check` passes and the two owner `fix*.cjs` files remain untracked. Commit only the plan, theme, and regression test with `fix(frontend): restore green application theme`, then push `frontend` to `origin/frontend` without force.
