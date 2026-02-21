import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white border border-primary/80 shadow-lg shadow-primary/20 hover:bg-primary/90 focus:ring-primary/70',
  secondary:
    'bg-gray-900 text-gray-100 border border-gray-700 hover:border-gray-500 hover:bg-gray-800 focus:ring-gray-500',
  ghost: 'bg-transparent text-gray-200 border border-transparent hover:bg-gray-800/70 focus:ring-gray-500',
  danger: 'bg-red-500/15 text-red-200 border border-red-500/60 hover:bg-red-500/25 focus:ring-red-400/70',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 py-2 text-sm rounded-lg',
  md: 'min-h-11 px-4 py-2.5 text-sm rounded-xl',
  lg: 'min-h-12 px-6 py-3 text-base rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', variant = 'primary', size = 'md', fullWidth = false, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`font-semibold transition-all duration-150 active:scale-[0.99] focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
      {...props}
    />
  );
});
