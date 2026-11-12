import { Link, useLocation } from "react-router";
import { LANG_NAMES, LANGS, useLang, useT } from "~/lib/i18n";

/** Switches the UI language by replacing the first path segment; keeps the rest of the URL. */
export function LanguageMenu() {
  const lang = useLang();
  const t = useT();
  const { pathname, search } = useLocation();
  const rest = pathname.replace(/^\/[^/]+/, "");
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm" aria-label={t.language}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
        </svg>
        <span className="hidden sm:inline">{LANG_NAMES[lang]}</span>
      </div>
      <ul tabIndex={0} className="dropdown-content menu z-40 mt-2 w-36 rounded-box bg-base-100 p-2 shadow-lg">
        {LANGS.map((l) => (
          <li key={l}>
            <Link
              to={`/${l}${rest}${search}`}
              lang={l}
              className={l === lang ? "menu-active" : ""}
              // the CSS dropdown stays open while it has focus
              onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
            >
              {LANG_NAMES[l]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
