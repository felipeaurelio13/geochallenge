import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';

interface ServerWakeUpProps {
  children: React.ReactNode;
}

export function ServerWakeUp({ children }: ServerWakeUpProps) {
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp, setShowWakeUp] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>;

    // After 3s without response, show "waking up" message
    showTimer = setTimeout(() => {
      if (!serverReady) {
        setShowWakeUp(true);
      }
    }, 3000);

    api.healthCheck().then(() => {
      clearTimeout(showTimer);
      setServerReady(true);
    });

    return () => clearTimeout(showTimer);
  }, []);

  if (serverReady) {
    return <>{children}</>;
  }

  if (!showWakeUp) {
    // Still within 3s, show minimal spinner
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Server is taking long — cold start
  return (
    <div className="h-full min-h-0 bg-gray-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6 animate-bounce">🌍</div>
      <h2 className="text-2xl font-bold text-white mb-3">Despertando el servidor...</h2>
      <p className="text-gray-400 mb-6 max-w-sm">
        El servidor gratuito se duerme tras unos minutos de inactividad.
        Esto solo toma unos segundos.
      </p>
      <LoadingSpinner size="lg" />
    </div>
  );
}
