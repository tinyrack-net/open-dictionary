import { useEffect } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router";
import { TRLinkButton } from "@tinyrack/ui/components/link-button";
import { TRText } from "@tinyrack/ui/components/text";
import type { Route } from "./+types/root";
import { NavigationProgress } from "./components/NavigationProgress";
import { stringsFor } from "./lib/i18n";
import { preloadScript } from "./lib/preload";
import { registerServiceWorker } from "./lib/pwa";
import { DEFAULT_LANG, isLang, THEME_SCRIPT, useApplyTheme } from "./lib/settings";
import "./app.css";

const PRELOAD_SCRIPT = preloadScript();

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
        {/* tinyrack-check-ignore-next-line components/no-raw-html -- trusted: starts the word page's data requests before the app loads */}
        <script dangerouslySetInnerHTML={{ __html: PRELOAD_SCRIPT }} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* PWA: installable app (public/manifest.webmanifest, service worker from scripts/sw.template.js) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Dictionary" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
  useEffect(registerServiceWorker, []);
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  useApplyTheme();
  const { lang } = useParams();
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = stringsFor(l);
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
