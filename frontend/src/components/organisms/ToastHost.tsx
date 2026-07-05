import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type Toast, uiStoreActions, useUiStore } from '../../store/useUiStore';

const DEFAULT_DURATION_MS: Record<Toast['type'], number> = {
  success: 4000,
  info: 4000,
  achievement: 6000,
};

const TONE_CLASSES: Record<Toast['type'], string> = {
  success: 'border-green-500/40 bg-green-500/15 text-green-100',
  info: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]',
  achievement: 'border-amber-400/50 bg-gradient-to-br from-amber-500/20 to-orange-500/15 text-amber-100',
};

function ToastItem({ toast, prefersReducedMotion }: { toast: Toast; prefersReducedMotion: boolean }) {
  const { t } = useTranslation();
  const remainingRef = useRef(toast.durationMs ?? DEFAULT_DURATION_MS[toast.type]);
  const startedAtRef = useRef(Date.now());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const schedule = () => {
      startedAtRef.current = Date.now();
      timeoutRef.current = window.setTimeout(() => {
        uiStoreActions.dismissToast(toast.id);
      }, remainingRef.current);
    };

    schedule();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.id]);

  const pause = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  };

  const resume = () => {
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => {
      uiStoreActions.dismissToast(toast.id);
    }, remainingRef.current);
  };

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${TONE_CLASSES[toast.type]} ${
        prefersReducedMotion ? '' : 'animate-slide-up'
      }`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => uiStoreActions.dismissToast(toast.id)}
          aria-label={t('a11y.dismissToast')}
          className="shrink-0 rounded-full p-1 text-current/70 transition-colors hover:bg-black/10 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}

export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} prefersReducedMotion={prefersReducedMotion} />
      ))}
    </div>
  );
}
