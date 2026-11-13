import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { TRLink } from "@tinyrack/ui/components/link";
import { TRText } from "@tinyrack/ui/components/text";
import { X } from "lucide-react";
import { Link } from "react-router";
import type { WordItem } from "~/lib/history";
import { useT } from "~/lib/i18n";
import { useSettings } from "~/lib/settings";

/** A list of words with their short gloss, each removable. Used for recent and saved words. */
export function WordList({ items, onRemove, limit }: { items: WordItem[]; onRemove: (word: string) => void; limit?: number }) {
  const t = useT();
  const settings = useSettings();
  return (
    <ul className="flex flex-col divide-y-tinyrack-default divide-tinyrack-border">
      {items.slice(0, limit).map((item) => (
        <li key={item.word} className="flex items-center gap-tinyrack-sm py-tinyrack-xs">
          <TRText className="min-w-0 flex-1" truncate>
            <TRLink render={<Link to={settings.wordHref(item.word)} />} underline="hover">
              {item.word}
            </TRLink>
            {item.gloss && (
              <TRText variant="bodySm" color="muted">
                {"  "}
                {item.gloss}
              </TRText>
            )}
          </TRText>
          <TRIconButton appearance="ghost" uiSize="sm" aria-label={t.removeItem(item.word)} onClick={() => onRemove(item.word)}>
            <X aria-hidden="true" size={14} />
          </TRIconButton>
        </li>
      ))}
    </ul>
  );
}
