import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { search } from "~/lib/data";
import { DICTIONARIES, dictMask, useDicts, useLinks } from "~/lib/dicts";
import { useT } from "~/lib/i18n";
import { DICT } from "~/lib/keys";
import type { IndexRow } from "~/lib/types";

export function SearchBox({ autoFocus, initial = "", large }: { autoFocus?: boolean; initial?: string; large?: boolean }) {
  const [q, setQ] = useState(initial);
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const links = useLinks();
  const { enabled } = useDicts();
  const mask = dictMask(enabled);
  const t = useT();
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    if (!q.trim()) {
      setRows([]);
      return;
    }
    const timer = setTimeout(async () => {
      const r = await search(q, 10, mask || 0xff);
      if (n === seq.current) {
        setRows(r);
        setActive(-1);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [q, mask]);

  const go = (w: string) => {
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    navigate(links.word(w));
  };

  const showList = open && rows.length > 0;
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const pick = active >= 0 ? rows[active]?.[0] : q.trim();
        if (pick) go(pick);
      }}
    >
      <label className={`input w-full ${large ? "input-xl shadow-sm" : ""}`}>
        <svg className="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </g>
        </svg>
        <input
          type="search"
          className="grow"
          value={q}
          autoFocus={autoFocus}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {showList && (
        <ul id={listId} role="listbox" className="menu absolute z-40 mt-1 w-full rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
          {rows.map(([w, m], i) => (
            <li key={w} role="option" aria-selected={i === active}>
              <a
                href={links.word(w)}
                className={`flex justify-between gap-3 ${i === active ? "menu-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  go(w);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="truncate">{w}</span>
                <span className="flex shrink-0 gap-1">
                  {DICTIONARIES.filter((d) => m & DICT[d.id]).map((d) => (
                    <span key={d.id} className="badge badge-ghost badge-xs">
                      {d.short}
                    </span>
                  ))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
