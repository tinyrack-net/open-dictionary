// UI strings for each interface language. The language is the first path segment (/en/..., /ko/...).
import { useParams } from "react-router";
import { DEFAULT_LANG, isLang, type Lang } from "./settings";

export const LANG_NAMES: Record<Lang, string> = { en: "English", ko: "한국어" };

const en = {
  siteName: "Open Dictionary",
  tagline: "English · English → Korean · Korean → English",
  description: "A free, open-data English and English↔Korean dictionary built from WordNet and Wiktionary.",
  searchPlaceholder: "Search English or Korean…",
  search: "Search",
  try: "Try",
  dictionaries: "Dictionaries",
  stats: { headwords: "Headwords", wn: "WordNet", enko: "English → Korean", ko: "Korean → English" },
  dict: {
    wn: "English (WordNet)",
    en: "English (Wiktionary)",
    enko: "English → Korean",
    ko: "Korean → English",
  },
  synonyms: "Synonyms",
  typeOf: "Type of",
  etymology: "Etymology",
  translatedAs: "English words translated as this",
  notFound: "No entry found.",
  didYouMean: "Did you mean",
  onlyIn: (names: string) => `This word is only in: ${names}. Turn it on in Settings.`,
  noneSelected: "No dictionary selected. Choose at least one in Settings.",
  koreanSection: "Korean",
  englishSection: "English",
  meaningsSection: "Meanings",
  examplesSection: "Examples",
  formOf: "Form of",
  moreMeanings: (n: number) => `${n} more meaning${n === 1 ? "" : "s"}`,
  sourcesLine: "Sources",
  dataFrom: "Data from",
  and: "and",
  via: "via",
  sourcesLicenses: "Sources & licenses",
  aboutIntro:
    "Every definition on this site comes from openly licensed data. The processed dataset is redistributed under CC BY-SA 4.0, as required by Wiktionary's license.",
  aboutUse: {
    wn: "English definitions, synonyms, broader terms, examples and pronunciations.",
    en: "English entries: senses, etymology, IPA, inflected forms, and English → Korean translations.",
    ko: "Korean headwords explained in English, with romanization, hanja and examples.",
  },
  pageNotFound: "The requested page could not be found.",
  backToSearch: "Back to search",
  loading: "Loading…",
  language: "Language",
  settings: "Settings",
  theme: "Theme",
  themes: { auto: "System", light: "Light", dark: "Dark" },
  noResults: "No matching words",
  pronunciation: "Pronunciation",
  searchResults: "Suggestions",
  clear: "Clear",
  pos: {} as Record<string, string>,
  /** Short part-of-speech labels for the compact list. */
  posShort: {
    noun: "n.",
    verb: "v.",
    adj: "adj.",
    adv: "adv.",
    pron: "pron.",
    prep: "prep.",
    conj: "conj.",
    intj: "interj.",
    num: "num.",
    det: "det.",
    name: "name",
    phrase: "phr.",
    particle: "part.",
    suffix: "suffix",
    prefix: "prefix",
  } as Record<string, string>,
};

const ko: typeof en = {
  siteName: "오픈 사전",
  tagline: "영영 · 영한 · 한영",
  description: "WordNet과 위키낱말사전의 공개 데이터로 만든 무료 영영·영한·한영 사전입니다.",
  searchPlaceholder: "영어 또는 한국어 검색…",
  search: "검색",
  try: "예시",
  dictionaries: "사전",
  stats: { headwords: "표제어", wn: "WordNet", enko: "영한", ko: "한영" },
  dict: {
    wn: "영영 (WordNet)",
    en: "영영 (위키낱말사전)",
    enko: "영한",
    ko: "한영",
  },
  synonyms: "유의어",
  typeOf: "상위어",
  etymology: "어원",
  translatedAs: "이 단어로 번역되는 영어 단어",
  notFound: "표제어를 찾을 수 없습니다.",
  didYouMean: "혹시 이 단어인가요",
  onlyIn: (names: string) => `이 단어는 다음 사전에만 있습니다: ${names}. 설정에서 켜 주세요.`,
  noneSelected: "선택한 사전이 없습니다. 설정에서 하나 이상 선택해 주세요.",
  koreanSection: "한국어 뜻",
  englishSection: "영어 뜻",
  meaningsSection: "영영 뜻",
  examplesSection: "예문",
  formOf: "원형",
  moreMeanings: (n: number) => `뜻 ${n}개 더 보기`,
  sourcesLine: "출처",
  dataFrom: "데이터 출처:",
  and: "및",
  via: "가공",
  sourcesLicenses: "출처 및 라이선스",
  aboutIntro:
    "이 사이트의 모든 뜻풀이는 공개 라이선스 데이터에서 가져왔습니다. 가공한 데이터는 위키낱말사전 라이선스에 따라 CC BY-SA 4.0으로 재배포합니다.",
  aboutUse: {
    wn: "영어 뜻풀이, 유의어, 상위어, 예문, 발음.",
    en: "영어 표제어의 뜻, 어원, 발음 기호, 활용형, 영한 번역.",
    ko: "영어로 설명한 한국어 표제어, 로마자 표기, 한자, 예문.",
  },
  pageNotFound: "요청한 페이지를 찾을 수 없습니다.",
  backToSearch: "검색으로 돌아가기",
  loading: "불러오는 중…",
  language: "언어",
  settings: "설정",
  theme: "테마",
  themes: { auto: "시스템", light: "라이트", dark: "다크" },
  noResults: "일치하는 단어가 없습니다",
  pronunciation: "발음",
  searchResults: "추천 단어",
  clear: "지우기",
  pos: {
    noun: "명사",
    verb: "동사",
    adj: "형용사",
    adjective: "형용사",
    adv: "부사",
    adverb: "부사",
    pron: "대명사",
    prep: "전치사",
    conj: "접속사",
    intj: "감탄사",
    num: "수사",
    det: "관형사",
    article: "관사",
    particle: "조사",
    prefix: "접두사",
    suffix: "접미사",
    affix: "접사",
    name: "고유 명사",
    phrase: "구",
    prep_phrase: "전치사구",
    proverb: "속담",
    character: "문자",
    counter: "단위 명사",
    symbol: "기호",
    abbrev: "약어",
    root: "어근",
    contraction: "축약형",
    syllable: "음절",
    punct: "문장 부호",
    postp: "후치사",
    interfix: "삽입사",
  },
  posShort: {
    noun: "명",
    verb: "동",
    adj: "형",
    adv: "부",
    pron: "대",
    prep: "전",
    conj: "접",
    intj: "감",
    num: "수",
    det: "관",
    name: "고유",
    phrase: "구",
    particle: "조",
    suffix: "접미",
    prefix: "접두",
  },
};

export const STRINGS: Record<Lang, typeof en> = { en, ko };

export function useLang(): Lang {
  const { lang } = useParams();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

export function useT() {
  return STRINGS[useLang()];
}

export function posLabel(t: typeof en, pos: string) {
  return t.pos[pos] ?? pos;
}

export function posShort(t: typeof en, pos: string) {
  return t.posShort[pos] ?? posLabel(t, pos);
}
