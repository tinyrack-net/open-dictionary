import type { Route } from "./+types/about";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sources & licenses — Open Dictionary" }];
}

const SOURCES = [
  {
    name: "Open English WordNet 2025",
    url: "https://en-word.net/",
    license: "CC BY 4.0",
    use: "English definitions, synonyms, broader terms, examples, pronunciations.",
  },
  {
    name: "English Wiktionary (wiktextract data from kaikki.org)",
    url: "https://kaikki.org/dictionary/English/",
    license: "CC BY-SA 4.0 / GFDL",
    use: "English entries: senses, etymology, IPA, inflected forms, and English → Korean translations.",
  },
  {
    name: "English Wiktionary — Korean entries (kaikki.org)",
    url: "https://kaikki.org/dictionary/Korean/",
    license: "CC BY-SA 4.0 / GFDL",
    use: "Korean headwords explained in English, with romanization, hanja and examples.",
  },
];

export default function About() {
  return (
    <article className="prose max-w-none py-8">
      <h1 className="font-serif text-3xl font-semibold">Sources &amp; licenses</h1>
      <p className="mt-3 text-stone-600 dark:text-stone-400">
        Every definition on this site comes from openly licensed data. The processed dataset is redistributed under
        CC BY-SA 4.0, as required by Wiktionary's license.
      </p>
      <ul className="mt-6 space-y-4">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <a href={s.url} className="wlink font-medium">
              {s.name}
            </a>
            <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs dark:bg-stone-800">{s.license}</span>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{s.use}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
