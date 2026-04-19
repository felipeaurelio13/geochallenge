import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharePayload, useWebShare } from '../hooks/useWebShare';
import { Button, ButtonSize, ButtonVariant } from './atoms/Button';

interface ShareButtonProps {
  payload: SharePayload;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  onShared?: () => void;
}

export function ShareButton({
  payload,
  label,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  className,
  onShared,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const { share, status } = useWebShare();
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    const result = await share(payload);
    if (result === 'shared') {
      setFeedback('shared');
      onShared?.();
    } else if (result === 'copied') {
      setFeedback('copied');
      onShared?.();
    } else if (result === 'error') {
      setFeedback('error');
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFeedback('idle'), 2800);
  }, [share, payload, onShared]);

  const isSharing = status === 'sharing';
  const buttonLabel = label ?? t('results.shareButton');

  const feedbackMessage = (() => {
    if (feedback === 'shared') return t('share.shared', '¡Compartido!');
    if (feedback === 'copied') return t('share.copied', 'Copiado al portapapeles');
    if (feedback === 'error') return t('share.error', 'No se pudo compartir');
    return '';
  })();

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <Button
        onClick={handleClick}
        disabled={isSharing}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        className={className}
      >
        🔗 {isSharing ? `${t('common.loading')}...` : buttonLabel}
      </Button>
      <p className="mt-2 min-h-5 text-xs text-green-300" aria-live="polite">
        {feedbackMessage}
      </p>
    </div>
  );
}
