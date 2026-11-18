// Tatoeba (CC BY 2.0 FR): sentences in the site's languages with their translations
// -> one dictionary per language pair, "tatoeba-<sentence lang>-<translation lang>" (registered in
// app/lib/dicts.ts), so readers choose which pairs they see, like any other dictionary.
//
// A sentence of language A with translations in language B is stored in "tatoeba-A-B" with those
// translations only (sentence store, see output.ts). It is listed under each headword it contains as
// an exact word, and only under headwords some dictionary already has. How a sentence is split into
// words is per language (WORDS): no stemming or other guessing, so 먹다 gets no Korean sentences
// (they contain 먹어, 먹었다…), while Japanese uses Tatoeba's own word index, which gives each word's
// dictionary form (食べて -> 食べる).
//
// To add a language: its Tatoeba code in LANGS and a word splitter in WORDS.
import fs from "node:fs";
import { entryKey } from "../../app/lib/keys.ts";
import type { Sentence } from "../../app/lib/types.ts";
import { DICTIONARIES } from "../../app/lib/dicts.ts";
import { addSentence, addSentenceRef, bunzip, download, exists, extract, lines, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

/** The registered sentence dictionaries: [id, sentence language, translation language]. */
const DICTS = DICTIONARIES.filter((d) => d.kind === "sentences" && d.source.credit === "Tatoeba").map((d) => [d.id, d.headLang, d.glossLang] as const);

/** Site language code -> Tatoeba (ISO 639-3) code. */
const LANGS: Record<string, string> = { en: "eng", ko: "kor", ja: "jpn" };

/** Headword keys a sentence contains, per language. `index` has Japanese's dictionary forms by sentence id. */
const WORDS: Record<string, (text: string, sid: string, index: Map<string, string[]>) => Iterable<string>> = {
  // tokens and two-token phrases ("give up")
  en: (text) => {
    const tokens = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    return [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]} ${t}`)];
  },
  // whitespace-separated words
  ko: (text) => text.split(/[\s.,!?"'()…·:;]+/).filter(Boolean),
  // Tatoeba's Japanese index: "直ぐに{すぐに} 戻る{戻ります}" -> 直ぐに, 戻る (+ the written forms)
  ja: (_text, sid, index) => index.get(sid) ?? [],
};

const pairs = () => Object.values(LANGS).flatMap((a) => Object.values(LANGS).filter((b) => b !== a).map((b) => [a, b]));

export default {
  name: "Tatoeba",
  dictionaries: DICTS.map(([id]) => id),
  fetch() {
    for (const code of Object.values(LANGS)) {
      download(`tatoeba/${code}_sentences.tsv.bz2`, `https://downloads.tatoeba.org/exports/per_language/${code}/${code}_sentences.tsv.bz2`);
      bunzip(`tatoeba/${code}_sentences.tsv.bz2`);
    }
    for (const [a, b] of pairs()) {
      download(`tatoeba/${a}-${b}_links.tsv.bz2`, `https://downloads.tatoeba.org/exports/per_language/${a}/${a}-${b}_links.tsv.bz2`);
      bunzip(`tatoeba/${a}-${b}_links.tsv.bz2`);
    }
    download("tatoeba/jpn_indices.tar.bz2", "https://downloads.tatoeba.org/exports/jpn_indices.tar.bz2");
    extract("tatoeba/jpn_indices.tar.bz2", "tatoeba/jpn_indices");
  },
  build: () => "attached after the dictionaries",
  async after() {
    if (!exists("tatoeba")) return "skipped (raw/tatoeba missing)";
    // sentences of every language, then each one's translations into the others
    const text = new Map<string, { lang: string; text: string }>();
    for (const [lang, code] of Object.entries(LANGS)) {
      const file = raw("tatoeba", `${code}_sentences.tsv`);
      if (!fs.existsSync(file)) continue;
      for await (const line of lines(file)) {
        const [sid, , t] = line.split("\t");
        if (t) text.set(sid, { lang, text: t });
      }
    }
    const translations = new Map<string, string[]>();
    for (const [a, b] of pairs()) {
      const file = raw("tatoeba", `${a}-${b}_links.tsv`);
      if (!fs.existsSync(file)) continue;
      for await (const line of lines(file)) {
        const [from, to] = line.split("\t");
        if (!text.has(from) || !text.has(to)) continue;
        const list = translations.get(from) ?? [];
        if (!list.includes(to)) translations.set(from, [...list, to]);
      }
    }
    // Japanese word index: sentence id -> dictionary forms (and written forms) of its words
    const index = new Map<string, string[]>();
    const indexFile = raw("tatoeba", "jpn_indices", "jpn_indices.csv");
    if (fs.existsSync(indexFile))
      for await (const line of lines(indexFile)) {
        const [sid, , words] = line.split("\t");
        const forms = new Set<string>();
        for (const tok of words?.split(" ") ?? []) {
          const head = /^[^([{~|]+/.exec(tok)?.[0];
          const written = /\{([^}]+)\}/.exec(tok)?.[1];
          if (head) forms.add(head);
          if (written) forms.add(written);
        }
        index.set(sid, [...forms]);
      }

    const counts: Record<string, number> = {};
    for (const [sid, list] of translations) {
      const s = text.get(sid)!;
      const words = [...new Set(WORDS[s.lang]?.(s.text, sid, index) ?? [])].map(entryKey);
      for (const [id, head, gloss] of DICTS) {
        if (s.lang !== head) continue;
        const into = list.map((t) => text.get(t)!).filter((t) => t.lang === gloss);
        if (!into.length) continue;
        let listed = false;
        for (const key of words) if (addSentenceRef(id, key, Number(sid))) listed = true;
        if (!listed) continue;
        const sentence: Sentence = { lang: s.lang, text: s.text, translations: into };
        addSentence(id, Number(sid), sentence);
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return `sentences per dictionary ${JSON.stringify(counts)}`;
  },
} satisfies Source;
