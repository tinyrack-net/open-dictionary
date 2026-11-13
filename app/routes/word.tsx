import { TRAlert } from "@tinyrack/ui/components/alert";
import { TRCard } from "@tinyrack/ui/components/card";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRSkeleton } from "@tinyrack/ui/components/skeleton";
import { TRText } from "@tinyrack/ui/components/text";
import { useEffect } from "react";
import { Link, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/word";
import { Collapsed, DictEntries } from "~/components/DictEntryView";
import { SaveButton } from "~/components/SaveButton";
import { getEntry, search } from "~/lib/data";
import { addRecent } from "~/lib/history";
import { posLabel, STRINGS, useT } from "~/lib/i18n";
import { DICT, type DictId } from "~/lib/keys";
import { DICTIONARIES, isLang, parseDicts, useSettings } from "~/lib/settings";
import type { Backlink, DictEntry, Entry, SentencePair } from "~/lib/types";

// /{lang}/word?word=<headword>&dicts=<slugs>&theme=<theme>
// One prerendered shell per UI language; the entry is loaded in the browser, fetching only the
// chunks of the selected dictionaries (see app/lib/data.ts).
//
// The page renders each selected source as it is, one card per source in the order of ?dicts=,
// using the same generic renderer for all of them (components/DictEntryView.tsx).
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const word = params.get("word")?.trim() ?? "";
  if (!word) return { word, loaded: null, suggestions: [] as string[] };
  const loaded = await getEntry(word, parseDicts(params.get("dicts")));
  const suggestions = loaded ? [] : (await search(word, 8)).map((r) => r[0]);
  return { word, loaded, suggestions };
}

export function HydrateFallback() {
  return <WordSkeleton />;
}

// Reload when the word changes, or when a newly selected dictionary hasn't been fetched yet.
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  if (currentUrl.searchParams.get("word") !== nextUrl.searchParams.get("word")) return true;
  const before = parseDicts(currentUrl.searchParams.get("dicts"));
  return parseDicts(nextUrl.searchParams.get("dicts")).some((d) => !before.includes(d));
}

/** First gloss of the first selected source: the page description and the saved/recent list note. */
function firstGloss(entry: Entry, dicts: DictId[]): string | undefined {
  for (const d of dicts) {
    const list = d === "ko" ? entry.ko : entry[d];
    const s = list?.[0]?.senses[0];
    if (s) return s.translations?.length ? s.translations.map((tr) => tr.word).join(", ") : s.gloss;
  }
  return undefined;
}

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  const e = data?.loaded?.entry;
  const w = e?.w ?? data?.word;
  const gloss = e && firstGloss(e, DICTIONARIES.map((d) => d.id));
  return [{ title: w ? `${w} — ${t.siteName}` : t.siteName }, ...(gloss ? [{ name: "description", content: `${w}: ${gloss}` }] : [])];
}

/**
 * Page heading: the spelling the user asked for when some source has an entry spelled exactly that
 * way ("do", not "DO"); otherwise the index's spelling. Entries spelled differently show their own
 * spelling in their headword line.
 */
function headingFor(entry: Entry, query: string): string {
  const all = [entry.wn, entry.en, entry.enko, entry.ko].flatMap((list) => list ?? []);
  return all.some((e) => e.word === query) ? query : entry.w;
}

/** What one source has for the headword. */
function sourceContent(entry: Entry, id: DictId): { entries?: DictEntry[]; backlinks?: Backlink[] } {
  if (id === "ko") return { entries: entry.ko, backlinks: entry.koBacklinks };
  return { entries: entry[id] };
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { loaded, word, suggestions } = loaderData;
  const settings = useSettings();
  const t = useT();
  const gloss = loaded ? firstGloss(loaded.entry, settings.dicts) : undefined;

  useEffect(() => {
    if (loaded) addRecent(headingFor(loaded.entry, word), gloss);
  }, [loaded?.entry.w, word]);

  if (!loaded) return <NotFound word={word} suggestions={suggestions} />;
  const { entry, mask } = loaded;

  const sources = settings.dicts
    .map((id) => ({ id, ...sourceContent(entry, id) }))
    .filter((s) => s.entries?.length || s.backlinks?.length);
  const pairs = settings.dicts.includes("enko") || settings.dicts.includes("ko") ? entry.pairs : undefined;
  const available = DICTIONARIES.filter((d) => mask & DICT[d.id]);
  const korean = /[\uac00-\ud7af]/.test(entry.w);
  const heading = headingFor(entry, word);

  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-xl py-tinyrack-xl sm:py-tinyrack-2xl">
      <header className="flex items-start justify-between gap-tinyrack-md">
        <TRText as="h1" variant="display" lang={korean ? "ko" : "en"} className="min-w-0 break-words">
          {heading}
        </TRText>
        <SaveButton word={heading} gloss={gloss} />
      </header>

      {sources.length === 0 && !pairs?.length && (
        <TRAlert.Root variant="info">
          <TRAlert.Description>
            {settings.dicts.length === 0 ? t.noneSelected : t.onlyIn(available.map((d) => t.dict[d.id]).join(", "))}
          </TRAlert.Description>
        </TRAlert.Root>
      )}

      {sources.map((s) => {
        const d = DICTIONARIES.find((x) => x.id === s.id)!;
        return (
          <TRCard.Root key={s.id} variant="outlined" padding="lg" render={<section aria-labelledby={`src-${s.id}`} />}>
            <TRCard.Header className="flex flex-wrap items-baseline justify-between gap-tinyrack-sm">
              <TRCard.Title id={`src-${s.id}`} render={<TRText as="h2" variant="headingSm" />}>
                {t.dict[s.id]}
              </TRCard.Title>
              <TRText variant="caption" color="muted">
                {d.source} · {d.license}
              </TRText>
            </TRCard.Header>
            <TRCard.Content className="flex flex-col gap-tinyrack-xl">
              {s.entries?.length ? <DictEntries entries={s.entries} heading={heading} /> : null}
              {s.backlinks?.length ? <Backlinks items={s.backlinks} /> : null}
            </TRCard.Content>
          </TRCard.Root>
        );
      })}

      {pairs?.length ? <Pairs pairs={pairs} korean={korean} /> : null}
    </article>
  );
}

// ---------------------------------------------------------------- non-entry facts

/** "This word is given as a translation of …" — a fact from another entry, shown as such. */
function Backlinks({ items }: { items: Backlink[] }) {
  const t = useT();
  const settings = useSettings();
  return (
    <section className="flex flex-col gap-tinyrack-sm">
      <TRText as="h3" variant="label">
        {t.backlinksTitle}
      </TRText>
      <ul className="flex flex-col gap-tinyrack-xs">
        <Collapsed items={items}>
          {(shown) =>
            shown.map((b, i) => (
              <li key={i}>
                <TRText as="p">
                  <TRLink render={<Link to={settings.wordHref(b.word)} />} underline="hover" lang={b.lang}>
                    {b.word}
                  </TRLink>{" "}
                  <TRText variant="caption" color="muted">
                    {posLabel(t, b.pos)}
                  </TRText>
                  {b.sense && <TRText color="muted"> — {b.sense}</TRText>}
                </TRText>
              </li>
            ))
          }
        </Collapsed>
      </ul>
    </section>
  );
}

/** Tatoeba sentence pairs that contain the headword exactly. Shown in the headword's language first. */
function Pairs({ pairs, korean }: { pairs: SentencePair[]; korean: boolean }) {
  const t = useT();
  return (
    <TRCard.Root variant="outlined" padding="lg" render={<section aria-labelledby="src-ex" />}>
      <TRCard.Header className="flex flex-wrap items-baseline justify-between gap-tinyrack-sm">
        <TRCard.Title id="src-ex" render={<TRText as="h2" variant="headingSm" />}>
          {t.pairsTitle}
        </TRCard.Title>
        <TRText variant="caption" color="muted">
          Tatoeba · CC BY 2.0 FR
        </TRText>
      </TRCard.Header>
      <TRCard.Content className="flex flex-col gap-tinyrack-sm">
        <Collapsed items={pairs} limit={5}>
          {(shown) =>
            shown.map((p, i) => (
              <TRText as="span" key={i} className="flex flex-col">
                <TRText lang={korean ? "ko" : "en"}>{korean ? p.ko : p.en}</TRText>
                <TRText variant="bodySm" color="muted" lang={korean ? "en" : "ko"}>
                  {korean ? p.en : p.ko}
                </TRText>
              </TRText>
            ))
          }
        </Collapsed>
      </TRCard.Content>
    </TRCard.Root>
  );
}

function NotFound({ word, suggestions }: { word: string; suggestions: string[] }) {
  const t = useT();
  const settings = useSettings();
  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-lg py-tinyrack-2xl">
      {word && (
        <TRText as="h1" variant="display" className="break-words">
          {word}
        </TRText>
      )}
      <TRAlert.Root variant="neutral">
        <TRAlert.Title>{t.notFound}</TRAlert.Title>
        {suggestions.length > 0 && (
          <TRAlert.Description render={<TRText as="span" className="flex flex-wrap items-center gap-tinyrack-xs" />}>
            {t.didYouMean}:
            {suggestions.map((s) => (
              <TRLinkButton key={s} appearance="outline" uiSize="sm" render={<Link to={settings.wordHref(s)} />}>
                {s}
              </TRLinkButton>
            ))}
          </TRAlert.Description>
        )}
      </TRAlert.Root>
    </article>
  );
}

function WordSkeleton() {
  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-xl py-tinyrack-2xl" aria-busy="true">
      <TRSkeleton shape="text" className="w-tinyrack-measure-lg" />
      <TRSkeleton shape="rectangle" className="h-tinyrack-measure-md w-full" />
    </article>
  );
}
