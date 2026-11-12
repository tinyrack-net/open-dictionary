import { TRAutocomplete } from "@tinyrack/ui/components/autocomplete";
import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRText } from "@tinyrack/ui/components/text";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { search } from "~/lib/data";
import { useT } from "~/lib/i18n";
import { DICT } from "~/lib/keys";
import { DICTIONARIES, dictMask, useSettings } from "~/lib/settings";
import type { IndexRow } from "~/lib/types";

/**
 * Word search with suggestions. Suggestions come from the chunked prefix index and are limited to the
 * selected dictionaries. Enter (or picking a suggestion) opens the word page with the current settings.
 */
export function SearchBox({ initial = "", large, autoFocus }: { initial?: string; large?: boolean; autoFocus?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const settings = useSettings();
  const mask = dictMask(settings.dicts) || 0xff;
  const [query, setQuery] = useState(initial);
  const [rows, setRows] = useState<IndexRow[]>([]);
  const highlighted = useRef<IndexRow | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => setQuery(initial), [initial]);

  useEffect(() => {
    const n = ++seq.current;
    if (!query.trim()) {
      setRows([]);
      return;
    }
    const timer = setTimeout(async () => {
      const found = await search(query, 8, mask);
      if (n === seq.current) setRows(found);
    }, 60);
    return () => clearTimeout(timer);
  }, [query, mask]);

  const open = (word: string) => {
    const w = word.trim();
    if (!w) return;
    (document.activeElement as HTMLElement | null)?.blur();
    navigate(settings.wordHref(w));
  };

  return (
    <TRAutocomplete.Root
      items={rows}
      // the index already returns matches in rank order; don't filter again
      filter={null}
      value={query}
      onValueChange={(value, details) => {
        // choosing a suggestion fills the input with it; open that word right away
        if (details.reason === "item-press") open(value);
        else setQuery(value);
      }}
      itemToStringValue={(row: IndexRow) => row[0]}
      onItemHighlighted={(row) => {
        highlighted.current = row;
      }}
    >
      <TRAutocomplete.InputGroup uiSize={large ? "lg" : "md"}>
        <TRAutocomplete.InputAdornment>
          <Search aria-hidden="true" size={large ? 20 : 16} />
        </TRAutocomplete.InputAdornment>
        <TRAutocomplete.Input
          aria-label={t.search}
          placeholder={t.searchPlaceholder}
          autoFocus={autoFocus}
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={(e) => {
            // Enter without a highlighted suggestion searches the typed text
            if (e.key === "Enter" && !highlighted.current) {
              e.preventDefault();
              open(query);
            }
          }}
        />
        {query && (
          <TRAutocomplete.Clear aria-label={t.clear}>
            <X aria-hidden="true" size={16} />
          </TRAutocomplete.Clear>
        )}
      </TRAutocomplete.InputGroup>
      <TRAutocomplete.Portal>
        <TRAutocomplete.Positioner sideOffset={4}>
          <TRAutocomplete.Popup aria-label={t.searchResults}>
            <TRAutocomplete.List>
              {(row: IndexRow) => (
                <TRAutocomplete.Item key={row[0]} value={row} className="flex items-center justify-between gap-tinyrack-md">
                  <TRText truncate>{row[0]}</TRText>
                  <TRText as="span" className="flex shrink-0 gap-tinyrack-2xs">
                    {DICTIONARIES.filter((d) => row[1] & DICT[d.id]).map((d) => (
                      <TRBadge key={d.id}>{d.short}</TRBadge>
                    ))}
                  </TRText>
                </TRAutocomplete.Item>
              )}
            </TRAutocomplete.List>
          </TRAutocomplete.Popup>
        </TRAutocomplete.Positioner>
      </TRAutocomplete.Portal>
    </TRAutocomplete.Root>
  );
}
