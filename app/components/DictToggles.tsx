import { TRToggle } from "@tinyrack/ui/components/toggle";
import { TRToggleGroup } from "@tinyrack/ui/components/toggle-group";
import { useT } from "~/lib/i18n";
import type { DictId } from "~/lib/keys";
import { DICTIONARIES, useSettings } from "~/lib/settings";

/** Which dictionaries are shown (?dicts=). Several can be on at once. */
export function DictToggles({ center }: { center?: boolean }) {
  const t = useT();
  const settings = useSettings();
  return (
    <TRToggleGroup
      multiple
      aria-label={t.dictionaries}
      value={settings.dicts}
      // keep the canonical order regardless of click order
      onValueChange={(next: string[]) => settings.setDicts(DICTIONARIES.map((d) => d.id).filter((id) => next.includes(id)) as DictId[])}
      className={`flex-wrap ${center ? "justify-center" : ""}`}
    >
      {DICTIONARIES.map((d) => (
        <TRToggle key={d.id} value={d.id} title={`${d.source} · ${d.license}`}>
          {t.dict[d.id]}
        </TRToggle>
      ))}
    </TRToggleGroup>
  );
}
