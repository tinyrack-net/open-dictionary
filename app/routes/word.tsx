import { TRAlert } from "@tinyrack/ui/components/alert";
import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRCard } from "@tinyrack/ui/components/card";
import { TRCollapsible } from "@tinyrack/ui/components/collapsible";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRSkeleton } from "@tinyrack/ui/components/skeleton";
import { TRText } from "@tinyrack/ui/components/text";
import { Link, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/word";
import { DictToggles } from "~/components/DictToggles";
import { getEntry, search } from "~/lib/data";
import { posLabel, STRINGS, useT } from "~/lib/i18n";
import { DICT } from "~/lib/keys";
import { DICTIONARIES, isLang, parseDicts, useSettings } from "~/lib/settings";
import type { EnKoGroup, Entry, KoReverse, WiktEntry, WnEntry } from "~/lib/types";

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
// Theme changes and deselecting a dictionary never refetch.
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  if (currentUrl.searchParams.get("word") !== nextUrl.searchParams.get("word")) return true;
  const before = parseDicts(currentUrl.searchParams.get("dicts"));
  return parseDicts(nextUrl.searchParams.get("dicts")).some((d) => !before.includes(d));
}

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  const e = data?.loaded?.entry;
  const first = e?.wn?.[0]?.senses[0]?.def ?? e?.en?.[0]?.senses[0]?.g ?? e?.ko?.[0]?.senses[0]?.g ?? e?.enko?.[0]?.ko.map((k) => k.w).join(", ");
  const w = e?.w ?? data?.word;
  return [{ title: w ? `${w} — ${t.siteName}` : t.siteName }, ...(first ? [{ name: "description", content: `${w}: ${first}` }] : [])];
}

export default function WordPage({ loaderData }: Route.ComponentProps) {
  const { loaded, word, suggestions } = loaderData;
  const settings = useSettings();
  const t = useT();

  if (!loaded) {
    return (
      <article className="flex flex-col gap-tinyrack-lg py-tinyrack-2xl">
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

  const { entry, mask } = loaded;
  const sections = {
    wn: entry.wn && <WordNet entries={entry.wn} />,
    en: entry.en && <Wiktionary entries={entry.en} />,
    enko: entry.enko && <EnKo groups={entry.enko} />,
    ko: (entry.ko || entry.koRev) && <Korean entries={entry.ko} rev={entry.koRev} />,
  };
  const available = DICTIONARIES.filter((d) => mask & DICT[d.id]);
  const shown = available.filter((d) => settings.dicts.includes(d.id) && sections[d.id]);

  return (
    <article className="flex flex-col gap-tinyrack-xl py-tinyrack-2xl">
      <header className="flex flex-col gap-tinyrack-sm">
        <TRText as="h1" variant="display" lang={/[\uac00-\ud7af]/.test(entry.w) ? "ko" : "en"} className="break-words">
          {entry.w}
        </TRText>
        <Pronunciation entry={entry} />
      </header>

      <DictToggles />

      {shown.length === 0 && (
        <TRAlert.Root variant="info">
          <TRAlert.Description>
            {settings.dicts.length === 0 ? t.noneSelected : t.onlyIn(available.map((d) => t.dict[d.id]).join(", "))}
          </TRAlert.Description>
        </TRAlert.Root>
      )}

      {shown.map((d) => (
        <TRCard.Root key={d.id} variant="outlined" padding="lg" render={<section aria-labelledby={`dict-${d.id}`} />}>
          <TRCard.Header className="flex flex-wrap items-baseline justify-between gap-tinyrack-sm">
            <TRCard.Title id={`dict-${d.id}`} render={<TRText as="h2" variant="headingSm" />}>
              {t.dict[d.id]}
            </TRCard.Title>
            <TRText variant="caption" color="muted">
              {d.source} · {d.license}
            </TRText>
          </TRCard.Header>
          <TRCard.Content className="flex flex-col gap-tinyrack-lg">{sections[d.id]}</TRCard.Content>
        </TRCard.Root>
      ))}
    </article>
  );
}

// ---------------------------------------------------------------- pieces

function WordSkeleton() {
  return (
    <article className="flex flex-col gap-tinyrack-xl py-tinyrack-2xl" aria-busy="true">
      <TRSkeleton shape="text" className="w-tinyrack-measure-lg" />
      <TRSkeleton shape="text" className="w-tinyrack-measure-md" />
      <TRSkeleton shape="rectangle" className="h-tinyrack-measure-md w-full" />
    </article>
  );
}

function Pronunciation({ entry }: { entry: Entry }) {
  const t = useT();
  const wn = entry.wn?.flatMap((w) => w.pron ?? []) ?? [];
  const items = wn.length
    ? wn.map((p) => ({ v: `/${p.v}/`, tag: p.var }))
    : (entry.en?.[0]?.ipa ?? entry.ko?.[0]?.ipa ?? []).map((p) => ({ v: p.v, tag: p.tags?.[0] }));
  const seen = new Set<string>();
  const uniq = items.filter((p) => !seen.has(p.v + p.tag) && seen.add(p.v + p.tag)).slice(0, 4);
  const ko = entry.ko?.[0];
  if (!uniq.length && !ko?.roman) return null;
  return (
    <TRText as="p" color="muted" aria-label={t.pronunciation} className="flex flex-wrap items-center gap-x-tinyrack-lg gap-y-tinyrack-xs">
      {ko?.roman && <TRText as="i">{ko.roman}</TRText>}
      {ko?.hanja && <TRText lang="ko">{ko.hanja}</TRText>}
      {uniq.map((p) => (
        <TRText key={p.v + p.tag} className="flex items-center gap-tinyrack-xs">
          {p.tag && <TRBadge>{p.tag}</TRBadge>}
          <TRText variant="code">{p.v}</TRText>
        </TRText>
      ))}
    </TRText>
  );
}

function WordLinks({ words }: { words: string[] }) {
  const settings = useSettings();
  return (
    <>
      {words.map((w, i) => (
        <TRText key={w + i}>
          {i > 0 && ", "}
          <TRLink render={<Link to={settings.wordHref(w)} />} underline="hover">
            {w}
          </TRLink>
        </TRText>
      ))}
    </>
  );
}

function Pos({ children }: { children: string }) {
  const t = useT();
  return (
    <TRText as="h3" variant="label" color="muted">
      {posLabel(t, children)}
    </TRText>
  );
}

function Related({ label, words }: { label: string; words?: string[] }) {
  if (!words?.length) return null;
  return (
    <TRText variant="bodySm">
      <TRText color="muted">{label}: </TRText>
      <WordLinks words={words} />
    </TRText>
  );
}

function Etymology({ text }: { text?: string }) {
  const t = useT();
  if (!text) return null;
  return (
    <TRCollapsible.Root>
      <TRCollapsible.Trigger>{t.etymology}</TRCollapsible.Trigger>
      <TRCollapsible.Panel>
        <TRText as="p" variant="bodySm" color="muted" className="reading-measure">
          {text}
        </TRText>
      </TRCollapsible.Panel>
    </TRCollapsible.Root>
  );
}

function Example({ text, sub }: { text: string; sub?: (string | undefined)[] }) {
  return (
    <blockquote className="border-l-tinyrack-strong border-tinyrack-border pl-tinyrack-md">
      <TRText as="p" variant="bodySm">
        {text}
      </TRText>
      {sub?.filter(Boolean).map((s) => (
        <TRText as="p" key={s} variant="bodySm" color="muted">
          {s}
        </TRText>
      ))}
    </blockquote>
  );
}

function SenseItem({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-col gap-tinyrack-xs pl-tinyrack-2xs">{children}</li>;
}

function SenseList({ children }: { children: React.ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-tinyrack-md pl-tinyrack-xl marker:text-tinyrack-text-muted">{children}</ol>;
}

function WordNet({ entries }: { entries: WnEntry[] }) {
  const t = useT();
  return (
    <>
      {entries.map((e, i) => (
        <section key={i} className="flex flex-col gap-tinyrack-sm">
          <Pos>{e.pos}</Pos>
          <SenseList>
            {e.senses.map((s, j) => (
              <SenseItem key={j}>
                <TRText as="p" className="reading-measure">
                  {s.def}
                </TRText>
                {s.ex?.map((x) => (
                  <Example key={x} text={`“${x}”`} />
                ))}
                {(s.syn || s.broader) && (
                  <TRText as="p" className="flex flex-wrap gap-x-tinyrack-lg">
                    <Related label={t.synonyms} words={s.syn} />
                    <Related label={t.typeOf} words={s.broader} />
                  </TRText>
                )}
              </SenseItem>
            ))}
          </SenseList>
        </section>
      ))}
    </>
  );
}

function WiktSenses({ entry }: { entry: WiktEntry }) {
  const t = useT();
  return (
    <SenseList>
      {entry.senses.map((s, j) => (
        <SenseItem key={j}>
          <TRText as="p" className="reading-measure">
            {s.tags?.map((tag) => (
              <TRBadge key={tag} className="mr-tinyrack-xs">
                {tag}
              </TRBadge>
            ))}
            {s.parent && <TRText color="muted">{s.parent} → </TRText>}
            {s.g}
            {s.of && (
              <TRText variant="bodySm">
                {" → "}
                <WordLinks words={[s.of]} />
              </TRText>
            )}
          </TRText>
          {s.ex?.map((x, k) => (
            <Example key={k} text={x.t} sub={[x.roman, x.en]} />
          ))}
          {s.syn && (
            <TRText as="p">
              <Related label={t.synonyms} words={s.syn} />
            </TRText>
          )}
        </SenseItem>
      ))}
    </SenseList>
  );
}

function Wiktionary({ entries }: { entries: WiktEntry[] }) {
  return (
    <>
      {entries.map((e, i) => (
        <section key={i} className="flex flex-col gap-tinyrack-sm">
          <Pos>{e.pos}</Pos>
          {e.forms && (
            <TRText as="p" variant="bodySm" className="flex flex-wrap gap-x-tinyrack-md">
              {e.forms.map((f, k) => (
                <TRText key={k}>
                  {f.tags && <TRText color="muted">{f.tags.join(" ")} </TRText>}
                  <TRText weight="medium">{f.f}</TRText>
                </TRText>
              ))}
            </TRText>
          )}
          <WiktSenses entry={e} />
          <Etymology text={e.ety} />
        </section>
      ))}
    </>
  );
}

function EnKo({ groups }: { groups: EnKoGroup[] }) {
  const settings = useSettings();
  const t = useT();
  return (
    <dl className="flex flex-col divide-y-tinyrack-default divide-tinyrack-border">
      {groups.map((g, i) => (
        <TRText
          as="span"
          key={i}
          className="grid gap-tinyrack-xs py-tinyrack-md first:pt-0 sm:grid-cols-5 sm:gap-tinyrack-lg"
        >
          <TRText as="dt" color="muted" className="sm:col-span-2">
            <TRBadge className="mr-tinyrack-xs">{posLabel(t, g.pos)}</TRBadge>
            {g.sense || "—"}
          </TRText>
          <TRText as="dd" lang="ko" className="flex flex-wrap gap-x-tinyrack-md gap-y-tinyrack-2xs sm:col-span-3">
            {g.ko.map((k) => (
              <TRText key={k.w}>
                <TRLink render={<Link to={settings.wordHref(k.w)} />} underline="hover" className="text-tinyrack-lg">
                  {k.w}
                </TRLink>
                {(k.alt || k.roman) && (
                  <TRText variant="bodySm" color="muted">
                    {" "}
                    {k.alt}
                    {k.alt && k.roman && " "}
                    {k.roman && <TRText as="i">{k.roman}</TRText>}
                  </TRText>
                )}
              </TRText>
            ))}
          </TRText>
        </TRText>
      ))}
    </dl>
  );
}

function Korean({ entries, rev }: { entries?: WiktEntry[]; rev?: KoReverse[] }) {
  const settings = useSettings();
  const t = useT();
  return (
    <>
      {entries?.map((e, i) => (
        <section key={i} className="flex flex-col gap-tinyrack-sm">
          <Pos>{e.pos}</Pos>
          {e.hanja && (
            <TRText as="p" color="muted" lang="ko">
              {e.hanja}
            </TRText>
          )}
          <WiktSenses entry={e} />
          <Etymology text={e.ety} />
        </section>
      ))}
      {rev && (
        <section className="flex flex-col gap-tinyrack-sm">
          <TRText as="h3" variant="label" color="muted">
            {t.translatedAs}
          </TRText>
          <ul className="flex flex-col gap-tinyrack-xs">
            {rev.map((r, i) => (
              <li key={i}>
                <TRText as="p">
                  <TRLink render={<Link to={settings.wordHref(r.en)} />} underline="hover" lang="en">
                    {r.en}
                  </TRLink>{" "}
                  <TRBadge>{posLabel(t, r.pos)}</TRBadge>{" "}
                  {r.sense && <TRText color="muted">— {r.sense}</TRText>}
                </TRText>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
