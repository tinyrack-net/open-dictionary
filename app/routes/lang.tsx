import { useEffect } from "react";
import { data, Link, Outlet, useLocation, useParams, useSearchParams } from "react-router";
import type { Route } from "./+types/lang";
import { LanguageMenu } from "~/components/LanguageMenu";
import { SearchBox } from "~/components/SearchBox";
import { useLinks } from "~/lib/dicts";
import { isLang, rememberLang, STRINGS } from "~/lib/i18n";

function check(lang: string | undefined) {
  if (!isLang(lang)) throw data(null, { status: 404 });
  return null;
}
export const loader = ({ params }: Route.LoaderArgs) => check(params.lang);
export const clientLoader = ({ params }: Route.ClientLoaderArgs) => check(params.lang);

export default function LangLayout() {
  const { lang } = useParams();
  const [params] = useSearchParams();
  const word = params.get("word") ?? "";
  const { pathname } = useLocation();
  const links = useLinks();
  const t = STRINGS[links.lang];
  const home = pathname === `/${lang}` || pathname === `/${lang}/`;

  useEffect(() => {
    if (isLang(lang)) rememberLang(lang);
  }, [lang]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="navbar sticky top-0 z-30 gap-2 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-2">
          <Link to={links.page("")} className="btn btn-ghost shrink-0 px-2 font-serif text-lg">
            📖 <span className={home ? "" : "hidden sm:inline"}>{t.siteName}</span>
          </Link>
          <div className="min-w-0 flex-1">{!home && <SearchBox key={word} initial={word} />}</div>
          <LanguageMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4">
        <Outlet />
      </main>
      <footer className="footer footer-center gap-3 p-8 text-sm text-base-content/60">
        <aside>
          <p>
            {t.dataFrom}{" "}
            <a className="link" href="https://en-word.net/">
              Open English WordNet
            </a>{" "}
            (CC BY 4.0) {t.and}{" "}
            <a className="link" href="https://en.wiktionary.org/">
              Wiktionary
            </a>{" "}
            (<a className="link" href="https://kaikki.org/">kaikki.org</a> {t.via}, CC BY-SA 4.0)
          </p>
        </aside>
        <nav className="grid-flow-col gap-4">
          <Link className="link" to={links.page("/about")}>
            {t.sourcesLicenses}
          </Link>
          <a className="link" href="https://github.com/tinyrack-net/open-dictionary">
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  );
}
