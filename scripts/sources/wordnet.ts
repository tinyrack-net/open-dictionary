// Open English WordNet 2025 (CC BY 4.0) -> "wordnet".
//
// WordNet entries are lemma × part of speech; each sense is a synset. Copied fields: definition,
// examples, the synset's other members (synonyms) and its hypernyms' members, all in source order.
import fs from "node:fs";
import type { Example, Pron, Relations, Sense } from "../../app/lib/types.ts";
import { addEntry, compact, download, exists, headword, raw, unzip } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

const ID = "wordnet";
// WordNet's own part-of-speech codes, spelled out (n, v, a, s = satellite adjective, r)
const POS: Record<string, string> = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };

export default {
  name: "Open English WordNet",
  dictionaries: [ID],
  fetch() {
    download("oewn.zip", "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip");
    unzip("oewn.zip", "oewn");
  },
  build() {
    if (!exists("oewn")) return "skipped (raw/oewn missing)";
    const dir = raw("oewn");
    const synsets: Record<string, any> = {};
    for (const f of fs.readdirSync(dir)) if (/^(noun|verb|adj|adv)\./.test(f)) Object.assign(synsets, JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")));
    let count = 0;
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("entries-"))) {
      const data = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
      for (const [lemma, byPos] of Object.entries<any>(data)) {
        const h = headword(lemma);
        if (!h.parts[ID] && /^[a-z]/.test(lemma)) h.w = lemma; // display the lowercase spelling when there is one
        for (const [posKey, info] of Object.entries<any>(byPos)) {
          const senses: Sense[] = [];
          for (const s of info.sense ?? []) {
            const ss = synsets[s.synset];
            if (!ss) continue;
            const members = (ss.members as string[]).filter((m) => m !== lemma).map((word) => ({ word }));
            const hypernyms = (ss.hypernym ?? []).flatMap((x: string) => (synsets[x]?.members ?? []).map((word: string) => ({ word })));
            senses.push(
              compact({
                gloss: (ss.definition ?? []).join("; "),
                examples: (ss.example ?? []).map((x: any): Example => compact({ text: typeof x === "string" ? x : x.text, ref: typeof x === "string" ? undefined : x.source })),
                relations: compact({ synonyms: members, hypernyms } as Relations),
              }),
            );
          }
          addEntry(
            ID,
            compact({
              word: lemma,
              pos: POS[posKey[0]] ?? posKey,
              pron: (info.pronunciation ?? []).map((p: any): Pron => compact({ text: p.value, kind: "ipa", tags: p.variety ? [p.variety] : undefined })),
              senses,
            }),
          );
          count++;
        }
      }
    }
    return `${count} lemma/pos entries`;
  },
} satisfies Source;
