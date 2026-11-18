import { TRAlert } from "@tinyrack/ui/components/alert";
import { TRCard } from "@tinyrack/ui/components/card";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRSkeleton } from "@tinyrack/ui/components/skeleton";
import { TRText } from "@tinyrack/ui/components/text";
import { useEffect } from "react";
import { Link, type ShouldRevalidateFunctionArgs, useLocation, useNavigation } from "react-router";
import type { Route } from "./+types/word";
import { Collapsed, DictEntries } from "~/components/DictEntryView";
import { useDelayed } from "~/components/NavigationProgress";
import { SaveButton } from "~/components/SaveButton";
import { getEntry, search, setLoadingUrl } from "~/lib/data";
import { addRecent } from "~/lib/history";
import { posLabel, stringsFor, useT } from "~/lib/i18n";
import { type Dictionary, type DictId, headwordLang, LICENSE_URL, localized, maskHas } from "~/lib/dicts";
import { DICTIONARIES, parseDicts, useHydrated, useSettings } from "~/lib/settings";
import type { Backlink, Entry, SentencePair } from "~/lib/types";

// /{lang}/word?word=<headword>&dicts=<dictionary ids>&theme=<theme>
// One prerendered shell per UI language; the entry is loaded in the browser, fetching only the
// chunks of the selected dictionaries (see app/lib/data.ts).
//
// The page renders each selected dictionary as it is, one card per dictionary in the order of ?dicts=,
// using the same generic renderer for all of them (components/DictEntryView.tsx). Nothing here names
// a dictionary: cards come from the registry (app/lib/dicts.ts) and the loaded parts.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  setLoadingUrl(request.url);
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

/** First gloss of the first selected dictionary: the page description and the saved/recent list note. */
function firstGloss(entry: Entry, dicts: DictId[]): string | undefined {
  for (const d of dicts) {
    const s = entry.parts[d]?.entries?.[0]?.senses[0];
    if (s) return s.translations?.length ? s.translations.map((tr) => tr.word).join(", ") : s.gloss;
  }
  return undefined;
}

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const t = stringsFor(params.lang);
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
  const all = Object.values(entry.parts).flatMap((p) => p.entries ?? []);
  return all.some((e) => e.word === query) ? query : entry.w;
}

/**
 * True while another word is loading for long enough to notice. The page then shows the skeleton
 * instead of the previous word; quick loads and dictionary toggles keep the current content.
 */
function useLoadingOtherWord(word: string) {
  const pending = useNavigation().location;
  const { pathname } = useLocation();
  const other = !!pending && pending.pathname === pathname && (new URLSearchParams(pending.search).get("word")?.trim() ?? "") !== word;
  return useDelayed(other, 300);
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { loaded, word, suggestions } = loaderData;
  const settings = useSettings();
  const t = useT();
  const gloss = loaded ? firstGloss(loaded.entry, settings.dicts) : undefined;
  const loadingOther = useLoadingOtherWord(word);

  useEffect(() => {
    if (loaded) addRecent(headingFor(loaded.entry, word), gloss);
  }, [loaded?.entry.w, word]);

  if (loadingOther) return <WordSkeleton />;
  if (!loaded) return <NotFound word={word} suggestions={suggestions} />;
  const { entry, mask } = loaded;

  // one card per selected dictionary that has something for the word, in the URL's order
  const cards = settings.dicts
    .map((id) => ({ d: DICTIONARIES.find((x) => x.id === id)!, part: entry.parts[id] }))
    .filter(({ part }) => part?.entries?.length || part?.backlinks?.length || part?.pairs?.length);
  const available = DICTIONARIES.filter((d) => maskHas(mask, d.id));
  const lang = headwordLang(entry.parts);
  const heading = headingFor(entry, word);

  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-xl py-tinyrack-xl sm:py-tinyrack-2xl">
      <header className="flex items-start justify-between gap-tinyrack-md">
        <TRText as="h1" variant="display" lang={lang} className="min-w-0 break-words">
          {heading}
        </TRText>
        <SaveButton word={heading} gloss={gloss} />
      </header>

      {cards.length === 0 && (
        <TRAlert.Root variant="info">
          <TRAlert.Description>
            {settings.dicts.length === 0 ? t.noneSelected : t.onlyIn(available.map((d) => localized(d.name, settings.lang)).join(", "))}
          </TRAlert.Description>
        </TRAlert.Root>
      )}

      {cards.map(({ d, part }) => (
        <SourceCard key={d.id} d={d}>
          {part.entries?.length ? <DictEntries entries={part.entries} heading={heading} /> : null}
          {part.backlinks?.length ? <Backlinks items={part.backlinks} /> : null}
          {part.pairs?.length ? <Pairs pairs={part.pairs} /> : null}
        </SourceCard>
      ))}
    </article>
  );
}

/** One dictionary's card: its name, and its source and license, both linked (attribution). */
function SourceCard({ d, children }: { d: Dictionary; children: React.ReactNode }) {
  const settings = useSettings();
  return (
    <TRCard.Root variant="outlined" padding="lg" render={<section aria-labelledby={`src-${d.id}`} />}>
      <TRCard.Header className="flex flex-wrap items-baseline justify-between gap-tinyrack-sm">
        <TRCard.Title id={`src-${d.id}`} render={<TRText as="h2" variant="headingSm" />}>
          {localized(d.name, settings.lang)}
        </TRCard.Title>
        <TRText variant="caption" color="muted">
          <TRLink variant="muted" href={d.source.url} underline="hover">
            {d.source.name}
          </TRLink>{" "}
          ·{" "}
          <TRLink variant="muted" href={LICENSE_URL[d.license]} underline="hover">
            {d.license}
          </TRLink>
        </TRText>
      </TRCard.Header>
      <TRCard.Content className="flex flex-col gap-tinyrack-xl">{children}</TRCard.Content>
    </TRCard.Root>
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

/** Sentence pairs that contain the headword exactly: the sentence, then its translation. */
function Pairs({ pairs }: { pairs: SentencePair[] }) {
  return (
    <TRText as="span" className="flex flex-col gap-tinyrack-sm">
      <Collapsed items={pairs} limit={5}>
        {(shown) =>
          shown.map((p, i) => (
            <TRText as="span" key={i} className="flex flex-col">
              <TRText lang={p.lang}>{p.text}</TRText>
              <TRText variant="bodySm" color="muted" lang={p.translation.lang}>
                {p.translation.text}
              </TRText>
            </TRText>
          ))
        }
      </Collapsed>
    </TRText>
  );
}

function NotFound({ word, suggestions }: { word: string; suggestions: string[] }) {
  const t = useT();
  const settings = useSettings();
  const offline = useHydrated() && !navigator.onLine;
  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-lg py-tinyrack-2xl">
      {word && (
        <TRText as="h1" variant="display" className="break-words">
          {word}
        </TRText>
      )}
      <TRAlert.Root variant="neutral">
        {/* offline (PWA): an uncached word can't load, which is not the same as not existing */}
        <TRAlert.Title>{offline ? t.offline : t.notFound}</TRAlert.Title>
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

/** Gloss line widths of the placeholder rows, so they read as text rather than as bars. */
const SKELETON_ROWS = ["w-tinyrack-overlay-width-md", "w-tinyrack-measure-xl", "w-tinyrack-overlay-width-sm", "w-tinyrack-measure-lg"];

/**
 * Placeholder in the shape of a word page (heading, one source card with a part of speech, a
 * pronunciation and numbered sense rows) while the entry loads, so the content doesn't jump in.
 */
function WordSkeleton() {
  const t = useT();
  return (
    <article
      className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-xl py-tinyrack-xl sm:py-tinyrack-2xl"
      role="status"
      aria-busy="true"
      aria-label={t.loading}
    >
      <TRSkeleton className="h-tinyrack-3xl w-tinyrack-measure-md" />
      <TRCard.Root variant="outlined" padding="lg">
        <TRCard.Header className="flex items-baseline justify-between gap-tinyrack-sm">
          <TRSkeleton className="w-tinyrack-measure-md" />
          <TRSkeleton className="w-tinyrack-measure-sm max-sm:hidden" />
        </TRCard.Header>
        <TRCard.Content className="flex flex-col gap-tinyrack-sm">
          <TRSkeleton className="w-tinyrack-measure-xs" />
          <TRSkeleton className="w-tinyrack-measure-sm" />
          <TRText as="span" className="flex flex-col divide-y-tinyrack-default divide-tinyrack-border">
            {SKELETON_ROWS.map((w, i) => (
              <TRText as="span" key={i} className="flex flex-col gap-tinyrack-xs py-tinyrack-sm pl-tinyrack-xl">
                <TRSkeleton className={`${w} max-w-full`} />
                <TRSkeleton className="w-tinyrack-measure-md max-w-full" />
              </TRText>
            ))}
          </TRText>
        </TRCard.Content>
      </TRCard.Root>
    </article>
  );
}
