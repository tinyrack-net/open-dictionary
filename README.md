# Open Dictionary

A free, static English / English↔Korean dictionary built from open data, with React Router
(framework mode, `ssr: false` + prerender), [@tinyrack/ui](https://www.npmjs.com/package/@tinyrack/ui) and
Tailwind CSS. It is hosted on Cloudflare Workers static assets.

## Dictionaries

| Dictionary | `dicts` slug | Source | License |
|---|---|---|---|
| English (WordNet) | `wordnet` | [Open English WordNet 2025](https://en-word.net/) | CC BY 4.0 |
| English (Wiktionary) | `wiktionary` | [English Wiktionary](https://en.wiktionary.org/) via [kaikki.org](https://kaikki.org/) | CC BY-SA 4.0 |
| English → Korean | `en-ko` | Korean translations in English Wiktionary | CC BY-SA 4.0 |
| Korean → English | `ko-en` | Korean entries in English Wiktionary, plus reversed translations | CC BY-SA 4.0 |

## URLs

Every setting is in the URL, so a link always shows exactly what was on screen. Nothing is stored in
localStorage or cookies.

```
/ko/word?word=love&dicts=wordnet,en-ko&theme=dark
 │              │          │                  └ theme  auto (omitted) | light | dark
 │              │          └ dicts  dictionaries shown (omitted = all)
 │              └ word   headword
 └ UI language (en | ko), a path segment so prerendered HTML is already translated

/                       redirects to /en or /ko by browser language, keeping the query string
/{lang}                 home
/{lang}/word?word=...   entry
/{lang}/about           sources & licenses
/{lang}/word/love       old URL, redirects to /{lang}/word?word=love
```

`app/lib/settings.ts` is the single place that reads and writes settings (`useSettings()`), and every
in-app link is built from it. `?theme=` is applied by an inline script before first paint, so dark links
don't flash light.

## Development

Requires Node 22.18+ (runs `.ts` scripts directly) and pnpm.

```sh
pnpm install
pnpm fetch-data   # ~570 MB download into raw/
pnpm build-data   # ~1 min, ~3 GB RAM: writes data/site
pnpm dev          # dev server, serves data/site at /data
pnpm check:design # tinyrack-ui-check: Tinyrack components and tokens only (also runs in CI)
pnpm build        # ~10 s: builds the app, copies data into build/client
pnpm preview      # wrangler dev on http://localhost:4173 (same routing as production)
```

After rebuilding, restart `pnpm preview`. wrangler dev doesn't pick up a new asset list.

## How it works

The browser never downloads the whole dictionary. Data is split into small chunks (~35–50 KB compressed),
and a lookup fetches only the chunks it needs.

```
data/site/
  i/manifest.json          first key of each search chunk                      (1 file)
  i/<n>.json               search index: headword + which dictionaries have it (586 chunks)
  d/wn/<shard>.json        WordNet entries                                     (256 chunks)
  d/en/<shard>.json        Wiktionary English entries                          (2,048 chunks)
  d/enko/<shard>.json      English → Korean translations                       (32 chunks)
  d/ko/<shard>.json        Korean → English entries + reverse translations     (128 chunks)
```

Looking up `/en/word?word=love&dicts=en-ko`:

1. Fetch the search chunk for "love". It holds the display form and a bitmask of the dictionaries that contain it.
2. For each selected dictionary that contains the word, fetch `d/<dict>/<hash(love) % shards>.json`.
   Dictionaries that aren't selected, or don't contain the word, cost nothing.
3. Turning another dictionary on fetches only that dictionary's chunk. Fetched chunks are cached.

Only 6 pages are prerendered: `/{lang}`, `/{lang}/word` and `/{lang}/about` for each language. The word
page is one HTML shell per language. Other paths (`/`, old links) get the SPA fallback `index.html`.
To add a dictionary, add its id to `DICT` and `SHARDS` in `app/lib/keys.ts`, then write its chunks in
`scripts/build-data.ts`.

## Deployment (Cloudflare Workers static assets)

`wrangler.jsonc` deploys `build/client` as static assets only. There is no Worker script, so every request is a
free static-asset request. `not_found_handling: single-page-application` serves `index.html` for unknown paths.

Free plan budget: 20,000 files per version and 25 MiB per file. The build has about 3,100 files, and
`scripts/postbuild.ts` fails the build if the limit is exceeded.

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`, and weekly to pick up fresh
Wiktionary data. Configure:

| Kind | Name | Value |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | API token from the "Edit Cloudflare Workers" template |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variable (optional) | `SITE_URL` | Public origin, used for `hreflang` links |

To deploy manually: `npx wrangler login && pnpm run deploy`.

## License

Code: MIT. Dictionary data: see the table above. The processed data is CC BY-SA 4.0.
