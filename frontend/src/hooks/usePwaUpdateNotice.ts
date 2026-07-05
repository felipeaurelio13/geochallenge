import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { uiStoreActions } from '../store/useUiStore';

/**
 * Wires vite-plugin-pwa's autoUpdate registration to the app's toast system.
 * `registerType: 'autoUpdate'` (vite.config.ts) installs updates silently in the
 * background — without this, users have no signal that a new version landed and
 * that a reload will pick it up.
 *
 * Informational only: the toast system (ToastHost) doesn't support action
 * buttons today, so we don't offer a "reload now" CTA here — just a heads-up
 * that changes apply on the next reload.
 */
export function usePwaUpdateNotice(): void {
  const { t } = useTranslation();
  const { needRefresh } = useRegisterSW();
  const [isUpdateAvailable] = needRefresh;

  useEffect(() => {
    if (isUpdateAvailable) {
      uiStoreActions.pushToast({ type: 'info', message: t('pwa.updateAvailable') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpdateAvailable]);
}
