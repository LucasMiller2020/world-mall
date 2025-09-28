import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { 
  SUPPORTED_LANGUAGES, 
  changeLanguage, 
  getCurrentLanguage, 
  detectBrowserLanguage,
  type SupportedLanguage 
} from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const handleLanguageChange = async (language: SupportedLanguage) => {
    try {
      await changeLanguage(language);
      setCurrentLang(language);
      
      const languageInfo = SUPPORTED_LANGUAGES.find(lang => lang.code === language);
      toast({
        title: t('language.languageChanged', { language: languageInfo?.nativeName || language }),
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('errors.generic'),
        variant: 'destructive',
      });
    }
  };

  const handleDetectBrowserLanguage = async () => {
    const detectedLang = detectBrowserLanguage();
    if (detectedLang !== currentLang) {
      await handleLanguageChange(detectedLang);
      
      const languageInfo = SUPPORTED_LANGUAGES.find(lang => lang.code === detectedLang);
      toast({
        title: t('language.autoDetected', { language: languageInfo?.nativeName || detectedLang }),
        duration: 2000,
      });
    }
  };

  const currentLanguageInfo = SUPPORTED_LANGUAGES.find(lang => lang.code === currentLang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          data-testid="language-switcher-trigger"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm">{currentLanguageInfo?.flag}</span>
          <span className="sr-only">{t('language.switchLanguage')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-center">
          {t('language.switchLanguage')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuRadioGroup value={currentLang} onValueChange={handleLanguageChange}>
          {SUPPORTED_LANGUAGES.map((language) => (
            <DropdownMenuRadioItem
              key={language.code}
              value={language.code}
              className="flex items-center gap-3 cursor-pointer"
              data-testid={`language-option-${language.code}`}
            >
              <span className="text-base">{language.flag}</span>
              <div className="flex flex-col gap-0">
                <span className="font-medium">{language.nativeName}</span>
                {language.nativeName !== language.name && (
                  <span className="text-xs text-muted-foreground">{language.name}</span>
                )}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        
        <DropdownMenuSeparator />
        
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={handleDetectBrowserLanguage}
          data-testid="detect-browser-language"
        >
          <Globe className="h-4 w-4" />
          {t('language.detectBrowserLanguage')}
        </Button>
        
        <div className="p-2 text-xs text-muted-foreground text-center border-t">
          {t('language.currentLanguage')}: {currentLanguageInfo?.nativeName}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;