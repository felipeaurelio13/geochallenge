import { useTranslation } from 'react-i18next';

// QA fix HI-7: antes el único punto para cambiar idioma estaba escondido
// en /profile → Editar. Un usuario con el browser en inglés llegaba a /menu
// y no encontraba cómo cambiar a español. Este toggle visible en el header
// resuelve ese discovery problem en un click.
//
// Sólo dos idiomas (es/en) hoy → un toggle pill compacto cabe en mobile.
// Si en el futuro hay más idiomas, migrar a un dropdown.
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  // Algunos tests mockean useTranslation sin pasar i18n. Defensa para no
  // romper la suite y para no caer si el provider no terminó de inicializar.
  if (!i18n || typeof i18n.changeLanguage !== 'function') return null;
  const current = (i18n.language || 'es').split('-')[0];
  const next = current === 'es' ? 'en' : 'es';
  const label = current === 'es' ? 'EN' : 'ES';

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      className="pressable inline-flex min-h-11 items-center justify-center rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs font-semibold text-app-secondary transition-colors hover:border-app-border hover:text-app-text"
      title={t('profile.language')}
      aria-label={`${t('profile.language')}: ${label}`}
    >
      {label}
    </button>
  );
}
