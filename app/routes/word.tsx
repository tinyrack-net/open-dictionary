import { Link } from "react-router";
import type { Route } from "./+types/word";
import { DictPicker } from "~/components/DictPicker";
import { wordHref } from "~/components/SearchBox";
import { getEntry, search } from "~/lib/data";
import { DICTIONARIES, usePrefs } from "~/lib/prefs";
import type { EnKoGroup, Entry, KoReverse, WiktEntry, WnEntry } from "~/lib/types";

async function load(word: string) {
  const entry = await getEntry(word);
  const suggestions = entry ? [] : (await search(word, 8)).map((r) => r[0]);
  return { word, entry, suggestions };
}

// Build time: popular words are pre-rendered to static HTML (+ .data for client navigation).
export async function loader({ params }: Route.LoaderArgs) {
  return load(params.word);
}

// Runtime: everything else is loaded in the browser from the sharded JSON files.
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return load(params.word);
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  const e = data?.entry;
  const first = e?.wn?.[0]?.senses[0]?.def ?? e?.en?.[0]?.senses[0]?.g ?? e?.ko?.[0]?.senses[0]?.g;
  return [
    { title: `${e?.w ?? data?.word ?? "Word"} — Open Dictionary` },
    ...(first ? [{ name: "description", content: `${e!.w}: ${first}` }] : []),
  ];
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { entry, word, suggestions } = loaderData;
  const { enabled } = usePrefs();

  if (!entry) {
    return (
      <div className="py-10">
        <h1 className="font-serif text-4xl font-semibold">{word}</h1>
        <p className="mt-4 text-stone-600">No entry found.</p>
        {suggestions.length > 0 && (
          <p className="mt-2">
            Did you mean:{" "}
            {suggestions.map((s, i) => (
              <span key={s}>
                {i > 0 && ", "}
                <Link className="wlink" to={wordHref(s)}>
                  {s}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }

  const sections = {
    wn: entry.wn && <WordNet entries={entry.wn} />,
    en: entry.en && <Wiktionary entries={entry.en} />,
    enko: entry.enko && <EnKo groups={entry.enko} />,
    ko: (entry.ko || entry.koRev) && <Korean entries={entry.ko} rev={entry.koRev} />,
  };
  const available = DICTIONARIES.filter((d) => sections[d.id]);
  const shown = available.filter((d) => enabled.includes(d.id));

  return (
    <div className="py-8">
      <h1 className="font-serif text-5xl font-semibold tracking-tight break-words">{entry.w}</h1>
      <Pronunciation entry={entry} />
      <div className="mt-5">
        <DictPicker />
      </div>
      {shown.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-stone-300 p-6 text-stone-600">
          This word is only in: {available.map((d) => d.label).join(", ")}. Turn that dictionary on above.
        </p>
      )}
      {shown.map((d) => (
        <section key={d.id} className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7 dark:border-stone-800 dark:bg-stone-900">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 pb-3 dark:border-stone-800">
            <h2 className="text-lg font-semibold">{d.label}</h2>
            <span className="text-xs text-stone-500">
              {d.source} · {d.license}
            </span>
          </header>
          {sections[d.id]}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Pronunciation({ entry }: { entry: Entry }) {
  const wn = entry.wn?.flatMap((w) => w.pron ?? []) ?? [];
  const items = wn.length
    ? wn.map((p) => ({ v: `/${p.v}/`, tag: p.var }))
    : (entry.en?.[0]?.ipa ?? entry.ko?.[0]?.ipa ?? []).map((p) => ({ v: p.v, tag: p.tags?.[0] }));
  const seen = new Set<string>();
  const uniq = items.filter((p) => !seen.has(p.v + p.tag) && seen.add(p.v + p.tag)).slice(0, 4);
  const ko = entry.ko?.[0];
  if (!uniq.length && !ko?.roman) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-stone-600 dark:text-stone-400">
      {ko?.roman && <span className="italic">{ko.roman}</span>}
      {ko?.hanja && <span>{ko.hanja}</span>}
      {uniq.map((p) => (
        <span key={p.v + p.tag}>
          {p.tag && <span className="mr-1 text-xs uppercase text-stone-400">{p.tag}</span>}
          <span className="font-mono text-[0.95em]">{p.v}</span>
        </span>
      ))}
    </p>
  );
}

const WordLinks = ({ words, sep = ", " }: { words: string[]; sep?: string }) => (
  <>
    {words.map((w, i) => (
      <span key={w + i}>
        {i > 0 && sep}
        <Link className="wlink" to={wordHref(w)}>
          {w}
        </Link>
      </span>
    ))}
  </>
);

const Pos = ({ children }: { children: string }) => (
  <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase first:mt-0">{children}</h3>
);

function WordNet({ entries }: { entries: WnEntry[] }) {
  return (
    <>
      {entries.map((e, i) => (
        <div key={i}>
          <Pos>{e.pos}</Pos>
          <ol className="list-decimal space-y-3 pl-6 marker:text-stone-400">
            {e.senses.map((s, j) => (
              <li key={j}>
                <p>{s.def}</p>
                {s.ex?.map((x, k) => (
                  <p key={k} className="mt-0.5 text-stone-600 italic dark:text-stone-400">
                    “{x}”
                  </p>
                ))}
                {(s.syn || s.broader) && (
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                    {s.syn && (
                      <span className="mr-4">
                        <span className="text-stone-400">Synonyms:</span> <WordLinks words={s.syn} />
                      </span>
                    )}
                    {s.broader && (
                      <span>
                        <span className="text-stone-400">Type of:</span> <WordLinks words={s.broader} />
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}

function SenseList({ entry }: { entry: WiktEntry }) {
  return (
    <ol className="list-decimal space-y-3 pl-6 marker:text-stone-400">
      {entry.senses.map((s, j) => (
        <li key={j}>
          <p>
            {s.tags && <span className="mr-1.5 text-sm text-stone-500">({s.tags.join(", ")})</span>}
            {s.parent && <span className="text-stone-500">{s.parent} → </span>}
            {s.g}
            {s.of && (
              <>
                {" "}
                <span className="text-sm">
                  → <WordLinks words={[s.of]} />
                </span>
              </>
            )}
          </p>
          {s.ex?.map((x, k) => (
            <div key={k} className="mt-1 border-l-2 border-stone-200 pl-3 text-sm dark:border-stone-700">
              <p className="text-stone-700 dark:text-stone-300">{x.t}</p>
              {x.roman && <p className="text-stone-500 italic">{x.roman}</p>}
              {x.en && <p className="text-stone-500">{x.en}</p>}
            </div>
          ))}
          {s.syn && (
            <p className="mt-1 text-sm text-stone-600">
              <span className="text-stone-400">Synonyms:</span> <WordLinks words={s.syn} />
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function Wiktionary({ entries }: { entries: WiktEntry[] }) {
  return (
    <>
      {entries.map((e, i) => (
        <div key={i}>
          <Pos>{e.pos}</Pos>
          {e.forms && (
            <p className="mb-2 text-sm text-stone-600">
              {e.forms.map((f, k) => (
                <span key={k} className="mr-3">
                  {f.tags && <span className="text-stone-400">{f.tags.join(" ")} </span>}
                  <b className="font-medium">{f.f}</b>
                </span>
              ))}
            </p>
          )}
          <SenseList entry={e} />
          {e.ety && (
            <details className="mt-3 text-sm text-stone-600">
              <summary className="cursor-pointer text-stone-500">Etymology</summary>
              <p className="mt-1">{e.ety}</p>
            </details>
          )}
        </div>
      ))}
    </>
  );
}

function EnKo({ groups }: { groups: EnKoGroup[] }) {
  return (
    <dl className="space-y-3">
      {groups.map((g, i) => (
        <div key={i} className="grid gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
          <dt className="text-stone-600 dark:text-stone-400">
            <span className="mr-1.5 text-xs text-stone-400 uppercase">{g.pos}</span>
            {g.sense || "—"}
          </dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {g.ko.map((k) => (
              <span key={k.w}>
                <Link className="wlink text-lg" to={wordHref(k.w)}>
                  {k.w}
                </Link>
                {(k.alt || k.roman) && (
                  <span className="ml-1 text-sm text-stone-500">
                    {k.alt && <span className="mr-1">{k.alt}</span>}
                    {k.roman && <i>{k.roman}</i>}
                  </span>
                )}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Korean({ entries, rev }: { entries?: WiktEntry[]; rev?: KoReverse[] }) {
  return (
    <>
      {entries?.map((e, i) => (
        <div key={i}>
          <Pos>{e.pos + (e.hanja ? ` · ${e.hanja}` : "")}</Pos>
          <SenseList entry={e} />
          {e.ety && (
            <details className="mt-3 text-sm text-stone-600">
              <summary className="cursor-pointer text-stone-500">Etymology</summary>
              <p className="mt-1">{e.ety}</p>
            </details>
          )}
        </div>
      ))}
      {rev && (
        <div className={entries ? "mt-6 border-t border-stone-100 pt-4 dark:border-stone-800" : ""}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">English words translated as this</h3>
          <ul className="space-y-1">
            {rev.map((r, i) => (
              <li key={i}>
                <Link className="wlink font-medium" to={wordHref(r.en)}>
                  {r.en}
                </Link>{" "}
                <span className="text-xs text-stone-400 uppercase">{r.pos}</span>{" "}
                {r.sense && <span className="text-stone-600 dark:text-stone-400">— {r.sense}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
