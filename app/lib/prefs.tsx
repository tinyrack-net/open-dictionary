// User-selected dictionaries, persisted in localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DictId } from "./keys";

export const DICTIONARIES: { id: DictId; label: string; short: string; source: string; license: string }[] = [
  { id: "wn", label: "English (WordNet)", short: "EN·WN", source: "Open English WordNet 2025", license: "CC BY 4.0" },
  { id: "en", label: "English (Wiktionary)", short: "EN·WK", source: "English Wiktionary via kaikki.org", license: "CC BY-SA 4.0" },
  { id: "enko", label: "English → Korean", short: "EN→KO", source: "English Wiktionary translations", license: "CC BY-SA 4.0" },
  { id: "ko", label: "Korean → English", short: "KO→EN", source: "English Wiktionary Korean entries", license: "CC BY-SA 4.0" },
];

const ALL = DICTIONARIES.map((d) => d.id);
const KEY = "od.dicts";

const Ctx = createContext<{ enabled: DictId[]; toggle: (id: DictId) => void }>({ enabled: ALL, toggle: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Prerendered HTML always shows every dictionary; the choice is applied after hydration.
  const [enabled, setEnabled] = useState<DictId[]>(ALL);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (Array.isArray(saved)) setEnabled(ALL.filter((d) => saved.includes(d)));
    } catch {}
  }, []);
  const toggle = (id: DictId) =>
    setEnabled((cur) => {
      const next = cur.includes(id) ? cur.filter((d) => d !== id) : ALL.filter((d) => d === id || cur.includes(d));
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  return <Ctx.Provider value={{ enabled, toggle }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
