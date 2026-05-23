import React from 'react';

interface FormLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FormLabel({ children, htmlFor, className = '' }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-app-secondary mb-2 ${className}`}>
      {children}
    </label>
  );
}
