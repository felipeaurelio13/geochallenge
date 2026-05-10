interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'label';
}

export function SectionTitle({ children, className = '', variant = 'default' }: SectionTitleProps) {
  if (variant === 'label') {
    return (
      <p className={`text-xs font-medium uppercase tracking-wider text-gray-500 ${className}`}>
        {children}
      </p>
    );
  }
  return <h2 className={`text-lg font-semibold text-white ${className}`}>{children}</h2>;
}
