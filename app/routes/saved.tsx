import { TRButton } from "@tinyrack/ui/components/button";
import { TRText } from "@tinyrack/ui/components/text";
import type { Route } from "./+types/saved";
import { WordList } from "~/components/WordList";
import { useSaved } from "~/lib/history";
import { STRINGS, useT } from "~/lib/i18n";
import { isLang, useHydrated } from "~/lib/settings";

export function meta({ params }: Route.MetaArgs) {
  const t = STRINGS[isLang(params.lang) ? params.lang : "en"];
  return [{ title: `${t.savedWords} — ${t.siteName}` }, { name: "robots", content: "noindex" }];
}

/** Words saved with the bookmark button. Kept in this browser only. */
export default function Saved() {
  const t = useT();
  const saved = useSaved();
  const hydrated = useHydrated();
  return (
    <section className="mx-auto flex max-w-tinyrack-overlay-width-md flex-col gap-tinyrack-md py-tinyrack-2xl">
      <TRText as="span" className="flex items-baseline justify-between gap-tinyrack-md">
        <TRText as="h1" variant="headingLg">
          {t.savedWords}
          {saved.items.length > 0 && (
            <TRText variant="body" color="muted" weight="regular">
              {" "}
              {saved.items.length}
            </TRText>
          )}
        </TRText>
        {saved.items.length > 0 && (
          <TRButton appearance="ghost" uiSize="sm" onClick={saved.clear}>
            {t.clearAll}
          </TRButton>
        )}
      </TRText>
      <TRText as="p" variant="bodySm" color="muted">
        {t.storedOnDevice}
      </TRText>
      {hydrated && saved.items.length === 0 ? (
        <TRText as="p" color="muted">
          {t.nothingSaved}
        </TRText>
      ) : (
        <WordList items={saved.items} onRemove={saved.remove} />
      )}
    </section>
  );
}
