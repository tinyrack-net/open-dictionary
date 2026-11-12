# Open Dictionary (prototype)

A static English / English↔Korean dictionary site built with React Router (framework mode, `ssr: false` + prerender).

## Sources

| Dictionary | Source | License |
|---|---|---|
| English (WordNet) | Open English WordNet 2025 | CC BY 4.0 |
| English (Wiktionary) | English Wiktionary via kaikki.org (wiktextract) | CC BY-SA 4.0 |
| English → Korean | Korean translations in English Wiktionary | CC BY-SA 4.0 |
| Korean → English | Korean entries in English Wiktionary + reversed translations | CC BY-SA 4.0 |

## Build

```sh
pnpm install
pnpm fetch-data   # ~600 MB download into raw/
pnpm build-data   # ~1 min, writes data/site (~580 MB, ~20k JSON files) and data/prerender.json
pnpm build        # ~6 min, prerenders ~1,800 popular words, copies data into build/client
pnpm preview      # http://localhost:4173
```

`PRERENDER_LIMIT=20 pnpm build` gives a quick build.

## How it works

- `data/site/e/<shard>.json`: 4,096 hash shards of entries (`{ [lowercased headword]: Entry }`).
- `data/site/i/<prefix>.json`: adaptive prefix index for autocomplete. A prefix with too many rows is split
  into longer prefixes (`_split.json`). Its own file keeps only the top-ranked rows.
- `/word/:word`: popular words are prerendered to HTML. Every other word is served by `__spa-fallback.html`, and
  `clientLoader` fetches its shard.
- The dictionary selection is stored in `localStorage` and applied after hydration.

## Hosting

The host must serve `__spa-fallback.html` for unknown paths (e.g. Cloudflare Pages `_redirects`:
`/*  /__spa-fallback.html  200`). Missing `/data/*` files must still return 404.
