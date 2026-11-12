import { TRLink } from "@tinyrack/ui/components/link";
import { TRSeparator } from "@tinyrack/ui/components/separator";
import { TRText } from "@tinyrack/ui/components/text";
import { BookOpen } from "lucide-react";
import { data, Link, Outlet, useLocation, useParams, useSearchParams } from "react-router";
import type { Route } from "./+types/lang";
import { SearchBox } from "~/components/SearchBox";
import { SettingsMenu } from "~/components/SettingsMenu";
import { STRINGS } from "~/lib/i18n";
import { isLang, useHydrated, useSettings } from "~/lib/settings";

function check(lang: string | undefined) {
  if (!isLang(lang)) throw data(null, { status: 404 });
  return null;
}
export const loader = ({ params }: Route.LoaderArgs) => check(params.lang);
export const clientLoader = ({ params }: Route.ClientLoaderArgs) => check(params.lang);

export default function LangLayout() {
  const { lang } = useParams();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const settings = useSettings();
  const hydrated = useHydrated();
  const t = STRINGS[settings.lang];
  const home = pathname === `/${lang}` || pathname === `/${lang}/`;
  // the prerendered shell can't know ?word=, so fill the search box only after hydration
  const word = hydrated ? (params.get("word") ?? "") : "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-tinyrack-chrome border-b-tinyrack-default border-tinyrack-border bg-tinyrack-surface">
        <nav className="page-frame flex items-center gap-tinyrack-md py-tinyrack-sm">
          <TRLink render={<Link to={settings.pageHref("")} />} underline="none" className="flex shrink-0 items-center gap-tinyrack-xs">
            <BookOpen aria-hidden="true" size={20} />
            <TRText weight="heading" className={home ? "" : "max-sm:hidden"}>
              {t.siteName}
            </TRText>
          </TRLink>
          <TRText as="span" className="min-w-0 flex-1">
            {!home && <SearchBox key={word} initial={word} />}
          </TRText>
          <SettingsMenu />
        </nav>
      </header>

      <main className="page-frame flex-1">
        <Outlet />
      </main>

      <footer className="page-frame flex flex-col gap-tinyrack-sm py-tinyrack-xl sm:flex-row sm:items-center sm:justify-between">
        <TRSeparator className="sm:hidden" />
        <TRText variant="bodySm" color="muted">
          {t.dataFrom} <TRLink href="https://en-word.net/">Open English WordNet</TRLink> (CC BY 4.0) {t.and}{" "}
          <TRLink href="https://en.wiktionary.org/">Wiktionary</TRLink> (<TRLink href="https://kaikki.org/">kaikki.org</TRLink>{" "}
          {t.via}, CC BY-SA 4.0)
        </TRText>
        <TRText variant="bodySm" className="flex gap-tinyrack-lg">
          <TRLink render={<Link to={settings.pageHref("/about")} />}>{t.sourcesLicenses}</TRLink>
          <TRLink href="https://github.com/tinyrack-net/open-dictionary">GitHub</TRLink>
        </TRText>
      </footer>
    </div>
  );
}
