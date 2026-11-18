import { TRButton } from "@tinyrack/ui/components/button";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import { BookOpen } from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { SearchBox } from "~/components/SearchBox";
import { WordList } from "~/components/WordList";
import { useRecent } from "~/lib/history";
import { DEFAULT_LANG, headLanguages, isLang, SAMPLE_WORDS, sourceCredits } from "~/lib/dicts";
import { stringsFor, useT } from "~/lib/i18n";
import { alternates, SITE_URL } from "~/lib/seo";
import { useSettings } from "~/lib/settings";

export function meta({ params }: Route.MetaArgs) {
  const t = stringsFor(params.lang);
  const lang = isLang(params.lang) ? params.lang : DEFAULT_LANG;
  // "English · Korean": the headword languages, in the UI language
  const tagline = headLanguages()
    .map((l) => t.languages[l] ?? l)
    .join(" · ");
  return [
    { title: `${t.siteName} — ${tagline}` },
    { name: "description", content: t.siteDescription(t.andList(sourceCredits())) },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/${lang}` },
    ...alternates(""),
  ];
}

/**
 * The search box, centered on the screen (the layout has no bar here), then the words you looked up
 * recently (on this device) or a few to try.
 */
export default function Home() {
  const t = useT();
  const settings = useSettings();
  const recent = useRecent();
  return (
    <section className="mx-auto flex w-full max-w-tinyrack-overlay-width-md flex-col gap-tinyrack-lg pt-tinyrack-xl pb-tinyrack-3xl">
      <TRText as="h1" variant="headingLg" align="center" className="flex items-center justify-center gap-tinyrack-sm">
        <BookOpen aria-hidden="true" size={28} />
        {t.siteName}
      </TRText>
      <SearchBox large autoFocus />
      {recent.items.length > 0 ? (
        <section className="flex flex-col gap-tinyrack-xs" aria-label={t.recent}>
          <TRText as="span" className="flex items-center justify-between">
            <TRText as="h2" variant="label" color="muted">
              {t.recent}
            </TRText>
            <TRButton appearance="ghost" uiSize="sm" onClick={recent.clear}>
              {t.clearAll}
            </TRButton>
          </TRText>
          <WordList items={recent.items} onRemove={recent.remove} limit={8} />
        </section>
      ) : (
        <TRText as="p" variant="bodySm" color="muted" align="center" className="flex flex-wrap justify-center gap-x-tinyrack-md gap-y-tinyrack-xs">
          {SAMPLE_WORDS.map((w) => (
            <TRLink key={w} variant="muted" render={<Link to={settings.wordHref(w)} />}>
              {w}
            </TRLink>
          ))}
        </TRText>
      )}
    </section>
  );
}
