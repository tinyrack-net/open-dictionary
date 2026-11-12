# Open Dictionary

A free, static English / English↔Korean dictionary built from open data, with React Router
(framework mode, `ssr: false` + prerender), Tailwind CSS and daisyUI. It is hosted on Cloudflare Workers static assets.

## Dictionaries

| Dictionary | `dicts` slug | Source | License |
|---|---|---|---|
| English (WordNet) | `wordnet` | [Open English WordNet 2025](https://en-word.net/) | CC BY 4.0 |
| English (Wiktionary) | `wiktionary` | [English Wiktionary](https://en.wiktionary.org/) via [kaikki.org](https://kaikki.org/) | CC BY-SA 4.0 |
| English → Korean | `en-ko` | Korean translations in English Wiktionary | CC BY-SA 4.0 |
| Korean → English | `ko-en` | Korean entries in English Wiktionary, plus reversed translations | CC BY-SA 4.0 |

## URLs

```
/                         redirects to /en or /ko (saved choice, then browser language)
/{lang}                   home         lang = en | ko (UI language)
/{lang}/word/{word}       entry
/{lang}/about             sources & licenses
?dicts=wordnet,en-ko      dictionaries shown (omitted = all), so a shared link shows the same view
```

## Development

Requires Node 22.18+ (runs `.ts` scripts directly) and pnpm.

```sh
pnpm install
pnpm fetch-data   # ~570 MB download into raw/
pnpm build-data   # ~1 min, ~4 GB RAM: writes data/site and data/prerender.json
pnpm dev          # dev server, serves data/site at /data
pnpm build        # prerenders popular words in both UI languages, copies data into build/client
pnpm preview      # wrangler dev on http://localhost:4173 (same routing as production)
```

`PRERENDER_LIMIT=20 pnpm build` gives a quick build.

## How it works

- `data/site/e/<shard>.json`: 4,096 hash shards of entries (`{ [lowercased headword]: Entry }`).
- `data/site/i/<n>.json`: search index. Headwords are sorted and cut into 2,500-row chunks, and
  `i/manifest.json` lists the first key of each chunk. Very common prefixes use a precomputed top-15 list.
- `/{lang}/word/:word`: popular words are prerendered to HTML and `.data`. Every other word is served by
  the SPA fallback `index.html`, and `clientLoader` fetches its shard.
- The `?dicts=` selection is applied after hydration, because prerendered HTML can't know the query string.

## Deployment (Cloudflare Workers static assets)

`wrangler.jsonc` deploys `build/client` as static assets only. There is no Worker script, so every request is a
free static-asset request. `not_found_handling: single-page-application` serves `index.html` for unknown paths.

Free plan budget: 20,000 files per version and 25 MiB per file. The build has about 12k files, and
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
