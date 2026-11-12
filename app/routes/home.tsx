import { Link } from "react-router";
import type { Route } from "./+types/home";
import { DictPicker } from "~/components/DictPicker";
import { SearchBox } from "~/components/SearchBox";
import { getMeta } from "~/lib/data";
import { useLinks } from "~/lib/dicts";
import { isLang, STRINGS, useT } from "~/lib/i18n";
import { alternates } from "~/lib/seo";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [
    { title: `${t.siteName} — ${t.tagline}` },
    { name: "description", content: t.description },
    ...alternates(""),
  ];
}

export async function loader() {
  return { meta: await getMeta() };
}
export async function clientLoader() {
  return { meta: await getMeta() };
}

const SAMPLES = ["dictionary", "run", "serendipity", "water", "사랑", "사전", "물", "먹다"];

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const links = useLinks();
  const s = loaderData.meta?.stats;
  return (
    <div className="flex flex-col items-center pt-[10vh] pb-12">
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{t.siteName}</h1>
      <p className="mt-3 text-center text-base-content/70">{t.tagline}</p>
      <div className="mt-8 w-full max-w-2xl">
        <SearchBox autoFocus large />
      </div>
      <div className="mt-5">
        <DictPicker center />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <span className="self-center text-sm text-base-content/50">{t.try}</span>
        {SAMPLES.map((w) => (
          <Link key={w} to={links.word(w)} className="badge badge-outline badge-lg hover:bg-base-200">
            {w}
          </Link>
        ))}
      </div>
      {s && (
        <div className="stats stats-vertical mt-14 w-full max-w-2xl border border-base-300 sm:stats-horizontal">
          {(
            [
              [t.stats.headwords, s.headwords],
              [t.stats.wn, s.wn],
              [t.stats.enko, s.enko],
              [t.stats.ko, s.ko],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="stat place-items-center">
              <div className="stat-title">{label}</div>
              <div className="stat-value text-2xl tabular-nums">{n.toLocaleString("en-US")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
