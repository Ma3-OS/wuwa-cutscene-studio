import type { TranslationKey } from "./index";

export interface SubtitleLanguageOption {
  code: string;
  labelKey: TranslationKey;
  nativeLabel: string;
  shortLabel: string;
  isPrimary: boolean;
}

export const SUBTITLE_LANGUAGES: SubtitleLanguageOption[] = [
  { code: "th", labelKey: "langTh", nativeLabel: "ไทย", shortLabel: "TH", isPrimary: true },
  { code: "en", labelKey: "langEn", nativeLabel: "English", shortLabel: "EN", isPrimary: true },
  { code: "ja", labelKey: "langJa", nativeLabel: "日本語", shortLabel: "JA", isPrimary: true },
  { code: "zh-Hans", labelKey: "langZhHans", nativeLabel: "简体中文", shortLabel: "ZH", isPrimary: true },
  { code: "ko", labelKey: "langKo", nativeLabel: "한국어", shortLabel: "KO", isPrimary: true },
  { code: "zh-Hant", labelKey: "langZhHant", nativeLabel: "繁體中文", shortLabel: "ZHT", isPrimary: false },
  { code: "de", labelKey: "langDe", nativeLabel: "Deutsch", shortLabel: "DE", isPrimary: false },
  { code: "es", labelKey: "langEs", nativeLabel: "Español", shortLabel: "ES", isPrimary: false },
  { code: "fr", labelKey: "langFr", nativeLabel: "Français", shortLabel: "FR", isPrimary: false },
  { code: "id", labelKey: "langId", nativeLabel: "Bahasa Indonesia", shortLabel: "ID", isPrimary: false },
  { code: "pt", labelKey: "langPt", nativeLabel: "Português", shortLabel: "PT", isPrimary: false },
  { code: "ru", labelKey: "langRu", nativeLabel: "Русский", shortLabel: "RU", isPrimary: false },
  { code: "vi", labelKey: "langVi", nativeLabel: "Tiếng Việt", shortLabel: "VI", isPrimary: false },
];
