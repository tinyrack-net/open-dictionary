import type { Route } from "./+types/about";
import { isLang, STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [{ title: `${t.sourcesLicenses} — ${t.siteName}` }, ...alternates("/about")];
}

export default function About() {
  const t = useT();
  const sources = [
    { name: "Open English WordNet 2025", url: "https://en-word.net/", license: "CC BY 4.0", use: t.aboutUse.wn },
    { name: "English Wiktionary (kaikki.org)", url: "https://kaikki.org/dictionary/English/", license: "CC BY-SA 4.0", use: t.aboutUse.en },
    { name: "English Wiktionary: Korean (kaikki.org)", url: "https://kaikki.org/dictionary/Korean/", license: "CC BY-SA 4.0", use: t.aboutUse.ko },
  ];
  return (
    <article className="py-8">
      <h1 className="font-serif text-3xl font-semibold">{t.sourcesLicenses}</h1>
      <p className="mt-3 text-base-content/70">{t.aboutIntro}</p>
      <div className="mt-6 grid gap-4">
        {sources.map((s) => (
          <div key={s.name} className="card card-border bg-base-100">
            <div className="card-body">
              <h2 className="card-title">
                <a href={s.url} className="link link-hover">
                  {s.name}
                </a>
                <span className="badge badge-soft badge-sm">{s.license}</span>
              </h2>
              <p className="text-base-content/70">{s.use}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
