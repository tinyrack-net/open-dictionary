import { TRAccordion } from "@tinyrack/ui/components/accordion";
import { TRAlert } from "@tinyrack/ui/components/alert";
import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRCollapsible } from "@tinyrack/ui/components/collapsible";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRSeparator } from "@tinyrack/ui/components/separator";
import { TRSkeleton } from "@tinyrack/ui/components/skeleton";
import { TRText } from "@tinyrack/ui/components/text";
import { Link, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/word";
import { getEntry, search } from "~/lib/data";
import { posShort, STRINGS, useT } from "~/lib/i18n";
import { DICT } from "~/lib/keys";
import { DICTIONARIES, isLang, parseDicts, useSettings } from "~/lib/settings";
import { buildView, type Line, type PosGroup, type Translation, type WordView } from "~/lib/view";

// /{lang}/word?word=<headword>&dicts=<slugs>&theme=<theme>
// One prerendered shell per UI language; the entry is loaded in the browser, fetching only the
// chunks of the selected dictionaries that contain the word (see app/lib/data.ts).
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

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  const e = data?.loaded?.entry;
  const first = e?.enko?.[0]?.ko.map((k) => k.w).join(", ") ?? e?.wn?.[0]?.senses[0]?.def ?? e?.en?.[0]?.senses[0]?.g ?? e?.ko?.[0]?.senses[0]?.g;
  const w = e?.w ?? data?.word;
  return [{ title: w ? `${w} — ${t.siteName}` : t.siteName }, ...(first ? [{ name: "description", content: `${w}: ${first}` }] : [])];
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { loaded, word, suggestions } = loaderData;
  const settings = useSettings();
  const t = useT();

  if (!loaded) return <NotFound word={word} suggestions={suggestions} />;

  // Only what the selected dictionaries provide; the loader skipped the others' chunks.
  const entry = { ...loaded.entry };
  for (const d of DICTIONARIES) if (!settings.dicts.includes(d.id)) delete (entry as Record<string, unknown>)[d.id === "ko" ? "ko" : d.id];
  if (!settings.dicts.includes("ko")) delete entry.koRev;
  const view = buildView(entry);
  const available = DICTIONARIES.filter((d) => loaded.mask & DICT[d.id]);
  const empty = !view.translations.length && !view.meanings.length && !view.more.length && !view.formOf.length;

  return (
    <article className="mx-auto flex max-w-tinyrack-mdx-content-width flex-col gap-tinyrack-xl py-tinyrack-xl sm:py-tinyrack-2xl">
      <Head view={view} />

      {empty ? (
        <TRAlert.Root variant="info">
          <TRAlert.Description>
            {settings.dicts.length === 0 ? t.noneSelected : t.onlyIn(available.map((d) => t.dict[d.id]).join(", "))}
          </TRAlert.Description>
        </TRAlert.Root>
      ) : (
        <>
          {view.formOf.length > 0 && <FormOf view={view} />}
          {view.translations.length > 0 && (
            <Section title={view.korean ? t.englishSection : t.koreanSection}>
              <Translations groups={view.translations} korean={view.korean} />
            </Section>
          )}
          {(view.meanings.length > 0 || view.more.length > 0) && (
            <Section title={view.korean ? t.englishSection : t.meaningsSection}>
              {/* an inflected form ("ran") answers with its base word; its own leftovers stay folded */}
              <Meanings groups={view.meanings} more={view.more} folded={view.formOf.length > 0} />
            </Section>
          )}
          {view.examples.length > 0 && (
            <Section title={t.examplesSection}>
              <Examples items={view.examples} />
            </Section>
          )}
          {view.etymology && (
            <TRCollapsible.Root>
              <TRCollapsible.Trigger>{t.etymology}</TRCollapsible.Trigger>
              <TRCollapsible.Panel>
                <TRText as="p" variant="bodySm" color="muted">
                  {view.etymology}
                </TRText>
              </TRCollapsible.Panel>
            </TRCollapsible.Root>
          )}
          <Sources view={view} />
        </>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- sections

function Head({ view }: { view: WordView }) {
  const t = useT();
  return (
    <header className="flex flex-wrap items-baseline gap-x-tinyrack-lg gap-y-tinyrack-xs">
      <TRText as="h1" variant="display" lang={view.korean ? "ko" : "en"} className="break-words">
        {view.word}
      </TRText>
      <TRText as="p" color="muted" aria-label={t.pronunciation} className="flex flex-wrap items-baseline gap-x-tinyrack-md">
        {view.hanja && <TRText lang="ko">{view.hanja}</TRText>}
        {view.roman && <TRText as="i">{view.roman}</TRText>}
        {view.pron?.map((p) => (
          <TRText key={p.value + p.tag} className="flex items-baseline gap-tinyrack-2xs">
            {p.tag && (
              <TRText variant="caption" color="muted">
                {p.tag}
              </TRText>
            )}
            <TRText variant="code">{p.value}</TRText>
          </TRText>
        ))}
      </TRText>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-tinyrack-sm">
      <TRText as="h2" variant="label" color="muted">
        {title}
      </TRText>
      {children}
    </section>
  );
}

/** Part-of-speech label column used by every list on the page. */
function PosLabel({ pos }: { pos: string }) {
  const t = useT();
  return (
    <TRText variant="bodySm" color="muted" weight="medium" className="w-tinyrack-3xl shrink-0">
      {posShort(t, pos)}
    </TRText>
  );
}

function FormOf({ view }: { view: WordView }) {
  const t = useT();
  const settings = useSettings();
  return (
    <TRText as="p" className="flex flex-wrap items-baseline gap-x-tinyrack-md gap-y-tinyrack-xs">
      <TRText variant="label" color="muted">
        {t.formOf}
      </TRText>
      {view.formOf.map((f) => (
        <TRText key={f.word}>
          <TRLink render={<Link to={settings.wordHref(f.word)} />} className="text-tinyrack-lg">
            {f.word}
          </TRLink>{" "}
          <TRText variant="bodySm" color="muted">
            ({f.label})
          </TRText>
        </TRText>
      ))}
    </TRText>
  );
}

function Translations({ groups, korean }: { groups: PosGroup<Translation>[]; korean: boolean }) {
  const settings = useSettings();
  return (
    <dl className="flex flex-col gap-tinyrack-sm">
      {groups.map((g) => (
        <TRText as="span" key={g.pos} className="flex items-baseline gap-tinyrack-md">
          <TRText as="dt">
            <PosLabel pos={g.pos} />
          </TRText>
          <TRText as="dd" lang={korean ? "en" : "ko"} className="flex flex-wrap items-baseline gap-x-tinyrack-xs gap-y-tinyrack-2xs">
            {g.items.map((tr, i) => (
              <TRText key={tr.word} variant="headingSm" weight="regular">
                <TRLink render={<Link to={settings.wordHref(tr.word)} />} underline="hover">
                  {tr.word}
                </TRLink>
                {tr.note && (
                  <TRText variant="bodySm" color="muted">
                    {" "}
                    {tr.note}
                  </TRText>
                )}
                {i < g.items.length - 1 && <TRText color="muted">,</TRText>}
              </TRText>
            ))}
          </TRText>
        </TRText>
      ))}
    </dl>
  );
}

/**
 * Every meaning is one row; rows with examples or synonyms expand in place. Rare senses stay folded,
 * except when they are all there is (a Korean word with only rare senses, say).
 */
function Meanings({ groups, more, folded }: { groups: PosGroup<Line>[]; more: PosGroup<Line>[]; folded: boolean }) {
  const t = useT();
  const moreCount = more.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      {groups.length > 0 && <MeaningList groups={groups} />}
      {moreCount > 0 &&
        (groups.length > 0 || folded ? (
          <TRCollapsible.Root>
            <TRCollapsible.Trigger>{t.moreMeanings(moreCount)}</TRCollapsible.Trigger>
            <TRCollapsible.Panel>
              <MeaningList groups={more} />
            </TRCollapsible.Panel>
          </TRCollapsible.Root>
        ) : (
          <MeaningList groups={more} />
        ))}
    </>
  );
}

function MeaningList({ groups }: { groups: PosGroup<Line>[] }) {
  return (
    <TRAccordion.Root multiple className="divide-y-tinyrack-default divide-tinyrack-border">
      {groups.map((g) =>
        g.items.map((line, i) => <MeaningRow key={`${g.pos}-${i}`} pos={i === 0 ? g.pos : undefined} n={i + 1} line={line} value={`${g.pos}-${i}`} />),
      )}
    </TRAccordion.Root>
  );
}

function MeaningRow({ pos, n, line, value }: { pos?: string; n: number; line: Line; value: string }) {
  const t = useT();
  const hasDetail = !!(line.examples?.length || line.synonyms?.length || line.broader?.length);
  const label = (
    <TRText as="span" className="flex min-w-0 flex-1 items-baseline gap-tinyrack-md text-left">
      {pos ? <PosLabel pos={pos} /> : <TRText as="span" className="w-tinyrack-3xl shrink-0" aria-hidden="true" />}
      <TRText variant="bodySm" color="muted" className="tabular-nums">
        {n}
      </TRText>
      <TRText className="min-w-0 flex-1" weight="regular">
        {line.tags?.map((tag) => (
          <TRBadge key={tag} className="mr-tinyrack-xs">
            {tag}
          </TRBadge>
        ))}
        {line.text}
      </TRText>
    </TRText>
  );
  if (!hasDetail)
    return (
      <TRText as="span" className="flex py-tinyrack-sm pl-tinyrack-lg pr-tinyrack-3xl">
        {label}
      </TRText>
    );
  return (
    <TRAccordion.Item value={value}>
      <TRAccordion.Header>
        <TRAccordion.Trigger className="min-h-0 py-tinyrack-sm">{label}</TRAccordion.Trigger>
      </TRAccordion.Header>
      <TRAccordion.Panel>
        <TRText as="span" className="flex flex-col gap-tinyrack-sm pl-tinyrack-3xl">
          {line.examples?.map((x) => (
            <Example key={x.text} text={x.text} sub={x.sub} />
          ))}
          <Related label={t.synonyms} words={line.synonyms} />
          <Related label={t.typeOf} words={line.broader} />
        </TRText>
      </TRAccordion.Panel>
    </TRAccordion.Item>
  );
}

function Examples({ items }: { items: { text: string; sub?: string[] }[] }) {
  return (
    <ul className="flex flex-col gap-tinyrack-sm">
      {items.map((x) => (
        <li key={x.text}>
          <Example text={x.text} sub={x.sub} />
        </li>
      ))}
    </ul>
  );
}

function Example({ text, sub }: { text: string; sub?: string[] }) {
  return (
    <TRText as="span" className="flex flex-col">
      <TRText>{text}</TRText>
      {sub?.map((s) => (
        <TRText key={s} variant="bodySm" color="muted">
          {s}
        </TRText>
      ))}
    </TRText>
  );
}

function Related({ label, words }: { label: string; words?: string[] }) {
  const settings = useSettings();
  if (!words?.length) return null;
  return (
    <TRText as="p" variant="bodySm">
      <TRText color="muted">{label}: </TRText>
      {words.map((w, i) => (
        <TRText key={w}>
          {i > 0 && ", "}
          <TRLink render={<Link to={settings.wordHref(w)} />} underline="hover">
            {w}
          </TRLink>
        </TRText>
      ))}
    </TRText>
  );
}

function Sources({ view }: { view: WordView }) {
  const t = useT();
  return (
    <footer className="flex flex-col gap-tinyrack-sm">
      <TRSeparator />
      <TRText as="p" variant="caption" color="muted">
        {t.sourcesLine}:{" "}
        {DICTIONARIES.filter((d) => view.sources.includes(d.id))
          .map((d) => `${t.dict[d.id]} (${d.license})`)
          .join(" · ")}
      </TRText>
    </footer>
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
      <TRSkeleton shape="text" className="w-tinyrack-measure-xl" />
      <TRSkeleton shape="rectangle" className="h-tinyrack-measure-md w-full" />
    </article>
  );
}
