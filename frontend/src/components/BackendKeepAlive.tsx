import { useEffect } from 'react';
import { api } from '../services/api';

const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function BackendKeepAlive() {
  useEffect(() => {
    const pingBackend = () => {
      if (document.hidden) {
        return;
      }

      void api.healthCheck();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        pingBackend();
      }
    };

    pingBackend();

    const intervalId = window.setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}

export { KEEP_ALIVE_INTERVAL_MS };
