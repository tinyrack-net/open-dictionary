import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { SearchBox } from "~/components/SearchBox";
import { STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";
import { isLang, useSettings } from "~/lib/settings";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [{ title: `${t.siteName} — ${t.tagline}` }, { name: "description", content: t.description }, ...alternates("")];
}

const SAMPLES = ["serendipity", "dictionary", "run", "사랑", "먹다", "사전"];

/** Just the search box: the page exists to look a word up. */
export default function Home() {
  const t = useT();
  const settings = useSettings();
  return (
    <section className="mx-auto flex max-w-tinyrack-overlay-width-md flex-col gap-tinyrack-lg pt-tinyrack-3xl pb-tinyrack-2xl sm:pt-tinyrack-3xl">
      <TRText as="h1" variant="headingLg" align="center">
        {t.siteName}
      </TRText>
      <SearchBox large autoFocus />
      <TRText as="p" variant="bodySm" color="muted" align="center" className="flex flex-wrap justify-center gap-x-tinyrack-md gap-y-tinyrack-xs">
        {SAMPLES.map((w) => (
          <TRLink key={w} variant="muted" render={<Link to={settings.wordHref(w)} />}>
            {w}
          </TRLink>
        ))}
      </TRText>
    </section>
  );
}
