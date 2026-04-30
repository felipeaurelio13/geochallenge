import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../services/api';

interface FullScreenErrorProps {
  emoji?: string;
  title?: string;
  message?: string;
  error?: unknown;
  backTo?: string;
  backLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const EMOJI_BY_CODE: Record<string, string> = {
  network: '📡',
  noServer: '📡',
  timeout: '⌛',
  auth: '🔒',
  forbidden: '🚫',
  notFound: '🧭',
  rateLimit: '⏳',
  server: '🛠️',
  http: '⚠️',
  unknown: '😕',
};

export function FullScreenError({ emoji, title, message, error, backTo = '/menu', backLabel, onRetry, retryLabel }: FullScreenErrorProps) {
  const { t } = useTranslation();

  let resolvedEmoji = emoji ?? '😕';
  let resolvedMessage = message;

  if (error instanceof ApiError) {
    resolvedEmoji = emoji ?? EMOJI_BY_CODE[error.code] ?? '😕';
    resolvedMessage = message ?? t(`error.${error.code}`, { defaultValue: error.message });
  } else if (error instanceof Error && !resolvedMessage) {
    resolvedMessage = error.message;
  } else if (typeof error === 'string' && !resolvedMessage) {
    resolvedMessage = error;
  }

  return (
    <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4" aria-hidden="true">{resolvedEmoji}</div>
        <h2 className="text-2xl font-bold text-white mb-2">{title || t('error.title')}</h2>
        {resolvedMessage && <p className="text-gray-400 mb-6">{resolvedMessage}</p>}
        <div className="flex flex-col gap-3 items-center">
          {onRetry && (
            <button onClick={onRetry} className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors">
              {retryLabel || t('error.retry')}
            </button>
          )}
          <Link to={backTo} className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
            {backLabel || t('error.backToMenu')}
          </Link>
        </div>
      </div>
    </div>
  );
}
