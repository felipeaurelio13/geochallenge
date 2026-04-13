import React from 'react';

const typeStyles = {
  error: 'border-red-500/50 bg-red-900/40 text-red-200',
  success: 'border-green-500/50 bg-green-900/40 text-green-200',
  warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-100',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-100',
} as const;

interface AlertProps {
  type: keyof typeof typeStyles;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export function Alert({ type, children, className = '', onDismiss }: AlertProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${typeStyles[type]} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>{children}</div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">✕</button>
        )}
      </div>
    </div>
  );
}
