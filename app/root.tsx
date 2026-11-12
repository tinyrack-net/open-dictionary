import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRText } from "@tinyrack/ui/components/text";
import type { Route } from "./+types/root";
import { STRINGS } from "./lib/i18n";
import { DEFAULT_LANG, isLang, THEME_SCRIPT, useApplyTheme } from "./lib/settings";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams();
  return (
    // data-theme is set before first paint by THEME_SCRIPT from ?theme=, then kept in sync by useApplyTheme
    <html lang={isLang(lang) ? lang : DEFAULT_LANG} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* tinyrack-check-ignore-next-line components/no-raw-html -- trusted no-flash theme bootstrap from ?theme= */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useApplyTheme();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  useApplyTheme();
  const { lang } = useParams();
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = STRINGS[l];
  let message = "Error";
  let details = String(error);
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? t.pageNotFound : error.statusText || details;
  } else if (error instanceof Error) {
    details = import.meta.env.DEV ? error.message : "An unexpected error occurred.";
  }
  return (
    <main className="page-frame flex flex-col items-start gap-tinyrack-lg py-tinyrack-3xl">
      <TRText as="h1" variant="displayLg">
        {message}
      </TRText>
      <TRText as="p" color="muted">
        {details}
      </TRText>
      <TRLinkButton href={`/${l}`}>{t.backToSearch}</TRLinkButton>
    </main>
  );
}
