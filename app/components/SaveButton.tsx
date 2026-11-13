import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "~/lib/history";
import { useT } from "~/lib/i18n";
import { useHydrated } from "~/lib/settings";

/** Adds/removes the word from the saved list on this device. */
export function SaveButton({ word, gloss }: { word: string; gloss?: string }) {
  const t = useT();
  const saved = useSaved();
  const hydrated = useHydrated();
  const on = hydrated && saved.isSaved(word);
  return (
    <TRIconButton appearance={on ? "solid" : "outline"} intent={on ? "primary" : "neutral"} aria-label={t.save} aria-pressed={on} onClick={() => saved.toggle(word, gloss)}>
      {on ? <BookmarkCheck aria-hidden="true" size={18} /> : <Bookmark aria-hidden="true" size={18} />}
    </TRIconButton>
  );
}
