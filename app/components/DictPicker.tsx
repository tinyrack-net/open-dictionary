import { DICTIONARIES, useDicts } from "~/lib/dicts";
import { useT } from "~/lib/i18n";

export function DictPicker({ center }: { center?: boolean }) {
  const { enabled, toggle } = useDicts();
  const t = useT();
  return (
    <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`} role="group" aria-label={t.dictionaries}>
      {DICTIONARIES.map((d) => {
        const on = enabled.includes(d.id);
        return (
          <label key={d.id} className={`btn btn-sm rounded-full ${on ? "btn-primary" : "btn-outline border-base-300 font-normal text-base-content/60"}`} title={`${d.source} · ${d.license}`}>
            <input type="checkbox" className="checkbox checkbox-xs" checked={on} onChange={() => toggle(d.id)} />
            {t.dict[d.id]}
          </label>
        );
      })}
    </div>
  );
}
