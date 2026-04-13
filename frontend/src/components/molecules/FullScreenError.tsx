import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface FullScreenErrorProps {
  emoji?: string;
  title?: string;
  message?: string;
  backTo?: string;
  backLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function FullScreenError({ emoji = '😢', title, message, backTo = '/menu', backLabel, onRetry, retryLabel }: FullScreenErrorProps) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">{emoji}</div>
        <h2 className="text-2xl font-bold text-white mb-2">{title || t('error.title')}</h2>
        {message && <p className="text-gray-400 mb-6">{message}</p>}
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
