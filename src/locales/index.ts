import { th } from "./th";
import { en } from "./en";

export type AppLanguage = "th" | "en";

export type TranslationKey = keyof typeof th;

export const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  th,
  en,
};

export function getTranslation(key: TranslationKey, lang: AppLanguage = "th"): string {
  const dict = translations[lang] || translations.th;
  return dict[key] || translations.th[key] || key;
}
