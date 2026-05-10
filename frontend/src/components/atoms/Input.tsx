import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', hasError = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-xl border bg-[var(--color-surface-muted)] px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 ${
        hasError
          ? 'border-red-500/70 focus:border-red-400 focus:ring-red-400/60'
          : 'border-[var(--color-border)] focus:border-primary focus:ring-primary/70'
      } ${className}`.trim()}
      {...props}
    />
  );
});
