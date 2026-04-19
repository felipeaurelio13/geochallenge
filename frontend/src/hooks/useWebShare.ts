import { useCallback, useState } from 'react';

export type ShareStatus = 'idle' | 'sharing' | 'shared' | 'copied' | 'error';

export interface SharePayload {
  title?: string;
  text: string;
  url?: string;
}

export function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function useWebShare() {
  const [status, setStatus] = useState<ShareStatus>('idle');

  const share = useCallback(async (payload: SharePayload): Promise<ShareStatus> => {
    setStatus('sharing');
    try {
      if (isWebShareSupported()) {
        await navigator.share(payload);
        setStatus('shared');
        return 'shared';
      }
      if (navigator?.clipboard?.writeText) {
        const text = payload.url ? `${payload.text}\n${payload.url}` : payload.text;
        await navigator.clipboard.writeText(text);
        setStatus('copied');
        return 'copied';
      }
      setStatus('error');
      return 'error';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setStatus('idle');
        return 'idle';
      }
      console.error('Share failed:', error);
      setStatus('error');
      return 'error';
    }
  }, []);

  const reset = useCallback(() => setStatus('idle'), []);

  return { share, status, reset, supported: isWebShareSupported() };
}
