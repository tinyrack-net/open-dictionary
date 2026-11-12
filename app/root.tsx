import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router";
import type { Route } from "./+types/root";
import { DEFAULT_LANG, isLang, STRINGS } from "./lib/i18n";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams();
  return (
    <html lang={isLang(lang) ? lang : DEFAULT_LANG}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="loading loading-dots loading-lg" aria-label="Loading" />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">{message}</h1>
      <p className="mt-2">{details}</p>
      <a className="btn mt-6" href={`/${l}`}>
        {t.backToSearch}
      </a>
    </main>
  );
}
