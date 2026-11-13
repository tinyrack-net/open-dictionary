# AGENTS.md

## Shape
- React Router 8 framework mode, `ssr: false`. Only `/{lang}`, `/{lang}/word`, `/{lang}/about` are prerendered;
  word data loads in the browser from chunked JSON under `/data` (see README "How it works").
- Deployed to Cloudflare Workers as static assets only (`wrangler.jsonc`), free plan: keep under 20,000 files
  (`scripts/postbuild.ts` enforces it).

## UI
- UI is built only from the published `@tinyrack/ui` package (pinned). Import components from
  `@tinyrack/ui/components/<name>` and add `@tinyrack/ui/components/<name>.css` to `app/app.css` after `core.css`.
- No raw `<p>`, `<h1>`…, `<button>`, `<input>`; no default Tailwind design utilities (`text-gray-500`, `p-4`, `border`).
  Use `TRText`, Tinyrack components and `*-tinyrack-*` utilities. `pnpm check:design` enforces this (CI too).
- Do not patch `node_modules`. Reusable gaps in `@tinyrack/ui` go upstream (tinyrack-net/design).

## Settings
- Every user setting lives in the URL: UI language in the path, `word`, `dicts`, `theme` in the query.
  Never store settings in localStorage/cookies. The only device storage is the two personal lists in
  `app/lib/history.ts` (recent and saved words). Read/write settings only through `useSettings()` in `app/lib/settings.ts`
  and build links with its `wordHref`/`pageHref`/`langHref` so settings carry over.
- Prerendered HTML can't see the query string: URL-dependent UI must render defaults until `useHydrated()`.

## Word page
- `app/lib/view.ts` decides what the word page shows (answer first: summary, translations, meanings, examples).
  Keep it pure and extend `app/lib/view.test.ts` with the real word that motivated a change.
- `app/lib/preload.ts` mirrors the data paths of `data.ts` in plain JavaScript; `preload.test.ts` must stay green.

## Commands
- `pnpm typecheck`, `pnpm check:design`, `pnpm test`, `pnpm build` (needs `data/site` from `pnpm fetch-data && pnpm build-data`).
- `pnpm preview` serves `build/client` with wrangler; restart it after every build.
