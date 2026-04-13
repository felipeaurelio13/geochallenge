interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionTitle({ children, className = '' }: SectionTitleProps) {
  return <h2 className={`text-lg font-semibold text-white ${className}`}>{children}</h2>;
}
