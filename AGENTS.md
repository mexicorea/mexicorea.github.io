# Repository Guidelines

## Project Structure & Module Organization
- `src/pages/`: Astro routes.  
  - Blog and static pages (`index.astro`, `about.astro`, `gallery.astro`)
  - Game route: `src/pages/games/striker.astro` → `/games/striker`
- `src/components/`: shared UI pieces (`Header.astro`, `Footer.astro`, `BaseHead.astro`)
- `src/games/striker/`: ASCII shooter game modules (`client.ts`, `engine.ts`, `render.ts`, `types.ts`, `constants.ts`)
- `src/content/blog/`: Markdown/MDX blog posts and media
- `public/`: static assets (fonts, gallery images, content media)
- `dist/`: generated build output (do not edit manually)

## Build, Test, and Development Commands
- `pnpm dev`: run local Astro dev server
- `pnpm build`: production build to `dist/`
- `pnpm preview`: preview the production build
- `pnpm astro ...`: run Astro CLI subcommands

Example:
```bash
pnpm dev
pnpm build
```

## Coding Style & Naming Conventions
- Language: TypeScript + Astro.
- Follow existing file-local style (legacy Astro files may use tabs; newer TS files use 2 spaces).
- Prefer small, single-purpose modules and explicit constants in `constants.ts`.
- Naming:
  - files: `kebab-case` for routes/components, domain folders by feature (`games/striker`)
  - types/interfaces: `PascalCase`
  - variables/functions: `camelCase`
- Keep game logic deterministic where possible (`engine.ts`) and rendering isolated (`render.ts`).

## Testing Guidelines
- No formal test runner is configured yet.
- Minimum validation for every change:
  1. `pnpm build` must pass.
  2. Manually verify affected routes in `pnpm dev`.
- If adding tests, prefer Vitest with `*.test.ts` naming near the module under test.

## Commit & Pull Request Guidelines
- Use Conventional Commit style when possible, e.g.:
  - `feat(game): ASCII 슈팅 게임 라우트 추가`
  - `fix(games): 충돌 판정 최적화`
- Keep commits focused (one logical change per commit).
- PRs should include:
  - summary of user-visible changes
  - affected routes/files
  - verification steps (`pnpm build`, manual checks)
  - screenshots/GIFs for UI or game behavior changes

## Security & Configuration Notes
- This is a static site; do not commit secrets or API keys.
- Keep environment-specific values out of source; use deployment platform settings when needed.
