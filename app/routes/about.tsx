import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRCard } from "@tinyrack/ui/components/card";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import type { Route } from "./+types/about";
import { DICTIONARIES, EXTRA_SOURCES, LICENSE_URL, localized } from "~/lib/dicts";
import { stringsFor, useLang, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";

export function meta({ params }: Route.MetaArgs) {
  const t = stringsFor(params.lang);
  return [{ title: `${t.sourcesLicenses} — ${t.siteName}` }, ...alternates("/about")];
}

export default function About() {
  const t = useT();
  const lang = useLang();
  const sources = [
    ...DICTIONARIES.map((d) => ({ name: localized(d.name, lang), source: d.source.name, url: d.source.url, license: d.license, licenseUrl: undefined, use: localized(d.description, lang) })),
    ...EXTRA_SOURCES.map((x) => ({ name: x.name, source: undefined, url: x.url, license: x.license, licenseUrl: x.licenseUrl, use: localized(x.description, lang) })),
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
            <TRLink href={LICENSE_URL[s.license] ?? s.licenseUrl} underline="none">
              <TRBadge>{s.license}</TRBadge>
            </TRLink>
          </TRCard.Header>
          <TRCard.Content className="flex flex-col gap-tinyrack-xs">
            {s.source && (
              <TRText as="p" variant="bodySm" color="muted">
                {s.source}
              </TRText>
            )}
            <TRText as="p" color="muted">
              {s.use}
            </TRText>
          </TRCard.Content>
        </TRCard.Root>
      ))}
    </article>
  );
}
