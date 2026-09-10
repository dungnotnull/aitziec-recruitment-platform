# Frontend Green Theme Restoration Design

## Goal

Restore the green visual identity already defined by the project owner and prevent the active application theme from silently reverting to blue.

## Scope

- Update the active stylesheet, `frontend/src/shared/styles/global.css`.
- Use `#16a34a` as the light-theme action color and `#4ade80` as the dark-theme action color.
- Align hover, dim, border, selection, and decorative background accents with the green palette.
- Preserve existing layouts, typography, semantic status colors, light/dark behavior, accessibility rules, and API logic.
- Do not import the legacy `frontend/src/index.css`; it belongs to the unused Vite starter screen and would create competing token sources.

## Verification

- Add a source-level regression test that reads the active imported stylesheet and asserts the canonical green tokens are present while the former blue action tokens are absent.
- Run the focused test, full frontend unit suite, typecheck, and production build.
- Confirm the final Git diff touches only theme/test documentation and excludes the owner's untracked `fix*.cjs` files.

## Delivery

Commit the isolated theme restoration and push it to `origin/frontend`.
