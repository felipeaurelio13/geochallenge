import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl shadow-black/20 ${className}`.trim()}>{children}</section>;
}
