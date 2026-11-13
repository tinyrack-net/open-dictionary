// Personal lists kept on this device (localStorage): recently viewed words and saved words.
// Unlike settings (which live in the URL so links are shareable), these are private to the user
// and never leave the browser. Every tab stays in sync through the "storage" event.
import { useCallback, useSyncExternalStore } from "react";

export interface WordItem {
  word: string;
  /** first translation or definition, shown next to the word in lists */
  gloss?: string;
  /** epoch ms */
  at: number;
}

const KEYS = { recent: "od.recent", saved: "od.saved" } as const;
type ListName = keyof typeof KEYS;
const LIMIT: Record<ListName, number> = { recent: 50, saved: 1000 };

const EMPTY: WordItem[] = [];
const snapshots = new Map<ListName, { raw: string | null; items: WordItem[] }>();
const listeners = new Set<() => void>();

function read(name: ListName): WordItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEYS[name]);
  } catch {
    return EMPTY; // storage disabled (private mode, policies)
  }
  const prev = snapshots.get(name);
  if (prev && prev.raw === raw) return prev.items; // stable identity for useSyncExternalStore
  let items: WordItem[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed.filter((x) => x && typeof x.word === "string");
  } catch {}
  snapshots.set(name, { raw, items });
  return items;
}

function write(name: ListName, items: WordItem[]) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(items.slice(0, LIMIT[name])));
  } catch {}
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || Object.values(KEYS).includes(e.key as (typeof KEYS)[ListName])) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const same = (a: string, b: string) => a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase();

/** Adds or moves a word to the front of a list. */
function upsert(name: ListName, item: Omit<WordItem, "at">) {
  const rest = read(name).filter((x) => !same(x.word, item.word));
  write(name, [{ ...item, at: Date.now() }, ...rest]);
}

function remove(name: ListName, word: string) {
  write(name, read(name).filter((x) => !same(x.word, word)));
}

function useList(name: ListName) {
  // server snapshot is empty: lists only exist in the browser, after hydration
  return useSyncExternalStore(
    subscribe,
    () => read(name),
    () => EMPTY,
  );
}

/** Records a word view. Call once per word page view. */
export const addRecent = (word: string, gloss?: string) => upsert("recent", { word, ...(gloss && { gloss }) });

export function useRecent() {
  const items = useList("recent");
  return {
    items,
    remove: useCallback((word: string) => remove("recent", word), []),
    clear: useCallback(() => write("recent", []), []),
  };
}

export function useSaved() {
  const items = useList("saved");
  const isSaved = useCallback((word: string) => items.some((x) => same(x.word, word)), [items]);
  const toggle = useCallback(
    (word: string, gloss?: string) => (isSaved(word) ? remove("saved", word) : upsert("saved", { word, ...(gloss && { gloss }) })),
    [isSaved],
  );
  return {
    items,
    isSaved,
    toggle,
    remove: useCallback((word: string) => remove("saved", word), []),
    clear: useCallback(() => write("saved", []), []),
  };
}
