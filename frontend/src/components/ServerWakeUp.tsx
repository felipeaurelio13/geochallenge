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
// Part 4.3: mensaje rotativo cada ~8s (mantiene la espera viva en vez de un
// texto estático) + aviso de "esto está tardando" a los 30s totales.
const ROTATING_MESSAGE_INTERVAL_MS = 8000;
const TOO_LONG_THRESHOLD_MS = 30000;
const ROTATING_MESSAGE_KEYS = ['serverWakeUp.rotating1', 'serverWakeUp.rotating2', 'serverWakeUp.rotating3'];

export function ServerWakeUp({ children }: ServerWakeUpProps) {
  const { t } = useTranslation();
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp, setShowWakeUp] = useState(false);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const [showTooLong, setShowTooLong] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const showTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setShowWakeUp(true);
    }, WAKEUP_HINT_DELAY_MS);

    // Mensaje rotativo: cicla por ROTATING_MESSAGE_KEYS mientras esperamos.
    // Additive-only — no toca la lógica de retry/intentos existente.
    const rotatingTimer = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % ROTATING_MESSAGE_KEYS.length);
    }, ROTATING_MESSAGE_INTERVAL_MS);

    const tooLongTimer = setTimeout(() => {
      setShowTooLong(true);
    }, TOO_LONG_THRESHOLD_MS);

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
        clearInterval(rotatingTimer);
        clearTimeout(tooLongTimer);
        setServerReady(true);
      }
    };

    void waitForServer();

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearInterval(rotatingTimer);
      clearTimeout(tooLongTimer);
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
      <p className="text-app-subtle mb-2 max-w-sm" aria-live="polite">
        {t(ROTATING_MESSAGE_KEYS[rotatingIndex])}
      </p>
      <p className="text-app-subtle mb-6 max-w-sm">
        {t(
          'serverWakeUp.body',
          'El servidor gratuito se duerme tras unos minutos de inactividad. Esto solo toma unos segundos.'
        )}
      </p>
      {showTooLong && (
        <p className="mb-6 max-w-sm text-sm text-amber-600">{t('serverWakeUp.tooLong')}</p>
      )}
      <LoadingSpinner size="lg" />
    </div>
  );
}
