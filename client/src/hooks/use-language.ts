import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  changeLanguage, 
  getCurrentLanguage, 
  getUserLanguagePreference,
  detectBrowserLanguage,
  type SupportedLanguage 
} from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(getCurrentLanguage());
  const [isLoading, setIsLoading] = useState(false);

  // Initialize language on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      setIsLoading(true);
      try {
        // Check for user preference first
        const userPreference = getUserLanguagePreference();
        
        if (userPreference) {
          await changeLanguage(userPreference);
          setCurrentLanguage(userPreference);
        } else {
          // Detect from browser
          const detectedLang = detectBrowserLanguage();
          if (detectedLang !== getCurrentLanguage()) {
            await changeLanguage(detectedLang);
            setCurrentLanguage(detectedLang);
          }
        }
      } catch (error) {
        console.error('Failed to initialize language:', error);
        // Fallback to English
        await changeLanguage('en');
        setCurrentLanguage('en');
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, []);

  // Listen for language changes from i18next
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng as SupportedLanguage);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const switchLanguage = async (language: SupportedLanguage, showToast = true) => {
    setIsLoading(true);
    try {
      await changeLanguage(language);
      setCurrentLanguage(language);
      
      if (showToast) {
        // We'll show the toast in the LanguageSwitcher component instead
        // to avoid circular dependency with translations
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to change language. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const detectAndSetBrowserLanguage = async () => {
    const detectedLang = detectBrowserLanguage();
    if (detectedLang !== currentLanguage) {
      await switchLanguage(detectedLang);
    }
  };

  return {
    currentLanguage,
    switchLanguage,
    detectAndSetBrowserLanguage,
    isLoading,
    isReady: !isLoading,
  };
}

export default useLanguage;