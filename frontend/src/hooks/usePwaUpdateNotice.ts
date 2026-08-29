import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { uiStoreActions } from '../store/useUiStore';

/**
 * Wires vite-plugin-pwa's prompt registration to the app's toast system.
 * `registerType: 'prompt'` (vite.config.ts) leaves a discovered update waiting;
 * this hook deliberately never activates it or reloads the page during gameplay.
 *
 * Informational only: the toast system (ToastHost) doesn't support action
 * buttons today, so we don't offer a "reload now" CTA here — just a heads-up
 * that a new version is available.
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
