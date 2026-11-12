import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { TRMenu } from "@tinyrack/ui/components/menu";
import { Check, Settings2 } from "lucide-react";
import { useNavigate } from "react-router";
import { LANG_NAMES, useT } from "~/lib/i18n";
import { DICTIONARIES, LANGS, type Lang, THEMES, type Theme, useSettings } from "~/lib/settings";

const Tick = () => <Check aria-hidden="true" size={14} />;

/** Every setting in one place: dictionaries (?dicts=), theme (?theme=), UI language (/{lang}/). */
export function SettingsMenu() {
  const t = useT();
  const settings = useSettings();
  const navigate = useNavigate();
  return (
    <TRMenu.Root>
      <TRMenu.Trigger
        render={
          <TRIconButton appearance="ghost" aria-label={t.settings}>
            <Settings2 aria-hidden="true" size={18} />
          </TRIconButton>
        }
      />
      <TRMenu.Portal>
        <TRMenu.Positioner align="end" sideOffset={4}>
          <TRMenu.Popup>
            <TRMenu.Group>
              <TRMenu.GroupLabel>{t.dictionaries}</TRMenu.GroupLabel>
              {DICTIONARIES.map((d) => (
                <TRMenu.CheckboxItem
                  key={d.id}
                  checked={settings.dicts.includes(d.id)}
                  onCheckedChange={(on: boolean) =>
                    settings.setDicts(DICTIONARIES.map((x) => x.id).filter((id) => (id === d.id ? on : settings.dicts.includes(id))))
                  }
                  closeOnClick={false}
                >
                  <TRMenu.CheckboxItemIndicator keepMounted>
                    <Tick />
                  </TRMenu.CheckboxItemIndicator>
                  {t.dict[d.id]}
                </TRMenu.CheckboxItem>
              ))}
            </TRMenu.Group>
            <TRMenu.Separator />
            <TRMenu.Group>
              <TRMenu.GroupLabel>{t.theme}</TRMenu.GroupLabel>
              <TRMenu.RadioGroup value={settings.theme} onValueChange={(v: Theme) => settings.setTheme(v)}>
                {THEMES.map((theme) => (
                  <TRMenu.RadioItem key={theme} value={theme} closeOnClick>
                    <TRMenu.RadioItemIndicator keepMounted>
                      <Tick />
                    </TRMenu.RadioItemIndicator>
                    {t.themes[theme]}
                  </TRMenu.RadioItem>
                ))}
              </TRMenu.RadioGroup>
            </TRMenu.Group>
            <TRMenu.Separator />
            <TRMenu.Group>
              <TRMenu.GroupLabel>{t.language}</TRMenu.GroupLabel>
              <TRMenu.RadioGroup value={settings.lang} onValueChange={(v: Lang) => navigate(settings.langHref(v))}>
                {LANGS.map((l) => (
                  <TRMenu.RadioItem key={l} value={l} lang={l} closeOnClick>
                    <TRMenu.RadioItemIndicator keepMounted>
                      <Tick />
                    </TRMenu.RadioItemIndicator>
                    {LANG_NAMES[l]}
                  </TRMenu.RadioItem>
                ))}
              </TRMenu.RadioGroup>
            </TRMenu.Group>
          </TRMenu.Popup>
        </TRMenu.Positioner>
      </TRMenu.Portal>
    </TRMenu.Root>
  );
}
