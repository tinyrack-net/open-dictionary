# Open Dictionary

A free English, Korean and Japanese dictionary built only from openly licensed data, shown exactly as each
source wrote it.
Static site, installable as an offline-capable app (PWA).

**https://dictionary.tinyrack.net**

## Dictionaries

| Languages | Dictionary | Source | License |
|---|---|---|---|
| English–English | Simple English Wiktionary | [Simple English Wiktionary](https://simple.wiktionary.org/) via [kaikki.org](https://kaikki.org/) | CC BY-SA 4.0 |
| English–English | WordNet | [Open English WordNet 2025](https://en-word.net/) | CC BY 4.0 |
| English–English | Wiktionary | [English Wiktionary](https://en.wiktionary.org/) via [kaikki.org](https://kaikki.org/) | CC BY-SA 4.0 |
| English–Korean | Korean Wiktionary | [Korean Wiktionary](https://ko.wiktionary.org/) via kaikki.org | CC BY-SA 4.0 |
| English–Korean, English–Japanese | Wiktionary translations | English Wiktionary | CC BY-SA 4.0 |
| Korean–Korean | Basic Korean Dictionary | [한국어기초사전](https://krdict.korean.go.kr/) © 국립국어원, text only | CC BY-SA 2.0 KR |
| Korean–English | Wiktionary | English Wiktionary | CC BY-SA 4.0 |
| Japanese–Japanese | Japanese Wiktionary | [ウィクショナリー日本語版](https://ja.wiktionary.org/) via kaikki.org | CC BY-SA 4.0 |
| Japanese–English | JMdict | [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) © EDRDG, via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | CC BY-SA 4.0 |
| Japanese–English | Wiktionary | English Wiktionary | CC BY-SA 4.0 |
| Japanese–Korean | Korean Wiktionary | Korean Wiktionary | CC BY-SA 4.0 |
| Sentences | Tatoeba | [Tatoeba](https://tatoeba.org/): English, Korean and Japanese with translations | CC BY 2.0 FR |

Search ranking uses [wordfreq](https://github.com/rspeer/wordfreq) (CC BY-SA 4.0). Recordings are played from
[Wikimedia Commons](https://commons.wikimedia.org/), each under its own license.

Readers choose which dictionaries are shown and in what order in Settings; the choice is kept in the URL.

## Adding a dictionary

A dictionary is data plus one registry entry. Nothing else in the app names dictionaries.

1. **Register it** in `app/lib/dicts.ts` (`DICTIONARIES`): id, headword and definition languages (shown as
   the language pair, e.g. English–Korean), name, description, source, license.
2. **Convert it** in `scripts/sources/<name>.ts` (contract: `scripts/lib/source.ts`): `fetch()` downloads raw
   files, `build()` converts them into the neutral format (`app/lib/types.ts`), then list it in
   `scripts/sources/index.ts`. Sources from Wiktionary reuse `scripts/lib/wiktextract.ts`.
3. **Test it** in `app/lib/fidelity.test.ts`: compare a few built headwords with the raw source.

The word page, settings, search, about page, chunk sizes and offline cache all follow the registry.

Converters copy, they don't compose: same entries, order, glosses, examples and tags; nothing merged,
summarized, ranked, truncated or invented. The renderer has no per-dictionary code.

**A new language** of dictionaries needs nothing more. To show the UI in it, add a file in `app/locales/` (same keys as
`en.ts`) and an entry in `LANGS`; for its example sentences, add it to `scripts/sources/tatoeba.ts`.

## Development

Requires Node 22.18+, pnpm, curl, bunzip2 and [uv](https://docs.astral.sh/uv/) (word frequencies).

```sh
pnpm install
pnpm fetch-data   # downloads every source into raw/ (~900 MB)
pnpm build-data   # converts raw/ into data/site (~4 min, ~6 GB RAM)
pnpm dev          # dev server with the built data
pnpm test         # data fidelity checks (skipped without data) and unit tests
pnpm typecheck && pnpm check:design
pnpm build        # app + data + service worker into build/client
pnpm preview      # production-like server on :4173 (restart after each build)
```

## How it works

- **Settings live in the URL** (`/ko/word?word=love&dicts=wordnet,en-ko&theme=dark`), so every link
  reproduces the screen. Only recent and saved words are stored on the device.
- **Data is chunked per dictionary** (`data/site/d/<id>/<shard>.json`, ~50 KB compressed each), and a lookup
  fetches only the chunks of the selected dictionaries, all in parallel. It is served under a content hash
  (`/data/<version>/`) and cached forever.
- **Only a few pages are prerendered** (`/{lang}`, `/{lang}/word`, …); the word page loads its entry in the
  browser.
- **Offline**: a service worker (`scripts/sw.template.js`) caches the app and every word you open.

## Deployment

Cloudflare Workers static assets, deployed by GitHub Actions on every push to `main` and weekly for fresh
data. Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; variable `SITE_URL`.

## License

Code: [MIT](LICENSE). Data: each dictionary's processed data keeps its source's license (table above).
