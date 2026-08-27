import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import React, { useEffect, useState } from 'react';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { Lang, translations } from './translations';

// Seçilen dil cihazda bu anahtarla saklanır, uygulama açılışında geri okunur.
const LANG_KEY = 'plantai:lang';

// i18next'i tek sefer yapılandır. Çeviri anahtarları düz (ör. 'home.hello')
// olduğu için key/namespace ayıracılarını kapatıyoruz — nokta bir anahtar
// parçası, iç içe yapı değil.
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: translations.tr },
    en: { translation: translations.en },
  },
  lng: 'tr',
  fallbackLng: 'tr',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((saved) => {
        if (saved === 'tr' || saved === 'en') return i18n.changeLanguage(saved);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

// Ekranların kullandığı sade API: { t, lang, setLang }.
export const useI18n = () => {
  const { t, i18n } = useTranslation();
  const setLang = (next: Lang) => {
    i18n.changeLanguage(next);
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  };
  return { t, lang: i18n.language as Lang, setLang };
};
