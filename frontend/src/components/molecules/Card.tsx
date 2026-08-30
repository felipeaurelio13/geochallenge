import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`.trim()}>{children}</section>;
}
