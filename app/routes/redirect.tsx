import { redirect } from "react-router";
import type { Route } from "./+types/redirect";
import { browserLang } from "~/lib/settings";

// "/" is served by the SPA fallback: pick the UI language from the browser and keep the query string.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return redirect(`/${browserLang()}${new URL(request.url).search}`);
}

export default function Redirect() {
  return null;
}
