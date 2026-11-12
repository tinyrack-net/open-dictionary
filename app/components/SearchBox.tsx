import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { DICT } from "~/lib/keys";
import { search } from "~/lib/data";
import type { IndexRow } from "~/lib/types";
import { DICTIONARIES } from "~/lib/prefs";

export const wordHref = (w: string) => `/word/${encodeURIComponent(w)}`;

export function SearchBox({ autoFocus, initial = "", large }: { autoFocus?: boolean; initial?: string; large?: boolean }) {
  const [q, setQ] = useState(initial);
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => setQ(initial), [initial]);

  useEffect(() => {
    const n = ++seq.current;
    if (!q.trim()) return setRows([]);
    const t = setTimeout(async () => {
      const r = await search(q, 10);
      if (n === seq.current) {
        setRows(r);
        setActive(-1);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [q]);

  const go = (w: string) => {
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    navigate(wordHref(w));
  };

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
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        placeholder="Search English or 한국어…"
        aria-label="Search"
        role="combobox"
        aria-expanded={open && rows.length > 0}
        aria-controls={listId}
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
        className={`w-full rounded-xl border border-stone-300 bg-white px-4 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-stone-700 dark:bg-stone-900 dark:focus:ring-blue-950 ${large ? "py-4 text-xl" : "py-2 text-base"}`}
      />
      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          {rows.map(([w, m], i) => (
            <li
              key={w}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(w);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${i === active ? "bg-blue-50 dark:bg-stone-800" : ""}`}
            >
              <span className="truncate">{w}</span>
              <span className="flex shrink-0 gap-1">
                {DICTIONARIES.filter((d) => m & DICT[d.id]).map((d) => (
                  <span key={d.id} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {d.short}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
