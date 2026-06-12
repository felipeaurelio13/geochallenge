import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';

interface ServerWakeUpProps {
  children: React.ReactNode;
}

// Antes mostrábamos sólo el spinner durante 3s sin contexto. QA marcó que se
// sentía como app rota. Bajamos a 1s para que el mensaje "despertando el
// servidor" aparezca antes y le diga al usuario qué está pasando.
const WAKEUP_HINT_DELAY_MS = 1000;
// Render free tier tarda ~30s en despertar; reintentamos el health check en
// vez de soltar al usuario contra un backend dormido. Cada intento ya trae
// retries internos del api client, así que pocos intentos cubren el cold start.
const WAKEUP_MAX_ATTEMPTS = 3;
const WAKEUP_RETRY_DELAY_MS = 2000;

export function ServerWakeUp({ children }: ServerWakeUpProps) {
  const { t } = useTranslation();
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp, setShowWakeUp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const showTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setShowWakeUp(true);
    }, WAKEUP_HINT_DELAY_MS);

    const waitForServer = async () => {
      for (let attempt = 1; attempt <= WAKEUP_MAX_ATTEMPTS; attempt++) {
        try {
          await api.healthCheck();
          break;
        } catch {
          if (cancelled || attempt === WAKEUP_MAX_ATTEMPTS) break;
          await new Promise((resolve) => setTimeout(resolve, WAKEUP_RETRY_DELAY_MS));
        }
      }
      // Tras agotar intentos igual dejamos pasar: el modo offline (IndexedDB)
      // permite jugar sin backend y el resto de la app maneja sus errores.
      if (!cancelled) {
        clearTimeout(showTimer);
        setServerReady(true);
      }
    };

    void waitForServer();

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
    };
  }, []);

  if (serverReady) {
    return <>{children}</>;
  }

  if (!showWakeUp) {
    return (
      <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6 animate-bounce">🌍</div>
      <h2 className="text-2xl font-bold text-app-text mb-3">
        {t('serverWakeUp.title', 'Despertando el servidor...')}
      </h2>
      <p className="text-app-subtle mb-6 max-w-sm">
        {t(
          'serverWakeUp.body',
          'El servidor gratuito se duerme tras unos minutos de inactividad. Esto solo toma unos segundos.'
        )}
      </p>
      <LoadingSpinner size="lg" />
    </div>
  );
}
