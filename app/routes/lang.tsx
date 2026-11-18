import { TRLink } from "@tinyrack/ui/components/link";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRText } from "@tinyrack/ui/components/text";
import { BookOpen, Bookmark } from "lucide-react";
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

  const savedLink = (
    <TRLinkButton
      appearance="ghost"
      aria-label={t.savedWords}
      title={t.savedWords}
      render={<Link to={settings.pageHref("/saved")} />}
      className="px-tinyrack-sm"
    >
      <Bookmark aria-hidden="true" size={18} />
    </TRLinkButton>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {home ? (
        // home: no bar, just the two actions in the corner so the search box stands alone
        <nav className="page-frame flex justify-end gap-tinyrack-xs py-tinyrack-sm">
          {savedLink}
          <SettingsMenu />
        </nav>
      ) : (
        <header className="sticky top-0 z-tinyrack-chrome border-b-tinyrack-default border-tinyrack-border bg-tinyrack-surface">
          <nav className="page-frame flex items-center gap-tinyrack-md py-tinyrack-sm">
            <TRLink render={<Link to={settings.pageHref("")} />} underline="none" className="flex shrink-0 items-center gap-tinyrack-xs">
              <BookOpen aria-hidden="true" size={20} />
              <TRText weight="heading" className="max-sm:hidden">
                {t.siteName}
              </TRText>
            </TRLink>
            <TRText as="span" className="min-w-0 flex-1">
              <SearchBox key={word} initial={word} />
            </TRText>
            {savedLink}
            <SettingsMenu />
          </nav>
        </header>
      )}

      <main className={home ? "page-frame flex flex-1 flex-col justify-center" : "page-frame flex-1"}>
        <Outlet />
      </main>

      {/* Credits per source are on every word card and on the about page; the footer only links there. */}
      <footer className="page-frame py-tinyrack-lg">
        <TRText as="p" variant="bodySm" color="muted" align="center" className="flex justify-center gap-tinyrack-sm">
          <TRLink variant="muted" render={<Link to={settings.pageHref("/about")} />}>
            {t.sourcesLicenses}
          </TRLink>
          <TRText aria-hidden="true">·</TRText>
          <TRLink variant="muted" href="https://github.com/tinyrack-net/open-dictionary">
            GitHub
          </TRLink>
        </TRText>
      </footer>
    </div>
  );
}
