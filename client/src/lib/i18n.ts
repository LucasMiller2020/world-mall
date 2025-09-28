import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Language resources
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import pt from '../locales/pt.json';
import it from '../locales/it.json';
import ru from '../locales/ru.json';
import ko from '../locales/ko.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  zh: { translation: zh },
  ja: { translation: ja },
  pt: { translation: pt },
  it: { translation: it },
  ru: { translation: ru },
  ko: { translation: ko },
};

// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    
    // Language detection configuration
    detection: {
      // Order and from where user language should be detected
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      // Keys or params to lookup language from
      lookupLocalStorage: 'i18nextLng',
      // Cache user language on localStorage
      caches: ['localStorage'],
      // Only detect languages that are in the whitelist
      checkWhitelist: true,
      // Support for custom language detection
      convertDetectedLanguage: (lng) => {
        // Extract base language (e.g., 'en' from 'en-US')
        const baseLanguage = lng.split('-')[0].toLowerCase();
        // Return the language if supported, otherwise fallback to English
        return SUPPORTED_LANGUAGES.some(lang => lang.code === baseLanguage) 
          ? baseLanguage 
          : 'en';
      },
    },

    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    
    // React i18next options
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper functions for language management
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  // Store user preference
  localStorage.setItem('user_language_preference', language);
};

export const getUserLanguagePreference = (): SupportedLanguage | null => {
  const preference = localStorage.getItem('user_language_preference');
  return preference && SUPPORTED_LANGUAGES.some(lang => lang.code === preference) 
    ? preference as SupportedLanguage 
    : null;
};

export const getLanguageInfo = (code: SupportedLanguage) => {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
};

// Detect browser language and return supported language or fallback
export const detectBrowserLanguage = (): SupportedLanguage => {
  const browserLanguages = navigator.languages || [navigator.language];
  
  for (const browserLang of browserLanguages) {
    const baseLanguage = browserLang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGUAGES.some(lang => lang.code === baseLanguage)) {
      return baseLanguage as SupportedLanguage;
    }
  }
  
  return 'en'; // Fallback to English
};
