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

export function ServerWakeUp({ children }: ServerWakeUpProps) {
  const { t } = useTranslation();
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp, setShowWakeUp] = useState(false);

  useEffect(() => {
    const showTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (!serverReady) {
        setShowWakeUp(true);
      }
    }, WAKEUP_HINT_DELAY_MS);

    api
      .healthCheck()
      .then(() => {
        clearTimeout(showTimer);
        setServerReady(true);
      })
      .catch(() => {
        setServerReady(true);
      });

    return () => clearTimeout(showTimer);
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
