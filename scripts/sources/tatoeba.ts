// Tatoeba (CC BY 2.0 FR): English–Korean sentence pairs -> "tatoeba".
//
// A pair is attached to a headword only when the headword occurs in it as an exact whole word:
// English by token (and two-token phrases like "give up"), Korean by whitespace-separated word, and
// only to headwords some dictionary already has. No stemming or other guessing, so 먹다 gets no pairs
// (Korean sentences contain 먹어, 먹었다…).
import fs from "node:fs";
import type { SentencePair } from "../../app/lib/types.ts";
import { addPair, bunzip, download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

const ID = "tatoeba";
const FILES = [
  ["tatoeba/eng-kor_links.tsv.bz2", "https://downloads.tatoeba.org/exports/per_language/eng/eng-kor_links.tsv.bz2"],
  ["tatoeba/kor_sentences.tsv.bz2", "https://downloads.tatoeba.org/exports/per_language/kor/kor_sentences.tsv.bz2"],
  ["tatoeba/eng_sentences.tsv.bz2", "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2"],
];

export default {
  name: "Tatoeba",
  dictionaries: [ID],
  fetch() {
    for (const [out, url] of FILES) {
      download(out, url);
      bunzip(out);
    }
  },
  build: () => "attached after the dictionaries",
  after() {
    if (!exists("tatoeba", "eng-kor_links.tsv")) return "skipped (raw/tatoeba missing)";
    const read = (f: string) => fs.readFileSync(raw("tatoeba", f), "utf8").split("\n").filter(Boolean);
    const kor = new Map(read("kor_sentences.tsv").map((l) => l.split("\t")).map(([id, , t]) => [id, t]));
    const links = read("eng-kor_links.tsv").map((l) => l.split("\t"));
    const engIds = new Set(links.map((l) => l[0]));
    const eng = new Map<string, string>();
    for (const l of read("eng_sentences.tsv")) {
      const id = l.slice(0, l.indexOf("\t"));
      if (engIds.has(id)) eng.set(id, l.split("\t")[2]);
    }
    let pairs = 0;
    let attached = 0;
    for (const [e, k] of links) {
      const en = eng.get(e);
      const ko = kor.get(k);
      if (!en || !ko) continue;
      pairs++;
      // one object per side, shared by every headword of that side
      const fromEn: SentencePair = { lang: "en", text: en, translation: { lang: "ko", text: ko } };
      const fromKo: SentencePair = { lang: "ko", text: ko, translation: { lang: "en", text: en } };
      const tokens = en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
      for (let i = 0; i < tokens.length; i++) {
        if (addPair(ID, tokens[i], fromEn)) attached++;
        if (tokens[i + 1] && addPair(ID, `${tokens[i]} ${tokens[i + 1]}`, fromEn)) attached++;
      }
      for (const word of ko.split(/[\s.,!?"'()…·:;]+/).filter(Boolean)) if (addPair(ID, word, fromKo)) attached++;
    }
    return `${pairs} sentence pairs, ${attached} exact word matches`;
  },
} satisfies Source;
