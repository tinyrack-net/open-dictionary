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

Also used on the word page:

| Data | Source | License |
|---|---|---|
| English–Korean example sentences | [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR |
| Word frequency (search ranking only, never shown) | [wordfreq 3.1](https://github.com/rspeer/wordfreq) | CC BY-SA 4.0 |
| Recorded pronunciations | [Wikimedia Commons](https://commons.wikimedia.org/), linked from Wiktionary | per recording (CC BY-SA / CC BY / CC0) |

## URLs

Every setting is in the URL, so a link always shows exactly what was on screen. Settings are never stored in
localStorage or cookies. The only things kept on the device are two personal lists, recently viewed words
(`od.recent`, shown on the home page) and saved words (`od.saved`, the bookmark button and `/{lang}/saved`),
in `app/lib/history.ts`.

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
/{lang}/saved           saved words (this device)
/{lang}/word/love       old URL, redirects to /{lang}/word?word=love
```

`app/lib/settings.ts` is the single place that reads and writes settings (`useSettings()`), and every
in-app link is built from it. `?theme=` is applied by an inline script before first paint, so dark links
don't flash light.

## Development

Requires Node 22.18+ (runs `.ts` scripts directly) and pnpm.

```sh
pnpm install
pnpm fetch-data   # ~600 MB download into raw/ (needs curl, bunzip2, and uv for wordfreq)
pnpm build-data   # ~1.5 min, ~3 GB RAM: writes data/site
pnpm test         # view model checks on real words (run, ran, love, 사랑, give up) + preload script
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
  d/en/<shard>.json        Wiktionary English entries                          (4,096 chunks)
  d/enko/<shard>.json      English → Korean translations                       (32 chunks)
  d/ko/<shard>.json        Korean entries + translation backlinks              (256 chunks)
  d/ex/<shard>.json        English–Korean sentence pairs (Tatoeba)             (64 chunks)
  d/<id>/x/<hash>.json     a single headword too large for a shared chunk      (60 files)
  version.txt              content hash of all the files above
```

The site serves the data under `/data/<version>/` (`app/lib/dataVersion.ts`). The version is baked into
the app at build time, so a page only ever reads data from its own build, never a cached chunk from an
earlier one. The files are cached forever, and an identical data build keeps the same version.
`/data/version.txt` names the live version; a tab left open across a deploy reloads once into the new
build when one of its data files is gone.

Looking up `/en/word?word=love&dicts=en-ko`:

1. A chunk's file name depends only on the word (`d/<dict>/<hash(love) % shards>.json`), so the index chunk
   and every selected dictionary's chunk are requested **at the same time**. Unselected dictionaries cost nothing.
2. The index row gives the display form, which dictionaries really contain the word, and its frequency.
3. Turning another dictionary on fetches only that dictionary's chunk. Fetched chunks are cached.

On a first visit an inline `<head>` script (`app/lib/preload.ts`) starts these requests before the app's
JavaScript has loaded; the data layer reuses them. `app/lib/preload.test.ts` checks that the script asks for
exactly the files `getEntry` reads.

## Data model: render sources as they are

Every source is converted into one neutral format (`app/lib/types.ts`: entry → part of speech, etymology
number, pronunciations, recordings, forms, inflection tables, senses with examples/translations/word lists)
and rendered by one generic component (`app/components/DictEntryView.tsx`).

Converters (`scripts/build-data.ts`) **copy, they don't compose**:

- every field comes from the source; nothing is invented, merged across entries, ranked or summarized
- the source's order (entries, senses, forms, examples) and its grammar tags are kept verbatim
- nothing is truncated or capped (headwords too large for a shared chunk get their own file)

The renderer has **no source-specific code**. Each selected source is one card, in the order of `?dicts=`;
within a card, entries and senses keep the source's order. The only display rule is uniform: long lists show
the first items and a "show all" button. In the Korean UI, tags and parts of speech are translated through a
1:1 table (`app/lib/tags.ko.ts`); tags missing from it are shown as the source wrote them.

Facts that are not dictionary entries are labeled as what they are: "given as a translation of *love*
(English Wiktionary, sense: strong affection)" and Tatoeba sentence pairs (exact whole-word matches only).

To add a dictionary: write a converter into the neutral format, add its id to `DICT`/`SHARDS` in
`app/lib/keys.ts` and to `DICTIONARIES` in `app/lib/dicts.ts`. The renderer doesn't change.

`app/lib/fidelity.test.ts` compares built entries with the raw source (entry order, parts of speech, every
gloss and example, forms staying with their entry) and fails on any field the format doesn't define.

Only 8 pages are prerendered: `/{lang}`, `/{lang}/word`, `/{lang}/about`, `/{lang}/saved` for each language.
The word page is one HTML shell per language. Other paths (`/`, old links) get the SPA fallback `index.html`.
To add a dictionary, add its id to `DICT` and `SHARDS` in `app/lib/keys.ts`, then write its chunks in
`scripts/build-data.ts`.

## Deployment (Cloudflare Workers static assets)

`wrangler.jsonc` deploys `build/client` as static assets only. There is no Worker script, so every request is a
free static-asset request. `not_found_handling: single-page-application` serves `index.html` for unknown paths.

Free plan budget: 20,000 files per version and 25 MiB per file. The build has about 6,000 files, and
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
