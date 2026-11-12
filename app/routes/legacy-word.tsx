import { redirect } from "react-router";
import type { Route } from "./+types/legacy-word";

// Old URL shape (/{lang}/word/<headword>), served by the SPA fallback and redirected in the browser.
export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const search = new URL(request.url).search.replace(/^\?/, "");
  return redirect(`/${params.lang}/word?word=${encodeURIComponent(params.word)}${search ? `&${search}` : ""}`);
}

export default function LegacyWord() {
  return null;
}
