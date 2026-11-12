import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRText } from "@tinyrack/ui/components/text";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { DictToggles } from "~/components/DictToggles";
import { SearchBox } from "~/components/SearchBox";
import { getMeta } from "~/lib/data";
import { STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";
import { isLang, useSettings } from "~/lib/settings";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [{ title: `${t.siteName} — ${t.tagline}` }, { name: "description", content: t.description }, ...alternates("")];
}

export async function loader() {
  return { meta: await getMeta() };
}
export async function clientLoader() {
  return { meta: await getMeta() };
}

const SAMPLES = ["dictionary", "serendipity", "run", "water", "사랑", "사전", "물", "먹다"];

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const settings = useSettings();
  const s = loaderData.meta?.stats;
  const stats = s
    ? [
        [t.stats.headwords, s.headwords],
        [t.stats.wn, s.wn],
        [t.stats.enko, s.enko],
        [t.stats.ko, s.ko],
      ]
    : [];

  return (
    <section className="mx-auto flex max-w-tinyrack-overlay-width-md flex-col items-stretch gap-tinyrack-xl py-tinyrack-3xl sm:pt-tinyrack-3xl">
      <hgroup className="flex flex-col items-center gap-tinyrack-xs">
        <TRText as="h1" variant="displayLg" align="center">
          {t.siteName}
        </TRText>
        <TRText as="p" color="muted" align="center">
          {t.tagline}
        </TRText>
      </hgroup>

      <SearchBox large autoFocus />
      <DictToggles center />

      <nav aria-label={t.try} className="flex flex-wrap items-center justify-center gap-tinyrack-xs">
        <TRText variant="bodySm" color="muted">
          {t.try}
        </TRText>
        {SAMPLES.map((w) => (
          <TRLinkButton key={w} appearance="ghost" uiSize="sm" render={<Link to={settings.wordHref(w)} />}>
            {w}
          </TRLinkButton>
        ))}
      </nav>

      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-tinyrack-lg pt-tinyrack-xl sm:grid-cols-4">
          {stats.map(([label, n]) => (
            <TRText as="span" key={label} className="flex flex-col items-center gap-tinyrack-2xs">
              <TRText as="dd" variant="headingMd" className="tabular-nums">
                {Number(n).toLocaleString("en-US")}
              </TRText>
              <TRText as="dt" variant="caption" color="muted">
                {label}
              </TRText>
            </TRText>
          ))}
        </dl>
      )}
    </section>
  );
}
