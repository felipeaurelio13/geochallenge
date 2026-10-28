import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Refleja la ronda activa en el título de la pestaña y lo restaura al salir.
 * Se usa en las pantallas de juego que conocen su progreso total.
 */
export function useProgressDocumentTitle(active: boolean, current: number, total: number) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!active || total <= 0) return;
    const progressTitle = `${t('game.tabProgress', { current, total })} · ${t('app.name')}`;
    document.title = progressTitle;
    return () => {
      // No pisar el título de otra pantalla que haya tomado el control.
      if (document.title === progressTitle) document.title = t('app.name');
    };
  }, [active, current, total, t]);
}
