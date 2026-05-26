import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './es.json';
import en from './en.json';

function syncHtmlLang(lng: string | undefined) {
  if (typeof document === 'undefined' || !lng) return;
  // Normaliza "en-US" → "en" para el atributo lang del documento.
  // Sin esto los lectores de pantalla pronunciaban contenido en inglés
  // con fonemas españoles (lang="es" hardcoded).
  document.documentElement.lang = lng.split('-')[0] ?? lng;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })
  .then(() => syncHtmlLang(i18n.language));

i18n.on('languageChanged', syncHtmlLang);

export default i18n;
