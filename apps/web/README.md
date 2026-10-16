# web

The Lemmata UI: React 19 with the React Compiler, Vite, React Router, TanStack Query, HeroUI v3 and Tailwind CSS 4.

Run it with `yarn dev` from the repo root (it needs the daemon for data). Vite proxies `/api` to
`127.0.0.1:4317` and adds the `x-lemmata-token` header (`LEMMATA_TOKEN`, default `dev-token`).

- `src/pages/`: one component per route; routes in `src/lib/router.ts`, URLs in `src/lib/paths.ts`.
- `src/api/`: fetch functions and query hooks per resource, typed with `shared`.
- `src/components/`: shell (sidebar, top bar) and shared pieces.
- `src/index.css`: design tokens (`--color-lm-*`) with light and dark values.
- `src/stores/`: zustand stores for client state: `theme.ts` (System / Light / Dark, set on the Settings page) and
  `project.ts` (current project). Shared hooks such as `useTheme` live in `src/lib/hooks.ts`.
