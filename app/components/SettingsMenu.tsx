import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRButton } from "@tinyrack/ui/components/button";
import { TRDialog } from "@tinyrack/ui/components/dialog";
import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { TRNativeSelect } from "@tinyrack/ui/components/native-select";
import { TRSwitch } from "@tinyrack/ui/components/switch";
import { TRText } from "@tinyrack/ui/components/text";
import { ArrowDown, ArrowUp, Settings2 } from "lucide-react";
import { useNavigate } from "react-router";
import { ALL_DICTS, DICTIONARIES, langPair, localized } from "~/lib/dicts";
import { STRINGS, useT } from "~/lib/i18n";
import { LANGS, type Lang, THEMES, type Theme, useSettings } from "~/lib/settings";

/**
 * Every setting in one dialog: which dictionaries are shown and in what order (?dicts=), theme
 * (?theme=) and UI language (/{lang}/). Each change applies at once and goes into the URL.
 *
 * The list shows every dictionary: the selected ones first, in their display order, then the rest in
 * the default order. Turning one on adds it at the end of the selected ones.
 */
export function SettingsMenu() {
  const t = useT();
  const settings = useSettings();
  const navigate = useNavigate();
  const selected = settings.dicts;
  const rows = [...selected, ...ALL_DICTS.filter((id) => !selected.includes(id))].map((id) => DICTIONARIES.find((d) => d.id === id)!);

  const toggle = (id: string, on: boolean) => settings.setDicts(on ? [...selected.filter((x) => x !== id), id] : selected.filter((x) => x !== id));
  const move = (id: string, by: -1 | 1) => {
    const i = selected.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    settings.setDicts(next);
  };

  return (
    <TRDialog.Root>
      <TRDialog.Trigger
        render={
          <TRIconButton appearance="ghost" aria-label={t.settings} title={t.settings}>
            <Settings2 aria-hidden="true" size={18} />
          </TRIconButton>
        }
      />
      <TRDialog.Portal>
        <TRDialog.Backdrop />
        <TRDialog.Popup className="settings-dialog">
          <TRDialog.Title>{t.settings}</TRDialog.Title>
          <TRDialog.Description>{t.dictionaryOrderHint}</TRDialog.Description>
          <TRText as="span" className="tr-dialog-body flex flex-col gap-tinyrack-lg">
            <TRText as="span" className="flex flex-col gap-tinyrack-xs">
              <TRText as="h3" variant="label">
                {t.dictionaryOrder}
              </TRText>
              <ol className="flex flex-col divide-y-tinyrack-default divide-tinyrack-border">
                {rows.map((d) => {
                  const on = selected.includes(d.id);
                  const i = selected.indexOf(d.id);
                  const name = `${langPair(d, t)} ${localized(d.name, settings.lang)}`;
                  return (
                    <li key={d.id} className="flex items-center gap-tinyrack-sm py-tinyrack-xs">
                      <TRSwitch.Root checked={on} onCheckedChange={(v: boolean) => toggle(d.id, v)} aria-label={name}>
                        <TRSwitch.Thumb />
                      </TRSwitch.Root>
                      <TRText as="span" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-tinyrack-sm" color={on ? "default" : "muted"}>
                        <TRBadge>{langPair(d, t)}</TRBadge>
                        <TRText truncate>{localized(d.name, settings.lang)}</TRText>
                      </TRText>
                      <TRIconButton appearance="ghost" uiSize="sm" aria-label={t.moveUp(name)} disabled={!on || i === 0} onClick={() => move(d.id, -1)}>
                        <ArrowUp aria-hidden="true" size={14} />
                      </TRIconButton>
                      <TRIconButton appearance="ghost" uiSize="sm" aria-label={t.moveDown(name)} disabled={!on || i === selected.length - 1} onClick={() => move(d.id, 1)}>
                        <ArrowDown aria-hidden="true" size={14} />
                      </TRIconButton>
                    </li>
                  );
                })}
              </ol>
              <TRButton appearance="ghost" uiSize="sm" className="self-start" disabled={selected.join() === ALL_DICTS.join()} onClick={() => settings.setDicts(ALL_DICTS)}>
                {t.resetOrder}
              </TRButton>
            </TRText>

            <TRText as="span" className="grid grid-cols-2 gap-tinyrack-md">
              <TRText as="label" variant="label" className="flex flex-col gap-tinyrack-xs">
                {t.theme}
                <TRNativeSelect value={settings.theme} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => settings.setTheme(e.target.value as Theme)}>
                  {THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {t.themes[theme]}
                    </option>
                  ))}
                </TRNativeSelect>
              </TRText>
              <TRText as="label" variant="label" className="flex flex-col gap-tinyrack-xs">
                {t.language}
                <TRNativeSelect value={settings.lang} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => navigate(settings.langHref(e.target.value as Lang))}>
                  {LANGS.map((l) => (
                    <option key={l} value={l} lang={l}>
                      {STRINGS[l].langName}
                    </option>
                  ))}
                </TRNativeSelect>
              </TRText>
            </TRText>
          </TRText>
          <TRText as="span" className="tr-dialog-action">
            <TRDialog.Close render={<TRButton>{t.done}</TRButton>} />
          </TRText>
        </TRDialog.Popup>
      </TRDialog.Portal>
    </TRDialog.Root>
  );
}
