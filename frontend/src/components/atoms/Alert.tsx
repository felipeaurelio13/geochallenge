import React from 'react';

const typeStyles = {
  error: 'border-red-500/50 bg-red-500/10 text-[var(--color-error-500)]',
  success: 'border-green-500/50 bg-green-500/10 text-[var(--color-success-600)]',
  warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-600',
} as const;

interface AlertProps {
  type: keyof typeof typeStyles;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
  /** ARIA role — default `alert` para que lectores de pantalla anuncien. */
  role?: 'alert' | 'status';
  /** ARIA live region politeness para anunciar cambios dinámicos. */
  'aria-live'?: 'off' | 'polite' | 'assertive';
}

export function Alert({ type, children, className = '', onDismiss, role = 'alert', ...ariaProps }: AlertProps) {
  return (
    <div
      role={role}
      aria-live={ariaProps['aria-live']}
      className={`rounded-lg border px-4 py-3 text-sm ${typeStyles[type]} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>{children}</div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">✕</button>
        )}
      </div>
    </div>
  );
}
