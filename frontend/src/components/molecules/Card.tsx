import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return <section className={`rounded-2xl border border-gray-800 bg-gray-900/95 shadow-xl shadow-black/20 ${className}`.trim()}>{children}</section>;
}
