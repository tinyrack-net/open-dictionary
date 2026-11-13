// The dictionary data is served under /data/<version>/, where <version> is a content hash written by
// scripts/build-data.ts (data/site/version.txt) and baked into the app at build time (vite.config.ts).
//
// Why: the app's JavaScript has hashed file names, but data chunks used to have fixed names
// (/data/d/en/1da.json) cached for a day. After a deploy that changed the data format, a returning
// visitor ran the new code against yesterday's cached chunks and the word page crashed. With the
// version in the path, new code only ever reads data from its own build, and the files can be cached
// forever. Identical data builds get the same version, so browsers keep their cache.
//
// /data/version.txt (not cached) names the deployed version. A tab opened before a deploy still asks
// for the old version's files, which no longer exist; it compares versions and reloads (see data.ts).

/** "dev" outside a Vite build (node --test) and when the data hasn't been built. */
export const DATA_VERSION: string = import.meta.env?.VITE_DATA_VERSION || "dev";

/** URL of a data file, e.g. dataUrl("i/manifest.json") -> "/data/3f2a…/i/manifest.json". */
export const dataUrl = (rel: string, version = DATA_VERSION) => `/data/${version}/${rel}`;

/** Unversioned, revalidated on every request: the version currently deployed. */
export const VERSION_URL = "/data/version.txt";
