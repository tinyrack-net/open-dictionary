import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRCard } from "@tinyrack/ui/components/card";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import type { Route } from "./+types/about";
import { STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";
import { isLang } from "~/lib/settings";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [{ title: `${t.sourcesLicenses} — ${t.siteName}` }, ...alternates("/about")];
}

export default function About() {
  const t = useT();
  const sources = [
    { name: "Open English WordNet 2025", url: "https://en-word.net/", license: "CC BY 4.0", use: t.aboutUse.wn },
    { name: "English Wiktionary (kaikki.org)", url: "https://kaikki.org/dictionary/English/", license: "CC BY-SA 4.0", use: t.aboutUse.en },
    { name: "English Wiktionary: Korean (kaikki.org)", url: "https://kaikki.org/dictionary/Korean/", license: "CC BY-SA 4.0", use: t.aboutUse.ko },
  ];
  return (
    <article className="flex flex-col gap-tinyrack-lg py-tinyrack-2xl">
      <TRText as="h1" variant="headingLg">
        {t.sourcesLicenses}
      </TRText>
      <TRText as="p" color="muted" className="reading-measure">
        {t.aboutIntro}
      </TRText>
      {sources.map((s) => (
        <TRCard.Root key={s.name} variant="outlined">
          <TRCard.Header className="flex flex-wrap items-center gap-tinyrack-sm">
            <TRCard.Title render={<TRText as="h2" variant="headingSm" />}>
              <TRLink href={s.url}>{s.name}</TRLink>
            </TRCard.Title>
            <TRBadge>{s.license}</TRBadge>
          </TRCard.Header>
          <TRCard.Content>
            <TRText as="p" color="muted">
              {s.use}
            </TRText>
          </TRCard.Content>
        </TRCard.Root>
      ))}
    </article>
  );
}
