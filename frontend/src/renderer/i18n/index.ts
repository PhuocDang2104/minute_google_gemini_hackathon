import { vi } from './locales/vi';
import { en } from './locales/en';

export type Language = 'vi' | 'en';
export type TranslationKeys = typeof vi;

export const translations: Record<Language, TranslationKeys> = {
  vi,
  en,
};

export const languageNames: Record<Language, string> = {
  vi: 'Ti?ng Vi?t',
  en: 'English',
};

export const languageFlags: Record<Language, string> = {
  vi: '????',
  en: '????',
};

// Get nested translation value
export function getTranslation(
  translations: TranslationKeys,
  key: string
): string {
  const keys = key.split('.');
  let result: unknown = translations;

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  return typeof result === 'string' ? result : key;
}

export { vi, en };
