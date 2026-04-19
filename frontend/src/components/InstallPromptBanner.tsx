import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useMediaQuery } from '../hooks/useMediaQuery';

export function InstallPromptBanner() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { canShow, hasNativePrompt, isIOS, promptInstall, dismiss } = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  if (!isMobile || !canShow) return null;

  const handleInstall = async () => {
    if (!hasNativePrompt) return;
    setBusy(true);
    await promptInstall();
    setBusy(false);
  };

  return (
    <div
      role="complementary"
      aria-label={t('install.title', 'Instala la app')}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-gray-700 bg-gray-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="text-2xl" aria-hidden="true">📲</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{t('install.title', 'Instala GeoChallenge')}</p>
            <p className="mt-0.5 text-xs text-gray-300">
              {isIOS && !hasNativePrompt
                ? t('install.iosHint', 'Toca Compartir y luego "Añadir a pantalla de inicio".')
                : t('install.hint', 'Juega más rápido. Se abre como app, sin barra del navegador.')}
            </p>
            <div className="mt-2 flex gap-2">
              {hasNativePrompt && (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={busy}
                  className="pressable min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? '…' : t('install.cta', 'Instalar')}
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="pressable min-h-10 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300"
              >
                {t('install.dismiss', 'Ahora no')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
