// Every data source, in build order. To add a dictionary: write scripts/sources/<name>.ts (see
// scripts/lib/source.ts), list it here, and register its dictionary in app/lib/dicts.ts.
import type { Source } from "../lib/source.ts";
import jmdict from "./jmdict.ts";
import krdict from "./krdict.ts";
import tatoeba from "./tatoeba.ts";
import wiktionaryEn from "./wiktionary-en.ts";
import wiktionaryJa from "./wiktionary-ja.ts";
import wiktionaryKo from "./wiktionary-ko.ts";
import wiktionarySimple from "./wiktionary-simple.ts";
import wordfreq from "./wordfreq.ts";
import wordnet from "./wordnet.ts";

export const SOURCES: Source[] = [wordnet, wiktionaryEn, wiktionaryKo, wiktionarySimple, wiktionaryJa, jmdict, krdict, tatoeba, wordfreq];
