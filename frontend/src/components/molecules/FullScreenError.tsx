import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '../atoms/Button';
import { GeoMark } from '../atoms/GeoMark';

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
    <div className="h-full min-h-0 bg-[var(--color-bg-app)] flex items-center justify-center px-4">
      <div className="text-center">
        {emoji && <GeoMark className="mx-auto mb-4 h-14 w-14 text-error-500" />}
        <h2 className="text-2xl font-bold text-app-text mb-2">{title || t('error.title')}</h2>
        {message && <p className="text-[var(--color-text-muted)] mb-6">{message}</p>}
        <div className="flex flex-col gap-3 items-center">
          {onRetry && (
            <Button onClick={onRetry} variant="primary" size="lg">
              {retryLabel || t('error.retry')}
            </Button>
          )}
          <Link to={backTo} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            {backLabel || t('error.backToMenu')}
          </Link>
        </div>
      </div>
    </div>
  );
}
