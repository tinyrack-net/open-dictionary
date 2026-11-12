import { Link } from "react-router";
import type { Route } from "./+types/home";
import { DictPicker } from "~/components/DictPicker";
import { SearchBox, wordHref } from "~/components/SearchBox";
import { getMeta } from "~/lib/data";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Open Dictionary — English & Korean" },
    { name: "description", content: "A free, open-data English and English↔Korean dictionary built from WordNet and Wiktionary." },
  ];
}

export async function loader() {
  return { meta: await getMeta() };
}

const SAMPLES = ["dictionary", "run", "serendipity", "water", "사랑", "사전", "물", "먹다"];

export default function Home({ loaderData }: Route.ComponentProps) {
  const s = loaderData.meta?.stats;
  return (
    <div className="flex flex-col items-center pt-[14vh] pb-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">📖 Open Dictionary</h1>
      <p className="mt-3 text-center text-stone-600 dark:text-stone-400">English · English → 한국어 · 한국어 → English</p>
      <div className="mt-8 w-full max-w-2xl">
        <SearchBox autoFocus large />
      </div>
      <div className="mt-5">
        <DictPicker />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-stone-600">
        <span className="text-stone-400">Try:</span>
        {SAMPLES.map((w) => (
          <Link key={w} to={wordHref(w)} className="wlink">
            {w}
          </Link>
        ))}
      </div>
      {s && (
        <dl className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Headwords", s.headwords],
            ["WordNet", s.wn],
            ["EN → KO", s.enko],
            ["KO → EN", s.ko],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-stone-200 bg-white p-4 text-center dark:border-stone-800 dark:bg-stone-900">
              <dd className="text-2xl font-semibold tabular-nums">{Number(n).toLocaleString("en-US")}</dd>
              <dt className="text-sm text-stone-500">{label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
