import { Link, Outlet, useLocation, useParams } from "react-router";
import { SearchBox } from "~/components/SearchBox";

export default function Layout() {
  const { pathname } = useLocation();
  const { word } = useParams();
  const home = pathname === "/";
  return (
    <div className="flex min-h-screen flex-col">
      {!home && (
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
          <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
            <Link to="/" className="shrink-0 font-serif text-lg font-semibold">
              📖 <span className="hidden sm:inline">Open Dictionary</span>
            </Link>
            <SearchBox initial={word ?? ""} />
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-4xl px-4 py-8 text-sm text-stone-500">
        Data from <a className="wlink" href="https://en-word.net/">Open English WordNet</a> (CC BY 4.0) and{" "}
        <a className="wlink" href="https://en.wiktionary.org/">Wiktionary</a> via{" "}
        <a className="wlink" href="https://kaikki.org/">kaikki.org</a> (CC BY-SA 4.0). ·{" "}
        <Link className="wlink" to="/about">
          Sources &amp; licenses
        </Link>
      </footer>
    </div>
  );
}
