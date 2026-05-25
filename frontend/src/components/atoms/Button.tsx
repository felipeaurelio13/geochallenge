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
    'bg-primary text-white border border-primary/80 shadow-lg shadow-primary/20 hover:bg-primary/90 focus:ring-primary/70',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-gray-500 hover:bg-[var(--color-surface-muted)] focus:ring-gray-500',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-app-muted/70 focus:ring-gray-500',
  danger: 'bg-red-500/15 text-[var(--color-error-500)] border border-red-500/60 hover:bg-red-500/25 focus:ring-red-400/70',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 py-2 text-sm rounded-lg',
  md: 'min-h-11 px-4 py-2.5 text-sm rounded-xl',
  lg: 'min-h-12 px-6 py-3 text-base rounded-xl',
};

// QA round 3 (design audit): el estado disabled del botón primario se veía
// como "loading" porque sólo bajábamos opacity-60 — el azul seguía claramente
// presente. Ahora también desaturamos y removemos shadow para que se lea
// "inactivo, no clickable" en vez de "casi activo, espera".
const baseClasses =
  'font-semibold transition-all duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50 disabled:shadow-none disabled:scale-100';

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
