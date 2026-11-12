import { redirect } from "react-router";
import type { Route } from "./+types/redirect";
import { detectLang } from "~/lib/i18n";

// "/" is not prerendered: it is served by the SPA fallback and redirects in the browser.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  return redirect(`/${detectLang()}${url.search}`);
}

export default function Redirect() {
  return null;
}
