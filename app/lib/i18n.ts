// UI strings for each interface language. The language is the first path segment (/en/..., /ko/...).
// Dictionary content (glosses, tags, parts of speech) is never rewritten here; the Korean UI only
// maps source tags and parts of speech 1:1 through tags.ko.ts, falling back to the source's text.
import { useParams } from "react-router";
import { DEFAULT_LANG, isLang, type Lang } from "./dicts.ts";
import type { RelationKind } from "./types.ts";
import { POS_KO, TAG_KO } from "./tags.ko.ts";

export const LANG_NAMES: Record<Lang, string> = { en: "English", ko: "한국어" };

const en = {
  siteName: "Open Dictionary",
  tagline: "English · English → Korean · Korean",
  description: "A free, open-data English, English↔Korean and Korean dictionary built from WordNet, Wiktionary and the Basic Korean Dictionary.",
  searchPlaceholder: "Search English or Korean…",
  search: "Search",
  dictionaries: "Dictionaries",
  dict: {
    wn: "English (WordNet)",
    en: "English (Wiktionary)",
    enko: "English → Korean",
    ko: "Korean → English",
    kr: "Korean (Basic Korean Dictionary)",
    kwen: "English → Korean (Korean Wiktionary)",
    simple: "English (Simple English Wiktionary)",
  },
  etymology: "Etymology",
  etymNumber: (n: number) => `Etymology ${n}`,
  forms: "Forms",
  /** title of a full inflection table; `kind` is the source's own name for it (conjugation, declension, …) */
  formTable: (kind: string) => `Full ${kind}`,
  relations: {
    synonyms: "Synonyms",
    antonyms: "Antonyms",
    hypernyms: "Broader terms",
    hyponyms: "Narrower terms",
    related: "Related",
    derived: "Derived terms",
  } as Record<RelationKind, string>,
  backlinksTitle: "Given as a translation of",
  /** a definition in another language: "English" */
  langName: { en: "English", ko: "Korean" } as Record<string, string>,
  pairsTitle: "Example sentences",
  notFound: "No entry found.",
  didYouMean: "Did you mean",
  onlyIn: (names: string) => `This word is only in: ${names}. Turn it on in Settings.`,
  noneSelected: "No dictionary selected. Choose at least one in Settings.",
  showAll: (n: number) => `Show all ${n}`,
  play: (label: string) => `Play pronunciation (${label})`,
  playGeneric: "Play pronunciation",
  save: "Save word",
  savedWords: "Saved words",
  recent: "Recent",
  removeItem: (w: string) => `Remove ${w}`,
  clearAll: "Clear all",
  nothingSaved: "No saved words yet. Tap the bookmark on a word page to save it.",
  storedOnDevice: "Stored on this device only.",
  sourcesLicenses: "Sources & licenses",
  aboutIntro:
    "Every definition on this site comes from openly licensed data and is shown as the source wrote it. The processed data is redistributed under the license of the source it comes from: the 한국어기초사전 part under CC BY-SA 2.0 KR, everything else under CC BY-SA 4.0. Each dictionary on a word page names its source and license.",
  aboutUse: {
    wn: "English definitions, examples, synonyms and broader terms.",
    en: "English entries: senses, examples, pronunciations, recordings, forms, etymology, and Korean translations.",
    ko: "Korean entries explained in English, with romanization, hanja and examples.",
    kr: "Korean entries with Korean definitions, an English equivalent and English definition for each sense, written pronunciation, conjugations, hanja, example phrases and dialogues, and related words. English words list the Korean words that have them as an equivalent.",
    kwen: "English entries defined in Korean, with examples translated into Korean, pronunciations and recordings.",
    simple: "Learner's definitions of English words in plain English, with examples, labels such as countable or transitive, synonyms and antonyms.",
    tatoeba: "English–Korean example sentence pairs, shown under words they contain exactly.",
    wordfreq: "Word frequency, used only to order search suggestions.",
    commons: "Recorded pronunciations linked from Wiktionary and played from Wikimedia Commons. Each recording has its own author and free license, listed on its Commons page.",
  },
  pageNotFound: "The requested page could not be found.",
  backToSearch: "Back to search",
  language: "Language",
  settings: "Settings",
  theme: "Theme",
  themes: { auto: "System", light: "Light", dark: "Dark" },
  pronunciation: "Pronunciation",
  searchResults: "Suggestions",
  clear: "Clear",
  loading: "Loading…",
  /** source tag -> UI label (English UI: verbatim) */
  tags: {} as Record<string, string>,
  /** source part of speech -> UI label (English UI: verbatim) */
  pos: {} as Record<string, string>,
};

const ko: typeof en = {
  siteName: "오픈 사전",
  tagline: "영영 · 영한 · 한국어",
  description: "WordNet, 위키낱말사전, 한국어기초사전의 공개 데이터로 만든 무료 영영·영한·한국어 사전입니다.",
  searchPlaceholder: "영어 또는 한국어 검색…",
  search: "검색",
  dictionaries: "사전",
  dict: {
    wn: "영영 (WordNet)",
    en: "영영 (위키낱말사전)",
    enko: "영한 (영어 위키낱말사전)",
    ko: "한영 (영어 위키낱말사전)",
    kr: "한국어 (한국어기초사전)",
    kwen: "영한 (한국어 위키낱말사전)",
    simple: "영영 (쉬운 영어 위키낱말사전)",
  },
  etymology: "어원",
  etymNumber: (n: number) => `어원 ${n}`,
  forms: "변화형",
  formTable: (kind: string) => `${({ conjugation: "활용", declension: "곡용", inflection: "굴절" } as Record<string, string>)[kind] ?? kind} 전체`,
  relations: {
    synonyms: "유의어",
    antonyms: "반의어",
    hypernyms: "상위어",
    hyponyms: "하위어",
    related: "관련어",
    derived: "파생어",
  },
  backlinksTitle: "다음 단어의 번역어",
  langName: { en: "영어", ko: "한국어" } as Record<string, string>,
  pairsTitle: "예문",
  notFound: "표제어를 찾을 수 없습니다.",
  didYouMean: "혹시 이 단어인가요",
  onlyIn: (names: string) => `이 단어는 다음 사전에만 있습니다: ${names}. 설정에서 켜 주세요.`,
  noneSelected: "선택한 사전이 없습니다. 설정에서 하나 이상 선택해 주세요.",
  showAll: (n: number) => `${n}개 모두 보기`,
  play: (label: string) => `발음 듣기 (${label})`,
  playGeneric: "발음 듣기",
  save: "단어 저장",
  savedWords: "저장한 단어",
  recent: "최근 본 단어",
  removeItem: (w: string) => `${w} 삭제`,
  clearAll: "모두 지우기",
  nothingSaved: "아직 저장한 단어가 없습니다. 단어 페이지에서 책갈피를 눌러 저장하세요.",
  storedOnDevice: "이 기기에만 저장됩니다.",
  sourcesLicenses: "출처 및 라이선스",
  aboutIntro:
    "이 사이트의 모든 뜻풀이는 공개 라이선스 데이터에서 가져와 출처에 적힌 그대로 보여 줍니다. 가공한 데이터는 원본의 라이선스를 따라 재배포합니다. 한국어기초사전에서 가져온 부분은 CC BY-SA 2.0 KR, 나머지는 CC BY-SA 4.0입니다. 단어 페이지의 사전마다 출처와 라이선스를 표시합니다.",
  aboutUse: {
    wn: "영어 뜻풀이, 예문, 유의어, 상위어.",
    en: "영어 표제어의 뜻, 예문, 발음, 녹음, 변화형, 어원, 한국어 번역.",
    ko: "영어로 설명한 한국어 표제어, 로마자 표기, 한자, 예문.",
    kr: "한국어 표제어의 뜻풀이, 뜻마다 영어 대응어와 영어 뜻풀이, 발음 표기, 활용, 한자, 예문과 대화 예문, 관련어. 영어 단어에는 그 단어를 대응어로 가진 한국어 단어를 보여 줍니다.",
    kwen: "한국어로 뜻을 풀이한 영어 표제어, 한국어 번역이 붙은 예문, 발음과 녹음.",
    simple: "학습자를 위해 쉬운 영어 문장으로 풀이한 영어 뜻풀이, 예문, 가산·타동 같은 문법 표시, 유의어와 반의어.",
    tatoeba: "영어–한국어 예문 쌍. 단어가 정확히 들어 있는 문장만 보여 줍니다.",
    wordfreq: "단어 빈도. 검색 추천 순서에만 사용합니다.",
    commons: "위키낱말사전에 연결된 녹음 발음을 위키미디어 공용에서 재생합니다. 녹음마다 저작자와 자유 라이선스가 공용 페이지에 표시됩니다.",
  },
  pageNotFound: "요청한 페이지를 찾을 수 없습니다.",
  backToSearch: "검색으로 돌아가기",
  language: "언어",
  settings: "설정",
  theme: "테마",
  themes: { auto: "시스템", light: "라이트", dark: "다크" },
  pronunciation: "발음",
  searchResults: "추천 단어",
  clear: "지우기",
  loading: "불러오는 중…",
  tags: TAG_KO,
  pos: POS_KO,
};

export const STRINGS: Record<Lang, typeof en> = { en, ko };

export function useLang(): Lang {
  const { lang } = useParams();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

export function useT() {
  return STRINGS[useLang()];
}

/** Part of speech in the UI language; the source's own label when there is no 1:1 entry. */
export function posLabel(t: typeof en, pos: string) {
  return t.pos[pos] ?? pos;
}

/** Grammar/usage tag in the UI language; the source's own tag when there is no 1:1 entry. */
export function tagLabel(t: typeof en, tag: string) {
  return t.tags[tag] ?? tag;
}
