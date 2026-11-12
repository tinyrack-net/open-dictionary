import { DICTIONARIES, usePrefs } from "~/lib/prefs";

export function DictPicker() {
  const { enabled, toggle } = usePrefs();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Dictionaries">
      {DICTIONARIES.map((d) => {
        const on = enabled.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            title={`${d.source} (${d.license})`}
            onClick={() => toggle(d.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              on
                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                : "border-stone-300 bg-white text-stone-500 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
            }`}
          >
            {on ? "✓ " : ""}
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
