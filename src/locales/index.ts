import { th } from "./th";
import { en } from "./en";

export type AppLanguage = "th" | "en";

export const translations = {
  th,
  en,
} as const;

export type TranslationKey = keyof typeof th;
