// The contract between the build and a data source (scripts/sources/<name>.ts).
//
// A source downloads its raw files and converts them into the neutral format (app/lib/types.ts),
// adding entries, backlinks or sentence pairs to the dictionaries it feeds (ids from DICTIONARIES in
// app/lib/dicts.ts) through the helpers in core.ts. Rules for converters (README "Data model"): copy,
// don't compose; keep the source's order and tags; keep everything; omit empty fields.

export interface Source {
  /** for logs */
  name: string;
  /** Dictionary ids this source writes to. Each must be in DICTIONARIES. */
  dictionaries: string[];
  /** Downloads raw files into raw/ (skips what is there; delete files to refresh). */
  fetch(): void | Promise<void>;
  /**
   * Converts raw/ into headwords (core.ts). Missing raw files: log and return, so a partial checkout
   * still builds. Returns a short summary for the log.
   */
  build(): string | Promise<string>;
  /**
   * Runs after every source's build, for data that attaches to headwords other sources created
   * (sentence pairs, frequencies).
   */
  after?(): string | Promise<string>;
}
