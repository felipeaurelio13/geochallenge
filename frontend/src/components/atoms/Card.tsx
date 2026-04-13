interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const padClasses = { sm: 'p-3', md: 'p-4', lg: 'p-5 sm:p-6' };

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`rounded-xl border border-gray-700 bg-gray-800 ${padClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}
