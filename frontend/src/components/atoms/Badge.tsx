import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'danger';
  className?: string;
};

const toneClasses = {
  neutral: 'border-gray-700 bg-gray-800 text-gray-200',
  primary: 'border-primary/40 bg-primary/10 text-primary',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  danger: 'border-red-500/50 bg-red-500/10 text-red-200',
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}
