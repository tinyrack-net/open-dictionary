// Generic renderer for the neutral format (app/lib/types.ts). It renders exactly what an entry
// contains, in the source's order, and has no code that depends on which dictionary it came from.
// The only display rule is the same for every source: long lists show their first items and a
// "show all" button (nothing is dropped).
import { TRAccordion } from "@tinyrack/ui/components/accordion";
import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRButton } from "@tinyrack/ui/components/button";
import { TRCollapsible } from "@tinyrack/ui/components/collapsible";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import { useState } from "react";
import { Link } from "react-router";
import { AudioButton } from "~/components/AudioButton";
import { posLabel, tagLabel, useT } from "~/lib/i18n";
import { useSettings } from "~/lib/settings";
import type { DictEntry, Example, Form, Pron, RelationKind, Relations, Sense, Translation, WordRef } from "~/lib/types";

/** How many items a list shows before "show all". Same for every source and list. */
export const LIST_PREVIEW = 6;

/** Renders the first `limit` items and a button that reveals the rest. */
export function Collapsed<T>({ items, limit = LIST_PREVIEW, children }: { items: T[]; limit?: number; children: (shown: T[]) => React.ReactNode }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all || items.length <= limit ? items : items.slice(0, limit);
  return (
    <>
      {children(shown)}
      {shown.length < items.length && (
        <TRButton appearance="ghost" uiSize="sm" onClick={() => setAll(true)} className="self-start">
          {t.showAll(items.length)}
        </TRButton>
      )}
    </>
  );
}

/** Tags exactly as the source has them; the Korean UI shows a 1:1 translation where one exists. */
function Tags({ tags }: { tags?: string[] }) {
  const t = useT();
  if (!tags?.length) return null;
  return (
    <>
      {tags.map((tag) => (
        <TRBadge key={tag} className="mr-tinyrack-xs align-middle" title={tag}>
          {tagLabel(t, tag)}
        </TRBadge>
      ))}
    </>
  );
}

function WordLink({ word }: { word: string }) {
  const settings = useSettings();
  return (
    <TRLink render={<Link to={settings.wordHref(word)} />} underline="hover">
      {word}
    </TRLink>
  );
}

function Prons({ pron, audio }: Pick<DictEntry, "pron" | "audio">) {
  const t = useT();
  if (!pron?.length && !audio?.length) return null;
  return (
    <TRText as="p" variant="bodySm" color="muted" aria-label={t.pronunciation} className="flex flex-wrap items-center gap-x-tinyrack-md gap-y-tinyrack-2xs">
      {pron && (
        <Collapsed items={pron} limit={4}>
          {(shown) =>
            shown.map((p: Pron, i) => (
              <TRText key={i} className="inline-flex items-baseline gap-tinyrack-2xs">
                <Tags tags={p.tags} />
                <TRText variant={p.kind === "ipa" ? "code" : "bodySm"} as={p.kind === "romanization" ? "i" : "span"}>
                  {p.text}
                </TRText>
              </TRText>
            ))
          }
        </Collapsed>
      )}
      {audio?.map((a) => (
        <AudioButton key={a.url} audio={a} />
      ))}
    </TRText>
  );
}

function Forms({ forms }: { forms: Form[] }) {
  const t = useT();
  return (
    <TRText as="p" variant="bodySm" className="flex flex-wrap items-baseline gap-x-tinyrack-md gap-y-tinyrack-2xs">
      <TRText color="muted">{t.forms}</TRText>
      <Collapsed items={forms}>
        {(shown) =>
          shown.map((f, i) => (
            <TRText key={i}>
              <Tags tags={f.tags} />
              <WordLink word={f.form} />
            </TRText>
          ))
        }
      </Collapsed>
    </TRText>
  );
}

const RELATION_ORDER: RelationKind[] = ["synonyms", "antonyms", "hypernyms", "hyponyms", "related", "derived"];

function RelationLists({ relations }: { relations?: Relations }) {
  const t = useT();
  if (!relations) return null;
  return (
    <>
      {RELATION_ORDER.filter((k) => relations[k]?.length).map((k) => (
        <TRText as="p" key={k} variant="bodySm" className="flex flex-wrap items-baseline gap-x-tinyrack-sm gap-y-tinyrack-2xs">
          <TRText color="muted">{t.relations[k]}</TRText>
          <Collapsed items={relations[k]!}>
            {(shown) =>
              shown.map((r: WordRef, i) => (
                <TRText key={i}>
                  <Tags tags={r.tags} />
                  <WordLink word={r.word} />
                  {r.note && <TRText color="muted"> {r.note}</TRText>}
                  {i < shown.length - 1 && <TRText color="muted">,</TRText>}
                </TRText>
              ))
            }
          </Collapsed>
        </TRText>
      ))}
    </>
  );
}

function Examples({ examples }: { examples: Example[] }) {
  return (
    <TRText as="span" className="flex flex-col gap-tinyrack-xs">
      <Collapsed items={examples} limit={3}>
        {(shown) =>
          shown.map((x, i) => (
            <blockquote key={i} className="border-l-tinyrack-strong border-tinyrack-border pl-tinyrack-md">
              <TRText as="p" variant="bodySm">
                {x.text}
              </TRText>
              {x.roman && (
                <TRText as="p" variant="bodySm" color="muted">
                  <TRText as="i">{x.roman}</TRText>
                </TRText>
              )}
              {x.translation && (
                <TRText as="p" variant="bodySm" color="muted">
                  {x.translation}
                </TRText>
              )}
              {x.ref && (
                <TRText as="p" variant="caption" color="muted">
                  {x.ref}
                </TRText>
              )}
            </blockquote>
          ))
        }
      </Collapsed>
    </TRText>
  );
}

function Translations({ translations }: { translations: Translation[] }) {
  return (
    <TRText as="p" className="flex flex-wrap items-baseline gap-x-tinyrack-sm gap-y-tinyrack-2xs" lang={translations[0]?.lang}>
      <Collapsed items={translations}>
        {(shown) =>
          shown.map((tr, i) => (
            <TRText key={i} variant="headingSm" weight="regular">
              <Tags tags={tr.tags} />
              <WordLink word={tr.word} />
              {(tr.alt || tr.roman) && (
                <TRText variant="bodySm" color="muted">
                  {" "}
                  {[tr.alt, tr.roman].filter(Boolean).join(" ")}
                </TRText>
              )}
              {i < shown.length - 1 && <TRText color="muted">,</TRText>}
            </TRText>
          ))
        }
      </Collapsed>
    </TRText>
  );
}

/** The body of a sense, i.e. what shows when the row is expanded. */
function SenseDetail({ sense }: { sense: Sense }) {
  return (
    <TRText as="span" className="flex flex-col gap-tinyrack-sm">
      {sense.examples && <Examples examples={sense.examples} />}
      <RelationLists relations={sense.relations} />
    </TRText>
  );
}

function SenseText({ sense, n }: { sense: Sense; n: number }) {
  return (
    <TRText as="span" className="flex min-w-0 flex-1 items-baseline gap-tinyrack-sm text-left">
      <TRText variant="bodySm" color="muted" className="w-tinyrack-lg shrink-0 text-right tabular-nums">
        {n}
      </TRText>
      <TRText className="min-w-0 flex-1" weight="regular">
        <Tags tags={sense.tags} />
        {sense.parent && <TRText color="muted">{sense.parent} › </TRText>}
        {sense.gloss}
        {sense.formOf?.map((w) => (
          <TRText key={w}>
            {" "}
            → <WordLink word={w} />
          </TRText>
        ))}
      </TRText>
    </TRText>
  );
}

/**
 * Senses as rows. A sense with translations shows them inline (bilingual dictionaries); a sense with
 * examples or word lists expands in place.
 */
function Senses({ senses }: { senses: Sense[] }) {
  return (
    <Collapsed items={senses}>
      {(shown) => (
        <TRAccordion.Root multiple className="divide-y-tinyrack-default divide-tinyrack-border">
          {shown.map((s, i) => {
            const n = i + 1;
            const expandable = !!(s.examples?.length || s.relations);
            const head = (
              <TRText as="span" className="flex flex-col gap-tinyrack-2xs">
                <SenseText sense={s} n={n} />
                {s.translations && (
                  <TRText as="span" className="pl-tinyrack-xl">
                    <Translations translations={s.translations} />
                  </TRText>
                )}
              </TRText>
            );
            if (!expandable)
              return (
                <TRText as="span" key={i} className="block py-tinyrack-sm pl-tinyrack-md pr-tinyrack-md sm:pl-tinyrack-lg">
                  {head}
                </TRText>
              );
            return (
              <TRAccordion.Item key={i} value={String(i)}>
                <TRAccordion.Header>
                  <TRAccordion.Trigger className="min-h-0 py-tinyrack-sm">{head}</TRAccordion.Trigger>
                </TRAccordion.Header>
                <TRAccordion.Panel>
                  <TRText as="span" className="block sm:pl-tinyrack-xl">
                    <SenseDetail sense={s} />
                  </TRText>
                </TRAccordion.Panel>
              </TRAccordion.Item>
            );
          })}
        </TRAccordion.Root>
      )}
    </Collapsed>
  );
}

/**
 * One entry: headword line (spelling when it differs from the page heading, part of speech, etymology
 * number, alternative spellings), pronunciation, forms, senses, etymology.
 */
export function DictEntryView({ entry, numbered, heading }: { entry: DictEntry; numbered: boolean; heading: string }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-tinyrack-sm">
      <TRText as="h3" variant="label" className="flex flex-wrap items-baseline gap-x-tinyrack-sm">
        {entry.word !== heading && <TRText weight="heading">{entry.word}</TRText>}
        <TRText weight="heading">{posLabel(t, entry.pos)}</TRText>
        {numbered && entry.etym !== undefined && (
          <TRText color="muted" weight="regular">
            {t.etymNumber(entry.etym)}
          </TRText>
        )}
        {entry.alt?.length ? (
          <TRText color="muted" weight="regular">
            {entry.alt.join(", ")}
          </TRText>
        ) : null}
      </TRText>
      <Prons pron={entry.pron} audio={entry.audio} />
      {entry.forms?.length ? <Forms forms={entry.forms} /> : null}
      {entry.tables?.map((table) => (
        <TRCollapsible.Root key={table.kind}>
          <TRCollapsible.Trigger>{t.formTable(table.kind)}</TRCollapsible.Trigger>
          <TRCollapsible.Panel>
            <ul className="flex flex-col gap-tinyrack-2xs">
              {table.forms.map((f, i) => (
                <li key={i}>
                  <TRText variant="bodySm">
                    <Tags tags={f.tags} />
                    {f.form}
                  </TRText>
                </li>
              ))}
            </ul>
          </TRCollapsible.Panel>
        </TRCollapsible.Root>
      ))}
      {entry.senses.length > 0 && <Senses senses={entry.senses} />}
      <RelationLists relations={entry.relations} />
      {entry.etymology && (
        <TRCollapsible.Root>
          <TRCollapsible.Trigger>{t.etymology}</TRCollapsible.Trigger>
          <TRCollapsible.Panel>
            <TRText as="p" variant="bodySm" color="muted" className="whitespace-pre-line">
              {entry.etymology}
            </TRText>
          </TRCollapsible.Panel>
        </TRCollapsible.Root>
      )}
    </section>
  );
}

/** All entries of one source for the headword, in the source's order. */
export function DictEntries({ entries, heading }: { entries: DictEntry[]; heading: string }) {
  // etymology numbers are only meaningful when the source has more than one for this word
  const numbered = new Set(entries.map((e) => e.etym)).size > 1;
  return (
    <TRText as="span" className="flex flex-col gap-tinyrack-xl">
      {entries.map((e, i) => (
        <DictEntryView key={i} entry={e} numbered={numbered} heading={heading} />
      ))}
    </TRText>
  );
}
