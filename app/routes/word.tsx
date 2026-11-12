import { Link, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/word";
import { DictPicker } from "~/components/DictPicker";
import { getEntry, search } from "~/lib/data";
import { DICTIONARIES, useDicts, useLinks } from "~/lib/dicts";
import { isLang, posLabel, STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";
import type { EnKoGroup, Entry, KoReverse, WiktEntry, WnEntry } from "~/lib/types";

async function load(word: string) {
  const entry = await getEntry(word);
  const suggestions = entry ? [] : (await search(word, 8)).map((r) => r[0]);
  return { word, entry, suggestions };
}

// Build time: popular words are prerendered to static HTML (+ .data for client navigation).
export async function loader({ params }: Route.LoaderArgs) {
  return load(params.word);
}

// Runtime: every other word is loaded in the browser from the sharded JSON files.
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return load(params.word);
}

// The entry doesn't depend on ?dicts=, so toggling dictionaries must not refetch it.
export function shouldRevalidate({ currentParams, nextParams, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (currentParams.word === nextParams.word && currentParams.lang === nextParams.lang) return false;
  return defaultShouldRevalidate;
}

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  const e = data?.entry;
  const first = e?.wn?.[0]?.senses[0]?.def ?? e?.en?.[0]?.senses[0]?.g ?? e?.ko?.[0]?.senses[0]?.g ?? e?.enko?.[0]?.ko.map((k) => k.w).join(", ");
  const w = e?.w ?? data?.word ?? params.word;
  return [
    { title: `${w} — ${t.siteName}` },
    ...(first ? [{ name: "description", content: `${w}: ${first}` }] : []),
    ...(e ? alternates(`/word/${encodeURIComponent(params.word)}`) : [{ name: "robots", content: "noindex" }]),
  ];
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { entry, word, suggestions } = loaderData;
  const { enabled } = useDicts();
  const links = useLinks();
  const t = useT();

  if (!entry) {
    return (
      <div className="py-10">
        <h1 className="font-serif text-4xl font-semibold break-words">{word}</h1>
        <div role="alert" className="alert alert-soft mt-6">
          <span>{t.notFound}</span>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-base-content/60">{t.didYouMean}:</span>
            {suggestions.map((s) => (
              <Link key={s} className="badge badge-outline badge-lg" to={links.word(s)}>
                {s}
              </Link>
            ))}
          </div>
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
        <div role="alert" className="alert alert-info alert-soft mt-8">
          <span>{enabled.length === 0 ? t.noneSelected : t.onlyIn(available.map((d) => t.dict[d.id]).join(", "))}</span>
        </div>
      )}
      {shown.map((d) => (
        <section key={d.id} className="card card-border mt-6 bg-base-100 shadow-sm" aria-labelledby={`dict-${d.id}`}>
          <div className="card-body gap-4 p-5 sm:p-7">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-200 pb-3">
              <h2 id={`dict-${d.id}`} className="card-title">
                {t.dict[d.id]}
              </h2>
              <span className="text-xs text-base-content/50">
                {d.source} · {d.license}
              </span>
            </header>
            {sections[d.id]}
          </div>
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
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base-content/70">
      {ko?.roman && <span className="italic">{ko.roman}</span>}
      {ko?.hanja && <span>{ko.hanja}</span>}
      {uniq.map((p) => (
        <span key={p.v + p.tag} className="flex items-center gap-1">
          {p.tag && <span className="badge badge-ghost badge-xs">{p.tag}</span>}
          <span className="font-mono text-[0.95em]">{p.v}</span>
        </span>
      ))}
    </p>
  );
}

function WordLinks({ words }: { words: string[] }) {
  const links = useLinks();
  return (
    <>
      {words.map((w, i) => (
        <span key={w + i}>
          {i > 0 && ", "}
          <Link className="link link-primary link-hover" to={links.word(w)}>
            {w}
          </Link>
        </span>
      ))}
    </>
  );
}

function Pos({ children }: { children: string }) {
  const t = useT();
  return <h3 className="mt-2 mb-1 text-sm font-semibold tracking-wide text-base-content/60 uppercase first:mt-0">{posLabel(t, children)}</h3>;
}

function Related({ label, words }: { label: string; words?: string[] }) {
  if (!words?.length) return null;
  return (
    <span className="mr-4 text-sm">
      <span className="text-base-content/50">{label}:</span> <WordLinks words={words} />
    </span>
  );
}

function Etymology({ text }: { text?: string }) {
  const t = useT();
  if (!text) return null;
  return (
    <details className="collapse-arrow collapse mt-2 border border-base-200 text-sm">
      <summary className="collapse-title min-h-0 py-2 text-base-content/60">{t.etymology}</summary>
      <div className="collapse-content">
        <p>{text}</p>
      </div>
    </details>
  );
}

function WordNet({ entries }: { entries: WnEntry[] }) {
  const t = useT();
  return (
    <>
      {entries.map((e, i) => (
        <div key={i}>
          <Pos>{e.pos}</Pos>
          <ol className="list-decimal space-y-3 pl-6 marker:text-base-content/40">
            {e.senses.map((s, j) => (
              <li key={j}>
                <p>{s.def}</p>
                {s.ex?.map((x, k) => (
                  <p key={k} className="mt-0.5 text-base-content/70 italic">
                    “{x}”
                  </p>
                ))}
                {(s.syn || s.broader) && (
                  <p className="mt-1">
                    <Related label={t.synonyms} words={s.syn} />
                    <Related label={t.typeOf} words={s.broader} />
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
  const t = useT();
  return (
    <ol className="list-decimal space-y-3 pl-6 marker:text-base-content/40">
      {entry.senses.map((s, j) => (
        <li key={j}>
          <p>
            {s.tags?.map((tag) => (
              <span key={tag} className="badge badge-ghost badge-sm mr-1 align-middle">
                {tag}
              </span>
            ))}
            {s.parent && <span className="text-base-content/60">{s.parent} → </span>}
            {s.g}
            {s.of && (
              <span className="ml-1 text-sm">
                → <WordLinks words={[s.of]} />
              </span>
            )}
          </p>
          {s.ex?.map((x, k) => (
            <blockquote key={k} className="mt-1 border-l-2 border-base-300 pl-3 text-sm">
              <p>{x.t}</p>
              {x.roman && <p className="text-base-content/60 italic">{x.roman}</p>}
              {x.en && <p className="text-base-content/60">{x.en}</p>}
            </blockquote>
          ))}
          {s.syn && (
            <p className="mt-1">
              <Related label={t.synonyms} words={s.syn} />
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
            <p className="mb-2 flex flex-wrap gap-x-3 text-sm">
              {e.forms.map((f, k) => (
                <span key={k}>
                  {f.tags && <span className="text-base-content/50">{f.tags.join(" ")} </span>}
                  <b className="font-medium">{f.f}</b>
                </span>
              ))}
            </p>
          )}
          <SenseList entry={e} />
          <Etymology text={e.ety} />
        </div>
      ))}
    </>
  );
}

function EnKo({ groups }: { groups: EnKoGroup[] }) {
  const links = useLinks();
  const t = useT();
  return (
    <ul className="list">
      {groups.map((g, i) => (
        <li key={i} className="list-row grid-cols-1 gap-1 px-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
          <div className="text-base-content/70">
            <span className="badge badge-ghost badge-xs mr-1.5 align-middle">{posLabel(t, g.pos)}</span>
            {g.sense || "—"}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {g.ko.map((k) => (
              <span key={k.w}>
                <Link className="link link-primary link-hover text-lg" to={links.word(k.w)}>
                  {k.w}
                </Link>
                {(k.alt || k.roman) && (
                  <span className="ml-1 text-sm text-base-content/60">
                    {k.alt && <span className="mr-1">{k.alt}</span>}
                    {k.roman && <i>{k.roman}</i>}
                  </span>
                )}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Korean({ entries, rev }: { entries?: WiktEntry[]; rev?: KoReverse[] }) {
  const links = useLinks();
  const t = useT();
  return (
    <>
      {entries?.map((e, i) => (
        <div key={i}>
          <Pos>{e.pos}</Pos>
          {e.hanja && <p className="mb-1 text-base-content/70">{e.hanja}</p>}
          <SenseList entry={e} />
          <Etymology text={e.ety} />
        </div>
      ))}
      {rev && (
        <div className={entries ? "mt-2 border-t border-base-200 pt-4" : ""}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-base-content/60 uppercase">{t.translatedAs}</h3>
          <ul className="space-y-1">
            {rev.map((r, i) => (
              <li key={i}>
                <Link className="link link-primary link-hover font-medium" to={links.word(r.en)}>
                  {r.en}
                </Link>{" "}
                <span className="badge badge-ghost badge-xs align-middle">{posLabel(t, r.pos)}</span>{" "}
                {r.sense && <span className="text-base-content/70">— {r.sense}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
