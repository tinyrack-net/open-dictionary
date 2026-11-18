// Japanese UI strings. Source tags and parts of speech have no Japanese labels yet, so they are shown
// as the sources wrote them (add a 1:1 table like tags.ko.ts to translate them).
import type { Strings } from "./en.ts";

const ja: Strings = {
  langName: "日本語",
  siteName: "オープン辞書",
  siteDescription: (sources: string) => `${sources}のオープンデータで作った無料の辞書です。`,
  searchPlaceholder: (langs: string) => `${langs}で検索…`,
  orList: (items: string[]) => items.join("・"),
  andList: (items: string[]) => items.join("、"),
  search: "検索",
  dictionaries: "辞書",
  etymology: "語源",
  etymNumber: (n: number) => `語源 ${n}`,
  forms: "語形",
  formTable: (kind: string) => `${({ conjugation: "活用", declension: "曲用", inflection: "語形変化" } as Record<string, string>)[kind] ?? kind}（全体）`,
  relations: {
    synonyms: "類義語",
    antonyms: "対義語",
    hypernyms: "上位語",
    hyponyms: "下位語",
    related: "関連語",
    derived: "派生語",
  },
  backlinksTitle: "次の語の訳語",
  languages: { en: "英語", ko: "韓国語", ja: "日本語" } as Record<string, string>,
  langShort: { en: "英", ko: "韓", ja: "日" } as Record<string, string>,
  // 英英, 英和 … in Japanese usage a dictionary into Japanese is 和 (英和, 韓和), from Japanese 和 (和英, 和韓)
  langPair: (head: string, gloss: string, short: Record<string, string>) => {
    if (head === "ja" && gloss === "ja") return "国語";
    // a monolingual dictionary of another language: 英英 is usual; Korean–Korean reads as 韓国語辞典
    if (head === "ko" && gloss === "ko") return "韓国語";
    const s = (l: string) => (l === "ja" ? "和" : (short[l] ?? l));
    return `${s(head)}${s(gloss)}`;
  },
  dictionaryOrder: "辞書と表示順",
  dictionaryOrderHint: "単語ページにこの順で表示します。辞書のオン・オフと並べ替えができます。",
  moveUp: (name: string) => `${name}を上へ`,
  moveDown: (name: string) => `${name}を下へ`,
  resetOrder: "初期設定に戻す",
  done: "完了",
  appearance: "表示",
  pairsTitle: "例文",
  notFound: "見出し語が見つかりません。",
  offline: "オフラインです。以前に開いた単語は表示できますが、この単語には接続が必要です。",
  didYouMean: "もしかして",
  onlyIn: (names: string) => `この単語は次の辞書にのみあります：${names}。設定でオンにしてください。`,
  noneSelected: "辞書が選択されていません。設定で一つ以上選んでください。",
  showAll: (n: number) => `すべて表示（${n}）`,
  showMore: (rest: number) => `さらに表示（残り${rest}）`,
  play: (label: string) => `発音を再生（${label}）`,
  playGeneric: "発音を再生",
  save: "単語を保存",
  savedWords: "保存した単語",
  recent: "最近見た単語",
  removeItem: (w: string) => `${w}を削除`,
  clearAll: "すべて消去",
  nothingSaved: "保存した単語はまだありません。単語ページのしおりを押すと保存できます。",
  storedOnDevice: "この端末にのみ保存されます。",
  sourcesLicenses: "出典とライセンス",
  aboutIntro:
    "このサイトの語釈はすべてオープンライセンスのデータから取り、出典に書かれたとおりに表示しています。辞書ごとに加工したデータはその辞書のライセンスで再配布し、ライセンスは下記と各単語ページに表示しています。",
  pageNotFound: "ページが見つかりません。",
  backToSearch: "検索に戻る",
  language: "言語",
  settings: "設定",
  theme: "テーマ",
  themes: { auto: "システム", light: "ライト", dark: "ダーク" },
  pronunciation: "発音",
  searchResults: "候補",
  clear: "消去",
  loading: "読み込み中…",
  tags: {},
  pos: {},
};

export default ja;
