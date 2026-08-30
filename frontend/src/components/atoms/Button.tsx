import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-primary bg-primary text-white hover:bg-primary/90 focus:ring-primary/70',
  secondary:
    'border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-surface)] focus:ring-primary/70',
  ghost: 'border border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-app-muted focus:ring-primary/70',
  danger: 'bg-red-500/15 text-[var(--color-error-500)] border border-red-500/60 hover:bg-red-500/25 focus:ring-red-400/70',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 py-2 text-sm rounded-md',
  md: 'min-h-12 px-4 py-2.5 text-sm rounded-md',
  lg: 'min-h-12 px-6 py-3 text-base rounded-md',
};

// QA round 3 (design audit): el estado disabled del botón primario se veía
// como "loading" porque sólo bajábamos opacity-60 — el azul seguía claramente
// presente. Ahora también desaturamos y removemos shadow para que se lea
// "inactivo, no clickable" en vez de "casi activo, espera".
const baseClasses =
  'font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50 disabled:scale-100';

/** Build the full class string for a button-styled element (Button, Link, etc.). */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim();
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', variant = 'primary', size = 'md', fullWidth = false, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    />
  );
});
